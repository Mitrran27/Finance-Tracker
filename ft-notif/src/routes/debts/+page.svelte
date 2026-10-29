<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { fmt, showToast, today } from '$lib/stores.js';
  import Modal from '$lib/components/Modal.svelte';
  import FunLoader from '$lib/components/FunLoader.svelte';

  let debts = [], loading = true;
  let showForm = false, editing = null;
  let showCleared = false;

  let fName = '', fAmount = '', fDetails = '';

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
    if (!confirm(`Delete "${d.name}"?`)) return;
    try { await api.delete(`/debts/${d.id}`); showToast('Deleted!'); load(); }
    catch(e) { showToast(e.message, 'error'); }
  }

  $: outstanding = debts.filter(d => !d.cleared);
  $: cleared     = debts.filter(d => d.cleared);
  $: totalOwed   = outstanding.reduce((s,d) => s + Number(d.amount), 0);
  $: largest     = outstanding[0];
  $: thisYear    = today().slice(0,4);
  $: clearedThisYear = cleared.filter(d => d.cleared_at?.slice(0,4) === thisYear).reduce((s,d) => s + Number(d.amount), 0);
</script>

<div class="fade-in space">
  <div class="page-hdr">
    <p class="count">{outstanding.length} outstanding · {cleared.length} cleared</p>
    <button class="btn-primary" on:click={openAdd}>+ Add Debt</button>
  </div>

  <div class="stat-grid">
    <div class="stat-card glass card-red">
      <p class="stat-label">Total debt</p>
      <p class="stat-val mono neg">{fmt(totalOwed)}</p>
      <p class="stat-sub">{outstanding.length} debt{outstanding.length !== 1 ? 's' : ''}</p>
    </div>
    <div class="stat-card glass card-orange">
      <p class="stat-label">Largest</p>
      <p class="stat-val mono">{largest ? fmt(largest.amount) : '—'}</p>
      <p class="stat-sub">{largest?.name || 'none'}</p>
    </div>
    <div class="stat-card glass card-green">
      <p class="stat-label">Cleared this year</p>
      <p class="stat-val mono pos">{fmt(clearedThisYear)}</p>
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
          <div class="row">
            <button class="check" on:click={() => toggleCleared(d)} title="Mark as cleared" aria-label="Mark {d.name} as cleared"></button>
            <div class="info">
              <p class="name">{d.name}</p>
              {#if d.details}<p class="details">{d.details}</p>{/if}
            </div>
            <p class="amt mono">{fmt(d.amount)}</p>
            <div class="actions">
              <button class="icon-btn" on:click={() => openEdit(d)} title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
              <button class="icon-btn danger" on:click={() => remove(d)} title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
            </div>
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
    <label for="debt-amt">Amount (RM)</label>
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
  .row:last-child{border-bottom:none;}
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
    .amt{margin-left:32px;}
    .actions{margin-left:auto;}
    .icon-btn{min-width:36px;min-height:36px;}
    .modal-actions > button{flex:1;justify-content:center;}
  }
</style>
