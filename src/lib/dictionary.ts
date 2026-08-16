import RAW_WORDS from '../../.cache/scowl/words.txt?raw';

/**
 * Tunable at runtime — the bundled dictionary itself is never pre-filtered,
 * so raising or lowering these never requires touching `words.txt`.
 */
export const MIN_WORD_LENGTH = 3;
export const MAX_WORD_LENGTH = 19;

type WordEntry = { word: string; rare: boolean };

/**
 * words.txt (see scripts/generateWordLists.py) is a SCOWL-derived valid-word
 * list with a binary common/rare rarity tag appended to each line. It's
 * generated at dev/build/check time (via package.json's predev/prebuild/
 * precheck hooks) into the gitignored .cache/scowl/, and inlined into the JS
 * bundle via the `?raw` import below like any other bundled asset — it's
 * just not checked into git, so it must be generated before it exists.
 *
 * Throws on any malformed line rather than silently dropping it: board
 * generation is seeded and indexes into this word list, so a silently
 * shrunk dictionary could change puzzles in a hard-to-debug way.
 */
function parseWordsFile(raw: string): WordEntry[] {
  const entries: WordEntry[] = [];
  for (const line of raw.trimEnd().split(/\r?\n/)) {
    const columns = line.split('\t');
    const [rawWord, rawTag] = columns;
    const word = rawWord?.trim().toLowerCase();
    if (
      columns.length !== 2 ||
      !word ||
      !/^[a-z]+$/.test(word) ||
      (rawTag !== 'common' && rawTag !== 'rare')
    ) {
      throw new Error(`words.txt: malformed line: ${JSON.stringify(line)}`);
    }
    entries.push({ word, rare: rawTag === 'rare' });
  }
  return entries;
}

const ENTRIES: readonly WordEntry[] = parseWordsFile(RAW_WORDS);
const RARE_BY_WORD: ReadonlyMap<string, boolean> = new Map(
  ENTRIES.map((entry) => [entry.word, entry.rare]),
);

/** Parses the bundled word list into a full, unfiltered array. */
export function loadFullDictionary(): string[] {
  return ENTRIES.map((entry) => entry.word);
}

// Offensive-word filtering (SCOWL's usage-note tags, LDNOOBW, and
// scripts/wordBlacklist.txt, with scripts/wordWhitelist.txt as the
// override) already happened when generateWordLists.py built words.txt —
// see that script for details.
export function loadEligibleWords(
  minLength: number = MIN_WORD_LENGTH,
  maxLength: number = MAX_WORD_LENGTH,
): string[] {
  return loadFullDictionary().filter(
    (word) => word.length >= minLength && word.length <= maxLength,
  );
}

/** Rarity lookup (lowercase word -> true if rare, false if common). */
export function loadWordRarities(): ReadonlyMap<string, boolean> {
  return RARE_BY_WORD;
}
