import type { CamRect, Point } from '@/types';
import { clampCamToMap } from '@/lib/camera';

/**
 * Enquadrament de la càmera d'un diàleg, en coordenades de MAPA (com `bossCamRect`, però
 * més tancat: el que parla s'ha de veure gros). Viatja dins del camp `dialog` i cada
 * pantalla el fa encaixar amb `camToView`, sigui quina sigui la seva mida i format.
 *
 * La caixa de diàleg tapa la part de baix de la pantalla: la càmera baixa una mica el centre
 * perquè qui parla quedi al terç de dalt.
 */
export interface Speaker { center: Point; R: number }

/** Alçada de mapa que es veu enfocant un sol token. */
const span = (sp: Speaker, cell: number) => Math.max(cell * 6, sp.R * 2 * 5.5);

/** Dos que parlen seguits són «a prop» si caben junts sense obrir gaire més la càmera. */
export function nearEnough(a: Speaker, b: Speaker, cell: number): boolean {
  const d = Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y);
  return d < span(a, cell) * 1.25;
}

export function dialogCamRect(who: Speaker[], cur: CamRect, mw: number, mh: number, cell: number): CamRect {
  const ar = cur.w / Math.max(cur.h, 1e-6);
  const xs = who.map(s => s.center.x), ys = who.map(s => s.center.y);
  const pad = Math.max(...who.map(s => s.R)) * 3;
  const bw = Math.max(...xs) - Math.min(...xs) + pad * 2, bh = Math.max(...ys) - Math.min(...ys) + pad * 2;
  // Prou alt per a l'enquadrament d'un sol token, per a tots dos i pel format de la pantalla.
  let h = Math.max(span(who[0], cell), bh * 1.5, bw / ar);
  // Mai més obert que el que ja es veu (seria allunyar-se) ni que el mapa sencer.
  h = Math.min(h, cur.h, mh);
  const w = h * ar;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2 + h * 0.12;
  return clampCamToMap({ cx, cy, w, h }, mw, mh);
}

/** Dos rectangles pràcticament iguals: no cal tornar a enviar res. */
export function sameCam(a: CamRect | null, b: CamRect | null): boolean {
  if (!a || !b) return a === b;
  const tol = Math.max(a.w, b.w) * 0.004;
  return Math.abs(a.cx - b.cx) < tol && Math.abs(a.cy - b.cy) < tol && Math.abs(a.w - b.w) < tol && Math.abs(a.h - b.h) < tol;
}
