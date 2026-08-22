/**
 * Persisted lifetime + streak statistics, plus a live snapshot of the
 * currently-active ("today's") day's progress. Percent fields are on a
 * 0-100 scale, matching the UI's "average % completed" framing.
 */
export type Stats = {
  /** Mountain-Time YYYY-MM-DD of the most recent day the app was opened.
   *  Null only before the very first play ever. */
  lastPlayedDate: string | null;

  // Consecutive-day streaks. Incremented live by recordCompletion the
  // moment a day's completion is reached -- not deferred to finalize.
  // ensureDayStarted only ever resets these to 0 (played-but-incomplete
  // day) or leaves them untouched; it never increments.
  currentCommonStreak: number;
  currentAllStreak: number;
  longestCommonStreak: number;
  longestAllStreak: number;

  // Lifetime aggregates, updated only at finalize time (ensureDayStarted),
  // rolled in from the day being finalized's today* snapshot below.
  lifetimeScore: number;
  daysPlayed: number;
  lifetimeCommonPercentSum: number;
  lifetimeAllPercentSum: number;

  // Live snapshot of lastPlayedDate's in-progress state, kept current by
  // recordCompletion/updateTodaySnapshot as the player plays, so whatever
  // is persisted is always usable as "today's final state" by a future
  // ensureDayStarted call -- even if the app isn't reopened for days.
  todayCommonComplete: boolean;
  todayAllComplete: boolean;
  todayScore: number;
  todayCommonPercent: number;
  todayAllPercent: number;
};

export function createInitialStats(): Stats {
  return {
    lastPlayedDate: null,
    currentCommonStreak: 0,
    currentAllStreak: 0,
    longestCommonStreak: 0,
    longestAllStreak: 0,
    lifetimeScore: 0,
    daysPlayed: 0,
    lifetimeCommonPercentSum: 0,
    lifetimeAllPercentSum: 0,
    todayCommonComplete: false,
    todayAllComplete: false,
    todayScore: 0,
    todayCommonPercent: 0,
    todayAllPercent: 0,
  };
}

function resetTodaySnapshot(stats: Stats): Stats {
  return {
    ...stats,
    todayCommonComplete: false,
    todayAllComplete: false,
    todayScore: 0,
    todayCommonPercent: 0,
    todayAllPercent: 0,
  };
}

/**
 * Ensures `stats` reflects `today` (Mountain-Time YYYY-MM-DD) as the active
 * day. If `today` is a new calendar date relative to `stats.lastPlayedDate`,
 * finalizes the previously-active day first: rolls its final today*
 * snapshot into lifetime totals, resets a streak to 0 if its completion
 * flag was never reached (never increments -- recordCompletion handles
 * that live), then starts a fresh snapshot. A streak reset always applies
 * once a day is finalized, regardless of how many unplayed days preceded
 * `today` -- there's no way to "skip past" a played-but-incomplete day.
 * Pure -- returns `stats` itself unchanged on a same-day no-op.
 */
export function ensureDayStarted(stats: Stats, today: string): Stats {
  if (stats.lastPlayedDate === today) return stats;
  if (stats.lastPlayedDate === null) return { ...stats, lastPlayedDate: today };

  const finalized: Stats = {
    ...stats,
    currentCommonStreak: stats.todayCommonComplete ? stats.currentCommonStreak : 0,
    currentAllStreak: stats.todayAllComplete ? stats.currentAllStreak : 0,
    lifetimeScore: stats.lifetimeScore + stats.todayScore,
    daysPlayed: stats.daysPlayed + 1,
    lifetimeCommonPercentSum: stats.lifetimeCommonPercentSum + stats.todayCommonPercent,
    lifetimeAllPercentSum: stats.lifetimeAllPercentSum + stats.todayAllPercent,
    lastPlayedDate: today,
  };
  return resetTodaySnapshot(finalized);
}

/**
 * Records that `kind`'s completion was reached today. Caller must ensure
 * `stats.lastPlayedDate` is already today's date (call ensureDayStarted
 * first). Increments the matching current streak and bumps the matching
 * longest high-water mark. No internal "already recorded today" guard --
 * relies on the caller's existing completion-detection guard (App.svelte
 * only calls this on the commonBonusAwarded/allBonusAwarded false->true
 * transition, which fires at most once per puzzle).
 */
export function recordCompletion(stats: Stats, kind: 'common' | 'all'): Stats {
  if (kind === 'common') {
    const currentCommonStreak = stats.currentCommonStreak + 1;
    return {
      ...stats,
      currentCommonStreak,
      longestCommonStreak: Math.max(stats.longestCommonStreak, currentCommonStreak),
      todayCommonComplete: true,
    };
  }
  const currentAllStreak = stats.currentAllStreak + 1;
  return {
    ...stats,
    currentAllStreak,
    longestAllStreak: Math.max(stats.longestAllStreak, currentAllStreak),
    todayAllComplete: true,
  };
}

/** Overwrites today's score/percentages with the latest values, so
 * whatever's persisted always reflects the most recent progress. */
export function updateTodaySnapshot(
  stats: Stats,
  snapshot: { score: number; commonPercent: number; allPercent: number },
): Stats {
  return {
    ...stats,
    todayScore: snapshot.score,
    todayCommonPercent: snapshot.commonPercent,
    todayAllPercent: snapshot.allPercent,
  };
}
