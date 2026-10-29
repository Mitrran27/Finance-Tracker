<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { fmt, showToast, today } from '$lib/stores.js';
  import Modal from '$lib/components/Modal.svelte';
  import FunLoader from '$lib/components/FunLoader.svelte';

  const TYPES = [
    { value: 'car',       label: 'Car',       icon: '🚗' },
    { value: 'house',     label: 'House',     icon: '🏠' },
    { value: 'insurance', label: 'Insurance', icon: '🛡️' },
    { value: 'loan',      label: 'Loan',      icon: '💳' },
    { value: 'education', label: 'Education', icon: '🎓' },
    { value: 'family',    label: 'Family',    icon: '👪' },
    { value: 'other',     label: 'Other',     icon: '📌' },
  ];
  const typeOf = v => TYPES.find(t => t.value === v) || TYPES[TYPES.length - 1];

  let items = [], banks = [], loading = true;
  let showForm = false, editing = null;

  let fName = '', fType = 'car', fAmount = '', fEnd = '', fDetails = '';

  // Paying adds an expense transaction linked to the commitment
  let showPay = false, paying = null;
  let pAmount = '', pDate = today(), pBank = '';

  onMount(() => {
    load();
    api.get('/banks').then(b => banks = b).catch(() => {});
  });

  async function load() {
    loading = true;
    try { items = await api.get(`/commitments?month=${today().slice(0,7)}`); }
    catch(e) { showToast(e.message, 'error'); }
    finally { loading = false; }
  }

  function openPay(c) {
    paying = c; pAmount = Number(c.amount).toFixed(2); pDate = today(); pBank = banks[0]?.id || '';
    showPay = true;
  }

  async function savePayment() {
    const amount = parseFloat(pAmount);
    if (isNaN(amount) || amount <= 0) return showToast('Enter the amount you paid', 'error');
    try {
      await api.post('/transactions', {
        type: 'expense', amount, date: pDate, bank_id: pBank || null,
        description: paying.name, category: paying.type === 'car' ? 'Transport' : 'Bills',
        commitment_id: paying.id,
      });
      showToast(`${paying.name} paid — added to your expenses`);
      showPay = false; paying = null; load();
    } catch(e) { showToast(e.message, 'error'); }
  }

  function openAdd() {
    editing = null; fName = ''; fType = 'car'; fAmount = ''; fEnd = ''; fDetails = '';
    showForm = true;
  }

  function openEdit(c) {
    editing = c; fName = c.name; fType = c.type || 'other'; fAmount = c.amount;
    fEnd = c.end_date || ''; fDetails = c.details || '';
    showForm = true;
  }

  async function save() {
    const amount = parseFloat(fAmount);
    if (!fName.trim()) return showToast('Enter a name for the commitment', 'error');
    if (isNaN(amount)) return showToast('Enter the monthly amount', 'error');
    const body = { name: fName, type: fType, amount, end_date: fEnd || null, details: fDetails || null };
    try {
      if (editing) await api.patch(`/commitments/${editing.id}`, body);
      else await api.post('/commitments', body);
      showToast(editing ? 'Commitment updated!' : 'Commitment added!');
      showForm = false; editing = null; load();
    } catch(e) { showToast(e.message, 'error'); }
  }

  async function remove(c) {
    if (!confirm(`Delete "${c.name}"?`)) return;
    try { await api.delete(`/commitments/${c.id}`); showToast('Deleted!'); load(); }
    catch(e) { showToast(e.message, 'error'); }
  }

  // Months left until end_date, counting the current month
  function monthsLeft(c) {
    if (!c.end_date) return null;
    const [ey, em] = c.end_date.split('-').map(Number);
    const [ty, tm] = today().split('-').map(Number);
    return Math.max(0, (ey - ty) * 12 + (em - tm) + 1);
  }

  const isPaid = c => Number(c.paid_month) >= Number(c.amount);

  $: monthly = items.reduce((s,c) => s + Number(c.amount), 0);
  $: unpaid  = items.filter(c => !isPaid(c));
  $: paidSoFar = items.reduce((s,c) => s + Number(c.paid_month || 0), 0);
  $: remaining = items.reduce((s,c) => {
    const m = monthsLeft(c);
    return m == null ? s : s + m * Number(c.amount);
  }, 0);
</script>

<div class="fade-in space">
  <div class="page-hdr">
    <p class="count">{items.length} commitment{items.length !== 1 ? 's' : ''}</p>
    <button class="btn-primary" on:click={openAdd}>+ Add Commitment</button>
  </div>

  <div class="stat-grid">
    <div class="stat-card glass card-red">
      <p class="stat-label">Every month</p>
      <p class="stat-val mono neg">{fmt(monthly)}</p>
      <p class="stat-sub">{items.length} commitment{items.length !== 1 ? 's' : ''}</p>
    </div>
    <div class="stat-card glass card-orange">
      <p class="stat-label">Paid this month</p>
      <p class="stat-val mono">{fmt(paidSoFar)}</p>
      <p class="stat-sub">{unpaid.length ? `${unpaid.length} still to pay` : items.length ? 'all paid ✓' : '—'}</p>
    </div>
    <div class="stat-card glass card-green">
      <p class="stat-label">Left to pay</p>
      <p class="stat-val mono">{fmt(remaining)}</p>
      <p class="stat-sub">for ones with an end date</p>
    </div>
  </div>

  {#if loading}
    <FunLoader />
  {:else if items.length === 0}
    <div class="glass empty-state">
      <p>No commitments yet.</p>
      <p class="muted">Add your fixed monthly payments — car loan, house loan, insurance, and so on.</p>
    </div>
  {:else}
    <div class="glass list">
      {#each items as c (c.id)}
        {@const t = typeOf(c.type)}
        {@const left = monthsLeft(c)}
        <div class="row">
          <span class="type-icon" title={t.label}>{t.icon}</span>
          <div class="info">
            <p class="name">{c.name}</p>
            <p class="meta">
              <span class="tag">{t.label}</span>
              {#if isPaid(c)}
                <span class="status paid">✓ Paid this month</span>
              {:else if Number(c.paid_month) > 0}
                <span class="status part">{fmt(c.paid_month)} paid this month</span>
              {:else}
                <span class="status due">Not paid this month</span>
              {/if}
              {#if c.end_date}<span>Until {c.end_date}{left != null ? ` · ${left} month${left !== 1 ? 's' : ''} left` : ''}</span>{/if}
            </p>
            {#if c.details}<p class="details">{c.details}</p>{/if}
          </div>
          <p class="amt mono">{fmt(c.amount)}<span class="per">/mo</span></p>
          <div class="actions">
            {#if !isPaid(c)}<button class="pay-btn" on:click={() => openPay(c)}>Pay</button>{/if}
            <button class="icon-btn" on:click={() => openEdit(c)} title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
            <button class="icon-btn danger" on:click={() => remove(c)} title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<Modal title={editing ? 'Edit Commitment' : 'Add Commitment'} bind:show={showForm} onClose={() => showForm = false}>
  <div class="form-group">
    <label for="cm-name">Name</label>
    <input id="cm-name" class="input-field" placeholder="e.g. Myvi loan, house loan, Takaful" bind:value={fName}>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label for="cm-type">Type</label>
      <select id="cm-type" class="input-field" bind:value={fType}>
        {#each TYPES as t}<option value={t.value}>{t.icon} {t.label}</option>{/each}
      </select>
    </div>
    <div class="form-group">
      <label for="cm-amt">Monthly amount (RM)</label>
      <input id="cm-amt" class="input-field" type="number" step="0.01" placeholder="0.00" bind:value={fAmount}>
    </div>
  </div>
  <div class="form-group">
    <label for="cm-end">Ends on (optional)</label>
    <input id="cm-end" class="input-field" type="date" bind:value={fEnd}>
  </div>
  <div class="form-group">
    <label for="cm-details">Details (optional)</label>
    <textarea id="cm-details" class="input-field" rows="3" placeholder="Bank, account no., loan tenure, payment day…" bind:value={fDetails}></textarea>
  </div>
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showForm = false}>Cancel</button>
    <button class="btn-primary" on:click={save}>{editing ? 'Update' : 'Add Commitment'}</button>
  </div>
</Modal>

<Modal title={paying ? `Pay ${paying.name}` : 'Pay'} bind:show={showPay} onClose={() => showPay = false}>
  <p class="muted pay-help">This adds an expense under Transactions, linked to this commitment.</p>
  <div class="form-row">
    <div class="form-group">
      <label for="cp-amt">Amount (RM)</label>
      <input id="cp-amt" class="input-field" type="number" step="0.01" bind:value={pAmount}>
    </div>
    <div class="form-group">
      <label for="cp-date">Date</label>
      <input id="cp-date" class="input-field" type="date" bind:value={pDate}>
    </div>
  </div>
  <div class="form-group">
    <label for="cp-bank">Paid from</label>
    <select id="cp-bank" class="input-field" bind:value={pBank}>
      <option value="">None</option>
      {#each banks as b}<option value={b.id}>{b.name}</option>{/each}
    </select>
  </div>
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showPay = false}>Cancel</button>
    <button class="btn-primary" on:click={savePayment}>Add Payment</button>
  </div>
</Modal>

<style>
  .space{display:flex;flex-direction:column;gap:16px;}
  .page-hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}
  .count{font-size:14px;color:var(--text2);}
  .muted{color:var(--text2);font-size:13px;}
  .empty-state{padding:40px;text-align:center;color:var(--text2);display:flex;flex-direction:column;gap:6px;}

  .stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
  .stat-card{padding:16px;border-radius:12px;position:relative;overflow:hidden;min-width:0;}
  .stat-card::before{content:'';position:absolute;top:0;right:0;width:60px;height:60px;border-radius:50%;filter:blur(30px);opacity:.2;}
  .card-green::before{background:var(--accent);}
  .card-orange::before{background:var(--warning);}
  .card-red::before{background:var(--danger);}
  .stat-label{font-size:11px;color:var(--text2);margin-bottom:6px;}
  .stat-val{font-size:20px;font-weight:700;overflow-wrap:anywhere;}
  .stat-sub{font-size:11px;color:var(--text2);margin-top:4px;}
  .mono{font-family:'Space Mono',monospace;}
  .neg{color:var(--danger);}

  .list{display:flex;flex-direction:column;overflow:hidden;}
  .row{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border);}
  .row:last-child{border-bottom:none;}
  .type-icon{width:34px;height:34px;flex-shrink:0;border-radius:10px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:17px;}
  .info{flex:1;min-width:0;}
  .name{font-size:14px;font-weight:600;overflow-wrap:anywhere;}
  .meta{display:flex;flex-wrap:wrap;gap:6px 10px;margin-top:3px;font-size:11px;color:var(--text2);}
  .tag{background:var(--surface2);padding:1px 8px;border-radius:20px;}
  .details{margin-top:4px;font-size:12px;color:var(--text2);overflow-wrap:anywhere;white-space:pre-line;}
  .amt{font-weight:700;font-size:14px;white-space:nowrap;}
  .per{font-size:11px;font-weight:400;color:var(--text2);margin-left:2px;}
  .actions{display:flex;gap:2px;align-items:center;}
  .status{font-weight:600;}
  .status.paid{color:var(--accent);}
  .status.part{color:var(--warning);}
  .status.due{color:var(--text2);}
  .pay-btn{background:rgba(0,229,160,.12);color:var(--accent);border:none;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;margin-right:4px;}
  .pay-btn:hover{background:rgba(0,229,160,.22);}
  .pay-help{margin-bottom:14px;}
  .icon-btn{background:none;border:none;cursor:pointer;color:rgba(255,255,255,.45);padding:5px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:all .15s;}
  .icon-btn:hover{background:rgba(0,229,160,.12);color:var(--accent);}
  .icon-btn.danger:hover{background:rgba(255,92,124,.12);color:var(--danger);}

  .form-group{margin-bottom:14px;}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .modal-actions{display:flex;gap:8px;margin-top:20px;}
  textarea.input-field{resize:vertical;width:100%;font-family:inherit;}

  @media(max-width:600px){
    .page-hdr > button{width:100%;justify-content:center;}
    .stat-grid{grid-template-columns:1fr 1fr;gap:10px;}
    .stat-grid .stat-card:first-child{grid-column:1/-1;}
    .stat-card{padding:12px;}
    .row{padding:12px;gap:10px;flex-wrap:wrap;}
    .info{flex-basis:calc(100% - 46px);}
    .amt{margin-left:44px;}
    .actions{margin-left:auto;}
    .icon-btn{min-width:36px;min-height:36px;}
    .pay-btn{min-height:36px;padding:0 16px;}
    .form-row{grid-template-columns:1fr;gap:0;}
    .modal-actions > button{flex:1;justify-content:center;}
  }
</style>
