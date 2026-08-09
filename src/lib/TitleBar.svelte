<script lang="ts">
  let {
    commonFoundCount,
    commonTotalCount,
    foundCount,
    totalCount,
    score,
  }: {
    commonFoundCount: number;
    commonTotalCount: number;
    foundCount: number;
    totalCount: number;
    score: number;
  } = $props();
</script>

<div class="titlebar">
  <span class="title">Hexagonal</span>
  <div class="stats">
    <div class="status">Found {commonFoundCount} of {commonTotalCount} common words</div>
    <div class="substatus">{foundCount}/{totalCount} total</div>
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
</style>
