/**
 * Fitxes de personatge i experiència (v4.67). Les fitxes viuen a la API (`/characters`); aquí hi
 * ha el format de la part opaca (`sheet`), la taula de nivells de D&D 5e, com es relaciona un
 * jugador del mapa amb la seva fitxa i el que viatja a les pantalles de jugador (`SheetShow`).
 */
import type { ApiCharacter } from '@/lib/api';
import type { Player, SheetShow } from '@/types';
import type { Monster } from '@/lib/monsters';
import type { MonsterPower } from '@/lib/monster-powers';

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
  /**
   * Atacs estructurats (menú «Atacs» del token, amb l'abast al mapa). Absent = es llegeixen
   * del text de la secció «Atacs» (`parseAttacks`); l'editor del back office els desa aquí.
   */
  attacks?: SheetAttack[];
  /**
   * Munició que es gasta en disparar (fletxes, virotes…): una pila per tipus. Un atac amb
   * `ammo: 'Fletxes'` en gasta una de la pila d'aquest nom cada cop que s'apunta a un objectiu.
   * Una pila que no hi és = sense control (munició il·limitada).
   */
  ammo?: AmmoStack[];
  /**
   * Habilitats i poders que surten al menú del token (Canalizar Divinidad, Oleada de Acción…): el
   * mateix format que els poders de les criatures (`MonsterPower`, amb `def`); `rest` = quan es recuperen.
   */
  powers?: MonsterPower[];
}

export interface AmmoStack { name: string; count: number }

// ── Atacs (només informació: l'app mesura l'abast, els daus es tiren a la taula) ──────────

export type DamageType =
  | 'acid' | 'bludgeoning' | 'cold' | 'fire' | 'force' | 'lightning' | 'necrotic'
  | 'piercing' | 'poison' | 'psychic' | 'radiant' | 'slashing' | 'thunder';

export const DAMAGE_TYPES: readonly { id: DamageType; label: string }[] = [
  { id: 'slashing', label: 'tallant' }, { id: 'piercing', label: 'perforant' }, { id: 'bludgeoning', label: 'contundent' },
  { id: 'fire', label: 'foc' }, { id: 'cold', label: 'fred' }, { id: 'lightning', label: 'llamp' },
  { id: 'thunder', label: 'tro' }, { id: 'acid', label: 'àcid' }, { id: 'poison', label: 'verí' },
  { id: 'necrotic', label: 'necròtic' }, { id: 'radiant', label: 'radiant' }, { id: 'force', label: 'força' },
  { id: 'psychic', label: 'psíquic' },
];

/** Cos a cos (abast), a distància (abast normal/llarg) o arma llançadissa (les dues coses). */
export type AttackKind = 'melee' | 'ranged' | 'thrown';

export interface SheetAttack {
  name: string;
  kind: AttackKind;
  /** Abast cos a cos en peus (cos a cos i llançadisses). Per defecte 5. */
  reachFt?: number;
  /** Abast normal i llarg en peus (a distància i llançadisses). Entre tots dos: desavantatge. */
  rangeFt?: number;
  longFt?: number;
  /** Text lliure per recordar-ho a la taula: «+5», «1d8+3». */
  bonus?: string;
  damage?: string;
  damageType?: DamageType;
  /** Nom de la pila de `sheet.ammo` que gasta cada tret (veure `spendAmmo`). */
  ammo?: string;
  /** Danys que s'hi sumen sempre que toca, cadascun amb el seu tipus (el verí d'una mossegada). */
  extra?: DamageRoll[];
  /** Danys opcionals que el DM marca a la taula si escau (Atac furtiu, Cop diví). */
  riders?: DamageRoll[];
}

/**
 * Una tirada de dany: daus («2d6», «1d8+3») i tipus. Sense tipus = el de l'arma (els opcionals
 * com l'Atac furtiu). `label` = nom que es veu al pop-up («Atac furtiu»).
 */
export interface DamageRoll { dice: string; type?: DamageType; label?: string }

const sameAmmo = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Munició que queda d'un atac: `null` si no en gasta (o la pila no hi és) = il·limitada. */
export function ammoLeft(sheet: CharacterSheet, a: Pick<SheetAttack, 'ammo'>): number | null {
  if (!a.ammo) return null;
  const st = sheet.ammo?.find(x => sameAmmo(x.name, a.ammo!));
  return st ? st.count : null;
}

/**
 * La munició d'una fitxa amb `delta` peces més (o menys) a la pila `name`, mai per sota de 0.
 * Un tret és `-1`; recollir o perdre fletxes, qualsevol quantitat. `null` = la pila no hi és.
 */
export function adjustAmmo(sheet: CharacterSheet, name: string, delta: number): AmmoStack[] | null {
  const st = sheet.ammo;
  if (!st?.some(x => sameAmmo(x.name, name))) return null;
  return st.map(x => sameAmmo(x.name, name) ? { ...x, count: Math.max(0, x.count + delta) } : x);
}

/** Abast «bo» (sense desavantatge) i llarg d'un atac, en peus. */
export function attackRanges(a: SheetAttack): { normalFt: number; longFt?: number } {
  const reach = a.kind === 'ranged' ? 0 : (a.reachFt ?? 5);
  const range = a.kind === 'melee' ? 0 : (a.rangeFt ?? 0);
  const normalFt = Math.max(reach, range) || 5;
  const longFt = a.kind !== 'melee' && a.longFt && a.longFt > normalFt ? a.longFt : undefined;
  return { normalFt, longFt };
}

const DAMAGE_WORDS: Record<string, DamageType> = Object.fromEntries(
  DAMAGE_TYPES.map(d => [d.label, d.id] as [string, DamageType])
    .concat([['llamp', 'lightning'], ['elèctric', 'lightning'], ['electric', 'lightning'], ['àcid', 'acid'], ['acid', 'acid'], ['verí', 'poison'], ['veri', 'poison']]),
);

/**
 * Llegeix els atacs del text de la secció «Atacs» (format de les fitxes del Notion):
 * «- **Arc llarg** +7 · 1d8+3 perforant (abast 150/600 peus)». Les línies sense daus de dany
 * («Conjurs d'atac», «Atac furtiu») no són atacs i se salten. «llançament a/b» = llançadissa,
 * «abast a/b» = a distància; la resta, cos a cos a 5 ft.
 */
export function parseAttacks(text: string): SheetAttack[] {
  const out: SheetAttack[] = [];
  const riders: DamageRoll[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim().replace(/^[-•*]\s*/, '');
    // «**Atac furtiu:** +1d6 amb avantatge…» = dany opcional de tots els atacs (el DM el marca).
    const rd = /^\*\*(.+?)\*\*\s*\+\s*(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*([\p{L}]+)?/u.exec(line);
    if (rd) {
      riders.push({ dice: rd[2].replace(/\s+/g, ''), label: rd[1].replace(/[:：]\s*$/, '').trim(), ...(DAMAGE_WORDS[(rd[3] ?? '').toLowerCase()] ? { type: DAMAGE_WORDS[(rd[3] ?? '').toLowerCase()] } : {}) });
      continue;
    }
    const m = /^\*\*(.+?)\*\*\s*([+-]\s*\d+)?\s*[·:,-]?\s*(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*([\p{L}]+)?(.*)$/u.exec(line);
    if (!m) continue;
    const name = m[1].replace(/[:：]\s*$/, '').trim();
    const dmgWord = (m[4] ?? '').toLowerCase();
    const rest = m[5] ?? '';
    const rng = /(llançament|abast|alcance|range)\s*(\d+)\s*\/\s*(\d+)/i.exec(rest);
    const atk: SheetAttack = {
      name, kind: 'melee', reachFt: 5,
      bonus: m[2]?.replace(/\s+/g, ''), damage: m[3].replace(/\s+/g, ''),
      damageType: DAMAGE_WORDS[dmgWord],
    };
    if (rng) {
      atk.rangeFt = parseInt(rng[2]); atk.longFt = parseInt(rng[3]);
      if (/llançament/i.test(rng[1])) atk.kind = 'thrown';
      else { atk.kind = 'ranged'; delete atk.reachFt; }
    }
    // «… 1d6+2 contundent + 1d6 foc»: danys extra amb el seu tipus.
    const extra = [...rest.matchAll(/\+\s*(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*([\p{L}]+)/gu)]
      .filter(x => DAMAGE_WORDS[x[2].toLowerCase()])
      .map(x => ({ dice: x[1].replace(/\s+/g, ''), type: DAMAGE_WORDS[x[2].toLowerCase()] }));
    if (extra.length) atk.extra = extra;
    out.push(atk);
  }
  if (riders.length) for (const a of out) a.riders = riders.map(r => ({ ...r }));
  return out;
}

/** Atacs d'una fitxa: els estructurats si n'hi ha, si no els que es llegeixen del text «Atacs». */
export function attacksOf(sheet: CharacterSheet): SheetAttack[] {
  if (sheet.attacks) return sheet.attacks.map(splitExtraDamage);
  const sec = sheet.sections?.find(s => s.title.trim().toLowerCase() === 'atacs');
  return sec ? parseAttacks(sec.text) : [];
}

// ── Danys de diversos tipus (v5.43) ───────────────────────────────────────────

const EXTRA_IN_NAME = /\s*\(\+\s*(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+([\p{L}]+)\)/gu;

/**
 * Un atac amb el dany extra escrit al nom («Mossegada (+2d6 verí)», com els desa la API, que no té
 * camp per a l'extra) → nom net i `extra`. Si ja en té o el nom no en porta, el retorna tal qual.
 */
export function splitExtraDamage(a: SheetAttack): SheetAttack {
  if (a.extra?.length || !a.name.includes('(+')) return a;
  const extra: DamageRoll[] = [];
  const name = a.name.replace(EXTRA_IN_NAME, (all, dice: string, word: string) => {
    const type = DAMAGE_WORDS[word.toLowerCase()];
    if (!type) return all;
    extra.push({ dice: dice.replace(/\s+/g, ''), type });
    return '';
  }).trim();
  return extra.length ? { ...a, name, extra } : a;
}

/** El contrari, per a la API (els atacs del bloc d'un enemic no tenen `extra` ni `riders`). */
export function foldExtraDamage(a: SheetAttack): SheetAttack {
  const { extra, riders: _r, ...rest } = a; void _r;
  if (!extra?.length) return rest;
  const tail = extra.map(r => ` (+${r.dice}${r.type ? ` ${damageLabel(r.type)}` : ''})`).join('');
  return { ...rest, name: `${rest.name}${tail}` };
}

const damageLabel = (t?: DamageType) => DAMAGE_TYPES.find(d => d.id === t)?.label ?? '';

/** Les tirades de dany que fa sempre un atac: la principal i les extra. */
export function damageRollsOf(a: SheetAttack): DamageRoll[] {
  const out: DamageRoll[] = [];
  if (a.damage || a.damageType) out.push({ dice: a.damage ?? '', type: a.damageType });
  for (const r of a.extra ?? []) out.push(r);
  return out;
}

/** Daus d'un crític: el doble de daus, el modificador igual («1d8+3» → «2d8+3»). */
export function critDice(dice: string): string {
  return dice.replace(/(\d+)d(\d+)/g, (_, n: string, f: string) => `${parseInt(n) * 2}d${f}`);
}

/** Text curt d'unes tirades: «1d10+2 perforant + 1d10 verí». */
export function rollsText(rolls: readonly DamageRoll[], crit = false): string {
  return rolls.filter(r => r.dice).map(r => `${crit ? critDice(r.dice) : r.dice}${r.type ? ` ${damageLabel(r.type)}` : r.label ? ` (${r.label})` : ''}`).join(' + ');
}

/**
 * Llegeix unes tirades escrites a mà (editor del back office): «1d6 foc, 2d8 radiant Cop diví».
 * Cada peça: daus, tipus opcional i la resta = nom. Separades per comes, punts i coma o « + ».
 */
export function parseRolls(text: string): DamageRoll[] {
  const out: DamageRoll[] = [];
  for (const raw of text.split(/[,;]|\s\+\s/)) {
    const m = /^\s*\+?\s*(\d+d\d+(?:\s*[+-]\s*\d+)?)\s*(.*)$/u.exec(raw);
    if (!m) continue;
    const words = m[2].trim().split(/\s+/).filter(Boolean);
    const type = words.length ? DAMAGE_WORDS[words[0].toLowerCase()] : undefined;
    const label = (type ? words.slice(1) : words).join(' ').replace(/^\(|\)$/g, '').trim();
    out.push({ dice: m[1].replace(/\s+/g, ''), ...(type ? { type } : {}), ...(label ? { label } : {}) });
  }
  return out;
}

/** El contrari de `parseRolls` (per omplir el camp de l'editor). */
export function rollsInput(rolls: readonly DamageRoll[] | undefined): string {
  return (rolls ?? []).map(r => [r.dice, r.type ? damageLabel(r.type) : '', r.label ?? ''].filter(Boolean).join(' ')).join(', ');
}

/**
 * Bonus d'atac i CD dels conjurs d'un jugador, llegits de la fitxa («Conjurs d'atac: bonus +5 · CD
 * de salvació 13», a qualsevol secció). `null` si no en té.
 */
export function spellcastingOf(sheet: CharacterSheet): { attack?: number; dc?: number } | null {
  for (const sec of sheet.sections ?? []) {
    const m = /conjurs[^\n]*?bonus\s*([+-]\s*\d+)[^\n]*?CD[^\d\n]*(\d+)/i.exec(sec.text);
    if (m) return { attack: parseInt(m[1].replace(/\s+/g, '')), dc: parseInt(m[2]) };
  }
  return null;
}

/** Seccions que s'ofereixen en una fitxa nova (el DM en pot afegir o treure). */
/**
 * Seccions només per al DM: el títol comença per «Només DM». Mai viatgen a les pantalles de
 * jugador (`buildSheetShow` les treu encara que se'n demanin) ni surten al panell «Fitxa» per
 * triar què s'ensenya. Per apuntar-hi secrets de la fitxa (coses encara no públiques).
 */
export const isPrivateSection = (title: string) => /^només dm/i.test(title.trim());

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
    sections: (sh.sections ?? []).filter(s => !isPrivateSection(s.title) && parts.includes(s.title) && s.text.trim()),
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

/** Bonificació de salvació d'una fitxa: modificador + competència si la té marcada. Null sense dades. */
export function sheetSave(sheet: CharacterSheet, ab: AbilityId, level: number): number | null {
  const score = sheet.abilities?.[ab];
  if (score === undefined) return null;
  const prof = parseInt((sheet.profBonus ?? '').replace(/[^-\d]/g, '')) || (2 + Math.floor((Math.max(1, level) - 1) / 4));
  return abilityMod(score) + (sheet.saves?.includes(ab) ? prof : 0);
}

/**
 * La fitxa d'un jugador com a bloc d'estadístiques (el mateix `Monster` que fan servir els enemics),
 * per al «Fitxa 5e» plegable del menú del seu token (`MonsterBlock`): CA, velocitat, característiques,
 * salvacions amb competència, atacs i trets. Les característiques només hi són si la fitxa en té
 * les sis; `cr` porta el nivell (`Nv 3`) perquè no és un valor de repte.
 */
export function monsterFromCharacter(c: ApiCharacter): Monster {
  const sh = sheetOf(c);
  const scores = ABILITIES.map(a => sh.abilities?.[a.id]);
  const abilities = scores.every((v): v is number => typeof v === 'number')
    ? (scores as unknown as Monster['abilities']) : undefined;
  const saves: Partial<Record<AbilityId, number>> = {};
  for (const id of sh.saves ?? []) {
    const v = sheetSave(sh, id, c.level);
    if (v !== null) saves[id] = v;
  }
  const traits = (sh.sections?.find(s => s.title.trim().toLowerCase() === 'trets')?.text ?? '')
    .split('\n').map(l => l.replace(/\*\*/g, '').replace(/^[-•*\s]+/, '').trim()).filter(Boolean).slice(0, 8);
  return {
    name: [c.className, c.race].filter(Boolean).join(' · ') || c.name,
    cr: `Nv ${c.level}`, hp: c.hpMax, ac: c.ac, speed: c.speed,
    ...(abilities ? { abilities } : {}), ...(Object.keys(saves).length ? { saves } : {}),
    attacks: attacksOf(sh), ...(traits.length ? { traits } : {}),
  };
}
