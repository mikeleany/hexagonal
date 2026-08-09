import { getCommonWords, isRareWord } from './scoring';

export type WordEntry = { word: string; found: boolean };

export type WordLengthGroup = {
  length: number;
  entries: WordEntry[];
  hasRare: boolean;
  foundCount: number;
  totalCount: number;
  commonFoundCount: number;
  commonTotalCount: number;
};

// wordList (DAILY_WORD_LIST) is a stable reference for the whole session, so
// its alphabetized order is cached by reference rather than re-sorted on
// every call -- unlike foundWords, which is small and changes every call
// anyway, so isn't worth caching.
const sortedWordListCache = new WeakMap<readonly string[], string[]>();

function getSortedWordList(wordList: readonly string[]): string[] {
  let sorted = sortedWordListCache.get(wordList);
  if (!sorted) {
    sorted = [...wordList].sort();
    sortedWordListCache.set(wordList, sorted);
  }
  return sorted;
}

/**
 * All words to display, alphabetized. When `hintsEnabled` is false, only
 * found words are included (the pre-hints behavior). When true, every word
 * in `wordList` is included so unfound words can render as hint placeholders
 * in their natural alphabetical position.
 */
export function buildWordEntries(
  wordList: readonly string[],
  foundWords: readonly string[],
  hintsEnabled: boolean,
): WordEntry[] {
  const foundSet = new Set(foundWords);
  const words = hintsEnabled ? getSortedWordList(wordList) : [...foundWords].sort();
  return words.map((word) => ({ word, found: foundSet.has(word) }));
}

/** Groups words by length, longest first; `entries` within each group is alphabetized. */
export function groupWordsByLength(
  wordList: readonly string[],
  foundWords: readonly string[],
  hintsEnabled = false,
): WordLengthGroup[] {
  const commonSet = new Set(getCommonWords(wordList));

  const totalByLength = new Map<number, number>();
  const commonTotalByLength = new Map<number, number>();
  const hasRareByLength = new Map<number, boolean>();
  for (const word of wordList) {
    totalByLength.set(word.length, (totalByLength.get(word.length) ?? 0) + 1);
    if (commonSet.has(word)) {
      commonTotalByLength.set(word.length, (commonTotalByLength.get(word.length) ?? 0) + 1);
    }
    if (isRareWord(word)) {
      hasRareByLength.set(word.length, true);
    }
  }

  const foundByLength = new Map<number, number>();
  const commonFoundByLength = new Map<number, number>();
  for (const word of foundWords) {
    foundByLength.set(word.length, (foundByLength.get(word.length) ?? 0) + 1);
    if (commonSet.has(word)) {
      commonFoundByLength.set(word.length, (commonFoundByLength.get(word.length) ?? 0) + 1);
    }
  }

  const entriesByLength = new Map<number, WordEntry[]>();
  for (const entry of buildWordEntries(wordList, foundWords, hintsEnabled)) {
    const entries = entriesByLength.get(entry.word.length);
    if (entries) entries.push(entry);
    else entriesByLength.set(entry.word.length, [entry]);
  }

  const lengths = [...totalByLength.keys()].sort((a, b) => b - a);
  return lengths.map((length) => ({
    length,
    entries: entriesByLength.get(length) ?? [],
    hasRare: hasRareByLength.get(length) ?? false,
    foundCount: foundByLength.get(length) ?? 0,
    totalCount: totalByLength.get(length)!,
    commonFoundCount: commonFoundByLength.get(length) ?? 0,
    commonTotalCount: commonTotalByLength.get(length) ?? 0,
  }));
}
