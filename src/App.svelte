<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import HexGrid from './lib/HexGrid.svelte';
  import TitleBar from './lib/TitleBar.svelte';
  import SelectionDisplay from './lib/SelectionDisplay.svelte';
  import Sidebar from './lib/Sidebar.svelte';
  import StatsModal from './lib/StatsModal.svelte';
  import { generateDailyPuzzle, type DailyPuzzle } from './lib/dailyPuzzle';
  import { generateHexCoords, tileId, type Tile, type WordSubmission } from './lib/hexGeometry';
  import { getMountainTimeDateString } from './lib/prng';
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
  import { ensureDayStarted, recordCompletion, updateTodaySnapshot, type Stats } from './lib/stats';
  import { loadStats, saveStats } from './lib/statsStorage';

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

  // Captured once and reused for both stats and puzzle generation (the
  // latter happens later, inside onMount's setTimeout -- see below). Using
  // two separate `new Date()` calls could disagree if that timeout gets
  // delayed across a Mountain-Time midnight boundary (e.g. a backgrounded/
  // throttled tab), leaving stats keyed to a different day than the puzzle
  // actually generated -- which can double-count a day's score once that
  // mismatch gets finalized on a later reload.
  const sessionDate = new Date();

  // Resolved synchronously (not inside the puzzle-seeding $effect below):
  // stats has no dependency on puzzle/puzzleId at all -- it's keyed off the
  // calendar date -- so finalizing it before any effect exists sidesteps
  // any ordering hazard with the stats-persistence effect further down.
  let stats = $state<Stats>(ensureDayStarted(loadStats(), getMountainTimeDateString(sessionDate)));

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

    // Reconciles stats with progress that was restored from storage rather
    // than earned this session -- handleWordSubmit is the only other place
    // stats gets updated, so without this, a puzzle whose progress was
    // entirely restored (e.g. every existing player the first time this
    // feature ships) would leave stats.today* at zero/false, causing
    // tomorrow's finalization to wrongly break an already-completed streak
    // and drop today's score out of the lifetime totals. Wrapped in
    // untrack: this effect must depend only on puzzle (it's one-shot --
    // puzzle only ever transitions null -> a value, once, for the life of
    // the component). Reading stats here without untrack would make this
    // effect also depend on stats, which it then writes -- causing it to
    // re-run on every later handleWordSubmit-driven stats change and
    // stomp live progress back to this restored snapshot.
    const currentPuzzle = puzzle;
    untrack(() => {
      const commonTotal = commonWordSet.size;
      const allTotal = currentPuzzle.wordList.length;
      const commonFoundNow = restored.filter((w) => commonWordSet.has(w)).length;
      stats = updateTodaySnapshot(stats, {
        score,
        commonPercent: commonTotal > 0 ? (commonFoundNow / commonTotal) * 100 : 0,
        allPercent: allTotal > 0 ? (restored.length / allTotal) * 100 : 0,
      });
      // Guarded by stats.today*Complete rather than
      // commonBonusAwarded/allBonusAwarded alone so this is a no-op when
      // stats already reflects today's progress (e.g. a same-day reload
      // after live play already recorded it) -- otherwise the streak
      // would be double-incremented for the same day.
      if (commonBonusAwarded && !stats.todayCommonComplete) {
        stats = recordCompletion(stats, 'common');
      }
      if (allBonusAwarded && !stats.todayAllComplete) {
        stats = recordCompletion(stats, 'all');
      }
    });
  });

  $effect(() => {
    if (puzzle) saveFoundWords(foundWords, puzzle.puzzleId);
  });

  $effect(() => {
    saveStats(stats);
  });

  onMount(() => {
    // Deferred rather than computed at module load: construction takes
    // ~50-90ms (see boardConstruction.bench.ts), long enough to noticeably
    // block first paint if it ran synchronously before mount. The
    // setTimeout lets the browser paint the empty board first, then this
    // runs and swaps in the real one.
    const timeoutId = setTimeout(() => {
      puzzle = generateDailyPuzzle(sessionDate);
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
  let hintsAvailableToken = $state(0);
  let showStatsModal = $state(false);

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
      if (!commonBonusAwarded && isCommonWordCompletionReached(foundWords, puzzle.wordList)) {
        score += COMMON_WORD_COMPLETION_BONUS;
        commonBonusAwarded = true;
        // Guarded by stats.todayCommonComplete, not just the puzzle-local
        // commonBonusAwarded flag above -- the streak is persisted per
        // calendar day, independent of which puzzle is currently loaded,
        // so a same-day puzzle regeneration/reload can reset
        // commonBonusAwarded to false while stats.todayCommonComplete is
        // already true from earlier today. Without this guard, completing
        // the new puzzle would double-increment the same day's streak.
        if (!stats.todayCommonComplete) {
          stats = recordCompletion(stats, 'common');
        }
        showStatsModal = true;
      }
      if (!allBonusAwarded && isAllWordsCompletionReached(foundWords, puzzle.wordList)) {
        score += ALL_WORDS_COMPLETION_BONUS;
        allBonusAwarded = true;
        // See the matching comment above for the common-words case.
        if (!stats.todayAllComplete) {
          stats = recordCompletion(stats, 'all');
        }
        showStatsModal = true;
      }
      if (!hintsUnlocked && isHintsUnlockThresholdReached(foundWords, puzzle.wordList)) {
        hintsUnlocked = true;
        hintsAvailableToken += 1;
      }

      const commonTotal = commonWordSet.size;
      const allTotal = puzzle.wordList.length;
      const commonFoundNow = foundWords.filter((w) => commonWordSet.has(w)).length;
      stats = updateTodaySnapshot(stats, {
        score,
        commonPercent: commonTotal > 0 ? (commonFoundNow / commonTotal) * 100 : 0,
        allPercent: allTotal > 0 ? (foundWords.length / allTotal) * 100 : 0,
      });
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
    {hintsAvailableToken}
    {commonBonusAwarded}
    {allBonusAwarded}
    onOpenStats={() => (showStatsModal = true)}
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

{#if showStatsModal}
  <StatsModal
    {stats}
    {commonBonusAwarded}
    {allBonusAwarded}
    commonBonusAmount={COMMON_WORD_COMPLETION_BONUS}
    allBonusAmount={ALL_WORDS_COMPLETION_BONUS}
    {score}
    onDismiss={() => (showStatsModal = false)}
  />
{/if}

<style>
  main {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: clamp(0.5rem, 4vmin, 1rem);
    gap: clamp(0.75rem, 5vmin, 1.25rem);
  }

  .play-area {
    display: flex;
    flex: 1;
    min-height: 0;
    gap: clamp(0.75rem, 5vmin, 1.25rem);
  }

  /* Groups the live-selection readout with the grid (not the sidebar) so
     centering it horizontally lines it up with the board, not the whole row. */
  .board-column {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
    gap: clamp(0.75rem, 5vmin, 1.25rem);
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
