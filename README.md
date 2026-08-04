# Hexagonal

A word-search game in the style of Spelling Bee/Bonza: drag across a hexagonal letter grid to spell words from that day's word list.

## Playing

Click and drag from tile to tile — each tile you drag across must be adjacent to the last, and letters are read off in the order you cross them. Release on the last tile of a valid word to submit it; releasing anywhere else cancels the selection. If the submitted word isn't on the list, it's rejected with a red flash. Words you've already found are tracked in the sidebar, grouped by length by default (toggle to a flat alphabetical list if you prefer).

## Status

This is an early-stage prototype. The board and word list are generated client-side each day, deterministically seeded by the current date (Mountain Time) — see [src/lib/dailyPuzzle.ts](src/lib/dailyPuzzle.ts). Board construction currently uses a temporary v1 strategy (plant one 19-letter dictionary word across the whole board) rather than the general multi-word placement algorithm that's planned for later; offensive-word filtering on the bundled dictionary is also not implemented yet. Both are flagged with TODOs in the code.

## Development

Requires Node.js. Install dependencies, then:

```bash
npm install
npm run dev      # start the dev server at http://localhost:5173
npm run build    # production build
npm run preview  # preview a production build
npm run check    # typecheck (svelte-check + tsc); the only correctness gate — there's no test suite or linter yet
```

Built with [Svelte 5](https://svelte.dev) (runes), TypeScript, and [Vite](https://vite.dev).

`prototypes/` holds standalone HTML/CSS experiments from before the Svelte app existed — not part of the build.
