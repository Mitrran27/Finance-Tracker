<script>
  export let title = '';
  export let show = false;
  export let onClose = () => {};

  function handleOverlay(e) {
    if (e.target === e.currentTarget) onClose();
  }
</script>

{#if show}
  <div class="overlay" role="dialog" aria-modal="true">
    <button class="overlay-bg" on:click={onClose} aria-label="Close modal"></button>
    <div class="modal-box">
      <div class="modal-header">
        <h3>{title}</h3>
        <button class="close-btn" on:click={onClose}>✕</button>
      </div>
      <div class="modal-body">
        <slot />
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed; inset: 0;
    z-index: 1000;
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
  }
  .overlay-bg {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.6);
    backdrop-filter: blur(4px);
    z-index: -1;
    border: none; cursor: pointer; padding: 0;
  }
  .modal-box {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    width: 100%; max-width: 480px;
    max-height: 90vh; overflow-y: auto;
  }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 24px 0;
  }
  .modal-header h3 { font-size: 16px; font-weight: 700; }
  .close-btn {
    background: none; border: none; cursor: pointer;
    color: var(--text2); font-size: 16px; padding: 4px;
  }
  .close-btn:hover { color: var(--text); }
  .modal-body { padding: 16px 24px 24px; }
</style>
