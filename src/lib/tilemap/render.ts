/**
 * Pintar un mapa de caselles: el «cuinat» estàtic (una imatge de mida `cols·48 × rows·48`
 * que passa a ser el fons) i les parts vives que es pinten cada fotograma (aigua, torxes,
 * portes, que s'obren i es tanquen).
 */
import { sheet } from '@/lib/sprites/pack';
import { blit, drawItem } from '@/lib/sprites/draw';
import {
  TILE, TERRAIN_COLS, ITEM_BASE, ITEM_COLS, WORLD_BASE, WORLD_COLS, WORLD_PX,
  type TileMap, cellOf, isWall, inMap,
} from './model';
import { WALL_BY_ID, objectDef, groundAnim } from './palette';
import { t } from './model';

/** Pinta una peça codificada (veure `model.ts`) al quadrat (dx, dy, size). */
export function drawTile(ctx: CanvasRenderingContext2D, tile: number, dx: number, dy: number, size = TILE): void {
  if (tile < 0) return;
  if (tile >= WORLD_BASE) {
    const i = tile - WORLD_BASE;
    blit(ctx, 'map', (i % WORLD_COLS) * WORLD_PX, Math.floor(i / WORLD_COLS) * WORLD_PX, WORLD_PX, WORLD_PX, dx, dy, size, size);
  } else if (tile >= ITEM_BASE) {
    const i = tile - ITEM_BASE;
    blit(ctx, 'items', (i % ITEM_COLS) * TILE, Math.floor(i / ITEM_COLS) * TILE, TILE, TILE, dx, dy, size, size);
  } else {
    blit(ctx, 'terrain', (tile % TERRAIN_COLS) * TILE, Math.floor(tile / TERRAIN_COLS) * TILE, TILE, TILE, dx, dy, size, size);
  }
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
  const B = set.row;
  const wall = (cc: number, rr: number) => inMap(m, cc, rr) && isWall(m, cc, rr);
  // Fila de dalt d'un mur de dues files (terra a dalt, cara a sota).
  const band = (cc: number) => wall(cc, r) && !wall(cc, r - 1) && wall(cc, r + 1) && !wall(cc, r + 2);
  const h = hash(c, r);
  if (!wall(c, r + 1)) {
    if (!wall(c, r - 1) && !wall(c - 1, r) && !wall(c + 1, r)) return t(8, B + 1);
    return t(FACE_COLS[h % FACE_COLS.length], B + 2);
  }
  // Vora de dalt si el mur de dues files continua al costat (també on hi arriba una columna).
  if (!wall(c, r - 1) && (band(c - 1) || band(c + 1))) return t(TOP_COLS[h % TOP_COLS.length], B);
  return t(MID_COLS[h % MID_COLS.length], B + 1);
}

/** Les dues orientacions d'una porta: dins d'una paret horitzontal (veïns E-O) o vertical (N-S). */
export function doorAxis(m: TileMap, c: number, r: number): 'h' | 'v' {
  return isWall(m, c - 1, r) && isWall(m, c + 1, r) ? 'h' : 'v';
}

/** Pinta tota la part estàtica d'una casella (terra, decorats, ombra, paret, objectes quiets). */
function drawCellStatic(ctx: CanvasRenderingContext2D, m: TileMap, c: number, r: number) {
  const i = cellOf(m, c, r), x = c * TILE, y = r * TILE;
  ctx.clearRect(x, y, TILE, TILE);
  const g = m.ground[i];
  if (g >= 0) drawTile(ctx, groundAnim(g)?.frames[0] ?? g, x, y);
  for (const o of m.overlays) if (o[i] >= 0) drawTile(ctx, o[i], x, y);
  const wall = isWall(m, c, r);
  // Ombra de la paret de dalt sobre el terra (com als mapes d'exemple de l'autor).
  if (!wall && r > 0 && isWall(m, c, r - 1) && !(i in m.doors)) {
    ctx.globalAlpha = 0.9; drawTile(ctx, t(14, 1), x, y); ctx.globalAlpha = 1;
  }
  if (wall) drawTile(ctx, wallTileFor(m, c, r), x, y);
}

function drawObjectParts(ctx: CanvasRenderingContext2D, k: string, c: number, r: number, live: boolean, now: number,
  only?: (c: number, r: number) => boolean) {
  const def = objectDef(k); if (!def) return;
  for (const p of def.parts) {
    const anim = !!p.frames;
    if (anim !== live) continue;
    if (only && !only(c + p.dx, r + p.dy)) continue;
    const x = (c + p.dx) * TILE, y = (r + p.dy) * TILE;
    if (k.startsWith('i:')) { drawItem(ctx, k.slice(2), x, y, TILE); continue; }
    const tile = p.frames ? p.frames[Math.floor(now / (p.ms ?? 300)) % p.frames.length] : p.tile!;
    drawTile(ctx, tile, x, y);
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
  for (const i of todo) {
    const c = i % m.cols, r = Math.floor(i / m.cols);
    ctx.fillStyle = '#000'; ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
    drawCellStatic(ctx, m, c, r);
  }
  // Objectes: per ordre de fila (el de més avall tapa el de dalt).
  // Només les parts que cauen en caselles repintades: tornar a pintar damunt d'una que no
  // s'ha esborrat en fosquejaria l'ombra semitransparent.
  const only = cells ? (c: number, r: number) => inMap(m, c, r) && todo.has(cellOf(m, c, r)) : undefined;
  for (const o of m.objects.slice().sort((a, b) => a.r - b.r)) drawObjectParts(ctx, o.k, o.c, o.r, false, 0, only);
}

// ── Parts vives (es pinten cada fotograma, DM i jugador) ──────────────────────

/** El que no va al cuinat perquè es mou o canvia d'estat. Viatja al jugador dins del STATE. */
export interface TileLive {
  /** Peces animades: posició (px de mapa) + fotogrames. */
  anims: { x: number; y: number; frames: number[]; ms: number }[];
  /**
   * Portes del mapa de caselles: posició i peces tancada/oberta del seu joc. Cada peça va a
   * la casella de la porta (`dy` 0) o a la de dalt (`dy` −1), on sobresurt l'art.
   */
  doors: { id: string; x: number; y: number; closed: { dy: number; tile: number }[]; open: { dy: number; tile: number }[] }[];
}

export function tileLiveOf(m: TileMap): TileLive {
  const anims: TileLive['anims'] = [];
  // Una casella d'aigua amb alguna cosa a sobre (vora, paret, objecte) es queda quieta: el
  // fotograma viu es pinta damunt del cuinat i taparia el que hi ha a sobre.
  const covered = new Set<number>();
  for (const o of m.objects) for (const p of objectDef(o.k)?.parts ?? []) if (inMap(m, o.c + p.dx, o.r + p.dy)) covered.add(cellOf(m, o.c + p.dx, o.r + p.dy));
  for (let i = 0; i < m.ground.length; i++) {
    const busy = covered.has(i) || m.overlays.some(o => o[i] >= 0) || !!m.wallSet[i] || m.wallRaw[i] >= 0 || i in m.doors;
    const a = m.ground[i] >= 0 && !busy ? groundAnim(m.ground[i]) : null;
    if (a) anims.push({ x: (i % m.cols) * TILE, y: Math.floor(i / m.cols) * TILE, frames: a.frames, ms: a.ms });
  }
  for (const o of m.objects.slice().sort((a, b) => a.r - b.r)) {
    const def = objectDef(o.k);
    for (const p of def?.parts ?? []) if (p.frames) anims.push({ x: (o.c + p.dx) * TILE, y: (o.r + p.dy) * TILE, frames: p.frames, ms: p.ms ?? 300 });
  }
  const doors: TileLive['doors'] = [];
  for (const [k, setId] of Object.entries(m.doors)) {
    const i = +k, c = i % m.cols, r = Math.floor(i / m.cols);
    const B = WALL_BY_ID.get(setId)?.row ?? 12;
    // Peces de l'autor (columnes 10–13 del joc de paret, com als mapes d'exemple):
    //  - paret horitzontal: tancada = la porta doble (10); oberta = els dos muntants (11);
    //  - paret lateral: tancada = la porta vista de cantell, un muntant al mig (12); oberta =
    //    la fulla de cara, girada contra la paret (13). Totes dues ocupen dues caselles d'alt.
    const piece = (col: number) => [{ dy: -1, tile: t(col, B) }, { dy: 0, tile: t(col, B + 1) }];
    const h = doorAxis(m, c, r) === 'h';
    doors.push({
      id: `td_${i}`, x: c * TILE, y: r * TILE,
      closed: h ? [{ dy: 0, tile: t(10, B + 1) }] : piece(12),
      open: h ? piece(11) : piece(13),
    });
  }
  return { anims, doors };
}

/**
 * Pinta les parts vives en coords de mapa (dins de la transformació del mapa). `openById`
 * diu l'estat actual de cada porta (`rDoors`, que es pot obrir i tancar a mitja partida).
 */
export function drawTileLive(ctx: CanvasRenderingContext2D, live: TileLive | null, openById: (id: string) => boolean, now: number) {
  if (!live || !sheet('terrain')) return;
  for (const a of live.anims) drawTile(ctx, a.frames[Math.floor(now / a.ms) % a.frames.length], a.x, a.y);
  for (const d of live.doors) {
    for (const p of openById(d.id) ? d.open : d.closed) drawTile(ctx, p.tile, d.x, d.y + p.dy * TILE);
  }
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
  if (typeof tile === 'string') {
    // Objecte: es pinten totes les seves peces encabides al quadrat.
    const def = objectDef(tile); if (!def) return null;
    const minDy = Math.min(...def.parts.map(p => p.dy)), maxDy = Math.max(...def.parts.map(p => p.dy));
    const h = maxDy - minDy + 1, s = size / h;
    for (const p of def.parts) {
      const y = (p.dy - minDy) * s, x = (size - s) / 2;
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
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
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
