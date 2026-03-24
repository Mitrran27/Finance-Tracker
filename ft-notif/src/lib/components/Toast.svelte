<script>
  import { toast } from '$lib/stores.js';
</script>

{#if $toast}
  <div class="toast toast-{$toast.type}">
    {$toast.message}
  </div>
{/if}

<style>
  .toast {
    position: fixed; bottom: 20px; right: 20px;
    padding: 14px 20px; border-radius: 10px;
    font-size: 14px; font-weight: 500;
    z-index: 9999; max-width: 350px;
    animation: slideUp .3s ease;
  }
  .toast-success { background: rgba(0,229,160,.15); border: 1px solid rgba(0,229,160,.3); color: var(--accent); }
  .toast-error   { background: rgba(255,92,124,.15); border: 1px solid rgba(255,92,124,.3); color: var(--danger); }
  @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
</style>
