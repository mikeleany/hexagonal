<script lang="ts">
  import { groupWordsByLength } from './wordGrouping';
  import { isRareWord } from './scoring';

  let { wordList, foundWords }: { wordList: readonly string[]; foundWords: readonly string[] } =
    $props();

  let grouped = $state(true);

  let groups = $derived(groupWordsByLength(wordList, foundWords));
  let flatFound = $derived([...foundWords].sort());
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
            {group.length} letters ({group.foundCount}/{group.totalCount})
          </div>
          <ul>
            {#each group.found as word (word)}
              <li class:rare={isRareWord(word)}>{isRareWord(word) ? '★ ' : ''}{word}</li>
            {/each}
          </ul>
        </div>
      {/each}
    {:else}
      <ul>
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
  }

  .group {
    margin-bottom: 1em;
  }

  .group-header {
    font-weight: 600;
    opacity: 0.75;
    font-size: 0.9rem;
    margin-bottom: 0.25em;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    columns: 6em;
    column-gap: 1em;
  }

  li {
    padding: 0.15em 0;
    break-inside: avoid;
  }

  li.rare {
    color: #f4d35e;
  }
</style>
