import type { Point } from '@/types';

/**
 * Abast i distàncies (només AVÍS: l'app mostra, el DM decideix).
 *
 * Les distàncies es mesuren de **vora a vora**: el centre-a-centre menys el radi de cada
 * token, com a la taula comptes les caselles entre els costats de les miniatures. La mida
 * d'un token és el seu radi `R` (valor lliure del DM): no hi ha categories de 5e.
 * Sense graella no hi ha mida de casella per passar de píxels a peus: retorna `null`.
 */

/** Peus entre dos punts (sense mida), arrodonits al pas de 5 ft més proper. */
export function pxToFt(px: number, gridSize: number): number | null {
  if (gridSize <= 0) return null;
  return Math.max(0, Math.round(px / gridSize) * 5);
}

/** Distància vora a vora en peus (mínim 0). `ra`/`rb` = radi de cada token (0 per a un punt). */
export function edgeDistanceFt(a: Point, ra: number, b: Point, rb: number, gridSize: number): number | null {
  return pxToFt(Math.max(0, Math.hypot(b.x - a.x, b.y - a.y) - ra - rb), gridSize);
}

/** `true` si la distància supera l'abast. Sense graella o sense abast: mai «fora». */
export function isOutOfRange(distFt: number | null, rangeFt: number | undefined): boolean {
  return distFt !== null && rangeFt !== undefined && rangeFt > 0 && distFt > rangeFt;
}
