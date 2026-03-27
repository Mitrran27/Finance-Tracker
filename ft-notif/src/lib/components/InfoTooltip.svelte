<script>
  export let text = "";
</script>

<div class="info-wrapper">
  <div class="info-icon">i</div>
  <div class="tooltip">{text}</div>
</div>

<style>
  .info-wrapper {
    position: relative;
    display: inline-block;
    margin-left: 6px;
  }

  .info-icon {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: red;
    color: white;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: help;
    border: 1px solid var(--border);
  }

  .tooltip {
    position: absolute;
    bottom: 22px;
    left: 50%;
    transform: translateX(-50%);
    background: #111;
    color: white;
    font-size: 11px;
    padding: 6px 8px;
    border-radius: 6px;
    width: 220px;
    text-align: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
    z-index: 100;
  }

  .info-wrapper:hover .tooltip {
    opacity: 1;
  }
</style>