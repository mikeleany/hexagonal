import { getMountainTimeDateString } from './prng';

const STORAGE_KEY = 'hexagonal-progress';

type StoredProgress = {
  date: string;
  foundWords: string[];
};

function isStoredProgress(value: unknown): value is StoredProgress {
  if (typeof value !== 'object' || value === null) return false;
  const { date, foundWords } = value as Record<string, unknown>;
  return (
    typeof date === 'string' &&
    Array.isArray(foundWords) &&
    foundWords.every((w) => typeof w === 'string')
  );
}

/**
 * Loads found words persisted from a previous session, discarding them if
 * they're from a previous Mountain Time calendar day (a new puzzle).
 */
export function loadFoundWords(date: Date = new Date()): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!isStoredProgress(parsed)) return [];
    if (parsed.date !== getMountainTimeDateString(date)) return [];

    return parsed.foundWords;
  } catch {
    return [];
  }
}

/** Persists found words, tagged with today's Mountain Time calendar date. */
export function saveFoundWords(foundWords: readonly string[], date: Date = new Date()): void {
  try {
    const progress: StoredProgress = {
      date: getMountainTimeDateString(date),
      foundWords: [...foundWords],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage unavailable (e.g. private browsing, quota exceeded) — progress
    // just won't persist across reloads.
  }
}
