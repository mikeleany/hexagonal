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

/**
 * All words to display, alphabetized. When `hintsEnabled` is false, only
 * found words are included (the pre-hints behavior). When true, unfound
 * common words are included so they can render as hint placeholders in
 * their natural alphabetical position; unfound rare words are included too,
 * but only once `allCommonWordsFound` is true (hints are staged: common
 * words first, rare words unlock once every common word has been found).
 * `wordList` is assumed to already be alphabetized (guaranteed by
 * wordSolver.ts's `solveBoard`, the source of the puzzle's word list) --
 * only `foundWords`, which arrives in discovery order, needs sorting here.
 */
export function buildWordEntries(
  wordList: readonly string[],
  foundWords: readonly string[],
  hintsEnabled: boolean,
  allCommonWordsFound: boolean,
): WordEntry[] {
  const foundSet = new Set(foundWords);
  const commonSet = new Set(getCommonWords(wordList));
  const words = hintsEnabled
    ? wordList.filter((word) => foundSet.has(word) || commonSet.has(word) || allCommonWordsFound)
    : [...foundWords].sort();
  return words.map((word) => ({ word, found: foundSet.has(word) }));
}

/** Groups words by length, longest first; `entries` within each group is alphabetized. */
export function groupWordsByLength(
  wordList: readonly string[],
  foundWords: readonly string[],
  hintsEnabled = false,
  allCommonWordsFound = false,
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
  for (const entry of buildWordEntries(wordList, foundWords, hintsEnabled, allCommonWordsFound)) {
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
