/**
 * Forja de figuretes: el maniquí (`prisoner_a/b/c`, cossos nus amb la mateixa silueta) vestit amb
 * peces dibuixades a l'escala de les figuretes (`kit-art.json`). Les peces surten dels objectes del
 * paquet (`uf_items.png`), redibuixats amb la densitat de detall de les figuretes; cada material és
 * un canvi de paleta. Veure `docs/pixel-i-missions.md` («Forja de figuretes»).
 *
 * La recepta viatja dins del nom de la figureta (`kit:base|armadura|casc|arma|metall|escut|material`),
 * o sigui que la porten el STATE, les partides i les plantilles sense camps nous ni API.
 *
 * ⚠️ `scripts/forja-preview.py` fa la mateixa composició per previsualitzar les peces: mantenir-los iguals.
 */
import ART_JSON from './kit-art.json';
import { getPack } from './pack';
import { CREATURES } from './manifest';

type Rows = string[];
interface Mat { label: string; ramp: string[]; accent: string[]; skirt?: string[] }
interface Piece { group: Group; x: number; y: number; rows: Rows }
type Group = 'up' | 'thigh' | 'foot';
interface Art {
  bases: string[];
  baseLabels: Record<string, string>;
  groups: Record<Group, number[]>;
  fistR: [number, number]; fistL: [number, number];
  fistBoxR: Box; fistBoxL: Box;
  chainCols: number[]; chainRows: [number, number];
  hairClear: Box;
  loincloth: { box: Box; colors: string[] };
  ink: string; wood: string[]; grip: string;
  materials: Record<string, Mat>;
  armors: Record<string, { body: string }>;
  bodies: Record<string, { gauntlets?: boolean; sabatons?: boolean; pieces: Piece[] }>;
  helms: Record<string, { label: string; material?: string; x?: number; y?: number; rows?: Rows }>;
  weaponMetals: Record<string, Mat>;
  weapons: Record<string, { label: string; grip?: [number, number]; rows?: Rows }>;
  shieldMaterials: Record<string, Mat>;
  shields: Record<string, { label: string; rows?: Rows }>;
}
type Box = [number, number, number, number];
const ART = ART_JSON as unknown as Art;

const T = 48;
const FRAMES = 3;
export const KIT_PREFIX = 'kit:';

export interface KitRecipe {
  base: string; armor: string; helm: string; weapon: string; metal: string; shield: string; shieldMat: string;
}
const KEYS: (keyof KitRecipe)[] = ['base', 'armor', 'helm', 'weapon', 'metal', 'shield', 'shieldMat'];

export const isKit = (s: string | null | undefined): s is string => !!s && s.startsWith(KIT_PREFIX);

const valid: Record<keyof KitRecipe, (v: string) => boolean> = {
  base: v => ART.bases.includes(v) && v in CREATURES,
  armor: v => v === 'none' || v in ART.armors,
  helm: v => v in ART.helms,
  weapon: v => v in ART.weapons,
  metal: v => v in ART.weaponMetals,
  shield: v => v in ART.shields,
  shieldMat: v => v in ART.shieldMaterials,
};

/** Recepta d'un nom `kit:…`, o null si no ho és o porta una peça que no existeix. */
export function parseKit(s: string | null | undefined): KitRecipe | null {
  if (!isKit(s)) return null;
  const parts = s.slice(KIT_PREFIX.length).split('|');
  if (parts.length !== KEYS.length) return null;
  const r = Object.fromEntries(KEYS.map((k, i) => [k, parts[i]])) as unknown as KitRecipe;
  return KEYS.every(k => valid[k](r[k])) ? r : null;
}
export const kitSprite = (r: KitRecipe) => KIT_PREFIX + KEYS.map(k => r[k]).join('|');

export const DEFAULT_KIT: KitRecipe = {
  base: 'prisoner_a', armor: 'plate', helm: 'plate', weapon: 'sword', metal: 'steel', shield: 'heater', shieldMat: 'iron',
};

// ── Catàlegs per a la UI (clau + etiqueta) ───────────────────────────────────
type Opt = { id: string; label: string };
const opts = (o: Record<string, { label: string }>): Opt[] => Object.entries(o).map(([id, v]) => ({ id, label: v.label }));
export const KIT_OPTIONS = {
  base: ART.bases.map(id => ({ id, label: ART.baseLabels[id] ?? id })),
  armor: [{ id: 'none', label: 'Sense armadura' }, ...Object.keys(ART.armors).map(id => ({ id, label: ART.materials[id].label }))],
  helm: opts(ART.helms),
  weapon: opts(ART.weapons),
  metal: opts(ART.weaponMetals),
  shield: opts(ART.shields),
  shieldMat: opts(ART.shieldMaterials),
} satisfies Record<keyof KitRecipe, Opt[]>;

/** Nom suggerit per a una figureta (p. ex. «Soldat d'or»). */
export function kitLabel(r: KitRecipe): string {
  const armor = r.armor === 'none' ? '' : ` · ${ART.materials[r.armor].label}`;
  const weapon = r.weapon === 'none' ? 'Lluitador' : ART.weapons[r.weapon].label;
  return `${weapon}${armor}`;
}

// ── Composició ───────────────────────────────────────────────────────────────
type RGB = [number, number, number];
const rgb = (h: string): RGB => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB;
const lum = (r: number, g: number, b: number) => 0.3 * r + 0.59 * g + 0.11 * b;

function colorMap(m: Mat): Record<string, RGB> {
  const map: Record<string, RGB> = {};
  m.ramp.forEach((c, i) => { map[String(i)] = rgb(c); });
  map.a = rgb(m.accent[0]); map.b = rgb(m.accent[1]);
  map.k = rgb(ART.ink); map.w = rgb(ART.wood[0]); map.W = rgb(ART.wood[1]); map.x = rgb(ART.wood[2]);
  map.g = rgb(ART.grip);
  return map;
}

/** Píxels d'un fotograma (48×48) amb accés per coordenades. */
class Px {
  constructor(readonly d: Uint8ClampedArray) {}
  i(x: number, y: number) { return (y * T + x) * 4; }
  in(x: number, y: number) { return x >= 0 && x < T && y >= 0 && y < T; }
  solid(x: number, y: number) { return this.in(x, y) && this.d[this.i(x, y) + 3] > 200; }
  get(x: number, y: number): RGB { const i = this.i(x, y); return [this.d[i], this.d[i + 1], this.d[i + 2]]; }
  set(x: number, y: number, c: RGB) { if (!this.in(x, y)) return; const i = this.i(x, y); this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255; }
  clear(x: number, y: number) { if (this.in(x, y)) this.d[this.i(x, y) + 3] = 0; }
}

function paint(px: Px, rows: Rows, x: number, y: number, map: Record<string, RGB>) {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = map[row[i]];
      if (c) px.set(x + i, y + j, c);
    }
  });
}

/** Torna els píxels opacs de la caixa a la rampa, per lluminositat relativa (guants i botes). */
function rampRecolor(px: Px, [x0, y0, w, h]: Box, ramp: RGB[]) {
  const pts: [number, number, number][] = [];
  for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + h; y++) {
    if (px.solid(x, y)) { const [r, g, b] = px.get(x, y); pts.push([x, y, lum(r, g, b)]); }
  }
  if (!pts.length) return;
  const ls = pts.map(p => p[2]); const lo = Math.min(...ls), hi = Math.max(...ls);
  for (const [x, y, l] of pts) px.set(x, y, ramp[hi === lo ? 0 : Math.round((l - lo) / (hi - lo) * (ramp.length - 1))]);
}

const grayish = ([r, g, b]: RGB) => Math.abs(r - g) < 8 && Math.abs(g - b) < 8;

function composeFrame(px: Px, r: KitRecipe, frame: number) {
  const up = ART.groups.up[frame];
  // 1. Maniquí net: fora cadenes; els grillons passen a pell.
  const [c0, c1] = ART.chainRows;
  for (const x of ART.chainCols) for (let y = c0 + up; y <= c1 + up; y++) px.clear(x, y);
  for (const [box, sx, sy] of [[ART.fistBoxL, 16, 25], [ART.fistBoxR, 31, 25]] as [Box, number, number][]) {
    const [x0, y0, w, h] = box;
    const s = px.get(sx, sy + up); const skin: RGB = grayish(s) ? [165, 153, 111] : s;
    for (let x = x0 - 1; x < x0 + w + 1; x++) for (let y = y0 + up; y < y0 + h + up; y++) {
      if (px.solid(x, y) && grayish(px.get(x, y))) px.set(x, y, skin);
    }
  }
  // 2. Cos (amb el taparrabos com a faldó, i guants i botes de metall a les armadures pesants).
  if (r.armor !== 'none') {
    const mat = ART.materials[r.armor]; const map = colorMap(mat);
    const body = ART.bodies[ART.armors[r.armor].body];
    for (const p of body.pieces) paint(px, p.rows, p.x, p.y + ART.groups[p.group][frame], map);
    const lc = new Set(ART.loincloth.colors.map(c => rgb(c).join()));
    const skirt = (mat.skirt ?? mat.accent).map(rgb);
    const [x0, y0, w, h] = ART.loincloth.box;
    for (let x = x0; x < x0 + w; x++) for (let y = y0 + up; y < y0 + h + up; y++) {
      if (!px.solid(x, y)) continue;
      const c = px.get(x, y);
      if (lc.has(c.join())) px.set(x, y, lum(...c) < 110 ? skirt[1] : skirt[0]);
    }
    const ramp = mat.ramp.slice(0, 4).map(rgb);
    if (body.gauntlets) for (const [bx, by, bw, bh] of [ART.fistBoxL, ART.fistBoxR]) rampRecolor(px, [bx, by + up, bw, bh], ramp);
    if (body.sabatons) { rampRecolor(px, [14, 35, 7, 5], ramp); rampRecolor(px, [27, 35, 7, 5], ramp); }
  }
  // 3. Casc (abans, fora el cabell que en sobresortiria).
  const helm = ART.helms[r.helm];
  if (helm.rows && helm.material) {
    const [x0, y0, w] = ART.hairClear;
    for (let x = x0; x < x0 + w; x++) for (let y = y0 + up; y < 12 + up; y++) px.clear(x, y);
    paint(px, helm.rows, helm.x!, helm.y! + up, colorMap(ART.materials[helm.material]));
  }
  // 4. Arma darrere del puny dret (el puny es torna a pintar a sobre: l'agafa).
  const weapon = ART.weapons[r.weapon];
  if (weapon.rows && weapon.grip) {
    const [fx, fy, fw, fh] = ART.fistBoxR;
    const fist: [number, number, RGB][] = [];
    for (let x = fx; x < fx + fw; x++) for (let y = fy + up; y < fy + fh + up; y++) if (px.solid(x, y)) fist.push([x, y, px.get(x, y)]);
    paint(px, weapon.rows, ART.fistR[0] - weapon.grip[0], ART.fistR[1] - weapon.grip[1] + up, colorMap(ART.weaponMetals[r.metal]));
    for (const [x, y, c] of fist) px.set(x, y, c);
  }
  // 5. Escut damunt del braç esquerre.
  const shield = ART.shields[r.shield];
  if (shield.rows) {
    const rows = shield.rows;
    paint(px, rows, ART.fistL[0] - Math.floor(rows[0].length / 2), ART.fistL[1] - Math.floor(rows.length / 2) - 1 + up,
      colorMap(ART.shieldMaterials[r.shieldMat]));
  }
}

const _sheets = new Map<string, HTMLCanvasElement>();

/**
 * Tira de 3 fotogrames (144×48) de la figureta. Null si la
 * recepta no és vàlida o el full de criatures encara no s'ha carregat (no es desa: es torna a provar).
 */
export function kitSheet(sprite: string): HTMLCanvasElement | null {
  const key = sprite;
  const hit = _sheets.get(key); if (hit) return hit;
  const r = parseKit(sprite); if (!r) return null;
  const img = getPack().sheets.heroes; if (!img) return null;
  const [bx, by] = CREATURES[r.base];
  const c = document.createElement('canvas'); c.width = T * FRAMES; c.height = T;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingEnabled = false;
  for (let f = 0; f < FRAMES; f++) {
    const tile = document.createElement('canvas'); tile.width = T; tile.height = T;
    const tg = tile.getContext('2d', { willReadFrequently: true })!;
    tg.drawImage(img, bx + f * T, by, T, T, 0, 0, T, T);
    const data = tg.getImageData(0, 0, T, T);
    composeFrame(new Px(data.data), r, f);
    g.putImageData(data, f * T, 0);
  }
  _sheets.set(key, c);
  return c;
}
