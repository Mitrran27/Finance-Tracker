<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { fmt, showToast, CATEGORIES, today } from '$lib/stores.js';
  import Modal from '$lib/components/Modal.svelte';

  let cards=[], ccTxs=[], history=[], loading=true;
  let showAddCard=false, showAddTx=false;
  let search='', filterCard='', sort='date-desc';
  let dateFrom='', dateTo='';

  // Statement view
  let viewingCard = null;
  let stmtTxs=[], stmtLoading=false;
  let stmtFrom='', stmtTo='';

  let fCardName='', fLimit='', fOutstanding='';
  let fTxCard='', fTxAmount='', fTxDesc='', fTxCat='Food', fTxDate=today();
  let outstandingInputs = {};  // partial payment input per card
  let paymentInputs = {};       // amount to pay input per card

  onMount(load);

  async function load() {
    loading = true;
    try {
      [cards, history] = await Promise.all([
        api.get('/credit/cards'),
        api.get('/credit/history'),
      ]);
      if (cards.length) fTxCard = cards[0].id;
      await loadTxs();
    } catch(e) { showToast(e.message,'error'); }
    finally { loading=false; }
  }

  async function loadTxs() {
    const p = new URLSearchParams({ sort });
    if (filterCard) p.set('card_id', filterCard);
    if (search)     p.set('search', search);
    const all = await api.get(`/credit/transactions?${p}`);
    ccTxs = all.filter(t => {
      const d = t.date?.slice(0,10)||'';
      return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    });
  }

  async function addCard() {
    if (!fCardName) return showToast('Enter card name','error');
    try {
      await api.post('/credit/cards', { name:fCardName, credit_limit:parseFloat(fLimit)||0, outstanding:parseFloat(fOutstanding)||0 });
      showToast('Card added!'); showAddCard=false; fCardName=''; fLimit=''; fOutstanding='';
      load();
    } catch(e) { showToast(e.message,'error'); }
  }

  async function updateOutstanding(card, val) {
    try {
      await api.patch(`/credit/cards/${card.id}`, { outstanding: parseFloat(val)||0 });
      showToast('Balance updated!'); load();
    } catch(e) { showToast(e.message,'error'); }
  }

  async function markPaid(card) {
    try {
      await api.patch(`/credit/cards/${card.id}`, { outstanding: 0 });
      showToast(`${card.name} marked as paid!`); load();
    } catch(e) { showToast(e.message,'error'); }
  }

  async function payPartial(card) {
    const amt = parseFloat(paymentInputs[card.id]);
    if (!amt || amt <= 0) return showToast('Enter a valid amount', 'error');
    if (amt > Number(card.outstanding)) return showToast('Amount exceeds outstanding balance', 'error');
    const newOutstanding = Number(card.outstanding) - amt;
    try {
      await api.patch(`/credit/cards/${card.id}`, { outstanding: newOutstanding });
      showToast(`Paid ${fmt(amt)} — remaining: ${fmt(newOutstanding)}`);
      paymentInputs[card.id] = '';
      load();
    } catch(e) { showToast(e.message,'error'); }
  }

  async function deleteCard(id) {
    if (!confirm('Delete this card?')) return;
    try { await api.delete(`/credit/cards/${id}`); showToast('Deleted!'); load(); }
    catch(e) { showToast(e.message,'error'); }
  }

  async function addTx() {
    if (!fTxAmount || !fTxDate) return showToast('Amount and date required','error');
    try {
      await api.post('/credit/transactions', { card_id:fTxCard||null, amount:parseFloat(fTxAmount), description:fTxDesc, category:fTxCat, date:fTxDate });
      showToast('Transaction added!'); showAddTx=false; fTxAmount=''; fTxDesc='';
      load();
    } catch(e) { showToast(e.message,'error'); }
  }

  async function deleteTx(id) {
    if (!confirm('Delete?')) return;
    try { await api.delete(`/credit/transactions/${id}`); showToast('Deleted!'); loadTxs(); }
    catch(e) { showToast(e.message,'error'); }
  }

  async function deleteHistory(id) {
    if (!confirm('Delete this record?')) return;
    try { await api.delete(`/credit/history/${id}`); showToast('Deleted!'); load(); }
    catch(e) { showToast(e.message,'error'); }
  }

  // ── Card Statement ────────────────────────────────────────────────────────
  async function openStatement(card) {
    viewingCard = card;
    const now = new Date();
    stmtFrom = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    stmtTo   = today();
    await loadStmt();
  }

  function closeStatement() { viewingCard = null; stmtTxs = []; }

  async function loadStmt() {
    if (!viewingCard) return;
    stmtLoading = true;
    try {
      const all = await api.get(`/credit/transactions?card_id=${viewingCard.id}&sort=date-asc`);
      stmtTxs = all.filter(t => {
        const d = t.date?.slice(0,10)||'';
        return (!stmtFrom || d >= stmtFrom) && (!stmtTo || d <= stmtTo);
      });
    } catch(e) { showToast(e.message,'error'); }
    finally { stmtLoading = false; }
  }

  // ── Download CSV ──────────────────────────────────────────────────────────
  function downloadCSV() {
    const rows = [['Date','Type','Description','Category','Amount']];
    // Transactions (charges)
    stmtTxs.forEach(tx => rows.push([
      tx.date?.slice(0,10)||'', 'Transaction', tx.description||'', tx.category||'',
      Number(tx.amount).toFixed(2)
    ]));
    // Payment history for this card in the date range
    const cardPayments = history.filter(h => {
      const d = h.payment_date?.slice(0,10)||'';
      return String(h.card_id) === String(viewingCard.id) &&
             (!stmtFrom || d >= stmtFrom) && (!stmtTo || d <= stmtTo);
    });
    cardPayments.forEach(p => rows.push([
      p.payment_date?.slice(0,10)||'', 'Payment', `Paid outstanding balance`, '',
      '-' + Number(p.amount_paid).toFixed(2)
    ]));
    // Sort all rows by date
    rows.slice(1).sort((a,b) => a[0].localeCompare(b[0]));
    const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=`${viewingCard.name}_${stmtFrom}_to_${stmtTo}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Print Statement ────────────────────────────────────────────────────────
  function printStatement() {
    const currency = 'RM';
    const f = n => currency+' '+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    const fmtD = d => { if(!d) return '—'; const s=String(d).slice(0,10); const [y,m,day]=s.split('-').map(Number); return new Date(y,m-1,day).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); };
    const fmtShort = d => { if(!d) return '—'; const s=String(d).slice(0,10); const [y,m,day]=s.split('-').map(Number); const mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]; return `${String(day).padStart(2,'0')} ${mo}`; };
    const total = stmtTxs.reduce((s,t)=>s+Number(t.amount),0);
    const cardPayments = history.filter(h => {
      const d = h.payment_date?.slice(0,10)||'';
      return String(h.card_id) === String(viewingCard.id) &&
             (!stmtFrom || d >= stmtFrom) && (!stmtTo || d <= stmtTo);
    });
    const allStmtRows = [
      ...stmtTxs.map(tx => ({ date:tx.date?.slice(0,10)||'', desc:tx.description||'—', cat:tx.category||'', type:'charge', amt:Number(tx.amount) })),
      ...cardPayments.map(p => ({ date:p.payment_date?.slice(0,10)||'', desc:'Payment — Outstanding Balance Paid', cat:'', type:'payment', amt:Number(p.amount_paid) })),
    ].sort((a,b) => a.date.localeCompare(b.date));
    const totalPaid = cardPayments.reduce((s,p)=>s+Number(p.amount_paid),0);

    const txRows = allStmtRows.map((row,i) => {
      const bg = i%2===0?'#fff':'#fafafa';
      const cat = row.cat?` <span style="color:#999;font-size:11px;"> — ${row.cat}</span>`:'';
      const amtColor = row.type==='payment'?'#27ae60':'#c0392b';
      const amtPrefix = row.type==='payment'?'−':'';
      return `<tr style="background:${bg}"><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#666;font-family:monospace;font-size:12px;width:72px">${fmtShort(row.date)}</td><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#333">${row.desc}${cat}</td><td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:right;font-family:monospace;font-weight:600;color:${amtColor};white-space:nowrap">${amtPrefix}${f(row.amt)}</td></tr>`;
    }).join('');
    const genDate = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Card Statement — ${viewingCard.name}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#f0f2f5;padding:24px}@media print{body{background:#fff;padding:0}}</style></head><body><div style="max-width:860px;margin:0 auto;background:#fff;box-shadow:0 1px 8px rgba(0,0,0,.08);border-radius:4px;overflow:hidden"><div style="height:8px;background:#1a5276"></div><div style="padding:28px 36px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eee"><div><div style="font-size:26px;font-weight:700;color:#c0392b">💳 ${viewingCard.name}</div><div style="font-size:12px;color:#888;margin-top:2px">Credit Card Statement</div></div><div style="width:56px;height:56px;border-radius:50%;background:#c0392b;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:700">${(viewingCard.name||'C')[0].toUpperCase()}</div></div><div style="background:#f5f6f8;padding:16px 36px;display:flex;gap:32px;border-bottom:1px solid #e8e8e8"><div style="flex:1"><div style="font-size:9px;text-transform:uppercase;color:#999;letter-spacing:1px;font-weight:600">Card Name</div><div style="font-size:14px;font-weight:600;color:#333;margin-top:3px">${viewingCard.name}</div></div><div style="flex:1"><div style="font-size:9px;text-transform:uppercase;color:#999;letter-spacing:1px;font-weight:600">Statement Period</div><div style="font-size:14px;font-weight:600;color:#333;margin-top:3px">${fmtD(stmtFrom)} – ${fmtD(stmtTo)}</div></div><div style="flex:1"><div style="font-size:9px;text-transform:uppercase;color:#999;letter-spacing:1px;font-weight:600">Generated On</div><div style="font-size:14px;font-weight:600;color:#333;margin-top:3px">${genDate}</div></div></div><div style="padding:24px 36px 20px"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#c0392b;margin-bottom:14px">Card Summary</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px"><div style="background:#fdf4f4;border:1px solid #f5c6cb;border-radius:6px;padding:14px 16px;text-align:center"><div style="font-size:9px;text-transform:uppercase;color:#999;letter-spacing:.8px;font-weight:600">Total Spent</div><div style="font-size:18px;font-weight:700;color:#c0392b;margin-top:6px;font-family:monospace">${f(total)}</div></div><div style="background:#fef9f3;border:1px solid #f5e6d3;border-radius:6px;padding:14px 16px;text-align:center"><div style="font-size:9px;text-transform:uppercase;color:#999;letter-spacing:.8px;font-weight:600">Credit Limit</div><div style="font-size:18px;font-weight:700;color:#333;margin-top:6px;font-family:monospace">${f(viewingCard.credit_limit)}</div></div><div style="background:#fdf4f4;border:1px solid #f5c6cb;border-radius:6px;padding:14px 16px;text-align:center"><div style="font-size:9px;text-transform:uppercase;color:#999;letter-spacing:.8px;font-weight:600">Outstanding</div><div style="font-size:18px;font-weight:700;color:#c0392b;margin-top:6px;font-family:monospace">${f(viewingCard.outstanding)}</div></div></div></div><div style="padding:0 36px 28px"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#c0392b"><th style="padding:10px 14px;text-align:left;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;width:72px">Date</th><th style="padding:10px 14px;text-align:left;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Description</th><th style="padding:10px 14px;text-align:right;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;width:140px">Amount</th></tr></thead><tbody>${txRows}<tr style="background:#fdf6e3;border-top:2px solid #e8d5a3"><td colspan="2" style="padding:14px 14px;color:#8a6d3b;font-weight:700;font-size:14px">Total</td><td style="padding:14px 14px;text-align:right;font-weight:700;color:#c0392b;font-size:18px;font-family:monospace">${f(total)}</td></tr></tbody></table></div><div style="background:#f5f6f8;padding:16px 36px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e8e8e8"><div><span style="font-weight:700;color:#c0392b;font-size:13px">${viewingCard.name}</span><span style="color:#999;font-size:11px;margin-left:8px">— Computer-generated statement.</span></div><div style="color:#aaa;font-size:10px;font-family:monospace">Printed: ${genDate}</div></div></div></body></html>`;
    const win = window.open('','_blank');
    win.document.write(html); win.document.close(); win.focus();
    setTimeout(() => win.print(), 400);
  }

  $: stmtTotal      = stmtTxs.reduce((s,t) => s + Number(t.amount), 0);
  $: stmtByCategory = (() => {
    const m = {};
    stmtTxs.forEach(t => { const c = t.category||'Other'; m[c]=(m[c]||0)+Number(t.amount); });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  })();
</script>

<!-- ── CARD STATEMENT VIEW ── -->
{#if viewingCard}
  <div class="fade-in space">
    <div class="stmt-header glass">
      <button class="back-btn" on:click={closeStatement}>← Back to Cards</button>
      <div class="stmt-title-row">
        <div>
          <p class="stmt-card-name">💳 {viewingCard.name}</p>
          <p class="stmt-subtitle">Card Statement</p>
        </div>
        <div class="stmt-right">
          <p class="stmt-label">Outstanding</p>
          <p class="stmt-balance mono neg">{fmt(viewingCard.outstanding)}</p>
        </div>
      </div>
      <div class="date-range">
        <div>
          <label for="stmt-from">From</label>
          <input id="stmt-from" class="input-field" type="date" bind:value={stmtFrom} on:change={loadStmt}>
        </div>
        <div class="date-sep">→</div>
        <div>
          <label for="stmt-to">To</label>
          <input id="stmt-to" class="input-field" type="date" bind:value={stmtTo} on:change={loadStmt}>
        </div>
        <button class="btn-secondary sm" on:click={loadStmt}>Apply</button>
        <button class="btn-secondary sm" on:click={downloadCSV}>⬇ CSV</button>
        <button class="btn-primary sm" on:click={printStatement}>🖨 Print Statement</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card glass card-red">
        <p class="stat-label">Total Spent</p>
        <p class="stat-val mono neg">{fmt(stmtTotal)}</p>
        <p class="stat-sub">{stmtTxs.length} transaction{stmtTxs.length!==1?'s':''}</p>
      </div>
      <div class="stat-card glass card-purple">
        <p class="stat-label">Credit Limit</p>
        <p class="stat-val mono">{fmt(viewingCard.credit_limit)}</p>
        <p class="stat-sub">available limit</p>
      </div>
      <div class="stat-card glass card-orange">
        <p class="stat-label">Outstanding</p>
        <p class="stat-val mono neg">{fmt(viewingCard.outstanding)}</p>
        <p class="stat-sub">current balance</p>
      </div>
      <div class="stat-card glass card-green">
        <p class="stat-label">Utilisation</p>
        <p class="stat-val mono">{viewingCard.credit_limit > 0 ? Math.round((viewingCard.outstanding/viewingCard.credit_limit)*100) : 0}%</p>
        <p class="stat-sub">of limit used</p>
      </div>
    </div>

    {#if stmtByCategory.length > 0}
      <div class="glass cat-card">
        <p class="section-label">SPENDING BY CATEGORY</p>
        <div class="cat-list">
          {#each stmtByCategory as [cat, amt]}
            <div class="cat-row">
              <span class="cat-name">{cat}</span>
              <div class="cat-bar-wrap"><div class="cat-bar" style="width:{stmtByCategory.length ? (amt/stmtByCategory[0][1])*100 : 0}%"></div></div>
              <span class="cat-val mono neg">{fmt(amt)}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

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
            <thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="right">Amount</th></tr></thead>
            <tbody>
              {#each stmtTxs as tx}
                <tr>
                  <td class="sm">{tx.date?.slice(0,10)}</td>
                  <td>{tx.description||'-'}</td>
                  <td><span class="badge expense">{tx.category||'-'}</span></td>
                  <td class="right mono neg sm fw">{fmt(tx.amount)}</td>
                </tr>
              {/each}
            </tbody>
            <tfoot>
              <tr class="totals-row">
                <td colspan="3" class="fw">Total</td>
                <td class="right mono neg fw">{fmt(stmtTotal)}</td>
              </tr>
            </tfoot>
          </table>
        {/if}
      </div>
    </div>
  </div>

<!-- ── CARDS LIST VIEW ── -->
{:else}
  <div class="fade-in space">
    <div class="page-hdr">
      <p class="count">{cards.length} card{cards.length!==1?'s':''}</p>
      <div class="btn-row">
        <button class="btn-primary" on:click={() => showAddCard=true}>+ Add Card</button>
        {#if cards.length > 0}
          <button class="btn-secondary" on:click={() => showAddTx=true}>Add Transaction</button>
        {/if}
      </div>
    </div>

    <div class="card-grid">
      {#each cards as card}
        <div class="cc-card">
          <!-- Card header: icon, name, View Statement, Delete -->
          <div class="cc-top">
            <span class="cc-icon">💳</span>
            <span class="cc-name">{card.name}</span>
            <div class="cc-top-actions">
              <button class="stmt-btn-sm" on:click={() => openStatement(card)} title="View Statement">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </button>
              <button class="icon-btn-cc" on:click={() => deleteCard(card.id)} title="Delete">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </button>
            </div>
          </div>

          <div class="cc-body">
            <!-- Outstanding balance — big red text -->
            <div class="cc-outstanding-row">
              <span class="cc-label">Outstanding Balance</span>
              <span class="cc-outstanding-amt" class:cc-paid={card.outstanding <= 0}>
                {card.outstanding > 0 ? fmt(card.outstanding) : '✓ Fully Paid'}
              </span>
            </div>

            <!-- Partial payment input -->
            {#if card.outstanding > 0}
              <div class="cc-pay-row">
                <input
                  class="input-field sm-input"
                  type="number" step="0.01" min="0.01"
                  placeholder="Enter amount paid…"
                  bind:value={paymentInputs[card.id]}
                  on:keydown={e => e.key==='Enter' && payPartial(card)}
                >
                <button class="pay-btn" on:click={() => payPartial(card)}>Pay</button>
              </div>

              <!-- Action buttons -->
              <div class="cc-action-row">
                <button class="cc-action-btn cc-action-paid" on:click={() => markPaid(card)}>
                  ✓ Mark as Fully Paid
                </button>
              </div>
            {/if}

            <!-- Credit limit + progress -->
            <div class="cc-limit-row">
              <span class="cc-label">Credit Limit</span>
              <span class="mono fw">{fmt(card.credit_limit)}</span>
            </div>
            <div class="progress-wrap">
              <div class="progress-bar" style="width:{Math.min((card.outstanding/card.credit_limit)*100,100)}%;background:{card.outstanding/card.credit_limit>.8?'var(--danger)':'var(--accent)'}"></div>
            </div>
            <p class="cc-used">{fmt(card.outstanding)} / {fmt(card.credit_limit)}</p>
          </div>
        </div>
      {:else}
        {#if !loading}
          <div class="glass empty-state col-span">No credit cards yet</div>
        {/if}
      {/each}
    </div>

    {#if cards.length > 0}
      <div class="glass table-section">
        <div class="section-hdr"><h3>Card Transactions</h3></div>
        <div class="filters">
          <div class="filter-grid">
            <div>
              <label for="cc-search">Search</label>
              <input id="cc-search" class="input-field" bind:value={search} on:input={loadTxs} placeholder="Search…">
            </div>
            <div>
              <label for="cc-card">Card</label>
              <select id="cc-card" class="input-field" bind:value={filterCard} on:change={loadTxs}>
                <option value="">All Cards</option>
                {#each cards as c}<option value={c.id}>{c.name}</option>{/each}
              </select>
            </div>
            <div>
              <label for="cc-from">From</label>
              <input id="cc-from" class="input-field" type="date" bind:value={dateFrom} on:change={loadTxs}>
            </div>
            <div>
              <label for="cc-to">To</label>
              <input id="cc-to" class="input-field" type="date" bind:value={dateTo} on:change={loadTxs}>
            </div>
            <div>
              <label for="cc-sort">Sort</label>
              <select id="cc-sort" class="input-field" bind:value={sort} on:change={loadTxs}>
                <option value="date-desc">Latest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="amount-desc">Highest Amount</option>
                <option value="amount-asc">Lowest Amount</option>
              </select>
            </div>
          </div>
        </div>
        <div class="tscroll">
          <table>
            <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Card</th><th class="right">Amount</th><th></th></tr></thead>
            <tbody>
              {#if ccTxs.length === 0}
                <tr><td colspan="6" class="empty">No transactions yet</td></tr>
              {:else}
                {#each ccTxs as tx}
                  <tr>
                    <td class="sm">{tx.date?.slice(0,10)}</td>
                    <td>{tx.description||'-'}</td>
                    <td><span class="badge expense">{tx.category||'-'}</span></td>
                    <td class="sm">{tx.card_name||'-'}</td>
                    <td class="right mono fw neg">{fmt(tx.amount)}</td>
                    <td><button class="icon-btn" on:click={() => deleteTx(tx.id)}><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button></td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    {#if history.length > 0}
      <div class="glass table-section">
        <div class="section-hdr"><h3>Payment History</h3></div>
        <div class="tscroll">
          <table>
            <thead><tr><th>Card</th><th>Outstanding</th><th>Paid</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {#each history as h}
                <tr>
                  <td class="fw">{h.card_name}</td>
                  <td class="mono neg">{fmt(h.outstanding_amount)}</td>
                  <td class="mono pos">{fmt(h.amount_paid)}</td>
                  <td class="sm">{h.payment_date?.slice(0,10)}</td>
                  <td><button class="icon-btn" on:click={() => deleteHistory(h.id)}><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </div>
{/if}

<!-- Add Card Modal -->
<Modal title="Add Credit Card" bind:show={showAddCard} onClose={() => showAddCard=false}>
  <div class="form-group"><label for="card-name">Card Name</label><input id="card-name" class="input-field" placeholder="Visa Gold" bind:value={fCardName}></div>
  <div class="form-group"><label for="card-limit">Credit Limit</label><input id="card-limit" class="input-field" type="number" step="0.01" placeholder="5000" bind:value={fLimit}></div>
  <div class="form-group"><label for="card-out">Current Outstanding</label><input id="card-out" class="input-field" type="number" step="0.01" placeholder="0" bind:value={fOutstanding}></div>
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showAddCard=false}>Cancel</button>
    <button class="btn-primary" on:click={addCard}>Add Card</button>
  </div>
</Modal>

<!-- Add Transaction Modal -->
<Modal title="Add Card Transaction" bind:show={showAddTx} onClose={() => showAddTx=false}>
  <div class="form-group"><label for="tx-card">Card</label>
    <select id="tx-card" class="input-field" bind:value={fTxCard}>
      {#each cards as c}<option value={c.id}>{c.name}</option>{/each}
    </select>
  </div>
  <div class="form-group"><label for="tx-amount">Amount</label><input id="tx-amount" class="input-field" type="number" step="0.01" placeholder="0.00" bind:value={fTxAmount}></div>
  <div class="form-group"><label for="tx-desc">Description</label><input id="tx-desc" class="input-field" placeholder="Online purchase" bind:value={fTxDesc}></div>
  <div class="form-row">
    <div class="form-group"><label for="tx-cat">Category</label>
      <select id="tx-cat" class="input-field" bind:value={fTxCat}>{#each CATEGORIES as c}<option>{c}</option>{/each}</select>
    </div>
    <div class="form-group"><label for="tx-date">Date</label>
      <input id="tx-date" class="input-field" type="date" bind:value={fTxDate}>
    </div>
  </div>
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showAddTx=false}>Cancel</button>
    <button class="btn-primary" on:click={addTx}>Add</button>
  </div>
</Modal>

<style>
  .space{display:flex;flex-direction:column;gap:16px;}
  .page-hdr{display:flex;align-items:center;justify-content:space-between;}
  .count{font-size:14px;color:var(--text2);}
  .btn-row{display:flex;gap:8px;}
  .muted{font-size:13px;color:var(--text2);}

  /* Statement */
  .stmt-header{padding:20px 24px;}
  .back-btn{background:none;border:none;cursor:pointer;color:var(--accent);font-size:13px;margin-bottom:12px;padding:0;}
  .stmt-title-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;}
  .stmt-card-name{font-size:18px;font-weight:700;}
  .stmt-subtitle{font-size:12px;color:var(--text2);margin-top:2px;}
  .stmt-right{text-align:right;}
  .stmt-label{font-size:11px;color:var(--text2);}
  .stmt-balance{font-size:22px;font-weight:700;}
  .date-range{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;}
  .date-range>div{display:flex;flex-direction:column;gap:4px;}
  .date-sep{color:var(--text2);padding-bottom:10px;}
  .sm{font-size:12px;padding:6px 12px;}

  /* Stat cards */
  .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
  @media(max-width:900px){.stat-grid{grid-template-columns:repeat(2,1fr);}}
  .stat-card{padding:16px;border-radius:12px;position:relative;overflow:hidden;}
  .stat-card::before{content:'';position:absolute;top:0;right:0;width:60px;height:60px;border-radius:50%;filter:blur(30px);opacity:.2;}
  .card-green::before{background:var(--accent);}
  .card-orange::before{background:var(--warning);}
  .card-red::before{background:var(--danger);}
  .card-purple::before{background:var(--accent2);}
  .stat-label{font-size:11px;color:var(--text2);margin-bottom:6px;}
  .stat-val{font-size:20px;font-weight:700;}
  .stat-sub{font-size:11px;color:var(--text2);margin-top:4px;}

  .cat-card{padding:20px;}
  .section-label{font-size:11px;font-weight:600;color:var(--text2);letter-spacing:.05em;margin-bottom:12px;}
  .cat-list{display:flex;flex-direction:column;gap:8px;}
  .cat-row{display:flex;align-items:center;gap:10px;font-size:12px;}
  .cat-name{width:90px;flex-shrink:0;color:var(--text2);}
  .cat-bar-wrap{flex:1;height:6px;background:var(--surface2);border-radius:3px;overflow:hidden;}
  .cat-bar{height:100%;background:var(--accent2);border-radius:3px;}
  .cat-val{width:90px;text-align:right;}

  .table-wrap{overflow:hidden;}
  .table-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);}
  .tscroll{overflow-x:auto;}
  table{width:100%;border-collapse:collapse;font-size:13px;}
  th{text-align:left;padding:10px 14px;font-size:11px;font-weight:600;color:var(--text2);border-bottom:1px solid var(--border);}
  td{padding:10px 14px;border-bottom:1px solid var(--border);}
  tfoot td{padding:12px 14px;border-top:2px solid var(--border);border-bottom:none;}
  .totals-row{background:rgba(255,92,124,.05);}
  .right{text-align:right;}
  .fw{font-weight:600;}
  .pos{color:var(--accent);}
  .neg{color:var(--danger);}
  .mono{font-family:'Space Mono',monospace;}
  .empty{text-align:center;color:var(--text2);padding:32px;}

  /* Card tiles */
  .card-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
  @media(max-width:900px){.card-grid{grid-template-columns:repeat(2,1fr);}}
  @media(max-width:600px){.card-grid{grid-template-columns:1fr;}}
  .cc-card{padding:20px;border-radius:12px;background:linear-gradient(135deg,#1a1a3e,#2d1b69);border:1px solid rgba(124,92,252,.3);}
  .cc-top{display:flex;align-items:center;gap:8px;margin-bottom:14px;}
  .cc-top-actions{display:flex;gap:4px;margin-left:auto;}
  .stmt-btn-sm{background:rgba(124,92,252,.15);border:1px solid rgba(124,92,252,.3);color:#b39dff;width:28px;height:28px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;}
  .stmt-btn-sm:hover{background:rgba(124,92,252,.3);}
  .icon-btn-cc{background:none;border:none;color:rgba(255,255,255,.5);width:28px;height:28px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;}
  .icon-btn-cc:hover{background:rgba(255,92,124,.15);color:var(--danger);}
  .cc-icon{font-size:20px;}
  .cc-name{font-weight:600;font-size:14px;flex:1;}
  .cc-body{display:flex;flex-direction:column;gap:10px;}
  .cc-outstanding-row{display:flex;justify-content:space-between;align-items:center;}
  .cc-outstanding-amt{font-size:20px;font-weight:800;color:var(--danger);font-family:'Space Mono',monospace;}
  .cc-outstanding-amt.cc-paid{color:var(--accent);font-size:16px;}
  .cc-pay-row{display:flex;gap:8px;}
  .pay-btn{background:rgba(0,229,160,.15);border:1px solid rgba(0,229,160,.3);color:var(--accent);padding:6px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;transition:background .15s;}
  .pay-btn:hover{background:rgba(0,229,160,.3);}
  .cc-action-row{display:flex;gap:8px;}
  .cc-action-btn{flex:1;padding:7px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;border:1px solid transparent;transition:all .15s;}
  .cc-action-paid{background:rgba(0,229,160,.1);border-color:rgba(0,229,160,.3);color:var(--accent);}
  .cc-action-paid:hover{background:rgba(0,229,160,.25);}
  .cc-label{font-size:11px;color:rgba(255,255,255,.5);}
  .cc-limit-row{display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid rgba(255,255,255,.1);}
  .progress-wrap{height:4px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden;}
  .progress-bar{height:100%;border-radius:2px;transition:width .3s;}
  .cc-used{font-size:11px;color:rgba(255,255,255,.4);}
  .empty-state{padding:48px;text-align:center;color:var(--text2);}
  .col-span{grid-column:1/-1;}
  .table-section{overflow:hidden;}
  .section-hdr{padding:16px;border-bottom:1px solid var(--border);}
  .section-hdr h3{font-size:14px;font-weight:600;}
  .filters{padding:16px;border-bottom:1px solid var(--border);}
  .filter-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;}
  @media(max-width:1000px){.filter-grid{grid-template-columns:repeat(3,1fr);}}
  @media(max-width:700px){.filter-grid{grid-template-columns:repeat(2,1fr);}}
  .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;}
  .badge.expense{background:rgba(255,92,124,.15);color:var(--danger);}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .form-group{margin-bottom:14px;}
  .modal-actions{display:flex;gap:8px;margin-top:20px;}
</style>
