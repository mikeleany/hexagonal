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
```

There is no test suite and no linter/formatter configured — `npm run check` is the only correctness gate. Always run it after making changes. Note that it only catches type errors: layout/interaction bugs (e.g. a reflow triggered by content changes) can type-check cleanly and still be broken, so UI/layout changes need manual browser verification too.

## Architecture

- [src/lib/hexGeometry.ts](src/lib/hexGeometry.ts) — pure geometry/data functions: axial coordinate generation (`generateHexCoords`), adjacency (`areAdjacent`), axial→pixel projection, SVG hex polygon points, and viewBox computation. Also owns the core types `AxialCoord`, `Tile`, `WordSubmission`. Everything here is framework-agnostic and easily unit-testable in isolation if tests are ever added.
- [src/lib/dailyPuzzle.ts](src/lib/dailyPuzzle.ts) — orchestrator that replaced the old hand-picked board/word-list placeholders. `generateDailyPuzzle(date)` deterministically builds the day's board and computes the full valid-word answer key from scratch; `DAILY_TILES`/`DAILY_WORD_LIST` are the eagerly-evaluated exports `App.svelte` consumes. Seeded by the current date in Mountain Time (via [src/lib/prng.ts](src/lib/prng.ts)'s `seedForDate`/`mulberry32`), so every player sees the same puzzle on a given day, and reloading never changes it.
  - [src/lib/dictionary.ts](src/lib/dictionary.ts) — loads the bundled ENABLE word list ([src/lib/enable1.txt](src/lib/enable1.txt), ~172,823 words, public domain, unfiltered) and filters it to the tunable `MIN_WORD_LENGTH`/`MAX_WORD_LENGTH` bounds (currently 3–19). The source file itself is never pre-filtered, so those bounds can change without touching the asset. Offensive-word filtering is a known deferred TODO in this file.
  - [src/lib/boardConstruction.ts](src/lib/boardConstruction.ts) — `buildBoard` plants one seed-randomly chosen 19-letter word along a fixed Hamiltonian path ([src/lib/hamiltonianPath.ts](src/lib/hamiltonianPath.ts)) covering all 19 tiles, guaranteeing every tile is used by at least one word. This is an explicitly temporary v1 strategy (flagged with a file-level TODO) — it only works because the board is hardcoded to exactly 19 tiles and relies on there being English words of exactly that length. The eventual replacement is general multi-word constructive placement with backtracking.
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
- **Dictionary is bundled, not fetched**: `dictionary.ts` imports `enable1.txt` via Vite's `?raw` suffix, so the whole ~172K-word list (public domain, unfiltered) is inlined into the JS bundle at build time (~1.7MB pre-compression) rather than fetched at runtime. This keeps puzzle generation fully synchronous — no loading state anywhere in `App.svelte` — at the cost of a heavier main bundle; revisit with a dynamic `import()` or `public/`+`fetch()` if that cost ever matters.

## Svelte 5 conventions used in this codebase

- Runes only (`$state`, `$derived`, `$props`, `$effect`) — no legacy `export let` / reactive `$:` statements.
- Components receive callback props (`onSelectionChange`, `onWordSubmit`) rather than dispatching custom events.
