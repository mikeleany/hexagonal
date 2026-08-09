<script lang="ts">
  import { groupWordsByLength } from './wordGrouping';
  import { isRareWord } from './scoring';

  let { wordList, foundWords }: { wordList: readonly string[]; foundWords: readonly string[] } =
    $props();

  let grouped = $state(true);

  // The star + non-breaking space prefix on rare words (~2.3ch in practice)
  // needs its own allowance beyond the 1ch general safety margin, or a
  // starred entry's column is sized as if the word had no prefix at all.
  const RARE_PREFIX_CH = 3;

  let groups = $derived(groupWordsByLength(wordList, foundWords));
  let flatFound = $derived([...foundWords].sort());
  // Sizes the flat (ungrouped) view's column width to the longest *found*
  // word, since that view mixes lengths and can't size per-group like the
  // grouped view below. Deliberately uses foundWords, not wordList -- sizing
  // against the puzzle's longest word overall (often the planted 19-letter
  // word) would oversize every column even when nothing that long has been
  // found yet, wasting space and forcing fewer columns than necessary.
  let maxWordLength = $derived(Math.max(0, ...foundWords.map((w) => w.length)));
  let flatHasRare = $derived(foundWords.some((w) => isRareWord(w)));

  function columnWidthCh(length: number, hasRare: boolean): number {
    return length + (hasRare ? RARE_PREFIX_CH : 1);
  }
</script>

<div class="sidebar">
  <label class="toggle">
    <input type="checkbox" bind:checked={grouped} />
    Group by length
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
            style="column-width: {columnWidthCh(
              group.length,
              group.found.some((w) => isRareWord(w)),
            )}ch"
          >
            {#each group.found as word (word)}
              <li class:rare={isRareWord(word)}>{isRareWord(word) ? '★ ' : ''}{word}</li>
            {/each}
          </ul>
        </div>
      {/each}
    {:else}
      <ul style="column-width: {columnWidthCh(maxWordLength, flatHasRare)}ch">
        {#each flatFound as word (word)}
          <li class:rare={isRareWord(word)}>{isRareWord(word) ? '★ ' : ''}{word}</li>
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

  .word-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    /* Reserves the vertical scrollbar's width whether or not it's actually
       showing, so column widths are computed against a stable content width
       instead of shifting once a scrollbar appears. */
    scrollbar-gutter: stable;
    /* Multi-column layout can still round a column a pixel or two past the
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
    list-style: none;
    margin: 0;
    padding: 0;
    column-gap: 1em;
  }

  li {
    padding: 0.15em 0;
    break-inside: avoid;
  }

  li.rare {
    color: #f4d35e;
    opacity: 0.95;
  }
</style>
