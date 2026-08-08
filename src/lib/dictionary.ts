import RAW_WORD_RARITY from './wordRarity.txt?raw';

/**
 * Tunable at runtime — the bundled dictionary itself is never pre-filtered,
 * so raising or lowering these never requires touching `wordRarity.txt`.
 */
export const MIN_WORD_LENGTH = 3;
export const MAX_WORD_LENGTH = 19;

type RarityEntry = { word: string; rarity: number };

/**
 * wordRarity.txt (see scripts/computeWordRarity.js) is enable1.txt with a
 * precomputed rarity value appended to each line, in the same order. It
 * supersedes enable1.txt as the bundled data source, and preserves its
 * word set and order exactly. Words are normalized to lowercase here,
 * which is a no-op today since enable1.txt is already all-lowercase.
 *
 * Throws on any malformed line rather than silently dropping it: board
 * generation is seeded and indexes into this word list, so a silently
 * shrunk dictionary could change puzzles in a hard-to-debug way.
 */
function parseWordRarityFile(raw: string): RarityEntry[] {
  const entries: RarityEntry[] = [];
  for (const line of raw.trimEnd().split(/\r?\n/)) {
    const columns = line.split('\t');
    const [rawWord, rawRarity] = columns;
    const word = rawWord?.trim().toLowerCase();
    const rarity = Number(rawRarity);
    if (
      columns.length !== 2 ||
      !word ||
      !/^[a-z]+$/.test(word) ||
      !Number.isFinite(rarity) ||
      rarity < 0 ||
      rarity > 1
    ) {
      throw new Error(`wordRarity.txt: malformed line: ${JSON.stringify(line)}`);
    }
    entries.push({ word, rarity });
  }
  return entries;
}

const ENTRIES: readonly RarityEntry[] = parseWordRarityFile(RAW_WORD_RARITY);
const RARITY_BY_WORD: ReadonlyMap<string, number> = new Map(
  ENTRIES.map((entry) => [entry.word, entry.rarity]),
);

/** Parses the bundled word list into a full, unfiltered array. */
export function loadFullDictionary(): string[] {
  return ENTRIES.map((entry) => entry.word);
}

// TODO(offensive-words): the bundled word list carries no content
// filtering. Before this is shown to real users, filter the words returned
// here against a blocklist (or swap to a pre-vetted list) so offensive
// words can never be planted on the board or accepted as a submission.
// Deliberately deferred for this first cut.
export function loadEligibleWords(
  minLength: number = MIN_WORD_LENGTH,
  maxLength: number = MAX_WORD_LENGTH,
): string[] {
  return loadFullDictionary().filter(
    (word) => word.length >= minLength && word.length <= maxLength,
  );
}

/** Rarity lookup (lowercase word -> 0..1, 0 = most common, 1 = most rare). */
export function loadWordRarities(): ReadonlyMap<string, number> {
  return RARITY_BY_WORD;
}
