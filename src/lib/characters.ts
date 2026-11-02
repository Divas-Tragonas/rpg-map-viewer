/**
 * Fitxes de personatge i experiència (v4.67). Les fitxes viuen a la API (`/characters`); aquí hi
 * ha el format de la part opaca (`sheet`), la taula de nivells de D&D 5e, com es relaciona un
 * jugador del mapa amb la seva fitxa i el que viatja a les pantalles de jugador (`SheetShow`).
 */
import type { ApiCharacter } from '@/lib/api';
import type { Player, SheetShow } from '@/types';

export type AbilityId = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export const ABILITIES: readonly { id: AbilityId; label: string }[] = [
  { id: 'str', label: 'FUE' }, { id: 'dex', label: 'DES' }, { id: 'con', label: 'CON' },
  { id: 'int', label: 'INT' }, { id: 'wis', label: 'SAB' }, { id: 'cha', label: 'CAR' },
];

/** Una secció de text de la fitxa. Línies amb «- » = llista; `**text**` = negreta. */
export interface SheetSection { title: string; text: string }

/**
 * Part opaca de la fitxa (`ApiCharacter.sheet`): la API no la mira, o sigui que es pot ampliar
 * sense tocar-la. Tot és opcional (una fitxa nova és `{}`).
 */
export interface CharacterSheet {
  background?: string;
  alignment?: string;
  initiative?: string;
  profBonus?: string;
  hitDie?: string;
  abilities?: Partial<Record<AbilityId, number>>;
  /** Tirades de salvació amb competència. */
  saves?: AbilityId[];
  sections?: SheetSection[];
}

/** Seccions que s'ofereixen en una fitxa nova (el DM en pot afegir o treure). */
export const DEFAULT_SECTIONS = ['Habilitats', 'Atacs', 'Màgia', 'Equip', 'Trets', 'Idiomes i competències', 'Personalitat', 'Trasfons'];

export function sheetOf(c: Pick<ApiCharacter, 'sheet'>): CharacterSheet {
  return (c.sheet ?? {}) as CharacterSheet;
}

export const abilityMod = (score: number) => Math.floor((score - 10) / 2);
export const signed = (n: number) => (n >= 0 ? `+${n}` : String(n));

// ── Experiència (taula de D&D 5e) ─────────────────────────────────────────────

/** XP mínima de cada nivell (índex 0 = nivell 1). */
export const XP_TABLE = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000] as const;

/** Nivell que correspon a una XP (1–20). */
export function levelForXp(xp: number): number {
  let lv = 1;
  for (let i = 1; i < XP_TABLE.length; i++) if (xp >= XP_TABLE[i]) lv = i + 1;
  return lv;
}

/**
 * Progrés cap al nivell següent, a partir del nivell DESAT (el DM confirma les pujades: una
 * fitxa pot tenir més XP de la que toca al seu nivell). `next` = null al nivell 20.
 */
export function xpProgress(xp: number, level: number): { from: number; next: number | null; frac: number } {
  const lv = Math.max(1, Math.min(20, level));
  const from = XP_TABLE[lv - 1];
  const next = lv < 20 ? XP_TABLE[lv] : null;
  const frac = next === null ? 1 : Math.max(0, Math.min(1, (xp - from) / (next - from)));
  return { from, next, frac };
}

/** Nivell al qual ja pot pujar (null si encara no en té prou). */
export function levelUpTo(c: Pick<ApiCharacter, 'xp' | 'level'>): number | null {
  const lv = levelForXp(c.xp);
  return lv > c.level ? lv : null;
}

/** Repartiment a parts iguals; el que sobra va als primers (així la suma és el total). */
export function splitXp(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n), extra = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

// ── Jugador del mapa ↔ fitxa ──────────────────────────────────────────────────

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const firstName = (s: string) => norm(s).split(/\s+/)[0] ?? '';

/**
 * La fitxa d'un jugador del mapa: la que s'ha triat a mà (`characterId`) o, si no, la que té el
 * mateix primer nom (com el grimori: «Liriandor» ↔ «Liriandor Líadon»). `null` si no en té.
 */
export function characterFor(p: Pick<Player, 'name' | 'characterId'>, chars: readonly ApiCharacter[]): ApiCharacter | null {
  if (p.characterId) return chars.find(c => c.id === p.characterId) ?? null;
  const fn = firstName(p.name);
  if (!fn) return null;
  return chars.find(c => firstName(c.name) === fn) ?? null;
}

/** La fitxa d'una llista amb el mateix nom (sense accents ni majúscules): per no importar-la dues vegades. */
export function sameCharacter(a: string, b: string): boolean {
  return norm(a) === norm(b);
}

// ── Fitxa a les pantalles de jugador ──────────────────────────────────────────

/** Parts de la fitxa que es poden ensenyar: les estadístiques (sempre) i cada secció. */
export const STATS_PART = 'Característiques';

/**
 * El que viatja a les pantalles (`SheetShow`, camp `sheet` del STATE): una foto de la fitxa
 * amb només les parts triades. `color` i `sprite` del token, perquè el retrat lligui amb el mapa.
 */
export function buildSheetShow(c: ApiCharacter, parts: readonly string[], look: { color?: string; sprite?: string; portrait?: string } = {}): SheetShow {
  const sh = sheetOf(c);
  const { next } = xpProgress(c.xp, c.level);
  return {
    id: c.id,
    name: c.name,
    subtitle: [c.className && `${c.className}`, c.race, sh.background, sh.alignment].filter(Boolean).join(' · '),
    level: c.level,
    xp: c.xp,
    xpFrom: XP_TABLE[Math.max(0, Math.min(19, c.level - 1))],
    xpNext: next,
    stats: [
      { label: 'CA', value: String(c.ac) },
      { label: 'PV', value: String(c.hpMax) },
      { label: 'VEL', value: `${c.speed} ft` },
      { label: 'PERCEP.', value: String(c.passivePerception) },
      ...(sh.initiative ? [{ label: 'INIC.', value: sh.initiative }] : []),
    ],
    abilities: parts.includes(STATS_PART) && sh.abilities
      ? ABILITIES.filter(a => typeof sh.abilities?.[a.id] === 'number').map(a => ({ label: a.label, score: sh.abilities![a.id]!, save: !!sh.saves?.includes(a.id) }))
      : [],
    sections: (sh.sections ?? []).filter(s => parts.includes(s.title) && s.text.trim()),
    color: look.color ?? '#c9a227',
    sprite: look.sprite,
    portrait: look.portrait || c.portrait || undefined,
  };
}

/** Peces d'una línia amb negretes (`**text**`). */
export function boldParts(line: string): { text: string; bold: boolean }[] {
  return line.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(t =>
    t.startsWith('**') && t.endsWith('**') ? { text: t.slice(2, -2), bold: true } : { text: t, bold: false });
}
