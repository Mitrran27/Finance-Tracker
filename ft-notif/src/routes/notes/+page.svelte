<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { showToast, today } from '$lib/stores.js';
  import Modal from '$lib/components/Modal.svelte';

  let notes=[], loading=true;
  let showAdd=false, showEdit=false, editNote=null;
  let search='', sort='date-desc';
  let fText='', fDate=today();
  let eText='', eDate='';

  onMount(load);

  async function load() {
    loading=true;
    try {
      const p = new URLSearchParams({ sort });
      if (search) p.set('search', search);
      notes = await api.get(`/notes?${p}`);
    } catch(e) { showToast(e.message,'error'); }
    finally { loading=false; }
  }

  async function addNote() {
    if (!fText.trim()) return showToast('Enter note text','error');
    try {
      await api.post('/notes', { text:fText, date:fDate||null });
      showToast('Note added!'); showAdd=false; fText=''; fDate=today(); load();
    } catch(e) { showToast(e.message,'error'); }
  }

  function openEdit(n) { editNote=n; eText=n.text; eDate=n.date?.split('T')[0]||''; showEdit=true; }

  async function saveEdit() {
    try {
      await api.patch(`/notes/${editNote.id}`, { text:eText, date:eDate||null });
      showToast('Note updated!'); showEdit=false; editNote=null; load();
    } catch(e) { showToast(e.message,'error'); }
  }

  async function toggleDone(note) {
    try {
      await api.patch(`/notes/${note.id}`, { completed: !note.completed });
      showToast(note.completed ? 'Marked as active!' : 'Note done ✓'); load();
    } catch(e) { showToast(e.message,'error'); }
  }

  async function deleteNote(id) {
    if (!confirm('Delete this note?')) return;
    try { await api.delete(`/notes/${id}`); showToast('Deleted!'); load(); }
    catch(e) { showToast(e.message,'error'); }
  }

  $: activeNotes    = notes.filter(n => !n.completed);
  $: completedNotes = notes.filter(n => n.completed);
</script>

<div class="fade-in space">
  <div class="page-hdr">
    <p class="count">{notes.length} note{notes.length!==1?'s':''} · {completedNotes.length} completed</p>
    <button class="btn-primary" on:click={() => showAdd=true}>+ Add Note</button>
  </div>

  <div class="glass filters">
    <div class="filter-grid">
      <div>
        <label for="note-search">Search</label>
        <input id="note-search" class="input-field" bind:value={search} on:input={load} placeholder="Search notes…">
      </div>
      <div>
        <label for="note-sort">Sort</label>
        <select id="note-sort" class="input-field" bind:value={sort} on:change={load}>
          <option value="date-desc">Latest First</option>
          <option value="date-asc">Oldest First</option>
          <option value="status-active">Active First</option>
          <option value="status-completed">Completed First</option>
        </select>
      </div>
    </div>
  </div>

  {#if activeNotes.length > 0}
    <div>
      <p class="section-label">ACTIVE</p>
      <div class="note-grid">
        {#each activeNotes as note}
          {@const overdue = note.date && note.date.split('T')[0] < today()}
          <div class="glass2 note-card" style="border-left:3px solid {overdue?'var(--danger)':'var(--accent)'}">
            <div class="note-top">
              <p class="note-text">{note.text}</p>
              <div class="note-actions">
                <button class="icon-btn" on:click={() => toggleDone(note)} title="Mark done">✅</button>
                <button class="icon-btn" on:click={() => openEdit(note)} title="Edit">✏️</button>
                <button class="icon-btn" on:click={() => deleteNote(note.id)} title="Delete">🗑</button>
              </div>
            </div>
            <div class="note-footer">
              <span class="note-date">{note.date?.split('T')[0] || 'No date'}</span>
              <span class="badge" style="background:{overdue?'rgba(255,92,124,.15)':'rgba(0,229,160,.15)'};color:{overdue?'var(--danger)':'var(--accent)'}">
                {overdue ? 'Overdue' : 'Active'}
              </span>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if completedNotes.length > 0}
    <div>
      <p class="section-label">COMPLETED</p>
      <div class="note-grid">
        {#each completedNotes as note}
          <div class="glass2 note-card done" style="border-left:3px solid var(--accent)">
            <div class="note-top">
              <p class="note-text strikethrough">{note.text}</p>
              <div class="note-actions">
                <button class="icon-btn" on:click={() => toggleDone(note)} title="Mark active">↩️</button>
                <button class="icon-btn" on:click={() => deleteNote(note.id)}>🗑</button>
              </div>
            </div>
            <div class="note-footer">
              <span class="note-date">{note.date?.split('T')[0] || 'No date'}</span>
              <span class="badge" style="background:rgba(0,229,160,.15);color:var(--accent)">✓ Done</span>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if notes.length === 0 && !loading}
    <div class="glass empty-state">No notes yet. Add one!</div>
  {/if}
</div>

<!-- Add Modal -->
<Modal title="Add Note" bind:show={showAdd} onClose={() => showAdd=false}>
  <div class="form-group">
    <label for="add-note-text">Note</label>
    <textarea id="add-note-text" class="input-field" rows="3" placeholder="Get groceries…" bind:value={fText}></textarea>
  </div>
  <div class="form-group">
    <label for="add-note-date">Due Date (optional)</label>
    <input id="add-note-date" class="input-field" type="date" bind:value={fDate}>
  </div>
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showAdd=false}>Cancel</button>
    <button class="btn-primary" on:click={addNote}>Add Note</button>
  </div>
</Modal>

<!-- Edit Modal -->
<Modal title="Edit Note" bind:show={showEdit} onClose={() => showEdit=false}>
  <div class="form-group">
    <label for="edit-note-text">Note</label>
    <textarea id="edit-note-text" class="input-field" rows="3" bind:value={eText}></textarea>
  </div>
  <div class="form-group">
    <label for="edit-note-date">Due Date</label>
    <input id="edit-note-date" class="input-field" type="date" bind:value={eDate}>
  </div>
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showEdit=false}>Cancel</button>
    <button class="btn-primary" on:click={saveEdit}>Update</button>
  </div>
</Modal>

<style>
  .space{display:flex;flex-direction:column;gap:16px;}
  .page-hdr{display:flex;align-items:center;justify-content:space-between;}
  .count{font-size:14px;color:var(--text2);}
  .filters{padding:16px;}
  .filter-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .section-label{font-size:11px;font-weight:600;color:var(--text2);margin-bottom:8px;letter-spacing:.05em;}
  .note-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;}
  @media(max-width:700px){.note-grid{grid-template-columns:1fr;}}
  .note-card{padding:16px;}
  .note-card.done{opacity:.7;}
  .note-top{display:flex;gap:8px;margin-bottom:10px;}
  .note-text{flex:1;font-size:13px;line-height:1.5;}
  .strikethrough{text-decoration:line-through;color:var(--text2);}
  .note-actions{display:flex;gap:2px;flex-shrink:0;}
  .note-footer{display:flex;align-items:center;justify-content:space-between;}
  .note-date{font-size:11px;color:var(--text2);}
  .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;}
  .icon-btn{background:none;border:none;cursor:pointer;font-size:13px;opacity:.6;padding:2px;}
  .icon-btn:hover{opacity:1;}
  .empty-state{padding:48px;text-align:center;color:var(--text2);}
  .form-group{margin-bottom:14px;}
  .modal-actions{display:flex;gap:8px;margin-top:20px;}
  textarea.input-field{resize:vertical;}
</style>
