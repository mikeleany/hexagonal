<script lang="ts">
  import {
    areAdjacent,
    axialToPixel,
    computeViewBox,
    hexPolygonPoints,
    type Tile,
    type WordSubmission,
  } from './hexGeometry';

  const HEX_SIZE = 10;
  const HEX_GAP = 1.3;

  let {
    tiles,
    onSelectionChange,
    onWordSubmit,
    rejectedToken,
  }: {
    tiles: Tile[];
    onSelectionChange?: (path: Tile[]) => void;
    onWordSubmit?: (submission: WordSubmission) => void;
    rejectedToken?: number;
  } = $props();

  let selection = $state<Tile[]>([]);
  let hasMoved = $state(false);
  let shaking = $state(false);
  let lastSubmittedPath = $state<Tile[]>([]);

  let tileMap = $derived(new Map(tiles.map((t) => [t.id, t])));
  let viewBox = $derived(computeViewBox(tiles, HEX_SIZE, HEX_GAP));
  let selectedIds = $derived(new Set(selection.map((t) => t.id)));
  // The live selection takes priority; once it's cleared, the just-submitted path
  // stays visible for the "rejected" flash instead of vanishing immediately.
  let displayPath = $derived(selection.length > 1 ? selection : shaking ? lastSubmittedPath : []);

  function centerOf(tile: Tile): { x: number; y: number } {
    return axialToPixel(tile, HEX_SIZE + HEX_GAP / 2);
  }

  $effect(() => {
    onSelectionChange?.(selection);
  });

  // The window losing focus (e.g. an OS window switcher, alt-tab) doesn't fire
  // pointercancel — the mouse button state is untouched — so a pointerup can
  // still land wherever the cursor happens to be and submit unintentionally.
  // Cancel the in-progress drag as soon as focus is lost, before that can happen.
  $effect(() => {
    function cancelDrag() {
      selection = [];
      hasMoved = false;
    }
    function handleVisibilityChange() {
      if (document.hidden) cancelDrag();
    }
    window.addEventListener('blur', cancelDrag);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('blur', cancelDrag);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });

  // svelte-ignore state_referenced_locally -- intentional: snapshot the initial value only
  let previousRejectedToken = $state(rejectedToken);
  $effect(() => {
    if (rejectedToken !== undefined && rejectedToken !== previousRejectedToken) {
      previousRejectedToken = rejectedToken;
      shaking = true;
      setTimeout(() => {
        shaking = false;
      }, 300);
    }
  });

  function tileFromPoint(x: number, y: number): Tile | null {
    const el = document.elementFromPoint(x, y);
    const tileEl = el?.closest<SVGElement>('[data-tile-id]');
    const id = tileEl?.getAttribute('data-tile-id');
    return id ? (tileMap.get(id) ?? null) : null;
  }

  function tileFromEvent(e: PointerEvent): Tile | null {
    const target = e.target as Element;
    const tileEl = target.closest<SVGElement>('[data-tile-id]');
    const id = tileEl?.getAttribute('data-tile-id');
    return id ? (tileMap.get(id) ?? null) : null;
  }

  /**
   * Extends the path to `tile` if it's adjacent to the last tile, backtracks if
   * it's the previous tile in the path, or otherwise leaves the path unchanged
   * (drifting off-path mid-drag shouldn't cancel or restart the selection).
   */
  function extendPath(tile: Tile) {
    const last = selection.at(-1);
    if (!last || tile.id === last.id) return;
    const secondToLast = selection.at(-2);
    if (secondToLast && tile.id === secondToLast.id) {
      selection = selection.slice(0, -1);
      return;
    }
    if (areAdjacent(last, tile) && !selection.some((t) => t.id === tile.id)) {
      selection = [...selection, tile];
    }
  }

  function submitSelection() {
    lastSubmittedPath = selection;
    onWordSubmit?.({ tiles: selection, word: selection.map((t) => t.letter).join('') });
    selection = [];
  }

  function releasePointer(e: PointerEvent) {
    // Browsers auto-release capture on pointerup, so this can throw even for
    // genuine drags — must not block the logic that follows.
    try {
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function handlePointerDown(e: PointerEvent) {
    const tile = tileFromEvent(e);
    selection = tile ? [tile] : [];
    hasMoved = false;
    // Best-effort: keeps pointermove/pointerup routed here even if the pointer
    // strays outside the SVG mid-drag. Can throw if the id isn't an active
    // pointer (e.g. synthetic events) — capture is an enhancement, not required.
    try {
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function handlePointerMove(e: PointerEvent) {
    if (e.buttons === 0 || selection.length === 0) return;
    const tile = tileFromPoint(e.clientX, e.clientY);
    if (!tile || tile.id === selection.at(-1)?.id) return;
    hasMoved = true;
    extendPath(tile);
  }

  function handlePointerUp(e: PointerEvent) {
    releasePointer(e);
    const releaseTile = tileFromPoint(e.clientX, e.clientY);
    const last = selection.at(-1);
    if (hasMoved && selection.length > 1 && last && releaseTile?.id === last.id) {
      submitSelection();
    } else {
      selection = [];
    }
    hasMoved = false;
  }

  function handlePointerCancel(e: PointerEvent) {
    releasePointer(e);
    selection = [];
    hasMoved = false;
  }
</script>

<div class="hexgrid">
  <svg
    viewBox="{viewBox.minX} {viewBox.minY} {viewBox.width} {viewBox.height}"
    preserveAspectRatio="xMidYMid meet"
    role="application"
    aria-label="Hexagon letter grid"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerCancel}
  >
    {#each tiles as tile (tile.id)}
      <g class="tile" class:selected={selectedIds.has(tile.id)} data-tile-id={tile.id}>
        <polygon points={hexPolygonPoints(centerOf(tile), HEX_SIZE)} />
        <text x={centerOf(tile).x} y={centerOf(tile).y}>{tile.letter}</text>
      </g>
    {/each}
    {#if displayPath.length > 1}
      <polyline
        class="selection-line"
        class:shaking
        points={displayPath.map((t) => `${centerOf(t).x},${centerOf(t).y}`).join(' ')}
      />
    {/if}
  </svg>
</div>

<style>
  .hexgrid {
    --hex-fill: #61dafb;
    --hex-text: #282c34;
    width: 100%;
    height: 100%;
  }

  svg {
    width: 100%;
    height: 100%;
    touch-action: none;
  }

  .tile polygon {
    fill: var(--hex-fill);
    cursor: pointer;
  }

  .tile text {
    fill: var(--hex-text);
    font-size: 8px;
    font-weight: 600;
    text-anchor: middle;
    dominant-baseline: central;
    pointer-events: none;
    user-select: none;
  }

  .selection-line {
    fill: none;
    stroke: var(--hex-text);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    pointer-events: none;
  }

  .selection-line.shaking {
    stroke: #e05555;
    animation: shake 0.3s ease-in-out;
  }

  @keyframes shake {
    0%,
    100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-1.5px);
    }
    75% {
      transform: translateX(1.5px);
    }
  }
</style>
