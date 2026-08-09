const THRESHOLDS = [0, 0.2, 0.4, 0.6, 0.8, 1.0] as const;

/** Largest step in {0, 0.2, ..., 1.0} that is <= foundCommonCount/totalCommonCount. */
export function hintThreshold(foundCommonCount: number, totalCommonCount: number): number {
  if (totalCommonCount <= 0) return 0;
  const ratio = foundCommonCount / totalCommonCount;
  let result: number = THRESHOLDS[0];
  for (const t of THRESHOLDS) {
    if (t <= ratio) result = t;
  }
  return result;
}

/** Number of letters to reveal: grows with `t`, but always strictly less than half the word. */
function shownCount(length: number, t: number): number {
  const raw = Math.floor((length * t) / 2) + 1;
  const cap = Math.ceil(length / 2) - 1;
  return Math.min(raw, cap);
}

/** Indices from the start: 0, 1, 2, ... */
function bSequence(length: number): number[] {
  return Array.from({ length }, (_, i) => i);
}

/** Indices from the end: length-1, length-2, ... */
function eSequence(length: number): number[] {
  return Array.from({ length }, (_, i) => length - 1 - i);
}

/**
 * Indices expanding outward from the center, one more to the left than the
 * right whenever the count can't be balanced. Odd lengths start on the exact
 * center letter; even lengths start on the innermost left/right pair.
 */
function mSequence(length: number): number[] {
  const seq: number[] = [];
  const odd = length % 2 === 1;
  let left: number;
  let right: number;
  if (odd) {
    const center = (length - 1) / 2;
    seq.push(center);
    left = center - 1;
    right = center + 1;
  } else {
    left = length / 2 - 1;
    right = length / 2;
  }
  while (left >= 0 || right < length) {
    if (left >= 0) seq.push(left--);
    if (right < length) seq.push(right++);
  }
  return seq;
}

/** Reveal order: B1,B2,E1,E2,M1,M2,B3,E3,M3,B4,E4,M4,... */
function revealOrder(length: number): number[] {
  const b = bSequence(length);
  const e = eSequence(length);
  const m = mSequence(length);
  const order = [b[0], b[1], e[0], e[1], m[0], m[1]];
  for (let i = 2; i < length; i++) {
    if (i < b.length) order.push(b[i]);
    if (i < e.length) order.push(e[i]);
    if (i < m.length) order.push(m[i]);
  }
  return order;
}

/** Same-length placeholder for `word`: revealed letters shown, rest replaced with `_`. */
export function hintString(word: string, t: number): string {
  const n = shownCount(word.length, t);
  const revealed = new Set(revealOrder(word.length).slice(0, n));
  return [...word].map((ch, i) => (revealed.has(i) ? ch : '_')).join('');
}
