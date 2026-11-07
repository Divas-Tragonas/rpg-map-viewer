/**
 * Poders de les criatures (v5 snapshot 9): els encanteris i les accions especials (alès, mirades,
 * xiscles, raigs oculars…) que fan servir els enemics i aliats des del menú del token, com el
 * grimori de Liriandor o de Yunquerin.
 *
 *  - `SPELL_CATALOG`: cada encanteri que tenen els monstres del bestiari (pel nom anglès de 5e.tools)
 *    amb l'animació (`anim`, un `SpellType`), el gest, l'abast i l'efecte de 5e (`fx`, el mateix
 *    `SpellEffect` que les màgies dels jugadors). `fx: null` = només l'animació (sense pop-up).
 *  - `MonsterPower` (dins de cada bloc de `MONSTERS`): un encanteri del catàleg amb la CD i el bonus
 *    d'atac del monstre, o una acció pròpia amb el seu efecte (generat de 5e.tools).
 * L'app no tira res: el pop-up proposa els afectats, la salvació i els estats, i el DM hi posa el dany.
 */
import type { SpellType } from '@/types';
import type { SpellEffect } from '@/lib/rules/spell-effects';

export interface PowerDef {
  /** Nom en català. */
  ca: string;
  anim: SpellType;
  /** `line` = apuntar a un objectiu o direcció; `area` = un punt dins d'abast; `self` = surt del llançador. */
  mode: 'line' | 'area' | 'self';
  rangeFt: number;
  /** Radi de l'àrea (per a l'apuntat i l'animació). */
  aoeFt?: number;
  /** Longitud fixa d'un con o una línia que surt del llançador (alès). */
  lineFt?: number;
  fx: SpellEffect | null;
  /** Dany o cura orientatius (el que es tira a la taula). */
  dice?: string;
}

const single = (o: Partial<SpellEffect> = {}): SpellEffect => ({ shape: 'single', ...o });

export const SPELL_CATALOG: Record<string, PowerDef> = {
  // ── Trucs ─────────────────────────────────────────────────────────────────────────────
  'dancing lights':   { ca: 'Llums dansants', anim: 'light', mode: 'area', rangeFt: 120, fx: null },
  'druidcraft':       { ca: 'Druidisme', anim: 'prestidigitation', mode: 'area', rangeFt: 30, fx: null },
  'fire bolt':        { ca: 'Raig de foc', anim: 'fire_bolt', mode: 'line', rangeFt: 120, fx: single({ damageType: 'fire' }), dice: '1d10' },
  'light':            { ca: 'Llum', anim: 'light', mode: 'area', rangeFt: 5, fx: null },
  'mage hand':        { ca: 'Mà de mag', anim: 'mage_hand', mode: 'area', rangeFt: 30, fx: null },
  'mending':          { ca: 'Reparar', anim: 'prestidigitation', mode: 'area', rangeFt: 5, fx: null },
  'minor illusion':   { ca: 'Il·lusió menor', anim: 'prestidigitation', mode: 'area', rangeFt: 30, fx: null },
  'prestidigitation': { ca: 'Prestidigitació', anim: 'prestidigitation', mode: 'area', rangeFt: 10, fx: null },
  'produce flame':    { ca: 'Produir flama', anim: 'fire_bolt', mode: 'line', rangeFt: 30, fx: single({ damageType: 'fire' }), dice: '1d8' },
  'ray of frost':     { ca: 'Raig de gebre', anim: 'ray_of_frost', mode: 'line', rangeFt: 60, fx: single({ damageType: 'cold' }), dice: '1d8' },
  'sacred flame':     { ca: 'Flama sagrada', anim: 'sacred_flame', mode: 'area', rangeFt: 60, fx: single({ damageType: 'radiant', save: 'dex' }), dice: '1d8' },
  'shillelagh':       { ca: 'Shillelagh', anim: 'vanish', mode: 'self', rangeFt: 0, fx: null },
  'shocking grasp':   { ca: 'Toc electritzant', anim: 'shocking_grasp', mode: 'line', rangeFt: 5, fx: single({ damageType: 'lightning' }), dice: '1d8' },
  'thaumaturgy':      { ca: 'Taumatúrgia', anim: 'thaumaturgy', mode: 'self', rangeFt: 0, fx: null },
  'thorn whip':       { ca: 'Fuet d\'espines', anim: 'entangle', mode: 'line', rangeFt: 30, fx: single({ damageType: 'piercing' }), dice: '1d6' },
  'vicious mockery':  { ca: 'Burla viciosa', anim: 'hold', mode: 'line', rangeFt: 60, fx: single({ damageType: 'psychic', save: 'wis' }), dice: '1d4' },
  // ── Nivell 1 ──────────────────────────────────────────────────────────────────────────
  'animal messenger': { ca: 'Missatger animal', anim: 'prestidigitation', mode: 'area', rangeFt: 30, fx: null },
  'burning hands':    { ca: 'Mans ardents', anim: 'burning_hands', mode: 'line', rangeFt: 15, lineFt: 15, fx: { shape: 'cone', sizeFt: 15, damageType: 'fire', save: 'dex', half: true }, dice: '3d6' },
  'charm person':     { ca: 'Encisar persona', anim: 'charm_person', mode: 'line', rangeFt: 30, fx: single({ save: 'wis', conditions: ['charmed'] }) },
  'command':          { ca: 'Ordre', anim: 'hold', mode: 'line', rangeFt: 60, fx: single({ save: 'wis', conditions: ['prone'] }) },
  'cure wounds':      { ca: 'Curar ferides', anim: 'cure_wounds', mode: 'line', rangeFt: 5, fx: single({ heal: true }), dice: '1d8 + mod.' },
  'detect evil and good': { ca: 'Detectar el bé i el mal', anim: 'detect_magic', mode: 'self', rangeFt: 0, fx: null },
  'detect magic':     { ca: 'Detectar màgia', anim: 'detect_magic', mode: 'self', rangeFt: 0, fx: null },
  'disguise self':    { ca: 'Disfressar-se', anim: 'vanish', mode: 'self', rangeFt: 0, fx: null },
  'entangle':         { ca: 'Enredar', anim: 'entangle', mode: 'area', rangeFt: 90, aoeFt: 10, fx: { shape: 'circle', sizeFt: 10, save: 'str', conditions: ['restrained'], rounds: 10 } },
  'faerie fire':      { ca: 'Foc feèric', anim: 'radiant_bolt', mode: 'area', rangeFt: 60, aoeFt: 10, fx: null },
  'fog cloud':        { ca: 'Núvol de boira', anim: 'cloud', mode: 'area', rangeFt: 120, aoeFt: 20, fx: null },
  'guiding bolt':     { ca: 'Projectil guia', anim: 'radiant_bolt', mode: 'line', rangeFt: 120, fx: single({ damageType: 'radiant' }), dice: '4d6' },
  'longstrider':      { ca: 'Gambada llarga', anim: 'vanish', mode: 'self', rangeFt: 0, fx: null },
  'mage armor':       { ca: 'Armadura de mag', anim: 'mage_armor', mode: 'line', rangeFt: 5, fx: single({ buff: 'mage_armor', conditions: ['mage_armored'] }) },
  'magic missile':    { ca: 'Projectil màgic', anim: 'magic_missile', mode: 'line', rangeFt: 120, fx: single({ damageType: 'force' }), dice: '3d4+3' },
  'sanctuary':        { ca: 'Santuari', anim: 'bless', mode: 'line', rangeFt: 30, fx: null },
  'shield':           { ca: 'Escut', anim: 'shield', mode: 'self', rangeFt: 0, fx: { shape: 'self', buff: 'shield', rounds: 1, conditions: ['shielded'] } },
  'shield of faith':  { ca: 'Escut de fe', anim: 'bless', mode: 'line', rangeFt: 60, fx: null },
  'sleep':            { ca: 'Dormir', anim: 'sleep', mode: 'area', rangeFt: 90, aoeFt: 20, fx: { shape: 'circle', sizeFt: 20, conditions: ['unconscious'], rounds: 10, endsOnDamage: true } },
  'speak with animals': { ca: 'Parlar amb els animals', anim: 'prestidigitation', mode: 'self', rangeFt: 0, fx: null },
  'thunderwave':      { ca: 'Ona atronadora', anim: 'thunder', mode: 'self', rangeFt: 0, aoeFt: 10, fx: { shape: 'aura', sizeFt: 10, damageType: 'thunder', save: 'con', half: true }, dice: '2d8' },
  // ── Nivell 2 ──────────────────────────────────────────────────────────────────────────
  'barkskin':         { ca: 'Pell d\'escorça', anim: 'vanish', mode: 'self', rangeFt: 0, fx: null },
  'darkness':         { ca: 'Foscor', anim: 'cloud', mode: 'area', rangeFt: 60, aoeFt: 15, fx: null },
  'detect thoughts':  { ca: 'Detectar pensaments', anim: 'detect_magic', mode: 'self', rangeFt: 0, fx: null },
  'heat metal':       { ca: 'Escalfar metall', anim: 'fire_bolt', mode: 'line', rangeFt: 60, fx: single({ damageType: 'fire' }), dice: '2d8' },
  'hold person':      { ca: 'Immobilitzar persona', anim: 'hold', mode: 'line', rangeFt: 60, fx: single({ save: 'wis', conditions: ['paralyzed'], rounds: 10 }) },
  'invisibility':     { ca: 'Invisibilitat', anim: 'vanish', mode: 'self', rangeFt: 0, fx: { shape: 'self', conditions: ['invisible'] } },
  'lesser restoration': { ca: 'Restabliment menor', anim: 'cure_wounds', mode: 'line', rangeFt: 5, fx: null },
  "melf's acid arrow": { ca: 'Fletxa àcida de Melf', anim: 'acid_arrow', mode: 'line', rangeFt: 90, fx: single({ damageType: 'acid' }), dice: '4d4 (+2d4 al torn següent)' },
  'mirror image':     { ca: 'Imatge mirall', anim: 'vanish', mode: 'self', rangeFt: 0, fx: null },
  'misty step':       { ca: 'Passa boirosa', anim: 'vanish', mode: 'self', rangeFt: 0, fx: null },
  'phantasmal force': { ca: 'Força fantasmal', anim: 'hold', mode: 'line', rangeFt: 60, fx: single({ damageType: 'psychic', save: 'int' }), dice: '1d6' },
  'silence':          { ca: 'Silenci', anim: 'cloud', mode: 'area', rangeFt: 120, aoeFt: 20, fx: null },
  'spike growth':     { ca: 'Creixement d\'espines', anim: 'entangle', mode: 'area', rangeFt: 150, aoeFt: 20, fx: null },
  'spiritual weapon': { ca: 'Arma espiritual', anim: 'radiant_bolt', mode: 'line', rangeFt: 60, fx: single({ damageType: 'force' }), dice: '1d8 + mod.' },
  'suggestion':       { ca: 'Suggeriment', anim: 'hold', mode: 'line', rangeFt: 30, fx: null },
  // ── Nivell 3 ──────────────────────────────────────────────────────────────────────────
  'animate dead':     { ca: 'Animar els morts', anim: 'necrotic_ray', mode: 'line', rangeFt: 10, fx: null },
  'conjure animals':  { ca: 'Conjurar animals', anim: 'vanish', mode: 'area', rangeFt: 60, fx: null },
  'counterspell':     { ca: 'Contraconjur', anim: 'eye_ray', mode: 'line', rangeFt: 60, fx: null },
  'dispel magic':     { ca: 'Dissipar màgia', anim: 'prestidigitation', mode: 'line', rangeFt: 120, fx: null },
  'fireball':         { ca: 'Bola de foc', anim: 'fireball', mode: 'area', rangeFt: 150, aoeFt: 20, fx: { shape: 'circle', sizeFt: 20, damageType: 'fire', save: 'dex', half: true }, dice: '8d6' },
  'fly':              { ca: 'Volar', anim: 'vanish', mode: 'self', rangeFt: 0, fx: null },
  'gaseous form':     { ca: 'Forma gasosa', anim: 'vanish', mode: 'self', rangeFt: 0, fx: null },
  'plant growth':     { ca: 'Creixement vegetal', anim: 'entangle', mode: 'area', rangeFt: 150, aoeFt: 20, fx: null },
  'spirit guardians': { ca: 'Esperits guardians', anim: 'dread', mode: 'self', rangeFt: 0, aoeFt: 15, fx: { shape: 'aura', sizeFt: 15, damageType: 'radiant', save: 'wis', half: true }, dice: '3d8' },
  // ── Nivell 4 ──────────────────────────────────────────────────────────────────────────
  'blight':           { ca: 'Marcir', anim: 'necrotic_ray', mode: 'line', rangeFt: 30, fx: single({ damageType: 'necrotic', save: 'con', half: true }), dice: '8d8' },
  'confusion':        { ca: 'Confusió', anim: 'eye_ray', mode: 'area', rangeFt: 90, aoeFt: 10, fx: null },
  'dimension door':   { ca: 'Porta dimensional', anim: 'vanish', mode: 'self', rangeFt: 0, fx: null },
  'divination':       { ca: 'Endevinació', anim: 'detect_magic', mode: 'self', rangeFt: 0, fx: null },
  'guardian of faith': { ca: 'Guardià de la fe', anim: 'radiant_bolt', mode: 'area', rangeFt: 30, fx: null },
  'polymorph':        { ca: 'Polimorfar', anim: 'hold', mode: 'line', rangeFt: 60, fx: null },
  // ── Nivell 5+ ─────────────────────────────────────────────────────────────────────────
  'cloudkill':        { ca: 'Núvol mortal', anim: 'cloud', mode: 'area', rangeFt: 120, aoeFt: 20, fx: { shape: 'circle', sizeFt: 20, damageType: 'poison', save: 'con', half: true }, dice: '5d8' },
  'cone of cold':     { ca: 'Con de fred', anim: 'breath_cold', mode: 'line', rangeFt: 60, lineFt: 60, fx: { shape: 'cone', sizeFt: 60, damageType: 'cold', save: 'con', half: true }, dice: '8d8' },
  'contagion':        { ca: 'Contagi', anim: 'necrotic_ray', mode: 'line', rangeFt: 5, fx: single({ conditions: ['poisoned'] }) },
  'dominate monster': { ca: 'Dominar monstre', anim: 'hold', mode: 'line', rangeFt: 60, fx: single({ save: 'wis', conditions: ['charmed'] }) },
  'insect plague':    { ca: 'Plaga d\'insectes', anim: 'cloud', mode: 'area', rangeFt: 300, aoeFt: 20, fx: { shape: 'circle', sizeFt: 20, damageType: 'piercing', save: 'con', half: true }, dice: '4d10' },
  'scrying':          { ca: 'Escrutar', anim: 'detect_magic', mode: 'self', rangeFt: 0, fx: null },
  'disintegrate':     { ca: 'Desintegrar', anim: 'eye_ray', mode: 'line', rangeFt: 60, fx: single({ damageType: 'force', save: 'dex' }), dice: '10d6+40' },
  'globe of invulnerability': { ca: 'Globus d\'invulnerabilitat', anim: 'shield', mode: 'self', rangeFt: 0, fx: null },
  'harm':             { ca: 'Danyar', anim: 'necrotic_ray', mode: 'line', rangeFt: 60, fx: single({ damageType: 'necrotic', save: 'con', half: true }), dice: '14d6' },
  'finger of death':  { ca: 'Dit de la mort', anim: 'necrotic_ray', mode: 'line', rangeFt: 60, fx: single({ damageType: 'necrotic', save: 'con', half: true }), dice: '7d8+30' },
  'plane shift':      { ca: 'Canvi de pla', anim: 'vanish', mode: 'line', rangeFt: 5, fx: null },
  'power word stun':  { ca: 'Paraula de poder: atordir', anim: 'hold', mode: 'line', rangeFt: 60, fx: single({ conditions: ['stunned'] }) },
  'power word kill':  { ca: 'Paraula de poder: matar', anim: 'necrotic_ray', mode: 'line', rangeFt: 60, fx: null },
};

/** Normalitza un nom d'encanteri de 5e.tools («faerie fire (save 12)» → «faerie fire»). */
export const catalogKey = (name: string) => name.toLowerCase().replace(/\s*\(.*\)\s*$/, '').trim();

/** Un poder d'un monstre: un encanteri del catàleg o una acció pròpia (generat de 5e.tools). */
export interface MonsterPower {
  id: string;
  /** Nom en català (si no, el del catàleg). */
  name?: string;
  /** Encanteri del catàleg (nom anglès normalitzat). */
  spell?: string;
  /** Acció pròpia: la seva definició (alès, mirades, xiscles…). */
  def?: PowerDef;
  /** CD i bonus d'atac del monstre per a aquest poder. */
  dc?: number;
  attack?: number;
  /** 0 = truc, 1–9 = nivell, absent = acció. */
  level?: number;
  /** Recàrrega (5 = 5–6 en un d6) i usos per dia. */
  recharge?: number;
  perDay?: number;
  /** Encanteri innat a voluntat. */
  atWill?: boolean;
}

/** Definició efectiva d'un poder (la seva o la del catàleg). Null si l'encanteri no és al catàleg. */
export function powerDef(p: MonsterPower): PowerDef | null {
  return p.def ?? (p.spell ? SPELL_CATALOG[p.spell] ?? null : null);
}

export const powerName = (p: MonsterPower) => p.name ?? powerDef(p)?.ca ?? p.spell ?? p.id;
