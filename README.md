# Hexagonal

A word-search game in the style of Spelling Bee/Bonza: drag across a hexagonal letter grid to spell words from that day's word list.

## Playing

Click and drag from tile to tile — each tile you drag across must be adjacent to the last, and letters are read off in the order you cross them. Release on the last tile of a valid word to submit it; releasing anywhere else cancels the selection. If the submitted word isn't on the list, it's rejected with a red flash. Words you've already found are tracked in the sidebar, grouped by length by default (toggle to a flat alphabetical list if you prefer).

## Status

This is an early-stage prototype. The board and word list are generated client-side each day, deterministically seeded by the current date (Mountain Time) — see [src/lib/dailyPuzzle.ts](src/lib/dailyPuzzle.ts). Board construction uses constructive backtracking placement: words are placed one at a time along weighted-random adjacent-tile paths across the (partially filled) board, undoing and retrying when a placement leads to a dead end, until every tile is covered by at least one placed word. The dictionary is filtered for offensive words before it's ever bundled (SCOWL's profanity/slur tags, the LDNOOBW blocklist, and a hand-maintained blacklist/whitelist — see `scripts/generateWordLists.py`).

## Development

Requires Node.js. Install dependencies, then:

```bash
npm install
npm run dev      # start the dev server at http://localhost:5173
npm run build    # production build
npm run preview  # preview a production build
npm run check    # typecheck (svelte-check + tsc) — no linter configured yet
npm run test     # Vitest — currently covers just the board-construction algorithm
npm run bench    # Vitest benchmarks for the board-construction algorithm
```

`dev`/`build`/`check` each regenerate the word list from SCOWL first; the first run needs network access and `make`, and takes roughly a minute (cached after that).

Built with [Svelte 5](https://svelte.dev) (runes), TypeScript, and [Vite](https://vite.dev).

`prototypes/` holds standalone HTML/CSS experiments from before the Svelte app existed — not part of the build.
