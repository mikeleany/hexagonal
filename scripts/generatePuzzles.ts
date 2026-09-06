/**
 * Pre-generates daily puzzle files under public/puzzles/YYYY-MM-DD.json, run
 * via `vite-node` (needed because dailyPuzzle.ts transitively imports
 * dictionary.ts's Vite-specific `?raw` import -- vite-node runs through
 * Vite's own module graph/plugins outside the dev server, resolving it with
 * no source changes). See .github/workflows/generate-puzzles.yml for the
 * scheduled/CI invocation and package.json's puzzles:generate(:local)
 * scripts for local invocation.
 *
 *   npx vite-node scripts/generatePuzzles.ts [--offset-days N] [--days N] [--force]
 *
 * Idempotent by default: skips any date whose file already exists, so a
 * rerun (a retry, a manual backfill, the nightly cron firing twice) never
 * clobbers an already-committed puzzle -- including one a moderator has
 * since hand-edited via removeWord.ts.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generateDailyPuzzle, toPuzzleFileData } from '../src/lib/dailyPuzzle';
import { loadWordRarities } from '../src/lib/dictionary';
import { getMountainTimeDateString } from '../src/lib/prng';

function parseArgs(argv: string[]): { offsetDays: number; days: number; force: boolean } {
  let offsetDays = 0;
  let days = 1;
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--offset-days':
        offsetDays = Number(argv[++i]);
        break;
      case '--days':
        days = Number(argv[++i]);
        break;
      case '--force':
        force = true;
        break;
      default:
        throw new Error(`generatePuzzles: unrecognized argument ${JSON.stringify(argv[i])}`);
    }
  }
  if (!Number.isInteger(offsetDays) || !Number.isInteger(days) || days < 1) {
    throw new Error('generatePuzzles: --offset-days and --days must be integers, --days >= 1');
  }
  return { offsetDays, days, force };
}

// A noon-UTC anchor for a YYYY-MM-DD string always falls within the same
// Mountain-Time calendar day regardless of the MST/MDT offset (UTC-7/-6),
// so this round-trips cleanly through getMountainTimeDateString for an
// arbitrary target date, not just "now".
function dateForMountainDateString(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00Z`);
}

function addDays(dateStr: string, days: number): string {
  const d = dateForMountainDateString(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return getMountainTimeDateString(d);
}

function main(): void {
  const { offsetDays, days, force } = parseArgs(process.argv.slice(2));
  const todayStr = getMountainTimeDateString(new Date());
  const startStr = addDays(todayStr, offsetDays);
  const rarities = loadWordRarities();

  for (let i = 0; i < days; i++) {
    const dateStr = addDays(startStr, i);
    const outPath = path.join('public', 'puzzles', `${dateStr}.json`);
    if (existsSync(outPath) && !force) {
      console.log(`skip ${dateStr} (already exists)`);
      continue;
    }
    const puzzle = generateDailyPuzzle(dateForMountainDateString(dateStr));
    const data = toPuzzleFileData(puzzle, dateStr, rarities);
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(data) + '\n');
    console.log(`generated ${dateStr}`);
  }
}

main();
