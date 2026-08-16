import { describe, expect, it } from 'vitest';
import { buildBoard } from './boardConstruction';
import { loadEligibleWords, loadWordRarities } from './dictionary';
import { generateHexCoords, tileId } from './hexGeometry';
import { mulberry32 } from './prng';

describe('buildBoard', () => {
  const eligibleWords = loadEligibleWords();
  const rarities = loadWordRarities();
  const expectedTileIds = new Set(generateHexCoords(2).map(tileId));

  it('produces a valid, fully-filled 19-tile board across a range of seeds', () => {
    for (let seed = 0; seed < 50; seed++) {
      const tiles = buildBoard(eligibleWords, rarities, mulberry32(seed));
      expect(tiles).toHaveLength(19);
      expect(new Set(tiles.map((tile) => tile.id))).toEqual(expectedTileIds);
      for (const tile of tiles) {
        expect(tile.letter).toMatch(/^[A-Z]$/);
      }
    }
  });

  it('is deterministic for a given seed', () => {
    const a = buildBoard(eligibleWords, rarities, mulberry32(42));
    const b = buildBoard(eligibleWords, rarities, mulberry32(42));
    expect(a).toEqual(b);
  });

  it('throws when the eligible word pool cannot possibly cover the board', () => {
    expect(() => buildBoard([], rarities, mulberry32(1))).toThrow();
  });
});
