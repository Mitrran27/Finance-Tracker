<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { user } from '$lib/stores.js';

  const navItems = [
    { href: '/',             label: 'Overview',      icon: 'dashboard' },
    { href: '/banks',        label: 'Bank Accounts', icon: 'landmark' },
    { href: '/transactions', label: 'Transactions',  icon: 'arrows' },
    { href: '/credit',       label: 'Credit Cards',  icon: 'card' },
    { href: '/drive',        label: 'Drive',         icon: 'drive' },
    { href: '/calendar',     label: 'Calendar',      icon: 'calendar' },
    { href: '/notes',        label: 'Notes',         icon: 'note' },
    { href: '/settings',     label: 'Settings',      icon: 'settings' },
  ];

  function logout() {
    localStorage.removeItem('token');
    user.set(null);
    goto('/auth');
  }

  $: initial = ($user?.name || 'U')[0].toUpperCase();
</script>

<aside class="sidebar">
  <div class="logo-row">
    <!-- Wallet + chart icon matching the brand logo -->
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="40" height="40" style="flex-shrink:0">
      <!-- Wallet body -->
      <rect x="2" y="10" width="34" height="26" rx="4" fill="#2a9d8f"/>
      <rect x="2" y="10" width="34" height="7" rx="3" fill="#21867a"/>
      <!-- Clasp -->
      <circle cx="36" cy="23" r="5" fill="#1a6b63" stroke="#2a9d8f" stroke-width="1.5"/>
      <circle cx="36" cy="23" r="2" fill="#2a9d8f"/>
      <!-- Red bars -->
      <rect x="7"  y="27" width="4" height="7" rx="1" fill="#e76f6f"/>
      <rect x="13" y="23" width="4" height="11" rx="1" fill="#e76f6f"/>
      <rect x="19" y="19" width="4" height="15" rx="1" fill="#e76f6f"/>
      <!-- Green line + arrow -->
      <polyline points="6,30 14,23 21,27 32,14" fill="none" stroke="#00e5a0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <polygon points="32,14 28,16 33,20" fill="#00e5a0"/>
    </svg>
    <span class="logo-text">Finance Tracker</span>
  </div>

  <nav>
    {#each navItems as item}
      <a href={item.href} class="nav-item" class:active={$page.url.pathname === item.href}>
        {#if item.icon === 'dashboard'}
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
        {:else if item.icon === 'landmark'}
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>
        {:else if item.icon === 'arrows'}
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>
        {:else if item.icon === 'card'}
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
        {:else if item.icon === 'drive'}
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
        {:else if item.icon === 'calendar'}
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
        {:else if item.icon === 'note'}
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/></svg>
        {:else if item.icon === 'settings'}
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        {/if}
        <span>{item.label}</span>
      </a>
    {/each}
  </nav>

  <div class="user-row">
    <div class="user-avatar">{initial}</div>
    <div class="user-info">
      <p class="user-name">{$user?.name || 'User'}</p>
      <p class="user-email">{$user?.email || ''}</p>
    </div>
    <button class="logout-btn" on:click={logout} title="Logout">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
    </button>
  </div>
</aside>

<style>
  .sidebar { width:240px; height:100%; flex-shrink:0; display:flex; flex-direction:column; background:var(--surface); border-right:1px solid var(--border); }
  .logo-row { padding:20px; display:flex; align-items:center; gap:12px; }
  .logo-icon { width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,var(--accent),var(--accent2)); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .logo-text { font-weight:700; font-size:14px; }
  nav { flex:1; padding:8px 12px; display:flex; flex-direction:column; gap:2px; overflow-y:auto; }
  .nav-item { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:8px; cursor:pointer; transition:all .2s; color:var(--text2); font-size:14px; font-weight:500; text-decoration:none; }
  .nav-item:hover { background:var(--surface2); color:var(--text); }
  .nav-item.active { background:rgba(0,229,160,.1); color:var(--accent); }
  .user-row { padding:16px; border-top:1px solid var(--border); display:flex; align-items:center; gap:12px; }
  .user-avatar { width:32px; height:32px; border-radius:50%; background:var(--accent2); color:white; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; flex-shrink:0; }
  .user-info { flex:1; min-width:0; }
  .user-name  { font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .user-email { font-size:11px; color:var(--text2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .logout-btn { background:none; border:none; cursor:pointer; color:var(--text2); display:flex; }
  .logout-btn:hover { color:var(--danger); }
</style>
