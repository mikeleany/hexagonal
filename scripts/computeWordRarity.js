// Precomputes a rarity value (0 = most common, 1 = most rare) for every word
// in enable1.txt, using Peter Norvig's Google Web Trillion Word Corpus list
// (norvig.com/ngrams/count_1w.txt) as the frequency source, and writes the
// result to src/lib/wordRarity.txt in enable1.txt's original line order
// (order must be preserved — boardConstruction.ts indexes into the word
// list with a seeded RNG, so reordering would silently change which word
// gets planted on a given day's board).
//
// Words not found in the corpus get rarity = 1.0 directly (treated as
// maximally rare) rather than being run through the normalization formula.
//
// TODO(data-source): Norvig's corpus only covers 45.6% of ENABLE1 - see
// https://github.com/mikeleany/hexagonal/issues/11 for the coverage gap
// and other reasons this data source is a deferred v1 decision.
//
// Usage: node scripts/computeWordRarity.js

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const CACHE_DIR = path.join(repoRoot, '.cache');
const NORVIG_CACHE_PATH = path.join(CACHE_DIR, 'norvig-count_1w.txt');
const NORVIG_URL = 'https://norvig.com/ngrams/count_1w.txt';

const ENABLE1_PATH = path.join(repoRoot, 'src/lib/enable1.txt');
const OUTPUT_PATH = path.join(repoRoot, 'src/lib/wordRarity.txt');
const MISSING_WORDS_PATH = path.join(CACHE_DIR, 'missing-words.txt');

async function fetchNorvigCorpus() {
  mkdirSync(CACHE_DIR, { recursive: true });
  if (existsSync(NORVIG_CACHE_PATH)) {
    console.log(`Using cached corpus at ${NORVIG_CACHE_PATH}`);
    return readFileSync(NORVIG_CACHE_PATH, 'utf-8');
  }
  console.log(`Fetching ${NORVIG_URL} ...`);
  const response = await fetch(NORVIG_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch corpus: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  writeFileSync(NORVIG_CACHE_PATH, text, 'utf-8');
  console.log(`Cached corpus to ${NORVIG_CACHE_PATH}`);
  return text;
}

function parseNorvigCorpus(raw) {
  const counts = new Map();
  for (const line of raw.split(/\r?\n/)) {
    if (!line) continue;
    const [word, countStr] = line.split(/\s+/);
    const count = Number(countStr);
    if (word && Number.isFinite(count)) {
      counts.set(word.toLowerCase(), count);
    }
  }
  return counts;
}

// Applies the same lowercase + /^[a-z]+$/ filtering that dictionary.ts's
// parseWordRarityFile() applies when reading this script's output. Must
// stay in sync with that function if its filtering logic ever changes.
function loadEnable1Words() {
  const raw = readFileSync(ENABLE1_PATH, 'utf-8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter((word) => /^[a-z]+$/.test(word));
}

function computeStats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const percentile = (p) => sorted[Math.min(n - 1, Math.floor((p / 100) * n))];
  const mean = sorted.reduce((sum, v) => sum + v, 0) / n;
  return {
    n,
    min: sorted[0],
    max: sorted[n - 1],
    mean,
    median: percentile(50),
    p10: percentile(10),
    p25: percentile(25),
    p75: percentile(75),
    p90: percentile(90),
    p95: percentile(95),
    p99: percentile(99),
  };
}

function printStats(label, stats, formatter = (v) => v) {
  console.log(`\n${label}`);
  console.log(`  n:      ${stats.n}`);
  console.log(`  min:    ${formatter(stats.min)}`);
  console.log(`  p10:    ${formatter(stats.p10)}`);
  console.log(`  p25:    ${formatter(stats.p25)}`);
  console.log(`  median: ${formatter(stats.median)}`);
  console.log(`  mean:   ${formatter(stats.mean)}`);
  console.log(`  p75:    ${formatter(stats.p75)}`);
  console.log(`  p90:    ${formatter(stats.p90)}`);
  console.log(`  p95:    ${formatter(stats.p95)}`);
  console.log(`  p99:    ${formatter(stats.p99)}`);
  console.log(`  max:    ${formatter(stats.max)}`);
}

async function main() {
  const corpusRaw = await fetchNorvigCorpus();
  const counts = parseNorvigCorpus(corpusRaw);

  const words = loadEnable1Words();

  const matched = [];
  const missing = [];
  for (const word of words) {
    const count = counts.get(word);
    if (count !== undefined) {
      matched.push({ word, count });
    } else {
      missing.push(word);
    }
  }

  if (matched.length === 0) {
    throw new Error('No dictionary words matched the Norvig corpus — check the corpus format.');
  }

  const matchedCounts = matched.map((e) => e.count);
  // Avoid Math.min(...matchedCounts)/Math.max(...matchedCounts): spreading
  // tens of thousands of arguments into a call relies on the engine's
  // argument-count limit, which isn't guaranteed across environments.
  let minCount = Infinity;
  let maxCount = -Infinity;
  for (const count of matchedCounts) {
    if (count < minCount) minCount = count;
    if (count > maxCount) maxCount = count;
  }
  const logMin = Math.log(minCount);
  const logMax = Math.log(maxCount);
  const logRange = logMax - logMin;

  const rarityByWord = new Map();
  for (const { word, count } of matched) {
    const rarity =
      logRange === 0 ? 0 : 1 - (Math.log(count) - logMin) / logRange;
    rarityByWord.set(word, rarity);
  }
  for (const word of missing) {
    rarityByWord.set(word, 1.0);
  }

  const outputLines = words.map((word) => `${word}\t${rarityByWord.get(word).toFixed(6)}`);
  writeFileSync(OUTPUT_PATH, outputLines.join('\n') + '\n', 'utf-8');
  console.log(`\nWrote ${words.length} entries to ${OUTPUT_PATH}`);

  const missingSorted = [...missing].sort();
  writeFileSync(MISSING_WORDS_PATH, missingSorted.join('\n') + '\n', 'utf-8');
  console.log(`Wrote ${missingSorted.length} missing words to ${MISSING_WORDS_PATH}`);

  printStats('Raw count distribution (matched words only)', computeStats(matchedCounts), (v) =>
    Math.round(v).toLocaleString(),
  );
  printStats(
    'Final rarity distribution (all dictionary words, including forced-1.0 missing)',
    computeStats(words.map((w) => rarityByWord.get(w))),
    (v) => v.toFixed(4),
  );

  const missingPct = ((missing.length / words.length) * 100).toFixed(1);
  console.log(
    `\nMatched: ${matched.length} / Missing: ${missing.length} (${missingPct}%) of ${words.length} total words`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
