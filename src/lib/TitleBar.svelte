<script lang="ts">
  let {
    commonFoundCount,
    commonTotalCount,
    foundCount,
    totalCount,
    score,
    commonBonusToken,
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
    commonBonusAwarded: boolean;
    allBonusAwarded: boolean;
    commonBonusAmount: number;
  } = $props();

  let showBonusBanner = $state(false);
  let bonusBannerTimeoutId: ReturnType<typeof setTimeout> | undefined;

  // svelte-ignore state_referenced_locally -- intentional: snapshot the initial value only,
  // same rationale as HexGrid's previousRejectedToken (see HexGrid.svelte).
  let previousCommonBonusToken = commonBonusToken;
  $effect(() => {
    if (commonBonusToken !== previousCommonBonusToken) {
      previousCommonBonusToken = commonBonusToken;
      showBonusBanner = true;
      clearTimeout(bonusBannerTimeoutId);
      bonusBannerTimeoutId = setTimeout(() => {
        showBonusBanner = false;
      }, 3000);
    }
    return () => clearTimeout(bonusBannerTimeoutId);
  });
</script>

<div class="titlebar">
  <span class="title">Hexagonal</span>
  <div class="stats">
    {#if showBonusBanner}
      <div class="bonus-banner">★ Common words complete! +{commonBonusAmount.toLocaleString()}</div>
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
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5em;
  }

  .title {
    font-size: 1.8rem;
    font-weight: 700;
  }

  .stats {
    text-align: right;
  }

  .status {
    font-size: 1.1rem;
    opacity: 0.85;
  }

  .substatus {
    font-size: 0.85rem;
    opacity: 0.6;
  }

  .bonus-banner {
    text-align: center;
    color: #f4d35e;
    font-weight: 600;
    font-size: 1.1rem;
  }

  .badge {
    color: #f4d35e;
    margin-left: 0.35em;
  }
</style>
