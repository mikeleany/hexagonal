import { areAdjacent, generateHexCoords, tileId, type Tile } from './hexGeometry';
import { weightedShuffle } from './weightedRandom';

/**
 * Board state during construction, before every tile has been assigned a
 * letter. Internal to this module — callers only ever see the final,
 * fully-filled `Tile[]` returned by `buildBoard`.
 */
type InternalTile = Omit<Tile, 'letter'> & { letter: string | null };

/**
 * Tunable weighting constants for word/path selection — rough starting
 * points, not analytically derived. Eyeball-tune against real generated
 * boards (see boardConstruction.bench.ts / boardConstruction.test.ts) if
 * output looks off: too many short filler words (raise LENGTH_EXPONENT),
 * boards that don't look reused enough (raise REUSE_WEIGHT /
 * REUSE_STEP_WEIGHT), or word selection feeling too tied to the fixed base
 * order (raise REUSE_WORD_WINDOW — costs more per recursion node).
 */
const LENGTH_EXPONENT = 4;
const REUSE_WEIGHT = 3;
const REUSE_STEP_WEIGHT = 3;
const REUSE_WORD_WINDOW = 1000;

function findValidPlacements(letter: string, tiles: readonly InternalTile[]): InternalTile[] {
  return tiles.filter((tile) => tile.letter === null || tile.letter === letter);
}

function buildAdjacencyMap(tiles: readonly InternalTile[]): Map<string, InternalTile[]> {
  const adjacency = new Map<string, InternalTile[]>();
  for (const tile of tiles) {
    const neighbors = tiles.filter((other) => other.id !== tile.id && areAdjacent(tile, other));
    adjacency.set(tile.id, neighbors);
  }
  return adjacency;
}

function countLetters(tiles: readonly InternalTile[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tile of tiles) {
    if (tile.letter !== null) {
      counts.set(tile.letter, (counts.get(tile.letter) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Multiset-intersection proxy for reuse potential: how many of `word`'s
 * letters can be matched against `filledCounts` without reusing a counted
 * letter more than once. Ignores adjacency entirely — it's a cheap ranking
 * signal, not a placement guarantee; actual feasibility is only confirmed
 * by findPlacementPaths.
 */
function overlapCount(word: string, filledCounts: ReadonlyMap<string, number>): number {
  const remaining = new Map(filledCounts);
  let matched = 0;
  for (const letter of word) {
    const available = remaining.get(letter) ?? 0;
    if (available > 0) {
      remaining.set(letter, available - 1);
      matched++;
    }
  }
  return matched;
}

/**
 * Ranks candidate words in a weighted-random (not strict-sort) order,
 * favoring longer words. Computed once per `buildBoard` call — not per
 * recursion node — since length doesn't depend on board state. This is
 * only the base order; `candidateWords` re-weights a bounded window of the
 * front of it by current reuse potential at each node, rather than
 * reordering the whole list every time.
 */
function weightedWordOrder(words: readonly string[], rng: () => number): string[] {
  const weighted = words.map((word) => ({ item: word, weight: word.length ** LENGTH_EXPONENT }));
  return weightedShuffle(weighted, rng);
}

/**
 * Lazily walks the (already board-state-independent, computed once)
 * `wordOrder`, skipping words already placed and words fully satisfiable by
 * the board's current letters (overlapCount === length — they risk
 * covering zero new tiles and add nothing to letter variety). The first
 * REUSE_WORD_WINDOW surviving candidates are re-weighted by their current
 * reuse potential and re-shuffled before being yielded, reintroducing a
 * reuse bias into word selection that's reactive to board state, without
 * paying to re-rank the entire dictionary at every node; everything past
 * the window is yielded in the unmodified base order. Only computes
 * `overlapCount` for words actually visited, not the whole list, which is
 * what keeps this cheap despite `wordOrder` spanning the entire dictionary.
 */
function* candidateWords(
  wordOrder: readonly string[],
  usedWords: ReadonlySet<string>,
  tiles: readonly InternalTile[],
  rng: () => number,
): Generator<string> {
  const filledCounts = countLetters(tiles);
  const iterator = wordOrder[Symbol.iterator]();

  const window: { item: string; weight: number }[] = [];
  let result = iterator.next();
  while (!result.done && window.length < REUSE_WORD_WINDOW) {
    const word = result.value;
    if (!usedWords.has(word)) {
      const overlap = overlapCount(word, filledCounts);
      if (overlap !== word.length) {
        const reuseScore = 1 + REUSE_WEIGHT * overlap;
        window.push({ item: word, weight: word.length ** LENGTH_EXPONENT * reuseScore });
      }
    }
    result = iterator.next();
  }

  yield* weightedShuffle(window, rng);

  while (!result.done) {
    const word = result.value;
    if (!usedWords.has(word) && overlapCount(word, filledCounts) !== word.length) {
      yield word;
    }
    result = iterator.next();
  }
}

type AnchorEnd = 'start' | 'end';

/**
 * Exhaustively (only reordered via weightedShuffle, never truncated) yields
 * every self-avoiding-walk path of adjacent tiles onto which `word` could
 * be placed — each tile along the path either empty or already holding the
 * required letter. Considers anchoring from either end of the word (not
 * just the first letter) so that reuse opportunities near the end of a
 * word are found as readily as ones near the start. Paths are yielded as
 * fresh array copies in forward word index order (path[i] <-> word[i]),
 * regardless of which end anchored the search.
 */
function* findPlacementPaths(
  word: string,
  tiles: readonly InternalTile[],
  adjacency: ReadonlyMap<string, InternalTile[]>,
  rng: () => number,
): Generator<InternalTile[]> {
  const firstLetter = word[0];
  const lastLetter = word[word.length - 1];

  const anchors: { tile: InternalTile; end: AnchorEnd }[] = [
    ...findValidPlacements(firstLetter, tiles).map((tile) => ({ tile, end: 'start' as const })),
    ...findValidPlacements(lastLetter, tiles).map((tile) => ({ tile, end: 'end' as const })),
  ];

  const weightedAnchors = anchors.map((anchor) => {
    const requiredLetter = anchor.end === 'start' ? firstLetter : lastLetter;
    const weight = anchor.tile.letter === requiredLetter ? REUSE_STEP_WEIGHT : 1;
    return { item: anchor, weight };
  });

  for (const { tile, end } of weightedShuffle(weightedAnchors, rng)) {
    // Anchored from the last letter -> walk the reversed word forward.
    const effectiveWord = end === 'start' ? word : [...word].reverse().join('');
    const visited = new Set<string>([tile.id]);

    for (const path of extendPlacementPath([tile], effectiveWord, adjacency, visited, rng)) {
      // The walk was built through the reversed word when end === 'end',
      // so path[i] currently holds word[word.length - 1 - i]; reverse it
      // back so callers always see path[i] <-> word[i].
      yield end === 'end' ? [...path].reverse() : path;
    }
  }
}

function* extendPlacementPath(
  path: InternalTile[],
  effectiveWord: string,
  adjacency: ReadonlyMap<string, InternalTile[]>,
  visited: Set<string>,
  rng: () => number,
): Generator<InternalTile[]> {
  if (path.length === effectiveWord.length) {
    yield [...path]; // fresh copy — path keeps mutating after this yield
    return;
  }

  const nextLetter = effectiveWord[path.length];
  const current = path[path.length - 1];
  const neighbors = adjacency.get(current.id) ?? [];

  const candidates = neighbors
    .filter((n) => !visited.has(n.id) && (n.letter === null || n.letter === nextLetter))
    .map((n) => ({ item: n, weight: n.letter === nextLetter ? REUSE_STEP_WEIGHT : 1 }));

  for (const next of weightedShuffle(candidates, rng)) {
    path.push(next);
    visited.add(next.id);
    yield* extendPlacementPath(path, effectiveWord, adjacency, visited, rng);
    visited.delete(next.id);
    path.pop();
  }
}

function applyPlacement(path: readonly InternalTile[], word: string): string[] {
  const newlyFilled: string[] = [];
  for (let i = 0; i < path.length; i++) {
    if (path[i].letter === null) {
      path[i].letter = word[i];
      newlyFilled.push(path[i].id);
    }
  }
  return newlyFilled;
}

function undoPlacement(
  tileById: ReadonlyMap<string, InternalTile>,
  newlyFilledIds: readonly string[],
): void {
  for (const id of newlyFilledIds) {
    const tile = tileById.get(id);
    if (!tile) {
      throw new Error(`undoPlacement: unknown tile id ${id}`);
    }
    tile.letter = null;
  }
}

/**
 * Backtracking search: repeatedly picks a weighted-random eligible word and
 * a weighted-random adjacent-tile path for it, fills any still-empty tiles
 * along that path, and recurses. On failure it undoes the placement and
 * tries the next path, then the next word. Returns false only once every
 * word/path combination at this level is exhausted, which propagates the
 * backtrack to the caller. Never capped — completeness (not a bounded
 * budget) is what makes `buildBoard` throwing on failure a meaningful
 * signal rather than a false negative.
 */
function fillBoard(
  tiles: readonly InternalTile[],
  tileById: ReadonlyMap<string, InternalTile>,
  adjacency: ReadonlyMap<string, InternalTile[]>,
  wordOrder: readonly string[],
  usedWords: Set<string>,
  rng: () => number,
): boolean {
  if (tiles.every((tile) => tile.letter !== null)) {
    return true;
  }

  for (const word of candidateWords(wordOrder, usedWords, tiles, rng)) {
    for (const path of findPlacementPaths(word, tiles, adjacency, rng)) {
      const newlyFilled = applyPlacement(path, word);
      usedWords.add(word);

      if (fillBoard(tiles, tileById, adjacency, wordOrder, usedWords, rng)) {
        return true;
      }

      undoPlacement(tileById, newlyFilled);
      usedWords.delete(word);
    }
  }

  return false;
}

/**
 * Builds the board via constructive backtracking placement: repeatedly
 * picks a weighted-random word (favoring longer and more letter-reusing
 * words) and a weighted-random adjacent-tile path for it, fills in any
 * still-empty tiles along that path, and recurses into itself for the next
 * word; on failure it undoes the placement and tries the next path/word,
 * backtracking until every tile is covered by at least one placed word.
 *
 * Candidates are restricted to SCOWL's common tier (`rarities` from
 * `loadWordRarities()`), not the full ~190K-word eligible dictionary —
 * deliberately planted words should be recognizable, and it shrinks the
 * one-time word-ranking pass considerably. `solveBoard` still scores the
 * finished board against the full dictionary, so rare words can still turn
 * up as incidental bonus finds; they just never drive construction.
 *
 * Throws if the search is genuinely exhausted without success. This is not
 * a fallback — no precondition check is performed before attempting, since
 * the search itself is exhaustive and doesn't depend on any single word or
 * path remaining available. In practice this should be unreachable given
 * real dictionary sizes; it would only trigger on something like an empty
 * or catastrophically small word pool.
 */
export function buildBoard(
  eligibleWords: readonly string[],
  rarities: ReadonlyMap<string, boolean>,
  rng: () => number,
): Tile[] {
  const tiles: InternalTile[] = generateHexCoords(2).map((coord) => ({
    id: tileId(coord),
    q: coord.q,
    r: coord.r,
    letter: null,
  }));
  const tileById = new Map(tiles.map((tile) => [tile.id, tile]));
  const adjacency = buildAdjacencyMap(tiles);
  // rarities.get(word) === false means "known common"; true means rare;
  // undefined (word absent from the map) is treated as non-common.
  const commonWords = eligibleWords.filter((word) => rarities.get(word) === false);
  const wordOrder = weightedWordOrder(commonWords, rng);

  const success = fillBoard(tiles, tileById, adjacency, wordOrder, new Set(), rng);
  if (!success) {
    throw new Error('buildBoard: exhausted every placement without filling the board');
  }

  return tiles.map((tile) => {
    if (tile.letter === null) {
      throw new Error(`buildBoard: tile ${tile.id} unfilled after a successful fill`);
    }
    return { id: tile.id, q: tile.q, r: tile.r, letter: tile.letter.toUpperCase() };
  });
}
