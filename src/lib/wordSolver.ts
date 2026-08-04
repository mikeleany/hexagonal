import { areAdjacent, type Tile } from './hexGeometry';
import type { TrieNode } from './trie';

function buildAdjacencyMap(tiles: readonly Tile[]): Map<string, Tile[]> {
  const adjacency = new Map<string, Tile[]>();
  for (const tile of tiles) {
    const neighbors = tiles.filter((other) => other.id !== tile.id && areAdjacent(tile, other));
    adjacency.set(tile.id, neighbors);
  }
  return adjacency;
}

/**
 * Exhaustively finds every dictionary word (per `trie`) that traces a path
 * of adjacent tiles, never revisiting a tile within one word — an
 * independent reimplementation of the same rule `HexGrid.svelte` enforces
 * client-side for drag selection, not a call into that component.
 */
export function solveBoard(
  tiles: readonly Tile[],
  trie: TrieNode,
  minLength: number,
  maxLength: number,
): string[] {
  const adjacency = buildAdjacencyMap(tiles);
  const found = new Set<string>();

  function dfs(tile: Tile, node: TrieNode, wordSoFar: string, visited: Set<string>): void {
    const letter = tile.letter.toLowerCase();
    const child = node.children.get(letter);
    if (!child) {
      return;
    }
    const word = wordSoFar + letter;
    if (child.isWord && word.length >= minLength && word.length <= maxLength) {
      found.add(word.toUpperCase());
    }
    if (word.length >= maxLength) {
      return;
    }
    visited.add(tile.id);
    for (const neighbor of adjacency.get(tile.id) ?? []) {
      if (!visited.has(neighbor.id)) {
        dfs(neighbor, child, word, visited);
      }
    }
    visited.delete(tile.id);
  }

  for (const tile of tiles) {
    dfs(tile, trie, '', new Set());
  }

  return [...found].sort();
}
