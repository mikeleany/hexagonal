<script lang="ts">
  import HexGrid from './lib/HexGrid.svelte';
  import TitleBar from './lib/TitleBar.svelte';
  import SelectionDisplay from './lib/SelectionDisplay.svelte';
  import Sidebar from './lib/Sidebar.svelte';
  import CompletionOverlay from './lib/CompletionOverlay.svelte';
  import { DAILY_TILES, DAILY_WORD_LIST } from './lib/dailyPuzzle';
  import type { Tile, WordSubmission } from './lib/hexGeometry';
  import {
    getWordScore,
    getScoringState,
    getCommonWords,
    isCommonWordCompletionReached,
    isAllWordsCompletionReached,
    COMMON_WORD_COMPLETION_BONUS,
    ALL_WORDS_COMPLETION_BONUS,
  } from './lib/scoring';
  import { loadFoundWords, saveFoundWords } from './lib/progressStorage';

  // Case-insensitive lookup from a submitted word to its canonical casing in
  // DAILY_WORD_LIST (matches the dictionary source, not the uppercase tiles
  // submissions are built from — see handleWordSubmit).
  const wordMap = new Map(DAILY_WORD_LIST.map((w) => [w.toLowerCase(), w]));
  const commonWordSet = new Set(getCommonWords(DAILY_WORD_LIST));

  let selectionPath = $state<Tile[]>([]);
  let liveLetters = $derived(selectionPath.map((t) => t.letter).join(''));

  // Filter against wordMap, not just the date: a mid-day redeploy could change
  // DAILY_WORD_LIST, and localStorage is untrusted external state generally.
  // Also canonicalizes casing, in case progress was saved before DAILY_WORD_LIST's
  // casing matched the dictionary.
  let foundWords = $state<string[]>([
    ...new Set(
      loadFoundWords()
        .map((w) => wordMap.get(w.toLowerCase()))
        .filter((w): w is string => w !== undefined),
    ),
  ]);
  let commonFoundCount = $derived(foundWords.filter((w) => commonWordSet.has(w)).length);

  // Seed from any restored progress so a returning player's score/bonus
  // state reflects prior progress immediately, not just their next
  // submission. handleWordSubmit below keeps updating these incrementally,
  // so only the initial value of foundWords should be captured here.
  // svelte-ignore state_referenced_locally -- intentional: snapshot the initial value only
  const initialScoring = getScoringState(foundWords, DAILY_WORD_LIST);
  let score = $state(initialScoring.score);
  let commonBonusAwarded = $state(initialScoring.commonWordsComplete);
  let allBonusAwarded = $state(initialScoring.allWordsComplete);

  $effect(() => {
    saveFoundWords(foundWords);
  });

  let rejectedToken = $state(0);
  let resultToken = $state(0);
  let lastResultWord = $state('');
  let lastResultState = $state<'accepted' | 'rejected' | 'duplicate'>('rejected');
  let commonBonusToken = $state(0);
  let showCompletionOverlay = $state(false);

  function handleSelectionChange(path: Tile[]) {
    selectionPath = path;
  }

  function handleWordSubmit(submission: WordSubmission) {
    const { word } = submission;
    const canonical = wordMap.get(word.toLowerCase());
    lastResultWord = word;
    resultToken += 1;
    if (canonical === undefined) {
      lastResultState = 'rejected';
      rejectedToken += 1;
    } else if (foundWords.includes(canonical)) {
      lastResultState = 'duplicate';
    } else {
      lastResultState = 'accepted';
      foundWords = [...foundWords, canonical];
      score += getWordScore(canonical);
      if (!commonBonusAwarded && isCommonWordCompletionReached(foundWords, DAILY_WORD_LIST)) {
        score += COMMON_WORD_COMPLETION_BONUS;
        commonBonusAwarded = true;
        commonBonusToken += 1;
      }
      if (!allBonusAwarded && isAllWordsCompletionReached(foundWords, DAILY_WORD_LIST)) {
        score += ALL_WORDS_COMPLETION_BONUS;
        allBonusAwarded = true;
        showCompletionOverlay = true;
      }
    }
  }
</script>

<main>
  <TitleBar
    {commonFoundCount}
    commonTotalCount={commonWordSet.size}
    foundCount={foundWords.length}
    totalCount={DAILY_WORD_LIST.length}
    {score}
    {commonBonusToken}
    {commonBonusAwarded}
    {allBonusAwarded}
    commonBonusAmount={COMMON_WORD_COMPLETION_BONUS}
  />
  <div class="play-area">
    <div class="board-column">
      <SelectionDisplay
        {liveLetters}
        resultWord={lastResultWord}
        resultState={lastResultState}
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

{#if showCompletionOverlay}
  <CompletionOverlay
    bonusAmount={ALL_WORDS_COMPLETION_BONUS}
    finalScore={score}
    onDismiss={() => (showCompletionOverlay = false)}
  />
{/if}

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

  /* Fixed (not viewport-scaled) width, wide enough that two side-by-side
     19-letter word columns (22ch each, including the rare-word star prefix
     allowance -- see Sidebar.svelte's RARE_PREFIX_CH) never overlap even
     with the vertical scrollbar's gutter reserved: 2 * 22ch (176px) + 1em
     gap (16px) + scrollbar gutter (15px) = 383px needed, plus margin. */
  .sidebar-wrap {
    flex: 0 0 410px;
    min-width: 0;
    min-height: 0;
  }

  /* Threshold below which the 410px sidebar would take up more than 40%
     of the viewport width. */
  @media (max-width: calc(410px / 0.40)) {
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
