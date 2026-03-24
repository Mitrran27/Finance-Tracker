<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { user, showToast } from '$lib/stores.js';

  let name = '', loading = false;

  // Reminder emails
  let loginEmail   = '';   // from signup — always shown, cannot be removed
  let extraEmails  = [];   // additional emails added by user
  let newEmail     = '';   // input for adding new email
  let addingEmail  = false;

  onMount(async () => {
    name = $user?.name || '';
    try {
      const res = await api.get('/settings/reminder-emails');
      loginEmail  = res.login_email;
      extraEmails = res.extras || [];
    } catch(e) { 
      loginEmail = $user?.email || '';
      console.error(e); 
    }
  });

  async function saveProfile() {
    if (!name.trim()) return showToast('Enter a name', 'error');
    loading = true;
    try {
      const updated = await api.patch('/settings/profile', { name });
      user.update(u => ({ ...u, name: updated.name }));
      showToast('Profile updated!');
    } catch(e) { showToast(e.message, 'error'); }
    finally { loading = false; }
  }

  async function addEmail() {
    if (!newEmail.trim() || !newEmail.includes('@'))
      return showToast('Enter a valid email', 'error');
    addingEmail = true;
    try {
      const res = await api.post('/settings/reminder-emails', { email: newEmail.trim() });
      extraEmails = res.extras;
      newEmail = '';
      showToast('Email added!');
    } catch(e) { showToast(e.message, 'error'); }
    finally { addingEmail = false; }
  }

  async function removeEmail(email) {
    try {
      const res = await api.delete(`/settings/reminder-emails/${encodeURIComponent(email)}`);
      extraEmails = res.extras;
      showToast('Email removed');
    } catch(e) { showToast(e.message, 'error'); }
  }

  async function exportData() {
    try {
      const [banks,txs,cards,ccTxs,history,folders,files,events,notes] = await Promise.all([
        api.get('/banks'), api.get('/transactions'), api.get('/credit/cards'),
        api.get('/credit/transactions'), api.get('/credit/history'),
        api.get('/drive/folders'), api.get('/drive/files'),
        api.get('/events'), api.get('/notes'),
      ]);
      const data = { banks, transactions:txs, creditCards:cards, ccTransactions:ccTxs,
        paymentHistory:history, folders, files, events, notes };
      const blob = new Blob([JSON.stringify(data,null,2)], { type:'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'finance-data.json'; a.click();
      URL.revokeObjectURL(url);
      showToast('Data exported!');
    } catch(e) { showToast(e.message, 'error'); }
  }

  async function clearAllData() {
    if (!confirm('This will permanently delete ALL your financial data. This cannot be undone. Are you sure?')) return;
    try {
      const [banks,txs,cards,ccTxs,history,folders,files,events,notes,notifs] = await Promise.all([
        api.get('/banks'), api.get('/transactions'), api.get('/credit/cards'),
        api.get('/credit/transactions'), api.get('/credit/history'),
        api.get('/drive/folders'), api.get('/drive/files'),
        api.get('/events'), api.get('/notes'), api.get('/notifications'),
      ]);
      await Promise.all([
        ...banks.map(r   => api.delete(`/banks/${r.id}`)),
        ...txs.map(r     => api.delete(`/transactions/${r.id}`)),
        ...cards.map(r   => api.delete(`/credit/cards/${r.id}`)),
        ...ccTxs.map(r   => api.delete(`/credit/transactions/${r.id}`)),
        ...history.map(r => api.delete(`/credit/history/${r.id}`)),
        ...files.map(r   => api.delete(`/drive/files/${r.id}`)),
        ...folders.map(r => api.delete(`/drive/folders/${r.id}`)),
        ...events.map(r  => api.delete(`/events/${r.id}`)),
        ...notes.map(r   => api.delete(`/notes/${r.id}`)),
        ...notifs.map(r  => api.delete(`/notifications/${r.id}`)),
      ]);
      showToast('All data cleared');
    } catch(e) { showToast(e.message, 'error'); }
  }
</script>

<div class="fade-in space">

  <!-- Account Details -->
  <div class="glass section">
    <h3 class="section-title"><span class="icon">👤</span> Account Details</h3>
    <div class="field-group">
      <div class="form-group">
        <label for="sname">Name</label>
        <input id="sname" class="input-field" bind:value={name} placeholder="Your name">
      </div>
      <div class="form-group">
        <label for="semail">Login Email</label>
        <input id="semail" class="input-field" value={$user?.email || ''} disabled style="opacity:.6">
      </div>
      <button class="btn-primary" on:click={saveProfile} disabled={loading}>
        {loading ? 'Saving…' : 'Save Profile'}
      </button>
    </div>
  </div>

  <!-- Reminder Emails -->
  <div class="glass section">
    <h3 class="section-title"><span class="icon">🔔</span> Reminder Emails</h3>
    <p class="hint">
      Event and note reminders (1 day, 3 days, 1 week before) are sent to <strong>all</strong> addresses below.
      Your login email is always included. Add extra addresses with the <strong>+</strong> button.
    </p>

    <div class="email-list">

      <!-- Login email — always first, cannot be removed -->
      <div class="email-row email-row-default">
        <div class="email-icon">✉️</div>
        <div class="email-info">
          <span class="email-addr">{loginEmail || $user?.email || '—'}</span>
          <span class="email-tag">Login email · default</span>
        </div>
        <!-- no delete button — can't remove login email -->
      </div>

      <!-- Extra emails -->
      {#each extraEmails as email}
        <div class="email-row">
          <div class="email-icon">✉️</div>
          <div class="email-info">
            <span class="email-addr">{email}</span>
            <span class="email-tag">Additional</span>
          </div>
          <button class="remove-btn" on:click={() => removeEmail(email)} title="Remove">✕</button>
        </div>
      {/each}

      <!-- Add new email row -->
      <div class="add-email-row">
        <input
          class="input-field add-input"
          type="email"
          placeholder="Add email address…"
          bind:value={newEmail}
          on:keydown={e => e.key === 'Enter' && addEmail()}
        >
        <button class="add-btn" on:click={addEmail} disabled={addingEmail} title="Add email">
          {addingEmail ? '…' : '+'}
        </button>
      </div>
    </div>
  </div>

  <!-- Export -->
  <div class="glass section">
    <h3 class="section-title"><span class="icon">⬇️</span> Export Data</h3>
    <p class="hint">Download all your financial data as a JSON file.</p>
    <button class="btn-secondary" on:click={exportData}>Export JSON</button>
  </div>

  <!-- Danger Zone -->
  <div class="glass section danger-section">
    <h3 class="section-title danger-title"><span class="icon">⚠️</span> Danger Zone</h3>
    <p class="hint">Permanently delete all your financial data. Your login account will be kept.</p>
    <button class="btn-danger" on:click={clearAllData}>Clear All Data</button>
  </div>

</div>

<style>
  .space         { display:flex; flex-direction:column; gap:24px; }
  .section       { padding:24px; }
  .section-title { display:flex; align-items:center; gap:8px; font-size:14px; font-weight:600; margin-bottom:16px; }
  .icon          { font-size:16px; }
  .danger-section{ border-color:rgba(255,92,124,.3); }
  .danger-title  { color:var(--danger); }
  .hint          { font-size:12px; color:var(--text2); margin-bottom:16px; line-height:1.6; }
  .field-group   { display:flex; flex-direction:column; gap:12px; }
  .form-group    { display:flex; flex-direction:column; gap:6px; }

  /* ── Email list ── */
  .email-list { display:flex; flex-direction:column; gap:8px; }

  .email-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: var(--surface2);
    border-radius: 10px;
    border: 1px solid var(--border);
    transition: border-color .15s;
  }
  .email-row:hover { border-color: var(--accent2); }
  .email-row-default {
    border-color: rgba(0,229,160,.3);
    background: rgba(0,229,160,.04);
  }

  .email-icon { font-size:16px; flex-shrink:0; }
  .email-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
  .email-addr { font-size:13px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .email-tag  { font-size:10px; color:var(--text2); }

  .remove-btn {
    background: none; border: none; cursor: pointer;
    color: var(--text2); font-size:14px; padding:4px 6px;
    border-radius: 4px; flex-shrink:0;
    transition: color .15s, background .15s;
  }
  .remove-btn:hover { color:var(--danger); background:rgba(255,92,124,.1); }

  /* Add row */
  .add-email-row {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  .add-input { flex:1; }
  .add-btn {
    width: 40px; height: 40px; flex-shrink:0;
    border-radius: 10px; border: 2px dashed var(--accent);
    background: rgba(0,229,160,.08); color: var(--accent);
    font-size: 22px; font-weight: 300; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background .15s, transform .1s;
  }
  .add-btn:hover:not(:disabled) { background:rgba(0,229,160,.18); transform:scale(1.05); }
  .add-btn:disabled { opacity:.5; cursor:not-allowed; }
</style>
