# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Hexagonal is a word-search game (Spelling Bee/Bonza-style) built with Svelte 5 + TypeScript + Vite. Players drag across a hexagonal letter grid to spell words from a fixed word list.

## Commands

```bash
npm run dev      # start Vite dev server (port 5173)
npm run build    # production build (runs `vite build`; no separate typecheck step)
npm run preview  # preview a production build
npm run check    # svelte-check (src/**/*.svelte, *.ts) + tsc --noEmit on tsconfig.node.json
```

There is no test suite and no linter/formatter configured — `npm run check` is the only correctness gate. Always run it after making changes. Note that it only catches type errors: layout/interaction bugs (e.g. a reflow triggered by content changes) can type-check cleanly and still be broken, so UI/layout changes need manual browser verification too.

## Architecture

- [src/lib/hexGeometry.ts](src/lib/hexGeometry.ts) — pure geometry/data functions: axial coordinate generation (`generateHexCoords`), adjacency (`areAdjacent`), axial→pixel projection, SVG hex polygon points, and viewBox computation. Also owns the core types `AxialCoord`, `Tile`, `WordSubmission`. Everything here is framework-agnostic and easily unit-testable in isolation if tests are ever added.
- [src/lib/board.ts](src/lib/board.ts) — `BOARD_TILES`, a hand-designed placeholder board (radius-2 hex-of-hexes) with a hardcoded letter per tile keyed by `"q,r"` id. Explicitly a stand-in for real dictionary-driven board generation.
- [src/lib/wordList.ts](src/lib/wordList.ts) — `WORD_LIST`, a hand-picked placeholder list where every word is a verified adjacent-tile path on the exact `board.ts` layout. If you change `board.ts`, you must re-verify or regenerate `wordList.ts` (and vice versa) or valid submissions will silently fail.
- [src/lib/wordGrouping.ts](src/lib/wordGrouping.ts) — pure function `groupWordsByLength` used by the sidebar to bucket found/total words by length.
- [src/lib/HexGrid.svelte](src/lib/HexGrid.svelte) — the interactive board. Owns all pointer-drag selection state (`selection`, `hasMoved`) and renders the SVG hex tiles + selection polyline. Selection is drag-only (pointerdown → move across adjacent tiles → release on the last tile to submit); no click/tap-to-select mode exists. Notifies the parent via `onSelectionChange` (live path, for the letters readout) and `onWordSubmit` (on release). Accepts a `rejectedToken` prop (increment-to-trigger) to play a shake animation when the parent determines a submitted word was invalid — the component itself has no notion of word validity.
- [src/App.svelte](src/App.svelte) — top-level state and word validation: holds `foundWords`, checks submissions against `WORD_LIST`, and wires `TitleBar` / `SelectionDisplay` / `HexGrid` / `Sidebar` together. This is the only place that knows what a "valid word" is; `HexGrid` and `Sidebar` are presentation-only.
- [src/lib/SelectionDisplay.svelte](src/lib/SelectionDisplay.svelte) / [src/lib/TitleBar.svelte](src/lib/TitleBar.svelte) / [src/lib/Sidebar.svelte](src/lib/Sidebar.svelte) — presentational, driven by props — though `SelectionDisplay` and `Sidebar` each keep small bits of local UI state (linger timer, grouped-by-length toggle) that don't round-trip through `App`.

### Notable patterns

- **Token props for one-shot animations**: both `HexGrid` (`rejectedToken`) and `SelectionDisplay` (`resultToken`) use an incrementing-counter prop pattern to trigger transient effects (shake/linger) from the parent, since Svelte has no built-in "fire an event" prop. Each snapshots the previous token value into a plain (non-`$state`) variable inside an `$effect` — making it `$state` causes the effect to read and write a tracked value, causing an immediate self-retrigger. See the comments in [HexGrid.svelte](src/lib/HexGrid.svelte) and [SelectionDisplay.svelte](src/lib/SelectionDisplay.svelte) before changing this pattern.
- **Layout stability over content-hugging**: `SelectionDisplay` uses a fixed `height` (not `min-height`) and `Sidebar`'s wrap in `App.svelte` uses a fixed flex-basis on narrow layouts, so that selecting/deselecting or finding more words never shifts the board's position — only window resizing should.
- `prototypes/` contains standalone HTML/CSS experiments from before the Svelte app existed; not part of the build.
- **Color palette isn't centralized**: the background (`#282c34`), accent yellow (`#f4d35e`), and reject red (`#e05555`) are each hardcoded independently in two places apiece (`app.css`/`HexGrid.svelte` for the background; `HexGrid.svelte`/`SelectionDisplay.svelte` for the other two) rather than defined once in a shared `:root`. A palette change today means updating both call sites by hand.

## Svelte 5 conventions used in this codebase

- Runes only (`$state`, `$derived`, `$props`, `$effect`) — no legacy `export let` / reactive `$:` statements.
- Components receive callback props (`onSelectionChange`, `onWordSubmit`) rather than dispatching custom events.
