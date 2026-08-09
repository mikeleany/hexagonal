import { loadWordRarities } from "./dictionary";

/**
 * PLACEHOLDER CONSTANTS — chosen from the rarity-percentile stats printed by
 * scripts/computeWordRarity.js, not yet validated against real puzzle totals.
 * Revisit once we've checked what a full day's word list actually scores.
 *
 * RARITY_THRESHOLD is the rarity value at or below which a word is treated
 * as "common" (scores as pure length, no bonus). RARITY_K controls how
 * sharply the rarity bonus scales with word length once a word is rarer
 * than the threshold.
 */
export const RARITY_THRESHOLD = 0.7;
export const RARITY_K = 2.4;
export const COMMON_WORD_COMPLETION_BONUS = 1500;
export const ALL_WORDS_COMPLETION_BONUS = 3000;

const RARITY = loadWordRarities();

function getRarity(word: string): number {
  // Defensive fallback only — every word ever scored comes from
  // DAILY_WORD_LIST, which is derived from this same rarity-backed
  // dictionary, so a miss here should never actually happen in practice.
  return RARITY.get(word.toLowerCase()) ?? 1.0;
}

/** score(word) = round(10 * length * (1 + max(0, k * (rarity - threshold)) * log10(length))) */
export function getWordScore(word: string): number {
  const length = word.length;
  const rarity = getRarity(word);
  const multiplier =
    1 +
    Math.max(0, RARITY_K * (rarity - RARITY_THRESHOLD)) * Math.log10(length);
  return Math.round(10 * length * multiplier);
}

/** Words in `wordList` at or below the commonality threshold. */
export function getCommonWords(wordList: readonly string[]): string[] {
  return wordList.filter((word) => getRarity(word) <= RARITY_THRESHOLD);
}

/** True for words rarer than the commonality threshold (the inverse of `getCommonWords`'s filter). */
export function isRareWord(word: string): boolean {
  return getRarity(word) > RARITY_THRESHOLD;
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
