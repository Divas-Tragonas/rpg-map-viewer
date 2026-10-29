/**
 * Importar un mapa de Tiled (`.tmx`), com els d'exemple del paquet Oryx. Es reconeixen els
 * fulls pel nom de la imatge (terreny, objectes, mapa del món, criatures) i les capes pel
 * nom: «floor» → terra, «walls» → parets, «props»/«door» → objectes, criatures → tokens.
 * La resta de capes (vores d'aigua, ombres, catifes…) passen a decorat.
 */
import { CREATURES } from '@/lib/sprites/manifest';
import {
  emptyTileMap, EMPTY, ITEM_BASE, WORLD_BASE, TERRAIN_COLS, type TileMap,
} from './model';
import { registerAnim } from './palette';

export interface TmxResult {
  map: TileMap;
  /** Criatures trobades a les capes de criatures: nom de la criatura + casella. */
  creatures: { name: string; c: number; r: number }[];
}

type SheetKind = 'terrain' | 'items' | 'world' | 'heroes' | 'unknown';
interface Tileset { first: number; kind: SheetKind; cols: number }

function kindOf(src: string): SheetKind {
  const f = src.split('/').pop()?.toLowerCase() ?? '';
  if (f.startsWith('uf_terrain')) return 'terrain';
  if (f.startsWith('uf_items')) return 'items';
  if (f.startsWith('uf_map')) return 'world';
  if (f.startsWith('uf_heroes')) return 'heroes';
  return 'unknown';
}

async function decodeData(el: Element, n: number): Promise<number[]> {
  const enc = el.getAttribute('encoding'), comp = el.getAttribute('compression');
  const text = (el.textContent ?? '').trim();
  if (enc === 'csv') return text.split(/[\s,]+/).filter(Boolean).map(Number);
  if (enc === 'base64') {
    const bin = atob(text.replace(/\s+/g, ''));
    let bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
    if (comp === 'zlib' || comp === 'gzip') {
      const ds = new DecompressionStream(comp === 'zlib' ? 'deflate' : 'gzip');
      bytes = new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(ds)).arrayBuffer());
    } else if (comp) throw new Error(`Compressió no suportada: ${comp}`);
    const dv = new DataView(bytes.buffer);
    return Array.from({ length: Math.min(n, bytes.length / 4) }, (_, i) => dv.getUint32(i * 4, true));
  }
  // XML antic: <tile gid="…"/>
  return Array.from(el.querySelectorAll('tile')).map(t => +(t.getAttribute('gid') ?? 0));
}

export async function parseTmx(xml: string): Promise<TmxResult> {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const mapEl = doc.querySelector('map');
  if (!mapEl) throw new Error('No és un mapa de Tiled (.tmx)');
  const cols = +(mapEl.getAttribute('width') ?? 0), rows = +(mapEl.getAttribute('height') ?? 0);
  const tw = +(mapEl.getAttribute('tilewidth') ?? 48);
  if (!cols || !rows) throw new Error('Mapa sense mida');

  const sets: Tileset[] = [];
  for (const ts of Array.from(doc.querySelectorAll('map > tileset'))) {
    const first = +(ts.getAttribute('firstgid') ?? 1);
    const img = ts.querySelector('image');
    const kind = kindOf(img?.getAttribute('source') ?? ts.getAttribute('name') ?? '');
    const w = +(img?.getAttribute('width') ?? 0), tsw = +(ts.getAttribute('tilewidth') ?? tw);
    sets.push({ first, kind, cols: Math.max(1, Math.round(w / tsw)) });
    // Animacions de peça (aigua, nenúfars…) del full de terreny.
    if (kind === 'terrain') {
      for (const tile of Array.from(ts.querySelectorAll('tile'))) {
        const frames = Array.from(tile.querySelectorAll('animation > frame')).map(f => +(f.getAttribute('tileid') ?? 0));
        const ms = +(tile.querySelector('animation > frame')?.getAttribute('duration') ?? 500);
        if (frames.length > 1) registerAnim(frames, ms);
      }
    }
  }
  sets.sort((a, b) => b.first - a.first);
  const creatureNames = Object.keys(CREATURES);
  // gid de Tiled → codi de casella de l'app (veure `model.ts`) o criatura.
  const resolve = (gidRaw: number): { tile?: number; creature?: string } | null => {
    const gid = gidRaw & 0x1fffffff;  // sense els bits de gir
    if (!gid) return null;
    const ts = sets.find(s => gid >= s.first); if (!ts) return null;
    const local = gid - ts.first;
    if (ts.kind === 'terrain') return { tile: local };
    if (ts.kind === 'items') return { tile: ITEM_BASE + local };
    if (ts.kind === 'world') return { tile: WORLD_BASE + local };
    if (ts.kind === 'heroes') {
      // Full «simple» (1 fotograma, 10 per fila) o sencer (4 fotogrames, 40 per fila).
      const idx = ts.cols >= 40 ? Math.floor(local / ts.cols) * 10 + Math.floor((local % ts.cols) / 4) : local;
      return creatureNames[idx] ? { creature: creatureNames[idx] } : null;
    }
    return null;
  };

  const map = emptyTileMap(cols, rows);
  map.overlays = [];
  const creatures: TmxResult['creatures'] = [];
  const n = cols * rows;
  let first = true;
  for (const layer of Array.from(doc.querySelectorAll('map > layer'))) {
    const data = layer.querySelector('data'); if (!data) continue;
    // Capes molt transparents (núvols, fum): al nostre cuinat sortirien opaques.
    if (+(layer.getAttribute('opacity') ?? 1) < 0.6 || layer.getAttribute('visible') === '0') continue;
    const name = (layer.getAttribute('name') ?? '').toLowerCase();
    const gids = await decodeData(data, n);
    // L'ordre de les capes és el del document (de baix a dalt): la primera és el terra.
    const role = /wall|paret/.test(name) ? 'wall'
      : /prop|door|object|item|castle|marker/.test(name) ? 'object'
      : first ? 'ground'
      : 'overlay';
    first = false;
    const over = role === 'overlay' ? new Array(n).fill(EMPTY) : null;
    for (let i = 0; i < Math.min(n, gids.length); i++) {
      const res = resolve(gids[i]); if (!res) continue;
      const c = i % cols, r = Math.floor(i / cols);
      if (res.creature) { creatures.push({ name: res.creature, c, r }); continue; }
      const tile = res.tile!;
      if (role === 'ground') map.ground[i] = tile;
      else if (role === 'wall') map.wallRaw[i] = tile;
      else if (role === 'object') map.objects.push({ c, r, k: `raw:${tile}` });
      else over![i] = tile;
    }
    if (over) map.overlays.push(over);
  }
  if (!map.overlays.length) map.overlays.push(new Array(n).fill(EMPTY));
  // Una capa de paret de Tiled pot portar peces que no ho són (un pilar decoratiu sense
  // res, ombres): només bloquegen les de les files de jocs de paret (12–29) i columnes 0–8.
  for (let i = 0; i < n; i++) {
    const tile = map.wallRaw[i];
    if (tile < 0 || tile >= ITEM_BASE) continue;
    const c = tile % TERRAIN_COLS, r = Math.floor(tile / TERRAIN_COLS);
    if (!(r >= 12 && r <= 29 && c <= 8)) { map.overlays[map.overlays.length - 1][i] = tile; map.wallRaw[i] = EMPTY; }
  }
  return cropToContent(map, creatures);
}

/**
 * Els mapes de Tiled solen tenir una mida fixa (48×48) amb el contingut en un racó: es
 * retalla al que hi ha pintat (+1 casella de marge) perquè no surti petit enmig del negre.
 */
function cropToContent(m: TileMap, creatures: TmxResult['creatures']): TmxResult {
  let c0 = Infinity, r0 = Infinity, c1 = -1, r1 = -1;
  const mark = (c: number, r: number) => { c0 = Math.min(c0, c); r0 = Math.min(r0, r); c1 = Math.max(c1, c); r1 = Math.max(r1, r); };
  for (let i = 0; i < m.cols * m.rows; i++) {
    if (m.ground[i] >= 0 || m.wallRaw[i] >= 0 || m.overlays.some(o => o[i] >= 0)) mark(i % m.cols, Math.floor(i / m.cols));
  }
  for (const o of m.objects) mark(o.c, o.r);
  if (c1 < 0) return { map: m, creatures };
  c0 = Math.max(0, c0 - 1); r0 = Math.max(0, r0 - 1);
  c1 = Math.min(m.cols - 1, c1 + 1); r1 = Math.min(m.rows - 1, r1 + 1);
  const cols = c1 - c0 + 1, rows = r1 - r0 + 1;
  if (cols === m.cols && rows === m.rows) return { map: m, creatures };
  const out = emptyTileMap(cols, rows);
  const copy = (src: number[] | string[], dst: number[] | string[]) => {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) dst[r * cols + c] = src[(r + r0) * m.cols + (c + c0)];
  };
  copy(m.ground, out.ground); copy(m.wallSet, out.wallSet); copy(m.wallRaw, out.wallRaw);
  out.overlays = m.overlays.map(o => { const d = new Array(cols * rows).fill(EMPTY); copy(o, d); return d; });
  out.objects = m.objects.map(o => ({ ...o, c: o.c - c0, r: o.r - r0 }));
  return { map: out, creatures: creatures.map(cr => ({ ...cr, c: cr.c - c0, r: cr.r - r0 })) };
}
