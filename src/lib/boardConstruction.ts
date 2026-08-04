// TODO(general-board-construction): this module only works because the
// board is hardcoded to exactly 19 tiles (radius 2) and English happens to
// have enough 19-letter words to plant one across every tile. A board of
// arbitrary size/shape needs real constructive placement: seed-randomly
// place a sequence of words on the (partially filled) board, backtracking/
// undoing placements when few tiles remain and no eligible word fits, until
// every tile is covered by at least one placed word. Not implemented — this
// whole file is the v1 placeholder strategy.

import { HAMILTONIAN_TILE_ORDER } from './hamiltonianPath';
import { generateHexCoords, tileId, type Tile } from './hexGeometry';
import { pickRandomElement } from './prng';

const BOARD_TILE_COUNT = generateHexCoords(2).length;

/**
 * Builds the board by planting a single word of exactly `BOARD_TILE_COUNT`
 * letters along the fixed Hamiltonian path, guaranteeing every tile is
 * "needed" by at least one word (the planted word itself) — see the
 * file-level TODO for the general approach this stands in for.
 */
export function buildBoard(eligibleWords: readonly string[], rng: () => number): Tile[] {
  const candidates = eligibleWords.filter((word) => word.length === BOARD_TILE_COUNT);
  const word = pickRandomElement(rng, candidates);

  const tiles: Tile[] = HAMILTONIAN_TILE_ORDER.map((coord, i) => ({
    id: tileId(coord),
    q: coord.q,
    r: coord.r,
    letter: word[i].toUpperCase(),
  }));

  if (tiles.length !== BOARD_TILE_COUNT) {
    throw new Error(`buildBoard: expected ${BOARD_TILE_COUNT} tiles, got ${tiles.length}`);
  }
  return tiles;
}
