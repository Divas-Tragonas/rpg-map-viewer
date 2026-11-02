/**
 * Estadístiques de D&D 5e de cada criatura del Bestiari Oryx (v4.68): amb quin monstre oficial
 * es juga cada figureta, el seu valor de desafiament (VD), l'XP que dona i la vida mitjana del
 * bloc d'estadístiques. Quan l'aventura de la campanya (La mina perduda de Phandelver) té el
 * monstre, es fa servir el seu (goblin, hobgoblin, llop, zombi, esquelet, espectador, aranya
 * gegant, gelatina ocre, estirge, espectre, drac verd jove = Venomfang, Nezznar…); si no, el del
 * Manual de monstres. Les figuretes sense monstre exacte (gòlem de gel, arnes, escarabats) fan
 * servir el més semblant: el DM ho pot canviar al menú del token.
 */

/** XP per valor de desafiament (Manual del DM, taula «Experience Points by Challenge Rating»). */
export const XP_BY_CR: Record<string, number> = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000,
  '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000,
};

/** Monstre oficial amb què es juga, VD i vida mitjana. */
type Stat = readonly [as: string, cr: string, hp: number];

const S: Record<string, Stat> = {
  // Gent
  wizard: ['Mag malvat (LMoP)', '1', 22],
  cultist: ['Sectari', '1/8', 9],
  knight: ['Cavaller', '3', 52],
  archer: ['Explorador', '1/2', 16],
  priest: ['Sacerdot', '2', 27],
  barbarian_m: ['Berserker', '2', 67],
  barbarian_f: ['Berserker', '2', 67],
  thief: ['Bandit', '1/8', 11],
  druid: ['Druida (Reidoth, LMoP)', '2', 27],
  helion: ['Sacerdot', '2', 27],
  necromancer: ['Mag malvat (Hamun Kost, LMoP)', '1', 22],
  warrior_m: ['Guàrdia', '1/8', 11],
  warrior_f: ['Guàrdia', '1/8', 11],
  minstrel_m: ['Plebeu', '0', 4],
  minstrel_f: ['Plebeu', '0', 4],
  paladin: ['Cavaller', '3', 52],
  dknight: ['Cavaller', '3', 52],
  templar: ['Veterà', '3', 58],
  witch: ['Bruixa verda', '3', 82],
  monk: ['Adepte d\'arts marcials', '3', 60],
  warden: ['Brètol', '1/2', 32],
  prisoner_a: ['Plebeu', '0', 4],
  prisoner_b: ['Plebeu', '0', 4],
  prisoner_c: ['Plebeu', '0', 4],
  elf: ['Explorador', '1/2', 16],
  elf_wizard: ['Aprenent de mag', '1/4', 9],
  elf_bowman: ['Explorador', '1/2', 16],
  drow: ['Drow', '1/4', 13],
  drow_wizard: ['Nezznar, l\'Aranya Negra (LMoP)', '2', 27],
  drow_bowman: ['Drow', '1/4', 13],
  dwarf: ['Guàrdia', '1/8', 11],
  dwarf_cleric: ['Sacerdot', '2', 27],
  dwarf_mage: ['Aprenent de mag', '1/4', 9],
  halfling_thief: ['Bandit', '1/8', 11],
  halfling_sling: ['Bandit', '1/8', 11],
  halfling_fighter: ['Guàrdia', '1/8', 11],
  halfling_wizard: ['Aprenent de mag', '1/4', 9],
  valkyrie_a: ['Gladiador', '5', 112],
  valkyrie_b: ['Gladiador', '5', 112],
  lord_a: ['Noble', '1/8', 9],
  lady_a: ['Noble', '1/8', 9],
  lord_b: ['Noble', '1/8', 9],
  lady_b: ['Noble', '1/8', 9],
  merchant_a: ['Plebeu', '0', 4],
  merchant_b: ['Plebeu', '0', 4],
  // Goblinoides, orcs i gegants
  goblin: ['Goblin', '1/4', 7],
  goblin_warrior: ['Hobgoblin', '1/2', 11],
  goblin_shaman: ['Cap goblin', '1', 21],
  troll: ['Trol', '5', 84],
  ogre: ['Ogre', '2', 59],
  ogre_mystic: ['Oni', '7', 110],
  minotaur: ['Minotaure', '3', 76],
  lizardman_green: ['Home llangardaix', '1/2', 22],
  lizardman_green_spear: ['Home llangardaix', '1/2', 22],
  lizardman_green_shaman: ['Xaman home llangardaix', '2', 27],
  lizardman_blue: ['Home llangardaix', '1/2', 22],
  lizardman_blue_spear: ['Home llangardaix', '1/2', 22],
  lizardman_blue_shaman: ['Xaman home llangardaix', '2', 27],
  // Morts vivents
  skeleton: ['Esquelet', '1/4', 13],
  skeleton_warrior: ['Esquelet', '1/4', 13],
  skeleton_mage: ['Esquelet', '1/4', 13],
  skeleton_archer: ['Esquelet', '1/4', 13],
  zombie_a: ['Zombi', '1/4', 22],
  zombie_b: ['Zombi', '1/4', 22],
  banshee: ['Banshee', '4', 58],
  vampire: ['Engendrament vampíric', '5', 82],
  vampire_lord: ['Vampir', '13', 144],
  lich: ['Lich', '21', 135],
  wraith_a: ['Espectre (Mormesk, LMoP)', '5', 67],
  wraith_b: ['Espectre menor', '1', 22],
  wraith_c: ['Ombra', '1/2', 16],
  mummy: ['Mòmia', '3', 58],
  mummy_pharoah: ['Senyor mòmia', '15', 97],
  spirit: ['Espectre menor', '1', 22],
  spirit_greater: ['Fantasma', '4', 45],
  // Bèsties
  bat_giant: ['Ratpenat gegant', '1/4', 22],
  bat: ['Ratpenat', '0', 1],
  spider_brown_giant: ['Aranya llop gegant', '1/4', 11],
  spider_brown: ['Aranya', '0', 1],
  spider_black_giant: ['Aranya gegant', '1', 26],
  spider_black: ['Aranya', '0', 1],
  rat: ['Rata', '0', 1],
  rat_giant: ['Rata gegant', '1/8', 7],
  snake_giant: ['Serp verinosa gegant', '1/4', 11],
  snake: ['Serp verinosa', '1/8', 2],
  wolf_black: ['Llop', '1/4', 11],
  wolf_red: ['Llop terrible', '1', 37],
  bird_dove: ['Corb', '0', 1],
  bird_hawk: ['Falcó', '0', 1],
  bird_crow: ['Corb', '0', 1],
  beetle_giant: ['Escarabat de foc gegant', '0', 4],
  beetle_fire_giant: ['Escarabat de foc gegant', '0', 4],
  beetle: ['Escarabat', '0', 1],
  beetle_fire: ['Escarabat', '0', 1],
  moth_white: ['Estirge (LMoP)', '1/8', 2],
  moth_red: ['Estirge (LMoP)', '1/8', 2],
  moth_black: ['Estirge (LMoP)', '1/8', 2],
  toad_green: ['Granota gegant', '1/4', 18],
  toad_blue: ['Granota gegant', '1/4', 18],
  toad_horned: ['Gripau gegant', '1', 39],
  flies: ['Eixam d\'insectes', '1/2', 22],
  worm: ['Grick', '2', 27],
  worm_giant: ['Cuc porpra', '15', 247],
  // Aberracions, llimes i altres
  beholder: ['Espectador (LMoP)', '3', 39],
  beholder_deep: ['Contemplador', '13', 180],
  slime_green: ['Llim gris', '1/2', 22],
  slime_purple: ['Púding negre', '4', 85],
  slime_red: ['Gelatina ocre (LMoP)', '2', 45],
  mimic: ['Mímic', '2', 58],
  pixie_a: ['Fada', '1/4', 1],
  pixie_b: ['Fada', '1/4', 1],
  wisp_ancient: ['Foc follet', '2', 22],
  wisp: ['Foc follet', '2', 22],
  demon_red: ['Vrock', '6', 104],
  demon_blue: ['Hezrou', '8', 136],
  demon_green: ['Glabrezu', '9', 157],
  // Dracs (joves)
  dragon_shadow: ['Drac negre jove', '7', 127],
  dragon_red: ['Drac vermell jove', '10', 178],
  dragon_blue: ['Drac blau jove', '9', 152],
  dragon_green: ['Drac verd jove (Venomfang, LMoP)', '8', 136],
  // Gòlems i elementals
  golem_stone: ['Gòlem de pedra', '10', 178],
  golem_fire: ['Elemental de foc', '5', 102],
  golem_mud: ['Gòlem d\'argila', '9', 133],
  golem_ice: ['Gòlem de carn', '5', 93],
  golem_metal: ['Gòlem de ferro', '16', 210],
  elemental_vorpal: ['Caçador invisible', '6', 104],
  elemental_water: ['Elemental d\'aigua', '5', 114],
  elemental_fire: ['Elemental de foc', '5', 102],
  elemental_air: ['Elemental d\'aire', '5', 90],
  elemental_earth: ['Elemental de terra', '5', 126],
};

export interface CreatureStats { as: string; cr: string; xp: number; hp: number }

/** Estadístiques d'una criatura del paquet (pel nom, sense la variant de color). Null si no en té. */
export function creatureStats(name: string): CreatureStats | null {
  const s = S[name.split('~')[0]];
  if (!s) return null;
  return { as: s[0], cr: s[1], xp: XP_BY_CR[s[1]] ?? 0, hp: s[2] };
}
