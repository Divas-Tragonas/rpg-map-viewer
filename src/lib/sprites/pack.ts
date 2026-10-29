/**
 * Paquet de sprites (Oryx «Ultimate Fantasy»): d'on surten els fulls i com arriben a totes
 * les pantalles.
 *
 * ⚠️ Els sprites tenen llicència de l'autor: **no van al repositori** (el repo i l'app de
 * Vercel són públics i servir-los seria redistribuir-los). Per això el paquet es carrega
 * en temps d'execució, d'un d'aquests llocs i en aquest ordre:
 *
 *  1. **IndexedDB** del navegador (`rpg-sprites`): el DM ja l'havia importat abans. Les
 *     pantalles de jugador del mateix ordinador hi llegeixen el mateix (mateix origen).
 *  2. **`/oryx/`** del servidor de desenvolupament: una carpeta local que Git ignora
 *     (`public/oryx/`, veure `.gitignore`). Útil en LAN: la tablet que obre
 *     `http://[IP-PC]:3001/player` els agafa del PC sense transferir res pel WebSocket.
 *  3. **El DM** els envia (fulls en dataURL) dins d'un `STATE` quan una pantalla demana
 *     l'estat complet (`PLAYER_READY`) amb l'estil Píxel encès. Va dins del STATE, que la
 *     API reenvia opac, perquè no calgui cap tipus de missatge nou a la API.
 *
 * El DM l'importa una sola vegada deixant anar el `.zip` original (veure `extractZip`).
 */
import { extractZip } from './zip';

export const SHEET_FILES = {
  heroes: 'uf_heroes.png',
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

export type PackSource = 'idb' | 'local' | 'dm' | 'zip';
export interface PackState {
  status: 'none' | 'loading' | 'ready';
  source: PackSource | null;
  /** Empremta del paquet (mides dels fulls): el jugador no torna a aplicar el mateix. */
  id: string | null;
  sheets: Partial<Record<SheetId, HTMLImageElement>>;
}

let state: PackState = { status: 'none', source: null, id: null, sheets: {} };
let blobs: Partial<Record<SheetId, Blob>> = {};
let dataUrls: Partial<Record<SheetId, string>> | null = null;
const listeners = new Set<() => void>();
let started: Promise<void> | null = null;

function emit(next: PackState) { state = next; listeners.forEach(l => l()); }
export function getPack(): PackState { return state; }
export function subscribePack(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
/** Full carregat (o `undefined`): lectura O(1) per als render phases. */
export function sheet(id: SheetId): HTMLImageElement | undefined { return state.sheets[id]; }
export function packReady() { return state.status === 'ready'; }

// ── IndexedDB ────────────────────────────────────────────────────────────────
const DB = 'rpg-sprites', STORE = 'sheets';
function openDb(): Promise<IDBDatabase | null> {
  return new Promise(res => {
    try {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => { rq.result.createObjectStore(STORE); };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
    } catch { res(null); }
  });
}
async function idbReadAll(): Promise<Partial<Record<SheetId, Blob>>> {
  const db = await openDb(); if (!db) return {};
  return new Promise(res => {
    const out: Partial<Record<SheetId, Blob>> = {};
    try {
      const tx = db.transaction(STORE, 'readonly');
      const st = tx.objectStore(STORE);
      for (const id of SHEET_IDS) {
        const rq = st.get(id);
        rq.onsuccess = () => { if (rq.result instanceof Blob) out[id] = rq.result; };
      }
      tx.oncomplete = () => { db.close(); res(out); };
      tx.onerror = () => { db.close(); res(out); };
    } catch { db.close(); res(out); }
  });
}
async function idbWriteAll(b: Partial<Record<SheetId, Blob>>): Promise<void> {
  const db = await openDb(); if (!db) return;
  await new Promise<void>(res => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const st = tx.objectStore(STORE);
      for (const [k, v] of Object.entries(b)) st.put(v, k);
      tx.oncomplete = () => res(); tx.onerror = () => res();
    } catch { res(); }
  });
  db.close();
}
export async function forgetPack(): Promise<void> {
  const db = await openDb();
  if (db) {
    await new Promise<void>(res => {
      try { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).clear(); tx.oncomplete = () => res(); tx.onerror = () => res(); }
      catch { res(); }
    });
    db.close();
  }
  blobs = {}; dataUrls = null;
  emit({ status: 'none', source: null, id: null, sheets: {} });
}

// ── Càrrega ─────────────────────────────────────────────────────────────────
function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}
const packIdOf = (b: Partial<Record<SheetId, Blob>>) => SHEET_IDS.map(id => b[id]?.size ?? 0).join('.');

async function adopt(b: Partial<Record<SheetId, Blob>>, source: PackSource): Promise<boolean> {
  if (!REQUIRED.every(id => b[id])) return false;
  const sheets: Partial<Record<SheetId, HTMLImageElement>> = {};
  await Promise.all(SHEET_IDS.map(async id => {
    const bl = b[id]; if (!bl) return;
    const img = await loadImg(URL.createObjectURL(bl));
    if (img) sheets[id] = img;
  }));
  if (!REQUIRED.every(id => sheets[id])) return false;
  blobs = b; dataUrls = null;
  emit({ status: 'ready', source, id: packIdOf(b), sheets });
  return true;
}

/** Busca el paquet a IndexedDB i a `/oryx/` (un sol cop per pàgina). No llança mai. */
export function ensurePack(): Promise<void> {
  if (started) return started;
  started = (async () => {
    if (state.status === 'ready') return;
    emit({ ...state, status: 'loading' });
    try {
      if (await adopt(await idbReadAll(), 'idb')) return;
      const local: Partial<Record<SheetId, Blob>> = {};
      await Promise.all(SHEET_IDS.map(async id => {
        try {
          const r = await fetch(`/oryx/${SHEET_FILES[id]}`);
          if (r.ok && (r.headers.get('content-type') ?? '').startsWith('image/')) local[id] = await r.blob();
        } catch { /* no hi és */ }
      }));
      if (await adopt(local, 'local')) return;
    } catch { /* sense paquet */ }
    if (getPack().status !== 'ready') emit({ ...getPack(), status: 'none' });
  })();
  return started;
}

/** Importa el `.zip` original de l'autor: en treu els fulls, els desa a IndexedDB i els carrega. */
export async function importPackZip(file: File): Promise<boolean> {
  const buf = await file.arrayBuffer();
  const want = new Map<string, SheetId>();
  for (const id of SHEET_IDS) want.set(SHEET_FILES[id], id);
  // El zip pot portar una carpeta arrel (p. ex. «oryx_ultimate_fantasy_1.2/uf_heroes.png»).
  const match = (name: string) => {
    for (const [file] of want) if (name === file || name.endsWith('/' + file)) return true;
    return false;
  };
  const files = await extractZip(buf, match);
  const b: Partial<Record<SheetId, Blob>> = {};
  for (const [name, data] of files) {
    for (const [f, id] of want) {
      // `uf_bone_dragon/uf_bone_dragon.png` també acaba en «uf_bone_dragon.png» (el full
      // petit de l'arrel): el camí complet té preferència.
      if (name === f || (name.endsWith('/' + f) && !b[id])) b[id] = new Blob([data], { type: 'image/png' });
    }
  }
  const ok = await adopt(b, 'zip');
  if (ok) await idbWriteAll(b);
  return ok;
}

/** Fulls en dataURL per enviar-los a una pantalla de jugador que no els té. */
export async function packDataUrls(): Promise<{ id: string; sheets: Partial<Record<SheetId, string>> } | null> {
  if (state.status !== 'ready' || !state.id) return null;
  if (!dataUrls) {
    const out: Partial<Record<SheetId, string>> = {};
    await Promise.all(SHEET_IDS.map(id => new Promise<void>(res => {
      const bl = blobs[id]; if (!bl) { res(); return; }
      const fr = new FileReader();
      fr.onload = () => { out[id] = fr.result as string; res(); };
      fr.onerror = () => res();
      fr.readAsDataURL(bl);
    })));
    dataUrls = out;
  }
  return { id: state.id, sheets: dataUrls };
}

/** Jugador: aplica el paquet que ha enviat el DM (si no en tenia o era un altre). */
export async function applyPackDataUrls(p: { id: string; sheets: Partial<Record<SheetId, string>> }): Promise<void> {
  if (state.status === 'ready' && state.id === p.id) return;
  const b: Partial<Record<SheetId, Blob>> = {};
  await Promise.all(Object.entries(p.sheets).map(async ([id, url]) => {
    try { b[id as SheetId] = await (await fetch(url as string)).blob(); } catch { /* full perdut */ }
  }));
  if (await adopt(b, 'dm')) {
    // L'empremta ha de coincidir amb la del DM (les mides dels blobs ja són les mateixes).
    emit({ ...state, id: p.id });
  }
}
