<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { fmt, showToast, BANKS_LIST, CATEGORIES, today } from '$lib/stores.js';
  import Modal from '$lib/components/Modal.svelte';

  let banks = [], loading = true;
  let showAdd = false, showEdit = false;
  let editBank = null;

  // Statement view
  let viewingBank = null;
  let stmtTxs = [], stmtLoading = false;
  let stmtFrom = '', stmtTo = '';

  let fName = '', fBalance = '';
  let eName = '', eBalance = '';

  let shortageMap = {}; // bank_id → shortage amount

  onMount(async () => {
    await load();
    // Check goal shortages to show bank-level badge
    try {
      const goals = await api.get('/goals');
      goals.filter(g=>g.has_shortage && g.bank_id).forEach(g => {
        shortageMap[g.bank_id] = (shortageMap[g.bank_id]||0) + Number(g.shortage_amount);
      });
      shortageMap = {...shortageMap}; // trigger reactivity
    } catch(e) {}
  });

  async function load() {
    loading = true;
    try { banks = await api.get('/banks'); }
    catch(e) { showToast(e.message, 'error'); }
    finally { loading = false; }
  }

  async function addBank() {
    if (!fName) return showToast('Select a bank name', 'error');
    try {
      await api.post('/banks', { name: fName, balance: parseFloat(fBalance) || 0 });
      showToast('Bank account added!');
      showAdd = false; fName = ''; fBalance = '';
      load();
    } catch(e) { showToast(e.message, 'error'); }
  }

  function openEdit(b) { editBank = b; eName = b.name; eBalance = b.balance; showEdit = true; }

  async function saveEdit() {
    try {
      await api.patch(`/banks/${editBank.id}`, { name: eName, balance: parseFloat(eBalance) || 0 });
      showToast('Balance updated!');
      showEdit = false; editBank = null; load();
    } catch(e) { showToast(e.message, 'error'); }
  }

  async function deleteBank(id) {
    if (!confirm('Delete this bank account?')) return;
    try { await api.delete(`/banks/${id}`); showToast('Deleted!'); load(); }
    catch(e) { showToast(e.message, 'error'); }
  }

  // ── Statement ──────────────────────────────────────────────────────────────
  async function openStatement(bank) {
    viewingBank = bank;
    // default: current month
    const now = new Date();
    stmtFrom = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    stmtTo   = today();
    await loadStatement();
  }

  function closeStatement() { viewingBank = null; stmtTxs = []; }

  async function loadStatement() {
    if (!viewingBank) return;
    stmtLoading = true;
    try {
      const p = new URLSearchParams({ bank_id: viewingBank.id, sort: 'date-asc' });
      const all = await api.get(`/transactions?${p}`);
      stmtTxs = all.filter(t => {
        const d = t.date?.slice(0,10) || '';
        return (!stmtFrom || d >= stmtFrom) && (!stmtTo || d <= stmtTo);
      });
    } catch(e) { showToast(e.message, 'error'); }
    finally { stmtLoading = false; }
  }

  // Statement computed stats
  // ── Download CSV ──────────────────────────────────────────────────────────
  function downloadCSV() {
    const rows = [['Date','Description','Category','Type','Debit','Credit','Running Balance']];
    stmtTxs.forEach((tx, i) => {
      let b = Number(viewingBank.balance);
      for (let j = stmtTxs.length-1; j > i; j--) {
        const t = stmtTxs[j];
        b = t.type==='income' ? b - Number(t.amount) : b + Number(t.amount);
      }
      rows.push([
        tx.date?.slice(0,10)||'',
        tx.description||'',
        tx.category||'',
        tx.type,
        tx.type==='expense' ? Number(tx.amount).toFixed(2) : '',
        tx.type==='income'  ? Number(tx.amount).toFixed(2) : '',
        b.toFixed(2),
      ]);
    });
    const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=`${viewingBank.name}_${stmtFrom}_to_${stmtTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Print Statement ────────────────────────────────────────────────────────
  function printStatement() {
    const currency = 'RM';
    const f = n => currency+' '+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    const fmtD = d => { if(!d) return '—'; const s=String(d).slice(0,10); const [y,m,day]=s.split('-').map(Number); return new Date(y,m-1,day).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); };
    const fmtShort = d => { if(!d) return '—'; const s=String(d).slice(0,10); const [y,m,day]=s.split('-').map(Number); const mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]; return `${String(day).padStart(2,'0')} ${mo}`; };
    let openBal = Number(viewingBank.balance);
    for (const t of stmtTxs) openBal = t.type==='income' ? openBal-Number(t.amount) : openBal+Number(t.amount);
    const payin  = stmtTxs.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
    const payout = stmtTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
    const txRows = stmtTxs.map((tx,i) => {
      let b = Number(viewingBank.balance);
      for (let j=stmtTxs.length-1;j>i;j--) { const t=stmtTxs[j]; b=t.type==='income'?b-Number(t.amount):b+Number(t.amount); }
      const bg = i%2===0?'#fff':'#fafafa';
      const cat = tx.category?` <span style="color:#999;font-size:11px;"> — ${tx.category}</span>`:'';
      return `<tr style="background:${bg}"><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#666;font-family:monospace;font-size:12px;width:72px">${fmtShort(tx.date)}</td><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#333">${tx.description||'—'}${cat}</td><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:right;font-family:monospace;white-space:nowrap;color:${tx.type==='income'?'#999':'#c0392b'};font-weight:${tx.type==='income'?'400':'600'}">${tx.type==='income'?'—':f(tx.amount)}</td><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:right;font-family:monospace;white-space:nowrap;color:${tx.type==='income'?'#27ae60':'#999'};font-weight:${tx.type==='income'?'600':'400'}">${tx.type==='income'?f(tx.amount):'—'}</td><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:right;font-family:monospace;font-weight:700;color:#333;white-space:nowrap">${f(b)}</td></tr>`;
    }).join('');
    const genDate = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bank Statement — ${viewingBank.name}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#f0f2f5;padding:24px}@media print{body{background:#fff;padding:0}}</style></head><body><div style="max-width:860px;margin:0 auto;background:#fff;box-shadow:0 1px 8px rgba(0,0,0,.08);border-radius:4px;overflow:hidden"><div style="height:8px;background:#1a5276"></div><div style="padding:28px 36px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eee"><div><div style="font-size:26px;font-weight:700;color:#c0392b;letter-spacing:-.5px">${viewingBank.name}</div><div style="font-size:12px;color:#888;margin-top:2px">Personal &amp; Business Banking</div></div><div style="width:56px;height:56px;border-radius:50%;background:#c0392b;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:700">${(viewingBank.name||'B')[0].toUpperCase()}</div></div><div style="background:#f5f6f8;padding:16px 36px;display:flex;gap:32px;border-bottom:1px solid #e8e8e8"><div style="flex:1"><div style="font-size:9px;text-transform:uppercase;color:#999;letter-spacing:1px;font-weight:600">Account Name</div><div style="font-size:14px;font-weight:600;color:#333;margin-top:3px">${viewingBank.name}</div></div><div style="flex:1"><div style="font-size:9px;text-transform:uppercase;color:#999;letter-spacing:1px;font-weight:600">Statement Period</div><div style="font-size:14px;font-weight:600;color:#333;margin-top:3px">${fmtD(stmtFrom)} – ${fmtD(stmtTo)}</div></div><div style="flex:1"><div style="font-size:9px;text-transform:uppercase;color:#999;letter-spacing:1px;font-weight:600">Generated On</div><div style="font-size:14px;font-weight:600;color:#333;margin-top:3px">${genDate}</div></div></div><div style="padding:24px 36px 20px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#c0392b;margin-bottom:14px">Account Summary</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px"><div style="background:#fef9f3;border:1px solid #f5e6d3;border-radius:6px;padding:14px 16px;text-align:center"><div style="font-size:9px;text-transform:uppercase;color:#999;letter-spacing:.8px;font-weight:600">Opening Balance</div><div style="font-size:18px;font-weight:700;color:#333;margin-top:6px;font-family:monospace">${f(openBal)}</div></div><div style="background:#f4faf5;border:1px solid #d4edda;border-radius:6px;padding:14px 16px;text-align:center"><div style="font-size:9px;text-transform:uppercase;color:#999;letter-spacing:.8px;font-weight:600">Total Deposits</div><div style="font-size:18px;font-weight:700;color:#27ae60;margin-top:6px;font-family:monospace">${f(payin)}</div></div><div style="background:#fdf4f4;border:1px solid #f5c6cb;border-radius:6px;padding:14px 16px;text-align:center"><div style="font-size:9px;text-transform:uppercase;color:#999;letter-spacing:.8px;font-weight:600">Total Withdrawals</div><div style="font-size:18px;font-weight:700;color:#c0392b;margin-top:6px;font-family:monospace">${f(payout)}</div></div><div style="background:#fef9f3;border:1px solid #f5e6d3;border-radius:6px;padding:14px 16px;text-align:center"><div style="font-size:9px;text-transform:uppercase;color:#999;letter-spacing:.8px;font-weight:600">Closing Balance</div><div style="font-size:18px;font-weight:700;color:#333;margin-top:6px;font-family:monospace">${f(Number(viewingBank.balance))}</div></div></div></div><div style="padding:0 36px 28px"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#c0392b"><th style="padding:10px 14px;text-align:left;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;width:72px">Date</th><th style="padding:10px 14px;text-align:left;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Description</th><th style="padding:10px 14px;text-align:right;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;width:130px">Withdrawal</th><th style="padding:10px 14px;text-align:right;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;width:130px">Deposit</th><th style="padding:10px 14px;text-align:right;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;width:130px">Balance</th></tr></thead><tbody><tr style="background:#fdf6e3"><td style="padding:10px 14px;color:#8a6d3b;font-family:monospace;font-size:12px">${fmtShort(stmtFrom)}</td><td style="padding:10px 14px;color:#8a6d3b;font-weight:700">Previous Balance</td><td style="padding:10px 14px;text-align:right;color:#8a6d3b">—</td><td style="padding:10px 14px;text-align:right;color:#8a6d3b">—</td><td style="padding:10px 14px;text-align:right;color:#8a6d3b;font-weight:700;font-family:monospace">${f(openBal)}</td></tr>${txRows}<tr style="background:#fdf6e3;border-top:2px solid #e8d5a3"><td style="padding:14px 14px;color:#8a6d3b;font-family:monospace;font-size:12px">${fmtShort(stmtTo)}</td><td style="padding:14px 14px;color:#8a6d3b;font-weight:700;font-size:14px">Ending Balance</td><td style="padding:14px 14px;text-align:right;color:#8a6d3b">—</td><td style="padding:14px 14px;text-align:right;color:#8a6d3b">—</td><td style="padding:14px 14px;text-align:right;font-weight:700;color:#c0392b;font-size:18px;font-family:monospace">${f(Number(viewingBank.balance))}</td></tr></tbody></table></div><div style="background:#f5f6f8;padding:16px 36px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e8e8e8"><div><span style="font-weight:700;color:#c0392b;font-size:13px">${viewingBank.name}</span><span style="color:#999;font-size:11px;margin-left:8px">— Computer-generated statement.</span></div><div style="color:#aaa;font-size:10px;font-family:monospace">Printed: ${genDate}</div></div></div></body></html>`;
    const win = window.open('','_blank');
    win.document.write(html); win.document.close(); win.focus();
    setTimeout(() => win.print(), 400);
  }

  $: stmtIncome   = stmtTxs.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  $: stmtExpense  = stmtTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  $: stmtSavings  = stmtTxs.filter(t=>t.is_savings).reduce((s,t)=>s+Number(t.amount),0);
  $: stmtByCategory = (() => {
    const m = {};
    stmtTxs.filter(t=>t.type==='expense').forEach(t => {
      const c = t.category || 'Other';
      m[c] = (m[c]||0) + Number(t.amount);
    });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  })();
</script>

<!-- ── STATEMENT VIEW ── -->
{#if viewingBank}
  <div class="fade-in space">
    <!-- Header -->
    <div class="stmt-header glass">
      <button class="back-btn" on:click={closeStatement}>← Back to Accounts</button>
      <div class="stmt-title-row">
        <div>
          <p class="stmt-bank-name">{viewingBank.name}</p>
          <p class="stmt-subtitle">Transaction Statement</p>
        </div>
        <p class="stmt-balance mono">{fmt(viewingBank.balance)}</p>
      </div>
      <!-- Date range picker -->
      <div class="date-range">
        <div>
          <label for="stmt-from">From</label>
          <input id="stmt-from" class="input-field" type="date" bind:value={stmtFrom} on:change={loadStatement}>
        </div>
        <div class="date-sep">→</div>
        <div>
          <label for="stmt-to">To</label>
          <input id="stmt-to" class="input-field" type="date" bind:value={stmtTo} on:change={loadStatement}>
        </div>
        <button class="btn-secondary sm" on:click={loadStatement}>Apply</button>
        <button class="btn-secondary sm" on:click={downloadCSV}>⬇ CSV</button>
        <button class="btn-primary sm" on:click={printStatement}>🖨 Print Statement</button>
      </div>
    </div>

    <!-- Overview Cards -->
    <div class="stat-grid">
      <div class="stat-card glass card-green">
        <p class="stat-label">Transactions</p>
        <p class="stat-val mono">{stmtTxs.length}</p>
        <p class="stat-sub">total entries</p>
      </div>
      <div class="stat-card glass card-orange">
        <p class="stat-label">Income</p>
        <p class="stat-val mono pos">{fmt(stmtIncome)}</p>
        <p class="stat-sub">{stmtTxs.filter(t=>t.type==='income').length} entries</p>
      </div>
      <div class="stat-card glass card-red">
        <p class="stat-label">Expenses</p>
        <p class="stat-val mono neg">{fmt(stmtExpense)}</p>
        <p class="stat-sub">{stmtTxs.filter(t=>t.type==='expense').length} entries</p>
      </div>
      <div class="stat-card glass card-purple">
        <p class="stat-label">Savings</p>
        <p class="stat-val mono">{fmt(stmtSavings)}</p>
        <p class="stat-sub">flagged savings</p>
      </div>
    </div>

    <!-- Spending by Category -->
    {#if stmtByCategory.length > 0}
      <div class="glass cat-card">
        <p class="section-label">EXPENSES BY CATEGORY</p>
        <div class="cat-list">
          {#each stmtByCategory as [cat, amt]}
            <div class="cat-row">
              <span class="cat-name">{cat}</span>
              <div class="cat-bar-wrap">
                <div class="cat-bar" style="width:{stmtByCategory.length ? (amt/stmtByCategory[0][1])*100 : 0}%"></div>
              </div>
              <span class="cat-val mono neg">{fmt(amt)}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Transactions Table -->
    <div class="glass table-wrap">
      <div class="table-header">
        <p class="section-label" style="margin:0">TRANSACTIONS</p>
        <p class="muted">{stmtTxs.length} record{stmtTxs.length!==1?'s':''}</p>
      </div>
      <div class="tscroll">
        {#if stmtLoading}
          <p class="empty">Loading…</p>
        {:else if stmtTxs.length === 0}
          <p class="empty">No transactions in this period</p>
        {:else}
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th class="right">Debit</th>
                <th class="right">Credit</th>
                <th class="right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {#each stmtTxs as tx, i}
                {@const runningBal = (() => {
                  let bal = Number(viewingBank.balance);
                  // subtract future txs
                  for (let j = stmtTxs.length-1; j > i; j--) {
                    const t = stmtTxs[j];
                    if (t.type==='income') bal -= Number(t.amount);
                    else bal += Number(t.amount);
                  }
                  return bal;
                })()}
                <tr>
                  <td class="sm">{tx.date?.slice(0,10)}</td>
                  <td>
                    {tx.description||'-'}
                    {#if tx.is_savings}<span class="badge savings">💾</span>{/if}
                  </td>
                  <td><span class="badge {tx.type}">{tx.category||'-'}</span></td>
                  <td class="right mono neg sm">{tx.type==='expense' ? fmt(tx.amount) : '—'}</td>
                  <td class="right mono pos sm">{tx.type==='income'  ? fmt(tx.amount) : '—'}</td>
                  <td class="right mono fw sm">{fmt(runningBal)}</td>
                </tr>
              {/each}
            </tbody>
            <tfoot>
              <tr class="totals-row">
                <td colspan="3" class="fw">Totals</td>
                <td class="right mono neg fw">{fmt(stmtExpense)}</td>
                <td class="right mono pos fw">{fmt(stmtIncome)}</td>
                <td class="right mono fw">{fmt(viewingBank.balance)}</td>
              </tr>
            </tfoot>
          </table>
        {/if}
      </div>
    </div>
  </div>

<!-- ── ACCOUNTS LIST ── -->
{:else}
  <div class="fade-in">
    <div class="page-hdr">
      <p class="count">{banks.length} account{banks.length !== 1 ? 's' : ''}</p>
      <button class="btn-primary" on:click={() => showAdd = true}>+ Add Account</button>
    </div>

    {#if loading}
      <p class="muted">Loading…</p>
    {:else if banks.length === 0}
      <div class="glass empty-state"><p>No bank accounts yet. Add one to get started.</p></div>
    {:else}
      <div class="bank-grid">
        {#each banks as b}
          <button class="glass bank-card" on:click={() => openStatement(b)}>
            <div class="bank-top">
              <div class="bank-icon">🏦</div>
              <span class="bank-name">{b.name}</span>
              <button class="icon-btn danger" on:click|stopPropagation={() => deleteBank(b.id)} title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
            </div>
            <p class="bank-bal mono">{fmt(b.balance)}</p>
            {#if shortageMap[b.id]}
              <p class="shortage-tag">⚠️ RM {Number(shortageMap[b.id]).toFixed(2)} savings shortage</p>
            {/if}
            <p class="view-stmt">View Statement →</p>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<!-- Add Modal -->
<Modal title="Add Bank Account" bind:show={showAdd} onClose={() => showAdd = false}>
  <div class="form-group">
    <label for="bname">Bank Name</label>
    <select id="bname" class="input-field" bind:value={fName}>
      <option value="">Select a bank…</option>
      {#each BANKS_LIST as b}<option>{b}</option>{/each}
    </select>
  </div>
  <div class="form-group">
    <label for="bbal">Current Balance</label>
    <input id="bbal" class="input-field" type="number" step="0.01" placeholder="0.00" bind:value={fBalance}>
  </div>
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showAdd = false}>Cancel</button>
    <button class="btn-primary" on:click={addBank}>Add Account</button>
  </div>
</Modal>

<!-- Edit Modal -->
<Modal title="Update Balance" bind:show={showEdit} onClose={() => showEdit = false}>
  <div class="form-group">
    <label for="ename">Bank Name</label>
    <input id="ename" class="input-field" bind:value={eName}>
  </div>
  <div class="form-group">
    <label for="ebal">New Balance</label>
    <input id="ebal" class="input-field" type="number" step="0.01" bind:value={eBalance}>
  </div>
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showEdit = false}>Cancel</button>
    <button class="btn-primary" on:click={saveEdit}>Update</button>
  </div>
</Modal>

<style>
  .space{display:flex;flex-direction:column;gap:16px;}
  .page-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
  .count{font-size:14px;color:var(--text2);}
  .muted{color:var(--text2);font-size:13px;}
  .empty-state{padding:48px;text-align:center;color:var(--text2);}

  /* Account cards */
  .bank-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
  @media(max-width:900px){.bank-grid{grid-template-columns:repeat(2,1fr);}}
  @media(max-width:600px){.bank-grid{grid-template-columns:1fr;}}
  .bank-card{padding:20px;text-align:left;cursor:pointer;transition:transform .15s,box-shadow .15s;border:none;}
  .bank-card:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(0,229,160,.15);}
  .bank-top{display:flex;align-items:center;gap:8px;margin-bottom:12px;}
  .bank-icon{font-size:20px;}
  .bank-name{font-weight:600;font-size:14px;flex:1;color: beige}
  .bank-bal{font-size:24px;font-weight:700;margin-bottom:6px;font-family:'Space Mono',monospace;color: white}
  .view-stmt{font-size:11px;color:var(--accent);margin-top:4px;}
  .icon-btn{background:none;border:none;cursor:pointer;color:rgba(255,255,255,.45);padding:5px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:all .15s;}
  .icon-btn:hover{background:rgba(255,92,124,.12);color:var(--danger);}

  /* Statement */
  .stmt-header{padding:20px 24px;}
  .back-btn{background:none;border:none;cursor:pointer;color:var(--accent);font-size:13px;margin-bottom:12px;padding:0;}
  .stmt-title-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;}
  .stmt-bank-name{font-size:18px;font-weight:700;}
  .stmt-subtitle{font-size:12px;color:var(--text2);margin-top:2px;}
  .stmt-balance{font-size:24px;font-weight:700;color:var(--accent);}
  .date-range{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;}
  .date-range>div{display:flex;flex-direction:column;gap:4px;}
  .date-sep{color:var(--text2);padding-bottom:10px;}
  .sm{font-size:12px;padding:6px 12px;}

  /* Stat cards */
  .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
  @media(max-width:900px){.stat-grid{grid-template-columns:repeat(2,1fr);}}
  @media(max-width:500px){.stat-grid{grid-template-columns:1fr 1fr;}}
  .stat-card{padding:16px;border-radius:12px;position:relative;overflow:hidden;}
  .stat-card::before{content:'';position:absolute;top:0;right:0;width:60px;height:60px;border-radius:50%;filter:blur(30px);opacity:.2;}
  .card-green::before{background:var(--accent);}
  .card-orange::before{background:var(--warning);}
  .card-red::before{background:var(--danger);}
  .card-purple::before{background:var(--accent2);}
  .stat-label{font-size:11px;color:var(--text2);margin-bottom:6px;}
  .stat-val{font-size:20px;font-weight:700;}
  .stat-sub{font-size:11px;color:var(--text2);margin-top:4px;}

  /* Category chart */
  .cat-card{padding:20px;}
  .section-label{font-size:11px;font-weight:600;color:var(--text2);letter-spacing:.05em;margin-bottom:12px;}
  .cat-list{display:flex;flex-direction:column;gap:8px;}
  .cat-row{display:flex;align-items:center;gap:10px;font-size:12px;}
  .cat-name{width:90px;flex-shrink:0;color:var(--text2);}
  .cat-bar-wrap{flex:1;height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;}
  .cat-bar{height:100%;background:var(--accent2);border-radius:3px;transition:width .4s;}
  .cat-val{width:90px;text-align:right;}

  /* Table */
  .table-wrap{overflow:hidden;}
  .table-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);}
  .tscroll{overflow-x:auto;}
  table{width:100%;border-collapse:collapse;font-size:13px;}
  th{text-align:left;padding:10px 14px;font-size:11px;font-weight:600;color:var(--text2);border-bottom:1px solid var(--border);white-space:nowrap;}
  td{padding:10px 14px;border-bottom:1px solid var(--border);vertical-align:middle;}
  tfoot td{padding:12px 14px;border-top:2px solid var(--border);border-bottom:none;}
  .totals-row{background:rgba(0,229,160,.05);}
  .right{text-align:right;}
  .fw{font-weight:600;}
  .pos{color:var(--accent);}
  .neg{color:var(--danger);}
  .mono{font-family:'Space Mono',monospace;}
  .empty{text-align:center;color:var(--text2);padding:32px;}
  .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;}
  .badge.income{background:rgba(0,229,160,.15);color:var(--accent);}
  .badge.expense{background:rgba(255,92,124,.15);color:var(--danger);}
  .badge.savings{background:rgba(124,92,252,.15);color:var(--accent2);margin-left:4px;}
  .form-group{margin-bottom:14px;}
  .modal-actions{display:flex;gap:8px;margin-top:20px;}
</style>
