<script lang="ts">
  let { foundCount, totalCount }: { foundCount: number; totalCount: number } = $props();
</script>

<div class="titlebar">
  <span class="title">Hexagonal</span>
  <span class="status">Found {foundCount} of {totalCount} words</span>
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

  .status {
    font-size: 1.1rem;
    opacity: 0.85;
  }
</style>
