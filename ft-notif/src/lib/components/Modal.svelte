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

  /* Phones: slide up as a bottom sheet */
  @media (max-width: 600px) {
    .overlay { align-items: flex-end; padding: 0; }
    .modal-box {
      max-width: none; border-radius: 16px 16px 0 0;
      max-height: 92vh; max-height: 92dvh;
      border-bottom: none;
      animation: sheetUp .25s ease;
    }
    .modal-header { padding: 16px 16px 0; }
    .modal-body { padding: 12px 16px calc(20px + env(safe-area-inset-bottom)); }
    .close-btn { padding: 8px; font-size: 18px; }
  }
  @keyframes sheetUp { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
</style>
