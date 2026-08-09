import { getCommonWords } from './scoring';

export type WordLengthGroup = {
  length: number;
  found: string[];
  foundCount: number;
  totalCount: number;
  commonFoundCount: number;
  commonTotalCount: number;
};

/** Groups words by length, longest first; `found` within each group is alphabetized. */
export function groupWordsByLength(
  wordList: readonly string[],
  foundWords: readonly string[],
): WordLengthGroup[] {
  const commonSet = new Set(getCommonWords(wordList));

  const totalByLength = new Map<number, number>();
  const commonTotalByLength = new Map<number, number>();
  for (const word of wordList) {
    totalByLength.set(word.length, (totalByLength.get(word.length) ?? 0) + 1);
    if (commonSet.has(word)) {
      commonTotalByLength.set(word.length, (commonTotalByLength.get(word.length) ?? 0) + 1);
    }
  }

  const foundByLength = new Map<number, string[]>();
  const commonFoundByLength = new Map<number, number>();
  for (const word of foundWords) {
    const found = foundByLength.get(word.length);
    if (found) found.push(word);
    else foundByLength.set(word.length, [word]);
    if (commonSet.has(word)) {
      commonFoundByLength.set(word.length, (commonFoundByLength.get(word.length) ?? 0) + 1);
    }
  }

  const lengths = [...totalByLength.keys()].sort((a, b) => b - a);
  return lengths.map((length) => {
    const found = (foundByLength.get(length) ?? []).sort();
    return {
      length,
      found,
      foundCount: found.length,
      totalCount: totalByLength.get(length)!,
      commonFoundCount: commonFoundByLength.get(length) ?? 0,
      commonTotalCount: commonTotalByLength.get(length) ?? 0,
    };
  });
}
