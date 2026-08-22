<script lang="ts">
  import type { Stats } from './stats';

  let {
    stats,
    commonBonusAwarded,
    allBonusAwarded,
    commonBonusAmount,
    allBonusAmount,
    score,
    onDismiss,
  }: {
    stats: Stats;
    commonBonusAwarded: boolean;
    allBonusAwarded: boolean;
    commonBonusAmount: number;
    allBonusAmount: number;
    score: number;
    onDismiss: () => void;
  } = $props();

  // Moves focus into the overlay as soon as it mounts, so keyboard users
  // don't have to blindly tab to find it before they can dismiss it, and
  // restores focus to whatever was focused before (e.g. the stats button)
  // on dismiss -- otherwise focus drops to the document body and the next
  // Tab jumps back to the start of the page.
  let overlayEl: HTMLDivElement | undefined = $state();
  $effect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlayEl?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  });

  // Only dismisses on a genuine backdrop click -- e.target === e.currentTarget
  // excludes clicks that bubbled up from the card (its content, including
  // scroll attempts on short viewports where the card scrolls internally).
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      onDismiss();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
      e.preventDefault();
      onDismiss();
      return;
    }
    // The overlay is the only focusable element it contains, so trap Tab
    // here rather than letting focus escape to controls behind it.
    if (e.key === 'Tab') {
      e.preventDefault();
    }
  }

  // Includes today's live (not-yet-finalized) snapshot, since today always
  // counts as played the moment the puzzle is open -- so the denominator is
  // always daysPlayed + 1, never just daysPlayed.
  let avgCommonPercent = $derived(
    Math.round((stats.lifetimeCommonPercentSum + stats.todayCommonPercent) / (stats.daysPlayed + 1)),
  );
  let avgAllPercent = $derived(
    Math.round((stats.lifetimeAllPercentSum + stats.todayAllPercent) / (stats.daysPlayed + 1)),
  );
  let lifetimeScore = $derived(stats.lifetimeScore + stats.todayScore);
</script>

<div
  bind:this={overlayEl}
  class="overlay"
  role="dialog"
  aria-modal="true"
  aria-labelledby="stats-headline"
  tabindex="-1"
  onclick={handleBackdropClick}
  onkeydown={handleKeydown}
>
  <div class="card">
    {#if allBonusAwarded}
      <div class="star">★</div>
      <div class="celebration-headline">All words found!</div>
      <div class="celebration-detail">
        +{allBonusAmount.toLocaleString()} bonus &middot; score {score.toLocaleString()}
      </div>
    {:else if commonBonusAwarded}
      <div class="star">★</div>
      <div class="celebration-headline">Common words complete!</div>
      <div class="celebration-detail">+{commonBonusAmount.toLocaleString()} bonus</div>
    {/if}

    <div class="headline" id="stats-headline">Your Stats</div>
    <div class="stat-grid">
      <div class="stat">
        <div class="stat-value">{stats.currentCommonStreak}</div>
        <div class="stat-label">Common-words streak</div>
      </div>
      <div class="stat">
        <div class="stat-value">{stats.currentAllStreak}</div>
        <div class="stat-label">All-words streak</div>
      </div>
      <div class="stat">
        <div class="stat-value">{stats.longestCommonStreak}</div>
        <div class="stat-label">Longest common-words streak</div>
      </div>
      <div class="stat">
        <div class="stat-value">{stats.longestAllStreak}</div>
        <div class="stat-label">Longest all-words streak</div>
      </div>
      <div class="stat">
        <div class="stat-value">{avgCommonPercent}%</div>
        <div class="stat-label">Avg. common words/day</div>
      </div>
      <div class="stat">
        <div class="stat-value">{avgAllPercent}%</div>
        <div class="stat-label">Avg. all words/day</div>
      </div>
      <div class="stat stat-wide">
        <div class="stat-value">{lifetimeScore.toLocaleString()}</div>
        <div class="stat-label">Lifetime score</div>
      </div>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
  }

  .card {
    background: #282c34;
    border: 2px solid #f4d35e;
    border-radius: 12px;
    padding: 2rem 2.5rem;
    text-align: center;
    width: min(420px, calc(100vw - 2rem));
    max-height: 90vh;
    overflow-y: auto;
    cursor: default;
  }

  .star {
    font-size: 2rem;
    color: #f4d35e;
  }

  .celebration-headline {
    color: #f4d35e;
    font-size: 1.3rem;
    font-weight: 700;
    margin-top: 0.5rem;
  }

  .celebration-detail {
    color: #f5f5f5;
    opacity: 0.85;
    font-size: 0.95rem;
    margin-top: 0.25rem;
    margin-bottom: 1.5rem;
  }

  .headline {
    color: #f4d35e;
    font-size: 1.3rem;
    font-weight: 700;
    margin-bottom: 1.25rem;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.25rem 1.5rem;
  }

  /* No fixed track minimum below this width -- prevents the grid from
     forcing the card wider than narrow phone viewports (e.g. 320px). */
  @media (max-width: 400px) {
    .card {
      padding: 1.5rem 1.25rem;
    }
  }

  .stat-wide {
    grid-column: 1 / -1;
  }

  .stat-value {
    color: #f4d35e;
    font-size: 1.4rem;
    font-weight: 700;
  }

  .stat-label {
    color: #f5f5f5;
    opacity: 0.85;
    font-size: 0.8rem;
    margin-top: 0.15rem;
  }
</style>
