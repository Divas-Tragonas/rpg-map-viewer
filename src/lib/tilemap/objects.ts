/**
 * Geometria dels objectes del mapa de caselles amb rotació (quarts de volta) i desplaçament lliure
 * (`TileObject.rot`, `ox`, `oy`). Tot el que necessita saber on cau una peça d'un objecte (pintar-lo,
 * esborrar-lo, triar-lo amb l'eina «Moure», l'aigua que tapa, la llum de la torxa) passa per aquí.
 */
import { TILE, type TileMap, type TileObject, cellOf, inMap } from './model';
import { objectDef, type ObjectPart } from './palette';

/** Quarts de volta normalitzats (0–3). */
export const quarter = (rot: number | undefined) => (((rot ?? 0) % 4) + 4) % 4;

/** Gira el vector (dx, dy) `q` quarts de volta en sentit horari (eix y cap avall, com el canvas). */
export function rotVec(dx: number, dy: number, q: number): [number, number] {
  switch (quarter(q)) {
    case 1: return [-dy, dx];
    case 2: return [-dx, -dy];
    case 3: return [dy, -dx];
    default: return [dx, dy];
  }
}

/** Centre de l'àncora en px de mapa. */
export const anchorCenter = (o: TileObject) => ({ x: (o.c + 0.5) * TILE + (o.ox ?? 0), y: (o.r + 0.5) * TILE + (o.oy ?? 0) });

/** Peça d'un objecte ja col·locada: cantonada de dalt a l'esquerra en px de mapa i rotació. */
export interface PlacedPart { part: ObjectPart; x: number; y: number; rot: number }

export function placedParts(o: TileObject): PlacedPart[] {
  const def = objectDef(o.k); if (!def) return [];
  const q = quarter(o.rot), a = anchorCenter(o);
  return def.parts.map(part => {
    const [dx, dy] = rotVec(part.dx, part.dy, q);
    return { part, x: a.x + dx * TILE - TILE / 2, y: a.y + dy * TILE - TILE / 2, rot: q };
  });
}

/** Rectangle que ocupa l'objecte (px de mapa); `null` si la clau no és cap objecte. */
export function objectBox(o: TileObject): { x0: number; y0: number; x1: number; y1: number } | null {
  const ps = placedParts(o); if (!ps.length) return null;
  return {
    x0: Math.min(...ps.map(p => p.x)), y0: Math.min(...ps.map(p => p.y)),
    x1: Math.max(...ps.map(p => p.x)) + TILE, y1: Math.max(...ps.map(p => p.y)) + TILE,
  };
}

/**
 * Caselles d'un objecte (índexs, dins del mapa). `center`: la casella on cau el centre de cada peça
 * (la que «és» de l'objecte: esborrar, posar-ne un altre a sobre). `overlap`: totes les que toca
 * alguna peça, encara que sigui un píxel (repintar, aigua que queda tapada).
 */
export function objectCells(m: TileMap, o: TileObject, mode: 'center' | 'overlap'): number[] {
  const out = new Set<number>();
  for (const p of placedParts(o)) {
    if (mode === 'center') {
      const c = Math.floor((p.x + TILE / 2) / TILE), r = Math.floor((p.y + TILE / 2) / TILE);
      if (inMap(m, c, r)) out.add(cellOf(m, c, r));
      continue;
    }
    const c0 = Math.floor(p.x / TILE), r0 = Math.floor(p.y / TILE);
    const c1 = Math.ceil((p.x + TILE) / TILE) - 1, r1 = Math.ceil((p.y + TILE) / TILE) - 1;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (inMap(m, c, r)) out.add(cellOf(m, c, r));
  }
  return [...out];
}

/**
 * Compara dos objectes en ordre de pintat: primer els de darrere de les parets (`under`), després el
 * nivell (`z`), l'alçada i l'ordre de la llista.
 */
export function objectCmp(objs: readonly TileObject[], a: number, b: number): number {
  return ((objs[a].under ? 0 : 1) - (objs[b].under ? 0 : 1)) || ((objs[a].z ?? 0) - (objs[b].z ?? 0)) || (anchorCenter(objs[a]).y - anchorCenter(objs[b]).y) || a - b;
}

/**
 * Ordre de pintat: primer el nivell de capa (`z`, menú del clic dret) i, al mateix nivell, el de més
 * avall tapa el de dalt (per l'alçada real de l'àncora, desplaçament inclòs). Retorna els índexs de
 * `m.objects` (estable: a la mateixa alçada, el posat després va a sobre).
 */
export function objectDrawOrder(objs: readonly TileObject[]): number[] {
  return objs.map((_, i) => i).sort((a, b) => objectCmp(objs, a, b));
}

/** Objecte de dalt de tot sota el punt (px de mapa): índex a `m.objects` o −1. */
export function objectAt(m: TileMap, x: number, y: number): number {
  const order = objectDrawOrder(m.objects);
  for (let k = order.length - 1; k >= 0; k--) {
    const i = order[k];
    if (placedParts(m.objects[i]).some(p => x >= p.x && x < p.x + TILE && y >= p.y && y < p.y + TILE)) return i;
  }
  return -1;
}

/**
 * L'objecte amb el centre de l'àncora al punt (px de mapa, arrodonit al píxel de l'art): la casella
 * és la que conté el punt i `ox`/`oy` el que en sobra (sense camps si és el centre exacte). L'àncora
 * no surt mai del mapa.
 */
export function placeObjectAt(m: TileMap, o: TileObject, x: number, y: number): TileObject {
  const px = Math.min(Math.max(Math.round(x), 0), m.cols * TILE - 1);
  const py = Math.min(Math.max(Math.round(y), 0), m.rows * TILE - 1);
  const c = Math.floor(px / TILE), r = Math.floor(py / TILE);
  const ox = px - (c + 0.5) * TILE, oy = py - (r + 0.5) * TILE;
  const { ox: _ox, oy: _oy, ...rest } = o;
  void _ox; void _oy;
  return { ...rest, c, r, ...(ox ? { ox } : {}), ...(oy ? { oy } : {}) };
}

/** Punt on fa llum un objecte que en fa (la torxa: als peus de la peça de dalt), girat i desplaçat. */
export function objectLightPoint(o: TileObject): { x: number; y: number } {
  const a = anchorCenter(o);
  const [dx, dy] = rotVec(0, 0.5, quarter(o.rot));
  return { x: a.x + dx * TILE, y: a.y + dy * TILE };
}
