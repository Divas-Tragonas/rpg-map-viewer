/**
 * Edició de parets ja dibuixades: moure vèrtexs i esborrar trams concrets.
 *
 * Fins ara una paret mal posada només es podia desfer amb Backspace mentre encara era
 * l'última de la cadena; passat aquell moment, l'única sortida era esborrar la sala
 * sencera i tornar-la a dibuixar.
 *
 * Un "vèrtex" no és una entitat pròpia: és un punt on coincideixen els extrems de dues o
 * més parets. Per això moure'l vol dir moure **tots** els extrems que hi cauen a sobre —
 * si no, la cantonada s'obriria i la sala deixaria de detectar-se.
 */
import type { Point, Wall } from '@/types';

/** Marge (px de mapa) perquè dos extrems es considerin el mateix vèrtex. */
export const VERTEX_TOL = 1.5;

const near = (a: Point, b: Point, tol: number) => Math.hypot(a.x - b.x, a.y - b.y) <= tol;

/** Vèrtexs únics del conjunt de parets (extrems fusionats per proximitat). */
export function wallVertices(walls: Wall[]): Point[] {
  const out: Point[] = [];
  for (const w of walls) {
    for (const v of [w.a, w.b]) {
      if (!out.some(p => near(p, v, VERTEX_TOL))) out.push(v);
    }
  }
  return out;
}

/** Vèrtex sota el punt `p` dins de `tol`, o null. El més proper guanya. */
export function vertexAt(walls: Wall[], p: Point, tol: number): Point | null {
  let best: Point | null = null, bestD = tol;
  for (const w of walls) {
    for (const v of [w.a, w.b]) {
      const d = Math.hypot(p.x - v.x, p.y - v.y);
      if (d < bestD) { bestD = d; best = v; }
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}

/** Parets que toquen un vèrtex (les que es mouran amb ell). */
export function wallsAtVertex(walls: Wall[], v: Point): Wall[] {
  return walls.filter(w => near(w.a, v, VERTEX_TOL) || near(w.b, v, VERTEX_TOL));
}

/**
 * Mou un vèrtex: retorna un array NOU on tots els extrems que queien sobre `from` passen
 * a `to`. Les parets que quedarien degenerades (extrems al mateix punt) es descarten.
 */
export function moveVertex(walls: Wall[], from: Point, to: Point): Wall[] {
  const out: Wall[] = [];
  for (const w of walls) {
    const a = near(w.a, from, VERTEX_TOL) ? to : w.a;
    const b = near(w.b, from, VERTEX_TOL) ? to : w.b;
    if (Math.hypot(a.x - b.x, a.y - b.y) < 0.5) continue;  // s'ha col·lapsat: cau
    out.push({ a, b });
  }
  return out;
}

/** Paret sota el punt `p` (distància al segment ≤ tol), o null. Per esborrar-ne una. */
export function wallAt(walls: Wall[], p: Point, tol: number): Wall | null {
  let best: Wall | null = null, bestD = tol;
  for (const w of walls) {
    const dx = w.b.x - w.a.x, dy = w.b.y - w.a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-6) continue;
    let t = ((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(p.x - (w.a.x + t * dx), p.y - (w.a.y + t * dy));
    if (d < bestD) { bestD = d; best = w; }
  }
  return best;
}
