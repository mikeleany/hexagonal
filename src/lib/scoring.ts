/**
 * PLACEHOLDER CONSTANT — reproduces the old continuous-rarity formula's
 * bonus at rarity 1.0 (2.4 * (1.0 - 0.7) = 0.72) as a starting point for the
 * binary common/rare model, not yet validated against real puzzle totals.
 * Revisit once we've checked what a full day's word list actually scores.
 *
 * RARE_BONUS_K controls how sharply the rare-word bonus scales with word
 * length. Common words score as pure length, no bonus.
 */
export const RARE_BONUS_K = 0.72;
export const COMMON_WORD_COMPLETION_BONUS = 1500;
export const ALL_WORDS_COMPLETION_BONUS = 3000;

/**
 * Rarity is taken as an explicit parameter (lowercased rare words) rather
 * than read from the bundled dictionary, so it comes from the puzzle's own
 * frozen data (see puzzleLoader.ts) instead of whatever dictionary happens
 * to be live -- a same-day dictionary/blacklist regeneration must not be
 * able to shift an already-served puzzle's scoring or completion bonuses.
 */
function isRare(word: string, rareWords: ReadonlySet<string>): boolean {
  return rareWords.has(word.toLowerCase());
}

/** score(word) = round(10 * length * (1 + (rare ? RARE_BONUS_K : 0) * log10(length))) */
export function getWordScore(word: string, rareWords: ReadonlySet<string>): number {
  const length = word.length;
  const multiplier = 1 + (isRare(word, rareWords) ? RARE_BONUS_K : 0) * Math.log10(length);
  return Math.round(10 * length * multiplier);
}

/** Common (non-rare) words in `wordList`. */
export function getCommonWords(wordList: readonly string[], rareWords: ReadonlySet<string>): string[] {
  return wordList.filter((word) => !isRare(word, rareWords));
}

/** True for rare words (the inverse of `getCommonWords`'s filter). */
export function isRareWord(word: string, rareWords: ReadonlySet<string>): boolean {
  return isRare(word, rareWords);
}

/** True once every common word in `wordList` has been found. */
export function isCommonWordCompletionReached(
  foundWords: readonly string[],
  wordList: readonly string[],
  rareWords: ReadonlySet<string>,
): boolean {
  const common = getCommonWords(wordList, rareWords);
  if (common.length === 0) return false;
  const foundLower = new Set(foundWords.map((word) => word.toLowerCase()));
  return common.every((word) => foundLower.has(word.toLowerCase()));
}

/** True once every word in `wordList` has been found. */
export function isAllWordsCompletionReached(
  foundWords: readonly string[],
  wordList: readonly string[],
): boolean {
  if (wordList.length === 0) return false;
  const foundLower = new Set(foundWords.map((word) => word.toLowerCase()));
  return wordList.every((word) => foundLower.has(word.toLowerCase()));
}

export type ScoringState = {
  score: number;
  commonWordsComplete: boolean;
  allWordsComplete: boolean;
};

/** Sums every found word's score and checks both completion bonuses in one
 * pass. Used once on load to seed state from restored `foundWords` — not
 * called again on every submission, since `App.svelte` keeps bookkeeping
 * score/bonus state incrementally from there. */
export function getScoringState(
  foundWords: readonly string[],
  wordList: readonly string[],
  rareWords: ReadonlySet<string>,
): ScoringState {
  const commonWordsComplete = isCommonWordCompletionReached(foundWords, wordList, rareWords);
  const allWordsComplete = isAllWordsCompletionReached(foundWords, wordList);
  let score = foundWords.reduce((sum, word) => sum + getWordScore(word, rareWords), 0);
  if (commonWordsComplete) score += COMMON_WORD_COMPLETION_BONUS;
  if (allWordsComplete) score += ALL_WORDS_COMPLETION_BONUS;
  return { score, commonWordsComplete, allWordsComplete };
}
