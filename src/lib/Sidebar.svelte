<script lang="ts">
  import { groupWordsByLength, buildWordEntries, type WordEntry } from './wordGrouping';
  import {
    isRareWord,
    getCommonWords,
    isHintsUnlockThresholdReached,
    isCommonWordCompletionReached,
  } from './scoring';
  import { hintThreshold, hintString } from './hints';

  let { wordList, foundWords }: { wordList: readonly string[]; foundWords: readonly string[] } =
    $props();

  let grouped = $state(true);
  // Never persisted -- hints are only shown when the player makes a
  // conscious choice to enable them, each session.
  let hintsEnabled = $state(false);

  // The star + non-breaking space prefix on rare words (~2.3ch in practice)
  // needs its own allowance beyond the 1ch general safety margin, or a
  // starred entry's column is sized as if the word had no prefix at all.
  const RARE_PREFIX_CH = 3;

  let commonWords = $derived(new Set(getCommonWords(wordList)));
  let commonFoundCount = $derived(foundWords.filter((w) => commonWords.has(w)).length);
  let hintsUnlocked = $derived(isHintsUnlockThresholdReached(foundWords, wordList));
  let hintThresholdT = $derived(hintThreshold(commonFoundCount, commonWords.size));
  let allCommonWordsFound = $derived(isCommonWordCompletionReached(foundWords, wordList));

  let groups = $derived(
    groupWordsByLength(wordList, foundWords, hintsEnabled, allCommonWordsFound),
  );
  let flatEntries = $derived(
    buildWordEntries(wordList, foundWords, hintsEnabled, allCommonWordsFound),
  );
  // Sizes columns against the full solution (wordList), not just found
  // words, so column widths never shift as the player finds more words --
  // only window resizing should reflow the layout.
  let maxWordLength = $derived(wordList.reduce((max, w) => Math.max(max, w.length), 0));
  let flatHasRare = $derived(wordList.some((w) => isRareWord(w)));

  function columnWidthCh(length: number, hasRare: boolean): number {
    return length + (hasRare ? RARE_PREFIX_CH : 1);
  }

  function displayText(entry: WordEntry): string {
    return entry.found ? entry.word : hintString(entry.word, hintThresholdT);
  }
</script>

<div class="sidebar">
  <label class="toggle">
    <input type="checkbox" bind:checked={grouped} />
    Group by length
  </label>
  <label class="toggle" class:disabled={!hintsUnlocked}>
    <input type="checkbox" bind:checked={hintsEnabled} disabled={!hintsUnlocked} />
    Enable hints
  </label>

  <div class="word-list">
    {#if grouped}
      {#each groups as group (group.length)}
        <div class="group">
          <div class="group-header">
            {group.length} letters — {group.commonFoundCount}/{group.commonTotalCount} ({group.foundCount}/{group.totalCount}
            total)
          </div>
          <ul
            style="grid-template-columns: repeat(auto-fill, minmax({columnWidthCh(
              group.length,
              group.hasRare,
            )}ch, 1fr))"
          >
            {#each group.entries as entry (entry.word)}
              {@const rare = isRareWord(entry.word)}
              <li class:rare class:unfound={!entry.found}>{rare ? '★ ' : ''}{displayText(entry)}</li>
            {/each}
          </ul>
        </div>
      {/each}
    {:else}
      <ul
        style="grid-template-columns: repeat(auto-fill, minmax({columnWidthCh(
          maxWordLength,
          flatHasRare,
        )}ch, 1fr))"
      >
        {#each flatEntries as entry (entry.word)}
          {@const rare = isRareWord(entry.word)}
          <li class:rare class:unfound={!entry.found}>{rare ? '★ ' : ''}{displayText(entry)}</li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 0.5em;
    flex: 0 0 auto;
    padding-bottom: 0.75em;
    cursor: pointer;
    user-select: none;
  }

  .toggle.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .word-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    /* Reserves the vertical scrollbar's width whether or not it's actually
       showing, so column widths are computed against a stable content width
       instead of shifting once a scrollbar appears. */
    scrollbar-gutter: stable;
    /* Grid track sizing can still round a column a pixel or two past the
       container edge; there's nothing meaningful to reach by scrolling
       horizontally, so just clip it instead of showing a scrollbar. */
    overflow-x: hidden;
  }

  .group {
    margin-bottom: 1em;
  }

  .group-header {
    font-weight: 600;
    opacity: 0.95;
    font-size: 0.9rem;
    margin-bottom: 0.25em;
  }

  ul {
    display: grid;
    list-style: none;
    margin: 0;
    padding: 0;
    column-gap: 1em;
  }

  li {
    padding: 0.15em 0;
  }

  li.rare {
    color: #f4d35e;
    opacity: 0.95;
  }

  li.unfound {
    opacity: 0.5;
    letter-spacing: 0.1em;
  }
</style>
