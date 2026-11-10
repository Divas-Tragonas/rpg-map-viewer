/**
 * Mòduls de la història: la unitat de preparació d'una sessió (un encontre, una escena, un
 * viatge). Un mòdul és un **paquet JSON** (`ModulePack`) que reflecteix la pàgina del mateix
 * nom de la base MÒDULS de Notion: disparador, escena, textos per llegir, criatures,
 * sortides i notes del DM. Notion continua sent on s'escriu la prosa; el paquet es genera
 * des de la pàgina (a mà o demanant-ho a Claude, veure `docs/historia-i-moduls.md`) i s'importa
 * aquí perquè el DM pugui actuar-hi des de la partida sense canviar de finestra.
 *
 * La biblioteca (paquets + estat de cada mòdul) és DEL DM, no de la partida: viu a
 * `localStorage` (`createJsonStore`) i sobreviu a canviar de mapa o carregar una partida.
 */
import { createJsonStore } from './localStore';

export const MODULE_FORMAT = 'rpg-module';
export const MODULE_VERSION = 1;

export type ModuleStatus = 'esborrany' | 'preparat' | 'en-joc' | 'jugat' | 'descartat';

export const STATUS_LABEL: Record<ModuleStatus, string> = {
  esborrany: 'Esborrany', preparat: 'Preparat', 'en-joc': 'En joc', jugat: 'Jugat', descartat: 'Descartat',
};
/** L'ordre de la llista: primer el que s'ha de jugar. */
export const STATUS_ORDER: ModuleStatus[] = ['en-joc', 'preparat', 'esborrany', 'jugat', 'descartat'];

export interface ModuleReadAloud { id: string; label: string; text: string }
/** `creature`: id d'una plantilla (`goblin`, `fum_lhupo`), nom d'una criatura Oryx (`skeleton`, `wolf_black`) o qualsevol nom (sense figureta). */
export interface ModuleFoe { creature: string; count: number; name?: string; hp?: number; xp?: number; sprite?: string; note?: string }
export interface ModuleExit { id: string; label: string; text?: string; to?: string }
export interface ModuleDialog { id: string; title: string; script: string }
export interface ModuleNpc { name: string; note?: string }

export interface ModulePack {
  format: typeof MODULE_FORMAT;
  version: number;
  /** Identificador estable (slug): el mateix a Notion, al paquet i al diari. */
  id: string;
  title: string;
  notionUrl?: string;
  kind?: string;
  level?: number;
  duration?: string;
  status: ModuleStatus;
  quests: string[];
  trigger?: string;
  /** Les frases de «Escena» de Notion. */
  scene: string[];
  readAloud: ModuleReadAloud[];
  foes: ModuleFoe[];
  npcs: ModuleNpc[];
  dialogs: ModuleDialog[];
  exits: ModuleExit[];
  dmNotes?: string;
}

export interface StoredModule {
  pack: ModulePack;
  importedAt: number;
  /** Estat en joc: comença sent el del paquet i el mou el DM (no es perd en tornar a importar). */
  status: ModuleStatus;
  playedAt?: number;
}

export interface ModulesData {
  library: Record<string, StoredModule>;
  /** Ordre d'importació (el de la cadena de la història). */
  order: string[];
  active: string | null;
}

const EMPTY: ModulesData = { library: {}, order: [], active: null };

// ── Lectura defensiva del JSON ──────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown): string[] => list(v).flatMap(x => { const s = str(x); return s ? [s] : []; });

/** «Les runes de Cony Cirera» → «les-runes-de-cony-cirera». */
export function slugify(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Accepta el text d'una propietat «Estat» de Notion (`✅ Preparat`, `🎲 Jugat`…) o el nostre. */
export function normStatus(v: unknown): ModuleStatus {
  // Guions com a espais: el nostre propi valor és `en-joc` (abans es perdia en recarregar la pàgina).
  const s = (str(v) ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/-/g, ' ');
  if (s.includes('en part') || s.includes('en joc')) return 'en-joc';
  if (s.includes('jugat')) return 'jugat';
  if (s.includes('esborrany')) return 'esborrany';
  if (s.includes('descartat')) return 'descartat';
  return 'preparat';
}

function parseOne(raw: unknown, idx: number, errors: string[]): ModulePack | null {
  if (!isObj(raw)) { errors.push(`Mòdul ${idx + 1}: no és un objecte.`); return null; }
  const title = str(raw.title) ?? str(raw.nom);
  if (!title) { errors.push(`Mòdul ${idx + 1}: falta el «title».`); return null; }
  const id = slugify(str(raw.id) ?? title);
  if (!id) { errors.push(`Mòdul «${title}»: l'«id» no és vàlid.`); return null; }
  const used = new Set<string>();
  const uniq = (base: string) => { let k = base || 'x', n = 2; while (used.has(k)) k = `${base}-${n++}`; used.add(k); return k; };

  const readAloud = list(raw.readAloud).flatMap((r, i): ModuleReadAloud[] => {
    if (typeof r === 'string') return r.trim() ? [{ id: uniq(`t${i + 1}`), label: `Text ${i + 1}`, text: r.trim() }] : [];
    if (!isObj(r)) return [];
    const text = str(r.text); if (!text) return [];
    return [{ id: uniq(slugify(str(r.id) ?? '') || `t${i + 1}`), label: str(r.label) ?? `Text ${i + 1}`, text }];
  });
  const foes = list(raw.foes).flatMap((f): ModuleFoe[] => {
    if (!isObj(f)) return [];
    const creature = str(f.creature) ?? str(f.name); if (!creature) return [];
    return [{
      creature, count: Math.max(1, Math.min(30, Math.round(num(f.count) ?? 1))), name: str(f.name), hp: num(f.hp),
      xp: num(f.xp), sprite: str(f.sprite), note: str(f.note),
    }];
  });
  const npcs = list(raw.npcs).flatMap((n): ModuleNpc[] => {
    if (typeof n === 'string') return n.trim() ? [{ name: n.trim() }] : [];
    if (!isObj(n)) return [];
    const name = str(n.name); return name ? [{ name, note: str(n.note) }] : [];
  });
  const dialogs = list(raw.dialogs).flatMap((d, i): ModuleDialog[] => {
    if (!isObj(d)) return [];
    const script = typeof d.script === 'string' ? d.script.trim() : '';
    return script ? [{ id: uniq(slugify(str(d.id) ?? '') || `d${i + 1}`), title: str(d.title) ?? `Diàleg ${i + 1}`, script }] : [];
  });
  const exits = list(raw.exits).flatMap((e, i): ModuleExit[] => {
    if (typeof e === 'string') return e.trim() ? [{ id: uniq(`s${i + 1}`), label: e.trim() }] : [];
    if (!isObj(e)) return [];
    const label = str(e.label); if (!label) return [];
    const to = str(e.to);
    return [{ id: uniq(slugify(str(e.id) ?? '') || `s${i + 1}`), label, text: str(e.text), to: to ? slugify(to) : undefined }];
  });

  return {
    format: MODULE_FORMAT, version: MODULE_VERSION, id, title,
    notionUrl: str(raw.notionUrl), kind: str(raw.kind), level: num(raw.level), duration: str(raw.duration),
    status: normStatus(raw.status), quests: strs(raw.quests), trigger: str(raw.trigger), scene: strs(raw.scene),
    readAloud, foes, npcs, dialogs, exits, dmNotes: str(raw.dmNotes),
  };
}

export interface ParseResult { modules: ModulePack[]; errors: string[] }

/** Un mòdul, una llista de mòduls o `{ modules: [...] }`. */
export function parseModulePacks(raw: unknown): ParseResult {
  const errors: string[] = [];
  const items = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.modules) ? raw.modules : [raw];
  const modules = items.flatMap((x, i) => { const m = parseOne(x, i, errors); return m ? [m] : []; });
  if (!modules.length && !errors.length) errors.push('No hi ha cap mòdul al fitxer.');
  return { modules, errors };
}

// ── Magatzem ─────────────────────────────────────────────────────────────────

function revive(raw: unknown): ModulesData {
  if (!isObj(raw) || !isObj(raw.library)) return EMPTY;
  const library: Record<string, StoredModule> = {};
  for (const [id, v] of Object.entries(raw.library)) {
    if (!isObj(v)) continue;
    const { modules } = parseModulePacks(v.pack);
    const pack = modules[0]; if (!pack) continue;
    library[id] = {
      pack, importedAt: num(v.importedAt) ?? 0, status: normStatus(v.status ?? pack.status),
      ...(num(v.playedAt) ? { playedAt: num(v.playedAt) } : {}),
    };
  }
  const order = strs(raw.order).filter(id => library[id]);
  for (const id of Object.keys(library)) if (!order.includes(id)) order.push(id);
  const active = str(raw.active);
  return { library, order, active: active && library[active] ? active : null };
}

export const modulesStore = createJsonStore<ModulesData>('rpg_modules_v1', EMPTY, revive);

export interface ImportResult { added: string[]; updated: string[]; errors: string[] }

/** Importa el text d'un fitxer. Un mòdul que ja hi és s'actualitza sense perdre'n l'estat de joc. */
export function importModules(text: string): ImportResult {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { added: [], updated: [], errors: ['El fitxer no és un JSON vàlid.'] }; }
  const { modules, errors } = parseModulePacks(raw);
  const added: string[] = [], updated: string[] = [];
  if (modules.length) {
    modulesStore.update(d => {
      const library = { ...d.library }; const order = [...d.order];
      for (const pack of modules) {
        const cur = library[pack.id];
        if (cur) {
          // Si el DM ja l'ha mogut d'estat (en joc, jugat…) es respecta; si no, mana el paquet.
          const progressed = cur.status !== 'preparat' && cur.status !== 'esborrany';
          library[pack.id] = { ...cur, pack, status: progressed ? cur.status : pack.status };
          updated.push(pack.title);
        } else {
          library[pack.id] = { pack, importedAt: Date.now(), status: pack.status };
          order.push(pack.id); added.push(pack.title);
        }
      }
      return { ...d, library, order };
    });
  }
  return { added, updated, errors };
}

/** Un mòdul en blanc per a l'editor («Nou mòdul»). */
export function blankModule(): ModulePack {
  return {
    format: MODULE_FORMAT, version: MODULE_VERSION, id: '', title: '', status: 'preparat', quests: [], scene: [],
    readAloud: [], foes: [], npcs: [], dialogs: [], exits: [],
  };
}

export interface SaveResult { id?: string; errors: string[] }

/**
 * Desa un mòdul fet a l'editor. `editingId`: l'`id` del mòdul que s'edita (es manté estable perquè
 * les sortides dels altres mòduls hi segueixin apuntant); sense ell, és un mòdul nou i l'`id`
 * surt del títol (amb `-2`, `-3`… si ja n'hi ha un de igual). L'estat de joc es conserva.
 */
export function saveModule(draft: unknown, editingId?: string): SaveResult {
  const { modules, errors } = parseModulePacks(isObj(draft) ? { ...draft, id: editingId ?? '' } : draft);
  const pack = modules[0];
  if (!pack) return { errors };
  let result: SaveResult = { errors: [] };
  modulesStore.update(d => {
    const library = { ...d.library }; const order = [...d.order];
    let id = editingId ?? pack.id;
    if (!editingId) { const base = id; let n = 2; while (library[id]) id = `${base}-${n++}`; }
    const cur = editingId ? library[editingId] : undefined;
    const saved = { ...pack, id };
    if (cur) library[id] = { ...cur, pack: saved, status: pack.status };
    else { library[id] = { pack: saved, importedAt: Date.now(), status: pack.status }; order.push(id); }
    if (library[id].status === 'jugat' && !library[id].playedAt) library[id] = { ...library[id], playedAt: Date.now() };
    result = { id, errors: [] };
    return { ...d, library, order };
  });
  return result;
}

export function setActiveModule(id: string | null) {
  modulesStore.update(d => (d.active === id || (id && !d.library[id]) ? d : { ...d, active: id }));
}

export function setModuleStatus(id: string, status: ModuleStatus) {
  modulesStore.update(d => {
    const cur = d.library[id]; if (!cur || cur.status === status) return d;
    const next: StoredModule = { ...cur, status };
    if (status === 'jugat') next.playedAt = Date.now();
    return { ...d, library: { ...d.library, [id]: next } };
  });
}

export function removeModule(id: string) {
  modulesStore.update(d => {
    if (!d.library[id]) return d;
    const library = { ...d.library }; delete library[id];
    return { library, order: d.order.filter(x => x !== id), active: d.active === id ? null : d.active };
  });
}

/** Mòduls en l'ordre de la llista: primer el que s'ha de jugar, i dins de cada estat, l'ordre d'importació. */
export function sortedModules(d: ModulesData): StoredModule[] {
  const rank = (s: ModuleStatus) => STATUS_ORDER.indexOf(s);
  return d.order.map((id, i) => ({ m: d.library[id], i })).filter(x => x.m)
    .sort((a, b) => rank(a.m.status) - rank(b.m.status) || a.i - b.i).map(x => x.m);
}
