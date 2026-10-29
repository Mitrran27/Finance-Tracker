<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { fmt, showToast, CATEGORIES, today } from '$lib/stores.js';
  import Modal from '$lib/components/Modal.svelte';
  import FunLoader from '$lib/components/FunLoader.svelte';
  import { parseList } from '$lib/parseList.js';

  let bills = [], loading = true;
  let showForm = false, editing = null;
  let showBulk = false, bulkText = '';
  let showSettled = false;

  let fName = '', fAmount = '', fDue = '', fCategory = '', fNote = '';

  onMount(load);

  async function load() {
    loading = true;
    try { bills = await api.get('/bills'); }
    catch(e) { showToast(e.message, 'error'); }
    finally { loading = false; }
  }

  function openAdd() {
    editing = null; fName = ''; fAmount = ''; fDue = ''; fCategory = ''; fNote = '';
    showForm = true;
  }

  function openEdit(b) {
    editing = b; fName = b.name; fAmount = b.amount; fDue = b.due_date?.slice(0,10) || '';
    fCategory = b.category || ''; fNote = b.note || '';
    showForm = true;
  }

  async function save() {
    const amount = parseFloat(fAmount);
    if (!fName.trim()) return showToast('Enter what the expense is for', 'error');
    if (isNaN(amount)) return showToast('Enter an amount', 'error');
    const body = { name: fName, amount, due_date: fDue || null, category: fCategory || null, note: fNote || null };
    try {
      if (editing) await api.patch(`/bills/${editing.id}`, body);
      else await api.post('/bills', body);
      showToast(editing ? 'Expense updated!' : 'Expense added!');
      showForm = false; editing = null; load();
    } catch(e) { showToast(e.message, 'error'); }
  }

  async function toggleSettled(b) {
    try {
      await api.patch(`/bills/${b.id}`, { settled: !b.settled });
      showToast(b.settled ? 'Moved back to unsettled' : 'Marked as settled ✓');
      load();
    } catch(e) { showToast(e.message, 'error'); }
  }

  async function remove(b) {
    if (!confirm(`Delete "${b.name}"?`)) return;
    try { await api.delete(`/bills/${b.id}`); showToast('Deleted!'); load(); }
    catch(e) { showToast(e.message, 'error'); }
  }

  // ── Bulk add: one expense per line, e.g. "Car loan - 850" or "PTPTN, RM 200, 2026-11-05"
  $: bulkParsed = parseList(bulkText);
  $: bulkValid = bulkParsed.filter(p => p.item).map(p => p.item);

  async function saveBulk() {
    if (!bulkValid.length) return showToast('Nothing to add — use "Name - amount" per line', 'error');
    try {
      await api.post('/bills', { items: bulkValid });
      showToast(`Added ${bulkValid.length} expense${bulkValid.length !== 1 ? 's' : ''}!`);
      showBulk = false; bulkText = ''; load();
    } catch(e) { showToast(e.message, 'error'); }
  }

  function dueInfo(b) {
    if (!b.due_date) return { label: 'No due date', cls: '' };
    const d = b.due_date.slice(0,10), t = today();
    const days = Math.round((new Date(d) - new Date(t)) / 86400000);
    if (days < 0)  return { label: `Overdue ${-days}d · ${d}`, cls: 'overdue' };
    if (days === 0) return { label: 'Due today', cls: 'soon' };
    if (days <= 7) return { label: `Due in ${days}d · ${d}`, cls: 'soon' };
    return { label: `Due ${d}`, cls: '' };
  }

  $: unsettled = bills.filter(b => !b.settled);
  $: settled   = bills.filter(b => b.settled);
  $: totalOwed = unsettled.reduce((s,b) => s + Number(b.amount), 0);
  $: overdue   = unsettled.filter(b => b.due_date && b.due_date.slice(0,10) < today());
  $: thisMonth = today().slice(0,7);
  $: paidThisMonth = settled.filter(b => b.settled_at?.slice(0,7) === thisMonth).reduce((s,b) => s + Number(b.amount), 0);
</script>

<div class="fade-in space">
  <div class="page-hdr">
    <p class="count">{unsettled.length} unsettled · {settled.length} settled</p>
    <div class="hdr-actions">
      <button class="btn-secondary" on:click={() => showBulk = true}>Paste a list</button>
      <button class="btn-primary" on:click={openAdd}>+ Add Expense</button>
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat-card glass card-red">
      <p class="stat-label">Still to settle</p>
      <p class="stat-val mono neg">{fmt(totalOwed)}</p>
      <p class="stat-sub">{unsettled.length} item{unsettled.length !== 1 ? 's' : ''}</p>
    </div>
    <div class="stat-card glass card-orange">
      <p class="stat-label">Overdue</p>
      <p class="stat-val mono">{overdue.length}</p>
      <p class="stat-sub">{fmt(overdue.reduce((s,b) => s + Number(b.amount), 0))}</p>
    </div>
    <div class="stat-card glass card-green">
      <p class="stat-label">Settled this month</p>
      <p class="stat-val mono pos">{fmt(paidThisMonth)}</p>
      <p class="stat-sub">nice work</p>
    </div>
  </div>

  {#if loading}
    <FunLoader />
  {:else if bills.length === 0}
    <div class="glass empty-state">
      <p>No expenses yet.</p>
      <p class="muted">Add them one by one, or use <b>Paste a list</b> to add your whole list at once.</p>
    </div>
  {:else}
    {#if unsettled.length}
      <div class="glass list">
        {#each unsettled as b (b.id)}
          {@const due = dueInfo(b)}
          <div class="row {due.cls}">
            <button class="check" on:click={() => toggleSettled(b)} title="Mark as settled" aria-label="Mark {b.name} as settled"></button>
            <div class="info">
              <p class="name">{b.name}</p>
              <p class="meta">
                <span class="due {due.cls}">{due.label}</span>
                {#if b.category}<span class="tag">{b.category}</span>{/if}
                {#if b.note}<span class="note">{b.note}</span>{/if}
              </p>
            </div>
            <p class="amt mono">{fmt(b.amount)}</p>
            <div class="actions">
              <button class="icon-btn" on:click={() => openEdit(b)} title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
              <button class="icon-btn danger" on:click={() => remove(b)} title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="glass empty-state">🎉 Everything is settled!</div>
    {/if}

    {#if settled.length}
      <button class="toggle-settled" on:click={() => showSettled = !showSettled}>
        {showSettled ? '▾' : '▸'} Settled ({settled.length})
      </button>
      {#if showSettled}
        <div class="glass list">
          {#each settled as b (b.id)}
            <div class="row done">
              <button class="check on" on:click={() => toggleSettled(b)} title="Mark as unsettled" aria-label="Mark {b.name} as unsettled">✓</button>
              <div class="info">
                <p class="name">{b.name}</p>
                <p class="meta"><span class="due">Settled {b.settled_at?.slice(0,10) || ''}</span></p>
              </div>
              <p class="amt mono">{fmt(b.amount)}</p>
              <div class="actions">
                <button class="icon-btn danger" on:click={() => remove(b)} title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}
</div>

<!-- Add / Edit -->
<Modal title={editing ? 'Edit Expense' : 'Add Expense'} bind:show={showForm} onClose={() => showForm = false}>
  <div class="form-group">
    <label for="bill-name">What is it for?</label>
    <input id="bill-name" class="input-field" placeholder="e.g. Car loan, PTPTN, phone bill" bind:value={fName}>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label for="bill-amt">Amount (RM)</label>
      <input id="bill-amt" class="input-field" type="number" step="0.01" placeholder="0.00" bind:value={fAmount}>
    </div>
    <div class="form-group">
      <label for="bill-due">Due date (optional)</label>
      <input id="bill-due" class="input-field" type="date" bind:value={fDue}>
    </div>
  </div>
  <div class="form-group">
    <label for="bill-cat">Category (optional)</label>
    <select id="bill-cat" class="input-field" bind:value={fCategory}>
      <option value="">—</option>
      {#each CATEGORIES as c}<option>{c}</option>{/each}
    </select>
  </div>
  <div class="form-group">
    <label for="bill-note">Note (optional)</label>
    <input id="bill-note" class="input-field" placeholder="Who to pay, account no., etc." bind:value={fNote}>
  </div>
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showForm = false}>Cancel</button>
    <button class="btn-primary" on:click={save}>{editing ? 'Update' : 'Add Expense'}</button>
  </div>
</Modal>

<!-- Bulk paste -->
<Modal title="Paste your expense list" bind:show={showBulk} onClose={() => showBulk = false}>
  <p class="muted bulk-help">One expense per line — name and amount, optionally a due date (YYYY-MM-DD).</p>
  <textarea class="input-field" rows="8" bind:value={bulkText}
    placeholder={"Car loan - 850\nPTPTN - 200\nPhone bill RM 98.50 2026-11-05\nRent: 1,200"}></textarea>
  {#if bulkParsed.length}
    <div class="preview">
      {#each bulkParsed as p}
        {#if p.item}
          <div class="pv ok"><span>{p.item.name}{p.item.due_date ? ` · ${p.item.due_date}` : ''}</span><span class="mono">{fmt(p.item.amount)}</span></div>
        {:else}
          <div class="pv bad"><span>{p.line}</span><span>no amount — skipped</span></div>
        {/if}
      {/each}
    </div>
  {/if}
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showBulk = false}>Cancel</button>
    <button class="btn-primary" on:click={saveBulk} disabled={!bulkValid.length}>Add {bulkValid.length || ''} expense{bulkValid.length !== 1 ? 's' : ''}</button>
  </div>
</Modal>

<style>
  .space{display:flex;flex-direction:column;gap:16px;}
  .page-hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}
  .hdr-actions{display:flex;gap:8px;}
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
  .pos{color:var(--accent);}
  .neg{color:var(--danger);}

  .list{display:flex;flex-direction:column;overflow:hidden;}
  .row{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border);border-left:3px solid transparent;}
  .row:last-child{border-bottom:none;}
  .row.overdue{border-left-color:var(--danger);}
  .row.soon{border-left-color:var(--warning);}
  .row.done{opacity:.6;}
  .row.done .name{text-decoration:line-through;}
  .check{width:22px;height:22px;flex-shrink:0;border-radius:50%;border:2px solid var(--text2);background:none;cursor:pointer;color:#0a0e17;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;transition:all .15s;}
  .check:hover{border-color:var(--accent);background:rgba(0,229,160,.15);}
  .check.on{background:var(--accent);border-color:var(--accent);}
  .info{flex:1;min-width:0;}
  .name{font-size:14px;font-weight:600;overflow-wrap:anywhere;}
  .meta{display:flex;flex-wrap:wrap;gap:6px 10px;margin-top:3px;font-size:11px;color:var(--text2);}
  .due.overdue{color:var(--danger);font-weight:600;}
  .due.soon{color:var(--warning);font-weight:600;}
  .tag{background:var(--surface2);padding:1px 8px;border-radius:20px;}
  .note{overflow-wrap:anywhere;}
  .amt{font-weight:700;font-size:14px;white-space:nowrap;}
  .actions{display:flex;gap:2px;}
  .icon-btn{background:none;border:none;cursor:pointer;color:rgba(255,255,255,.45);padding:5px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:all .15s;}
  .icon-btn:hover{background:rgba(0,229,160,.12);color:var(--accent);}
  .icon-btn.danger:hover{background:rgba(255,92,124,.12);color:var(--danger);}
  .toggle-settled{align-self:flex-start;background:none;border:none;color:var(--text2);font-size:13px;font-weight:600;cursor:pointer;padding:4px 0;}

  .form-group{margin-bottom:14px;}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .modal-actions{display:flex;gap:8px;margin-top:20px;}
  .bulk-help{margin-bottom:10px;}
  textarea.input-field{resize:vertical;width:100%;font-family:inherit;}
  .preview{margin-top:10px;max-height:180px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;}
  .pv{display:flex;justify-content:space-between;gap:10px;font-size:12px;padding:6px 10px;border-radius:8px;}
  .pv span:first-child{min-width:0;overflow-wrap:anywhere;}
  .pv.ok{background:rgba(0,229,160,.08);}
  .pv.bad{background:rgba(255,92,124,.08);color:var(--danger);}

  @media(max-width:600px){
    .hdr-actions{width:100%;}
    .hdr-actions > button{flex:1;justify-content:center;}
    .stat-grid{grid-template-columns:1fr 1fr;gap:10px;}
    .stat-grid .stat-card:first-child{grid-column:1/-1;}
    .stat-card{padding:12px;}
    .row{padding:12px;gap:10px;flex-wrap:wrap;}
    .info{flex-basis:calc(100% - 34px);}
    .amt{margin-left:32px;}
    .actions{margin-left:auto;}
    .icon-btn{min-width:36px;min-height:36px;}
    .form-row{grid-template-columns:1fr;gap:0;}
    .modal-actions > button{flex:1;justify-content:center;}
  }
</style>
