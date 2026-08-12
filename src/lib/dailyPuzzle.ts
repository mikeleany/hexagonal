import { buildBoard } from './boardConstruction';
import { loadEligibleWords, MAX_WORD_LENGTH, MIN_WORD_LENGTH } from './dictionary';
import type { Tile } from './hexGeometry';
import { mulberry32, seedForDate } from './prng';
import { buildTrie } from './trie';
import { solveBoard } from './wordSolver';

export type DailyPuzzle = {
  tiles: Tile[];
  wordList: string[];
  puzzleId: string;
};

/**
 * Identifies a puzzle by its tile letters, so saved progress can be matched
 * against the exact board it was recorded on rather than the calendar date
 * -- which goes stale across a code update or a session left open past
 * midnight (see progressStorage.ts). Sorted by coordinate (not
 * board-building order, e.g. the Hamiltonian path in boardConstruction.ts)
 * so a future refactor of tile construction order can't change the id
 * without actually changing the board.
 */
function puzzleIdForTiles(tiles: Tile[]): string {
  return [...tiles]
    .sort((a, b) => a.q - b.q || a.r - b.r)
    .map((tile) => tile.letter)
    .join('');
}

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

  return { tiles, wordList, puzzleId: puzzleIdForTiles(tiles) };
}

const puzzle = generateDailyPuzzle();
export const DAILY_TILES: Tile[] = puzzle.tiles;
export const DAILY_WORD_LIST: readonly string[] = puzzle.wordList;
export const DAILY_PUZZLE_ID: string = puzzle.puzzleId;
