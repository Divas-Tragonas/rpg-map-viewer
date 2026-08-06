import type { Point, Wall, Door } from '@/types';

// Tolerància (px de mapa) perquè una porta "pertanyi" a una paret: el punt mitjà de la
// porta ha de caure sobre el segment de la paret dins d'aquest marge.
const ON_WALL_TOL = 3;
// Amplada de porta per defecte quan no hi ha grid (px de mapa).
export const DOOR_WIDTH_FALLBACK = 60;

interface WallFrame { w: Wall; len: number; ux: number; uy: number; }

function frame(w: Wall): WallFrame | null {
  const dx = w.b.x - w.a.x, dy = w.b.y - w.a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  return { w, len, ux: dx / len, uy: dy / len };
}

// Paràmetre s (distància des de w.a al llarg de la paret) del punt mitjà de la porta,
// o null si la porta no és sobre aquesta paret.
function doorSpanOnWall(d: Door, f: WallFrame): [number, number] | null {
  const mid = { x: (d.a.x + d.b.x) / 2, y: (d.a.y + d.b.y) / 2 };
  const s = (mid.x - f.w.a.x) * f.ux + (mid.y - f.w.a.y) * f.uy;
  if (s < -ON_WALL_TOL || s > f.len + ON_WALL_TOL) return null;
  const px = f.w.a.x + f.ux * s, py = f.w.a.y + f.uy * s;
  if (Math.hypot(mid.x - px, mid.y - py) > ON_WALL_TOL) return null;
  const half = Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y) / 2;
  return [Math.max(0, s - half), Math.min(f.len, s + half)];
}

/**
 * Parets "efectives" per a llum i col·lisió: les parets amb els trams de porta OBERTA
 * retallats (una porta tancada deixa la paret sencera i torna a bloquejar). La detecció
 * de sales continua usant les parets senceres (una porta no parteix la sala).
 * Sense portes obertes retorna el mateix array (zero cost).
 */
export function effectiveWalls(walls: Wall[], allDoors: Door[]): Wall[] {
  const doors = allDoors.filter(d => d.open !== false);
  if (doors.length === 0) return walls;
  const out: Wall[] = [];
  for (const w of walls) {
    const f = frame(w);
    if (!f) { out.push(w); continue; }
    const spans: [number, number][] = [];
    for (const d of doors) {
      const sp = doorSpanOnWall(d, f);
      if (sp) spans.push(sp);
    }
    if (spans.length === 0) { out.push(w); continue; }
    spans.sort((p, q) => p[0] - q[0]);
    let cur = 0;
    const at = (s: number): Point => ({ x: w.a.x + f.ux * s, y: w.a.y + f.uy * s });
    for (const [s0, s1] of spans) {
      if (s0 - cur > 1) out.push({ a: at(cur), b: at(s0) });
      cur = Math.max(cur, s1);
    }
    if (f.len - cur > 1) out.push({ a: at(cur), b: w.b });
  }
  return out;
}

/**
 * Col·locació de porta amb imant: projecta el cursor sobre la paret més propera i
 * retorna el segment de porta centrat a la projecció, sempre enganxat a la paret
 * ("snap" continu mentre llisques). Amb grid, el centre s'imanta a més al centre de
 * casella al llarg de l'eix dominant de la paret (la porta ocupa una casella exacta
 * a les parets alineades amb la graella). La porta queda sempre dins de la paret.
 */
export function doorPlacementAt(
  walls: Wall[],
  cursor: Point,
  width: number,
  grid: { gs: number; gox: number; goy: number } | null,
): { a: Point; b: Point } | null {
  let best: WallFrame | null = null, bestS = 0, bestD = Infinity;
  for (const w of walls) {
    const f = frame(w);
    if (!f) continue;
    let s = (cursor.x - w.a.x) * f.ux + (cursor.y - w.a.y) * f.uy;
    s = Math.max(0, Math.min(f.len, s));
    const px = w.a.x + f.ux * s, py = w.a.y + f.uy * s;
    const d = Math.hypot(cursor.x - px, cursor.y - py);
    if (d < bestD) { bestD = d; best = f; bestS = s; }
  }
  if (!best) return null;
  const dw = Math.min(width, best.len * 0.9);
  const clamp = (s: number) => Math.max(dw / 2, Math.min(best!.len - dw / 2, s));
  let s = clamp(bestS);
  if (grid && grid.gs > 0) {
    // Paritat: amb amplada senar (1, 3... caselles) el centre s'imanta al centre de
    // casella; amb amplada parella (2, 4...) a la frontera entre caselles — així la
    // porta cobreix sempre caselles exactes a les parets alineades amb la graella.
    const half = Math.round(dw / grid.gs) % 2 === 0 ? 0 : 0.5;
    const p = { x: best.w.a.x + best.ux * s, y: best.w.a.y + best.uy * s };
    if (Math.abs(best.ux) >= Math.abs(best.uy)) {
      const k = Math.round((p.x - grid.gox) / grid.gs - half);
      s = clamp(((grid.gox + (k + half) * grid.gs) - best.w.a.x) / best.ux);
    } else {
      const k = Math.round((p.y - grid.goy) / grid.gs - half);
      s = clamp(((grid.goy + (k + half) * grid.gs) - best.w.a.y) / best.uy);
    }
  }
  const at = (t: number): Point => ({ x: best!.w.a.x + best!.ux * t, y: best!.w.a.y + best!.uy * t });
  return { a: at(s - dw / 2), b: at(s + dw / 2) };
}

/** Poda: conserva només les portes que segueixen recolzades sobre alguna paret. */
export function pruneDoors(walls: Wall[], doors: Door[]): Door[] {
  if (doors.length === 0) return doors;
  const frames = walls.map(frame).filter((f): f is WallFrame => !!f);
  const kept = doors.filter(d => frames.some(f => doorSpanOnWall(d, f) !== null));
  return kept.length === doors.length ? doors : kept;
}

/** Porta sota el punt p (distància al segment ≤ tol), o null. Per esborrar amb clic dret. */
export function doorAt(doors: Door[], p: Point, tol: number): Door | null {
  for (const d of doors) {
    const dx = d.b.x - d.a.x, dy = d.b.y - d.a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-6) continue;
    let t = ((p.x - d.a.x) * dx + (p.y - d.a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    if (Math.hypot(p.x - (d.a.x + t * dx), p.y - (d.a.y + t * dy)) <= tol) return d;
  }
  return null;
}
