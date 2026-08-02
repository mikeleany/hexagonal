export type AxialCoord = { q: number; r: number };
export type Tile = { id: string; q: number; r: number; letter: string };
export type WordSubmission = { tiles: Tile[]; word: string };

export function tileId(coord: AxialCoord): string {
  return `${coord.q},${coord.r}`;
}

/** Generates axial coordinates for a hexagon-of-hexagons of the given radius. */
export function generateHexCoords(radius: number): AxialCoord[] {
  const coords: AxialCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r++) {
      coords.push({ q, r });
    }
  }
  return coords;
}

const AXIAL_DIRECTIONS: AxialCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function areAdjacent(a: AxialCoord, b: AxialCoord): boolean {
  const dq = b.q - a.q;
  const dr = b.r - a.r;
  return AXIAL_DIRECTIONS.some((d) => d.q === dq && d.r === dr);
}

export function axialToPixel(coord: AxialCoord, size: number): { x: number; y: number } {
  return {
    x: size * (Math.sqrt(3) * coord.q + (Math.sqrt(3) / 2) * coord.r),
    y: size * (1.5 * coord.r),
  };
}

export function hexPolygonPoints(center: { x: number; y: number }, size: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    points.push(`${center.x + size * Math.cos(angle)},${center.y + size * Math.sin(angle)}`);
  }
  return points.join(' ');
}

export type ViewBox = { minX: number; minY: number; width: number; height: number };

/** Computes an SVG viewBox that contains every tile's hexagon, given as pixel centers. */
export function computeViewBox(coords: AxialCoord[], size: number, gap: number): ViewBox {
  const pad = size + gap;
  const centers = coords.map((c) => axialToPixel(c, size + gap / 2));
  const xs = centers.map((c) => c.x);
  const ys = centers.map((c) => c.y);
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}
