/**
 * Mapa de caselles (estil Píxel): el DM el pinta casella a casella amb els fulls del paquet
 * Oryx, o l'importa d'un `.tmx` de Tiled.
 *
 * Es converteix (es «cou») en la imatge de fons de sempre: així la resta de l'app —
 * jugadors, boira de guerra, desat— no ha de saber res de caselles. De les parets pintades
 * en surten les `walls` invisibles (sales, llum, col·lisió), de les portes les `doors` i de
 * les torxes les `lights` (veure `geometry.ts`).
 *
 * Codificació d'una casella (`number`, -1 = buida):
 *   0 … 999      → `uf_terrain.png` (20 columnes de 48 px): índex = fila·20 + columna, com Tiled
 *   1000 … 1999  → `uf_items.png` (22 columnes de 48 px)
 *   2000 …       → `uf_map.png`, el mapa del món (25 columnes de 24 px, es pinta a 48)
 */

export const TILE = 48;
export const TERRAIN_COLS = 20;
export const ITEM_BASE = 1000, ITEM_COLS = 22;
export const WORLD_BASE = 2000, WORLD_COLS = 25, WORLD_PX = 24;
export const EMPTY = -1;

/** Objecte posat sobre el mapa (pot ocupar més d'una casella: estàtua, torxa, font…). */
export interface TileObject { c: number; r: number; k: string }

export interface TileMap {
  v: 1;
  cols: number;
  rows: number;
  /** Terra (ha de ser opac). Buit = buit negre: no és sala ni genera parets. */
  ground: number[];
  /** Capes de decorat damunt del terra (catifes, vores d'aigua, ombres…). La primera és la de l'editor. */
  overlays: number[][];
  /** Joc de paret per casella ('' = cap): les peces s'escullen soles segons els veïns. */
  wallSet: string[];
  /** Peça de paret explícita (mapes de Tiled): també bloqueja. */
  wallRaw: number[];
  /** Portes: casella → joc de paret (en dona l'aspecte). La casella no bloqueja. */
  doors: Record<number, string>;
  objects: TileObject[];
}

export const t = (c: number, r: number) => r * TERRAIN_COLS + c;

export function emptyTileMap(cols: number, rows: number): TileMap {
  const n = cols * rows;
  return {
    v: 1, cols, rows,
    ground: new Array(n).fill(EMPTY),
    overlays: [new Array(n).fill(EMPTY)],
    wallSet: new Array(n).fill(''),
    wallRaw: new Array(n).fill(EMPTY),
    doors: {},
    objects: [],
  };
}

export const cellOf = (m: TileMap, c: number, r: number) => r * m.cols + c;
export const inMap = (m: TileMap, c: number, r: number) => c >= 0 && r >= 0 && c < m.cols && r < m.rows;
/** Casella que bloqueja (paret). Fora del mapa compta com a paret: les vores es veuen contínues. */
export function isWall(m: TileMap, c: number, r: number): boolean {
  if (!inMap(m, c, r)) return true;
  const i = cellOf(m, c, r);
  return !!m.wallSet[i] || m.wallRaw[i] >= 0;
}
/** Casella sense res (fora de cap sala). */
export function isVoid(m: TileMap, i: number): boolean {
  return m.ground[i] < 0 && !m.wallSet[i] && m.wallRaw[i] < 0 && !(i in m.doors) && m.overlays.every(o => o[i] < 0);
}

/** Còpia per a una edició (tot array nou: el desfer i el detector de canvis van per referència). */
export function cloneTileMap(m: TileMap): TileMap {
  return {
    ...m,
    ground: m.ground.slice(), overlays: m.overlays.map(o => o.slice()),
    wallSet: m.wallSet.slice(), wallRaw: m.wallRaw.slice(),
    doors: { ...m.doors }, objects: m.objects.slice(),
  };
}

/** Normalitza un mapa llegit d'una partida desada (camps que podrien faltar). */
export function reviveTileMap(raw: unknown): TileMap | null {
  const m = raw as Partial<TileMap> | null;
  if (!m || typeof m.cols !== 'number' || typeof m.rows !== 'number' || !Array.isArray(m.ground)) return null;
  const n = m.cols * m.rows;
  const fill = <T,>(a: T[] | undefined, v: T) => (Array.isArray(a) && a.length === n ? a : new Array(n).fill(v));
  return {
    v: 1, cols: m.cols, rows: m.rows,
    ground: fill(m.ground, EMPTY),
    overlays: Array.isArray(m.overlays) && m.overlays.length ? m.overlays.map(o => fill(o, EMPTY)) : [new Array(n).fill(EMPTY)],
    wallSet: fill(m.wallSet, ''),
    wallRaw: fill(m.wallRaw, EMPTY),
    doors: m.doors && typeof m.doors === 'object' ? m.doors : {},
    objects: Array.isArray(m.objects) ? m.objects : [],
  };
}
