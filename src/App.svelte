<script lang="ts">
  import HexGrid from './lib/HexGrid.svelte';
  import TitleBar from './lib/TitleBar.svelte';
  import SelectionDisplay from './lib/SelectionDisplay.svelte';
  import Sidebar from './lib/Sidebar.svelte';
  import { DAILY_TILES, DAILY_WORD_LIST } from './lib/dailyPuzzle';
  import type { Tile, WordSubmission } from './lib/hexGeometry';
  import { loadFoundWords, saveFoundWords } from './lib/progressStorage';

  const wordSet = new Set(DAILY_WORD_LIST);

  let selectionPath = $state<Tile[]>([]);
  let liveLetters = $derived(selectionPath.map((t) => t.letter).join(''));

  let foundWords = $state<string[]>(loadFoundWords());

  $effect(() => {
    saveFoundWords(foundWords);
  });

  let rejectedToken = $state(0);
  let resultToken = $state(0);
  let lastResultWord = $state('');
  let lastResultAccepted = $state(false);

  function handleSelectionChange(path: Tile[]) {
    selectionPath = path;
  }

  function handleWordSubmit(submission: WordSubmission) {
    const { word } = submission;
    const isValid = wordSet.has(word);
    lastResultWord = word;
    lastResultAccepted = isValid;
    resultToken += 1;
    if (isValid) {
      if (!foundWords.includes(word)) foundWords = [...foundWords, word];
    } else {
      rejectedToken += 1;
    }
  }
</script>

<main>
  <TitleBar foundCount={foundWords.length} totalCount={DAILY_WORD_LIST.length} />
  <div class="play-area">
    <div class="board-column">
      <SelectionDisplay
        {liveLetters}
        resultWord={lastResultWord}
        resultAccepted={lastResultAccepted}
        {resultToken}
      />
      <div class="grid-wrap">
        <HexGrid
          tiles={DAILY_TILES}
          onSelectionChange={handleSelectionChange}
          onWordSubmit={handleWordSubmit}
          {rejectedToken}
        />
      </div>
    </div>
    <div class="sidebar-wrap">
      <Sidebar wordList={DAILY_WORD_LIST} {foundWords} />
    </div>
  </div>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 4vmin;
    gap: 5vmin;
  }

  .play-area {
    display: flex;
    flex: 1;
    min-height: 0;
    gap: 5vmin;
  }

  /* Groups the live-selection readout with the grid (not the sidebar) so
     centering it horizontally lines it up with the board, not the whole row. */
  .board-column {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
    gap: 5vmin;
  }

  .grid-wrap {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .sidebar-wrap {
    flex: 0 0 clamp(220px, 25vw, 320px);
    min-height: 0;
  }

  @media (max-width: 700px) {
    .play-area {
      flex-direction: column;
    }

    .board-column {
      flex: 1 1 auto;
      min-height: 30vh;
    }

    /* Fixed height (not content-hugging) so the number of found words never
       changes how much room the grid gets — only window resizing should. */
    .sidebar-wrap {
      flex: 0 0 30vh;
      width: 100%;
    }
  }
</style>
