/**
 * Estadístiques de D&D 5e de cada criatura del Bestiari Oryx (v4.68): amb quin monstre oficial
 * es juga cada figureta, el seu valor de desafiament (VD), l'XP que dona i la vida mitjana del
 * bloc d'estadístiques. Quan l'aventura de la campanya (La mina perduda de Phandelver) té el
 * monstre, es fa servir el seu (goblin, hobgoblin, llop, zombi, esquelet, espectador, aranya
 * gegant, gelatina ocre, estirge, espectre, drac verd jove = Venomfang, Nezznar…); si no, el del
 * Manual de monstres. Les figuretes sense monstre exacte (gòlem de gel, arnes, escarabats) fan
 * servir el més semblant: el DM ho pot canviar al menú del token.
 */
import { PARTY_CREATURES } from '@/lib/sprites/manifest';
import { CP_INFO } from '@/lib/sprites/cp-creatures';
import { MONSTERS, type Monster } from '@/lib/monsters';

/** XP per valor de desafiament (Manual del DM, taula «Experience Points by Challenge Rating»). */
export const XP_BY_CR: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000,
  '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000,
};

/** Monstre (`MONSTERS`) amb què es juga cada figureta del paquet Oryx. */
const S: Record<string, string> = {
  // Gent
  wizard: 'evil_mage',
  cultist: 'cultist',
  knight: 'knight',
  archer: 'scout',
  priest: 'priest',
  barbarian_m: 'berserker',
  barbarian_f: 'berserker',
  thief: 'bandit',
  druid: 'druid',
  helion: 'priest',
  necromancer: 'evil_mage',
  warrior_m: 'guard',
  warrior_f: 'guard',
  minstrel_m: 'commoner',
  minstrel_f: 'commoner',
  paladin: 'knight',
  dknight: 'knight',
  templar: 'veteran',
  witch: 'green_hag',
  monk: 'martial_adept',
  warden: 'thug',
  prisoner_a: 'commoner',
  prisoner_b: 'commoner',
  prisoner_c: 'commoner',
  elf: 'scout',
  elf_wizard: 'apprentice',
  elf_bowman: 'scout',
  drow: 'drow',
  drow_wizard: 'nezznar',
  drow_bowman: 'drow',
  dwarf: 'guard',
  dwarf_cleric: 'priest',
  dwarf_mage: 'apprentice',
  halfling_thief: 'bandit',
  halfling_sling: 'bandit',
  halfling_fighter: 'guard',
  halfling_wizard: 'apprentice',
  valkyrie_a: 'gladiator',
  valkyrie_b: 'gladiator',
  lord_a: 'noble',
  lady_a: 'noble',
  lord_b: 'noble',
  lady_b: 'noble',
  merchant_a: 'commoner',
  merchant_b: 'commoner',
  // Goblinoides, orcs i gegants
  goblin: 'goblin',
  goblin_warrior: 'hobgoblin',
  goblin_shaman: 'goblin_boss',
  troll: 'troll',
  ogre: 'ogre',
  ogre_mystic: 'oni',
  minotaur: 'minotaur',
  lizardman_green: 'lizardfolk',
  lizardman_green_spear: 'lizardfolk',
  lizardman_green_shaman: 'lizardfolk_shaman',
  lizardman_blue: 'lizardfolk',
  lizardman_blue_spear: 'lizardfolk',
  lizardman_blue_shaman: 'lizardfolk_shaman',
  // Morts vivents
  skeleton: 'skeleton',
  skeleton_warrior: 'skeleton',
  skeleton_mage: 'skeleton',
  skeleton_archer: 'skeleton',
  zombie_a: 'zombie',
  zombie_b: 'zombie',
  banshee: 'banshee',
  vampire: 'vampire_spawn',
  vampire_lord: 'vampire',
  lich: 'lich',
  wraith_a: 'wraith',
  wraith_b: 'specter',
  wraith_c: 'shadow',
  mummy: 'mummy',
  mummy_pharoah: 'mummy_lord',
  spirit: 'specter',
  spirit_greater: 'ghost',
  // Bèsties
  bat_giant: 'giant_bat',
  bat: 'bat',
  spider_brown_giant: 'giant_wolf_spider',
  spider_brown: 'spider',
  spider_black_giant: 'giant_spider',
  spider_black: 'spider',
  rat: 'rat',
  rat_giant: 'giant_rat',
  snake_giant: 'giant_poisonous_snake',
  snake: 'poisonous_snake',
  wolf_black: 'wolf',
  wolf_red: 'dire_wolf',
  bird_dove: 'raven',
  bird_hawk: 'hawk',
  bird_crow: 'raven',
  beetle_giant: 'giant_fire_beetle',
  beetle_fire_giant: 'giant_fire_beetle',
  beetle: 'beetle',
  beetle_fire: 'beetle',
  moth_white: 'stirge',
  moth_red: 'stirge',
  moth_black: 'stirge',
  toad_green: 'giant_frog',
  toad_blue: 'giant_frog',
  toad_horned: 'giant_toad',
  flies: 'insect_swarm',
  worm: 'grick',
  worm_giant: 'purple_worm',
  // Persones dels paquets de CraftPix (`cp_*`); els animals i les plantes no tenen bloc de 5e al repertori
  cp_monk1: 'commoner', cp_monk2: 'commoner', cp_monk3: 'commoner', cp_monk4: 'commoner', cp_priest: 'priest',
  cp_citizen1: 'commoner', cp_citizen2: 'commoner', cp_fighter: 'guard',
  // Aberracions, llimes i altres
  beholder: 'spectator',
  beholder_deep: 'beholder',
  slime_green: 'gray_ooze',
  slime_purple: 'black_pudding',
  slime_red: 'ochre_jelly',
  mimic: 'mimic',
  pixie_a: 'pixie',
  pixie_b: 'pixie',
  wisp_ancient: 'will_o_wisp',
  wisp: 'will_o_wisp',
  demon_red: 'vrock',
  demon_blue: 'hezrou',
  demon_green: 'glabrezu',
  // Dracs (joves)
  dragon_shadow: 'young_black_dragon',
  dragon_red: 'young_red_dragon',
  dragon_blue: 'young_blue_dragon',
  dragon_green: 'young_green_dragon',
  // Gòlems i elementals
  golem_stone: 'stone_golem',
  golem_fire: 'fire_elemental',
  golem_mud: 'clay_golem',
  golem_ice: 'flesh_golem',
  golem_metal: 'iron_golem',
  elemental_vorpal: 'invisible_stalker',
  elemental_water: 'water_elemental',
  elemental_fire: 'fire_elemental',
  elemental_air: 'air_elemental',
  elemental_earth: 'earth_elemental',
};

export interface CreatureStats { as: string; cr: string; xp: number; hp: number }

/** Bloc del monstre amb què es juga una criatura del paquet (pel nom, sense la variant de color). */
export function creatureMonster(name: string): Monster | null {
  const id = S[name.split('~')[0]];
  return id ? MONSTERS[id] ?? null : null;
}

/** Estadístiques d'una criatura del paquet (pel nom, sense la variant de color). Null si no en té. */
export function creatureStats(name: string): CreatureStats | null {
  const mo = creatureMonster(name);
  if (!mo) return null;
  return { as: mo.name, cr: mo.cr, xp: XP_BY_CR[mo.cr] ?? 0, hp: mo.hp };
}

// ─── Mida de 5e → mida del token ───────────────────────────────────────────────────────────

/**
 * Mida del token segons la mida de 5e (v5 snapshot 9): `sm` = diàmetre respecte de la casella (amb la
 * mida automàtica de la graella) i `R` = radi sense graella. Diminuta i petita, una casella (com a la
 * taula); gran 2×2, enorme 3×3, gegantina 4×4. El DM la pot canviar al menú del token.
 */
export const SIZE_TOKEN: Record<NonNullable<Monster['size']>, { sm: number; R: number; label: string }> = {
  T: { sm: 0.55, R: 14, label: 'Diminuta' }, S: { sm: 0.8, R: 20, label: 'Petita' }, M: { sm: 0.9, R: 22, label: 'Mitjana' },
  L: { sm: 1.9, R: 46, label: 'Gran (2×2)' }, H: { sm: 2.85, R: 68, label: 'Enorme (3×3)' }, G: { sm: 3.8, R: 90, label: 'Gegantina (4×4)' },
};

// ─── Catàleg unificat: plantilles + Bestiari Oryx ───────────────────────────────────────────

/** Una entrada de la Biblioteca d'enemics (plantilla pròpia o criatura del paquet Oryx). */
export interface EnemyTemplate {
  id: string;
  name: string;
  color: string;
  hpMax: number;
  /** Radi (px) sense graella automàtica i factor de mida respecte a la casella (amb ella). */
  R: number;
  sm: number;
  sprite?: string;
  xp: number;
  /** Grup de la Biblioteca (els aliats no tenen grup propi: són `ally`). */
  group: 'Castell de la Fumarola' | 'Bestiari';
  /** Aliat/NPC: surt a «Aliats» (Biblioteca i Escena), no el ressalta «ressaltar enemics» i no dona XP. */
  ally?: boolean;
  /** Text curt per al títol del botó (monstre 5e amb què es juga, notes). */
  detail?: string;
  /** Bloc d'estadístiques de 5e amb què es juga (`MONSTERS`). */
  monster?: string;
}

const T = (id: string, name: string, color: string, hpMax: number, R: number, sm: number, sprite: string, xp: number,
  group: EnemyTemplate['group'] = 'Bestiari', detail?: string, ally?: boolean, monster?: string): EnemyTemplate =>
  ({ id, name, color, hpMax, R, sm, sprite, xp, group, detail, ...(ally ? { ally: true } : {}), ...(monster ? { monster } : {}) });

/** Plantilles genèriques (les de sempre): en un sol bloc amb el Bestiari Oryx, que no repeteix la seva figureta. */
const GENERIC: EnemyTemplate[] = [
  T('goblin',   'Goblin',   '#3a8a3a', 7,   25, 0.70, 'goblin', 50, 'Bestiari', undefined, undefined, 'goblin'),
  T('wolf',     'Llop',     '#8a7060', 11,  28, 0.80, 'wolf_black', 50, 'Bestiari', undefined, undefined, 'wolf'),
  T('bear',     'Ós',       '#8B5E3C', 34,  39, 1.10, 'minotaur', 200, 'Bestiari', undefined, undefined, 'brown_bear'),
  T('zombie',   'Zombi',    '#4a7a4a', 22,  33, 0.95, 'zombie_a', 50, 'Bestiari', undefined, undefined, 'zombie'),
  T('skeleton', 'Esquelet', '#c8b87a', 13,  26, 0.75, 'skeleton', 50, 'Bestiari', undefined, undefined, 'skeleton'),
  T('orc',      'Orc',      '#5a7a2a', 15,  35, 1.00, 'goblin_warrior', 100, 'Bestiari', undefined, undefined, 'orc'),
  T('troll',    'Trol',     '#3a6030', 84,  53, 1.50, 'troll', 1800, 'Bestiari', undefined, undefined, 'troll'),
  T('rat',      'Rata',     '#7a6060', 2,   14, 0.40, 'rat_giant', 25, 'Bestiari', undefined, undefined, 'giant_rat'),
  T('bandit',   'Bandit',   '#6a5a4a', 11,  35, 1.00, 'thief', 25, 'Bestiari', undefined, undefined, 'bandit'),
  T('spider',   'Aranya',   '#3a3a5a', 4,   16, 0.45, 'spider_black_giant', 10, 'Bestiari', undefined, undefined, 'spider'),
  T('dragon',   'Drac',     '#c0392b', 178, 70, 2.00, 'dragon_red', 5900, 'Bestiari', undefined, undefined, 'young_red_dragon'),
];

/** Castell de la Fumarola (Cragmaw Castle): habitants per zones i jefes (Notion: base de dades de campanya). */
const CASTLE: EnemyTemplate[] = [
  T('fum_goblin',   'Goblin Bocapeñasco', '#3a8a3a', 7,  25, 0.70, 'goblin', 50, 'Castell de la Fumarola', 'Centinelles, arquers i barracons (zones 1, 3, 4, 7, 9) · VD 1/4', undefined, 'goblin'),
  T('fum_hobgoblin','Hobgoblin',          '#8a3a2a', 11, 33, 0.95, 'goblin_warrior', 100, 'Castell de la Fumarola', 'Quarter hobgoblin (zona 6) · VD 1/2', undefined, 'hobgoblin'),
  T('fum_yegg',     'Yegg',               '#5a8a3a', 12, 30, 0.85, 'goblin_warrior', 50, 'Castell de la Fumarola', 'Cuiner gras i cascarrabias, saló de banquets (zona 7) · VD 1/4', undefined, 'goblin'),
  T('fum_lhupo',    'Lhupo',              '#6a9a3a', 12, 26, 0.75, 'goblin_shaman', 100, 'Castell de la Fumarola', 'Xaman de Maglubiyet, santuari (zona 9) · VD 1/2', undefined, 'goblin'),
  T('fum_grick',    'Grick',              '#7a6a8a', 27, 33, 0.95, 'worm', 450, 'Castell de la Fumarola', 'Mascota de Lhupo, vestíbul fosc (zona 8) · VD 2', undefined, 'grick'),
  T('fum_owlbear',  'Os mussol captiu',   '#8B5E3C', 59, 45, 1.30, 'minotaur', 700, 'Castell de la Fumarola', 'Torre (zona 13) · VD 3', undefined, 'owlbear'),
  T('fum_snarl',    'Snarl',              '#8a7060', 18, 28, 0.80, 'wolf_red', 50, 'Castell de la Fumarola', 'Llop del rei Jalil (zona 14) · VD 1/4', undefined, 'wolf'),
  T('fum_jalil',    'Rei Jalil',          '#7a4a2a', 65, 48, 1.35, 'ogre', 700, 'Castell de la Fumarola', 'Osgo vell, cap dels Bocapeñasco (King Grol, zona 14) · jefe', undefined, 'bugbear_chief'),
  T('lmop_redbrand', 'Rufià dels Mantells Vermells', '#9a2a2a', 16, 33, 0.95, 'thief', 100, 'Bestiari', 'Redbrand Ruffian (LMoP): banda de Phandalin · VD 1/2', undefined, 'redbrand'),
  T('lmop_ash_zombie', 'Zombi de cendra', '#7a7a6a', 22, 33, 0.95, 'zombie_b', 50, 'Bestiari', 'Ash Zombie (LMoP): mansió Tresendar i Vell Búho · VD 1/4', undefined, 'ash_zombie'),
  T('fum_vyerith',  'Vyerith',            '#8a4aa0', 52, 35, 1.00, 'drow_wizard', 700, 'Castell de la Fumarola', 'Doppelganger disfressat de drow, emissari dels Germans (zona 14) · VD 3 · jefe', undefined, 'doppelganger'),
];

/** Aliats i NPCs de la campanya (XP 0). */
const ALLIES: EnemyTemplate[] = [
  T('npc_sildar', 'Sildar Flocdeneu',  '#5a8ac0', 27, 35, 1.00, 'knight', 0, 'Bestiari', 'Sildar Hallwinter, guerrer de l\'Aliança dels Lords (LMoP) · VD 1', true, 'sildar'),
  T('npc_gota',   'Gota',              '#7ab07a', 7,  22, 0.65, 'goblin', 0, 'Bestiari', 'Droop, goblin petit i espantadís · stats de goblin', true, 'goblin'),
  T('npc_roc',    'Roc Cercarocs',     '#b0905a', 11, 28, 0.80, 'dwarf', 0, 'Bestiari', 'Gundren Buscarrocas, nan presoner · es juga com a Guàrdia', true, 'guard'),
];

/**
 * Les plantilles d'una criatura gran o més prenen la mida de 5e del seu monstre (abans el Drac i el
 * Trol sortien a 1,5–2 caselles). Les mitjanes i petites conserven la que tenien.
 */
const sized = (t: EnemyTemplate): EnemyTemplate => {
  const z = t.monster ? MONSTERS[t.monster]?.size : undefined;
  return z && (z === 'L' || z === 'H' || z === 'G') ? { ...t, R: SIZE_TOKEN[z].R, sm: SIZE_TOKEN[z].sm } : t;
};

/** Totes les plantilles amb nom propi (la Biblioteca i la mida automàtica les fan servir). */
export const ENEMY_TEMPLATES: readonly EnemyTemplate[] = [...GENERIC, ...CASTLE, ...ALLIES].map(sized);

/** Criatura del paquet Oryx com a plantilla (id `oryx_<nom>`, igual que els tokens d'un `.tmx`). */
export function creatureTemplate(name: string): EnemyTemplate {
  const st = creatureStats(name);
  const nice = CP_INFO[name]?.[0] ?? name.replace(/_/g, ' ').replace(/^\w/, ch => ch.toUpperCase());
  return {
    id: `oryx_${name}`, name: nice, color: '#f85149', hpMax: st?.hp ?? 10,
    ...(() => { const z = SIZE_TOKEN[creatureMonster(name)?.size ?? 'M']; return { R: z.R, sm: z.sm }; })(),
    sprite: name, xp: st?.xp ?? 0,
    group: 'Bestiari', detail: st ? `${st.as} · VD ${st.cr} · CA ${creatureMonster(name)?.ac} · ${st.xp} XP` : undefined,
    monster: S[name.split('~')[0]],
  };
}

/** Plantilla pel seu `templateId` (pròpia o d'Oryx). */
export function findTemplate(id: string): EnemyTemplate | undefined {
  return ENEMY_TEMPLATES.find(t => t.id === id) ?? (id.startsWith('oryx_') ? creatureTemplate(id.slice(5)) : undefined);
}

/**
 * Criatures Oryx que NO repeteixen una plantilla genèrica (mateixa figureta: el Drac és el
 * `dragon_red`, la Rata el `rat_giant`…). Així la Biblioteca té un sol bloc sense duplicats.
 * L'Ós fa servir el minotaure només de figureta, per això no l'amaga.
 */
export function extraCreatures(all: string[]): string[] {
  const used = new Set([...GENERIC.filter(t => t.id !== 'bear').map(t => t.sprite), ...PARTY_CREATURES]);
  return all.filter(n => !used.has(n));
}

/** Bloc de 5e d'una plantilla pel seu `templateId` (pròpia o d'Oryx). Null si no en té (BD, forja…). */
export function monsterForTemplate(templateId: string | undefined): Monster | null {
  if (!templateId) return null;
  const id = findTemplate(templateId)?.monster;
  return id ? MONSTERS[id] ?? null : null;
}
