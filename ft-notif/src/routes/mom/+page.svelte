<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { fmt, showToast, today } from '$lib/stores.js';
  import Modal from '$lib/components/Modal.svelte';
  import FunLoader from '$lib/components/FunLoader.svelte';

  let expense = null, transfers = [], total = 0, loading = true;
  let showForm = false, editing = null;

  let fMonth = today().slice(0,7), fDate = today(), fAmount = '', fNote = '', fSettle = true;

  onMount(load);

  async function load() {
    loading = true;
    try { ({ expense, transfers, total } = await api.get('/mom')); }
    catch(e) { showToast(e.message, 'error'); }
    finally { loading = false; }
  }

  function openAdd() {
    editing = null;
    fMonth = today().slice(0,7); fDate = today();
    fAmount = expense ? Number(expense.amount) : ''; fNote = '';
    fSettle = !!expense && !expense.settled;
    showForm = true;
  }

  function openEdit(t) {
    editing = t; fMonth = t.month; fDate = t.date; fAmount = t.amount; fNote = t.note || '';
    showForm = true;
  }

  async function save() {
    const amount = parseFloat(fAmount);
    if (!fMonth) return showToast('Pick the month this transfer is for', 'error');
    if (!fDate) return showToast('Pick the transfer date', 'error');
    if (isNaN(amount) || amount <= 0) return showToast('Enter an amount', 'error');
    const body = { month: fMonth, date: fDate, amount, note: fNote || null };
    try {
      if (editing) await api.patch(`/mom/${editing.id}`, body);
      else await api.post('/mom', { ...body, settle: fSettle });
      showToast(editing ? 'Transfer updated!' : 'Transfer added!');
      showForm = false; editing = null; load();
    } catch(e) { showToast(e.message, 'error'); }
  }

  async function remove(t) {
    if (!confirm(`Delete the ${monthLabel(t.month)} transfer of ${fmt(t.amount)}?`)) return;
    try { await api.delete(`/mom/${t.id}`); showToast('Deleted!'); load(); }
    catch(e) { showToast(e.message, 'error'); }
  }

  function monthLabel(m) {
    const [y, mo] = m.split('-').map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  $: thisYear  = today().slice(0,4);
  $: yearTotal = transfers.filter(t => t.month.startsWith(thisYear)).reduce((s,t) => s + Number(t.amount), 0);
  $: years = [...new Set(transfers.map(t => t.month.slice(0,4)))].map(y => {
    const items = transfers.filter(t => t.month.startsWith(y));
    return { year: y, items, sum: items.reduce((s,t) => s + Number(t.amount), 0) };
  });
</script>

<div class="fade-in space">
  <div class="page-hdr">
    <p class="count">{transfers.length} transfer{transfers.length !== 1 ? 's' : ''} to Amma</p>
    <button class="btn-primary" on:click={openAdd}>+ Add Transfer</button>
  </div>

  <div class="stat-grid">
    <div class="stat-card glass card-green">
      <p class="stat-label">Total transferred to Amma</p>
      <p class="stat-val mono pos">{fmt(total)}</p>
      <p class="stat-sub">all time</p>
    </div>
    <div class="stat-card glass card-blue">
      <p class="stat-label">This year ({thisYear})</p>
      <p class="stat-val mono">{fmt(yearTotal)}</p>
      <p class="stat-sub">{transfers.filter(t => t.month.startsWith(thisYear)).length} month(s)</p>
    </div>
    <div class="stat-card glass card-orange">
      <p class="stat-label">Linked expense</p>
      {#if expense}
        <p class="stat-val mono">{fmt(expense.amount)}</p>
        <p class="stat-sub">
          <a href="/bills">Amma</a> · {expense.settled ? `settled ${expense.settled_at || ''}` : 'not settled yet'}
        </p>
      {:else}
        <p class="stat-val">—</p>
        <p class="stat-sub">Add an expense named <a href="/bills">Amma</a> in Expenses</p>
      {/if}
    </div>
  </div>

  {#if loading}
    <FunLoader />
  {:else if transfers.length === 0}
    <div class="glass empty-state">
      <p>No transfers yet.</p>
      <p class="muted">Use <b>+ Add Transfer</b> to record each month's money to Amma.</p>
    </div>
  {:else}
    {#each years as y (y.year)}
      <div class="year-hdr">
        <span>{y.year}</span>
        <span class="mono">{fmt(y.sum)}</span>
      </div>
      <div class="glass list">
        {#each y.items as t (t.id)}
          <div class="row">
            <div class="info">
              <p class="name">{monthLabel(t.month)}</p>
              <p class="meta">
                <span>Sent {t.date}</span>
                {#if t.note}<span class="note">{t.note}</span>{/if}
              </p>
            </div>
            <p class="amt mono">{fmt(t.amount)}</p>
            <div class="actions">
              <button class="icon-btn" on:click={() => openEdit(t)} title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
              <button class="icon-btn danger" on:click={() => remove(t)} title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
            </div>
          </div>
        {/each}
      </div>
    {/each}
  {/if}
</div>

<Modal title={editing ? 'Edit Transfer' : 'Add Transfer to Amma'} bind:show={showForm} onClose={() => showForm = false}>
  <div class="form-row">
    <div class="form-group">
      <label for="mom-month">For month</label>
      <input id="mom-month" class="input-field" type="month" bind:value={fMonth}>
    </div>
    <div class="form-group">
      <label for="mom-date">Date sent</label>
      <input id="mom-date" class="input-field" type="date" bind:value={fDate}>
    </div>
  </div>
  <div class="form-group">
    <label for="mom-amt">Amount (RM)</label>
    <input id="mom-amt" class="input-field" type="number" step="0.01" placeholder="0.00" bind:value={fAmount}>
  </div>
  <div class="form-group">
    <label for="mom-note">Note (optional)</label>
    <input id="mom-note" class="input-field" placeholder="e.g. extra for Deepavali" bind:value={fNote}>
  </div>
  {#if !editing && expense && !expense.settled}
    <label class="checkbox">
      <input type="checkbox" bind:checked={fSettle}>
      Also mark the Amma expense as settled
    </label>
  {/if}
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showForm = false}>Cancel</button>
    <button class="btn-primary" on:click={save}>{editing ? 'Update' : 'Add Transfer'}</button>
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
  .card-blue::before{background:var(--accent2);}
  .stat-label{font-size:11px;color:var(--text2);margin-bottom:6px;}
  .stat-val{font-size:20px;font-weight:700;overflow-wrap:anywhere;}
  .stat-sub{font-size:11px;color:var(--text2);margin-top:4px;}
  .stat-sub a{color:var(--accent);}
  .mono{font-family:'Space Mono',monospace;}
  .pos{color:var(--accent);}

  .year-hdr{display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:var(--text2);padding:0 4px;margin-bottom:-8px;}
  .list{display:flex;flex-direction:column;overflow:hidden;}
  .row{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border);}
  .row:last-child{border-bottom:none;}
  .info{flex:1;min-width:0;}
  .name{font-size:14px;font-weight:600;overflow-wrap:anywhere;}
  .meta{display:flex;flex-wrap:wrap;gap:6px 10px;margin-top:3px;font-size:11px;color:var(--text2);}
  .note{overflow-wrap:anywhere;}
  .amt{font-weight:700;font-size:14px;white-space:nowrap;}
  .actions{display:flex;gap:2px;}
  .icon-btn{background:none;border:none;cursor:pointer;color:rgba(255,255,255,.45);padding:5px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:all .15s;}
  .icon-btn:hover{background:rgba(0,229,160,.12);color:var(--accent);}
  .icon-btn.danger:hover{background:rgba(255,92,124,.12);color:var(--danger);}

  .form-group{margin-bottom:14px;}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .checkbox{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2);cursor:pointer;}
  .modal-actions{display:flex;gap:8px;margin-top:20px;}

  @media(max-width:600px){
    .page-hdr > button{width:100%;justify-content:center;}
    .stat-grid{grid-template-columns:1fr 1fr;gap:10px;}
    .stat-grid .stat-card:first-child{grid-column:1/-1;}
    .stat-card{padding:12px;}
    .row{padding:12px;gap:10px;}
    .icon-btn{min-width:36px;min-height:36px;}
    .form-row{grid-template-columns:1fr;gap:0;}
    .modal-actions > button{flex:1;justify-content:center;}
  }
</style>
