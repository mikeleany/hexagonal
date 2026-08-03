export type WordLengthGroup = {
  length: number;
  found: string[];
  foundCount: number;
  totalCount: number;
};

/** Groups words by length, longest first; `found` within each group is alphabetized. */
export function groupWordsByLength(
  wordList: readonly string[],
  foundWords: readonly string[],
): WordLengthGroup[] {
  const totalByLength = new Map<number, number>();
  for (const word of wordList) {
    totalByLength.set(word.length, (totalByLength.get(word.length) ?? 0) + 1);
  }

  const foundByLength = new Map<number, string[]>();
  for (const word of foundWords) {
    const found = foundByLength.get(word.length);
    if (found) found.push(word);
    else foundByLength.set(word.length, [word]);
  }

  const lengths = [...totalByLength.keys()].sort((a, b) => b - a);
  return lengths.map((length) => {
    const found = (foundByLength.get(length) ?? []).sort();
    return { length, found, foundCount: found.length, totalCount: totalByLength.get(length)! };
  });
}
