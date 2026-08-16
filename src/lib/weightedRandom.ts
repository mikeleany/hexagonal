/**
 * Efraimidis–Spirakis weighted random permutation without replacement.
 * Each item gets key `rng() ** (1 / weight)`; sorting descending by key
 * yields a full permutation where higher-weight items tend to sort
 * earlier. Never truncates or samples a subset — every input item appears
 * exactly once in the output, only reordered. One rng() call per item;
 * deterministic given a fixed rng sequence. All weights must be > 0 —
 * enforced below, since a zero/negative/non-finite weight would silently
 * produce a NaN/Infinity key and corrupt the sort order.
 */
export function weightedShuffle<T>(
  items: readonly { item: T; weight: number }[],
  rng: () => number,
): T[] {
  return items
    .map(({ item, weight }) => {
      if (!Number.isFinite(weight) || weight <= 0) {
        throw new Error(`weightedShuffle: weight must be a finite positive number, got ${weight}`);
      }
      return { item, key: rng() ** (1 / weight) };
    })
    .sort((a, b) => b.key - a.key)
    .map(({ item }) => item);
}
