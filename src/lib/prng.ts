/**
 * Deterministic seeding and pseudo-random number generation for daily
 * puzzle generation. Pure integer arithmetic only, so results are
 * identical across engines (no `Math.random()`, no engine-specific
 * floating point quirks).
 */

/** FNV-1a 32-bit string hash, used to turn a date string into a PRNG seed. */
export function hashStringToSeed(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32 PRNG. Returns a generator producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Today's (or the given) date as a YYYY-MM-DD string in Mountain Time. */
export function getMountainTimeDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Deterministic seed derived from the Mountain Time calendar date. */
export function seedForDate(date: Date = new Date()): number {
  return hashStringToSeed(getMountainTimeDateString(date));
}

/** Picks a uniformly random element using the given RNG. Throws on empty input. */
export function pickRandomElement<T>(rng: () => number, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('pickRandomElement: items is empty');
  }
  return items[Math.floor(rng() * items.length)];
}
