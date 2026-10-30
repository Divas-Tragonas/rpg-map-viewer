/**
 * Paquet de sprites (Oryx «Ultimate Fantasy»): els fulls que fa servir l'app Píxel.
 *
 * Els fulls viuen al repositori, a `public/sprites/` (només els de `SHEET_FILES`, passats per
 * un optimitzador PNG sense pèrdua: mateixos píxels RGBA). Cada pantalla, DM o jugador, els
 * carrega del mateix lloc on s'ha servit l'app: no es desen enlloc ni viatgen pel WebSocket.
 */

export const SHEET_FILES = {
  heroes: 'uf_heroes.png',
  // Variants de color de les figuretes, a les mateixes coordenades (`scripts/oryx-variants.py`).
  heroes_v1: 'uf_heroes_v1.png',
  heroes_v2: 'uf_heroes_v2.png',
  terrain: 'uf_terrain.png',
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
/** Full carregat (o `undefined`): lectura O(1) per als render phases. */
export function sheet(id: SheetId): HTMLImageElement | undefined { return state.sheets[id]; }
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
