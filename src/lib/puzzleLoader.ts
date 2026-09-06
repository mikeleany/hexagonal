import { BOARD_RADIUS, generateHexCoords, tileId, type Tile } from './hexGeometry';
import { getMountainTimeDateString } from './prng';

/** On-disk schema written by scripts/generatePuzzles.ts (see dailyPuzzle.ts's
 * PuzzleFileData, which this mirrors) -- kept as a separate type here so this
 * module never needs to import dailyPuzzle.ts (and, transitively, the
 * dictionary/board-construction/word-solver code that must stay out of the
 * client bundle). */
export type PuzzleFile = {
  date: string;
  puzzleId: string;
  words: { word: string; rare: boolean }[];
};

export type LoadedPuzzle = {
  tiles: Tile[];
  wordList: string[];
  puzzleId: string;
  rareWords: Set<string>;
};

export class PuzzleLoadError extends Error {}

/**
 * Reconstructs tiles from puzzleId alone: generateHexCoords(BOARD_RADIUS)
 * emits coordinates in ascending (q, r) order, which is exactly the order
 * dailyPuzzle.ts's puzzleIdForTiles sorts by before joining letters into
 * puzzleId -- so zipping the two back together recovers every tile.
 */
export function puzzleFromFile(data: PuzzleFile): LoadedPuzzle {
  const coords = generateHexCoords(BOARD_RADIUS);
  const tiles: Tile[] = coords.map((coord, i) => ({
    id: tileId(coord),
    q: coord.q,
    r: coord.r,
    letter: data.puzzleId[i],
  }));
  return {
    tiles,
    wordList: data.words.map((w) => w.word),
    puzzleId: data.puzzleId,
    rareWords: new Set(data.words.filter((w) => w.rare).map((w) => w.word.toLowerCase())),
  };
}

/**
 * Fetches the pre-generated puzzle file for the given date's Mountain-Time
 * calendar day (see .github/workflows/generate-puzzles.yml and
 * scripts/generatePuzzles.ts). Never falls back to generating a puzzle
 * client-side -- that's the whole point of pre-generation (issue #37): a
 * missing file must surface as an error, not silently regenerate today's
 * puzzle from whatever code happens to be live.
 */
export async function loadDailyPuzzle(date: Date = new Date()): Promise<LoadedPuzzle> {
  const dateStr = getMountainTimeDateString(date);
  const url = `${import.meta.env.BASE_URL}puzzles/${dateStr}.json`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new PuzzleLoadError(`Failed to fetch puzzle for ${dateStr}: ${err}`);
  }
  if (!response.ok) {
    throw new PuzzleLoadError(`Puzzle for ${dateStr} not found (HTTP ${response.status})`);
  }
  let data: PuzzleFile;
  try {
    data = await response.json();
  } catch (err) {
    throw new PuzzleLoadError(`Puzzle for ${dateStr} is malformed JSON: ${err}`);
  }
  return puzzleFromFile(data);
}
