/**
 * Elements posats al mapa de caselles que el DM pot triar d'un en un (clic dret, eina Girar): un
 * objecte (`objects`) o un decorat (una peça d'una capa de `overlays` en una casella). Ordre de les
 * capes com als programes d'oficina (porta al davant, porta endavant, envia enrere, envia al fons),
 * girar i esborrar.
 *
 * Ordre: els objectes sempre van per sobre dels decorats (els decorats són de terra: catifes, ombres,
 * escales). Un objecte s'ordena entre els objectes que se li encavalquen (`z`); un decorat, entre els
 * decorats de la seva casella (capes d'`overlays`).
 *
 * Totes les funcions que canvien el mapa treballen sobre una còpia (`cloneTileMap`) i retornen les
 * caselles tocades (per repintar el cuinat), o `null` si no hi ha res a fer.
 */
import { TILE, type TileMap, type TileObject, cellOf, inMap, decodeDecor, decorCode } from './model';
import { objectAt, objectBox, objectCells, objectCmp, quarter } from './objects';

export type TileItem =
  /** `obj`: l'objecte tal com era en triar-lo (per saber si encara hi és). */
  | { kind: 'object'; idx: number; obj: TileObject }
  /** Capa `k` de la casella `i`; `code`: la peça que hi havia en triar-la. */
  | { kind: 'decor'; k: number; i: number; code: number };

export type LayerOp = 'front' | 'forward' | 'backward' | 'back';

/** L'element de dalt de tot al punt (px de mapa): un objecte i, si no n'hi ha, el decorat de dalt de la casella. */
export function itemAt(m: TileMap, x: number, y: number): TileItem | null {
  const idx = objectAt(m, x, y);
  if (idx >= 0) return { kind: 'object', idx, obj: m.objects[idx] };
  const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
  if (!inMap(m, c, r)) return null;
  const i = cellOf(m, c, r);
  for (let k = m.overlays.length - 1; k >= 0; k--) if (m.overlays[k][i] >= 0) return { kind: 'decor', k, i, code: m.overlays[k][i] };
  return null;
}

/** El mateix element al mapa d'ara (després d'un desfer o d'un altre canvi), o `null` si ja no hi és. */
export function refreshItem(m: TileMap, it: TileItem): TileItem | null {
  if (it.kind === 'object') {
    const idx = m.objects.indexOf(it.obj);
    return idx >= 0 ? { ...it, idx } : null;
  }
  return m.overlays[it.k]?.[it.i] === it.code ? it : null;
}

/** Rectangle de l'element en px de mapa (per ressaltar-lo). */
export function itemBox(m: TileMap, it: TileItem): { x0: number; y0: number; x1: number; y1: number } | null {
  if (it.kind === 'object') return m.objects[it.idx] ? objectBox(m.objects[it.idx]) : null;
  const x0 = (it.i % m.cols) * TILE, y0 = Math.floor(it.i / m.cols) * TILE;
  return { x0, y0, x1: x0 + TILE, y1: y0 + TILE };
}

/** Capes ocupades d'una casella, de baix a dalt. */
const decorStack = (m: TileMap, i: number) => m.overlays.map((_, k) => k).filter(k => m.overlays[k][i] >= 0);

/** Objectes que s'encavalquen amb el de l'índex (ell inclòs), en ordre de pintat. */
function overlapping(m: TileMap, idx: number): number[] {
  const b = objectBox(m.objects[idx]); if (!b) return [idx];
  return m.objects.map((_, j) => j).filter(j => {
    if (j === idx) return true;
    const o = objectBox(m.objects[j]);
    return !!o && o.x0 < b.x1 && o.x1 > b.x0 && o.y0 < b.y1 && o.y1 > b.y0;
  }).sort((a, b2) => objectCmp(m.objects, a, b2));
}

/** Posició de l'element dins de la seva pila (0 = el de baix) i quants n'hi ha. */
function stackPos(m: TileMap, it: TileItem): { pos: number; n: number } {
  if (it.kind === 'object') { const l = overlapping(m, it.idx); return { pos: l.indexOf(it.idx), n: l.length }; }
  const l = decorStack(m, it.i); return { pos: l.indexOf(it.k), n: l.length };
}

/** Quines ordres de capa tenen efecte (per desactivar la resta al menú). */
export function layerOpsFor(m: TileMap, it: TileItem): Record<LayerOp, boolean> {
  const { pos, n } = stackPos(m, it);
  const up = pos >= 0 && pos < n - 1, down = pos > 0;
  return { front: up, forward: up, backward: down, back: down };
}

/**
 * Puja l'objecte `a` just per sobre de `b` (que hi ha a sobre) tocant els nivells com menys millor: si
 * cal, `a` passa al nivell de `b` + 1 i els que hi havia entre tots dos a la pila no canvien d'ordre
 * respecte de `a` perquè també pugen (només els de la pila).
 */
function raiseAbove(objs: TileObject[], list: number[], a: number, b: number) {
  const setZ = (j: number, z: number) => { const { z: _z, ...rest } = objs[j]; void _z; objs[j] = z ? { ...rest, z } : rest; };
  setZ(a, objs[b].z ?? 0);
  if (objectCmp(objs, a, b) < 0) setZ(a, (objs[b].z ?? 0) + 1);
  // Els que anaven per sobre de `b` han de quedar per sobre de `a`: es pugen el mínim que calgui.
  let prev = a;
  for (const j of list.slice(list.indexOf(b) + 1)) {
    if (j === a) continue;
    if (objectCmp(objs, j, prev) < 0) setZ(j, (objs[prev].z ?? 0) + 1);
    prev = j;
  }
}

/** Canvia l'ordre de l'element (sobre una còpia). Caselles tocades, o `null` si no ha canviat res. */
export function applyLayerOp(m: TileMap, it: TileItem, op: LayerOp): number[] | null {
  if (!layerOpsFor(m, it)[op]) return null;
  if (it.kind === 'decor') {
    const l = decorStack(m, it.i), pos = l.indexOf(it.k);
    const vals = l.map(k => m.overlays[k][it.i]);
    const [v] = vals.splice(pos, 1);
    const to = op === 'front' ? vals.length : op === 'back' ? 0 : op === 'forward' ? pos + 1 : pos - 1;
    vals.splice(to, 0, v);
    l.forEach((k, n) => { m.overlays[k][it.i] = vals[n]; });
    return [it.i];
  }
  const objs = m.objects.slice();
  const list = overlapping(m, it.idx), pos = list.indexOf(it.idx);
  if (op === 'front') {
    const top = Math.max(...list.map(j => objs[j].z ?? 0));
    objs[it.idx] = { ...objs[it.idx], z: top + 1 };
  } else if (op === 'back') {
    const low = Math.min(...list.map(j => objs[j].z ?? 0));
    objs[it.idx] = { ...objs[it.idx], z: low - 1 };
  } else if (op === 'forward') {
    raiseAbove(objs, list, it.idx, list[pos + 1]);
  } else {
    // Enviar enrere = portar endavant el que té just a sota.
    raiseAbove(objs, list, list[pos - 1], it.idx);
  }
  m.objects = objs;
  return list.flatMap(j => objectCells(m, objs[j], 'overlap'));
}

/** Gira l'element un quart de volta en sentit horari (sobre una còpia). */
export function rotateItem(m: TileMap, it: TileItem): number[] {
  if (it.kind === 'decor') {
    const { tile, rot } = decodeDecor(m.overlays[it.k][it.i]);
    m.overlays[it.k][it.i] = decorCode(tile, rot + 1);
    return [it.i];
  }
  const o = m.objects[it.idx];
  const q = quarter((o.rot ?? 0) + 1);
  const { rot: _r, ...rest } = o; void _r;
  const next = q ? { ...rest, rot: q } : rest;
  m.objects = m.objects.slice();
  m.objects[it.idx] = next;
  return [...objectCells(m, o, 'overlap'), ...objectCells(m, next, 'overlap')];
}

/** Treu l'element (sobre una còpia). */
export function removeItem(m: TileMap, it: TileItem): number[] {
  if (it.kind === 'decor') { m.overlays[it.k][it.i] = -1; return [it.i]; }
  const touched = objectCells(m, m.objects[it.idx], 'overlap');
  m.objects = m.objects.filter((_, j) => j !== it.idx);
  return touched;
}

/**
 * Posa un decorat a la casella, damunt dels que ja hi ha (a la primera capa lliure per sobre del de
 * dalt; si no n'hi ha, una capa nova). Si el de dalt ja és aquesta peça, res (repassar amb el pinzell
 * no l'apila). Amb la pila plena (`max`), substitueix el de dalt.
 */
export function stackDecor(m: TileMap, i: number, code: number, max: number): boolean {
  const l = decorStack(m, i);
  const top = l.length ? l[l.length - 1] : -1;
  if (top >= 0 && m.overlays[top][i] === code) return false;
  if (l.length >= max) { m.overlays[top][i] = code; return true; }
  const k = top + 1;
  if (k >= m.overlays.length) m.overlays.push(new Array(m.cols * m.rows).fill(-1));
  m.overlays[k][i] = code;
  return true;
}

/** Treu les capes de decorat buides (menys la primera): cada capa és una llista de tot el mapa. */
export function pruneOverlays(m: TileMap): void {
  if (m.overlays.length <= 1) return;
  const keep = m.overlays.filter((o, k) => k === 0 || o.some(v => v >= 0));
  if (keep.length !== m.overlays.length) m.overlays = keep;
}
