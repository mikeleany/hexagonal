<script lang="ts">
  import { onMount } from 'svelte';
  import HexGrid from './lib/HexGrid.svelte';
  import TitleBar from './lib/TitleBar.svelte';
  import SelectionDisplay from './lib/SelectionDisplay.svelte';
  import Sidebar from './lib/Sidebar.svelte';
  import CompletionOverlay from './lib/CompletionOverlay.svelte';
  import { generateDailyPuzzle, type DailyPuzzle } from './lib/dailyPuzzle';
  import { generateHexCoords, tileId, type Tile, type WordSubmission } from './lib/hexGeometry';
  import {
    getWordScore,
    getScoringState,
    getCommonWords,
    isCommonWordCompletionReached,
    isAllWordsCompletionReached,
    isHintsUnlockThresholdReached,
    COMMON_WORD_COMPLETION_BONUS,
    ALL_WORDS_COMPLETION_BONUS,
  } from './lib/scoring';
  import { loadFoundWords, saveFoundWords } from './lib/progressStorage';

  // Real board geometry with blank letters, shown until the actual puzzle
  // finishes generating (see onMount below) — same 19-tile shape every day,
  // so this is cheap to compute up front and needs no dictionary/backtracking.
  const EMPTY_TILES: Tile[] = generateHexCoords(2).map((coord) => ({
    id: tileId(coord),
    q: coord.q,
    r: coord.r,
    letter: '',
  }));

  let puzzle = $state<DailyPuzzle | null>(null);

  // Case-insensitive lookup from a submitted word to its canonical casing in
  // the word list (matches the dictionary source, not the uppercase tiles
  // submissions are built from — see handleWordSubmit). Empty until puzzle
  // loads, which also means nothing can match yet — see handleWordSubmit.
  let wordMap = $derived(new Map((puzzle?.wordList ?? []).map((w) => [w.toLowerCase(), w])));
  let commonWordSet = $derived(new Set(getCommonWords(puzzle?.wordList ?? [])));

  let selectionPath = $state<Tile[]>([]);
  let liveLetters = $derived(selectionPath.map((t) => t.letter).join(''));

  let foundWords = $state<string[]>([]);
  let commonFoundCount = $derived(foundWords.filter((w) => commonWordSet.has(w)).length);

  let score = $state(0);
  let commonBonusAwarded = $state(false);
  let allBonusAwarded = $state(false);
  let hintsUnlocked = $state(false);

  // One-shot: seeds every puzzle-dependent piece of state once generation
  // finishes (puzzle only ever transitions null -> a value, never back).
  // Not folded into $derived since foundWords/score/etc. are independently
  // mutable after this point — handleWordSubmit keeps updating them
  // incrementally — not pure functions of puzzle.
  $effect(() => {
    if (!puzzle) return;
    // Filter against wordMap, not just the puzzle id: a mid-day redeploy
    // could change the word list without changing the board, and
    // localStorage is untrusted external state generally. Also
    // canonicalizes casing, in case progress was saved before the word
    // list's casing matched the dictionary.
    const restored = [
      ...new Set(
        loadFoundWords(puzzle.puzzleId)
          .map((w) => wordMap.get(w.toLowerCase()))
          .filter((w): w is string => w !== undefined),
      ),
    ];
    const initialScoring = getScoringState(restored, puzzle.wordList);

    foundWords = restored;
    score = initialScoring.score;
    commonBonusAwarded = initialScoring.commonWordsComplete;
    allBonusAwarded = initialScoring.allWordsComplete;
    hintsUnlocked = isHintsUnlockThresholdReached(restored, puzzle.wordList);
  });

  $effect(() => {
    if (puzzle) saveFoundWords(foundWords, puzzle.puzzleId);
  });

  onMount(() => {
    // Deferred rather than computed at module load: construction takes
    // ~50-90ms (see boardConstruction.bench.ts), long enough to noticeably
    // block first paint if it ran synchronously before mount. The
    // setTimeout lets the browser paint the empty board first, then this
    // runs and swaps in the real one.
    const timeoutId = setTimeout(() => {
      puzzle = generateDailyPuzzle();
    }, 0);
    // Guards against a dev-time HMR teardown racing the pending timeout and
    // firing on a detached component instance -- not a concern in
    // production, where App.svelte mounts once for the page's lifetime.
    return () => clearTimeout(timeoutId);
  });

  let rejectedToken = $state(0);
  let resultToken = $state(0);
  let lastResultWord = $state('');
  let lastResultState = $state<'accepted' | 'rejected' | 'duplicate'>('rejected');
  let commonBonusToken = $state(0);
  let hintsAvailableToken = $state(0);
  let showCompletionOverlay = $state(false);

  function handleSelectionChange(path: Tile[]) {
    selectionPath = path;
  }

  function handleWordSubmit(submission: WordSubmission) {
    // Can't actually happen: wordMap is empty until puzzle loads, so
    // nothing could resolve to a canonical match yet — this just narrows
    // puzzle for TypeScript and is a safe no-op regardless.
    if (!puzzle) return;
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
      let commonBonusJustFired = false;
      if (!commonBonusAwarded && isCommonWordCompletionReached(foundWords, puzzle.wordList)) {
        score += COMMON_WORD_COMPLETION_BONUS;
        commonBonusAwarded = true;
        commonBonusToken += 1;
        commonBonusJustFired = true;
      }
      if (!allBonusAwarded && isAllWordsCompletionReached(foundWords, puzzle.wordList)) {
        score += ALL_WORDS_COMPLETION_BONUS;
        allBonusAwarded = true;
        showCompletionOverlay = true;
      }
      // If a single submission crosses both thresholds at once, the
      // common-bonus banner (tied to a real score bonus) takes priority --
      // the hints banner is skipped in that rare case, though hintsUnlocked
      // still flips true either way so the checkbox unlocks regardless.
      if (!hintsUnlocked && isHintsUnlockThresholdReached(foundWords, puzzle.wordList)) {
        hintsUnlocked = true;
        if (!commonBonusJustFired) hintsAvailableToken += 1;
      }
    }
  }
</script>

<main>
  <TitleBar
    {commonFoundCount}
    commonTotalCount={commonWordSet.size}
    foundCount={foundWords.length}
    totalCount={puzzle?.wordList.length ?? 0}
    {score}
    {commonBonusToken}
    {hintsAvailableToken}
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
          tiles={puzzle?.tiles ?? EMPTY_TILES}
          onSelectionChange={handleSelectionChange}
          onWordSubmit={handleWordSubmit}
          {rejectedToken}
        />
      </div>
    </div>
    <div class="sidebar-wrap">
      <Sidebar wordList={puzzle?.wordList ?? []} {foundWords} />
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
