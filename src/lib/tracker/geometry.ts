import type { CamRect, Point } from '@/types';

/**
 * Geometria del tracker de figuretes: càmera → pantalla del tauler → mapa.
 *
 * 1. **Càmera → pantalla**: homografia de 4 punts (les 4 cantonades de la imatge del monitor
 *    que el DM clica al vídeo). Treballa en coordenades normalitzades (0..1) a tots dos
 *    costats, així no depèn de la resolució de la càmera ni de la de la pantalla.
 * 2. **Pantalla → mapa**: la mateixa regla «contain» de `camToView` (`lib/camera.ts`): la
 *    pantalla de mida W×H mostra el rectangle de mapa `cam` amb escala `min(W/cam.w, H/cam.h)`
 *    centrat. O sigui, un punt (sx, sy) de pantalla és `cam.cx + (sx − W/2)/sc` al mapa.
 */

/** Matriu 3×3 en ordre de files (h33 = 1). */
export type Homography = [number, number, number, number, number, number, number, number, number];

/**
 * Homografia que porta `src[i]` a `dst[i]` (4 parelles). `null` si els punts són
 * degenerats (tres en línia, o repetits).
 */
export function homography(src: readonly Point[], dst: readonly Point[]): Homography | null {
  if (src.length !== 4 || dst.length !== 4) return null;
  // Sistema 8×8: per a cada parella, dues equacions en h11..h32.
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i], { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  if (!h) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

export function applyH(H: Homography, p: Point): Point {
  const w = H[6] * p.x + H[7] * p.y + H[8];
  return { x: (H[0] * p.x + H[1] * p.y + H[2]) / w, y: (H[3] * p.x + H[4] * p.y + H[5]) / w };
}

/** Eliminació gaussiana amb pivot parcial. `null` si el sistema és singular. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-10) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Cantonades de la pantalla en ordre: dalt-esquerra, dalt-dreta, baix-dreta, baix-esquerra. */
export const SCREEN_CORNERS: readonly Point[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
export const CORNER_NAMES = ['dalt a l\'esquerra', 'dalt a la dreta', 'baix a la dreta', 'baix a l\'esquerra'] as const;

/** Punt normalitzat de pantalla (0..1) → coordenades de mapa. */
export function screenToMap(u: number, v: number, W: number, H: number, cam: CamRect): Point {
  const sc = Math.min(W / Math.max(cam.w, 1e-6), H / Math.max(cam.h, 1e-6));
  return { x: cam.cx + (u * W - W / 2) / sc, y: cam.cy + (v * H - H / 2) / sc };
}

/** Coordenades de mapa → punt normalitzat de pantalla (per pintar al vídeo). */
export function mapToScreen(p: Point, W: number, H: number, cam: CamRect): Point {
  const sc = Math.min(W / Math.max(cam.w, 1e-6), H / Math.max(cam.h, 1e-6));
  return { x: ((p.x - cam.cx) * sc + W / 2) / W, y: ((p.y - cam.cy) * sc + H / 2) / H };
}

export interface GridInfo { gs: number; gox: number; goy: number; snap: boolean }

/** Origen de la graella reduït a [0, gs) (mateixa normalització que el DM). */
export function gridInfo(gs: number, ox: number, oy: number, snap: boolean): GridInfo {
  if (!(gs > 0)) return { gs: 0, gox: 0, goy: 0, snap: false };
  return { gs, gox: ((ox % gs) + gs) % gs, goy: ((oy % gs) + gs) % gs, snap };
}

/** Casella d'un CENTRE de token (`null` sense graella). */
export function cellOf(c: Point, g: GridInfo): string | null {
  if (!(g.gs > 0)) return null;
  return `${Math.floor((c.x - g.gox) / g.gs)},${Math.floor((c.y - g.goy) / g.gs)}`;
}

/**
 * Posició del token (cantonada de dalt a l'esquerra, com `pos`) per a un centre donat, amb
 * el mateix encaix al centre de la casella que el drag del jugador (`snapPos` a
 * `usePlayerTokenDrag`): si el DM té l'encaix activat, el token cau al mig de la casella.
 */
export function tokenPosFor(center: Point, R: number, g: GridInfo): Point {
  if (!g.snap || !(g.gs > 0)) return { x: center.x - R, y: center.y - R };
  const snapCC = (v: number, o: number) => Math.round((v - o - g.gs / 2) / g.gs) * g.gs + o + g.gs / 2;
  return { x: snapCC(center.x, g.gox) - R, y: snapCC(center.y, g.goy) - R };
}

/**
 * Dues posicions físiques són «la mateixa» si cauen a la mateixa casella (amb graella) o
 * a menys de mig token (sense).
 */
export function samePlace(a: Point, b: Point, g: GridInfo, R: number): boolean {
  if (g.gs > 0) return cellOf(a, g) === cellOf(b, g);
  return Math.hypot(a.x - b.x, a.y - b.y) < R;
}
