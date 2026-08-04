import RAW_ENABLE1 from './enable1.txt?raw';

/**
 * Tunable at runtime — the bundled dictionary itself is never pre-filtered,
 * so raising or lowering these never requires touching `enable1.txt`.
 */
export const MIN_WORD_LENGTH = 3;
export const MAX_WORD_LENGTH = 19;

/** Parses the bundled ENABLE word list into a full, unfiltered array. */
export function loadFullDictionary(): string[] {
  return RAW_ENABLE1.split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter((word) => /^[a-z]+$/.test(word));
}

// TODO(offensive-words): enable1.txt is bundled as-is with no content
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
