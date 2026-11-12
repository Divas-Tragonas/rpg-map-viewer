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
 *   2000 … 2999  → `uf_map.png`, el mapa del món (25 columnes de 24 px, es pinta a 48)
 *   3000 … 3999  → `uf_terrain_themes.png`, els temes de masmorra (20 columnes, com el terreny)
 *   4000 …       → `decor_packs.png`, els paquets de decorat nous (`scripts/decor-packs.py`, 20 columnes)
 */

export const TILE = 48;
/**
 * Sostre de seguretat d'un mapa de caselles nou (no de disseny): el mapa es «cou» en un sol canvas
 * de `cols·TILE × rows·TILE` px i viatja sencer al jugador. 40.000 caselles són uns 92 milions de
 * píxels (≈370 MB), el que els navegadors d'escriptori aguanten; més, i la pestanya es pot morir.
 */
export const MAX_TILE_SIDE = 300;
export const MAX_TILE_CELLS = 40000;
export const TERRAIN_COLS = 20;
export const ITEM_BASE = 1000, ITEM_COLS = 22;
export const WORLD_BASE = 2000, WORLD_COLS = 25, WORLD_PX = 24;
export const THEME_BASE = 3000;
/** Paquets de decorat (`decor_packs.png`): índex = fila·`PACK_COLS` + columna (veure `packs.ts`). */
export const PACK_BASE = 4000;
export const EMPTY = -1;

/**
 * Objecte posat sobre el mapa (pot ocupar més d'una casella: estàtua, torxa, font…).
 * `c`/`r`: casella de l'àncora. `rot`: quarts de volta en sentit horari (0–3; tot l'objecte gira
 * al voltant del centre de l'àncora). `ox`/`oy`: desplaçament lliure en px de mapa (= píxels de
 * l'art, entre −24 i 24), per deixar-lo fora de la graella (eina «Moure»). `z`: nivell per a l'ordre
 * de les capes (menú del clic dret: porta al davant, envia al fons…); a igual nivell, el de més avall
 * tapa el de dalt.
 */
export interface TileObject { c: number; r: number; k: string; rot?: number; ox?: number; oy?: number; z?: number }

/** Decorats que l'editor apila com a molt en una casella (cada un en una capa de `overlays`). */
export const MAX_DECOR_STACK = 4;

/**
 * Decorat girat: la rotació (quarts de volta) va dins del codi de la casella de la capa de decorat
 * (`rot · DECOR_ROT + peça`). Així no hi ha cap camp nou (ni al desat ni a `fitTileMap`/`cloneTileMap`)
 * i tot el que només mira si la casella és buida (`< 0`) continua igual.
 */
export const DECOR_ROT = 100000;
export const decorCode = (tile: number, rot = 0) => ((rot % 4) + 4) % 4 * DECOR_ROT + tile;
export const decodeDecor = (code: number) => ({ tile: code % DECOR_ROT, rot: Math.floor(code / DECOR_ROT) });

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
  /**
   * Sales eliminades pel DM: una casella de terra de dins de cadascuna. La cara que la conté no
   * es torna sala (les parets surten de les caselles i, si no, la sala tornaria a cada regeneració).
   */
  noRoom?: number[];
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

/** Rectangle de caselles (incloses) que tenen alguna cosa pintada; `null` si el mapa és buit. */
export function usedBounds(m: TileMap): { c0: number; r0: number; c1: number; r1: number } | null {
  let c0 = m.cols, r0 = m.rows, c1 = -1, r1 = -1;
  for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
    if (isVoid(m, cellOf(m, c, r))) continue;
    if (c < c0) c0 = c; if (c > c1) c1 = c; if (r < r0) r0 = r; if (r > r1) r1 = r;
  }
  return c1 < 0 ? null : { c0, r0, c1, r1 };
}

/** Caselles buides que el llenç deixa sempre a cada banda de tot el que hi ha pintat. */
export const TILE_MARGIN = 10;

export interface TileFit { map: TileMap; dc: number; dr: number }

/**
 * El mapa amb el llenç ajustat al que hi ha pintat: la zona pintada més `TILE_MARGIN` caselles a cada
 * banda (una sala de 5×5 → 25×25). `dc`/`dr` diuen quantes caselles s'ha desplaçat l'origen (tot el
 * que hi ha al mapa s'ha de moure igual). `null` si ja està ajustat, si és buit o si no cap als límits.
 */
export function fitTileMap(m: TileMap, margin = TILE_MARGIN): TileFit | null {
  const b = usedBounds(m);
  if (!b) return null;
  const cols = b.c1 - b.c0 + 1 + 2 * margin, rows = b.r1 - b.r0 + 1 + 2 * margin;
  if (cols > MAX_TILE_SIDE || rows > MAX_TILE_SIDE || cols * rows > MAX_TILE_CELLS) return null;
  const dc = margin - b.c0, dr = margin - b.r0;
  if (dc === 0 && dr === 0 && cols === m.cols && rows === m.rows) return null;
  const n = cols * rows;
  const remap = <T,>(a: T[], empty: T): T[] => {
    const out = new Array<T>(n).fill(empty);
    for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      out[nr * cols + nc] = a[r * m.cols + c];
    }
    return out;
  };
  const doors: TileMap['doors'] = {};
  for (const k of Object.keys(m.doors)) {
    const i = +k, nc = (i % m.cols) + dc, nr = Math.floor(i / m.cols) + dr;
    if (nc >= 0 && nr >= 0 && nc < cols && nr < rows) doors[nr * cols + nc] = m.doors[i];
  }
  return {
    dc, dr,
    map: {
      ...m, cols, rows,
      ground: remap(m.ground, EMPTY), overlays: m.overlays.map(o => remap(o, EMPTY)),
      wallSet: remap(m.wallSet, ''), wallRaw: remap(m.wallRaw, EMPTY),
      doors, objects: m.objects.map(o => ({ ...o, c: o.c + dc, r: o.r + dr })),
      noRoom: m.noRoom?.flatMap(i => {
        const nc = (i % m.cols) + dc, nr = Math.floor(i / m.cols) + dr;
        return nc >= 0 && nr >= 0 && nc < cols && nr < rows ? [nr * cols + nc] : [];
      }),
    },
  };
}

/** Còpia per a una edició (tot array nou: el desfer i el detector de canvis van per referència). */
export function cloneTileMap(m: TileMap): TileMap {
  return {
    ...m,
    ground: m.ground.slice(), overlays: m.overlays.map(o => o.slice()),
    wallSet: m.wallSet.slice(), wallRaw: m.wallRaw.slice(),
    doors: { ...m.doors }, objects: m.objects.slice(), noRoom: m.noRoom?.slice(),
  };
}

/** Les mateixes caselles (només poden canviar les sales eliminades): no cal tornar a cuinar el fons. */
export function sameTiles(a: TileMap, b: TileMap): boolean {
  return a.cols === b.cols && a.rows === b.rows && a.ground === b.ground && a.overlays === b.overlays
    && a.wallSet === b.wallSet && a.wallRaw === b.wallRaw && a.doors === b.doors && a.objects === b.objects;
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
    noRoom: Array.isArray(m.noRoom) ? m.noRoom.filter(i => Number.isInteger(i) && i >= 0 && i < n) : undefined,
  };
}
