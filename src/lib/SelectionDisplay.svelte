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

  let displayText = $derived(
    liveLetters.length > 0 ? liveLetters : linger ? resultWord : "",
  );
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
    --text-size: clamp(1.5rem, 5vmin, 3rem);
    display: flex;
    justify-content: center;
    align-items: center;
    /* Fixed height (not min-height) so an empty vs. filled selection never
       reflows the layout below it — only window resizing should do that. */
    height: var(--text-size);
  }

  .text {
    font-size: var(--text-size);
    line-height: 1;
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
