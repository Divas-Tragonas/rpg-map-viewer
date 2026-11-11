/**
 * Diari de la sessió: el que va passant a la taula (escenes, combats, XP, diàlegs, cinemàtiques,
 * sales revelades, mòduls i notes del DM), anotat sol amb l'hora. En acabar, `journalToMarkdown`
 * en fa el resum que abans es feia a mà amb Claude: cronologia, mòduls jugats, combats i XP, més
 * un bloc JSON perquè Claude el pugui passar a Notion sense preguntar res.
 *
 * Viu FORA de la partida (`createJsonStore`, localStorage): una nit passa per diversos mapes,
 * partides carregades i missions, i el diari ha de ser un de sol.
 *
 * Es pot cridar des de qualsevol lloc (`logJournal`), sense hooks.
 */
import { createJsonStore } from './localStore';
import { modulesStore, STATUS_LABEL, type ModulesData } from './modules';

export type JournalKind =
  | 'session' | 'map' | 'scene' | 'room' | 'combat' | 'xp' | 'dialog' | 'cinematic' | 'module' | 'down' | 'text' | 'note';

export const KIND_LABEL: Record<JournalKind, string> = {
  session: 'Sessió', map: 'Mapa', scene: 'Escena', room: 'Sala', combat: 'Combat', xp: 'XP', dialog: 'Diàleg',
  cinematic: 'Cinemàtica', module: 'Mòdul', down: 'Caiguda', text: 'Text', note: 'Nota',
};

/** Color de cada tipus d'anotació al diari (la vora del requadre i l'etiqueta), com els tons de l'historial de combat. */
export const KIND_TONE: Record<JournalKind, string> = {
  session: '#8b949e', map: '#79c0ff', scene: '#d2a8ff', room: '#e3b341', combat: '#f0883e', xp: '#3fb950',
  dialog: '#58a6ff', cinematic: '#a371f7', module: '#56d4dd', down: '#f85149', text: '#ffa657', note: '#f2cc60',
};

export interface JournalEntry {
  id: string;
  t: number;
  kind: JournalKind;
  text: string;
  /** Mòdul actiu en aquell moment. */
  module?: string;
  /** Dades breus per al bloc JSON del resum (combats, XP…). */
  data?: Record<string, unknown>;
}

export interface JournalSession { id: string; name: string; startedAt: number; entries: JournalEntry[] }

export interface ArchivedSession { id: string; name: string; startedAt: number; endedAt: number; count: number; markdown: string }

export interface JournalData { current: JournalSession; archive: ArchivedSession[] }

const MAX_ENTRIES = 1500;
const MAX_ARCHIVE = 20;
/** Un mateix text seguit dins d'aquest marge no es torna a anotar (clics repetits, sales que es revelen i s'amaguen). */
const DEDUP_MS = 3000;

const BLANK: JournalSession = { id: '', name: '', startedAt: 0, entries: [] };
const EMPTY: JournalData = { current: BLANK, archive: [] };

const uid = () => Math.random().toString(36).slice(2, 10);

// ── Lectura defensiva ────────────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const KINDS = new Set<string>(Object.keys(KIND_LABEL));

function reviveSession(raw: unknown): JournalSession {
  if (!isObj(raw)) return BLANK;
  const entries = (Array.isArray(raw.entries) ? raw.entries : []).flatMap((e): JournalEntry[] => {
    if (!isObj(e) || typeof e.text !== 'string' || typeof e.t !== 'number' || typeof e.kind !== 'string' || !KINDS.has(e.kind)) return [];
    return [{
      id: typeof e.id === 'string' ? e.id : uid(), t: e.t, kind: e.kind as JournalKind, text: e.text,
      ...(typeof e.module === 'string' ? { module: e.module } : {}),
      ...(isObj(e.data) ? { data: e.data } : {}),
    }];
  });
  return {
    id: typeof raw.id === 'string' ? raw.id : '', name: typeof raw.name === 'string' ? raw.name : '',
    startedAt: typeof raw.startedAt === 'number' ? raw.startedAt : 0, entries,
  };
}

function revive(raw: unknown): JournalData {
  if (!isObj(raw)) return EMPTY;
  const archive = (Array.isArray(raw.archive) ? raw.archive : []).flatMap((a): ArchivedSession[] => {
    if (!isObj(a) || typeof a.markdown !== 'string') return [];
    return [{
      id: typeof a.id === 'string' ? a.id : uid(), name: typeof a.name === 'string' ? a.name : '',
      startedAt: typeof a.startedAt === 'number' ? a.startedAt : 0, endedAt: typeof a.endedAt === 'number' ? a.endedAt : 0,
      count: typeof a.count === 'number' ? a.count : 0, markdown: a.markdown,
    }];
  });
  return { current: reviveSession(raw.current), archive };
}

export const journalStore = createJsonStore<JournalData>('rpg_journal_v1', EMPTY, revive);

// ── Escriptura ───────────────────────────────────────────────────────────────

/** Anota una entrada. Mai llança: el diari no pot trencar res del joc. */
export function logJournal(kind: JournalKind, text: string, extra: { data?: Record<string, unknown> } = {}) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return;
  try {
    const t = Date.now();
    journalStore.update(d => {
      const cur = d.current;
      const last = cur.entries[cur.entries.length - 1];
      if (last && last.kind === kind && last.text === clean && t - last.t < DEDUP_MS) return d;
      const mod = modulesStore.get().active ?? undefined;
      const entry: JournalEntry = { id: uid(), t, kind, text: clean, ...(mod ? { module: mod } : {}), ...extra };
      let entries = [...cur.entries, entry];
      if (entries.length > MAX_ENTRIES) {
        // Cau primer el que menys importa: les notes es conserven.
        let over = entries.length - MAX_ENTRIES;
        entries = entries.filter(e => (over > 0 && e.kind !== 'note' ? (over--, false) : true));
      }
      return { ...d, current: { ...cur, id: cur.id || uid(), startedAt: cur.startedAt || t, entries } };
    });
  } catch { /* el diari és un extra */ }
}

export function removeEntry(id: string) {
  journalStore.update(d => ({ ...d, current: { ...d.current, entries: d.current.entries.filter(e => e.id !== id) } }));
}

/** Esborra diverses anotacions d'un cop (un combat agrupat n'és unes quantes). */
export function removeEntries(ids: string[]) {
  const gone = new Set(ids);
  journalStore.update(d => ({ ...d, current: { ...d.current, entries: d.current.entries.filter(e => !gone.has(e.id)) } }));
}

export function renameSession(name: string) {
  journalStore.update(d => d.current.name === name ? d : { ...d, current: { ...d.current, name } });
}

/** Desa el resum de la sessió a l'arxiu i en comença una de nova (en blanc). */
export function closeSession(): string {
  const d = journalStore.get();
  const md = journalToMarkdown(d.current, modulesStore.get());
  if (d.current.entries.length) {
    const a: ArchivedSession = {
      id: d.current.id || uid(), name: sessionName(d.current), startedAt: d.current.startedAt,
      endedAt: d.current.entries[d.current.entries.length - 1].t, count: d.current.entries.length, markdown: md,
    };
    journalStore.set({ current: BLANK, archive: [a, ...d.archive].slice(0, MAX_ARCHIVE) });
  }
  return md;
}

export function removeArchived(id: string) {
  journalStore.update(d => ({ ...d, archive: d.archive.filter(a => a.id !== id) }));
}

// ── Combats agrupats ─────────────────────────────────────────────────────────

/** Una línia de l'historial d'un combat tal com la desa `finishCombat` (`data.log` del final). */
export interface CombatLogLine { round: number; text: string; tone: 'hit' | 'spell' | 'effect' | 'heal' | 'info' }

export type JournalItem =
  | { type: 'entry'; e: JournalEntry }
  | { type: 'combat'; start: JournalEntry; end: JournalEntry; inner: JournalEntry[]; log: CombatLogLine[] };

const TONES = new Set(['hit', 'spell', 'effect', 'heal', 'info']);
const isCombatStart = (e: JournalEntry) => e.kind === 'combat' && !!e.data?.started;
const isCombatEnd = (e: JournalEntry) => e.kind === 'combat' && !!e.data?.ended;

/** L'historial detallat que el combat va deixar en acabar (buit si és un combat d'abans que es desés). */
function logOf(e: JournalEntry): CombatLogLine[] {
  const raw = e.data?.log;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((l): CombatLogLine[] => (isObj(l) && typeof l.text === 'string' && typeof l.round === 'number'
    ? [{ round: l.round, text: l.text, tone: (typeof l.tone === 'string' && TONES.has(l.tone) ? l.tone : 'info') as CombatLogLine['tone'] }] : []));
}

/**
 * Les anotacions en ordre cronològic, amb cada combat (de «Comença» a «Combat acabat») plegat en
 * un sol element: surt al lloc on va acabar i duu a dins el detall (l'historial del combat o, si
 * és un d'abans, les anotacions que hi va haver pel mig: els jugadors que cauen). Un combat sense
 * final (encara en curs o tancat sense anotar) es queda com a anotacions soltes.
 */
export function groupCombats(entries: JournalEntry[]): JournalItem[] {
  const groups = new Map<string, Extract<JournalItem, { type: 'combat' }>>();
  const eaten = new Set<string>();
  for (let i = 0; i < entries.length; i++) {
    if (!isCombatStart(entries[i])) continue;
    let end = -1;
    for (let j = i + 1; j < entries.length; j++) {
      if (isCombatStart(entries[j])) break;
      if (isCombatEnd(entries[j])) { end = j; break; }
    }
    if (end < 0) continue;
    const inner = entries.slice(i + 1, end).filter(e => e.kind === 'down');
    const g = { type: 'combat' as const, start: entries[i], end: entries[end], inner, log: logOf(entries[end]) };
    groups.set(entries[end].id, g);
    eaten.add(entries[i].id);
    inner.forEach(e => eaten.add(e.id));
    i = end;
  }
  const out: JournalItem[] = [];
  for (const e of entries) {
    const g = groups.get(e.id);
    if (g) out.push(g);
    else if (!eaten.has(e.id)) out.push({ type: 'entry', e });
  }
  return out;
}

// ── Format ───────────────────────────────────────────────────────────────────

const hhmm = (t: number) => new Date(t).toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
const dateLabel = (t: number) => new Date(t).toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' });

export function sessionName(s: JournalSession): string {
  return s.name.trim() || (s.startedAt ? `Sessió del ${new Date(s.startedAt).toLocaleDateString('ca-ES', { day: 'numeric', month: 'numeric' })}` : 'Sessió');
}

/** «1 h 20 min», «35 min». */
export function durationLabel(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`;
}

/** El text d'una entrada tal com surt al resum (les notes amb etiqueta). */
function line(e: JournalEntry): string {
  return `${hhmm(e.t)} — ${e.kind === 'note' ? `Nota: ${e.text}` : e.text}`;
}

/**
 * El resum de la sessió en markdown. Les seccions segueixen la pàgina de sessió de Notion
 * (Timeline, mòduls, notes) i el bloc JSON del final és el que llegeix Claude per omplir-la.
 */
export function journalToMarkdown(s: JournalSession, lib: ModulesData): string {
  const es = s.entries;
  const end = es.length ? es[es.length - 1].t : s.startedAt;
  const out: string[] = [`# ${sessionName(s)}`, ''];
  if (!es.length) return `${out.join('\n')}_Cap esdeveniment anotat._\n`;
  out.push(`_${dateLabel(s.startedAt)} · ${hhmm(s.startedAt)}–${hhmm(end)} (${durationLabel(end - s.startedAt)})_`, '');

  // Mòduls tocats: els que han sortit al diari, en l'ordre en què s'hi van veure.
  const seen: string[] = [];
  for (const e of es) {
    const id = e.kind === 'module' && typeof e.data?.id === 'string' ? e.data.id : e.module;
    if (id && !seen.includes(id)) seen.push(id);
  }
  const mods = seen.map(id => {
    const m = lib.library[id];
    return { id, title: m?.pack.title ?? id, status: m ? STATUS_LABEL[m.status] : 'desconegut', notionUrl: m?.pack.notionUrl };
  });
  if (mods.length) {
    out.push('## Mòduls', ...mods.map(m => `- **${m.title}** — ${m.status.toLowerCase()}${m.notionUrl ? ` · ${m.notionUrl}` : ''}`), '');
  }

  out.push('## Cronologia', ...es.filter(e => e.kind !== 'note').map(e => `- [x] ${line(e)}`), '');

  const combats = es.filter(e => e.kind === 'combat' && e.data?.ended);
  if (combats.length) out.push('## Combats', ...combats.map(e => `- ${line(e)}`), '');
  const xp = es.filter(e => e.kind === 'xp');
  if (xp.length) out.push('## Experiència', ...xp.map(e => `- ${line(e)}`), '');
  const notes = es.filter(e => e.kind === 'note');
  if (notes.length) out.push('## Notes del DM', ...notes.map(e => `- ${hhmm(e.t)} — ${e.text}`), '');

  const json = {
    name: sessionName(s), startedAt: new Date(s.startedAt).toISOString(), endedAt: new Date(end).toISOString(),
    durationMin: Math.round((end - s.startedAt) / 60000),
    modules: mods,
    combats: combats.map(e => ({ at: hhmm(e.t), text: e.text, ...e.data })),
    xp: xp.map(e => ({ at: hhmm(e.t), text: e.text, ...e.data })),
    notes: notes.map(e => ({ at: hhmm(e.t), text: e.text })),
    timeline: es.filter(e => e.kind !== 'note').map(e => `${hhmm(e.t)} ${e.kind}: ${e.text}`),
  };
  out.push('<!-- rpg-session-log: bloc per a Claude (passar a la pàgina de sessió de Notion) -->', '```json', JSON.stringify(json, null, 2), '```', '');
  return out.join('\n');
}
