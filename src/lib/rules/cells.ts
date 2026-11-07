import type { Point } from '@/types';

/**
 * Distàncies i abasts **per caselles** (v5 snapshot 3): amb graella, tot el que és abast o àrea
 * es calcula i es pinta a casella, com a la taula. Sense graella es continua fent amb cercles.
 *
 * Mètrica: la del moviment (`handlePlayerTokenMove`/`renderMoveRange`): de casella a casella
 * hi ha `ceil(hypot(dc, dr) − 0.5)` caselles (1 en diagonal al costat, 3 a dues diagonals), × 5 ft.
 * Un token ocupa les caselles amb el centre dins de la seva base (un token gros, 2×2 o més);
 * com a mínim, la del seu centre.
 */
export interface Grid { gs: number; gox: number; goy: number }
export type Cell = readonly [number, number];

export function gridOf(gs: number, originX: number, originY: number): Grid | null {
  if (!(gs > 0)) return null;
  return { gs, gox: ((originX % gs) + gs) % gs, goy: ((originY % gs) + gs) % gs };
}

export const cellOfPoint = (p: Point, g: Grid): Cell => [Math.floor((p.x - g.gox) / g.gs), Math.floor((p.y - g.goy) / g.gs)];
export const cellCenter = (c: Cell, g: Grid): Point => ({ x: g.gox + (c[0] + 0.5) * g.gs, y: g.goy + (c[1] + 0.5) * g.gs });
export const cellKeyOf = (c: Cell) => `${c[0]},${c[1]}`;

/** Caselles que ocupa un token (centre i radi en coords de mapa). */
export function tokenCells(p: Point, R: number, g: Grid): Cell[] {
  const out: Cell[] = [];
  const lim = R * 0.9;
  const c0 = Math.floor((p.x - R - g.gox) / g.gs), c1 = Math.floor((p.x + R - g.gox) / g.gs);
  const r0 = Math.floor((p.y - R - g.goy) / g.gs), r1 = Math.floor((p.y + R - g.goy) / g.gs);
  for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) {
    const m = cellCenter([c, r], g);
    if (Math.hypot(m.x - p.x, m.y - p.y) <= lim) out.push([c, r]);
  }
  return out.length ? out : [cellOfPoint(p, g)];
}

/** Caselles entre dues caselles (mètrica del moviment). */
export const cellSteps = (a: Cell, b: Cell) => Math.max(0, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) - 0.5));

/** Distància en peus entre dos grups de caselles (la més curta). */
export function cellsDistFt(A: readonly Cell[], B: readonly Cell[]): number {
  let best = Infinity;
  for (const a of A) for (const b of B) { const d = cellSteps(a, b); if (d < best) best = d; }
  return Number.isFinite(best) ? best * 5 : 0;
}

/** Caselles a ≤ `ft` peus de qualsevol casella de `from` (sense les de `from`). */
export function rangeCells(from: readonly Cell[], ft: number): Cell[] {
  const n = Math.floor(ft / 5);
  if (n <= 0 || from.length === 0) return [];
  let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity;
  for (const [c, r] of from) { c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r); }
  const own = new Set(from.map(cellKeyOf));
  const out: Cell[] = [];
  for (let c = c0 - n; c <= c1 + n; c++) for (let r = r0 - n; r <= r1 + n; r++) {
    if (own.has(`${c},${r}`)) continue;
    for (const a of from) if (cellSteps(a, [c, r]) <= n) { out.push([c, r]); break; }
  }
  return out;
}

/** Caselles d'una àrea circular: les que tenen el centre dins del radi (regla de la plantilla). */
export function circleCells(center: Point, radiusFt: number, g: Grid): Cell[] {
  const rad = (radiusFt / 5) * g.gs + 0.001;
  const out: Cell[] = [];
  const c0 = Math.floor((center.x - rad - g.gox) / g.gs), c1 = Math.floor((center.x + rad - g.gox) / g.gs);
  const r0 = Math.floor((center.y - rad - g.goy) / g.gs), r1 = Math.floor((center.y + rad - g.goy) / g.gs);
  for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) {
    const m = cellCenter([c, r], g);
    if (Math.hypot(m.x - center.x, m.y - center.y) <= rad) out.push([c, r]);
  }
  // Una àrea més petita que una casella (2,5 ft: un sol objectiu) és la casella del centre.
  return out.length ? out : [cellOfPoint(center, g)];
}

// ── Pintura: regions de caselles com a un sol camí (farciment + perímetre esglaonat) ─────────

const _paths = new Map<string, { fill: Path2D; edge: Path2D }>();

/** Camins (cachejats) per pintar un grup de caselles: el farciment i només les arestes de fora. */
export function cellsPaths(cells: readonly Cell[], g: Grid, cacheKey?: string): { fill: Path2D; edge: Path2D } {
  if (cacheKey) { const hit = _paths.get(cacheKey); if (hit) return hit; }
  const set = new Set(cells.map(cellKeyOf));
  const fill = new Path2D(), edge = new Path2D();
  for (const [c, r] of cells) {
    const x = g.gox + c * g.gs, y = g.goy + r * g.gs, s = g.gs;
    fill.rect(x, y, s, s);
    if (!set.has(`${c - 1},${r}`)) { edge.moveTo(x, y); edge.lineTo(x, y + s); }
    if (!set.has(`${c + 1},${r}`)) { edge.moveTo(x + s, y); edge.lineTo(x + s, y + s); }
    if (!set.has(`${c},${r - 1}`)) { edge.moveTo(x, y); edge.lineTo(x + s, y); }
    if (!set.has(`${c},${r + 1}`)) { edge.moveTo(x, y + s); edge.lineTo(x + s, y + s); }
  }
  const out = { fill, edge };
  if (cacheKey) { if (_paths.size > 40) _paths.clear(); _paths.set(cacheKey, out); }
  return out;
}

/** Abast cachejat: les caselles i els camins només es recalculen si canvia l'origen o l'abast. */
export function rangePaths(from: readonly Cell[], ft: number, g: Grid): { fill: Path2D; edge: Path2D } {
  const key = `R|${from.map(cellKeyOf).join(';')}|${ft}|${g.gs}|${g.gox}|${g.goy}`;
  const hit = _paths.get(key);
  if (hit) return hit;
  return cellsPaths(rangeCells(from, ft), g, key);
}
