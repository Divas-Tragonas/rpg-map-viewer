/**
 * Paleta de l'editor de caselles: què hi ha a cada lloc del full `uf_terrain.png` i com es
 * fa servir (terres amb variants, aigua animada, jocs de paret, objectes de més d'una
 * casella). Les coordenades són de la graella de 48 px del full (columna, fila).
 */
import { t, TERRAIN_COLS, THEME_BASE } from './model';
import { ITEMS } from '@/lib/sprites/manifest';

const row = (r: number, c0: number, c1: number) => Array.from({ length: c1 - c0 + 1 }, (_, i) => t(c0 + i, r));

export interface FloorDef { id: string; label: string; tiles: number[] }
/** Terres: cada casella pren una variant a l'atzar (determinista per posició). */
export const FLOORS: FloorDef[] = [
  { id: 'slab_grey', label: 'Lloses grises', tiles: row(2, 1, 5) },
  { id: 'slab_blue', label: 'Lloses blaves', tiles: row(1, 1, 5) },
  { id: 'slab_dark', label: 'Lloses fosques', tiles: row(3, 1, 5) },
  { id: 'dirt_dark', label: 'Terra fosca', tiles: row(5, 1, 4) },
  { id: 'wood', label: 'Fusta', tiles: row(5, 5, 8) },
  { id: 'dirt', label: 'Terra', tiles: row(6, 1, 4) },
  { id: 'grass', label: 'Herba', tiles: row(6, 5, 8) },
  { id: 'cracked', label: 'Terra esquerdada', tiles: row(7, 1, 4) },
  { id: 'light', label: 'Terra clara', tiles: row(7, 5, 7) },
  { id: 'burnt', label: 'Herba cremada', tiles: [t(8, 7)] },
  { id: 'sand', label: 'Sorra', tiles: row(8, 1, 4) },
  { id: 'tile_blue', label: 'Rajola blava', tiles: row(8, 5, 8) },
  { id: 'pale', label: 'Terra pàl·lida', tiles: row(9, 1, 4) },
  { id: 'tile_red', label: 'Rajola vermella', tiles: row(9, 5, 8) },
  { id: 'tile_sand', label: 'Rajola de sorra', tiles: row(10, 1, 4) },
  { id: 'stone', label: 'Pedra grisa', tiles: row(10, 5, 8) },
];

/**
 * Temes de masmorra (`uf_terrain_themes.png`, generat amb `scripts/oryx-themes.py`): jocs de paret
 * i terres de l'autor recolorits. Cada tema és un bloc de 4 files: el joc de paret sencer (files
 * 0–2, amb les peces a les mateixes columnes) i el terra (fila 3, variants a les columnes 1–5).
 * ⚠️ Mateix ordre que `THEMES` del script.
 */
const THEMES = [
  { id: 'ice', label: 'Gel' },
  { id: 'lava', label: 'Volcà' },
  { id: 'moss', label: 'Cripta de molsa' },
  { id: 'temple', label: 'Temple daurat' },
];
const themeTile = (c: number, r: number) => THEME_BASE + t(c, r);
FLOORS.push(...THEMES.map((th, i) => ({
  id: `th_${th.id}`, label: th.label, tiles: [1, 2, 3, 4, 5].map(c => themeTile(c, 4 * i + 3)),
})));
export const FLOOR_BY_ID = new Map(FLOORS.map(f => [f.id, f]));

/** Aigües animades: 4 fotogrames en fila a partir de `base`. */
export interface WaterDef { id: string; label: string; base: number; ms: number }
export const WATERS: WaterDef[] = [
  { id: 'teal', label: 'Aigua', base: t(15, 5), ms: 500 },
  { id: 'blue', label: 'Aigua blava', base: t(15, 8), ms: 500 },
  { id: 'green', label: 'Aigua verda', base: t(15, 7), ms: 500 },
  { id: 'mud', label: 'Fang', base: t(15, 6), ms: 600 },
  { id: 'acid', label: 'Àcid', base: t(15, 9), ms: 300 },
  { id: 'lava', label: 'Lava', base: t(15, 10), ms: 450 },
];

/**
 * Jocs de paret. Cada joc ocupa 3 files a partir de `row`: vora de dalt (la paret comença
 * a mitja casella: perspectiva), centre i cara frontal (amb el maó fosc a baix). La
 * columna 8 de la fila del mig és el pilar (paret d'una sola casella d'alt). Les portes del
 * joc són a les columnes 10 (tancada) i 11 (oberta: els dos muntants).
 */
export interface WallSetDef {
  id: string; label: string; row: number; floor: string;
  /** Full on és: 0 = `uf_terrain.png`; `THEME_BASE` = el dels temes (`row` és la del seu full). */
  base?: number;
}
export const WALL_SETS: WallSetDef[] = [
  { id: 'dungeon', label: 'Masmorra', row: 12, floor: 'dirt' },
  { id: 'crypt', label: 'Cripta', row: 15, floor: 'slab_blue' },
  { id: 'stone', label: 'Empedrat', row: 18, floor: 'wood' },
  { id: 'hedge', label: 'Bardissa', row: 21, floor: 'grass' },
  { id: 'ruins', label: 'Ruïnes', row: 24, floor: 'sand' },
  { id: 'cave', label: 'Cova', row: 27, floor: 'cracked' },
  ...THEMES.map((th, i) => ({ id: `th_${th.id}`, label: th.label, row: 4 * i, floor: `th_${th.id}`, base: THEME_BASE })),
];
/** Peça d'un joc de paret: columna `col` de la fila `row + dr` del seu full. */
export const wallPiece = (set: WallSetDef, col: number, dr: number) => (set.base ?? 0) + t(col, set.row + dr);
export const WALL_BY_ID = new Map(WALL_SETS.map(w => [w.id, w]));

/** Una part d'un objecte: desplaçament en caselles respecte de l'àncora i peça (o fotogrames). */
export interface ObjectPart { dx: number; dy: number; tile?: number; frames?: number[]; ms?: number }
export interface ObjectDef { label: string; parts: ObjectPart[]; /** Encén una llum d'aquest radi (peus). */ lightFt?: number }

const simple = (label: string, tile: number): ObjectDef => ({ label, parts: [{ dx: 0, dy: 0, tile }] });
const OBJ: Record<string, ObjectDef> = {
  crate: simple('Caixa', t(4, 31)),
  barrel: simple('Barril', t(5, 31)),
  grave: simple('Tomba', t(6, 31)),
  grave_broken: simple('Tomba trencada', t(7, 31)),
  statue: { label: 'Estàtua', parts: [{ dx: 0, dy: -1, tile: t(8, 30) }, { dx: 0, dy: 0, tile: t(8, 31) }] },
  coffin: simple('Taüt', t(9, 31)),
  coffin_open: simple('Taüt obert', t(10, 31)),
  coffin_bones: simple('Taüt amb ossos', t(11, 31)),
  table: simple('Taula', t(12, 31)),
  table_papers: simple('Taula amb papers', t(13, 31)),
  table_lab: simple('Taula d\'alquímia', t(14, 31)),
  altar_blood: simple('Altar de sang', t(15, 31)),
  altar_skull: simple('Altar de la calavera', t(16, 31)),
  torch: {
    label: 'Torxa de paret', lightFt: 20,
    parts: [{ dx: 0, dy: 0, frames: [t(4, 32), t(5, 32)], ms: 160 }, { dx: 0, dy: 1, frames: [t(4, 33), t(5, 33)], ms: 160 }],
  },
  fountain: {
    label: 'Font',
    parts: [{ dx: 0, dy: 0, frames: [t(1, 31), t(2, 31)], ms: 220 }, { dx: 0, dy: 1, tile: t(3, 31) }],
  },
  trap: simple('Trampa', t(15, 32)),
  lily_a: { label: 'Nenúfar', parts: [{ dx: 0, dy: 0, frames: [t(12, 33), t(13, 33)], ms: 750 }] },
  lily_b: { label: 'Nenúfars', parts: [{ dx: 0, dy: 0, frames: [t(14, 33), t(15, 33)], ms: 750 }] },
};
[[6, 10, 32, 'Teranyina'], [11, 14, 32, 'Ossos'], [1, 3, 32, 'Pols'], [1, 3, 33, 'Pols'], [6, 8, 33, 'Fulles'],
 [9, 11, 33, 'Fulles seques'], [1, 6, 34, 'Bassal'], [1, 6, 35, 'Bassalet'], [7, 10, 34, 'Runa']].forEach(([c0, c1, r, label]) => {
  for (let c = c0 as number; c <= (c1 as number); c++) OBJ[`t:${t(c, r as number)}`] = simple(label as string, t(c, r as number));
});
export const OBJECTS = OBJ;
/** Ordre dels objectes de terreny a la paleta (els de més d'una peça primer). */
export const OBJECT_KEYS = Object.keys(OBJ);

/** Objectes del full d'objectes (botí): tot el que hi ha a `ITEMS`. */
export const LOOT_KEYS = Object.keys(ITEMS).sort().map(n => `i:${n}`);

/** Definició d'un objecte per clau (`t:12`, `i:chest_gold`, `statue`…); `raw:N` = una peça qualsevol. */
export function objectDef(k: string): ObjectDef | null {
  if (OBJ[k]) return OBJ[k];
  if (k.startsWith('raw:')) { const n = +k.slice(4); return Number.isFinite(n) ? simple('', n) : null; }
  if (k.startsWith('i:') && ITEMS[k.slice(2)]) return { label: k.slice(2).replace(/_/g, ' '), parts: [{ dx: 0, dy: 0 }] };
  return null;
}

/** Decorats d'una sola peça (sense variants): catifes, ombres, vores, escales, rajoles. */
export interface DecorGroup { label: string; tiles: number[] }
export const DECOR: DecorGroup[] = [
  { label: 'Rajoles soltes', tiles: [5, 6, 7, 8, 9, 10].flatMap(r => row(r, 10, 13)) },
  { label: 'Escales i reixes', tiles: [1, 2, 3].flatMap(r => row(r, 6, 12)) },
  { label: 'Catifes', tiles: [...row(2, 14, 18), ...row(3, 14, 18)] },
  { label: 'Vores d\'aigua', tiles: [13, 14, 15].flatMap(r => row(r, 15, 18)) },
  { label: 'Ombres', tiles: row(1, 14, 17) },
];

/** Fotogrames animats del terra (aigües), per peça base i també per qualsevol fotograma. */
const _anim = new Map<number, { frames: number[]; ms: number }>();
for (const w of WATERS) {
  const frames = [0, 1, 2, 3].map(i => w.base + i);
  for (const f of frames) _anim.set(f, { frames, ms: w.ms });
}
export function groundAnim(tile: number): { frames: number[]; ms: number } | null { return _anim.get(tile) ?? null; }
/** Animacions declarades en un `.tmx` (Tiled les desa per peça). */
export function registerAnim(frames: number[], ms: number) {
  for (const f of frames) if (!_anim.has(f)) _anim.set(f, { frames, ms });
}

/** Variant estable d'un terra per a una casella (que no canviï en tornar a pintar). */
export function variantFor(tiles: number[], c: number, r: number): number {
  const h = ((c * 73856093) ^ (r * 19349663)) >>> 0;
  return tiles[h % tiles.length];
}

export const terrainXY = (tile: number) => [(tile % TERRAIN_COLS) * 48, Math.floor(tile / TERRAIN_COLS) * 48] as const;
