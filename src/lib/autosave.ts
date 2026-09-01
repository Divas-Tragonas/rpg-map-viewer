/**
 * Desat automàtic de la partida a IndexedDB (xarxa de seguretat contra un F5).
 *
 * Fins ara tot l'estat viu (fons, parets, sales, portes, llums, posicions, vides, estats,
 * dibuix i torns) existia només en refs de memòria: un refresc, un hot-reload del dev
 * server o una pestanya que el navegador descarrega i la partida se n'anava sencera si el
 * DM no havia premut «Desar».
 *
 * Tres decisions que val la pena no desfer:
 *
 *  1. **IndexedDB, no localStorage.** El mapa de fons són megabytes; localStorage té un
 *     límit de ~5 MB i només accepta text.
 *  2. **El fons es desa com a `Blob`, no en base64.** El `bgData` del fitxer `.json`
 *     infla la imatge un 33% i el bucle de `btoa` sobre un mapa de 8 MB bloqueja el fil
 *     principal — a un desat cada 30 s, això es notaria.
 *  3. **El fons va en un registre a part**, amb una empremta (`bgFingerprint`). Mentre no
 *     canviï el mapa, els desats successius només reescriuen l'estat (uns quants KB) i no
 *     tornen a copiar la imatge.
 *
 * Tot és tolerant a fallades: sense IndexedDB (mode privat, navegador antic, quota
 * exhaurida) les funcions no llancen mai — retornen `null` o `false` i l'app continua
 * igual que abans.
 */

const DB_NAME = 'rpg-map-viewer';
const DB_VERSION = 1;
const STORE = 'autosave';
const K_META = 'meta';
const K_STATE = 'state';
const K_BG = 'bg';

export interface AutosaveMeta {
  savedAt: number;
  mapName: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SessionState = Record<string, any>;

export interface AutosaveBg {
  blob: Blob;
  /** Empremta del fons: si no canvia, no cal reescriure el blob. */
  fingerprint: string;
}

/**
 * Empremta barata d'un fons: tipus, mida i una suma de bytes mostrejats. Amb només tipus
 * i mida, dos mapes diferents de la mateixa mida es confondrien i es restauraria el mapa
 * equivocat; el mostreig ho fa pràcticament impossible sense recórrer tot el buffer.
 */
export function bgFingerprint(buffer: ArrayBuffer, mimeType: string): string {
  const u8 = new Uint8Array(buffer);
  const step = Math.max(1, Math.floor(u8.length / 4096));
  let h = 0;
  for (let i = 0; i < u8.length; i += step) h = (h * 31 + u8[i]) | 0;
  return `${mimeType}:${u8.length}:${h}`;
}

/** «ara mateix» · «fa 4 min» · «fa 2 h» — etiqueta curta d'un instant passat. */
export function agoLabel(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 10) return 'ara mateix';
  if (s < 60) return `fa ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `fa ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `fa ${h} h`;
  return `fa ${Math.round(h / 24)} d`;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    if (typeof indexedDB === 'undefined') { resolve(null); return; }
    let req: IDBOpenDBRequest;
    try { req = indexedDB.open(DB_NAME, DB_VERSION); }
    catch { resolve(null); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function get<T>(store: IDBObjectStore, key: string): Promise<T | null> {
  return new Promise(resolve => {
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => resolve(null);
  });
}

/**
 * Desa la partida. `bg` només s'escriu si la seva empremta no coincideix amb la desada,
 * o sigui que canviar de token o moure una paret no torna a copiar el mapa sencer.
 * Retorna `false` si no s'ha pogut desar (sense IndexedDB, quota plena...).
 */
export async function writeAutosave(state: SessionState, bg: AutosaveBg | null, mapName: string): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  try {
    const prev = await get<AutosaveMeta & { bgFingerprint: string | null }>(tx(db, 'readonly'), K_META);
    const needsBg = !!bg && prev?.bgFingerprint !== bg.fingerprint;
    return await new Promise<boolean>(resolve => {
      const t = db.transaction(STORE, 'readwrite');
      const store = t.objectStore(STORE);
      store.put(state, K_STATE);
      if (needsBg && bg) store.put(bg.blob, K_BG);
      if (!bg) store.delete(K_BG);
      store.put({ savedAt: Date.now(), mapName, bgFingerprint: bg?.fingerprint ?? null }, K_META);
      t.oncomplete = () => resolve(true);
      t.onerror = () => resolve(false);
      t.onabort = () => resolve(false);
    });
  } catch { return false; }
  finally { db.close(); }
}

/** Metadades del desat (data i nom del mapa) sense carregar l'estat ni la imatge. */
export async function readAutosaveMeta(): Promise<AutosaveMeta | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const meta = await get<AutosaveMeta>(tx(db, 'readonly'), K_META);
    return meta && typeof meta.savedAt === 'number' ? meta : null;
  } catch { return null; }
  finally { db.close(); }
}

/**
 * Carrega la partida desada, amb el fons enganxat com a `state.bgBlob`
 * (`applySessionState` l'accepta igual que el `bgData` en base64 del fitxer `.json`).
 */
export async function readAutosave(): Promise<{ meta: AutosaveMeta; state: SessionState } | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const store = tx(db, 'readonly');
    const meta = await get<AutosaveMeta>(store, K_META);
    const state = await get<SessionState>(store, K_STATE);
    if (!meta || !state) return null;
    const blob = await get<Blob>(tx(db, 'readonly'), K_BG);
    if (blob) state.bgBlob = blob;
    return { meta, state };
  } catch { return null; }
  finally { db.close(); }
}

/** Esborra el desat automàtic (l'usuari apaga l'autodesat o descarta la recuperació). */
export async function clearAutosave(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    await new Promise<void>(resolve => {
      const t = db.transaction(STORE, 'readwrite');
      t.objectStore(STORE).clear();
      t.oncomplete = () => resolve();
      t.onerror = () => resolve();
      t.onabort = () => resolve();
    });
  } catch { /* res a fer */ }
  finally { db.close(); }
}
