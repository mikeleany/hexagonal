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
  const lengths = [...new Set(wordList.map((w) => w.length))].sort((a, b) => b - a);
  return lengths.map((length) => {
    const totalCount = wordList.filter((w) => w.length === length).length;
    const found = foundWords.filter((w) => w.length === length).sort();
    return { length, found, foundCount: found.length, totalCount };
  });
}
