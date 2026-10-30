/**
 * Finestres del paquet (`uf_interface.png`): el panell fosc arrodonit de 72×32 que es pot
 * estirar a qualsevol mida (9 trossos: quatre cantonades de 8 px, vores i fons). N'hi ha
 * dos colors: blau nit (`navy`) i pruna (`plum`).
 */
import { blit } from './draw';
import { sheet } from './pack';

export type PixelWindow = 'navy' | 'plum';
const ORIGIN: Record<PixelWindow, [number, number]> = { navy: [8, 88], plum: [8, 120] };
const C = 8;          // cantonada
const PW = 72, PH = 32;
const MID = 12;       // fila / columna neta per estirar les vores i el fons

/** Panell a (x, y, w, h) en píxels del full (enters). Mínim 16×16. */
export function drawWindow(ctx: CanvasRenderingContext2D, kind: PixelWindow, x: number, y: number, w: number, h: number): boolean {
  if (!sheet('interface')) return false;
  const [ox, oy] = ORIGIN[kind];
  w = Math.max(2 * C, Math.round(w)); h = Math.max(2 * C, Math.round(h));
  x = Math.round(x); y = Math.round(y);
  const iw = w - 2 * C, ih = h - 2 * C;
  // Fons i vores (estirats a partir d'una fila o columna sense costures).
  blit(ctx, 'interface', ox + MID, oy + MID, 1, 1, x + C, y + C, iw, ih);
  blit(ctx, 'interface', ox + MID, oy, 1, C, x + C, y, iw, C);
  blit(ctx, 'interface', ox + MID, oy + PH - C, 1, C, x + C, y + h - C, iw, C);
  blit(ctx, 'interface', ox, oy + MID, C, 1, x, y + C, C, ih);
  blit(ctx, 'interface', ox + PW - C, oy + MID, C, 1, x + w - C, y + C, C, ih);
  // Cantonades.
  blit(ctx, 'interface', ox, oy, C, C, x, y, C, C);
  blit(ctx, 'interface', ox + PW - C, oy, C, C, x + w - C, y, C, C);
  blit(ctx, 'interface', ox, oy + PH - C, C, C, x, y + h - C, C, C);
  blit(ctx, 'interface', ox + PW - C, oy + PH - C, C, C, x + w - C, y + h - C, C, C);
  return true;
}

/** Bombolla de pensament (cercle de 6 px del full), per fer el rastre del «pensament». */
export function drawThoughtDot(ctx: CanvasRenderingContext2D, x: number, y: number): boolean {
  return blit(ctx, 'interface', 137, 329, 6, 6, Math.round(x), Math.round(y), 6, 6);
}
