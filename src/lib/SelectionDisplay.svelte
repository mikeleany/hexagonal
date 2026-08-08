<script lang="ts">
  let {
    liveLetters,
    resultWord,
    resultState,
    resultToken,
  }: {
    liveLetters: string;
    resultWord: string;
    resultState: "accepted" | "rejected" | "duplicate";
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
      // Accepted words hold until the player's next selection begins (see the
      // liveLetters effect below) instead of a fixed timeout, so there's
      // always time to read them. Rejected/duplicate already grab attention
      // via the shake or the "Already Found" text swap, so a short timeout
      // is enough for those.
      if (resultState !== "accepted") {
        lingerTimeoutId = setTimeout(() => {
          linger = false;
        }, 500);
      }
    }
    return () => clearTimeout(lingerTimeoutId);
  });

  // The player starting a new selection always dismisses whatever was
  // lingering -- this is what actually clears an indefinitely-held
  // accepted word once the player moves on.
  $effect(() => {
    if (liveLetters.length > 0) {
      linger = false;
    }
  });

  let heldText = $derived(resultState === "duplicate" ? "Already Found" : resultWord);
  let displayText = $derived(liveLetters.length > 0 ? liveLetters : linger ? heldText : "");
  let showResultColor = $derived(liveLetters.length === 0 && linger);
</script>

<div class="selection-display">
  <span
    class="text"
    class:accepted={showResultColor && resultState === "accepted"}
    class:rejected={showResultColor && resultState === "rejected"}
    class:duplicate={showResultColor && resultState === "duplicate"}
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

  .text.duplicate {
    color: #f5f5f5;
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
