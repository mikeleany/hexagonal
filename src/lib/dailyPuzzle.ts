import { buildBoard } from './boardConstruction';
import { loadEligibleWords, MAX_WORD_LENGTH, MIN_WORD_LENGTH } from './dictionary';
import type { Tile } from './hexGeometry';
import { mulberry32, seedForDate } from './prng';
import { buildTrie } from './trie';
import { solveBoard } from './wordSolver';

export type DailyPuzzle = {
  tiles: Tile[];
  wordList: string[];
};

/**
 * Deterministically generates the puzzle for the given date (Mountain Time
 * calendar day) — same date always produces the same board and word list.
 */
export function generateDailyPuzzle(date: Date = new Date()): DailyPuzzle {
  const rng = mulberry32(seedForDate(date));
  const eligibleWords = loadEligibleWords();

  const tiles = buildBoard(eligibleWords, rng);
  const trie = buildTrie(eligibleWords);
  const wordList = solveBoard(tiles, trie, MIN_WORD_LENGTH, MAX_WORD_LENGTH);

  return { tiles, wordList };
}

const puzzle = generateDailyPuzzle();
export const DAILY_TILES: Tile[] = puzzle.tiles;
export const DAILY_WORD_LIST: readonly string[] = puzzle.wordList;
