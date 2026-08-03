<script lang="ts">
  let {
    liveLetters,
    resultWord,
    resultAccepted,
    resultToken,
  }: {
    liveLetters: string;
    resultWord: string;
    resultAccepted: boolean;
    resultToken: number;
  } = $props();

  let linger = $state(false);
  let lingerTimeoutId: ReturnType<typeof setTimeout> | undefined;

  // svelte-ignore state_referenced_locally -- intentional: snapshot the initial value only,
  // same rationale as HexGrid's previousRejectedToken (see HexGrid.svelte).
  let previousResultToken = resultToken;
  $effect(() => {
    if (resultToken !== previousResultToken) {
      previousResultToken = resultToken;
      linger = true;
      clearTimeout(lingerTimeoutId);
      lingerTimeoutId = setTimeout(() => {
        linger = false;
      }, 300);
    }
    return () => clearTimeout(lingerTimeoutId);
  });

  let displayText = $derived(liveLetters.length > 0 ? liveLetters : linger ? resultWord : '');
  let showResultColor = $derived(liveLetters.length === 0 && linger);
</script>

<div class="selection-display">
  <span
    class="text"
    class:accepted={showResultColor && resultAccepted}
    class:rejected={showResultColor && !resultAccepted}
  >
    {displayText}
  </span>
</div>

<style>
  .selection-display {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 1.5em;
  }

  .text {
    font-size: clamp(1.5rem, 5vmin, 3rem);
    font-weight: 600;
    white-space: nowrap;
    letter-spacing: 0.05em;
  }

  .text.accepted {
    color: #f4d35e;
  }

  .text.rejected {
    color: #e05555;
    animation: shake 0.3s ease-in-out;
  }

  @keyframes shake {
    0%,
    100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-4px);
    }
    75% {
      transform: translateX(4px);
    }
  }
</style>
