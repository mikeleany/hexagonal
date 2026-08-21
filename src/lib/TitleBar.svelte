<script lang="ts">
  let {
    commonFoundCount,
    commonTotalCount,
    foundCount,
    totalCount,
    score,
    commonBonusToken,
    hintsAvailableToken,
    commonBonusAwarded,
    allBonusAwarded,
    commonBonusAmount,
  }: {
    commonFoundCount: number;
    commonTotalCount: number;
    foundCount: number;
    totalCount: number;
    score: number;
    commonBonusToken: number;
    hintsAvailableToken: number;
    commonBonusAwarded: boolean;
    allBonusAwarded: boolean;
    commonBonusAmount: number;
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

  // svelte-ignore state_referenced_locally -- intentional: snapshot the initial value only,
  // same rationale as HexGrid's previousRejectedToken (see HexGrid.svelte).
  let previousCommonBonusToken = commonBonusToken;
  $effect(() => {
    if (commonBonusToken !== previousCommonBonusToken) {
      previousCommonBonusToken = commonBonusToken;
      flashBanner(`★ Common words complete! +${commonBonusAmount.toLocaleString()}`);
    }
    return () => clearTimeout(bannerTimeoutId);
  });

  // svelte-ignore state_referenced_locally -- intentional: snapshot the initial value only,
  // same rationale as previousCommonBonusToken above.
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
  <span class="status">Score: {score.toLocaleString()}</span>
</div>

<style>
  .titlebar {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5em;
  }

  .title {
    font-size: 1.8rem;
    font-weight: 700;
    line-height: 1;
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
