<script>
  import { MY_BANKS, BANK_GROUPS } from '$lib/banks.js';
  import BankLogo from './BankLogo.svelte';

  export let value = '';

  let query = '';
  $: q = query.trim().toLowerCase();
  $: groups = BANK_GROUPS
    .map(g => ({
      name: g,
      banks: MY_BANKS.filter(b => b.group === g &&
        (!q || [b.name, ...(b.aliases || [])].some(n => n.toLowerCase().includes(q)))),
    }))
    .filter(g => g.banks.length);
</script>

<div class="picker">
  <input class="input-field" type="search" placeholder="Search banks & e-wallets…" bind:value={query}>
  <div class="picker-scroll">
    {#each groups as g}
      <p class="grp">{g.name}</p>
      <div class="grid">
        {#each g.banks as b}
          <button type="button" class="opt" class:sel={value === b.name} on:click={() => value = b.name} title={b.name}>
            <BankLogo name={b.name} size={36} />
            <span>{b.name}</span>
          </button>
        {/each}
      </div>
    {:else}
      <p class="none">No bank matches “{query}”</p>
    {/each}
  </div>
</div>

<style>
  .picker { display: flex; flex-direction: column; gap: 8px; }
  .picker-scroll {
    max-height: 300px; overflow-y: auto; padding: 2px 2px 4px;
    border: 1px solid var(--border); border-radius: 10px; padding: 8px;
  }
  .grp { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text2); margin: 6px 2px; }
  .grp:first-child { margin-top: 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; }
  .opt {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 10px 6px; border-radius: 10px; cursor: pointer;
    background: var(--surface2); border: 1.5px solid transparent; color: var(--text);
    font-size: 11px; line-height: 1.2; text-align: center; transition: border-color .15s, background .15s;
  }
  .opt span { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  .opt:hover { border-color: var(--border); }
  .opt.sel { border-color: var(--accent); background: rgba(0,229,160,.1); }
  .none { text-align: center; color: var(--text2); font-size: 13px; padding: 20px; }
  @media (max-width: 600px) {
    .picker-scroll { max-height: 40vh; }
    .grid { grid-template-columns: repeat(3, 1fr); }
  }
</style>
