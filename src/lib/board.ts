import { generateHexCoords, tileId, type Tile } from './hexGeometry';

/**
 * Minimal hand-designed placeholder board: every word in `wordList.ts` is a
 * verified adjacent-tile path on this exact layout. Replace once real
 * dictionary + board-enumeration logic exists.
 */
const LETTERS: Record<string, string> = {
  '-2,0': 'M',
  '-2,1': 'T',
  '-2,2': 'L',
  '-1,-1': 'D',
  '-1,0': 'I',
  '-1,1': 'H',
  '-1,2': 'C',
  '0,-2': 'A',
  '0,-1': 'E',
  '0,0': 'N',
  '0,1': 'G',
  '0,2': 'U',
  '1,-2': 'B',
  '1,-1': 'F',
  '1,0': 'O',
  '1,1': 'W',
  '2,-2': 'Y',
  '2,-1': 'S',
  '2,0': 'R',
};

export const BOARD_TILES: Tile[] = generateHexCoords(2).map((coord) => {
  const id = tileId(coord);
  return { id, ...coord, letter: LETTERS[id] };
});
