<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { fmt } from '$lib/stores.js';

  const COLORS = ['#00e5a0','#7c5cfc','#ff5c7c','#ffb347','#4ecdc4','#45b7d1','#96ceb4','#feca57'];

  let data = null, loading = true;

  // Month filter — defaults to current month
  let selectedMonth = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  })();

  // Month-specific data loaded separately
  let monthTxs = [], monthEvents = [], monthNotes = [], monthFiles = [];
  let monthLoading = false;

  // All available months (from transaction history)
  let availableMonths = [];

  onMount(async () => {
    try { data = await api.get('/overview'); }
    catch(e) { console.error(e); }
    finally { loading = false; }
    await loadMonthData();
  });

  async function loadMonthData() {
    monthLoading = true;
    try {
      const [txs, events, notes, files] = await Promise.all([
        api.get(`/transactions?sort=date-desc`),
        api.get('/events'),
        api.get('/notes'),
        api.get('/drive/files'),
      ]);

      // Build available months from transactions
      const monthSet = new Set(txs.map(t => t.date?.slice(0,7)).filter(Boolean));
      // Also add events/notes months
      events.forEach(e => { if(e.date) monthSet.add(e.date.slice(0,7)); });
      notes.forEach(n => { if(n.date) monthSet.add(n.date.slice(0,7)); });
      availableMonths = [...monthSet].sort().reverse();

      // If current month not in list, add it
      if (!availableMonths.includes(selectedMonth)) availableMonths.unshift(selectedMonth);

      // Filter all by selected month
      filterByMonth(txs, events, notes, files);
    } catch(e) { console.error(e); }
    finally { monthLoading = false; }
  }

  // Store raw data for re-filtering without re-fetching
  let _allTxs = [], _allEvents = [], _allNotes = [], _allFiles = [];

  async function loadAll() {
    monthLoading = true;
    try {
      const [txs, events, notes, files] = await Promise.all([
        api.get('/transactions?sort=date-desc'),
        api.get('/events'),
        api.get('/notes'),
        api.get('/drive/files'),
      ]);
      _allTxs    = txs;
      _allEvents = events;
      _allNotes  = notes;
      _allFiles  = files;

      const monthSet = new Set(txs.map(t => t.date?.slice(0,7)).filter(Boolean));
      events.forEach(e => { if(e.date) monthSet.add(e.date.slice(0,7)); });
      notes.forEach(n => { if(n.date) monthSet.add(n.date.slice(0,7)); });
      availableMonths = [...monthSet].sort().reverse();
      if (!availableMonths.includes(selectedMonth)) availableMonths.unshift(selectedMonth);

      filterByMonth(txs, events, notes, files);
    } catch(e) { console.error(e); }
    finally { monthLoading = false; }
  }

  function filterByMonth(txs, events, notes, files) {
    _allTxs    = txs;
    _allEvents = events;
    _allNotes  = notes;
    _allFiles  = files;
    applyFilter();
  }

  function applyFilter() {
    monthTxs    = _allTxs.filter(t => t.date?.slice(0,7) === selectedMonth);
    monthEvents = _allEvents.filter(e => e.date?.slice(0,7) === selectedMonth);
    monthNotes  = _allNotes.filter(n => n.date?.slice(0,7) === selectedMonth || !n.date);
    monthFiles  = _allFiles.filter(f => f.date?.slice(0,7) === selectedMonth);
  }

  $: if (selectedMonth) applyFilter();

  // Format month label
  function fmtMonth(m) {
    if (!m) return '';
    const [y, mo] = m.split('-').map(Number);
    return new Date(y, mo-1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function daysUntil(d) {
    if (!d) return 0;
    const s = String(d).slice(0,10);
    const [y,m,day] = s.split('-').map(Number);
    const ev = new Date(y,m-1,day), td = new Date(...todayStr().split('-').map(Number));
    return Math.ceil((ev - new Date(todayStr().split('-')[0], todayStr().split('-')[1]-1, todayStr().split('-')[2])) / 86400000);
  }

  // Pie helpers
  function pieXY(pct) {
    const a = pct * 2 * Math.PI - Math.PI / 2;
    return { x: +(50 + 40 * Math.cos(a)).toFixed(3), y: +(50 + 40 * Math.sin(a)).toFixed(3) };
  }

  // Income vs Expense for selected month
  $: mIncome  = monthTxs.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  $: mExpense = monthTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  $: incomePct    = mIncome + mExpense > 0 ? mIncome / (mIncome + mExpense) : 0.5;
  $: incomeSlice  = (() => { const s=pieXY(0), e=pieXY(incomePct); return `M 50 50 L ${s.x} ${s.y} A 40 40 0 ${incomePct>0.5?1:0} 1 ${e.x} ${e.y} Z`; })();
  $: expenseSlice = (() => { const s=pieXY(incomePct), e=pieXY(1); return `M 50 50 L ${s.x} ${s.y} A 40 40 0 ${incomePct<0.5?1:0} 1 ${e.x} ${e.y} Z`; })();
  $: hasIncomeData = mIncome > 0 || mExpense > 0;

  // Category spending for selected month
  $: catSpending = (() => {
    const m = {};
    monthTxs.filter(t=>t.type==='expense').forEach(t => {
      const c = t.category||'Other';
      m[c] = (m[c]||0) + Number(t.amount);
    });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,7);
  })();

  onMount(loadAll);
</script>

<div class="fade-in space">
  {#if loading}
    <div class="loading">Loading…</div>
  {:else if data}

  <!-- Month selector -->
  <div class="month-bar glass">
    <span class="month-bar-label">📅 Viewing</span>
    <select class="month-select" bind:value={selectedMonth}>
      {#each availableMonths as m}
        <option value={m}>{fmtMonth(m)}{m === todayStr().slice(0,7) ? ' (This Month)' : ''}</option>
      {/each}
    </select>
    {#if monthLoading}
      <span class="month-loading">Loading…</span>
    {/if}
  </div>

  <!-- Stat Cards — always global (balances don't change by month) -->
  <div class="stat-grid">
    <div class="stat-card glass card-green">
      <span class="stat-label">Total Balance</span>
      <p class="stat-val mono">{fmt(data.totalBalance)}</p>
      <p class="stat-sub">{data.highestBank ? `Highest: ${data.highestBank.name}` : 'No accounts yet'}</p>
    </div>
    <div class="stat-card glass card-purple">
      <span class="stat-label">Highest Balance</span>
      <p class="stat-val mono">{data.highestBank ? fmt(data.highestBank.balance) : 'N/A'}</p>
      <p class="stat-sub">{data.highestBank?.name || 'No accounts'}</p>
    </div>
    <div class="stat-card glass card-red">
      <span class="stat-label">CC Outstanding</span>
      <p class="stat-val mono">{fmt(data.ccOutstanding)}</p>
      <p class="stat-sub">Credit cards</p>
    </div>
    <div class="stat-card glass card-orange">
      <span class="stat-label">Month Net</span>
      <p class="stat-val mono" class:pos={mIncome>=mExpense} class:neg={mIncome<mExpense}>{fmt(mIncome - mExpense)}</p>
      <p class="stat-sub">{fmtMonth(selectedMonth)}</p>
    </div>
  </div>

  <!-- Charts -->
  <div class="chart-grid">

    <!-- Income vs Expenses Pie -->
    <div class="glass chart-card">
      <h3 class="card-title">Income vs Expenses</h3>
      {#if !hasIncomeData}
        <div class="chart-empty">No transactions in {fmtMonth(selectedMonth)}</div>
      {:else}
        <div class="pie-row">
          <svg viewBox="0 0 100 100" width="150" height="150" style="flex-shrink:0">
            <path d={incomeSlice}  fill="#00e5a0" stroke="var(--surface)" stroke-width="0.5"/>
            <path d={expenseSlice} fill="#ff5c7c" stroke="var(--surface)" stroke-width="0.5"/>
            <circle cx="50" cy="50" r="26" fill="var(--surface)"/>
            <text x="50" y="47" text-anchor="middle" fill="var(--text2)" font-size="6">Net</text>
            <text x="50" y="56" text-anchor="middle" fill={mIncome>=mExpense?"#00e5a0":"#ff5c7c"} font-size="5.5" font-weight="bold">{fmt(mIncome-mExpense)}</text>
          </svg>
          <div class="pie-legend">
            <div class="pie-leg-row">
              <span class="pie-dot" style="background:#00e5a0"></span>
              <div>
                <p class="pie-lbl">Income</p>
                <p class="pie-val mono pos">{fmt(mIncome)}</p>
              </div>
            </div>
            <div class="pie-leg-row">
              <span class="pie-dot" style="background:#ff5c7c"></span>
              <div>
                <p class="pie-lbl">Expenses</p>
                <p class="pie-val mono neg">{fmt(mExpense)}</p>
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Spending by Category -->
    <div class="glass chart-card">
      <h3 class="card-title">Spending by Category</h3>
      {#if catSpending.length === 0}
        <div class="chart-empty">No expenses in {fmtMonth(selectedMonth)}</div>
      {:else}
        <div class="cat-list">
          {#each catSpending as [cat, amt], i}
            <div class="cat-row">
              <span class="cat-dot" style="background:{COLORS[i%COLORS.length]}"></span>
              <span class="cat-name">{cat}</span>
              <div class="cat-bar-wrap">
                <div class="cat-bar" style="width:{(amt/catSpending[0][1])*100}%;background:{COLORS[i%COLORS.length]}"></div>
              </div>
              <span class="cat-val mono">{fmt(amt)}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

  </div>

  <!-- Info Cards (month-filtered) -->
  <div class="info-grid">

    <!-- Drive Files -->
    <div class="glass info-card">
      <p class="info-label">Drive Files</p>
      <p class="info-count mono">{monthFiles.length}</p>
      <p class="info-sub">files in {fmtMonth(selectedMonth)}</p>
    </div>

    <!-- Events this month -->
    <div class="glass info-card">
      <p class="info-label">Events</p>
      {#if monthEvents.length === 0}
        <p class="empty-text">No events in {fmtMonth(selectedMonth)}</p>
      {:else}
        <div class="ev-list">
          {#each monthEvents.slice(0,4) as ev}
            <div class="mini-row">
              <span class="truncate">{ev.title}</span>
              <span class="mini-date mini-tag">{ev.date?.slice(5,10)}</span>
            </div>
          {/each}
          {#if monthEvents.length > 4}
            <p class="more-text">+{monthEvents.length - 4} more</p>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Notes this month -->
    <div class="glass info-card">
      <p class="info-label">Notes</p>
      {#if monthNotes.length === 0}
        <p class="empty-text">No notes in {fmtMonth(selectedMonth)}</p>
      {:else}
        {#each monthNotes.slice(0,4) as note}
          <p class="mini-note" class:overdue={note.date && note.date < todayStr()}>{note.text}</p>
        {/each}
        {#if monthNotes.length > 4}
          <p class="more-text">+{monthNotes.length - 4} more</p>
        {/if}
      {/if}
    </div>

  </div>

  {/if}
</div>

<style>
  .space   { display:flex; flex-direction:column; gap:20px; }
  .loading { color:var(--text2); font-size:14px; }

  /* Month bar */
  .month-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
  }
  .month-bar-label { font-size:12px; color:var(--text2); white-space:nowrap; }
  .month-select {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 13px;
    font-weight: 600;
    padding: 6px 12px;
    cursor: pointer;
    outline: none;
  }
  .month-select:focus { border-color: var(--accent); }
  .month-loading { font-size:11px; color:var(--text2); }

  /* Stat cards */
  .stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
  @media(max-width:1024px){ .stat-grid { grid-template-columns:repeat(2,1fr); } }
  @media(max-width:600px)  { .stat-grid { grid-template-columns:1fr; } }
  .stat-card  { padding:20px; border-radius:12px; position:relative; overflow:hidden; }
  .stat-card::before { content:''; position:absolute; top:0; right:0; width:80px; height:80px; border-radius:50%; filter:blur(40px); opacity:.15; }
  .card-green::before  { background:var(--accent); }
  .card-purple::before { background:var(--accent2); }
  .card-red::before    { background:var(--danger); }
  .card-orange::before { background:var(--warning); }
  .stat-label { display:block; font-size:12px; color:var(--text2); margin-bottom:8px; }
  .stat-val   { font-size:24px; font-weight:700; }
  .stat-sub   { font-size:12px; color:var(--text2); margin-top:4px; }
  .pos { color:var(--accent); }
  .neg { color:var(--danger); }

  /* Charts */
  .chart-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  @media(max-width:900px){ .chart-grid { grid-template-columns:1fr; } }
  .chart-card  { padding:20px; }
  .card-title  { font-size:14px; font-weight:600; margin-bottom:16px; }
  .chart-empty { height:160px; display:flex; align-items:center; justify-content:center;
                 font-size:12px; color:var(--text2); text-align:center; padding:0 20px; }

  /* Pie */
  .pie-row      { display:flex; align-items:center; gap:20px; }
  .pie-legend   { display:flex; flex-direction:column; gap:14px; }
  .pie-leg-row  { display:flex; align-items:flex-start; gap:10px; }
  .pie-dot      { width:11px; height:11px; border-radius:3px; flex-shrink:0; margin-top:3px; }
  .pie-lbl      { font-size:11px; color:var(--text2); }
  .pie-val      { font-size:15px; font-weight:700; margin-top:2px; }

  /* Category bars */
  .cat-list    { display:flex; flex-direction:column; gap:8px; }
  .cat-row     { display:flex; align-items:center; gap:8px; font-size:12px; }
  .cat-dot     { width:8px; height:8px; border-radius:2px; flex-shrink:0; }
  .cat-name    { width:74px; flex-shrink:0; color:var(--text2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .cat-bar-wrap{ flex:1; height:7px; background:var(--surface2); border-radius:4px; overflow:hidden; }
  .cat-bar     { height:100%; border-radius:4px; transition:width .4s; }
  .cat-val     { width:80px; text-align:right; font-size:11px; color:var(--text2); }

  /* Info cards */
  .info-grid   { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
  @media(max-width:900px){ .info-grid { grid-template-columns:1fr; } }
  .info-card   { padding:20px; }
  .info-label  { font-size:13px; font-weight:600; margin-bottom:10px; }
  .info-count  { font-size:30px; font-weight:700; }
  .info-sub    { font-size:12px; color:var(--text2); margin-top:4px; }
  .empty-text  { font-size:12px; color:var(--text2); }
  .ev-list     { display:flex; flex-direction:column; gap:4px; }
  .mini-row    { display:flex; justify-content:space-between; align-items:center; font-size:12px; padding:3px 0; }
  .mini-tag    { font-size:11px; color:var(--accent); flex-shrink:0; margin-left:8px; background:rgba(0,229,160,.1); padding:1px 6px; border-radius:4px; }
  .mini-date   { color:var(--accent); flex-shrink:0; }
  .truncate    { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .mini-note   { font-size:12px; padding:2px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .mini-note.overdue { color:var(--danger); }
  .more-text   { font-size:11px; color:var(--text2); margin-top:4px; }
  .mono { font-family:'Space Mono',monospace; }
</style>
