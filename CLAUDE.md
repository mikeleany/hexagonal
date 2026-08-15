# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Hexagonal is a word-search game (Spelling Bee/Bonza-style) built with Svelte 5 + TypeScript + Vite. Players drag across a hexagonal letter grid to spell words from that day's deterministically generated word list.

## Commands

```bash
npm run dev      # start Vite dev server (port 5173)
npm run build    # production build (runs `vite build`; no separate typecheck step)
npm run preview  # preview a production build
npm run check    # svelte-check (src/**/*.svelte, *.ts) + tsc -p tsconfig.node.json (noEmit set in that config)
npm run test     # Vitest — currently just src/lib/boardConstruction.test.ts, not a general suite
npm run bench    # Vitest benchmarks — currently just src/lib/boardConstruction.bench.ts
```

`dev`/`build`/`check`/`test`/`bench` each run `words:generate` first (via `predev`/`prebuild`/`precheck`/`pretest`/`prebench`), which regenerates the dictionary from SCOWL into `.cache/scowl/` — see [src/lib/dictionary.ts](src/lib/dictionary.ts). The first run needs network access and `make`, and takes roughly a minute; subsequent runs reuse the cached download/build and are fast.

There's no linter/formatter configured. `npm run check` is the correctness gate for everything (types only — layout/interaction bugs like a reflow triggered by content changes can type-check cleanly and still be broken, so UI/layout changes need manual browser verification too). `npm run test`/`npm run bench` (Vitest) exist specifically for `boardConstruction.ts`'s backtracking placement algorithm, whose correctness (does it ever fail to fill the board?) and performance (it runs synchronously at page load, with no loading state) aren't things type-checking or manual play-testing can catch — this isn't yet a general test suite for the rest of the codebase.

## Architecture

- [src/lib/hexGeometry.ts](src/lib/hexGeometry.ts) — pure geometry/data functions: axial coordinate generation (`generateHexCoords`), adjacency (`areAdjacent`), axial→pixel projection, SVG hex polygon points, and viewBox computation. Also owns the core types `AxialCoord`, `Tile`, `WordSubmission`. Everything here is framework-agnostic and easily unit-testable in isolation if tests are ever added.
- [src/lib/dailyPuzzle.ts](src/lib/dailyPuzzle.ts) — orchestrator that replaced the old hand-picked board/word-list placeholders. `generateDailyPuzzle(date)` deterministically builds the day's board and computes the full valid-word answer key from scratch; `DAILY_TILES`/`DAILY_WORD_LIST` are the eagerly-evaluated exports `App.svelte` consumes. Seeded by the current date in Mountain Time (via [src/lib/prng.ts](src/lib/prng.ts)'s `seedForDate`/`mulberry32`), so every player sees the same puzzle on a given day, and reloading never changes it.
  - [src/lib/dictionary.ts](src/lib/dictionary.ts) — loads the generated word list (`.cache/scowl/words.txt`, produced by [scripts/generateWordLists.py](scripts/generateWordLists.py) from SCOWL v2, gitignored/not bundled — see that script's docstring) and filters it to the tunable `MIN_WORD_LENGTH`/`MAX_WORD_LENGTH` bounds (currently 3–19). The source file itself is never pre-filtered, so those bounds can change without regenerating anything. Also exposes each word's binary common/rare rarity tag via `loadWordRarities()`, consumed by [src/lib/scoring.ts](src/lib/scoring.ts). Offensive-word filtering (SCOWL's profanity/slur tags combined with the LDNOOBW blocklist, minus a whitelist) already happened upstream in `generateWordLists.py` before `words.txt` was written — every word this file can return has already passed that filter.
  - [src/lib/boardConstruction.ts](src/lib/boardConstruction.ts) — `buildBoard` fills the board via constructive backtracking placement: it repeatedly picks a weighted-random word (favoring longer and more letter-reusing words — see the tunable constants at the top of the file) and a weighted-random adjacent-tile path for it (considering placements anchored from either end of the word, not just the first letter, so reuse near the end of a word is found as readily as reuse near the start), fills in any still-empty tiles along that path, and recurses into itself for the next word. On failure it undoes the placement and tries the next path/word, backtracking until every tile is covered by at least one placed word. Word candidates are restricted to SCOWL's common tier (via `loadWordRarities()`), not the full eligible dictionary — deliberately planted words should be recognizable, and the smaller pool keeps the one-time word-ranking pass cheap; `wordSolver.ts` still scores the finished board against the full dictionary, so rare words can still turn up as incidental bonus finds. Throws if the search is genuinely exhausted without success — not a fallback, since no precondition check is performed before attempting; the search itself is exhaustive. Covered by [src/lib/boardConstruction.test.ts](src/lib/boardConstruction.test.ts) (`npm run test`) and [src/lib/boardConstruction.bench.ts](src/lib/boardConstruction.bench.ts) (`npm run bench`).
  - [src/lib/wordSolver.ts](src/lib/wordSolver.ts) — `solveBoard` is the real source of the answer key: an exhaustive trie-pruned DFS ([src/lib/trie.ts](src/lib/trie.ts)) over the finished board that finds every valid word (not just the one planted), independently reimplementing (not reusing) `HexGrid.svelte`'s no-revisit-tile rule.
- [src/lib/wordGrouping.ts](src/lib/wordGrouping.ts) — pure function `groupWordsByLength` used by the sidebar to bucket found/total words by length.
- [src/lib/HexGrid.svelte](src/lib/HexGrid.svelte) — the interactive board. Owns all pointer-drag selection state (`selection`, `hasMoved`) and renders the SVG hex tiles + selection polyline. Selection is drag-only (pointerdown → move across adjacent tiles → release on the last tile to submit); no click/tap-to-select mode exists. Notifies the parent via `onSelectionChange` (live path, for the letters readout) and `onWordSubmit` (on release). Accepts a `rejectedToken` prop (increment-to-trigger) to play a shake animation when the parent determines a submitted word was invalid — the component itself has no notion of word validity.
- [src/App.svelte](src/App.svelte) — top-level state and word validation: holds `foundWords`, checks submissions against a `Set` built from `DAILY_WORD_LIST`, and wires `TitleBar` / `SelectionDisplay` / `HexGrid` / `Sidebar` together. This is the only place that knows what a "valid word" is; `HexGrid` and `Sidebar` are presentation-only.
- [src/lib/SelectionDisplay.svelte](src/lib/SelectionDisplay.svelte) / [src/lib/TitleBar.svelte](src/lib/TitleBar.svelte) / [src/lib/Sidebar.svelte](src/lib/Sidebar.svelte) — presentational, driven by props — though `SelectionDisplay` and `Sidebar` each keep small bits of local UI state (linger timer, grouped-by-length toggle) that don't round-trip through `App`.

### Notable patterns

- **Token props for one-shot animations**: both `HexGrid` (`rejectedToken`) and `SelectionDisplay` (`resultToken`) use an incrementing-counter prop pattern to trigger transient effects (shake/linger) from the parent, since Svelte has no built-in "fire an event" prop. Each snapshots the previous token value into a plain (non-`$state`) variable inside an `$effect` — making it `$state` causes the effect to read and write a tracked value, causing an immediate self-retrigger. See the comments in [HexGrid.svelte](src/lib/HexGrid.svelte) and [SelectionDisplay.svelte](src/lib/SelectionDisplay.svelte) before changing this pattern.
- **Layout stability over content-hugging**: `SelectionDisplay` uses a fixed `height` (not `min-height`) and `Sidebar`'s wrap in `App.svelte` uses a fixed flex-basis on narrow layouts, so that selecting/deselecting or finding more words never shifts the board's position — only window resizing should.
- `prototypes/` contains standalone HTML/CSS experiments from before the Svelte app existed; not part of the build.
- **Color palette isn't centralized**: the background (`#282c34`), accent yellow (`#f4d35e`), and reject red (`#e05555`) are each hardcoded independently in two places apiece (`app.css`/`HexGrid.svelte` for the background; `HexGrid.svelte`/`SelectionDisplay.svelte` for the other two) rather than defined once in a shared `:root`. A palette change today means updating both call sites by hand.
- **Dictionary is generated, not vendored**: `dictionary.ts` imports `.cache/scowl/words.txt` via Vite's `?raw` suffix. That file isn't checked in — `scripts/generateWordLists.py` builds it from SCOWL v2 (download + local SQLite build) as a `predev`/`prebuild`/`precheck` step, and Vite inlines its contents into the JS bundle at build time. This keeps puzzle generation fully synchronous at runtime — no loading state anywhere in `App.svelte` — at the cost of needing network access and `make` for the first `dev`/`build`/`check` in a fresh checkout.

## Svelte 5 conventions used in this codebase

- Runes only (`$state`, `$derived`, `$props`, `$effect`) — no legacy `export let` / reactive `$:` statements.
- Components receive callback props (`onSelectionChange`, `onWordSubmit`) rather than dispatching custom events.
