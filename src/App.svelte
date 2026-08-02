<script lang="ts">
  import HexGrid from './lib/HexGrid.svelte';
  import { generateHexCoords, tileId, type Tile, type WordSubmission } from './lib/hexGeometry';

  const placeholderLetters = 'ABCDEFGHIJKLMNOPQRS'.split('');
  const tiles: Tile[] = generateHexCoords(2).map((coord, i) => ({
    id: tileId(coord),
    q: coord.q,
    r: coord.r,
    letter: placeholderLetters[i] ?? '?',
  }));

  let rejectedToken = $state(0);

  function handleSelectionChange(path: Tile[]) {
    console.log('selection:', path.map((t) => t.letter).join(''));
  }

  function handleWordSubmit(submission: WordSubmission) {
    console.log('submitted word:', submission.word);
    rejectedToken += 1;
  }
</script>

<main>
  <HexGrid
    {tiles}
    onSelectionChange={handleSelectionChange}
    onWordSubmit={handleWordSubmit}
    {rejectedToken}
  />
</main>

<style>
  main {
    width: 100vw;
    height: 100vh;
  }
</style>
