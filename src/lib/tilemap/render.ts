/**
 * Pintar un mapa de caselles: el «cuinat» estàtic (una imatge de mida `cols·48 × rows·48`
 * que passa a ser el fons) i les parts vives que es pinten cada fotograma (aigua, torxes,
 * portes, que s'obren i es tanquen).
 */
import { sheet, type SheetId } from '@/lib/sprites/pack';
import { blit, drawItem } from '@/lib/sprites/draw';
import { ITEMS } from '@/lib/sprites/manifest';
import {
  TILE, TERRAIN_COLS, ITEM_BASE, ITEM_COLS, WORLD_BASE, WORLD_COLS, WORLD_PX, THEME_BASE, PACK_BASE,
  type TileMap, type TileObject, cellOf, isWall, isVoid, inMap, decodeDecor,
} from './model';
import { WALL_BY_ID, objectDef, groundAnim, wallPiece, packPieceOf } from './palette';
import { PACK_COLS, PACK2_OFF } from './packs';
import { t } from './model';
import { flySpotsOf, drawFlies, type FlySpot } from './flies';
import { placedParts, objectCells, objectDrawOrder, quarter } from './objects';

/** D'on surt una peça codificada (veure `model.ts`): full i retall (quadrat de costat `s`). */
function tileSrc(tile: number): { id: SheetId; sx: number; sy: number; s: number } {
  if (tile >= PACK_BASE) {
    const i = tile - PACK_BASE, two = i >= PACK2_OFF, k = two ? i - PACK2_OFF : i;   // `decor_sheets.png`: veure packs.ts
    return { id: two ? 'decor_sheets' : 'decor_packs', sx: (k % PACK_COLS) * TILE, sy: Math.floor(k / PACK_COLS) * TILE, s: TILE };
  }
  if (tile >= THEME_BASE) {
    const i = tile - THEME_BASE;
    return { id: 'terrain_themes', sx: (i % TERRAIN_COLS) * TILE, sy: Math.floor(i / TERRAIN_COLS) * TILE, s: TILE };
  }
  if (tile >= WORLD_BASE) {
    const i = tile - WORLD_BASE;
    return { id: 'map', sx: (i % WORLD_COLS) * WORLD_PX, sy: Math.floor(i / WORLD_COLS) * WORLD_PX, s: WORLD_PX };
  }
  if (tile >= ITEM_BASE) {
    const i = tile - ITEM_BASE;
    return { id: 'items', sx: (i % ITEM_COLS) * TILE, sy: Math.floor(i / ITEM_COLS) * TILE, s: TILE };
  }
  return { id: 'terrain', sx: (tile % TERRAIN_COLS) * TILE, sy: Math.floor(tile / TERRAIN_COLS) * TILE, s: TILE };
}

/** Pinta una peça codificada (veure `model.ts`) al quadrat (dx, dy, size). */
export function drawTile(ctx: CanvasRenderingContext2D, tile: number, dx: number, dy: number, size = TILE): void {
  if (tile < 0) return;
  const { id, sx, sy, s } = tileSrc(tile);
  blit(ctx, id, sx, sy, s, s, dx, dy, size, size);
}

/** Rectangle en px de mapa (o dins d'una casella). */
export interface Box { x0: number; y0: number; x1: number; y1: number }

/**
 * Rectangle dels píxels no transparents d'una peça (codi de casella) o d'un objecte del botí (`i:nom`),
 * dins del quadrat de la casella (0–48). `null`: tota transparent, o el full encara no hi és (llavors
 * no es desa: es tornarà a mirar). Es calcula un cop per peça.
 */
const _opaque = new Map<string, Box | null>();
export function opaqueBox(tile: number | string): Box | null {
  const key = String(tile);
  if (_opaque.has(key)) return _opaque.get(key)!;
  let src: { id: SheetId; sx: number; sy: number; s: number } | null = null;
  if (typeof tile === 'string') {
    const p = ITEMS[tile.startsWith('i:') ? tile.slice(2) : tile];
    if (p) src = { id: 'items', sx: p[0], sy: p[1], s: TILE };
  } else if (tile >= 0) src = tileSrc(tile);
  if (!src) { _opaque.set(key, null); return null; }
  const img = sheet(src.id);
  if (!img || typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = TILE;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  g.imageSmoothingEnabled = false;
  g.drawImage(img, src.sx, src.sy, src.s, src.s, 0, 0, TILE, TILE);
  const d = g.getImageData(0, 0, TILE, TILE).data;
  let x0 = TILE, y0 = TILE, x1 = 0, y1 = 0;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    if (d[(y * TILE + x) * 4 + 3] < 24) continue;   // l'ombra gairebé transparent no compta
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (x + 1 > x1) x1 = x + 1; if (y + 1 > y1) y1 = y + 1;
  }
  const box = x1 > x0 && y1 > y0 ? { x0, y0, x1, y1 } : null;
  _opaque.set(key, box);
  return box;
}

/** `opaqueBox` girat `rot` quarts de volta (en sentit horari) al voltant del centre de la casella. */
export function rotateBox(b: Box, rot: number | undefined): Box {
  let r = b;
  for (let q = quarter(rot); q > 0; q--) r = { x0: TILE - r.y1, y0: r.x0, x1: TILE - r.y0, y1: r.x1 };
  return r;
}

/**
 * Pinta el quadrat (x, y, size) girat `rot` quarts de volta al voltant del seu centre. Amb quarts de
 * volta i el centre a un píxel sencer, la pixel art no es deforma ni es difumina.
 */
export function drawRot(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rot: number | undefined,
  draw: (x: number, y: number) => void): void {
  const q = quarter(rot);
  if (!q) { draw(x, y); return; }
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate(q * Math.PI / 2);
  draw(-size / 2, -size / 2);
  ctx.restore();
}

/** Peça del decorat (codi amb la rotació a dins, veure `decorCode`). */
export function drawDecor(ctx: CanvasRenderingContext2D, code: number, x: number, y: number, size = TILE): void {
  if (code < 0) return;
  const { tile, rot } = decodeDecor(code);
  drawRot(ctx, x, y, size, rot, (dx, dy) => drawTile(ctx, tile, dx, dy, size));
}

// Variants de cada fila del joc de paret. Les decoracions (penjador, calavera, estendard,
// gàrgola) surten de tant en tant; els estendards de la vora de dalt no, que no lliguen.
const FACE_COLS = [1, 2, 1, 2, 1, 2, 1, 2, 3, 6, 1, 2, 4, 2, 1, 5];
const TOP_COLS = [1, 2, 3, 6, 1, 2];
const MID_COLS = [1, 2, 3, 1, 2, 3, 4, 5, 6];
const hash = (c: number, r: number) => (((c * 73856093) ^ (r * 19349663)) >>> 0);

/**
 * Peça de paret per a la casella (c, r), amb la mateixa regla que els mapes d'exemple de
 * l'autor (`uf_example_*.tmx`, analitzats casella a casella):
 *  - **cara** (maó fosc a baix) sempre que a sota NO hi ha paret: la paret de dalt d'una
 *    sala i la de baix es veuen iguals, també si a sota hi ha el buit;
 *  - **vora de dalt** (mitja casella) només a la fila de dalt d'un mur horitzontal de dues
 *    files (com els dels exemples 1–4): terra a dalt, paret a baix i el mur que continua al
 *    costat. Validada contra els cinc mapes d'exemple: coincideix a totes les parets (menys
 *    les caselles que l'autor posa sota una porta lateral, que aquí són la porta);
 *  - **centre** a la resta (les columnes dels murs laterals);
 *  - **pilar** per a una peça sola, sense paret a cap costat.
 * Fora del mapa no compta com a paret (com el buit).
 */
export function wallTileFor(m: TileMap, c: number, r: number): number {
  const i = cellOf(m, c, r);
  if (m.wallRaw[i] >= 0) return m.wallRaw[i];
  const set = WALL_BY_ID.get(m.wallSet[i]);
  if (!set) return -1;
  const W = (col: number, dr: number) => wallPiece(set, col, dr);
  const wall = (cc: number, rr: number) => inMap(m, cc, rr) && isWall(m, cc, rr);
  // Fila de dalt d'un mur de dues files (terra a dalt, cara a sota).
  const band = (cc: number) => wall(cc, r) && !wall(cc, r - 1) && wall(cc, r + 1) && !wall(cc, r + 2);
  const h = hash(c, r);
  if (!wall(c, r + 1)) {
    // Pilar (peça sola) només si de debò no hi ha res als costats. Una porta al costat compta
    // com a mur: si no, el tram entre dues portes seguides sortia com un pilar solt, més
    // estret i amb una altra cara, i trencava la paret.
    const side = (cc: number) => wall(cc, r) || (inMap(m, cc, r) && cellOf(m, cc, r) in m.doors);
    if (!wall(c, r - 1) && !side(c - 1) && !side(c + 1)) return W(8, 1);
    // Cara just a sobre d'una porta lateral: la llisa. Les variants amb decoració (estendard,
    // calavera…) quedaven tapades a mitges pel muntant o la fulla de la porta.
    if (inMap(m, c, r + 1) && cellOf(m, c, r + 1) in m.doors) return W(1, 2);
    return W(FACE_COLS[h % FACE_COLS.length], 2);
  }
  // Vora de dalt si el mur de dues files continua al costat (també on hi arriba una columna).
  if (!wall(c, r - 1) && (band(c - 1) || band(c + 1))) return W(TOP_COLS[h % TOP_COLS.length], 0);
  return W(MID_COLS[h % MID_COLS.length], 1);
}

/**
 * Si la casella és una cara de paret amb decoració (estendard, calavera, gàrgola, que pugen per sobre de
 * la meitat de la casella), la cara llisa del mateix joc; si no, −1. Veure `hidePatches`.
 */
export function plainFaceFor(m: TileMap, c: number, r: number): number {
  const i = cellOf(m, c, r);
  if (m.wallRaw[i] >= 0) return -1;
  const set = WALL_BY_ID.get(m.wallSet[i]);
  if (!set) return -1;
  const tile = wallTileFor(m, c, r);
  return [3, 4, 5, 6].some(col => tile === wallPiece(set, col, 2)) ? wallPiece(set, 1, 2) : -1;
}

/** Les dues orientacions d'una porta: dins d'una paret horitzontal (veïns E-O) o vertical (N-S). */
export function doorAxis(m: TileMap, c: number, r: number): 'h' | 'v' {
  return isWall(m, c - 1, r) && isWall(m, c + 1, r) ? 'h' : 'v';
}

/**
 * Capa de la part estàtica d'una casella: una peça (`t`), un decorat (`d`, codi amb la rotació) o una
 * peça translúcida (`a`, l'ombra de la paret). Viatja al jugador dins de `TileLive.hide`.
 */
export interface CellLayer { t: number; d?: 1; a?: number }

/**
 * La part estàtica d'una casella, de baix a dalt (terra, decorats, ombra, paret). `skipDecor`: sense la
 * capa de decorat d'aquest índex (veure `TileLive.hide`).
 */
export function cellLayers(m: TileMap, c: number, r: number, skipDecor = -1): CellLayer[] {
  const i = cellOf(m, c, r), out: CellLayer[] = [];
  const g = m.ground[i];
  if (g >= 0) out.push({ t: groundAnim(g)?.frames[0] ?? g });
  m.overlays.forEach((o, k) => { if (o[i] >= 0 && k !== skipDecor) out.push({ t: o[i], d: 1 }); });
  const wall = isWall(m, c, r);
  // Ombra de la paret de dalt sobre el terra (com als mapes d'exemple de l'autor).
  if (!wall && r > 0 && isWall(m, c, r - 1) && !(i in m.doors)) out.push({ t: t(14, 1), a: 0.9 });
  if (wall) out.push({ t: wallTileFor(m, c, r) });
  return out;
}

function drawCellLayers(ctx: CanvasRenderingContext2D, layers: readonly CellLayer[], x: number, y: number) {
  for (const l of layers) {
    if (l.a !== undefined) ctx.globalAlpha = l.a;
    if (l.d) drawDecor(ctx, l.t, x, y); else drawTile(ctx, l.t, x, y);
    if (l.a !== undefined) ctx.globalAlpha = 1;
  }
}

/**
 * Peces d'un objecte (girat i desplaçat). `which`: només les quietes (cuinat), només les animades
 * (parts vives) o totes (previsualització de l'editor, amb el fotograma de `now`).
 */
export function drawObject(ctx: CanvasRenderingContext2D, o: TileObject, which: 'static' | 'live' | 'all', now = 0) {
  for (const { part: p, x, y, rot } of placedParts(o)) {
    const anim = !!p.frames;
    if ((which === 'static' && anim) || (which === 'live' && !anim)) continue;
    drawRot(ctx, x, y, TILE, rot, (dx, dy) => {
      if (o.k.startsWith('i:')) { drawItem(ctx, o.k.slice(2), dx, dy, TILE); return; }
      drawTile(ctx, p.frames ? p.frames[Math.floor(now / (p.ms ?? 300)) % p.frames.length] : p.tile!, dx, dy);
    });
  }
}

/** Imatge completa del mapa (part estàtica). Retorna null si encara no hi ha el full de terreny. */
export function bakeTileMap(m: TileMap): HTMLCanvasElement | null {
  if (!sheet('terrain')) return null;
  const cv = document.createElement('canvas');
  cv.width = m.cols * TILE; cv.height = m.rows * TILE;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
  repaintCells(cv, m, null);
  return cv;
}

/**
 * Torna a pintar caselles del cuinat (`cells` = índexs; null = totes). Cada casella canviada
 * arrossega les veïnes de dalt i de baix: la peça de paret depèn d'elles, i l'ombra també.
 * Els objectes es repinten tots (són pocs i poden ocupar més d'una casella).
 */
export function repaintCells(cv: HTMLCanvasElement, m: TileMap, cells: Iterable<number> | null) {
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const todo = new Set<number>();
  if (!cells) for (let i = 0; i < m.cols * m.rows; i++) todo.add(i);
  else for (const i of cells) {
    const c = i % m.cols, r = Math.floor(i / m.cols);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (inMap(m, c + dc, r + dr)) todo.add(cellOf(m, c + dc, r + dr));
  }
  // Ordre: terra, decorats i ombra de cada casella → objectes de darrere de les parets (`under`) →
  // parets → la resta d'objectes. La paret és l'última capa de `cellLayers`.
  const walls: { x: number; y: number; l: CellLayer }[] = [];
  for (const i of todo) {
    const c = i % m.cols, r = Math.floor(i / m.cols), x = c * TILE, y = r * TILE;
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, TILE, TILE);
    const layers = cellLayers(m, c, r);
    if (isWall(m, c, r) && layers.length) walls.push({ x, y, l: layers.pop()! });
    drawCellLayers(ctx, layers, x, y);
  }
  // Objectes: el de més avall tapa el de dalt (`objectDrawOrder`). En un repintat parcial, retallat a
  // les caselles repintades: tornar a pintar damunt d'una que no s'ha esborrat en fosquejaria l'ombra
  // semitransparent. Amb el retall, un objecte desplaçat que toca mitja casella repintada també hi surt.
  if (cells) {
    ctx.save();
    ctx.beginPath();
    for (const i of todo) ctx.rect((i % m.cols) * TILE, Math.floor(i / m.cols) * TILE, TILE, TILE);
    ctx.clip();
  }
  const order = objectDrawOrder(m.objects).filter(k => !cells || objectCells(m, m.objects[k], 'overlap').some(i => todo.has(i)));
  for (const k of order) if (m.objects[k].under) drawObject(ctx, m.objects[k], 'static');
  for (const w of walls) drawCellLayers(ctx, [w.l], w.x, w.y);
  for (const k of order) if (!m.objects[k].under) drawObject(ctx, m.objects[k], 'static');
  if (cells) ctx.restore();
}

// ── Parts vives (es pinten cada fotograma, DM i jugador) ──────────────────────

/** El que no va al cuinat perquè es mou o canvia d'estat. Viatja al jugador dins del STATE. */
/** Peça d'una porta: `dy` en caselles des de la casella de la porta; `shadow` = ombra (no es repinta sobre la foscor). */
/**
 * Peça d'una porta. `shadow`: l'ombra de sota (translúcida). `edge`: no és porta sinó PARET (la vora de
 * dalt del tram de baix d'una porta lateral): els tokens van per sobre de la porta però per sota d'això.
 */
export interface DoorPiece { dy: number; tile: number; shadow?: boolean; edge?: boolean; /** Només la meitat de dalt de la casella. */ half?: boolean }

export interface TileLive {
  /** Peces animades: posició (px de mapa, cantonada) + fotogrames; `rot` = quarts de volta (objecte girat). */
  anims: { x: number; y: number; frames: number[]; ms: number; rot?: number }[];
  /** Mosques dels decorats bruts: on voleten (px de mapa); es pinten animades a sobre de tot (`drawFlies`). */
  flies?: FlySpot[];
  /**
   * Portes del mapa de caselles: posició i peces tancada/oberta del seu joc. Cada peça va a
   * la casella de la porta (`dy` 0) o a la de dalt (`dy` −1), on sobresurt l'art. `wall`: com es
   * veuria la casella si hi hagués paret en lloc de porta (`doorAsWall`): la pantalla de jugador la
   * pinta així mentre la porta és a la foscor i no s'ha vist (opcional: partides d'abans, sense).
   */
  doors: { id: string; x: number; y: number; closed: DoorPiece[]; open: DoorPiece[]; wall?: DoorPiece[] }[];
  /**
   * Caselles on un token NO es pot posar: paret o buit (sense terra). Una lletra per casella,
   * fila a fila ('1' = sòlida). La porta no hi és: bloqueja segons si és oberta (veure
   * `tileBlocker`). Viatja amb `tileLive` perquè la pantalla de jugador no té el mapa sencer.
   */
  solid?: { cols: number; rows: number; cells: string };
  /**
   * Objectes i decorats que són majoritàriament dins d'una sala però en sobresurten (la flama d'una
   * torxa de paret, un barril desplaçat): `geometry.ts` → `hidePatches`. Mentre el punt `x,y` (dins de
   * la sala) és a la foscor i no s'ha descobert, la pantalla de jugador repinta els rectangles `rects`
   * amb el que hi hauria sense la peça (`cells`, `drawTileHidden`).
   */
  hide?: HidePatch[];
}

export interface HidePatch { x: number; y: number; rects: Box[]; cells: { c: number; r: number; l: CellLayer[] }[] }

export function tileLiveOf(m: TileMap): TileLive {
  const anims: TileLive['anims'] = [];
  // Una casella d'aigua amb alguna cosa a sobre (vora, paret, objecte) es queda quieta: el
  // fotograma viu es pinta damunt del cuinat i taparia el que hi ha a sobre.
  const covered = new Set<number>();
  for (const o of m.objects) for (const i of objectCells(m, o, 'overlap')) covered.add(i);
  for (let i = 0; i < m.ground.length; i++) {
    const busy = covered.has(i) || m.overlays.some(o => o[i] >= 0) || !!m.wallSet[i] || m.wallRaw[i] >= 0 || i in m.doors;
    const a = m.ground[i] >= 0 && !busy ? groundAnim(m.ground[i]) : null;
    if (a) anims.push({ x: (i % m.cols) * TILE, y: Math.floor(i / m.cols) * TILE, frames: a.frames, ms: a.ms });
  }
  for (const k of objectDrawOrder(m.objects)) {
    for (const { part: p, x, y, rot } of placedParts(m.objects[k])) {
      if (p.frames) anims.push({ x, y, frames: p.frames, ms: p.ms ?? 300, ...(rot ? { rot } : {}) });
    }
  }
  // Mosques: de cada decorat (capa de `overlays`) i de cada peça d'objecte que en porta.
  const flies: FlySpot[] = [];
  for (const layer of m.overlays) for (let i = 0; i < layer.length; i++) {
    if (layer[i] < 0) continue;
    const { tile, rot } = decodeDecor(layer[i]);
    flies.push(...flySpotsOf(tile, (i % m.cols) * TILE, Math.floor(i / m.cols) * TILE, rot));
  }
  for (const o of m.objects) for (const { part: p, x, y, rot } of placedParts(o)) if (p.tile != null) flies.push(...flySpotsOf(p.tile, x, y, rot));
  const doors: TileLive['doors'] = [];
  for (const [k, setId] of Object.entries(m.doors)) {
    const i = +k, c = i % m.cols, r = Math.floor(i / m.cols);
    const set = WALL_BY_ID.get(setId) ?? WALL_BY_ID.get('dungeon')!;
    const W = (col: number, dr: number) => wallPiece(set, col, dr);
    // Peces de l'autor (columnes 10–13 del joc de paret), col·locades com als mapes d'exemple
    // del paquet (`uf_example_*.tmx`, capa «door», casella a casella):
    //  - Paret horitzontal: tancada = la porta doble (10); oberta = els dos muntants (11).
    //    La fila +2 del joc és l'OMBRA de la porta i va a la casella de sota (`dy` 1).
    //  - Paret lateral: tancada = la porta vista de cantell, un muntant (12); oberta = la
    //    fulla de cara, girada contra la paret (13). Ocupen la cara del tram de dalt (`dy` −1)
    //    i la casella de la porta. A sota hi va la VORA DE DALT del tram de baix (mitja
    //    casella grisa, fila 0): el muntant queda a la junta entre els dos trams.
    // Cada casella és una porta (les «portes laterals dobles» de la v4.88 es van treure).
    const piece = (col: number) => [{ dy: -1, tile: W(col, 0) }, { dy: 0, tile: W(col, 1) }];
    const sideEdge = { dy: 0, tile: W(1, 0), edge: true };
    const h = doorAxis(m, c, r) === 'h';
    doors.push({
      id: `td_${i}`, x: c * TILE, y: r * TILE,
      closed: h ? [{ dy: 0, tile: W(10, 1) }, { dy: 1, tile: W(10, 2), shadow: true }] : [sideEdge, ...piece(12)],
      open: h ? [...piece(11), { dy: 1, tile: W(11, 2), shadow: true }] : [sideEdge, ...piece(13)],
      wall: doorAsWall(m, c, r, setId),
    });
  }
  let cells = '';
  for (let i = 0; i < m.cols * m.rows; i++) {
    const c = i % m.cols, r = Math.floor(i / m.cols);
    cells += !(i in m.doors) && (isWall(m, c, r) || isVoid(m, i)) ? '1' : '0';
  }
  return { anims, doors, ...(flies.length ? { flies } : {}), solid: { cols: m.cols, rows: m.rows, cells } };
}

/**
 * La casella d'una porta (i la de dalt, on sobresurt la porta lateral) com es veurien amb paret en
 * lloc de porta: el que la pantalla de jugador hi pinta mentre la porta és a la foscor i ningú no
 * l'ha vista. Sense això hi quedava un forat negre a la paret, que també deia on era la porta. Si
 * sota hi ha una sala, la meitat de baix de la casella seria la cara de la paret, que és de la sala
 * (`extendRoomFace`) i es queda fosca: només es pinta la de dalt (`half`).
 */
function doorAsWall(m: TileMap, c: number, r: number, setId: string): DoorPiece[] {
  const i = cellOf(m, c, r);
  const prevSet = m.wallSet[i], prevDoor = m.doors[i];
  // Es prova sobre el mateix mapa i es deixa tal com era (és síncron).
  m.wallSet[i] = setId; delete m.doors[i];
  try {
    const out: DoorPiece[] = [];
    const roomBelow = (cc: number, rr: number) => inMap(m, cc, rr + 1) && !isWall(m, cc, rr + 1) && !isVoid(m, cellOf(m, cc, rr + 1));
    const here = wallTileFor(m, c, r);
    if (here >= 0) out.push({ dy: 0, tile: here, ...(roomBelow(c, r) ? { half: true } : {}) });
    if (inMap(m, c, r - 1) && isWall(m, c, r - 1)) {
      const up = wallTileFor(m, c, r - 1);
      if (up >= 0) out.push({ dy: -1, tile: up });
    }
    return out;
  } finally {
    m.wallSet[i] = prevSet; m.doors[i] = prevDoor;
  }
}

/**
 * Caselles prohibides per al moviment dels jugadors en un mapa de caselles: paret, buit, fora
 * del mapa i la casella d'una porta TANCADA (no s'hi pot estar ni passar-hi). Rep un punt en
 * coords de mapa (el centre d'una casella de moviment). `undefined` si no hi ha mapa de caselles.
 */
export function tileBlocker(live: TileLive | null | undefined, doors: { id: string; open?: boolean }[]): ((p: { x: number; y: number }) => boolean) | undefined {
  const s = live?.solid;
  if (!live || !s || s.cells.length !== s.cols * s.rows) return undefined;
  const closed = new Set<number>();
  for (const d of live.doors) {
    if (doors.find(x => x.id === d.id)?.open === false) closed.add(Math.round(d.y / TILE) * s.cols + Math.round(d.x / TILE));
  }
  return p => {
    const c = Math.floor(p.x / TILE), r = Math.floor(p.y / TILE);
    if (c < 0 || r < 0 || c >= s.cols || r >= s.rows) return true;
    const i = r * s.cols + c;
    return s.cells.charCodeAt(i) === 49 || closed.has(i);
  };
}

/**
 * «Aquesta porta és oberta?» per id, per a `drawTileLive` i `drawTileDoorsOver`. Abans cada
 * porta feia un `doors.find` dos cops per fotograma; l'índex es refà només quan canvia la
 * llista (les portes no es muten mai al lloc: cada canvi en crea una de nova).
 */
let _doorIdxOf: readonly { id: string; open?: boolean }[] | null = null;
let _doorIdx = new Map<string, { open?: boolean }>();
export function doorOpenById(doors: readonly { id: string; open?: boolean }[]): (id: string) => boolean {
  if (doors !== _doorIdxOf) {
    _doorIdxOf = doors;
    _doorIdx = new Map(doors.map(d => [d.id, d]));
  }
  const idx = _doorIdx;
  return id => idx.get(id)?.open !== false;
}

/**
 * Pinta les parts vives en coords de mapa (dins de la transformació del mapa). `openById`
 * diu l'estat actual de cada porta (`rDoors`, que es pot obrir i tancar a mitja partida).
 */
export function drawTileLive(ctx: CanvasRenderingContext2D, live: TileLive | null, openById: (id: string) => boolean, now: number,
  shown?: (id: string) => boolean) {
  if (!live || !sheet('terrain')) return;
  for (const a of live.anims) {
    const tile = a.frames[Math.floor(now / a.ms) % a.frames.length];
    if (a.rot) drawRot(ctx, a.x, a.y, TILE, a.rot, (x, y) => drawTile(ctx, tile, x, y));
    else drawTile(ctx, tile, a.x, a.y);
  }
  drawFlies(ctx, live.flies, now);
  for (const d of live.doors) {
    // Porta amagada (pantalla de jugador): la muntant de la porta lateral sobresurt a la casella de
    // dalt, fora de la foscor. `drawTileDoorsOver` hi posarà la paret.
    if (shown && !shown(d.id)) continue;
    for (const p of openById(d.id) ? d.open : d.closed) drawTile(ctx, p.tile, d.x, d.y + p.dy * TILE);
  }
}

/**
 * Torna a pintar les portes DAMUNT de la foscor de les sales (després de `renderRooms`). La
 * casella d'una porta queda partida entre dues sales i la foscor de la que és fosca en tapava
 * la meitat (o tota, si totes dues ho eren): una porta es veu sempre, com les parets. Les
 * ombres no es repinten (són translúcides: es doblarien a la part il·luminada). `shown` (pantalla de
 * jugador, `doorsShown` de `darkrooms.ts`): només les portes que tenen alguna banda a la vista o que
 * ja s'havien vist; a la resta s'hi pinta la paret que hi hauria sense porta (`wall`).
 */
export function drawTileDoorsOver(ctx: CanvasRenderingContext2D, live: TileLive | null, openById: (id: string) => boolean,
  shown?: (id: string) => boolean) {
  if (!live || !live.doors.length || !sheet('terrain')) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const d of live.doors) {
    if (shown && !shown(d.id)) {
      // A la foscor i mai vista: es veu paret (no un forat negre que digui on és la porta).
      for (const p of d.wall ?? []) {
        const y = d.y + p.dy * TILE;
        if (!p.half) { drawTile(ctx, p.tile, d.x, y); continue; }
        ctx.save(); ctx.beginPath(); ctx.rect(d.x, y, TILE, TILE / 2); ctx.clip();
        drawTile(ctx, p.tile, d.x, y);
        ctx.restore();
      }
      continue;
    }
    for (const p of openById(d.id) ? d.open : d.closed) if (!p.shadow) drawTile(ctx, p.tile, d.x, d.y + p.dy * TILE);
  }
  ctx.restore();
}

/**
 * Pantalla de jugador, ABANS de la foscor (just després de `drawTileLive`): per a cada peça de
 * `TileLive.hide` encara amagada (`hidden(x, y)`), repinta el seu rectangle amb el que hi hauria sense
 * la peça. El tros de dins de la sala el torna a tapar la foscor (amb la vora antialiàsada barrejada amb
 * la paret llisa i no amb la peça), i el de fora queda net.
 */
export function drawTileHidden(ctx: CanvasRenderingContext2D, live: TileLive | null, hidden: (x: number, y: number) => boolean) {
  if (!live?.hide?.length || !sheet('terrain')) return;
  for (const p of live.hide) {
    if (!hidden(p.x, p.y)) continue;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.beginPath();
    for (const b of p.rects) ctx.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    ctx.clip();
    for (const cell of p.cells) drawCellLayers(ctx, cell.l, cell.c * TILE, cell.r * TILE);
    ctx.restore();
  }
}

/**
 * Retalla (`clip`) el context a les caselles de les portes, amb la transformació actual. Serveix per
 * tornar a pintar els tokens damunt de les portes: les portes es pinten sobre la foscor de les sales
 * (`drawTileDoorsOver`) i, sense això, tapaven el token que hi passava pel davant.
 */
export function clipTileDoors(ctx: CanvasRenderingContext2D, live: TileLive | null, openById: (id: string) => boolean,
  shown?: (id: string) => boolean): boolean {
  if (!live || !live.doors.length) return false;
  ctx.beginPath();
  for (const d of live.doors) {
    if (shown && !shown(d.id)) continue;
    for (const p of openById(d.id) ? d.open : d.closed) if (!p.shadow) ctx.rect(d.x, d.y + p.dy * TILE, TILE, TILE);
  }
  ctx.clip();
  return true;
}

/** Vora de paret menys les peces de porta que hi van a sobre (cache per combinació de peces). */
const _edgeCut = new Map<string, HTMLCanvasElement | null>();
function edgeMinus(edge: number, over: number[]): HTMLCanvasElement | null {
  const key = `${edge}|${over.join(',')}`;
  if (_edgeCut.has(key)) return _edgeCut.get(key)!;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = TILE;
  const g = c.getContext('2d');
  if (!g) return null;
  g.imageSmoothingEnabled = false;
  drawTile(g, edge, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  for (const t of over) drawTile(g, t, 0, 0);
  _edgeCut.set(key, c);
  return c;
}

/**
 * Després dels tokens: torna a pintar la PARET de les portes (`edge`, la vora del tram de baix d'una
 * porta lateral) allà on no hi ha porta a sobre. Així el token que passa per la porta queda per
 * sobre de la porta i per sota de la paret, al DM i a la pantalla de jugador igual.
 */
export function drawTileDoorEdgesOver(ctx: CanvasRenderingContext2D, live: TileLive | null, openById: (id: string) => boolean,
  shown?: (id: string) => boolean) {
  if (!live || !live.doors.length || !sheet('terrain')) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  for (const d of live.doors) {
    if (shown && !shown(d.id)) continue;
    const parts = openById(d.id) ? d.open : d.closed;
    parts.forEach((p, i) => {
      if (!p.edge) return;
      const over = parts.slice(i + 1).filter(q => q.dy === p.dy && !q.shadow && !q.edge).map(q => q.tile);
      const cut = edgeMinus(p.tile, over);
      if (cut) ctx.drawImage(cut, d.x, d.y + p.dy * TILE, TILE, TILE);
    });
  }
  ctx.restore();
}

// Miniatures per a la paleta (dataURL, una per peça i mida).
const _thumbs = new Map<string, string>();
export function tileThumb(tile: number | string, size = 32): string | null {
  const key = `${tile}@${size}`;
  const hit = _thumbs.get(key); if (hit) return hit;
  if (!sheet('terrain')) return null;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const pack = packPieceOf(tile);
  if (pack) {
    // Paquets nous: l'art és petit al mig de la casella (1×); la miniatura en retalla només el que es veu
    // i l'amplia a múltiples sencers mentre hi càpiga (els arbres, més grans, s'encongeixen).
    const [ax, ay, aw, ah] = pack.art, fit = Math.min(size / aw, size / ah), k = fit >= 1 ? Math.floor(fit) : fit;
    const two = pack.cell >= PACK2_OFF, k0 = two ? pack.cell - PACK2_OFF : pack.cell;
    const sx = (k0 % PACK_COLS) * TILE + ax, sy = Math.floor(k0 / PACK_COLS) * TILE + ay;
    blit(ctx, two ? 'decor_sheets' : 'decor_packs', sx, sy, aw, ah, Math.round((size - aw * k) / 2), Math.round((size - ah * k) / 2), aw * k, ah * k);
  } else if (typeof tile === 'string') {
    // Objecte: es pinten totes les seves peces encabides al quadrat.
    const def = objectDef(tile); if (!def) return null;
    const minDy = Math.min(...def.parts.map(p => p.dy)), maxDy = Math.max(...def.parts.map(p => p.dy));
    const minDx = Math.min(...def.parts.map(p => p.dx)), maxDx = Math.max(...def.parts.map(p => p.dx));
    const w = maxDx - minDx + 1, h = maxDy - minDy + 1, s = size / Math.max(w, h);
    for (const p of def.parts) {
      const y = (p.dy - minDy) * s + (size - h * s) / 2, x = (p.dx - minDx) * s + (size - w * s) / 2;
      if (tile.startsWith('i:')) drawItem(ctx, tile.slice(2), x, y, s);
      else drawTile(ctx, p.frames ? p.frames[0] : p.tile!, x, y, s);
    }
  } else drawTile(ctx, tile, 0, 0, size);
  const url = c.toDataURL();
  _thumbs.set(key, url);
  return url;
}

/** Peces no buides del mapa del món (`uf_map.png`, 24 px), com a codis de casella. */
let _world: number[] | null = null;
export function worldTiles(): number[] {
  if (_world) return _world;
  const img = sheet('map'); if (!img) return [];
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const out: number[] = [];
  const rows = Math.floor(c.height / WORLD_PX);
  for (let r = 0; r < rows; r++) for (let col = 0; col < WORLD_COLS; col++) {
    let any = false;
    for (let y = r * WORLD_PX; y < (r + 1) * WORLD_PX && !any; y += 2)
      for (let x = col * WORLD_PX; x < (col + 1) * WORLD_PX; x += 2) if (d[(y * c.width + x) * 4 + 3] > 0) { any = true; break; }
    if (any) out.push(WORLD_BASE + r * WORLD_COLS + col);
  }
  _world = out;
  return out;
}
