# Hexagonal

A word-search game in the style of Spelling Bee/Bonza: drag across a hexagonal letter grid to spell words from a fixed word list.

## Playing

Click and drag from tile to tile — each tile you drag across must be adjacent to the last, and letters are read off in the order you cross them. Release on the last tile of a valid word to submit it; releasing anywhere else cancels the selection. Words you've already found are tracked in the sidebar, grouped by length by default (toggle to a flat alphabetical list if you prefer).

## Status

This is an early-stage prototype. The board layout ([src/lib/board.ts](src/lib/board.ts)) and word list ([src/lib/wordList.ts](src/lib/wordList.ts)) are both small, hand-picked placeholders — every word in the list is a manually verified path on that exact board — standing in for real dictionary-driven board generation. Swapping one out requires re-verifying the other, or valid submissions will silently fail.

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
