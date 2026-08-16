import { bench, describe } from 'vitest';
import { buildBoard } from './boardConstruction';
import { loadEligibleWords, loadWordRarities } from './dictionary';
import { mulberry32 } from './prng';

describe('buildBoard performance', () => {
  const eligibleWords = loadEligibleWords();
  const rarities = loadWordRarities();
  let seed = 0;

  bench('construct a board', () => {
    buildBoard(eligibleWords, rarities, mulberry32(seed++));
  });
});
