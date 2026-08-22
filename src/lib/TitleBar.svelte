<script lang="ts">
  let {
    commonFoundCount,
    commonTotalCount,
    foundCount,
    totalCount,
    score,
    hintsAvailableToken,
    commonBonusAwarded,
    allBonusAwarded,
    onOpenStats,
  }: {
    commonFoundCount: number;
    commonTotalCount: number;
    foundCount: number;
    totalCount: number;
    score: number;
    hintsAvailableToken: number;
    commonBonusAwarded: boolean;
    allBonusAwarded: boolean;
    onOpenStats: () => void;
  } = $props();

  let bannerMessage = $state<string | null>(null);
  let bannerTimeoutId: ReturnType<typeof setTimeout> | undefined;

  function flashBanner(message: string) {
    bannerMessage = message;
    clearTimeout(bannerTimeoutId);
    bannerTimeoutId = setTimeout(() => {
      bannerMessage = null;
    }, 3000);
  }

  // svelte-ignore state_referenced_locally -- intentional: snapshot the initial value only
  // (making this $state would cause the effect below to read and write a tracked value,
  // causing an immediate self-retrigger -- see the same pattern in HexGrid.svelte).
  let previousHintsAvailableToken = hintsAvailableToken;
  $effect(() => {
    if (hintsAvailableToken !== previousHintsAvailableToken) {
      previousHintsAvailableToken = hintsAvailableToken;
      flashBanner('💡 Hints available!');
    }
    return () => clearTimeout(bannerTimeoutId);
  });
</script>

<div class="titlebar">
  <span class="title">Hexagonal</span>
  <div class="stats">
    {#if bannerMessage}
      <div class="bonus-banner">{bannerMessage}</div>
    {:else}
      <div class="status">
        Found {commonFoundCount} of {commonTotalCount} common words{#if commonBonusAwarded}<span
            class="badge">✓</span
          >{/if}
      </div>
      <div class="substatus">
        {foundCount}/{totalCount} total{#if allBonusAwarded}<span class="badge">✓</span>{/if}
      </div>
    {/if}
  </div>
  <div class="score-group">
    <span class="status">Score: {score.toLocaleString()}</span>
    <button class="stats-btn" onclick={onOpenStats} aria-label="View stats">📊</button>
  </div>
</div>

<style>
  .titlebar {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5em;
  }

  .score-group {
    display: flex;
    align-items: center;
    gap: 0.4em;
  }

  .title {
    font-size: 1.8rem;
    font-weight: 700;
    line-height: 1;
  }

  .stats-btn {
    background: none;
    border: none;
    padding: 0.15em 0.35em;
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
    border-radius: 6px;
    color: #f4d35e;
  }

  .stats-btn:hover,
  .stats-btn:focus-visible {
    background: rgba(244, 211, 94, 0.15);
    outline: 2px solid #f4d35e;
    outline-offset: 1px;
  }

  .stats {
    text-align: right;
    /* Fixed height (not content-hugging), covering the status+substatus
       two-line case, so swapping in the single-line bonus banner never
       shrinks the title bar (and with it, the hex grid below). */
    height: 2.34rem;
    display: flex;
    flex-direction: column;
  }

  .status {
    font-weight: 600;
    font-size: 1.1rem;
    line-height: 1.2;
    opacity: 0.85;
  }

  .substatus {
    font-size: 0.85rem;
    line-height: 1.2;
    opacity: 0.75;
  }

  .bonus-banner {
    text-align: center;
    color: #f4d35e;
    font-weight: 600;
    font-size: 1.1rem;
    line-height: 1.2;
  }

  .badge {
    color: #f4d35e;
    margin-left: 0.35em;
  }
</style>
