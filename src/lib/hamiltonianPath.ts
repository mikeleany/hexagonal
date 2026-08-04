import { areAdjacent, generateHexCoords, type AxialCoord } from './hexGeometry';

/**
 * Finds a path that visits every coordinate exactly once, moving only
 * between adjacent tiles, via backtracking DFS. Only practical for small
 * graphs (the current 19-tile board) — throws if no such path exists.
 */
export function findHamiltonianPath(coords: readonly AxialCoord[]): AxialCoord[] {
  const n = coords.length;
  const visited = new Array<boolean>(n).fill(false);
  const path: AxialCoord[] = [];

  function backtrack(index: number): boolean {
    path.push(coords[index]);
    visited[index] = true;
    if (path.length === n) {
      return true;
    }
    for (let next = 0; next < n; next++) {
      if (!visited[next] && areAdjacent(coords[index], coords[next])) {
        if (backtrack(next)) {
          return true;
        }
      }
    }
    path.pop();
    visited[index] = false;
    return false;
  }

  for (let start = 0; start < n; start++) {
    if (backtrack(start)) {
      return path;
    }
  }
  throw new Error('findHamiltonianPath: no Hamiltonian path found');
}

/**
 * A fixed tile-visiting order covering the whole board, computed once at
 * module load rather than hardcoded, so it self-verifies against
 * `hexGeometry.ts`'s adjacency/coordinate logic instead of silently going
 * stale if that logic ever changes.
 *
 * Only valid for the current fixed-size (radius 2, 19-tile) board — a
 * variable-shape board would need the general constructive-placement
 * approach in `boardConstruction.ts` instead of a single planted path.
 */
export const HAMILTONIAN_TILE_ORDER: readonly AxialCoord[] = findHamiltonianPath(
  generateHexCoords(2),
);
