<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { fmt, showToast, today } from '$lib/stores.js';
  import Modal from '$lib/components/Modal.svelte';
  import FunLoader from '$lib/components/FunLoader.svelte';

  let debts = [], loading = true;
  let showForm = false, editing = null;
  let showCleared = false;
  let expanded = {};

  let fName = '', fAmount = '', fDetails = '';

  // Record a payment by hand
  let showPay = false, paying = null;
  let pAmount = '', pDate = today(), pNote = '';

  onMount(load);

  async function load() {
    loading = true;
    try { debts = await api.get('/debts'); }
    catch(e) { showToast(e.message, 'error'); }
    finally { loading = false; }
  }

  function openAdd() {
    editing = null; fName = ''; fAmount = ''; fDetails = '';
    showForm = true;
  }

  function openEdit(d) {
    editing = d; fName = d.name; fAmount = d.amount; fDetails = d.details || '';
    showForm = true;
  }

  async function save() {
    const amount = parseFloat(fAmount);
    if (!fName.trim()) return showToast('Enter who or what the debt is for', 'error');
    if (isNaN(amount)) return showToast('Enter an amount', 'error');
    const body = { name: fName, amount, details: fDetails || null };
    try {
      if (editing) await api.patch(`/debts/${editing.id}`, body);
      else await api.post('/debts', body);
      showToast(editing ? 'Debt updated!' : 'Debt added!');
      showForm = false; editing = null; load();
    } catch(e) { showToast(e.message, 'error'); }
  }

  async function toggleCleared(d) {
    try {
      await api.patch(`/debts/${d.id}`, { cleared: !d.cleared });
      showToast(d.cleared ? 'Moved back to outstanding' : 'Debt cleared ✓');
      load();
    } catch(e) { showToast(e.message, 'error'); }
  }

  async function remove(d) {
    if (!confirm(`Delete "${d.name}"? Its payment history goes with it.`)) return;
    try { await api.delete(`/debts/${d.id}`); showToast('Deleted!'); load(); }
    catch(e) { showToast(e.message, 'error'); }
  }

  function openPay(d) {
    paying = d; pAmount = ''; pDate = today(); pNote = '';
    showPay = true;
  }

  async function savePayment() {
    const amount = parseFloat(pAmount);
    if (isNaN(amount) || amount <= 0) return showToast('Enter the amount you paid', 'error');
    try {
      await api.post(`/debts/${paying.id}/payments`, { amount, date: pDate || null, note: pNote || null });
      showToast(amount >= remaining(paying) ? `${paying.name} is fully paid 🎉` : 'Payment recorded!');
      expanded[paying.id] = true;
      showPay = false; paying = null; load();
    } catch(e) { showToast(e.message, 'error'); }
  }

  async function removePayment(d, p) {
    if (!confirm(`Remove the ${fmt(p.amount)} payment on ${p.date}?`)) return;
    try { await api.delete(`/debts/${d.id}/payments/${p.id}`); showToast('Payment removed'); load(); }
    catch(e) { showToast(e.message, 'error'); }
  }

  const remaining = d => Math.max(0, Number(d.amount) - Number(d.paid));
  const pct = d => Number(d.amount) > 0 ? Math.min(100, Number(d.paid) / Number(d.amount) * 100) : 0;

  $: outstanding = debts.filter(d => !d.cleared);
  $: cleared     = debts.filter(d => d.cleared);
  $: totalOwed   = outstanding.reduce((s,d) => s + remaining(d), 0);
  $: largest     = outstanding[0];
  $: thisMonth   = today().slice(0,7);
  $: paidThisMonth = debts.flatMap(d => d.payments || []).filter(p => p.date?.slice(0,7) === thisMonth).reduce((s,p) => s + Number(p.amount), 0);
</script>

<div class="fade-in space">
  <div class="page-hdr">
    <p class="count">{outstanding.length} outstanding · {cleared.length} cleared</p>
    <button class="btn-primary" on:click={openAdd}>+ Add Debt</button>
  </div>

  <div class="stat-grid">
    <div class="stat-card glass card-red">
      <p class="stat-label">Debt to settle</p>
      <p class="stat-val mono neg">{fmt(totalOwed)}</p>
      <p class="stat-sub">{outstanding.length} debt{outstanding.length !== 1 ? 's' : ''}</p>
    </div>
    <div class="stat-card glass card-orange">
      <p class="stat-label">Largest</p>
      <p class="stat-val mono">{largest ? fmt(remaining(largest)) : '—'}</p>
      <p class="stat-sub">{largest?.name || 'none'}</p>
    </div>
    <div class="stat-card glass card-green">
      <p class="stat-label">Paid this month</p>
      <p class="stat-val mono pos">{fmt(paidThisMonth)}</p>
      <p class="stat-sub">keep going</p>
    </div>
  </div>

  {#if loading}
    <FunLoader />
  {:else if debts.length === 0}
    <div class="glass empty-state">
      <p>No debts recorded.</p>
      <p class="muted">Add money you owe — personal loans, money borrowed from friends or family, and so on.</p>
    </div>
  {:else}
    {#if outstanding.length}
      <div class="glass list">
        {#each outstanding as d (d.id)}
          <div class="item">
          <div class="row">
            <button class="check" on:click={() => toggleCleared(d)} title="Mark as cleared" aria-label="Mark {d.name} as cleared"></button>
            <div class="info">
              <p class="name">{d.name}</p>
              {#if d.details}<p class="details">{d.details}</p>{/if}
              {#if Number(d.paid) > 0}
                <div class="progress"><div class="bar" style="width:{pct(d)}%"></div></div>
                <p class="paid">
                  Paid {fmt(d.paid)} of {fmt(d.amount)} ·
                  <button class="link-btn" on:click={() => expanded[d.id] = !expanded[d.id]}>
                    {d.payments.length} payment{d.payments.length !== 1 ? 's' : ''} {expanded[d.id] ? '▾' : '▸'}
                  </button>
                </p>
              {/if}
            </div>
            <div class="amt-col">
              <p class="amt mono">{fmt(remaining(d))}</p>
              {#if Number(d.paid) > 0}<p class="amt-sub">left</p>{/if}
            </div>
            <div class="actions">
              <button class="pay-btn" on:click={() => openPay(d)}>Pay</button>
              <button class="icon-btn" on:click={() => openEdit(d)} title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
              <button class="icon-btn danger" on:click={() => remove(d)} title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
            </div>
          </div>
          {#if expanded[d.id] && d.payments.length}
            <div class="history">
              {#each d.payments as p (p.id)}
                <div class="pay-row">
                  <span class="pay-date">{p.date}</span>
                  <span class="pay-note">{p.note || ''}{#if p.tx_id}<span class="tx-tag">from transaction</span>{:else if p.bill_id}<span class="tx-tag">from Expenses</span>{/if}</span>
                  <span class="mono pos">{fmt(p.amount)}</span>
                  {#if p.tx_id || p.bill_id}
                    <span class="pay-del-spacer"></span>
                  {:else}
                    <button class="icon-btn danger" on:click={() => removePayment(d, p)} title="Remove payment" aria-label="Remove payment"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="glass empty-state">🎉 Debt free!</div>
    {/if}

    {#if cleared.length}
      <button class="toggle-cleared" on:click={() => showCleared = !showCleared}>
        {showCleared ? '▾' : '▸'} Cleared ({cleared.length})
      </button>
      {#if showCleared}
        <div class="glass list">
          {#each cleared as d (d.id)}
            <div class="row done">
              <button class="check on" on:click={() => toggleCleared(d)} title="Mark as outstanding" aria-label="Mark {d.name} as outstanding">✓</button>
              <div class="info">
                <p class="name">{d.name}</p>
                <p class="details">Cleared {d.cleared_at || ''}</p>
              </div>
              <p class="amt mono">{fmt(d.amount)}</p>
              <div class="actions">
                <button class="icon-btn danger" on:click={() => remove(d)} title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}
</div>

<Modal title={editing ? 'Edit Debt' : 'Add Debt'} bind:show={showForm} onClose={() => showForm = false}>
  <div class="form-group">
    <label for="debt-name">Who / what is it owed to?</label>
    <input id="debt-name" class="input-field" placeholder="e.g. Ali, personal loan, Mum" bind:value={fName}>
  </div>
  <div class="form-group">
    <label for="debt-amt">Total amount owed (RM)</label>
    <input id="debt-amt" class="input-field" type="number" step="0.01" placeholder="0.00" bind:value={fAmount}>
  </div>
  <div class="form-group">
    <label for="debt-details">Details (optional)</label>
    <textarea id="debt-details" class="input-field" rows="3" placeholder="What it was for, repayment plan, when you borrowed it…" bind:value={fDetails}></textarea>
  </div>
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showForm = false}>Cancel</button>
    <button class="btn-primary" on:click={save}>{editing ? 'Update' : 'Add Debt'}</button>
  </div>
</Modal>

<Modal title={paying ? `Pay ${paying.name}` : 'Pay'} bind:show={showPay} onClose={() => showPay = false}>
  {#if paying}
    <p class="muted pay-help">{fmt(remaining(paying))} left to pay. To count a payment in your expenses too, link an expense to this debt instead (“Pays towards” in Transactions or Expenses), or link a commitment to it.</p>
  {/if}
  <div class="form-row">
    <div class="form-group">
      <label for="pay-amt">Amount paid (RM)</label>
      <input id="pay-amt" class="input-field" type="number" step="0.01" placeholder="0.00" bind:value={pAmount}>
    </div>
    <div class="form-group">
      <label for="pay-date">Date</label>
      <input id="pay-date" class="input-field" type="date" bind:value={pDate}>
    </div>
  </div>
  {#if paying}
    <button class="link-btn fill" on:click={() => pAmount = remaining(paying).toFixed(2)}>Pay the full {fmt(remaining(paying))}</button>
  {/if}
  <div class="form-group">
    <label for="pay-note">Note (optional)</label>
    <input id="pay-note" class="input-field" placeholder="e.g. October instalment" bind:value={pNote}>
  </div>
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showPay = false}>Cancel</button>
    <button class="btn-primary" on:click={savePayment}>Record Payment</button>
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
  .stat-sub{font-size:11px;color:var(--text2);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .mono{font-family:'Space Mono',monospace;}
  .pos{color:var(--accent);}
  .neg{color:var(--danger);}

  .list{display:flex;flex-direction:column;overflow:hidden;}
  .row{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border);}
  .row:last-child, .item:last-child .row:last-child{border-bottom:none;}
  .item{border-bottom:1px solid var(--border);}
  .item:last-child{border-bottom:none;}
  .item .row{border-bottom:none;}
  .progress{height:5px;background:var(--surface2);border-radius:3px;overflow:hidden;margin-top:8px;max-width:260px;}
  .bar{height:100%;background:var(--accent);border-radius:3px;transition:width .3s;}
  .paid{margin-top:4px;font-size:11px;color:var(--text2);}
  .link-btn{background:none;border:none;padding:0;color:var(--accent);font-size:inherit;font-weight:600;cursor:pointer;}
  .link-btn.fill{font-size:12px;margin:-6px 0 14px;}
  .amt-col{text-align:right;}
  .amt-sub{font-size:10px;color:var(--text2);}
  .pay-btn{background:rgba(0,229,160,.12);color:var(--accent);border:none;border-radius:6px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;margin-right:4px;}
  .pay-btn:hover{background:rgba(0,229,160,.22);}
  .history{padding:0 16px 12px 50px;display:flex;flex-direction:column;gap:2px;}
  .pay-row{display:flex;align-items:center;gap:10px;font-size:12px;padding:4px 0;border-top:1px dashed var(--border);}
  .pay-date{color:var(--text2);white-space:nowrap;}
  .pay-note{flex:1;min-width:0;overflow-wrap:anywhere;}
  .pay-del-spacer{width:22px;flex-shrink:0;}
  .tx-tag{margin-left:6px;font-size:10px;background:rgba(124,92,252,.15);color:#a48bff;padding:1px 6px;border-radius:10px;}
  .pay-help{margin-bottom:14px;}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .row.done{opacity:.6;}
  .row.done .name{text-decoration:line-through;}
  .check{width:22px;height:22px;flex-shrink:0;border-radius:50%;border:2px solid var(--text2);background:none;cursor:pointer;color:#0a0e17;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;transition:all .15s;}
  .check:hover{border-color:var(--accent);background:rgba(0,229,160,.15);}
  .check.on{background:var(--accent);border-color:var(--accent);}
  .info{flex:1;min-width:0;}
  .name{font-size:14px;font-weight:600;overflow-wrap:anywhere;}
  .details{margin-top:3px;font-size:12px;color:var(--text2);overflow-wrap:anywhere;white-space:pre-line;}
  .amt{font-weight:700;font-size:14px;white-space:nowrap;}
  .actions{display:flex;gap:2px;}
  .icon-btn{background:none;border:none;cursor:pointer;color:rgba(255,255,255,.45);padding:5px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:all .15s;}
  .icon-btn:hover{background:rgba(0,229,160,.12);color:var(--accent);}
  .icon-btn.danger:hover{background:rgba(255,92,124,.12);color:var(--danger);}
  .toggle-cleared{align-self:flex-start;background:none;border:none;color:var(--text2);font-size:13px;font-weight:600;cursor:pointer;padding:4px 0;}

  .form-group{margin-bottom:14px;}
  .modal-actions{display:flex;gap:8px;margin-top:20px;}
  textarea.input-field{resize:vertical;width:100%;font-family:inherit;}

  @media(max-width:600px){
    .page-hdr > button{width:100%;justify-content:center;}
    .stat-grid{grid-template-columns:1fr 1fr;gap:10px;}
    .stat-grid .stat-card:first-child{grid-column:1/-1;}
    .stat-card{padding:12px;}
    .row{padding:12px;gap:10px;flex-wrap:wrap;}
    .info{flex-basis:calc(100% - 34px);}
    .amt-col{margin-left:32px;text-align:left;}
    .amt{margin-left:32px;}
    .amt-col .amt{margin-left:0;}
    .actions{margin-left:auto;align-items:center;}
    .icon-btn{min-width:36px;min-height:36px;}
    .pay-btn{min-height:36px;padding:0 16px;}
    .history{padding:0 12px 12px 44px;}
    .form-row{grid-template-columns:1fr;gap:0;}
    .modal-actions > button{flex:1;justify-content:center;}
  }
</style>
