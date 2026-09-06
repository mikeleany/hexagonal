/**
 * Retroactively removes a word from every committed puzzle file, plus adds
 * it to scripts/wordBlacklist.txt so future generations never replant it.
 * This is the sanctioned way to fix an offensive word that slipped past
 * generateWordLists.py's SCOWL/LDNOOBW/blacklist filtering and was
 * discovered live (issue #37's deliberate exception to "a puzzle never
 * changes once served") -- it edits only the `words` array of each affected
 * file, never `puzzleId`/`date`/the board, so in-progress player state tied
 * to that puzzleId stays valid.
 *
 * Removes from every puzzle file (not just today's), since issue #32 means
 * old puzzles stay playable in an archive -- a word inappropriate for
 * today's puzzle is inappropriate for all of them.
 *
 *   npx vite-node scripts/removeWord.ts <word>
 */
import { readdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { PuzzleFileData } from '../src/lib/dailyPuzzle';

const PUZZLES_DIR = path.join('public', 'puzzles');
const BLACKLIST_PATH = path.join('scripts', 'wordBlacklist.txt');

// Mirrors generateWordLists.py's load_hand_maintained_wordlist: one
// lowercase word per line, '#' starts an inline comment, blank lines
// ignored.
function loadBlacklist(): Set<string> {
  if (!existsSync(BLACKLIST_PATH)) return new Set();
  const words = new Set<string>();
  for (const rawLine of readFileSync(BLACKLIST_PATH, 'utf8').split(/\r?\n/)) {
    const word = rawLine.split('#', 1)[0].trim().toLowerCase();
    if (word) words.add(word);
  }
  return words;
}

function removeFromPuzzleFiles(target: string): string[] {
  const affectedDates: string[] = [];
  if (!existsSync(PUZZLES_DIR)) return affectedDates;
  for (const file of readdirSync(PUZZLES_DIR)) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(PUZZLES_DIR, file);
    const data: PuzzleFileData = JSON.parse(readFileSync(filePath, 'utf8'));
    const filteredWords = data.words.filter((w) => w.word.toLowerCase() !== target);
    if (filteredWords.length !== data.words.length) {
      const updated: PuzzleFileData = { ...data, words: filteredWords };
      writeFileSync(filePath, JSON.stringify(updated) + '\n');
      affectedDates.push(data.date);
    }
  }
  return affectedDates;
}

function main(): void {
  const [word, ...rest] = process.argv.slice(2);
  if (!word || rest.length > 0) {
    throw new Error('removeWord: expected exactly one argument, the word to remove');
  }
  const target = word.toLowerCase();

  const affectedDates = removeFromPuzzleFiles(target);
  if (affectedDates.length > 0) {
    console.log(`Removed ${JSON.stringify(target)} from: ${affectedDates.sort().join(', ')}`);
  } else {
    console.log(`${JSON.stringify(target)} was not found in any puzzle file.`);
  }

  if (loadBlacklist().has(target)) {
    console.log(`${JSON.stringify(target)} is already in scripts/wordBlacklist.txt.`);
  } else {
    appendFileSync(BLACKLIST_PATH, `${target}\n`);
    console.log(`Added ${JSON.stringify(target)} to scripts/wordBlacklist.txt.`);
  }

  console.log('Run "npm run words:generate" before the next puzzle generation to keep it out of future puzzles.');
}

main();
