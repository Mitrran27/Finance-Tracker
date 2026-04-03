<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { fmt, showToast, CATEGORIES, today } from '$lib/stores.js';
  import Modal from '$lib/components/Modal.svelte';

  let txs = [], banks = [], goals = [], loading = true;
  let showAdd = false, showEdit = false;
  let editTx = null;
  let search = '', filterBank = '', dateFrom = '', dateTo = '', sort = 'date-desc';

  let fType='expense', fAmount='', fDesc='', fCat='Food', fDate=today(), fBank='', fSavings=false, fGoalId='';
  let eType='expense', eAmount='', eDesc='', eCat='Food', eDate=today(), eBank='', eSavings=false, eGoalId='';

  function getBankSummary(bank) {
    const d = new Date();
    const currentMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    // Filter ALL transactions (not just current page view) for this bank this month
    const bankTxs = txs.filter(t => String(t.bank_id) === String(bank.id) && t.date?.slice(0,7) === currentMonth);
    const inc = bankTxs.filter(t => t.type==='income').reduce((s,t) => s+Number(t.amount), 0);
    const exp = bankTxs.filter(t => t.type==='expense').reduce((s,t) => s+Number(t.amount), 0);
    const sav = bankTxs.filter(t => t.is_savings).reduce((s,t) => s+Number(t.amount), 0);
    // bank.balance is always the real live balance (backend keeps it in sync)
    const finalBal   = Number(bank.balance);
    // Original = what it was before this month's income/expenses
    const originalBal = finalBal - inc + exp;
    // Total = original + income (before any expenses)
    const totalBal = originalBal + inc;
    // Usable = final balance minus locked savings
    const usableBal = finalBal - sav;
    return { inc, exp, sav, finalBal, originalBal, totalBal, usableBal };
  }

  onMount(async () => {
    [banks, goals] = await Promise.all([api.get('/banks'), api.get('/goals').catch(()=>[])]);
    if (banks.length) fBank = banks[0].id;
    await loadTxs();
  });

  async function loadTxs() {
    loading = true;
    try {
      const params = new URLSearchParams({ sort });
      if (filterBank) params.set('bank_id', filterBank);
      if (search)     params.set('search', search);
      const all = await api.get(`/transactions?${params}`);
      // Filter by date range client-side (precise date pickers)
      txs = all.filter(t => {
        const d = t.date?.slice(0,10) || '';
        return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
      });
    } catch(e) { showToast(e.message, 'error'); }
    finally { loading = false; }
  }

  async function addTx() {
    if (!fAmount || !fDate) return showToast('Amount and date required', 'error');
    try {
      await api.post('/transactions', {
        type: fType, amount: parseFloat(fAmount), description: fDesc,
        category: fCat, date: fDate, bank_id: fBank || null, is_savings: fSavings,
        goal_id: (fSavings && fGoalId) ? fGoalId : null
      });
      showToast('Transaction added!');
      showAdd = false; fAmount=''; fDesc=''; fSavings=false; fGoalId='';
      banks = await api.get('/banks');
      loadTxs();
    } catch(e) { showToast(e.message, 'error'); }
  }

  function openEdit(tx) {
    editTx = tx;
    eType=tx.type; eAmount=tx.amount; eDesc=tx.description||'';
    eCat=tx.category||'Food'; eDate=tx.date?.slice(0,10)||today();
    eBank=tx.bank_id||''; eSavings=tx.is_savings||false; eGoalId=tx.goal_id||'';
    showEdit = true;
  }

  async function saveTx() {
    try {
      await api.patch(`/transactions/${editTx.id}`, {
        type: eType, amount: parseFloat(eAmount), description: eDesc,
        category: eCat, date: eDate, bank_id: eBank || null, is_savings: eSavings,
        goal_id: (eSavings && eGoalId) ? eGoalId : null
      });
      showToast('Transaction updated!');
      showEdit = false; editTx = null;
      banks = await api.get('/banks');
      loadTxs();
    } catch(e) { showToast(e.message, 'error'); }
  }

  async function deleteTx(id) {
    if (!confirm('Delete this transaction?')) return;
    try {
      await api.delete(`/transactions/${id}`);
      showToast('Deleted!');
      banks = await api.get('/banks');
      loadTxs();
    } catch(e) { showToast(e.message, 'error'); }
  }

  function bankName(id) { return banks.find(b => b.id == id)?.name || '-'; }

  function clearDates() { dateFrom=''; dateTo=''; loadTxs(); }

  $: shortageGoals = goals.filter(g => g.has_shortage);

  // Compute which expense transactions dipped into savings
  // For each bank: usable = finalBalance - savings. Walk expenses oldest→newest.
  // If a cumulative expense run exceeds usable, flag those transactions.
  $: savingsDipTxIds = (() => {
    const dipped = new Set();
    for (const bank of banks) {
      const s = getBankSummary(bank);
      if (s.sav <= 0) continue;
      // All expenses for this bank sorted oldest first
      const expenses = txs
        .filter(t => String(t.bank_id) === String(bank.id) && t.type === 'expense')
        .slice().sort((a,b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
      let runningBalance = s.usableBal + expenses.reduce((sum,t) => sum + Number(t.amount), 0);
      for (const t of expenses) {
        runningBalance -= Number(t.amount);
        if (runningBalance < 0) dipped.add(t.id);
      }
    }
    return dipped;
  })();

  function downloadCSV() {
    const rows = [['Date','Description','Category','Type','Bank','Amount']];
    txs.forEach(tx => rows.push([
      tx.date?.slice(0,10)||'',
      tx.description||'',
      tx.category||'',
      tx.type,
      tx.bank_name || bankName(tx.bank_id),
      (tx.type==='income'?'':'-') + Number(tx.amount).toFixed(2),
    ]));
    const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=`transactions_${dateFrom||'all'}_to_${dateTo||'all'}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function printStatement() {
    const currency = 'RM';
    const f = n => currency+' '+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    const fmtShort = d => { if(!d) return '—'; const s=String(d).slice(0,10); const [y,m,day]=s.split('-').map(Number); const mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]; return `${String(day).padStart(2,'0')} ${mo}`; };
    const fmtD = d => { if(!d) return '—'; const s=String(d).slice(0,10); const [y,m,day]=s.split('-').map(Number); return new Date(y,m-1,day).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); };
    const income  = txs.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
    const expense = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
    const selectedBankName = filterBank ? (banks.find(b=>String(b.id)===String(filterBank))?.name||'All Accounts') : 'All Accounts';
    const txRows = txs.map((tx,i) => {
      const bg = i%2===0?'#fff':'#fafafa';
      const cat = tx.category?` <span style="color:#999;font-size:11px;"> — ${tx.category}</span>`:'';
      const isIn = tx.type==='income';
      const dipNote = savingsDipTxIds.has(tx.id) ? ` <span style="color:#e74c3c;font-size:10px;font-weight:700;background:#fdf4f4;padding:1px 6px;border-radius:4px;margin-left:4px">⚠️ Used savings</span>` : '';
      return `<tr style="background:${bg}"><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#666;font-family:monospace;font-size:12px;width:72px">${fmtShort(tx.date)}</td><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#333">${tx.description||'—'}${cat}${dipNote}</td><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#888;font-size:12px">${tx.bank_name||bankName(tx.bank_id)||'—'}</td><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:right;font-family:monospace;white-space:nowrap;color:${isIn?'#999':'#c0392b'};font-weight:${isIn?'400':'600'}">${isIn?'—':f(tx.amount)}</td><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:right;font-family:monospace;white-space:nowrap;color:${isIn?'#27ae60':'#999'};font-weight:${isIn?'600':'400'}">${isIn?f(tx.amount):'—'}</td></tr>`;
    }).join('');
    const genDate = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Transaction Statement</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#f0f2f5;padding:24px}@media print{body{background:#fff;padding:0}}</style></head><body><div style="max-width:860px;margin:0 auto;background:#fff;box-shadow:0 1px 8px rgba(0,0,0,.08);border-radius:4px;overflow:hidden"><div style="height:8px;background:#1a5276"></div><div style="padding:28px 36px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eee"><div><div style="font-size:26px;font-weight:700;color:#c0392b">Transaction Statement</div><div style="font-size:12px;color:#888;margin-top:2px">${selectedBankName}</div></div><div style="width:56px;height:56px;border-radius:50%;background:#c0392b;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:700">T</div></div><div style="background:#f5f6f8;padding:16px 36px;display:flex;gap:32px;border-bottom:1px solid #e8e8e8"><div style="flex:1"><div style="font-size:9px;text-transform:uppercase;color:#999;letter-spacing:1px;font-weight:600">Account</div><div style="font-size:14px;font-weight:600;color:#333;margin-top:3px">${selectedBankName}</div></div><div style="flex:1"><div style="font-size:9px;text-transform:uppercase;color:#999;letter-spacing:1px;font-weight:600">Period</div><div style="font-size:14px;font-weight:600;color:#333;margin-top:3px">${fmtD(dateFrom)||'All'} – ${fmtD(dateTo)||'All'}</div></div><div style="flex:1"><div style="font-size:9px;text-transform:uppercase;color:#999;letter-spacing:1px;font-weight:600">Generated On</div><div style="font-size:14px;font-weight:600;color:#333;margin-top:3px">${genDate}</div></div></div><div style="padding:24px 36px 20px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#c0392b;margin-bottom:14px">Summary</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px"><div style="background:#f4faf5;border:1px solid #d4edda;border-radius:6px;padding:14px 16px;text-align:center"><div style="font-size:9px;text-transform:uppercase;color:#999;letter-spacing:.8px;font-weight:600">Total Income</div><div style="font-size:18px;font-weight:700;color:#27ae60;margin-top:6px;font-family:monospace">${f(income)}</div></div><div style="background:#fdf4f4;border:1px solid #f5c6cb;border-radius:6px;padding:14px 16px;text-align:center"><div style="font-size:9px;text-transform:uppercase;color:#999;letter-spacing:.8px;font-weight:600">Total Expenses</div><div style="font-size:18px;font-weight:700;color:#c0392b;margin-top:6px;font-family:monospace">${f(expense)}</div></div><div style="background:#fef9f3;border:1px solid #f5e6d3;border-radius:6px;padding:14px 16px;text-align:center"><div style="font-size:9px;text-transform:uppercase;color:#999;letter-spacing:.8px;font-weight:600">Transactions</div><div style="font-size:18px;font-weight:700;color:#333;margin-top:6px">${txs.length}</div></div></div></div><div style="padding:0 36px 28px"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#c0392b"><th style="padding:10px 14px;text-align:left;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;width:72px">Date</th><th style="padding:10px 14px;text-align:left;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Description</th><th style="padding:10px 14px;text-align:left;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;width:120px">Account</th><th style="padding:10px 14px;text-align:right;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;width:120px">Withdrawal</th><th style="padding:10px 14px;text-align:right;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;width:120px">Deposit</th></tr></thead><tbody>${txRows}</tbody></table></div><div style="background:#f5f6f8;padding:16px 36px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e8e8e8"><div><span style="color:#999;font-size:11px">Computer-generated statement. ${txs.length} transaction${txs.length!==1?'s':''} shown.</span></div><div style="color:#aaa;font-size:10px;font-family:monospace">Printed: ${genDate}</div></div></div></body></html>`;
    const win = window.open('','_blank');
    win.document.write(html); win.document.close(); win.focus();
    setTimeout(() => win.print(), 400);
  }
</script>

<div class="fade-in space">
  <div class="page-hdr">
    <p class="count">
      {txs.length} transaction{txs.length !== 1 ? 's' : ''}
      {#if shortageGoals.length > 0}
        <span class="shortage-badge-inline">⚠️ {shortageGoals.length} savings shortage{shortageGoals.length>1?'s':''}</span>
      {/if}
    </p>
    <div style="display:flex;gap:8px">
      <button class="btn-secondary" on:click={downloadCSV}>⬇ CSV</button>
      <button class="btn-secondary" on:click={printStatement}>🖨 Print Statement</button>
      <button class="btn-primary" on:click={() => showAdd=true}>+ Add Transaction</button>
    </div>
  </div>

  <!-- Shortage alert banner -->
  {#if shortageGoals.length > 0}
    <div class="shortage-banner">
      <span class="shortage-icon">⚠️</span>
      <div>
        <p class="shortage-title">Savings Shortage Reminder</p>
        <p class="shortage-desc">
          {shortageGoals.map(g=>`${g.name} (RM ${Number(g.shortage_amount).toFixed(2)} short)`).join(' · ')} — please top up your savings to cover the shortage.
        </p>
      </div>
    </div>
  {/if}

  <!-- Filters -->
  <div class="glass filters">
    <div class="filter-grid">
      <div>
        <label for="tx-search">Search</label>
        <input id="tx-search" class="input-field" placeholder="Description or category…" bind:value={search} on:input={loadTxs}>
      </div>
      <div>
        <label for="tx-bank">Bank</label>
        <select id="tx-bank" class="input-field" bind:value={filterBank} on:change={loadTxs}>
          <option value="">All Banks</option>
          {#each banks as b}<option value={b.id}>{b.name}</option>{/each}
        </select>
      </div>
      <div>
        <label for="tx-from">From</label>
        <input id="tx-from" class="input-field" type="date" bind:value={dateFrom} on:change={loadTxs}>
      </div>
      <div>
        <label for="tx-to">To</label>
        <input id="tx-to" class="input-field" type="date" bind:value={dateTo} on:change={loadTxs}>
      </div>
      <div>
        <label for="tx-sort">Sort</label>
        <select id="tx-sort" class="input-field" bind:value={sort} on:change={loadTxs}>
          <option value="date-desc">Latest First</option>
          <option value="date-asc">Oldest First</option>
          <option value="amount-desc">Highest Amount</option>
          <option value="amount-asc">Lowest Amount</option>
        </select>
      </div>
    </div>
    {#if dateFrom || dateTo}
      <button class="clear-btn" on:click={clearDates}>✕ Clear Date Filter</button>
    {/if}
  </div>

  <!-- Per-bank summary cards -->
  {#if banks.length > 0}
    <div class="bank-summary-grid">
      {#each banks as bank}
        {@const s = getBankSummary(bank)}
        <div class="glass2 bank-summary">
          <p class="bank-summary-name">{bank.name}</p>
          <div class="summary-rows">
            <div class="summary-row"><span class="muted">Original Amount:</span><span class="mono fw">{fmt(s.originalBal)}</span></div>
            <div class="summary-row"><span class="pos">+ Income:</span><span class="mono fw pos">+{fmt(s.inc)}</span></div>
            <div class="summary-row"><span class="neg">− Expenses:</span><span class="mono fw neg">−{fmt(s.exp)}</span></div>
            {#if s.sav > 0}<div class="summary-row"><span class="sav">💾 Savings:</span><span class="mono fw sav">{fmt(s.sav)}</span></div>{/if}
            {#if s.sav > 0}
              <div class="summary-row"><span class="muted fw">Total:</span><span class="mono fw">{fmt(s.totalBal)}</span></div>
              <div class="summary-row usable-row">
                <span class="muted fw">Usable Amount:</span>
                <span class="mono fw" style="color:{s.usableBal < 0 ? 'var(--danger)' : 'var(--accent)'}">
                  {fmt(s.usableBal)}
                </span>
              </div>
            {/if}
            <div class="summary-row final-row"><span class="muted fw">Final Balance:</span><span class="mono pos" style="font-size:14px;font-weight:700">{fmt(s.finalBal)}</span></div>
          </div>
          <p class="next-month">Next month starts at {fmt(s.finalBal)}</p>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Table -->
  <div class="glass table-wrap">
    <div class="tscroll">
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Description</th><th>Category</th>
            <th>Account</th><th class="right">Amount</th><th></th>
          </tr>
        </thead>
        <tbody>
          {#if loading}
            <tr><td colspan="6" class="empty">🍟 Frying up hashed data...</td></tr>
          {:else if txs.length === 0}
            <tr><td colspan="6" class="empty">No transactions found</td></tr>
          {:else}
            {#each txs as tx}
              <tr>
                <td class="sm">{tx.date?.slice(0,10)}</td>
                <td>
                  {tx.description || '-'}
                  {#if tx.is_savings}<span class="badge savings">💾 Savings</span>{/if}
                  {#if tx.goal_id}{@const g = goals.find(g=>g.id===tx.goal_id)}{#if g}<span class="badge goal">🎯 {g.name}</span>{/if}{/if}
                  {#if savingsDipTxIds.has(tx.id)}<span class="badge dip">⚠️ Used savings</span>{/if}
                </td>
                <td>
                  <span class="badge" class:income={tx.type==='income'} class:expense={tx.type==='expense'}>
                    {tx.category || '-'}
                  </span>
                </td>
                <td class="sm">{tx.bank_name || bankName(tx.bank_id)}</td>
                <td class="right mono fw" class:pos={tx.type==='income'} class:neg={tx.type==='expense'}>
                  {tx.type==='income' ? '+' : '-'}{fmt(tx.amount)}
                </td>
                <td class="actions">
                  <button class="icon-btn" on:click={() => openEdit(tx)} title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                  <button class="icon-btn" on:click={() => deleteTx(tx.id)} title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>

<!-- Add Modal -->
<Modal title="Add Transaction" bind:show={showAdd} onClose={() => showAdd=false}>
  <div class="form-row">
    <div class="form-group">
      <label for="f-type">Type</label>
      <select id="f-type" class="input-field" bind:value={fType}>
        <option value="expense">Expense</option>
        <option value="income">Income</option>
      </select>
    </div>
    <div class="form-group">
      <label for="f-amount">Amount</label>
      <input id="f-amount" class="input-field" type="number" step="0.01" placeholder="0.00" bind:value={fAmount}>
    </div>
  </div>
  <div class="form-group">
    <label for="f-desc">Description</label>
    <input id="f-desc" class="input-field" placeholder="Grocery shopping" bind:value={fDesc}>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label for="f-cat">Category</label>
      <select id="f-cat" class="input-field" bind:value={fCat}>
        {#each CATEGORIES as c}<option>{c}</option>{/each}
      </select>
    </div>
    <div class="form-group">
      <label for="f-date">Date</label>
      <input id="f-date" class="input-field" type="date" bind:value={fDate}>
    </div>
  </div>
  <div class="form-group">
    <label for="f-bank">Bank Account</label>
    <select id="f-bank" class="input-field" bind:value={fBank}>
      <option value="">None</option>
      {#each banks as b}<option value={b.id}>{b.name}</option>{/each}
    </select>
  </div>
  <div class="form-group">
    <label class="checkbox-label"><input type="checkbox" bind:checked={fSavings}> Flag as savings</label>
  </div>
  {#if fSavings && goals.length > 0}
  <div class="form-group">
    <label for="f-goal">Link to Savings Goal (optional)</label>
    <select id="f-goal" class="input-field" bind:value={fGoalId}>
      <option value="">— No goal —</option>
      {#each goals as g}<option value={g.id}>{g.name} ({fmt(g.current)} / {fmt(g.target)})</option>{/each}
    </select>
  </div>
  {/if}
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showAdd=false}>Cancel</button>
    <button class="btn-primary" on:click={addTx}>Add Transaction</button>
  </div>
</Modal>

<!-- Edit Modal -->
<Modal title="Edit Transaction" bind:show={showEdit} onClose={() => showEdit=false}>
  <div class="form-row">
    <div class="form-group">
      <label for="e-type">Type</label>
      <select id="e-type" class="input-field" bind:value={eType}>
        <option value="expense">Expense</option>
        <option value="income">Income</option>
      </select>
    </div>
    <div class="form-group">
      <label for="e-amount">Amount</label>
      <input id="e-amount" class="input-field" type="number" step="0.01" bind:value={eAmount}>
    </div>
  </div>
  <div class="form-group">
    <label for="e-desc">Description</label>
    <input id="e-desc" class="input-field" bind:value={eDesc}>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label for="e-cat">Category</label>
      <select id="e-cat" class="input-field" bind:value={eCat}>
        {#each CATEGORIES as c}<option>{c}</option>{/each}
      </select>
    </div>
    <div class="form-group">
      <label for="e-date">Date</label>
      <input id="e-date" class="input-field" type="date" bind:value={eDate}>
    </div>
  </div>
  <div class="form-group">
    <label for="e-bank">Bank Account</label>
    <select id="e-bank" class="input-field" bind:value={eBank}>
      <option value="">None</option>
      {#each banks as b}<option value={b.id}>{b.name}</option>{/each}
    </select>
  </div>
  <div class="form-group">
    <label class="checkbox-label"><input type="checkbox" bind:checked={eSavings}> Flag as savings</label>
  </div>
  {#if eSavings && goals.length > 0}
  <div class="form-group">
    <label for="e-goal">Link to Savings Goal (optional)</label>
    <select id="e-goal" class="input-field" bind:value={eGoalId}>
      <option value="">— No goal —</option>
      {#each goals as g}<option value={g.id}>{g.name} ({fmt(g.current)} / {fmt(g.target)})</option>{/each}
    </select>
  </div>
  {/if}
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showEdit=false}>Cancel</button>
    <button class="btn-primary" on:click={saveTx}>Update</button>
  </div>
</Modal>

<style>
  .space{display:flex;flex-direction:column;gap:16px;}
  .page-hdr{display:flex;align-items:center;justify-content:space-between;}
  .count{font-size:14px;color:var(--text2);}
  .shortage-badge-inline { margin-left:10px; background:var(--danger); color:#fff; font-size:10px; font-weight:700; padding:2px 8px; border-radius:10px; vertical-align:middle; }
  .shortage-banner { display:flex; align-items:flex-start; gap:12px; padding:14px 18px; background:rgba(255,92,124,.08); border:1px solid rgba(255,92,124,.25); border-radius:10px; }
  .shortage-icon { font-size:20px; flex-shrink:0; }
  .shortage-title { font-size:13px; font-weight:700; color:var(--danger); }
  .shortage-desc { font-size:12px; color:var(--text2); margin-top:3px; }
  .filters{padding:16px;}
  .filter-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;}
  @media(max-width:1100px){.filter-grid{grid-template-columns:repeat(3,1fr);}}
  @media(max-width:700px){.filter-grid{grid-template-columns:repeat(2,1fr);}}
  @media(max-width:500px){.filter-grid{grid-template-columns:1fr;}}
  .clear-btn{margin-top:10px;background:none;border:none;cursor:pointer;color:var(--text2);font-size:12px;}
  .clear-btn:hover{color:var(--danger);}

  .bank-summary-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));}
  .bank-summary{padding:16px;}
  .bank-summary-name{font-size:12px;font-weight:600;margin-bottom:10px;}
  .summary-rows{display:flex;flex-direction:column;gap:6px;}
  .summary-row{display:flex;justify-content:space-between;align-items:center;font-size:12px;}
  .final-row{border-top:1px solid var(--border);padding-top:8px;margin-top:2px;}
  .usable-row{background:rgba(0,229,160,.05);border-radius:4px;padding:3px 4px;margin:2px 0;}
  .next-month{font-size:11px;color:var(--text2);font-style:italic;margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,.05);}
  .muted{color:var(--text2);}
  .pos{color:var(--accent);}
  .neg{color:var(--danger);}
  .sav{color:var(--accent2);}
  .fw{font-weight:600;}

  .table-wrap{overflow:hidden;}
  .tscroll{overflow-x:auto;}
  table{width:100%;border-collapse:collapse;font-size:14px;}
  th{text-align:left;padding:12px;font-size:12px;font-weight:600;color:var(--text2);border-bottom:1px solid var(--border);}
  td{padding:12px;border-bottom:1px solid var(--border);}
  .sm{font-size:12px;}
  .right{text-align:right;}
  .empty{text-align:center;color:var(--text2);padding:32px;}
  .actions{display:flex;gap:4px;}
  .icon-btn{background:none;border:none;cursor:pointer;color:rgba(255,255,255,.45);padding:5px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:all .15s;}
  .icon-btn:hover{background:rgba(255,92,124,.12);color:var(--danger);}
  .mono{font-family:'Space Mono',monospace;}
  .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;}
  .badge.income{background:rgba(0,229,160,.15);color:var(--accent);}
  .badge.expense{background:rgba(255,92,124,.15);color:var(--danger);}
  .badge.savings{background:rgba(124,92,252,.15);color:var(--accent2);margin-left:6px;}
  .badge.goal{background:rgba(255,179,71,.15);color:#ffb347;margin-left:6px;}
  .badge.dip{background:rgba(255,92,124,.15);color:var(--danger);margin-left:6px;font-size:10px;}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .form-group{margin-bottom:14px;}
  .checkbox-label{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--text2);}
  .modal-actions{display:flex;gap:8px;margin-top:20px;}
</style>
