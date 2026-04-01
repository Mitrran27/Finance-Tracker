<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { showToast } from '$lib/stores.js';
  import Modal from '$lib/components/Modal.svelte';

  // ── Today: always use LOCAL date, never UTC ──────────────────────────────
  // toISOString() returns UTC which breaks Malaysia time (UTC+8).
  // This computes the local YYYY-MM-DD correctly.
  function getToday() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Reactive today — recalculated on every render tick so it never gets stale
  // even if the page is left open overnight
  $: todayStr = getToday();

  // ── Event colour palette ─────────────────────────────────────────────────
  const EVENT_COLORS = [
    '#7c5cfc','#ff5c7c','#ffb347',
    '#4ecdc4','#45b7d1','#ff9ff3','#54a0ff','#f9ca24',
  ];
  // Green is reserved for "today" circle only
  const TODAY_COLOR = '#00e5a0';

  // ── State ────────────────────────────────────────────────────────────────
  let events = [], notes = [], loading = true;
  let showAdd = false;
  let fTitle = '', fDate = '';

  // Current year — updated reactively so it always reflects the real year
  $: currentYear = new Date().getFullYear();
  $: selectedMonth = todayStr.slice(0, 7);
  let _selectedMonth = '';    // writable copy for the month picker
  $: { _selectedMonth = todayStr.slice(0, 7); }

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const weekDays   = ['M','T','W','T','F','S','S'];

  // Reminder emails loaded from settings
  let reminderEmails = [];   // full list: [loginEmail, ...extras]
  let fEmail = '';           // selected email for new event (defaults to first in list)

  onMount(async () => {
    _selectedMonth = getToday().slice(0, 7);
    await loadReminderEmails();
    await load();
  });

  async function loadReminderEmails() {
    try {
      const res = await api.get('/settings/reminder-emails');
      reminderEmails = res.all || [];
      fEmail = reminderEmails[0] || '';
    } catch(e) {
      reminderEmails = [];
    }
  }

  async function load() {
    loading = true;
    try {
      [events, notes] = await Promise.all([
        api.get('/events'),
        api.get('/notes'),
      ]);
    }
    catch(e) { showToast(e.message, 'error'); }
    finally { loading = false; }
  }

  async function addEvent() {
    if (!fTitle || !fDate) return showToast('Title and date required', 'error');
    try {
      await api.post('/events', { title: fTitle, date: fDate, reminder_email: fEmail || null });
      showToast('Event added!');
      showAdd = false; fTitle = ''; fEmail = reminderEmails[0] || '';
      load();
    } catch(e) { showToast(e.message, 'error'); }
  }

  async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    try { await api.delete(`/events/${id}`); showToast('Deleted!'); load(); }
    catch(e) { showToast(e.message, 'error'); }
  }

  // Click a day — pre-fill date and open modal
  function clickDay(fullDate) {
    fDate  = fullDate;
    fTitle = '';
    fEmail = reminderEmails[0] || '';
    _selectedMonth = fullDate.slice(0, 7);
    showAdd = true;
  }

  // ── Calendar helpers ─────────────────────────────────────────────────────
  function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }

  // First day of month offset — Mon=0 … Sun=6
  function getFirstDayMon(y, m) {
    const d = new Date(y, m, 1).getDay(); // 0=Sun
    return (d + 6) % 7;
  }

  function normalizeDate(d) { return d ? String(d).slice(0, 10) : ''; }

  function parseLocalDate(d) {
    const s = normalizeDate(d);
    if (!s) return null;
    const [y, mo, day] = s.split('-').map(Number);
    return new Date(y, mo - 1, day);
  }

  function formatMonth(d) { return parseLocalDate(d)?.toLocaleString('en', { month: 'short' }) ?? ''; }
  function formatDay(d)   { return parseLocalDate(d)?.getDate() ?? ''; }

  function daysUntil(d) {
    const ev = parseLocalDate(d);
    const td = parseLocalDate(todayStr);
    if (!ev || !td) return 0;
    return Math.ceil((ev - td) / 86400000);
  }

  // Events + notes keyed by YYYY-MM-DD → array of items
  $: eventsByDate = (() => {
    const map = {};
    events.forEach((ev, idx) => {
      const d = normalizeDate(ev.date);
      if (!d) return;
      if (!map[d]) map[d] = [];
      map[d].push({ ...ev, colorIdx: idx % EVENT_COLORS.length, itemType: 'event' });
    });
    // Add notes with due dates — use fixed purple color to distinguish
    notes.filter(n => n.date && !n.completed).forEach((n, idx) => {
      const d = normalizeDate(n.date);
      if (!d) return;
      if (!map[d]) map[d] = [];
      map[d].push({ ...n, title: n.text, colorIdx: (events.length + idx) % EVENT_COLORS.length, itemType: 'note' });
    });
    return map;
  })();

  // Notes for selected month panel
  $: selectedMonthNotes = notes
    .filter(n => n.date && normalizeDate(n.date).startsWith(_selectedMonth) && !n.completed)
    .sort((a,b) => normalizeDate(a.date).localeCompare(normalizeDate(b.date)));

  $: selectedMonthEvents = events
    .filter(e => normalizeDate(e.date).startsWith(_selectedMonth))
    .sort((a, b) => normalizeDate(a.date).localeCompare(normalizeDate(b.date)));

  $: upcoming = selectedMonthEvents.filter(e => normalizeDate(e.date) >= todayStr);
  $: past     = selectedMonthEvents.filter(e => normalizeDate(e.date) <  todayStr);

  function evColor(ev) {
    return EVENT_COLORS[events.indexOf(ev) % EVENT_COLORS.length];
  }
</script>

<div class="fade-in layout">

  <!-- ── CALENDAR COLUMN ── -->
  <div class="cal-col">
    <div class="month-grid">
      {#each monthNames as monthLabel, m}
        <div class="glass month-card">
          <p class="month-name">{monthLabel} {currentYear}</p>

          <div class="day-grid">
            <!-- Weekday headers -->
            {#each weekDays as wd}
              <div class="wd-label">{wd}</div>
            {/each}

            <!-- Offset empty cells -->
            {#each {length: getFirstDayMon(currentYear, m)} as _}
              <div></div>
            {/each}

            <!-- Day cells -->
            {#each {length: getDaysInMonth(currentYear, m)} as _, d}
              {@const fullDate = `${currentYear}-${String(m+1).padStart(2,'0')}-${String(d+1).padStart(2,'0')}`}
              {@const isToday  = fullDate === todayStr}
              {@const dayEvs   = eventsByDate[fullDate] || []}
              {@const hasEvs   = dayEvs.length > 0}

              <div
                class="day-cell"
                role="button"
                tabindex="0"
                title={hasEvs ? dayEvs.map(e=>e.title).join(', ') : ''}
                on:click={() => clickDay(fullDate)}
                on:keydown={e => e.key === 'Enter' && clickDay(fullDate)}
              >
                <!--
                  VISUAL RULES:
                  • Today, no event   → green circle only
                  • Today + event     → green circle + coloured bar(s) below
                  • Event, not today  → coloured bar(s) only, no circle
                  • Plain day         → just the number
                -->
                <span
                  class="day-num"
                  class:today-circle={isToday}
                >{d + 1}</span>

                {#if hasEvs}
                  <div class="event-bars">
                    {#each dayEvs.slice(0, 3) as ev}
                      <div
                        class="event-bar"
                        style="background:{EVENT_COLORS[ev.colorIdx]}"
                      ></div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <button
      class="btn-primary add-btn"
      on:click={() => { fDate = getToday(); fTitle = ''; fEmail = reminderEmails[0] || ''; showAdd = true; }}
    >
      + Add Event
    </button>
  </div>

  <!-- ── EVENTS PANEL ── -->
  <div class="events-col">
    <div class="form-group">
      <label for="sel-month">Selected Month</label>
      <input id="sel-month" class="input-field" type="month" bind:value={_selectedMonth}>
    </div>

    {#if upcoming.length > 0}
      <div>
        <p class="section-label accent-label">UPCOMING</p>
        <div class="ev-list">
          {#each upcoming as ev}
            <div class="glass2 ev-card">
              <div class="ev-stripe" style="background:{evColor(ev)}"></div>
              <div class="ev-date">
                <span class="ev-mon">{formatMonth(ev.date)}</span>
                <span class="ev-day">{formatDay(ev.date)}</span>
              </div>
              <div class="ev-info">
                <p class="ev-title">{ev.title}</p>
                <p class="ev-sub">
                  {#if daysUntil(ev.date) === 0}Today
                  {:else if daysUntil(ev.date) === 1}Tomorrow
                  {:else}In {daysUntil(ev.date)} days{/if}
                  {#if ev.reminder_email} · 📧 {ev.reminder_email}{/if}
                </p>
              </div>
              <button class="icon-btn" on:click={() => deleteEvent(ev.id)}><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if past.length > 0}
      <div>
        <p class="section-label">PAST</p>
        <div class="ev-list">
          {#each past as ev}
            <div class="glass2 ev-card past">
              <div class="ev-stripe" style="background:{evColor(ev)};opacity:.4"></div>
              <div class="ev-date">
                <span class="ev-mon">{formatMonth(ev.date)}</span>
                <span class="ev-day">{formatDay(ev.date)}</span>
              </div>
              <div class="ev-info">
                <p class="ev-title">{ev.title}</p>
                <p class="ev-sub">Past event</p>
              </div>
              <button class="icon-btn" on:click={() => deleteEvent(ev.id)}><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if selectedMonthNotes.length > 0}
      <div>
        <p class="section-label note-label">📝 NOTES DUE</p>
        <div class="ev-list">
          {#each selectedMonthNotes as note}
            <div class="glass2 ev-card note-card-cal">
              <div class="ev-stripe" style="background:#ff9ff3"></div>
              <div class="ev-date">
                <span class="ev-mon">{formatMonth(note.date)}</span>
                <span class="ev-day">{formatDay(note.date)}</span>
              </div>
              <div class="ev-info">
                <p class="ev-title">{note.text}</p>
                <p class="ev-sub">📝 Note due date</p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if selectedMonthEvents.length === 0 && selectedMonthNotes.length === 0}
      <div class="glass empty-state">
        <p>No events or notes this month</p>
        <p class="empty-hint">Click any date on the calendar to add one</p>
      </div>
    {/if}
  </div>
</div>

<!-- Add Event Modal -->
<Modal title="Add Event" bind:show={showAdd} onClose={() => showAdd = false}>
  <div class="form-group">
    <label for="ev-title">Event Title</label>
    <input id="ev-title" class="input-field" placeholder="Doctor appointment" bind:value={fTitle} autofocus>
  </div>
  <div class="form-group">
    <label for="ev-date">Date</label>
    <input id="ev-date" class="input-field" type="date" bind:value={fDate}>
  </div>
  <div class="form-group">
    <label for="ev-email">Send Reminder To</label>
    {#if reminderEmails.length > 0}
      <select id="ev-email" class="input-field" bind:value={fEmail}>
        {#each reminderEmails as email, i}
          <option value={email}>{email}{i === 0 ? ' (login email)' : ''}</option>
        {/each}
      </select>
      <p class="modal-hint">Manage reminder emails in <strong>Settings → Reminder Emails</strong></p>
    {:else}
      <input id="ev-email" class="input-field" type="email" placeholder="you@email.com" bind:value={fEmail}>
      <p class="modal-hint">Or add more addresses in Settings → Reminder Emails</p>
    {/if}
  </div>
  <p style="font-size:12px;color:var(--text2);margin-bottom:16px;">
    Reminders are sent 1 day, 3 days, and 1 week before the event.
  </p>
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showAdd = false}>Cancel</button>
    <button class="btn-primary" on:click={addEvent}>Add Event</button>
  </div>
</Modal>

<style>
  /* ── Layout ── */
  .layout { display:grid; grid-template-columns:2fr 1fr; gap:24px; align-items:start; }
  @media(max-width:900px){ .layout { grid-template-columns:1fr; } }

  .cal-col    { display:flex; flex-direction:column; gap:12px; }
  .month-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
  @media(max-width:700px){ .month-grid { grid-template-columns:repeat(2,1fr); } }

  /* ── Month card ── */
  .month-card { padding:10px; }
  .month-name {
    font-size:11px; font-weight:600; text-align:center;
    margin-bottom:6px; color:var(--text2);
  }

  /* ── Day grid ── */
  .day-grid {
    display:grid;
    grid-template-columns:repeat(7, 1fr);
    gap:1px;
  }

  .wd-label {
    font-size:8px; font-weight:600; letter-spacing:.3px;
    text-align:center; color:var(--text2);
    padding-bottom:4px;
  }

  /* ── Day cell ── */
  .day-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    border-radius: 4px;
    padding: 2px 1px 3px;
    transition: background .1s;
    min-height: 30px;
  }
  .day-cell:hover { background: var(--surface2); }

  /* ── Day number ── */
  .day-num {
    font-size: 10px;
    font-weight: 400;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    line-height: 1;
    color: var(--text);
    transition: background .15s, color .15s;
  }

  /* TODAY — green circle, dark text, always visible */
  .day-num.today-circle {
    background: #00e5a0;
    color: #0a0e17;
    font-weight: 700;
  }

  /* ── Event bars below the number ── */
  /*
    Rules:
    - today + events   → green circle (above) + coloured bar(s) below
    - event, not today → coloured bar(s) below, no circle
    - today, no event  → green circle only
    - plain            → just number
    The bars are never green (#00e5a0) — palette excludes it.
  */
  .event-bars {
    display: flex;
    gap: 2px;
    margin-top: 2px;
    justify-content: center;
    max-width: 100%;
  }
  .event-bar {
    height: 3px;
    width: 10px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .add-btn { width:100%; justify-content:center; }

  /* ── Events panel ── */
  .events-col { display:flex; flex-direction:column; gap:12px; }
  .section-label {
    font-size:11px; font-weight:600; color:var(--text2);
    margin-bottom:6px; letter-spacing:.05em;
  }
  .accent-label { color: var(--accent) !important; }
  .ev-list { display:flex; flex-direction:column; gap:8px; }

  .ev-card { padding:0; display:flex; align-items:stretch; overflow:hidden; }
  .ev-card.past { opacity:.6; }

  .ev-stripe { width:4px; flex-shrink:0; border-radius:2px 0 0 2px; }

  .ev-date {
    text-align:center; flex-shrink:0; min-width:44px;
    padding:12px 8px;
    display:flex; flex-direction:column; justify-content:center;
  }
  .ev-mon { display:block; font-size:10px; color:var(--text2); text-transform:uppercase; }
  .ev-day { display:block; font-size:22px; font-weight:700; line-height:1; }

  .ev-info {
    flex:1; min-width:0; padding:12px 8px;
    display:flex; flex-direction:column; justify-content:center;
  }
  .ev-title { font-size:13px; font-weight:600; }
  .ev-sub   { font-size:11px; color:var(--text2); margin-top:2px; }

  .icon-btn {
    background:none; border:none; cursor:pointer;
    font-size:13px; opacity:.6; padding:12px 10px;
  }
  .icon-btn:hover { opacity:1; }

  .empty-state { padding:32px; text-align:center; color:var(--text2); font-size:13px; }
  .empty-hint  { font-size:11px; color:var(--text2); margin-top:6px; opacity:.7; }

  .form-group    { margin-bottom:14px; }
  .modal-actions { display:flex; gap:8px; margin-top:20px; }
  .modal-hint    { font-size:11px; color:var(--text2); margin-top:5px; }
  .note-label    { color:#ff9ff3 !important; }
  .note-card-cal { opacity:.9; }
</style>
