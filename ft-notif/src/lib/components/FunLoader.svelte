<script>
  import { onMount, onDestroy } from 'svelte';

  // Optional props
  export let fullscreen = false; // true = covers whole viewport (layout-level)
  export let size = 'normal';    // 'normal' | 'small'

  const texts = [
    "🍔 Flipping data patties for burgers...",
    "🍕 Heating up data pizzas...",
    "🍦 Scooping data ice creams...",
    "🥤 Shaking data milkshakes...",
    "🍟 Frying up hashed data...",
    "☕️ Brewing fresh data coffee beans...",
  ];

  let idx = Math.floor(Math.random() * texts.length);
  let visible = true;
  let interval;

  onMount(() => {
    // Cycle through texts: fade out → change → fade in every 1.8s
    interval = setInterval(() => {
      visible = false;
      setTimeout(() => {
        idx = (idx + 1) % texts.length;
        visible = true;
      }, 300);
    }, 1800);
  });

  onDestroy(() => { if (interval) clearInterval(interval); });
</script>

<div class="fun-loader" class:fullscreen class:small={size === 'small'}>
  <div class="spinner"></div>
  <p class="loader-text" class:hidden={!visible}>{texts[idx]}</p>
</div>

<style>
  .fun-loader {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 40px;
  }
  .fun-loader.fullscreen {
    position: fixed;
    inset: 0;
    background: var(--bg);
    z-index: 9999;
    padding: 0;
  }
  .fun-loader.small {
    padding: 20px;
    gap: 10px;
  }

  /* Spinner */
  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  .fun-loader.small .spinner {
    width: 22px;
    height: 22px;
    border-width: 2px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Text */
  .loader-text {
    font-size: 14px;
    font-weight: 600;
    color: var(--accent);
    letter-spacing: 0.3px;
    text-align: center;
    transition: opacity 0.3s ease, transform 0.3s ease;
    opacity: 1;
    transform: translateY(0);
  }
  .fun-loader.small .loader-text {
    font-size: 12px;
  }
  .loader-text.hidden {
    opacity: 0;
    transform: translateY(4px);
  }
</style>
