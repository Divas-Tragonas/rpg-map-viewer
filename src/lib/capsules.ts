/**
 * Càpsules de la Història: «fotos» d'un moment preparat que el DM dispara amb un clic des del
 * mòdul actiu. Una càpsula pot portar:
 *  - **Enemics**: els de l'escena en el moment de capturar, amb la posició al mapa, la vida
 *    sencera i si eren visibles (una emboscada amagada es dispara amagada).
 *  - **Escena**: el text, les diapositives (imatges o vídeos) i els ajustos de la pestanya
 *    Escena del panell «Mostrar als jugadors».
 *
 * Com la biblioteca de mòduls, són del DM i viuen FORA de la partida. Les imatges no caben a
 * `localStorage` (~5 MB): tot va a IndexedDB (`rpg_capsules_v1`). La llista lleugera (`CapsuleMeta`)
 * es manté en memòria per a la UI (`useCapsules`); la càpsula sencera es llegeix en disparar-la.
 * Sense IndexedDB (mode privat d'alguns navegadors) es guarden en memòria mentre la pàgina és oberta.
 */
import { useSyncExternalStore } from 'react';
import type { LibEnemy } from '@/types';
import type { SceneOpts } from '@/lib/scene';

/** Un enemic capturat: tot el token menys l'`id` (se'n fa un de nou en disparar) i el dany. */
export type CapsuleEnemyData = Omit<LibEnemy, 'id' | 'hp' | 'hpHit'>;
export interface CapsuleEnemy { enemy: CapsuleEnemyData; x: number; y: number }

export interface CapsuleSlide { blob: Blob; mimeType: string; name: string }
export interface CapsuleScene {
  text: string;
  opts: SceneOpts;
  slides: CapsuleSlide[];
  manual: boolean;
  speed: number;
  smooth: number;
  dramatic: boolean;
  loop: boolean;
}

export interface Capsule {
  id: string;
  /** Mòdul on es va capturar (on surt el botó). */
  moduleId: string;
  name: string;
  createdAt: number;
  /** Nom del mapa on es va capturar: les posicions dels enemics són d'aquell mapa. */
  mapName?: string;
  enemies?: CapsuleEnemy[];
  scene?: CapsuleScene;
  /** En disparar-la, l'Escena es mostra als jugadors i el text comença sol (si no, només es carrega al panell). */
  autoShow?: boolean;
}

/** El que la UI necessita per pintar la llista, sense les imatges. */
export interface CapsuleMeta {
  id: string; moduleId: string; name: string; createdAt: number; mapName?: string;
  enemyCount: number; slideCount: number; hasText: boolean;
}

export const metaOf = (c: Capsule): CapsuleMeta => ({
  id: c.id, moduleId: c.moduleId, name: c.name, createdAt: c.createdAt, mapName: c.mapName,
  enemyCount: c.enemies?.length ?? 0, slideCount: c.scene?.slides.length ?? 0, hasText: !!c.scene?.text.trim(),
});

// ── IndexedDB ───────────────────────────────────────────────────────────────

const DB_NAME = 'rpg_capsules_v1';
const STORE = 'capsules';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    if (typeof indexedDB === 'undefined') { resolve(null); return; }
    let req: IDBOpenDBRequest;
    try { req = indexedDB.open(DB_NAME, 1); } catch { resolve(null); return; }
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | null): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    return await new Promise<T | null>(resolve => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req ? (req.result as T) ?? null : (true as T));
      t.onerror = () => resolve(null);
      t.onabort = () => resolve(null);
    });
  } catch { return null; } finally { db.close(); }
}

// ── Llista en memòria (per a la UI) ─────────────────────────────────────────

/** Sense IndexedDB: les càpsules senceres, només mentre la pàgina és oberta. */
const memory = new Map<string, Capsule>();
let list: CapsuleMeta[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const setList = (next: CapsuleMeta[]) => { list = next.sort((a, b) => a.createdAt - b.createdAt); emit(); };

function load() {
  if (loaded) return;
  loaded = true;
  void withStore<Capsule[]>('readonly', s => s.getAll()).then(all => {
    if (all) setList([...all.map(metaOf), ...list.filter(m => !all.some(c => c.id === m.id))]);
  });
}

const EMPTY: CapsuleMeta[] = [];
function subscribe(cb: () => void) { load(); listeners.add(cb); return () => { listeners.delete(cb); }; }

/** Totes les càpsules (metadades), en l'ordre en què es van capturar. */
export function useCapsules(): CapsuleMeta[] {
  return useSyncExternalStore(subscribe, () => list, () => EMPTY);
}

// ── Operacions ──────────────────────────────────────────────────────────────

export function newCapsuleId(): string {
  return `cap_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Desa una càpsula. Retorna `false` si s'ha hagut de quedar només en memòria. */
export async function saveCapsule(c: Capsule): Promise<boolean> {
  const ok = await withStore('readwrite', s => s.put(c));
  if (!ok) memory.set(c.id, c);
  setList([...list.filter(m => m.id !== c.id), metaOf(c)]);
  return !!ok;
}

export async function getCapsule(id: string): Promise<Capsule | null> {
  return memory.get(id) ?? await withStore<Capsule>('readonly', s => s.get(id));
}

export async function renameCapsule(id: string, name: string) {
  const c = await getCapsule(id);
  if (c && name.trim()) await saveCapsule({ ...c, name: name.trim() });
}

export async function deleteCapsule(id: string) {
  memory.delete(id);
  setList(list.filter(m => m.id !== id));
  await withStore('readwrite', s => s.delete(id));
}

/** En eliminar un mòdul de la biblioteca, les seves càpsules se'n van amb ell. */
export async function deleteModuleCapsules(moduleId: string) {
  const stored = (await withStore<Capsule[]>('readonly', s => s.getAll())) ?? [];
  const ids = new Set([...stored, ...memory.values()].filter(c => c.moduleId === moduleId).map(c => c.id));
  for (const m of list) if (m.moduleId === moduleId) ids.add(m.id);
  for (const id of ids) await deleteCapsule(id);
}
