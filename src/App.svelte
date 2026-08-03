<script lang="ts">
  import HexGrid from './lib/HexGrid.svelte';
  import TitleBar from './lib/TitleBar.svelte';
  import SelectionDisplay from './lib/SelectionDisplay.svelte';
  import Sidebar from './lib/Sidebar.svelte';
  import { BOARD_TILES } from './lib/board';
  import { WORD_LIST } from './lib/wordList';
  import type { Tile, WordSubmission } from './lib/hexGeometry';

  let selectionPath = $state<Tile[]>([]);
  let liveLetters = $derived(selectionPath.map((t) => t.letter).join(''));

  let foundWords = $state<string[]>([]);
  let rejectedToken = $state(0);
  let resultToken = $state(0);
  let lastResultWord = $state('');
  let lastResultAccepted = $state(false);

  function handleSelectionChange(path: Tile[]) {
    selectionPath = path;
  }

  function handleWordSubmit(submission: WordSubmission) {
    const { word } = submission;
    const isValid = WORD_LIST.includes(word);
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
  <TitleBar foundCount={foundWords.length} totalCount={WORD_LIST.length} />
  <SelectionDisplay
    {liveLetters}
    resultWord={lastResultWord}
    resultAccepted={lastResultAccepted}
    {resultToken}
  />
  <div class="play-area">
    <div class="grid-wrap">
      <HexGrid
        tiles={BOARD_TILES}
        onSelectionChange={handleSelectionChange}
        onWordSubmit={handleWordSubmit}
        {rejectedToken}
      />
    </div>
    <div class="sidebar-wrap">
      <Sidebar wordList={WORD_LIST} {foundWords} />
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
    gap: 1.5vmin;
  }

  .play-area {
    display: flex;
    flex: 1;
    min-height: 0;
    gap: 2vmin;
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

    .grid-wrap {
      flex: 1 1 auto;
      min-height: 30vh;
    }

    .sidebar-wrap {
      flex: 0 0 auto;
      width: 100%;
      max-height: 35vh;
    }
  }
</style>
