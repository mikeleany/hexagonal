<script lang="ts">
  let {
    bonusAmount,
    finalScore,
    onDismiss,
  }: { bonusAmount: number; finalScore: number; onDismiss: () => void } = $props();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onDismiss();
    }
  }
</script>

<div
  class="overlay"
  role="button"
  tabindex="0"
  aria-label="Dismiss"
  onclick={onDismiss}
  onkeydown={handleKeydown}
>
  <div class="card">
    <div class="star">★</div>
    <div class="headline">All words found!</div>
    <div class="detail">+{bonusAmount.toLocaleString()} bonus &middot; final score {finalScore.toLocaleString()}</div>
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
    max-width: 320px;
    cursor: default;
  }

  .star {
    font-size: 2rem;
    color: #f4d35e;
  }

  .headline {
    color: #f4d35e;
    font-size: 1.3rem;
    font-weight: 700;
    margin-top: 0.5rem;
  }

  .detail {
    color: #f5f5f5;
    opacity: 0.85;
    font-size: 0.95rem;
    margin-top: 0.25rem;
  }
</style>
