/**
 * Paquet de sprites (Oryx «Ultimate Fantasy»): els fulls que fa servir l'app Píxel.
 *
 * Els fulls viuen al repositori, a `public/sprites/` (només els de `SHEET_FILES`, passats per
 * un optimitzador PNG sense pèrdua: mateixos píxels RGBA). Cada pantalla, DM o jugador, els
 * carrega del mateix lloc on s'ha servit l'app: no es desen enlloc ni viatgen pel WebSocket.
 */

import type { FigureGrade } from '@/types';

export const SHEET_FILES = {
  heroes: 'uf_heroes.png',
  // Variants de color de les figuretes, a les mateixes coordenades (`scripts/oryx-variants.py`).
  heroes_v1: 'uf_heroes_v1.png',
  heroes_v2: 'uf_heroes_v2.png',
  terrain: 'uf_terrain.png',
  // Temes de masmorra (gel, volcà…) recolorits del terreny (`scripts/oryx-themes.py`).
  terrain_themes: 'uf_terrain_themes.png',
  items: 'uf_items.png',
  fx: 'uf_FX.png',
  impact: 'uf_FX_impact.png',
  portraits: 'uf_portraits.png',
  faces: 'uf_portraits_example.png',
  skills: 'uf_skills.png',
  map: 'uf_map.png',
  interface: 'uf_interface.png',
  dragon: 'uf_bone_dragon/uf_bone_dragon.png',
} as const;
export type SheetId = keyof typeof SHEET_FILES;
const SHEET_IDS = Object.keys(SHEET_FILES) as SheetId[];
/** Sense aquests no té sentit l'estil Píxel (tokens i caselles). La resta són opcionals. */
const REQUIRED: SheetId[] = ['heroes', 'terrain'];

/** Carpeta dels fulls, amb la base de l'app (`NEXT_PUBLIC_BASE_PATH`, veure `next.config.ts`). */
export const SPRITES_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/sprites/`;

export interface PackState {
  /** `error`: no s'han pogut llegir els fulls obligatoris (es torna a provar a la crida següent). */
  status: 'none' | 'loading' | 'ready' | 'error';
  sheets: Partial<Record<SheetId, HTMLImageElement>>;
}

let state: PackState = { status: 'none', sheets: {} };
const listeners = new Set<() => void>();
let started: Promise<void> | null = null;

function emit(next: PackState) { state = next; listeners.forEach(l => l()); }
export function getPack(): PackState { return state; }
export function subscribePack(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
/** Full carregat, o la seva còpia amb l'ajust de color de les figuretes (veure `setFigureGrade`). */
export type SheetImage = HTMLImageElement | HTMLCanvasElement;
/** Full carregat (o `undefined`): lectura O(1) per als render phases. */
export function sheet(id: SheetId): SheetImage | undefined {
  const img = state.sheets[id];
  if (!img || !grade || !GRADED.includes(id)) return img;
  let c = _graded.get(id);
  if (!c) { c = gradeSheet(img, grade); _graded.set(id, c); }
  return c;
}

// ── Ajust de color de les figuretes ─────────────────────────────────────────
// Un mapa de missió de tons apagats (Conyberry) amb les figuretes saturades del paquet «canta»:
// es passen els fulls de criatures per l'ajust del mapa, un sol cop per full (getImageData, no
// `ctx.filter`, que Safari no té). Viatja a les pantalles de jugador dins del STATE (`figureGrade`).
const GRADED: SheetId[] = ['heroes', 'heroes_v1', 'heroes_v2', 'dragon'];
let grade: FigureGrade | null = null;   // l'actiu (null si no n'hi ha o està apagat)
let current: FigureGrade | null = null; // el del mapa, tal com ve (amb `off`): el que es desa i s'envia
let gradeKey = '';
const _graded = new Map<SheetId, HTMLCanvasElement>();

/** Clau de l'ajust actiu ('' = cap): les memòries cau de figuretes la porten dins de la clau. */
export const figureGradeKey = () => gradeKey;

/** L'ajust de color del mapa actual, tal com s'ha posat (amb `off`), o null. */
export const getFigureGrade = () => current;

/** Posa (o treu, amb `null` o `off`) l'ajust de color de les figuretes. No refà res si no canvia. */
export function setFigureGrade(g: FigureGrade | null | undefined) {
  current = g ?? null;
  const on = g && !g.off ? g : null;
  const key = on ? JSON.stringify([on.sat, on.warm, on.gain, on.ink, on.shadow ?? 0]) : '';
  if (key === gradeKey) return;
  grade = on; gradeKey = key; _graded.clear();
  emit({ ...state });  // la UI torna a fer les miniatures
}

function gradeSheet(img: SheetImage, g: FigureGrade): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height), px = d.data;
  const ink = g.ink.map(v => v / 255);
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const r = px[i] / 255, gg = px[i + 1] / 255, b = px[i + 2] / 255;
    const l = 0.3 * r + 0.59 * gg + 0.11 * b;
    const ch = [r, gg, b];
    for (let k = 0; k < 3; k++) {
      const v = (l + (ch[k] - l) * g.sat) * g.warm[k] * g.gain;
      px[i + k] = Math.round(Math.min(1, ink[k] + v * (1 - ink[k])) * 255);  // els negres passen a la tinta
    }
  }
  if (g.shadow) dropShadow(px, c.width, c.height, g.shadow);
  ctx.putImageData(d, 0, 0);
  return c;
}

// Ombra de la figureta cap a baix a la dreta (2 píxels d'art = 4 px del full), dins de la seva
// casella de 48 px: la mateixa direcció de llum que el mapa. Els píxels semitransparents (l'ombra
// del terra que porta el full) no fan ombra; i on ja hi ha ombra més fosca, es queda la més fosca.
const SHADOW_RGB = [34, 30, 18], SHADOW_D = 4, CELL = 48;
function dropShadow(px: Uint8ClampedArray, w: number, h: number, alpha: number) {
  const a = Math.round(alpha * 255);
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = px[i * 4 + 3] >= 200 ? 1 : 0;
  for (let y = 0; y < h; y++) {
    if (y % CELL < SHADOW_D) continue;
    for (let x = 0; x < w; x++) {
      if (x % CELL < SHADOW_D) continue;
      const i = y * w + x;
      if (solid[i] || !solid[(y - SHADOW_D) * w + x - SHADOW_D] || px[i * 4 + 3] >= a) continue;
      px[i * 4] = SHADOW_RGB[0]; px[i * 4 + 1] = SHADOW_RGB[1]; px[i * 4 + 2] = SHADOW_RGB[2]; px[i * 4 + 3] = a;
    }
  }
}
export function packReady() { return state.status === 'ready'; }

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

/** Carrega els fulls de `public/sprites/` (un sol cop per pàgina si va bé). No llança mai. */
export function ensurePack(): Promise<void> {
  if (started) return started;
  started = (async () => {
    emit({ ...state, status: 'loading' });
    const sheets: Partial<Record<SheetId, HTMLImageElement>> = {};
    await Promise.all(SHEET_IDS.map(async id => {
      const img = await loadImg(SPRITES_URL + SHEET_FILES[id]);
      if (img) sheets[id] = img;
    }));
    if (REQUIRED.every(id => sheets[id])) { emit({ status: 'ready', sheets }); return; }
    started = null;
    emit({ status: 'error', sheets: {} });
  })();
  return started;
}
