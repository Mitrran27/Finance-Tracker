<script>
  import '../app.css';
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { user } from '$lib/stores.js';
  import { api } from '$lib/api.js';
  import Toast from '$lib/components/Toast.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import FunLoader from '$lib/components/FunLoader.svelte';

  let ready = false;
  const publicRoutes = ['/auth'];

  // ── Sidebar: drawer on mobile, collapsible on desktop ─────────────────────
  const MOBILE_QUERY = '(max-width: 900px)';
  let sidebarOpen = false;       // mobile drawer
  let sidebarCollapsed = false;  // desktop

  function toggleSidebar() {
    if (window.matchMedia(MOBILE_QUERY).matches) {
      sidebarOpen = !sidebarOpen;
    } else {
      sidebarCollapsed = !sidebarCollapsed;
      localStorage.setItem('sidebarCollapsed', sidebarCollapsed ? '1' : '0');
    }
  }

  function closeSidebar() { sidebarOpen = false; }

  // Close the drawer after tapping any link/button inside it
  function handleSidebarClick(e) {
    if (e.target.closest('a, button')) closeSidebar();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') closeSidebar();
  }

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
    sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === '1';

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
    '/bills':        'Expenses',
    '/debts':        'Debt',
    '/commitments':  'Commitments',
    '/drive':       'Drive',
    '/calendar':     'Calendar',
    '/notes':        'Notes',
    '/settings':     'Settings',
    '/notifications':'Notifications',
    '/goals':        'Goals',
    '/investments':  'Investments',
  };
  $: title = pageTitles[$page.url.pathname] || 'DuitFlow';
</script>

<svelte:window on:keydown={handleKeydown} />

<Toast />

{#if !ready}
  <FunLoader fullscreen={true} />
{:else if isPublic}
  <slot />
{:else if $user}
  <div class="app-shell" class:collapsed={sidebarCollapsed}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="sidebar-wrap" class:open={sidebarOpen} on:click={handleSidebarClick}>
      <Sidebar />
    </div>
    {#if sidebarOpen}
      <button class="sidebar-backdrop" on:click={closeSidebar} aria-label="Close menu"></button>
    {/if}

    <div class="main-col">
      <header class="topbar">
        <div class="topbar-left">
          <button class="menu-btn" on:click={toggleSidebar} aria-label="Toggle menu" aria-expanded={sidebarOpen}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>
            </svg>
          </button>
          <h2 class="page-title">{title}</h2>
        </div>

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
  .app-shell { display: flex; height: 100vh; height: 100dvh; width: 100%; overflow: hidden; }
  .main-col  { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }

  /* Sidebar container */
  .sidebar-wrap {
    height: 100%; flex-shrink: 0; width: 240px;
    transition: margin-left .25s ease;
  }
  .collapsed .sidebar-wrap { margin-left: -240px; }
  .sidebar-backdrop { display: none; }

  .topbar-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .menu-btn {
    padding: 8px; border-radius: 8px; color: var(--text2);
    background: none; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background .2s; flex-shrink: 0;
  }
  .menu-btn:hover { background: var(--surface2); color: var(--text); }

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

  .page-content { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 24px; }

  /* ── Mobile ─────────────────────────────────────────────────────────────── */
  @media (max-width: 900px) {
    .sidebar-wrap {
      position: fixed; top: 0; left: 0; bottom: 0; z-index: 900;
      width: min(280px, 85vw);
      transform: translateX(-100%);
      transition: transform .25s ease;
      margin-left: 0 !important;
    }
    .sidebar-wrap.open { transform: none; box-shadow: 8px 0 32px rgba(0,0,0,.5); }
    .sidebar-wrap :global(.sidebar) { width: 100%; }
    .sidebar-backdrop {
      display: block; position: fixed; inset: 0; z-index: 899;
      background: rgba(0,0,0,.55); backdrop-filter: blur(2px);
      border: none; padding: 0; cursor: pointer;
      animation: backdropIn .2s ease;
    }
    .topbar { padding: 10px 12px; }
    .page-title { font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .topbar-right { gap: 8px; }
    .clock-date, .clock-day, .clock-sep { display: none; }
    .clock-block { padding: 5px 10px; }
    .page-content { padding: 16px; }
  }
  @media (max-width: 480px) {
    .clock-block { display: none; }
    .page-content { padding: 12px; }
  }
  @keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }
</style>
