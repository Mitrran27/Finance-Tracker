<script>
  import { bankMeta, bankInitials } from '$lib/banks.js';

  export let name = '';
  export let size = 36;

  let failed = false;
  $: meta = bankMeta(name);
  $: name, failed = false;
</script>

{#if meta.logo && !failed}
  <img class="bank-logo" src="/banks/{meta.logo}.png" alt="{meta.name} logo"
       style="width:{size}px;height:{size}px" loading="lazy" on:error={() => failed = true}>
{:else}
  <span class="bank-logo mono-logo"
        style="width:{size}px;height:{size}px;background:{meta.color};font-size:{Math.round(size * (bankInitials(meta).length > 2 ? .28 : .36))}px">
    {bankInitials(meta)}
  </span>
{/if}

<style>
  .bank-logo {
    flex-shrink: 0; border-radius: 10px; object-fit: contain;
    background: #fff; display: inline-flex;
  }
  .mono-logo {
    align-items: center; justify-content: center;
    color: #fff; font-weight: 800; letter-spacing: -.02em;
  }
</style>
