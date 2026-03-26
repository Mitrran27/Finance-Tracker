<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api.js';
  import { showToast, today } from '$lib/stores.js';
  import Modal from '$lib/components/Modal.svelte';

  let folders=[], files=[], loading=true;
  let selectedFolder=null;
  let search='', filterMonth='', sort='date-desc';
  let showAddFolder=false, showAddFile=false;
  let fFolderName='';

  // File form
  let fFileName='', fFileType='receipt', fFileSize='', fFileFolder='';
  let fFileDevice = null; // actual File object from device
  let fileInput;          // bound to <input type="file">

  onMount(load);

  async function load() {
    loading=true;
    try {
      folders = await api.get('/drive/folders');
      await loadFiles();
    } catch(e) { showToast(e.message,'error'); }
    finally { loading=false; }
  }

  async function loadFiles() {
    const p = new URLSearchParams({ sort });
    if (selectedFolder) p.set('folder_id', selectedFolder);
    else p.set('folder_id','root');
    if (search)      p.set('search', search);
    if (filterMonth) p.set('month', filterMonth);
    files = await api.get(`/drive/files?${p}`);
  }

  function onFileChosen(e) {
    const f = e.target.files[0];
    if (!f) return;
    fFileDevice = f;
    // Auto-fill name, size, and type from the chosen file
    fFileName = f.name;
    fFileSize = f.size > 1024*1024
      ? (f.size / (1024*1024)).toFixed(1) + ' MB'
      : (f.size / 1024).toFixed(0) + ' KB';
    const ext = f.name.split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) fFileType = 'image';
    else if (ext === 'pdf') fFileType = 'pdf';
    else if (['doc','docx'].includes(ext)) fFileType = 'other';
    else if (['xls','xlsx'].includes(ext)) fFileType = 'other';
    else fFileType = 'receipt';
  }

  async function addFolder() {
    if (!fFolderName) return showToast('Enter folder name','error');
    try {
      await api.post('/drive/folders', { name: fFolderName });
      showToast('Folder created!'); showAddFolder=false; fFolderName=''; load();
    } catch(e) { showToast(e.message,'error'); }
  }

  async function addFile() {
    if (!fFileName) return showToast('Enter or pick a file','error');
    try {
      await api.post('/drive/files', {
        name: fFileName, type: fFileType, size: fFileSize,
        folder_id: fFileFolder || null, date: today()
      });
      showToast('File added!');
      showAddFile=false; fFileName=''; fFileSize=''; fFileDevice=null;
      if (fileInput) fileInput.value = '';
      load();
    } catch(e) { showToast(e.message,'error'); }
  }

  async function deleteFolder(id) {
    if (!confirm('Delete this folder?')) return;
    try { await api.delete(`/drive/folders/${id}`); showToast('Deleted!'); load(); }
    catch(e) { showToast(e.message,'error'); }
  }

  async function deleteFile(id) {
    if (!confirm('Delete this file?')) return;
    try { await api.delete(`/drive/files/${id}`); showToast('Deleted!'); loadFiles(); }
    catch(e) { showToast(e.message,'error'); }
  }

  function downloadFile(f) {
    if (fFileDevice) {
      // If we have the actual file object in memory (just uploaded this session), download it
      const url = URL.createObjectURL(fFileDevice);
      const a = document.createElement('a');
      a.href = url; a.download = f.name; a.click();
      URL.revokeObjectURL(url);
    } else {
      // Metadata-only reference — create a text stub
      const content = `File Reference\n--------------\nName: ${f.name}\nType: ${f.type}\nSize: ${f.size}\nDate: ${f.date?.slice(0,10)}\n\nThis is a metadata record only.`;
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = f.name + '.txt'; a.click();
      URL.revokeObjectURL(url);
    }
  }

  function selectFolder(id) { selectedFolder=id; loadFiles(); }
  function backToRoot() { selectedFolder=null; loadFiles(); }
  $: selectedFolderName = folders.find(f=>f.id==selectedFolder)?.name || '';

  function fileIcon(type) {
    if (type === 'image') return '🖼';
    if (type === 'pdf')   return '📕';
    if (['invoice','statement','receipt'].includes(type)) return '🧾';
    return '📄';
  }
</script>

<div class="fade-in space">
  <div class="page-hdr">
    <p class="count">{folders.length} folder{folders.length!==1?'s':''} · {files.length} file{files.length!==1?'s':''}</p>
    <div class="btn-row">
      <button class="btn-secondary" on:click={() => showAddFolder=true}>📁 New Folder</button>
      <button class="btn-primary" on:click={() => showAddFile=true}>⬆ Upload File</button>
    </div>
  </div>

  {#if selectedFolder}
    <div class="glass breadcrumb">
      <button class="back-btn" on:click={backToRoot}>← Back</button>
      <span class="muted">Viewing: <strong>{selectedFolderName}</strong></span>
    </div>
  {:else}
    <div>
      <p class="section-label">FOLDERS</p>
      <div class="folder-grid">
        {#each folders as f}
          <div class="glass2 folder-card">
            <button class="folder-btn" on:click={() => selectFolder(f.id)}>
              <span class="folder-icon">📂</span>
              <div class="folder-info">
                <p class="folder-name">{f.name}</p>
                <p class="folder-count">{f.file_count} file{f.file_count!==1?'s':''}</p>
              </div>
            </button>
            <button class="icon-btn" on:click={() => deleteFolder(f.id)}><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
          </div>
        {:else}
          <div class="glass2 empty-state">No folders yet</div>
        {/each}
      </div>
    </div>
  {/if}

  <div>
    <p class="section-label">FILES {selectedFolder ? '(in folder)' : '(Root)'}</p>
    <div class="glass filters">
      <div class="filter-grid">
        <div>
          <label for="drive-search">Search</label>
          <input id="drive-search" class="input-field" bind:value={search} on:input={loadFiles} placeholder="File name or type…">
        </div>
        <div>
          <label for="drive-month">Month</label>
          <input id="drive-month" class="input-field" type="month" bind:value={filterMonth} on:change={loadFiles}>
        </div>
        <div>
          <label for="drive-sort">Sort</label>
          <select id="drive-sort" class="input-field" bind:value={sort} on:change={loadFiles}>
            <option value="date-desc">Latest First</option>
            <option value="date-asc">Oldest First</option>
          </select>
        </div>
      </div>
    </div>
    <div class="file-list">
      {#each files as f}
        <div class="glass2 file-row">
          <div class="file-icon">{fileIcon(f.type)}</div>
          <div class="file-info">
            <p class="file-name">{f.name}</p>
            <p class="file-meta">{f.type||'File'} · {f.size||'—'} · {f.date?.slice(0,10)||''}</p>
          </div>
          <div class="file-actions">
            <button class="dl-btn" on:click={() => downloadFile(f)} title="Download">⬇</button>
            <button class="icon-btn" on:click={() => deleteFile(f.id)}><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
          </div>
        </div>
      {:else}
        <div class="glass2 empty-state">No files here</div>
      {/each}
    </div>
  </div>
</div>

<!-- Add Folder Modal -->
<Modal title="Create Folder" bind:show={showAddFolder} onClose={() => showAddFolder=false}>
  <div class="form-group">
    <label for="folder-name">Folder Name</label>
    <input id="folder-name" class="input-field" placeholder="Receipts, Invoices…" bind:value={fFolderName}>
  </div>
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => showAddFolder=false}>Cancel</button>
    <button class="btn-primary" on:click={addFolder}>Create</button>
  </div>
</Modal>

<!-- Upload File Modal -->
<Modal title="Upload File" bind:show={showAddFile} onClose={() => { showAddFile=false; fFileName=''; fFileDevice=null; if(fileInput) fileInput.value=''; }}>
  <!-- Device picker -->
  <div class="form-group">
    <label for="file-device">Choose from Device</label>
    <label class="file-drop" for="file-device">
      {#if fFileDevice}
        <span class="file-chosen">✅ {fFileDevice.name}</span>
      {:else}
        <span>📂 Click to browse or drag & drop</span>
      {/if}
      <input
        id="file-device"
        type="file"
        class="hidden-input"
        bind:this={fileInput}
        on:change={onFileChosen}
      >
    </label>
  </div>

  <div class="divider"><span>or enter manually</span></div>

  <div class="form-group">
    <label for="file-name">File Name</label>
    <input id="file-name" class="input-field" placeholder="receipt.pdf" bind:value={fFileName}>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label for="file-type">Type</label>
      <select id="file-type" class="input-field" bind:value={fFileType}>
        {#each ['receipt','invoice','statement','image','pdf','other'] as t}<option>{t}</option>{/each}
      </select>
    </div>
    <div class="form-group">
      <label for="file-size">Size</label>
      <input id="file-size" class="input-field" placeholder="2.5 MB" bind:value={fFileSize}>
    </div>
  </div>
  <div class="form-group">
    <label for="file-folder">Save to Folder</label>
    <select id="file-folder" class="input-field" bind:value={fFileFolder}>
      <option value="">📁 Root</option>
      {#each folders as f}<option value={f.id}>📂 {f.name}</option>{/each}
    </select>
  </div>
  <div class="modal-actions">
    <button class="btn-secondary" on:click={() => { showAddFile=false; fFileName=''; fFileDevice=null; if(fileInput) fileInput.value=''; }}>Cancel</button>
    <button class="btn-primary" on:click={addFile}>Save File</button>
  </div>
</Modal>

<style>
  .space{display:flex;flex-direction:column;gap:16px;}
  .page-hdr{display:flex;align-items:center;justify-content:space-between;}
  .count{font-size:14px;color:var(--text2);}
  .btn-row{display:flex;gap:8px;}
  .breadcrumb{padding:12px 16px;display:flex;align-items:center;gap:12px;}
  .back-btn{background:none;border:none;cursor:pointer;color:var(--accent);font-size:14px;}
  .muted{font-size:13px;color:var(--text2);}
  .section-label{font-size:11px;font-weight:600;color:var(--text2);margin-bottom:8px;letter-spacing:.05em;}
  .folder-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:4px;}
  @media(max-width:900px){.folder-grid{grid-template-columns:repeat(2,1fr);}}
  @media(max-width:600px){.folder-grid{grid-template-columns:1fr;}}
  .folder-card{padding:12px 16px;display:flex;align-items:center;justify-content:space-between;}
  .folder-btn{background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:8px;flex:1;text-align:left;color:var(--text);}
  .folder-btn:hover .folder-name{color:var(--accent);}
  .folder-icon{font-size:22px;flex-shrink:0;}
  .folder-info{flex:1;}
  .folder-name{font-size:13px;font-weight:600;transition:color .15s;}
  .folder-count{font-size:11px;color:var(--text2);}
  .filters{padding:16px;margin-bottom:8px;}
  .filter-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
  @media(max-width:700px){.filter-grid{grid-template-columns:1fr;}}
  .file-list{display:flex;flex-direction:column;gap:8px;}
  .file-row{padding:14px 16px;display:flex;align-items:center;gap:12px;}
  .file-icon{font-size:22px;flex-shrink:0;}
  .file-info{flex:1;min-width:0;}
  .file-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .file-meta{font-size:11px;color:var(--text2);margin-top:2px;}
  .file-actions{display:flex;gap:8px;flex-shrink:0;}
  .dl-btn{background:none;border:none;cursor:pointer;font-size:16px;opacity:.7;}
  .dl-btn:hover{opacity:1;}
  .empty-state{padding:32px;text-align:center;color:var(--text2);font-size:13px;}
  .icon-btn{background:none;border:none;cursor:pointer;color:rgba(255,255,255,.45);padding:5px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:all .15s;}
  .icon-btn:hover{background:rgba(255,92,124,.12);color:var(--danger);}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .form-group{margin-bottom:14px;}
  .modal-actions{display:flex;gap:8px;margin-top:20px;}

  /* File upload drop zone */
  .file-drop{
    display:flex; align-items:center; justify-content:center;
    padding:24px; border:2px dashed var(--border); border-radius:10px;
    cursor:pointer; font-size:13px; color:var(--text2);
    transition:border-color .2s, background .2s;
    min-height:80px;
  }
  .file-drop:hover{ border-color:var(--accent); background:rgba(0,229,160,.05); color:var(--accent); }
  .file-chosen{ color:var(--accent); font-weight:600; }
  .hidden-input{ position:absolute; opacity:0; width:0; height:0; pointer-events:none; }

  .divider{ display:flex; align-items:center; gap:12px; margin:12px 0; color:var(--text2); font-size:11px; }
  .divider::before,.divider::after{ content:''; flex:1; height:1px; background:var(--border); }
</style>
