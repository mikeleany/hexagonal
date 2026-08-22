import { createInitialStats, type Stats } from './stats';

const STORAGE_KEY = 'hexagonal-stats';

function isStats(value: unknown): value is Stats {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    (s.lastPlayedDate === null || typeof s.lastPlayedDate === 'string') &&
    typeof s.currentCommonStreak === 'number' &&
    typeof s.currentAllStreak === 'number' &&
    typeof s.longestCommonStreak === 'number' &&
    typeof s.longestAllStreak === 'number' &&
    typeof s.lifetimeScore === 'number' &&
    typeof s.daysPlayed === 'number' &&
    typeof s.lifetimeCommonPercentSum === 'number' &&
    typeof s.lifetimeAllPercentSum === 'number' &&
    typeof s.todayCommonComplete === 'boolean' &&
    typeof s.todayAllComplete === 'boolean' &&
    typeof s.todayScore === 'number' &&
    typeof s.todayCommonPercent === 'number' &&
    typeof s.todayAllPercent === 'number'
  );
}

/** Loads persisted stats, falling back to createInitialStats() if nothing
 * is stored or the stored shape doesn't validate. */
export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return createInitialStats();

    const parsed: unknown = JSON.parse(raw);
    return isStats(parsed) ? parsed : createInitialStats();
  } catch {
    return createInitialStats();
  }
}

/** Persists stats. */
export function saveStats(stats: Stats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Storage unavailable (e.g. private browsing, quota exceeded) -- stats
    // just won't persist across reloads.
  }
}
