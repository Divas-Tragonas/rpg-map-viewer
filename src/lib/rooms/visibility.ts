import type { Point, Wall } from '@/types';

// Marge angular per llançar rajos "frec a frec" dels vèrtexs: sense això el polígon de
// visibilitat no doblega les cantonades (no es veu més enllà de l'extrem d'una paret).
const EPS_ANGLE = 0.00012;

interface Seg { ax: number; ay: number; bx: number; by: number; }

// Distància t al llarg del raig (O + t·D) fins al segment AB, o Infinity si no el talla.
function rayHit(ox: number, oy: number, dx: number, dy: number, s: Seg): number {
  const rx = s.bx - s.ax, ry = s.by - s.ay;
  const den = dx * ry - dy * rx;
  if (Math.abs(den) < 1e-12) return Infinity;
  const t = ((s.ax - ox) * ry - (s.ay - oy) * rx) / den;         // al llarg del raig
  const u = ((s.ax - ox) * dy - (s.ay - oy) * dx) / den;         // al llarg del segment
  if (t < 0 || u < -1e-9 || u > 1 + 1e-9) return Infinity;
  return t;
}

/**
 * Polígon de visibilitat (línia de visió) des d'`origin` contra les parets, limitat al
 * quadrat de semicostat `maxR` centrat a l'origen. Raycasting per escombrat angular:
 * es llancen 3 rajos per cada vèrtex (angle exacte ± epsilon) i es pren la intersecció
 * més propera amb qualsevol paret o amb el marc del quadrat (que garanteix tancament).
 * Amb 0 parets retorna el quadrat sencer (la llum queda només retallada pel gradient).
 */
export function visibilityPolygon(origin: Point, walls: Wall[], maxR: number): Point[] {
  const { x: ox, y: oy } = origin;
  const L = ox - maxR, T = oy - maxR, Rr = ox + maxR, B = oy + maxR;

  // Només les parets que toquen el quadrat de llum (bbox) participen en el càlcul.
  const segs: Seg[] = [];
  for (const w of walls) {
    const minX = Math.min(w.a.x, w.b.x), maxX = Math.max(w.a.x, w.b.x);
    const minY = Math.min(w.a.y, w.b.y), maxY = Math.max(w.a.y, w.b.y);
    if (maxX < L || minX > Rr || maxY < T || minY > B) continue;
    segs.push({ ax: w.a.x, ay: w.a.y, bx: w.b.x, by: w.b.y });
  }
  // Marc del quadrat: tanca el polígon encara que cap paret talli el raig.
  segs.push({ ax: L, ay: T, bx: Rr, by: T });
  segs.push({ ax: Rr, ay: T, bx: Rr, by: B });
  segs.push({ ax: Rr, ay: B, bx: L, by: B });
  segs.push({ ax: L, ay: B, bx: L, by: T });

  // Angles candidats: tots els extrems de segment (± epsilon per doblegar cantonades).
  // Els vèrtexs compartits entre parets (a les sales, cada cantonada la toquen 2 parets) es
  // dedupliquen aquí. El bucle de rajos ja saltava els angles repetits després d'ordenar, o
  // sigui que el resultat és idèntic: el que s'estalvia és construir i ordenar un array
  // gairebé del doble de llarg a cada càlcul.
  const angles: number[] = [];
  const seenV = new Set<number>();
  for (const s of segs) {
    for (const [px, py] of [[s.ax, s.ay], [s.bx, s.by]] as const) {
      // Clau del vèrtex a resolució de ½ px (els extrems compartits coincideixen exactament,
      // però el marge evita rajos duplicats per vèrtexs pràcticament iguals).
      const vk = (Math.round(px * 2) << 16) ^ Math.round(py * 2);
      if (seenV.has(vk)) continue;
      seenV.add(vk);
      const a = Math.atan2(py - oy, px - ox);
      angles.push(a - EPS_ANGLE, a, a + EPS_ANGLE);
    }
  }
  angles.sort((a, b) => a - b);

  const pts: Point[] = [];
  let prevA = Infinity;
  for (const a of angles) {
    if (Math.abs(a - prevA) < 1e-9) continue;
    prevA = a;
    const dx = Math.cos(a), dy = Math.sin(a);
    let best = Infinity;
    for (const s of segs) {
      const t = rayHit(ox, oy, dx, dy, s);
      if (t < best) best = t;
    }
    if (best === Infinity) continue;
    pts.push({ x: ox + dx * best, y: oy + dy * best });
  }
  return pts;
}
