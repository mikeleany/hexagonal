import { loadWordRarities } from "./dictionary";

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
export const HINTS_UNLOCK_RATIO = 0.1;

const RARITY = loadWordRarities();

function isRare(word: string): boolean {
  // Defensive fallback only — every word ever scored comes from
  // DAILY_WORD_LIST, which is derived from this same rarity-backed
  // dictionary, so a miss here should never actually happen in practice.
  return RARITY.get(word.toLowerCase()) ?? true;
}

/** score(word) = round(10 * length * (1 + (rare ? RARE_BONUS_K : 0) * log10(length))) */
export function getWordScore(word: string): number {
  const length = word.length;
  const multiplier = 1 + (isRare(word) ? RARE_BONUS_K : 0) * Math.log10(length);
  return Math.round(10 * length * multiplier);
}

/** Common (non-rare) words in `wordList`. */
export function getCommonWords(wordList: readonly string[]): string[] {
  return wordList.filter((word) => !isRare(word));
}

/** True for rare words (the inverse of `getCommonWords`'s filter). */
export function isRareWord(word: string): boolean {
  return isRare(word);
}

/** True once every common word in `wordList` has been found. */
export function isCommonWordCompletionReached(
  foundWords: readonly string[],
  wordList: readonly string[],
): boolean {
  const common = getCommonWords(wordList);
  if (common.length === 0) return false;
  const foundLower = new Set(foundWords.map((word) => word.toLowerCase()));
  return common.every((word) => foundLower.has(word.toLowerCase()));
}

/** True once at least HINTS_UNLOCK_RATIO of common words in `wordList` have been found. */
export function isHintsUnlockThresholdReached(
  foundWords: readonly string[],
  wordList: readonly string[],
): boolean {
  const common = getCommonWords(wordList);
  if (common.length === 0) return false;
  const foundLower = new Set(foundWords.map((word) => word.toLowerCase()));
  const foundCommonCount = common.filter((word) => foundLower.has(word.toLowerCase())).length;
  return foundCommonCount / common.length >= HINTS_UNLOCK_RATIO;
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
): ScoringState {
  const commonWordsComplete = isCommonWordCompletionReached(foundWords, wordList);
  const allWordsComplete = isAllWordsCompletionReached(foundWords, wordList);
  let score = foundWords.reduce((sum, word) => sum + getWordScore(word), 0);
  if (commonWordsComplete) score += COMMON_WORD_COMPLETION_BONUS;
  if (allWordsComplete) score += ALL_WORDS_COMPLETION_BONUS;
  return { score, commonWordsComplete, allWordsComplete };
}
