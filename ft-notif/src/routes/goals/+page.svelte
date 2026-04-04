<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { fmt, showToast } from '$lib/stores.js';
  import Modal from '$lib/components/Modal.svelte';
  import FunLoader from '$lib/components/FunLoader.svelte';

  const GOAL_COLORS = ['#00e5a0','#7c5cfc','#ff5c7c','#ffb347','#4ecdc4','#45b7d1','#ff9ff3','#54a0ff'];

  let goals = [], banks = [], savingsTxs = [], loading = true;
  let showAdd = false, showEdit = false, showContribute = false, showTxs = false;
  let editGoal = null, contributeGoal = null, txGoal = null;
  let goalContribs = [];
  let expandedGoalId = null;   // for inline contrib table per goal
  let inlineContribs = {};     // cache: goalId → contribs array

  // Add form
  let fName='', fTarget='', fCurrent='', fDeadline='', fColor='#00e5a0', fBankId='';
  // Edit form
  let eName='', eTarget='', eCurrent='', eDeadline='', eColor='', eBankId='';
  // Contribute form
  let cAmount='', cNote='', cTxId='';

  onMount(load);

  async function load() {
    loading = true;
    try {
      [goals, banks, savingsTxs] = await Promise.all([
        api.get('/goals'),
        api.get('/banks'),
        api.get('/transactions').then(txs => txs.filter(t => t.is_savings || t.type==='income')),
      ]);
      // Check shortages after load
      api.post('/goals/check-shortage', {}).then(r => {
        // Reload goals to get updated shortage flags
        api.get('/goals').then(g => goals = g);
      }).catch(()=>{});
    } catch(e) { showToast(e.message,'error'); }
    finally { loading = false; }
  }

  async function addGoal() {
    if (!fName || !fTarget) return showToast('Name and target required','error');
    try {
      await api.post('/goals', {
        name:fName, target:parseFloat(fTarget), current:parseFloat(fCurrent)||0,
        deadline:fDeadline||null, color:fColor, bank_id:fBankId||null,
      });
      showToast('Goal created!');
      showAdd=false; fName=''; fTarget=''; fCurrent=''; fDeadline=''; fColor='#00e5a0'; fBankId='';
      load();
    } catch(e) { showToast(e.message,'error'); }
  }

  function openEdit(g) {
    editGoal=g; eName=g.name; eTarget=g.target; eCurrent=g.current;
    eDeadline=g.deadline?.slice(0,7)||''; eColor=g.color; eBankId=g.bank_id||'';
    showEdit=true;
  }

  async function saveEdit() {
    try {
      await api.patch(`/goals/${editGoal.id}`, {
        name:eName, target:parseFloat(eTarget), current:parseFloat(eCurrent)||0,
        deadline:eDeadline||null, color:eColor, bank_id:eBankId||null,
      });
      showToast('Goal updated!'); showEdit=false; editGoal=null; load();
    } catch(e) { showToast(e.message,'error'); }
  }

  async function deleteGoal(id) {
    if (!confirm('Delete this goal?')) return;
    try { await api.delete(`/goals/${id}`); showToast('Deleted!'); load(); }
    catch(e) { showToast(e.message,'error'); }
  }

  function openContribute(g) { contributeGoal=g; cAmount=''; cNote=''; cTxId=''; showContribute=true; }

  async function addContribution() {
    if (!cAmount || parseFloat(cAmount)<=0) return showToast('Enter valid amount','error');
    try {
      await api.post(`/goals/${contributeGoal.id}/contribute`, {
        amount:parseFloat(cAmount), tx_id:cTxId||null, note:cNote||null,
      });
      showToast('Savings added!'); showContribute=false; contributeGoal=null; load();
    } catch(e) { showToast(e.message,'error'); }
  }

  async function openTxs(g) {
    txGoal = g;
    try { goalContribs = await api.get(`/goals/${g.id}/contributions`); }
    catch(e) { goalContribs = []; }
    showTxs = true;
  }

  async function toggleInline(g) {
    if (expandedGoalId === g.id) { expandedGoalId = null; return; }
    expandedGoalId = g.id;
    if (!inlineContribs[g.id]) {
      try { inlineContribs[g.id] = await api.get(`/goals/${g.id}/contributions`); }
      catch(e) { inlineContribs[g.id] = []; }
    }
  }

  async function removeContrib(goalId, cid) {
    if (!confirm('Remove this contribution?')) return;
    try {
      await api.delete(`/goals/${goalId}/contributions/${cid}`);
      showToast('Removed!');
      goalContribs = goalContribs.filter(c => c.id !== cid);
      load();
    } catch(e) { showToast(e.message,'error'); }
  }

  function downloadCSV(g) {
    api.get(`/goals/${g.id}/contributions`).then(contribs => {
      const rows = [['Date','Description','Note','Amount']];
      contribs.forEach(c => rows.push([
        c.tx_date?.slice(0,10) || c.created_at?.slice(0,10) || '',
        c.tx_description || 'Manual contribution',
        c.note || '',
        Number(c.amount).toFixed(2),
      ]));
      const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv],{type:'text/csv'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href=url; a.download=`${g.name}_savings.csv`; a.click();
      URL.revokeObjectURL(url);
    });
  }

  function pct(g) { return Math.min((Number(g.current)/Number(g.target))*100, 100).toFixed(1); }
  function remaining(g) { return Math.max(0, Number(g.target)-Number(g.current)); }
  function daysLeft(dl) {
    if (!dl) return null;
    const s = String(dl).slice(0,10);
    const [y,m,d] = s.split('-').map(Number);
    const date = new Date(y,m-1,d); date.setHours(0,0,0,0);
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.ceil((date-today)/86400000);
  }
  function fmtDL(dl) {
    if (!dl) return null;
    const s = String(dl).slice(0,7);
    const [y,m] = s.split('-').map(Number);
    return new Date(y,m-1,1).toLocaleDateString('en-GB',{month:'short',year:'numeric'});
  }

  $: totalTarget  = goals.reduce((s,g)=>s+Number(g.target),0);
  $: totalSaved   = goals.reduce((s,g)=>s+Number(g.current),0);
  $: doneCount    = goals.filter(g=>Number(g.current)>=Number(g.target)).length;
  $: shortageGoals = goals.filter(g=>g.has_shortage);
</script>

<div class="fade-in space">
  <div class="page-hdr">
    <div>
      <h2 class="page-title">Savings Goals</h2>
      <p class="page-sub">Track your financial targets and stay motivated</p>
    </div>
    <button class="btn-primary" on:click={() => showAdd=true}>+ New Goal</button>
  </div>

  <!-- Shortage alert banner -->
  {#if shortageGoals.length > 0}
    <div class="shortage-banner">
      <span class="shortage-icon">⚠️</span>
      <div>
        <p class="shortage-title">Savings Shortage Detected</p>
        <p class="shortage-desc">
          {shortageGoals.map(g=>`${g.name} (RM ${Number(g.shortage_amount).toFixed(2)} short)`).join(' · ')}
        </p>
      </div>
    </div>
  {/if}

  {#if loading}
    <FunLoader />
  {:else if goals.length === 0}
    <div class="glass empty-state">
      <div class="empty-icon">🎯</div>
      <p class="empty-title">No savings goals yet</p>
      <p class="empty-sub">Create your first goal to start tracking progress</p>
      <button class="btn-primary" style="margin-top:8px" on:click={() => showAdd=true}>+ Create Goal</button>
    </div>
  {:else}

    <!-- Summary bar -->
    <div class="summary-bar glass">
      <div class="summary-item">
        <span class="summary-label">Total Goals</span>
        <span class="summary-val">{goals.length}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Total Target</span>
        <span class="summary-val mono">{fmt(totalTarget)}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Total Saved</span>
        <span class="summary-val mono pos">{fmt(totalSaved)}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Achieved</span>
        <span class="summary-val">{doneCount} / {goals.length}</span>
      </div>
    </div>

    <!-- Goal cards -->
    <div class="goals-grid">
      {#each goals as g}
        {@const p = parseFloat(pct(g))}
        {@const rem = remaining(g)}
        {@const done = Number(g.current) >= Number(g.target)}
        {@const dl = daysLeft(g.deadline)}
        {@const bankObj = banks.find(b=>b.id===g.bank_id)}

        <div class="glass goal-card" style="border-top:3px solid {g.color}">
          <!-- Header -->
          <div class="goal-header">
            <div class="goal-title-row">
              <span class="goal-dot" style="background:{g.color}"></span>
              <h3 class="goal-name">{g.name}</h3>
              {#if done}<span class="badge-done">✓ Achieved!</span>{/if}
              {#if g.has_shortage}<span class="badge-shortage">⚠️ Shortage</span>{/if}
            </div>
            <div class="goal-actions">
              <button class="icon-btn" on:click={() => openTxs(g)} title="View transactions">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </button>
              <button class="icon-btn" on:click={() => downloadCSV(g)} title="Download CSV">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
              <button class="icon-btn" on:click={() => openEdit(g)} title="Edit">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="icon-btn" on:click={() => deleteGoal(g.id)} title="Delete">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </div>

          <!-- Bank badge -->
          {#if bankObj}
            <p class="bank-badge">🏦 {bankObj.name}
              {#if g.has_shortage}
                <span style="color:var(--danger);font-weight:700"> — RM {Number(g.shortage_amount).toFixed(2)} short</span>
              {/if}
            </p>
          {/if}

          <!-- Progress bar -->
          <div class="progress-track">
            <div class="progress-fill" style="width:{p}%;background:{g.color}">
              {#if p > 12}<span class="progress-lbl">{p}%</span>{/if}
            </div>
          </div>
          {#if p <= 12}<p style="font-size:10px;color:var(--text2);margin-top:2px">{p}%</p>{/if}

          <!-- Amounts -->
          <div class="amount-row">
            <div class="amount-item">
              <span class="amount-label">Saved</span>
              <span class="amount-val mono" style="color:{g.color}">{fmt(g.current)}</span>
            </div>
            <div class="amount-div"></div>
            <div class="amount-item">
              <span class="amount-label">Target</span>
              <span class="amount-val mono">{fmt(g.target)}</span>
            </div>
            <div class="amount-div"></div>
            <div class="amount-item">
              <span class="amount-label">Remaining</span>
              <span class="amount-val mono" style="color:{done?'var(--accent)':'var(--text2)'}">{done?fmt(0):fmt(rem)}</span>
            </div>
          </div>

          <!-- Footer -->
          <div class="goal-footer">
            <div>
              {#if g.deadline}
                <span class="dl-label">🗓 {fmtDL(g.deadline)}</span>
                {#if dl !== null}
                  <span class="dl-days" class:urgent={dl<30&&!done} class:done-dl={done}>
                    {done?'Achieved!':dl<=0?'Deadline passed':`${dl}d left`}
                  </span>
                {/if}
              {:else}
                <span class="dl-label muted">No deadline</span>
              {/if}
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <button class="btn-txs" on:click={() => toggleInline(g)}>
                {expandedGoalId === g.id ? '▲ Hide Txs' : '▼ Transactions'}
              </button>
              <button class="add-savings-btn" on:click={() => openContribute(g)}>+ Add Savings</button>
            </div>
          </div>

          <!-- Inline transactions table -->
          {#if expandedGoalId === g.id}
            <div class="inline-contribs">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span style="font-size:12px;font-weight:600;color:var(--text2)">Savings Transactions</span>
                <button class="btn-secondary xs" on:click={() => downloadCSV(g)}>⬇ CSV</button>
              </div>
              {#if !inlineContribs[g.id] || inlineContribs[g.id].length === 0}
                <p class="muted" style="text-align:center;padding:12px;font-size:12px">No contributions yet</p>
              {:else}
                <div class="contribs-table">
                  <table>
                    <thead>
                      <tr><th>Date</th><th>Description</th><th>Note</th><th class="right">Amount</th><th></th></tr>
                    </thead>
                    <tbody>
                      {#each inlineContribs[g.id] as c}
                        <tr>
                          <td class="sm">{c.tx_date?.slice(0,10) || c.created_at?.slice(0,10)}</td>
                          <td>{c.tx_description || 'Manual'}</td>
                          <td class="muted-td">{c.note || '—'}</td>
                          <td class="right mono pos">{fmt(c.amount)}</td>
                          <td>
                            <button class="icon-btn-sm" on:click={async () => { await removeContrib(g.id, c.id); inlineContribs[g.id] = inlineContribs[g.id].filter(x=>x.id!==c.id); }} title="Remove">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                            </button>
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Add Goal Modal -->
<Modal title="Create Savings Goal" bind:show={showAdd} onClose={() => showAdd=false}>
  <div class="form-group">
    <label for="g-name">Goal Name</label>
    <input id="g-name" class="input-field" placeholder="Japan Trip" bind:value={fName} autofocus>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label for="g-target">Target (RM)</label>
      <input id="g-target" class="input-field" type="number" step="0.01" placeholder="5000" bind:value={fTarget}>
    </div>
    <div class="form-group">
      <label for="g-current">Already Saved (RM)</label>
      <input id="g-current" class="input-field" type="number" step="0.01" placeholder="0" bind:value={fCurrent}>
    </div>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label for="g-deadline">Deadline</label>
      <input id="g-deadline" class="input-field" type="month" bind:value={fDeadline}>
    </div>
    <div class="form-group">
      <label for="g-bank">Linked Bank Account</label>
      <select id="g-bank" class="input-field" bind:value={fBankId}>
        <option value="">— None —</option>
        {#each banks as b}<option value={b.id}>{b.name} ({fmt(b.balance)})</option>{/each}
      </select>
    </div>
  </div>
  <div class="form-group">
    <label>Colour</label>
    <div class="color-row">
      {#each GOAL_COLORS as col}
        <button class="col-dot" style="background:{col};{fColor===col?'outline:2px solid #fff;outline-offset:2px':''}" on:click={() => fColor=col}></button>
      {/each}
    </div>
  </div>
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showAdd=false}>Cancel</button>
    <button class="btn-primary" on:click={addGoal}>Create Goal</button>
  </div>
</Modal>

<!-- Edit Goal Modal -->
<Modal title="Edit Goal" bind:show={showEdit} onClose={() => showEdit=false}>
  <div class="form-group">
    <label for="eg-name">Goal Name</label>
    <input id="eg-name" class="input-field" bind:value={eName}>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label for="eg-target">Target (RM)</label>
      <input id="eg-target" class="input-field" type="number" step="0.01" bind:value={eTarget}>
    </div>
    <div class="form-group">
      <label for="eg-current">Amount Saved (RM)</label>
      <input id="eg-current" class="input-field" type="number" step="0.01" bind:value={eCurrent}>
    </div>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label for="eg-deadline">Deadline</label>
      <input id="eg-deadline" class="input-field" type="month" bind:value={eDeadline}>
    </div>
    <div class="form-group">
      <label for="eg-bank">Linked Bank Account</label>
      <select id="eg-bank" class="input-field" bind:value={eBankId}>
        <option value="">— None —</option>
        {#each banks as b}<option value={b.id}>{b.name} ({fmt(b.balance)})</option>{/each}
      </select>
    </div>
  </div>
  <div class="form-group">
    <label>Colour</label>
    <div class="color-row">
      {#each GOAL_COLORS as col}
        <button class="col-dot" style="background:{col};{eColor===col?'outline:2px solid #fff;outline-offset:2px':''}" on:click={() => eColor=col}></button>
      {/each}
    </div>
  </div>
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showEdit=false}>Cancel</button>
    <button class="btn-primary" on:click={saveEdit}>Save Changes</button>
  </div>
</Modal>

<!-- Add Savings Modal -->
<Modal title="Add Savings" bind:show={showContribute} onClose={() => showContribute=false}>
  {#if contributeGoal}
    <div class="contrib-header">
      <span class="goal-dot" style="background:{contributeGoal.color}"></span>
      <strong>{contributeGoal.name}</strong>
      <span class="muted">{fmt(contributeGoal.current)} / {fmt(contributeGoal.target)}</span>
    </div>
  {/if}
  <div class="form-group">
    <label for="c-amt">Amount (RM)</label>
    <input id="c-amt" class="input-field" type="number" step="0.01" placeholder="500" bind:value={cAmount} autofocus>
  </div>
  <div class="form-group">
    <label for="c-tx">Link to Transaction (optional)</label>
    <select id="c-tx" class="input-field" bind:value={cTxId}>
      <option value="">— Manual —</option>
      {#each savingsTxs.slice(0,50) as tx}
        <option value={tx.id}>{tx.date?.slice(0,10)} · {tx.description||tx.category} · {fmt(tx.amount)}</option>
      {/each}
    </select>
  </div>
  <div class="form-group">
    <label for="c-note">Note (optional)</label>
    <input id="c-note" class="input-field" placeholder="Monthly savings" bind:value={cNote}>
  </div>
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showContribute=false}>Cancel</button>
    <button class="btn-primary" on:click={addContribution}>Add to Goal</button>
  </div>
</Modal>

<!-- Transactions Modal -->
<Modal title="Savings Transactions" bind:show={showTxs} onClose={() => { showTxs=false; txGoal=null; }}>
  {#if txGoal}
    <div class="contrib-header" style="margin-bottom:16px">
      <span class="goal-dot" style="background:{txGoal.color}"></span>
      <strong>{txGoal.name}</strong>
      <span class="muted">Total: {fmt(goalContribs.reduce((s,c)=>s+Number(c.amount),0))}</span>
      <button class="btn-secondary xs" style="margin-left:auto" on:click={() => downloadCSV(txGoal)}>⬇ CSV</button>
    </div>
    {#if goalContribs.length === 0}
      <p class="muted" style="text-align:center;padding:20px">No contributions yet</p>
    {:else}
      <div class="contribs-table">
        <table>
          <thead>
            <tr><th>Date</th><th>Description</th><th>Note</th><th class="right">Amount</th><th></th></tr>
          </thead>
          <tbody>
            {#each goalContribs as c}
              <tr>
                <td class="sm">{c.tx_date?.slice(0,10) || c.created_at?.slice(0,10)}</td>
                <td>{c.tx_description || 'Manual'}</td>
                <td class="muted-td">{c.note || '—'}</td>
                <td class="right mono pos">{fmt(c.amount)}</td>
                <td>
                  <button class="icon-btn-sm" on:click={() => removeContrib(txGoal.id, c.id)} title="Remove">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
  <div class="modal-actions">
    <button class="btn-primary" on:click={() => { showTxs=false; openContribute(txGoal); }}>+ Add Savings</button>
    <button class="btn-secondary" on:click={() => { showTxs=false; txGoal=null; }}>Close</button>
  </div>
</Modal>

<style>
  .space       { display:flex; flex-direction:column; gap:20px; }
  .page-hdr    { display:flex; align-items:flex-start; justify-content:space-between; }
  .page-title  { font-size:20px; font-weight:700; }
  .page-sub    { font-size:12px; color:var(--text2); margin-top:3px; }

  /* Shortage banner */
  .shortage-banner { display:flex; align-items:flex-start; gap:12px; padding:14px 18px; background:rgba(255,92,124,.08); border:1px solid rgba(255,92,124,.25); border-radius:10px; }
  .shortage-icon   { font-size:20px; flex-shrink:0; }
  .shortage-title  { font-size:13px; font-weight:700; color:var(--danger); }
  .shortage-desc   { font-size:12px; color:var(--text2); margin-top:3px; }

  /* Summary */
  .summary-bar  { padding:16px 24px; display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
  @media(max-width:700px){.summary-bar{grid-template-columns:repeat(2,1fr);}}
  .summary-item { display:flex; flex-direction:column; gap:4px; }
  .summary-label{ font-size:11px; color:var(--text2); }
  .summary-val  { font-size:18px; font-weight:700; }
  .pos          { color:var(--accent); }
  .mono         { font-family:'Space Mono',monospace; }

  /* Empty / loading */
  .loading-card { padding:40px; text-align:center; color:var(--text2); }
  .empty-state  { padding:56px 40px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:12px; }
  .empty-icon   { font-size:48px; }
  .empty-title  { font-size:16px; font-weight:600; }
  .empty-sub    { font-size:13px; color:var(--text2); }

  /* Goals grid */
  .goals-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; }
  @media(max-width:800px){.goals-grid{grid-template-columns:1fr;}}
  .goal-card   { padding:20px; display:flex; flex-direction:column; gap:12px; }

  .goal-header { display:flex; align-items:flex-start; justify-content:space-between; }
  .goal-title-row { display:flex; align-items:center; gap:8px; flex:1; flex-wrap:wrap; }
  .goal-dot    { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
  .goal-name   { font-size:15px; font-weight:700; }
  .badge-done  { font-size:10px; font-weight:700; background:rgba(0,229,160,.15); color:var(--accent); padding:2px 8px; border-radius:20px; }
  .badge-shortage { font-size:10px; font-weight:700; background:rgba(255,92,124,.15); color:var(--danger); padding:2px 8px; border-radius:20px; }
  .goal-actions{ display:flex; gap:3px; flex-shrink:0; }
  .icon-btn    { background:none; border:none; cursor:pointer; color:rgba(255,255,255,.45); padding:5px; border-radius:6px; display:flex; align-items:center; transition:all .15s; }
  .icon-btn:hover { background:rgba(255,92,124,.12); color:var(--danger); }

  .bank-badge  { font-size:11px; color:var(--text2); background:var(--surface2); padding:3px 10px; border-radius:6px; width:fit-content; }

  /* Progress */
  .progress-track { height:10px; background:var(--surface2); border-radius:5px; overflow:hidden; }
  .progress-fill  { height:100%; border-radius:5px; display:flex; align-items:center; justify-content:flex-end; transition:width .5s; min-width:4px; }
  .progress-lbl   { font-size:9px; font-weight:700; color:#0a0e17; padding-right:4px; }

  /* Amounts */
  .amount-row  { display:flex; align-items:center; }
  .amount-item { flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; }
  .amount-div  { width:1px; height:30px; background:var(--border); flex-shrink:0; }
  .amount-label{ font-size:10px; color:var(--text2); }
  .amount-val  { font-size:13px; font-weight:700; }

  /* Footer */
  .goal-footer   { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
  .dl-label      { font-size:12px; color:var(--text2); }
  .dl-days       { font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px; background:rgba(0,229,160,.1); color:var(--accent); margin-left:6px; }
  .dl-days.urgent { background:rgba(255,180,71,.15); color:var(--warning); }
  .dl-days.done-dl{ background:rgba(0,229,160,.15); color:var(--accent); }
  .muted         { color:var(--text2); }
  .add-savings-btn { background:rgba(124,92,252,.12); border:1px solid rgba(124,92,252,.3); color:var(--accent2); padding:5px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; transition:background .15s; }
  .add-savings-btn:hover { background:rgba(124,92,252,.25); }
  .btn-txs { background:rgba(255,255,255,.06); border:1px solid var(--border); color:var(--text2); padding:5px 10px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:600; transition:background .15s; }
  .btn-txs:hover { background:rgba(255,255,255,.1); color:var(--text); }
  .inline-contribs { border-top:1px solid var(--border); padding-top:12px; margin-top:4px; }

  /* Modal */
  .form-row      { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .form-group    { margin-bottom:14px; }
  .modal-actions { display:flex; gap:8px; margin-top:20px; }
  .color-row     { display:flex; gap:6px; flex-wrap:wrap; padding-top:8px; }
  .col-dot       { width:22px; height:22px; border-radius:50%; border:none; cursor:pointer; transition:transform .15s; }
  .col-dot:hover { transform:scale(1.2); }
  .contrib-header{ display:flex; align-items:center; gap:8px; padding:10px 14px; background:var(--surface2); border-radius:8px; font-size:13px; }
  .xs            { padding:4px 10px; font-size:11px; }

  /* Contributions table */
  .contribs-table { overflow-x:auto; max-height:320px; overflow-y:auto; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th    { text-align:left; padding:8px 10px; font-size:11px; color:var(--text2); border-bottom:1px solid var(--border); }
  td    { padding:8px 10px; border-bottom:1px solid var(--border); }
  .right { text-align:right; }
  .sm    { font-size:12px; color:var(--text2); }
  .muted-td { color:var(--text2); font-size:12px; }
  .icon-btn-sm { background:none; border:none; cursor:pointer; color:rgba(255,255,255,.4); padding:4px; border-radius:4px; display:flex; align-items:center; transition:all .15s; }
  .icon-btn-sm:hover { color:var(--danger); background:rgba(255,92,124,.1); }
</style>
