import type { BoardView, CamRect } from '@/types';

/**
 * Mode tauler: les figuretes físiques són damunt d'un monitor horitzontal. Perquè hi caben
 * (bases d'una polzada) i perquè no es desquadrin quan el DM fa pan o zoom, la pantalla del
 * tauler (`/player?tauler=1`) mostra el mapa a escala fixa: **1 casella = 1 polzada física**,
 * centrada on diu el DM (`BoardView.cx/cy`). Ho fan servir la pantalla del tauler, el tracker
 * (`/tracker`, per passar de pantalla a mapa) i el DM (per pintar el rectangle del tauler).
 */

export const CM_PER_INCH = 2.54;

/**
 * Moviment d'una figureta que el DM ha rebutjat (no era el seu torn, paret, peus…). La
 * figureta física ja és allà i no es pot fer rebotar: el DM veu una silueta i tria
 * «Acceptar» (el token hi va igualment) o «Ignorar» (el jugador torna la figureta).
 */
export interface PhysPending { x: number; y: number; reason: string; t: number }

/**
 * Rectangle de mapa que mostra una pantalla de tauler de W×H px CSS. `null` si el mode està
 * apagat o no es pot calcular (sense graella o sense amplada física): llavors mana `cam`.
 */
export function boardCam(b: BoardView | null | undefined, W: number, H: number, gs: number): CamRect | null {
  if (!b?.on || !(b.widthCm > 0) || !(gs > 0) || !(W > 0) || !(H > 0)) return null;
  const cellPx = (W / b.widthCm) * CM_PER_INCH; // px de pantalla per polzada
  const sc = cellPx / gs;                        // px de pantalla per unitat de mapa
  return { cx: b.cx, cy: b.cy, w: W / sc, h: H / sc };
}

/** Caselles senceres que hi caben (per informar el DM). */
export function boardCells(b: BoardView, W: number, H: number): { cols: number; rows: number } {
  const inchW = b.widthCm / CM_PER_INCH;
  return { cols: Math.floor(inchW), rows: Math.floor(inchW * (H / Math.max(W, 1))) };
}

/** Pàgina amb `?tauler=1`: és la pantalla de jugador del tauler. */
export function isTableScreenUrl(search: string): boolean {
  const v = new URLSearchParams(search).get('tauler');
  return v === '1' || v === 'true' || v === 'si' || v === 'sí';
}
