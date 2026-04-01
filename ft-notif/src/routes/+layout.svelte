<script>
  import '../app.css';
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { user } from '$lib/stores.js';
  import { api } from '$lib/api.js';
  import Toast from '$lib/components/Toast.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';

  let ready = false;
  const publicRoutes = ['/auth'];

  // ── Fun loading messages ──────────────────────────────────────────────────
  const loadingTexts = [
    "🍔 Flipping data patties for burgers...",
    "🍕 Heating up data pizzas...",
    "🍦 Scooping data ice creams...",
    "🥤 Shaking data milkshakes...",
    "🍟 Frying up hashed data...",
    "☕️ Brewing fresh data coffee beans...",
  ];
  let loadingText = loadingTexts[Math.floor(Math.random() * loadingTexts.length)];

  // ── Live clock ────────────────────────────────────────────────────────────
  let now = new Date();
  let clockInterval;
  let notifInterval;

  // ── Unread notifications count ────────────────────────────────────────────
  let unreadCount = 0;

  async function fetchUnread() {
    if (!$user) return;
    try {
      const notifs = await api.get('/notifications');
      unreadCount = notifs.filter(n => !n.is_read).length;
    } catch { /* silently ignore */ }
  }

  onMount(async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const data = await api.get('/auth/me');
        user.set(data.user);
      } catch {
        localStorage.removeItem('token');
        user.set(null);
      }
    }
    ready = true;

    // Clock ticks every second
    clockInterval = setInterval(() => { now = new Date(); }, 1000);

    // Poll unread count every 30 seconds
    await fetchUnread();
    notifInterval = setInterval(fetchUnread, 30000);
  });

  // Re-fetch when navigating away from /notifications (user may have read them)
  $: if ($page.url.pathname !== '/notifications') fetchUnread();

  onDestroy(() => {
    if (clockInterval) clearInterval(clockInterval);
    if (notifInterval) clearInterval(notifInterval);
  });

  // Format: 11:40:23  23/03/2025  Mon
  $: timeStr = now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false });
  $: dateStr = now.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' });
  $: dayStr  = now.toLocaleDateString('en-GB', { weekday:'short' });

  $: isPublic = publicRoutes.includes($page.url.pathname);
  $: if (ready && !$user && !isPublic) goto('/auth');
  $: if (ready && $user && isPublic) goto('/');

  const pageTitles = {
    '/':             'Overview',
    '/banks':        'Bank Accounts',
    '/transactions': 'Transactions',
    '/credit':       'Credit Cards',
    '/drive':        'Drive',
    '/calendar':     'Calendar',
    '/notes':        'Notes',
    '/settings':     'Settings',
    '/notifications':'Notifications',
    '/goals':        'Savings Goals',
  };
  $: title = pageTitles[$page.url.pathname] || 'Finance Tracker';
</script>

<Toast />

{#if !ready}
  <div class="loading-screen">
    <div class="loading-fun">
      <div class="loading-emoji">{loadingText.split(' ')[0]}</div>
      <p class="loading-msg">{loadingText.slice(loadingText.indexOf(' ')+1)}</p>
      <div class="loading-dots"><span></span><span></span><span></span></div>
    </div>
  </div>
{:else if isPublic}
  <slot />
{:else if $user}
  <div class="app-shell">
    <Sidebar />
    <div class="main-col">
      <header class="topbar">
        <h2 class="page-title">{title}</h2>

        <div class="topbar-right">
          <!-- Live clock -->
          <div class="clock-block">
            <span class="clock-time">{timeStr}</span>
            <span class="clock-sep">·</span>
            <span class="clock-date">{dateStr}</span>
            <span class="clock-day">{dayStr}</span>
          </div>

          <!-- Notification bell with unread badge -->
          <a href="/notifications" class="notif-btn" title="Notifications">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
            </svg>
            {#if unreadCount > 0}
              <span class="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            {/if}
          </a>
        </div>
      </header>
      <main class="page-content">
        <slot />
      </main>
    </div>
  </div>
{/if}

<style>
  .loading-screen {
    height: 100vh; display: flex;
    align-items: center; justify-content: center;
    background: var(--bg);
  }
  .loading-fun {
    display: flex; flex-direction: column; align-items: center; gap: 16px;
  }
  .loading-emoji {
    font-size: 52px;
    animation: bounce 0.8s ease-in-out infinite alternate;
  }
  .loading-msg {
    font-size: 14px; color: var(--text2); font-weight: 500;
    text-align: center; max-width: 260px; line-height: 1.5;
  }
  .loading-dots {
    display: flex; gap: 6px;
  }
  .loading-dots span {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--accent); animation: dot-pulse 1.2s ease-in-out infinite;
  }
  .loading-dots span:nth-child(2) { animation-delay: .2s; }
  .loading-dots span:nth-child(3) { animation-delay: .4s; }
  @keyframes bounce {
    from { transform: translateY(0); }
    to   { transform: translateY(-12px); }
  }
  @keyframes dot-pulse {
    0%, 80%, 100% { opacity: .2; transform: scale(.8); }
    40%           { opacity: 1;  transform: scale(1); }
  }

  .app-shell { display: flex; height: 100vh; width: 100%; overflow: hidden; }
  .main-col  { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

  .topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 24px; border-bottom: 1px solid var(--border);
    background: var(--surface); flex-shrink: 0;
  }
  .page-title { font-size: 18px; font-weight: 700; }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  /* Clock */
  .clock-block {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 6px 14px;
    user-select: none;
  }
  .clock-time {
    font-family: 'Space Mono', monospace;
    font-size: 13px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: .5px;
  }
  .clock-sep  { color: var(--border); font-size: 14px; }
  .clock-date {
    font-family: 'Space Mono', monospace;
    font-size: 12px;
    color: var(--text2);
    letter-spacing: .3px;
  }
  .clock-day {
    font-size: 11px;
    font-weight: 600;
    color: var(--text2);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 1px 6px;
    letter-spacing: .5px;
    text-transform: uppercase;
  }

  /* Notification bell */
  .notif-btn {
    position: relative;
    padding: 8px; border-radius: 8px; color: var(--text2);
    background: none; border: none; cursor: pointer;
    transition: background .2s; display: flex; text-decoration: none;
    align-items: center; justify-content: center;
  }
  .notif-btn:hover { background: var(--surface2); color: var(--text); }

  /* Red unread badge */
  .notif-badge {
    position: absolute;
    top: 2px;
    right: 2px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    background: var(--danger);
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    pointer-events: none;
    box-shadow: 0 0 0 2px var(--surface);
  }

  .page-content { flex: 1; overflow-y: auto; padding: 24px; }
</style>
