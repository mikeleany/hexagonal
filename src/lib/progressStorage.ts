const STORAGE_KEY = 'hexagonal-progress';

type StoredProgress = {
  puzzleId: string;
  foundWords: string[];
};

function isStoredProgress(value: unknown): value is StoredProgress {
  if (typeof value !== 'object' || value === null) return false;
  const { puzzleId, foundWords } = value as Record<string, unknown>;
  return (
    typeof puzzleId === 'string' &&
    Array.isArray(foundWords) &&
    foundWords.every((w) => typeof w === 'string')
  );
}

/**
 * Loads found words persisted from a previous session, discarding them if
 * they were recorded against a different puzzle (identified by its tile
 * letters -- see dailyPuzzle.ts's DAILY_PUZZLE_ID).
 */
export function loadFoundWords(puzzleId: string): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!isStoredProgress(parsed)) return [];
    if (parsed.puzzleId !== puzzleId) return [];

    return parsed.foundWords;
  } catch {
    return [];
  }
}

/** Persists found words, tagged with the current puzzle's id. */
export function saveFoundWords(foundWords: readonly string[], puzzleId: string): void {
  try {
    const progress: StoredProgress = { puzzleId, foundWords: [...foundWords] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage unavailable (e.g. private browsing, quota exceeded) — progress
    // just won't persist across reloads.
  }
}
