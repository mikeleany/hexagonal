import { describe, expect, it } from 'vitest';
import {
  createInitialStats,
  ensureDayStarted,
  recordCompletion,
  updateTodaySnapshot,
  type Stats,
} from './stats';

describe('createInitialStats', () => {
  it('returns zeroed-out defaults with no last-played date', () => {
    expect(createInitialStats()).toEqual({
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
    });
  });
});

describe('ensureDayStarted', () => {
  it('sets lastPlayedDate on the very first day, changing nothing else', () => {
    const result = ensureDayStarted(createInitialStats(), '2026-08-21');
    expect(result).toEqual({ ...createInitialStats(), lastPlayedDate: '2026-08-21' });
  });

  it('is a same-day no-op, returning the input unchanged', () => {
    const stats: Stats = {
      ...createInitialStats(),
      lastPlayedDate: '2026-08-21',
      todayScore: 500,
    };
    expect(ensureDayStarted(stats, '2026-08-21')).toBe(stats);
  });

  it('rolls a fully-completed day into lifetime totals without touching streaks', () => {
    const stats: Stats = {
      ...createInitialStats(),
      lastPlayedDate: '2026-08-20',
      currentCommonStreak: 3,
      currentAllStreak: 2,
      longestCommonStreak: 3,
      longestAllStreak: 2,
      lifetimeScore: 1000,
      daysPlayed: 3,
      lifetimeCommonPercentSum: 250,
      lifetimeAllPercentSum: 180,
      todayCommonComplete: true,
      todayAllComplete: true,
      todayScore: 400,
      todayCommonPercent: 100,
      todayAllPercent: 100,
    };

    const result = ensureDayStarted(stats, '2026-08-21');

    expect(result).toEqual({
      lastPlayedDate: '2026-08-21',
      currentCommonStreak: 3,
      currentAllStreak: 2,
      longestCommonStreak: 3,
      longestAllStreak: 2,
      lifetimeScore: 1400,
      daysPlayed: 4,
      lifetimeCommonPercentSum: 350,
      lifetimeAllPercentSum: 280,
      todayCommonComplete: false,
      todayAllComplete: false,
      todayScore: 0,
      todayCommonPercent: 0,
      todayAllPercent: 0,
    });
  });

  it('resets only the all-words streak when common was completed but all words were not', () => {
    const stats: Stats = {
      ...createInitialStats(),
      lastPlayedDate: '2026-08-20',
      currentCommonStreak: 3,
      currentAllStreak: 2,
      lifetimeScore: 1000,
      daysPlayed: 3,
      todayCommonComplete: true,
      todayAllComplete: false,
      todayScore: 300,
      todayCommonPercent: 100,
      todayAllPercent: 60,
    };

    const result = ensureDayStarted(stats, '2026-08-21');

    expect(result.currentCommonStreak).toBe(3);
    expect(result.currentAllStreak).toBe(0);
    expect(result.lifetimeScore).toBe(1300);
    expect(result.daysPlayed).toBe(4);
    expect(result.lifetimeCommonPercentSum).toBe(100);
    expect(result.lifetimeAllPercentSum).toBe(60);
  });

  it('still breaks a streak from an incomplete day even across a multi-day gap', () => {
    const stats: Stats = {
      ...createInitialStats(),
      lastPlayedDate: '2026-08-15',
      currentCommonStreak: 5,
      currentAllStreak: 5,
      longestCommonStreak: 5,
      longestAllStreak: 5,
      todayCommonComplete: false,
      todayAllComplete: false,
      todayScore: 120,
      todayCommonPercent: 40,
      todayAllPercent: 20,
    };

    // Several unplayed days passed before the player opened the app again.
    const result = ensureDayStarted(stats, '2026-08-21');

    expect(result.currentCommonStreak).toBe(0);
    expect(result.currentAllStreak).toBe(0);
    expect(result.longestCommonStreak).toBe(5);
    expect(result.longestAllStreak).toBe(5);
    expect(result.daysPlayed).toBe(1);
    expect(result.lifetimeScore).toBe(120);
  });
});

describe('recordCompletion', () => {
  it('increments the common streak and its longest high-water mark, leaving all-words untouched', () => {
    const stats: Stats = {
      ...createInitialStats(),
      currentCommonStreak: 2,
      longestCommonStreak: 4,
      currentAllStreak: 1,
      longestAllStreak: 1,
    };

    const result = recordCompletion(stats, 'common');

    expect(result.currentCommonStreak).toBe(3);
    expect(result.longestCommonStreak).toBe(4);
    expect(result.todayCommonComplete).toBe(true);
    expect(result.currentAllStreak).toBe(1);
    expect(result.longestAllStreak).toBe(1);
    expect(result.todayAllComplete).toBe(false);
  });

  it('bumps the longest streak when the current streak exceeds it', () => {
    const stats: Stats = {
      ...createInitialStats(),
      currentAllStreak: 4,
      longestAllStreak: 4,
    };

    const result = recordCompletion(stats, 'all');

    expect(result.currentAllStreak).toBe(5);
    expect(result.longestAllStreak).toBe(5);
    expect(result.todayAllComplete).toBe(true);
  });
});

describe('updateTodaySnapshot', () => {
  it('raises only today* fields, leaving streaks and lifetime totals untouched', () => {
    const stats: Stats = {
      ...createInitialStats(),
      currentCommonStreak: 2,
      lifetimeScore: 900,
      daysPlayed: 5,
      todayScore: 50,
      todayCommonPercent: 20,
      todayAllPercent: 10,
    };

    const result = updateTodaySnapshot(stats, { score: 250, commonPercent: 75, allPercent: 40 });

    expect(result.todayScore).toBe(250);
    expect(result.todayCommonPercent).toBe(75);
    expect(result.todayAllPercent).toBe(40);
    expect(result.currentCommonStreak).toBe(2);
    expect(result.lifetimeScore).toBe(900);
    expect(result.daysPlayed).toBe(5);
  });

  it('never lowers today* fields, so a lower snapshot (e.g. a puzzle change mid-day) cannot erase already-earned progress', () => {
    const stats: Stats = {
      ...createInitialStats(),
      todayScore: 11663,
      todayCommonPercent: 100,
      todayAllPercent: 100,
    };

    const result = updateTodaySnapshot(stats, { score: 40, commonPercent: 1.4, allPercent: 0.7 });

    expect(result.todayScore).toBe(11663);
    expect(result.todayCommonPercent).toBe(100);
    expect(result.todayAllPercent).toBe(100);
  });
});
