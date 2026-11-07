import type { Point } from '@/types';
import type { CellCost } from '@/lib/rooms/pathing';

/**
 * Terreny difícil (5e: cada casella costa el doble de moviment).
 *
 * Es desa com la llista de caselles `"col,fila"` (índexs de la graella, comptant des de
 * l'origen normalitzat `gox/goy`), així funciona igual amb un mapa d'imatge que amb un mapa
 * de caselles. Si es canvia la mida o l'origen de la graella, el terreny es queda a les
 * mateixes caselles numèriques (ja no coincidirà amb el dibuix del mapa).
 * Font ÚNICA del cost: la fan servir el clamp del drag, el rang groc i la validació del DM.
 */
export const DIFFICULT_COST = 2;

export const cellKey = (col: number, row: number): string => `${col},${row}`;

export function cellAt(p: Point, gs: number, gox: number, goy: number): [number, number] {
  return [Math.floor((p.x - gox) / gs), Math.floor((p.y - goy) / gs)];
}

/** Funció de cost per al pathfinding, o `undefined` si no hi ha terreny (res a calcular). */
export function terrainCost(
  cells: readonly string[] | undefined, gs: number, gox: number, goy: number,
): CellCost | undefined {
  if (!cells || cells.length === 0 || gs <= 0) return undefined;
  const set = new Set(cells);
  return (center: Point) => set.has(cellKey(...cellAt(center, gs, gox, goy))) ? DIFFICULT_COST : 1;
}

/** Llista nova amb la casella afegida/treta (o la mateixa si no canvia res: identitat estable). */
export function paintCell(cells: readonly string[], key: string, erase: boolean): readonly string[] {
  const has = cells.includes(key);
  if (erase) return has ? cells.filter(k => k !== key) : cells;
  return has ? cells : [...cells, key];
}
