<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { showToast } from '$lib/stores.js';

  let notifs=[], loading=true;

  onMount(load);

  async function load() {
    loading=true;
    try { notifs = await api.get('/notifications'); }
    catch(e) { showToast(e.message,'error'); }
    finally { loading=false; }
  }

  async function markRead(id) {
    try { await api.patch(`/notifications/${id}/read`, {}); load(); }
    catch(e) { showToast(e.message,'error'); }
  }

  async function markAllRead() {
    try { await api.patch('/notifications/read-all', {}); showToast('All marked as read'); load(); }
    catch(e) { showToast(e.message,'error'); }
  }

  async function deleteNotif(id) {
    try { await api.delete(`/notifications/${id}`); load(); }
    catch(e) { showToast(e.message,'error'); }
  }

  $: unread = notifs.filter(n => !n.is_read).length;
</script>

<div class="fade-in space">
  <div class="page-hdr">
    <p class="count">{notifs.length} notification{notifs.length!==1?'s':''}</p>
    {#if unread > 0}
      <button class="btn-secondary" on:click={markAllRead}>Mark All Read</button>
    {/if}
  </div>

  <div class="notif-list">
    {#if loading}
      <div class="glass2 empty-state">Loading…</div>
    {:else if notifs.length === 0}
      <div class="glass empty-state">
        <p>No notifications</p>
      </div>
    {:else}
      {#each notifs as n}
        <div class="glass2 notif-row" class:unread={!n.is_read}>
          <div class="dot" class:dot-unread={!n.is_read}></div>
          <div class="notif-body">
            <p class="notif-text">{n.text}</p>
            <p class="notif-date">{n.date?.split('T')[0] || ''}</p>
          </div>
          <div class="notif-actions">
            {#if !n.is_read}
              <button class="read-btn" on:click={() => markRead(n.id)}>Read</button>
            {/if}
            <button class="icon-btn" on:click={() => deleteNotif(n.id)}>🗑</button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .space{display:flex;flex-direction:column;gap:16px;}
  .page-hdr{display:flex;align-items:center;justify-content:space-between;}
  .count{font-size:14px;color:var(--text2);}
  .notif-list{display:flex;flex-direction:column;gap:8px;}
  .notif-row{padding:14px 16px;display:flex;align-items:center;gap:12px;transition:opacity .2s;}
  .notif-row:not(.unread){opacity:.5;}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--text2);flex-shrink:0;}
  .dot-unread{background:var(--accent);}
  .notif-body{flex:1;min-width:0;}
  .notif-text{font-size:13px;line-height:1.4;}
  .notif-date{font-size:11px;color:var(--text2);margin-top:3px;}
  .notif-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}
  .read-btn{background:none;border:none;cursor:pointer;color:var(--accent);font-size:12px;font-weight:600;}
  .icon-btn{background:none;border:none;cursor:pointer;font-size:13px;opacity:.6;}
  .icon-btn:hover{opacity:1;}
  .empty-state{padding:48px;text-align:center;color:var(--text2);}
</style>
