/**
 * Blocs d'estadístiques de 5e dels monstres amb què es juguen les figuretes i plantilles de l'app
 * (v5 snapshot 6). Font: Manual de monstres / SRD 5.1, La mina perduda de Phandelver (LMoP) i, per
 * a uns quants, Volo's Guide (VGtM). L'app NO tira res: és la referència que el DM consulta (menú
 * del token) i la que fan servir els pop-ups de dany (resistències, immunitats) i d'estats
 * (immunitats a estats), i els atacs del menú (abast).
 *
 * Abreviatures dels tipus de dany: els de `DamageType` (`lib/characters.ts`). `B/P/S` = contundent,
 * perforant, tallant. `nmRes`/`nmImm` = resistència/immunitat al dany B/P/S d'atacs NO màgics.
 */
import type { AbilityId, DamageType, SheetAttack } from '@/lib/characters';

export interface Monster {
  /** Nom del monstre oficial (com surt al bestiari de l'app). */
  name: string;
  cr: string;
  hp: number;
  ac: number;
  /** Velocitat en peus (caminar) i altres moviments en text («vol 60»). */
  speed: number;
  move?: string;
  /** FUE DES CON INT SAV CAR (pot faltar en un enemic de la BD sense omplir). */
  abilities?: readonly [number, number, number, number, number, number];
  /** Bonificació total de les salvacions amb competència (si no hi és, el modificador). */
  saves?: Partial<Record<AbilityId, number>>;
  res?: DamageType[];
  vul?: DamageType[];
  imm?: DamageType[];
  nmRes?: true;
  nmImm?: true;
  /** Estats als quals és immune (ids de `CONDITIONS`). */
  cimm?: string[];
  attacks: SheetAttack[];
  /** Trets i poders, curts (regeneració, resistència a la màgia, encanteris…). */
  traits?: string[];
}

const BPS: DamageType[] = ['bludgeoning', 'piercing', 'slashing'];
const UNDEAD_SPIRIT = ['charmed', 'exhaustion', 'grappled', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained'];
const ELEMENTAL = ['exhaustion', 'grappled', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'unconscious'];
const GOLEM = ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'petrified', 'poisoned'];
const OOZE = ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'prone'];
const MUMMY = ['charmed', 'exhaustion', 'frightened', 'paralyzed', 'poisoned'];

/** Atac cos a cos (abast 5 si no es diu), a distància o llançadís. */
const m = (name: string, bonus: string, damage: string, type: DamageType, reachFt = 5): SheetAttack =>
  ({ name, kind: 'melee', reachFt, bonus, damage, damageType: type });
const r = (name: string, bonus: string, damage: string, type: DamageType, rangeFt: number, longFt: number): SheetAttack =>
  ({ name, kind: 'ranged', rangeFt, longFt, bonus, damage, damageType: type });
const t = (name: string, bonus: string, damage: string, type: DamageType, rangeFt: number, longFt: number): SheetAttack =>
  ({ name, kind: 'thrown', reachFt: 5, rangeFt, longFt, bonus, damage, damageType: type });

export const MONSTERS: Record<string, Monster> = {
  // ── Gent ──────────────────────────────────────────────────────────────────────────────
  evil_mage: { name: 'Mag malvat (LMoP)', cr: '1', hp: 22, ac: 12, speed: 30, abilities: [9, 14, 11, 17, 12, 11], saves: { int: 5, wis: 3 },
    attacks: [m('Bastó', '+1', '1d6-1', 'bludgeoning')], traits: ['Encanteris (INT, CD 13): projectil màgic, escut, encisar persona, immobilitzar persona, passa boirosa'] },
  cultist: { name: 'Sectari', cr: '1/8', hp: 9, ac: 12, speed: 30, abilities: [11, 12, 10, 10, 11, 10],
    attacks: [m('Simitarra', '+3', '1d6+1', 'slashing')], traits: ['Devoció fosca: avantatge a les salvacions contra encisat i espantat'] },
  knight: { name: 'Cavaller', cr: '3', hp: 52, ac: 18, speed: 30, abilities: [16, 11, 14, 11, 11, 15], saves: { con: 4, wis: 2 },
    attacks: [m('Espasa de dues mans (×2)', '+5', '2d6+3', 'slashing'), r('Ballesta pesant', '+2', '1d10', 'piercing', 100, 400)],
    traits: ['Valent: avantatge a les salvacions contra espantat', 'Lideratge (1/descans): +1d4 als atacs i salvacions dels aliats', 'Reacció: parar (+2 CA contra un atac cos a cos)'] },
  scout: { name: 'Explorador', cr: '1/2', hp: 16, ac: 13, speed: 30, abilities: [11, 14, 12, 11, 13, 11],
    attacks: [m('Espasa curta', '+4', '1d6+2', 'piercing'), r('Arc llarg', '+4', '1d8+2', 'piercing', 150, 600)], traits: ['Oïda i vista agudes', 'Atac múltiple: dos atacs'] },
  priest: { name: 'Sacerdot', cr: '2', hp: 27, ac: 13, speed: 25, abilities: [10, 10, 12, 13, 16, 13],
    attacks: [m('Maça', '+2', '1d6', 'bludgeoning')], traits: ['Encanteris (SAV, CD 13): flama sagrada, curar ferides, guiar el projectil, arma espiritual, esperit guardià', 'Eminència divina: +3d6 radiant a un atac'] },
  berserker: { name: 'Berserker', cr: '2', hp: 67, ac: 13, speed: 30, abilities: [16, 12, 17, 9, 11, 9],
    attacks: [m('Destral de batalla', '+5', '1d12+3', 'slashing')], traits: ['Temerari: avantatge als atacs cos a cos; els atacs contra ell tenen avantatge'] },
  bandit: { name: 'Bandit', cr: '1/8', hp: 11, ac: 12, speed: 30, abilities: [11, 12, 12, 10, 10, 10],
    attacks: [m('Simitarra', '+3', '1d6+1', 'slashing'), r('Ballesta lleugera', '+3', '1d8+1', 'piercing', 80, 320)] },
  druid: { name: 'Druida (Reidoth, LMoP)', cr: '2', hp: 27, ac: 11, speed: 30, abilities: [10, 12, 13, 12, 15, 11],
    attacks: [m('Bastó (shillelagh)', '+4', '1d8+2', 'bludgeoning')], traits: ['CA 16 amb pell d\'escorça', 'Encanteris (SAV, CD 12): enredar, foc feèric, pell d\'escorça, parlar amb els animals'] },
  guard: { name: 'Guàrdia', cr: '1/8', hp: 11, ac: 16, speed: 30, abilities: [13, 12, 12, 10, 11, 10],
    attacks: [t('Llança', '+3', '1d6+1', 'piercing', 20, 60)] },
  commoner: { name: 'Plebeu', cr: '0', hp: 4, ac: 10, speed: 30, abilities: [10, 10, 10, 10, 10, 10],
    attacks: [m('Garrot', '+2', '1d4', 'bludgeoning')] },
  veteran: { name: 'Veterà', cr: '3', hp: 58, ac: 17, speed: 30, abilities: [16, 13, 14, 10, 11, 10],
    attacks: [m('Espasa llarga (×2)', '+5', '1d8+3', 'slashing'), m('Espasa curta', '+5', '1d6+3', 'piercing'), r('Ballesta pesant', '+3', '1d10+1', 'piercing', 100, 400)] },
  green_hag: { name: 'Bruixa verda', cr: '3', hp: 82, ac: 17, speed: 30, abilities: [18, 12, 16, 13, 14, 14],
    attacks: [m('Urpes', '+6', '2d8+4', 'slashing')], traits: ['Amfíbia', 'Mímica', 'Il·lusió: invisibilitat, aparença il·lusòria', 'Encanteris innats: llums dansants, il·lusió menor, burla viciosa'] },
  martial_adept: { name: 'Adepte d\'arts marcials (VGtM)', cr: '3', hp: 60, ac: 16, speed: 40, abilities: [11, 17, 13, 11, 16, 10],
    attacks: [m('Cop desarmat (×3)', '+5', '1d8+3', 'bludgeoning')], traits: ['Reacció: desviar projectils', 'Un cop per torn pot tombar, desarmar o empènyer (CD 13)'] },
  thug: { name: 'Brètol', cr: '1/2', hp: 32, ac: 11, speed: 30, abilities: [15, 11, 14, 10, 10, 11],
    attacks: [m('Maça (×2)', '+4', '1d6+2', 'bludgeoning'), r('Ballesta pesant', '+2', '1d10', 'piercing', 100, 400)], traits: ['Tàctiques de grup'] },
  apprentice: { name: 'Aprenent de mag (VGtM)', cr: '1/4', hp: 9, ac: 10, speed: 30, abilities: [10, 10, 10, 14, 10, 11],
    attacks: [t('Daga', '+2', '1d4', 'piercing', 20, 60)], traits: ['Encanteris (INT, CD 12): raig de foc, mans ardents, disfressar-se, reparar'] },
  drow: { name: 'Drow', cr: '1/4', hp: 13, ac: 15, speed: 30, abilities: [10, 14, 10, 11, 11, 12], cimm: ['unconscious'],
    attacks: [m('Espasa curta', '+4', '1d6+2', 'piercing'), r('Ballesta de mà (+ verí CON 13)', '+4', '1d6+2', 'piercing', 30, 120)],
    traits: ['Ascendència feèrica: avantatge contra encisat; la màgia no el pot adormir', 'Sensibilitat a la llum del sol', 'Encanteris: llums dansants, foscor, foc feèric'] },
  nezznar: { name: 'Nezznar, l\'Aranya Negra (LMoP)', cr: '2', hp: 27, ac: 11, speed: 30, abilities: [9, 14, 10, 16, 13, 12], saves: { int: 5, wis: 3 }, cimm: ['unconscious'],
    attacks: [m('Bàcul d\'aranya (+1d6 verí)', '+1', '1d6-1', 'bludgeoning')],
    traits: ['CA 14 amb armadura de mag', 'Ascendència feèrica (la màgia no l\'adorm)', 'Encanteris (INT, CD 13): projectil màgic, raig de gebre, invisibilitat, teranyina, sufocar', 'Sensibilitat a la llum del sol'] },
  gladiator: { name: 'Gladiador', cr: '5', hp: 112, ac: 16, speed: 30, abilities: [18, 15, 16, 10, 12, 15], saves: { str: 7, dex: 5, con: 6 },
    attacks: [t('Llança (×3)', '+7', '2d6+4', 'piercing', 20, 60), m('Cop d\'escut (tomba, FUE 15)', '+7', '2d4+4', 'bludgeoning')], traits: ['Valent', 'Brutal: +1 dau d\'arma als cops', 'Reacció: parar (+3 CA)'] },
  noble: { name: 'Noble', cr: '1/8', hp: 9, ac: 15, speed: 30, abilities: [11, 12, 11, 12, 14, 16],
    attacks: [m('Estoc', '+3', '1d8+1', 'piercing')], traits: ['Reacció: parar (+2 CA)'] },
  doppelganger: { name: 'Doppelganger', cr: '3', hp: 52, ac: 14, speed: 30, abilities: [11, 18, 14, 11, 12, 14], cimm: ['charmed'],
    attacks: [m('Cop (×2)', '+6', '1d6+4', 'bludgeoning')], traits: ['Canviar de forma', 'Emboscador: avantatge contra qui no ha actuat; sorpresa +3d6', 'Llegir pensaments'] },

  // ── Goblinoides, orcs i gegants ──────────────────────────────────────────────────────
  goblin: { name: 'Goblin', cr: '1/4', hp: 7, ac: 15, speed: 30, abilities: [8, 14, 10, 10, 8, 8],
    attacks: [m('Simitarra', '+4', '1d6+2', 'slashing'), r('Arc curt', '+4', '1d6+2', 'piercing', 80, 320)], traits: ['Fuga àgil: retirar-se o amagar-se com a acció bonus'] },
  hobgoblin: { name: 'Hobgoblin', cr: '1/2', hp: 11, ac: 18, speed: 30, abilities: [13, 12, 12, 10, 10, 9],
    attacks: [m('Espasa llarga', '+3', '1d8+1', 'slashing'), r('Arc llarg', '+3', '1d8+1', 'piercing', 150, 600)], traits: ['Avantatge marcial: +2d6 un cop per torn si un aliat és a 5 ft de l\'objectiu'] },
  goblin_boss: { name: 'Cap goblin', cr: '1', hp: 21, ac: 17, speed: 30, abilities: [10, 14, 10, 10, 8, 10],
    attacks: [m('Simitarra (×2)', '+4', '1d6+2', 'slashing'), t('Javelina', '+2', '1d6', 'piercing', 30, 120)], traits: ['Fuga àgil', 'Reacció: redirigir l\'atac a un goblin proper'] },
  bugbear_chief: { name: 'Osgo cap (Rei Grol, LMoP)', cr: '3', hp: 65, ac: 16, speed: 30, abilities: [17, 14, 15, 11, 12, 11],
    attacks: [m('Estrella del matí (×2)', '+6', '2d8+4', 'piercing')], traits: ['Brutal: +1 dau d\'arma als cops', 'Atac per sorpresa: +2d6'] },
  orc: { name: 'Orc', cr: '1/2', hp: 15, ac: 13, speed: 30, abilities: [16, 12, 16, 7, 11, 10],
    attacks: [m('Destral de batalla', '+5', '1d12+3', 'slashing'), t('Javelina', '+5', '1d6+3', 'piercing', 30, 120)], traits: ['Agressiu: moure\'s cap a un enemic com a acció bonus'] },
  troll: { name: 'Trol', cr: '5', hp: 84, ac: 15, speed: 30, abilities: [18, 13, 20, 7, 9, 7],
    attacks: [m('Mossegada', '+7', '1d6+4', 'piercing'), m('Urpa (×2)', '+7', '2d6+4', 'slashing')],
    traits: ['Regeneració: recupera 10 PV a l\'inici del torn si no ha rebut dany d\'àcid o de foc', 'Olfacte agut'] },
  ogre: { name: 'Ogre', cr: '2', hp: 59, ac: 11, speed: 40, abilities: [19, 8, 16, 5, 7, 7],
    attacks: [m('Garrot gran', '+6', '2d8+4', 'bludgeoning'), t('Javelina', '+6', '2d6+4', 'piercing', 30, 120)] },
  oni: { name: 'Oni', cr: '7', hp: 110, ac: 16, speed: 30, move: 'vol 30', abilities: [19, 11, 16, 14, 12, 15], saves: { dex: 3, con: 6, wis: 4, cha: 5 },
    attacks: [m('Glaive (×2)', '+7', '2d10+4', 'slashing', 10), m('Urpa (forma d\'oni)', '+7', '1d8+4', 'slashing')],
    traits: ['Regeneració: 10 PV per torn si té almenys 1 PV', 'Arma màgica', 'Canviar de forma', 'Encanteris: invisibilitat, foscor, encisar persona, son, con de fred, forma gasosa'] },
  minotaur: { name: 'Minotaure', cr: '3', hp: 76, ac: 14, speed: 40, abilities: [18, 11, 16, 6, 16, 9],
    attacks: [m('Destral de batalla', '+6', '2d12+4', 'slashing'), m('Banyada', '+6', '2d8+4', 'piercing')],
    traits: ['Envestida: banyada després de moure 10 ft, +2d8 i empenta o tomba (FUE 14)', 'Memòria del laberint', 'Temerari'] },
  lizardfolk: { name: 'Home llangardaix', cr: '1/2', hp: 22, ac: 15, speed: 30, move: 'nedar 30', abilities: [15, 10, 13, 7, 12, 7],
    attacks: [m('Mossegada', '+4', '1d6+2', 'piercing'), m('Garrot pesant', '+4', '1d6+2', 'bludgeoning'), t('Javelina', '+4', '1d6+2', 'piercing', 30, 120), m('Escut amb pues', '+4', '1d6+2', 'piercing')],
    traits: ['Aguantar la respiració 15 min', 'Atac múltiple: dos atacs amb armes diferents'] },
  lizardfolk_shaman: { name: 'Xaman home llangardaix (VGtM)', cr: '2', hp: 27, ac: 13, speed: 30, move: 'nedar 30', abilities: [15, 10, 13, 10, 15, 8],
    attacks: [m('Mossegada', '+4', '1d6+2', 'piercing'), m('Urpes', '+4', '1d4+2', 'slashing')],
    traits: ['Canviar de forma: cocodril', 'Encanteris (SAV, CD 12): produir flama, enredar, ferotge, immobilitzar persona'] },

  // ── Morts vivents ────────────────────────────────────────────────────────────────────
  skeleton: { name: 'Esquelet', cr: '1/4', hp: 13, ac: 13, speed: 30, abilities: [10, 14, 15, 6, 8, 5],
    vul: ['bludgeoning'], imm: ['poison'], cimm: ['exhaustion', 'poisoned'],
    attacks: [m('Espasa curta', '+4', '1d6+2', 'piercing'), r('Arc curt', '+4', '1d6+2', 'piercing', 80, 320)] },
  zombie: { name: 'Zombi', cr: '1/4', hp: 22, ac: 8, speed: 20, abilities: [13, 6, 16, 3, 6, 5], saves: { wis: 0 },
    imm: ['poison'], cimm: ['poisoned'], attacks: [m('Cop', '+3', '1d6+1', 'bludgeoning')],
    traits: ['Fortalesa de mort vivent: a 0 PV, salvació de CON (CD 5 + dany) per quedar a 1, excepte dany radiant o crític'] },
  banshee: { name: 'Banshee', cr: '4', hp: 58, ac: 12, speed: 0, move: 'vol 40 (levita)', abilities: [1, 14, 10, 12, 11, 17], saves: { wis: 2, cha: 5 },
    res: ['acid', 'fire', 'lightning', 'thunder'], nmRes: true, imm: ['cold', 'necrotic', 'poison'], cimm: [...UNDEAD_SPIRIT, 'frightened'],
    attacks: [m('Toc corruptor', '+4', '3d6+2', 'necrotic')],
    traits: ['Moviment incorpori', 'Rostre horrorós (espantat, SAV 13)', 'Lament (1/dia): 0 PV a qui falli CON 13'] },
  vampire_spawn: { name: 'Engendrament vampíric', cr: '5', hp: 82, ac: 15, speed: 30, abilities: [16, 16, 16, 11, 10, 12], saves: { dex: 6, wis: 3 },
    res: ['necrotic'], nmRes: true,
    attacks: [m('Urpes', '+6', '2d4+3', 'slashing'), m('Mossegada (+2d6 necròtic)', '+6', '1d6+3', 'piercing')],
    traits: ['Regeneració 10 si no ha rebut dany radiant ni és sota el sol', 'Escalar com una aranya', 'Febleses del vampir (aigua corrent, estaca, sol)'] },
  vampire: { name: 'Vampir', cr: '13', hp: 144, ac: 16, speed: 30, abilities: [18, 18, 18, 17, 15, 18], saves: { dex: 9, wis: 7, cha: 9 },
    res: ['necrotic'], nmRes: true,
    attacks: [m('Cop desarmat', '+9', '1d8+4', 'bludgeoning'), m('Mossegada (+3d6 necròtic)', '+9', '1d6+4', 'piercing')],
    traits: ['Resistència llegendària (3/dia)', 'Regeneració 20', 'Encís (SAV 17)', 'Accions llegendàries', 'Febleses del vampir'] },
  lich: { name: 'Lich', cr: '21', hp: 135, ac: 17, speed: 30, abilities: [11, 16, 16, 20, 14, 16], saves: { con: 10, int: 12, wis: 9 },
    res: ['cold', 'lightning', 'necrotic'], imm: ['poison'], nmImm: true, cimm: MUMMY,
    attacks: [m('Toc paralitzant (para. CON 18)', '+12', '3d6', 'cold')],
    traits: ['Resistència llegendària (3/dia)', 'Rejoveniment (filacteri)', 'Resistència a expulsar', 'Encanteris de nivell 9 (INT, CD 20)', 'Accions llegendàries'] },
  wraith: { name: 'Espectre (Mormesk, LMoP)', cr: '5', hp: 67, ac: 13, speed: 0, move: 'vol 60 (levita)', abilities: [6, 16, 16, 12, 14, 15],
    res: ['acid', 'cold', 'fire', 'lightning', 'thunder'], nmRes: true, imm: ['necrotic', 'poison'], cimm: UNDEAD_SPIRIT,
    attacks: [m('Drenar vida (redueix PV màx., CON 14)', '+6', '4d8+3', 'necrotic')],
    traits: ['Moviment incorpori', 'Sensibilitat a la llum del sol', 'Crear espectres menors'] },
  specter: { name: 'Espectre menor', cr: '1', hp: 22, ac: 12, speed: 0, move: 'vol 50 (levita)', abilities: [1, 14, 11, 10, 10, 11],
    res: ['acid', 'cold', 'fire', 'lightning', 'thunder'], nmRes: true, imm: ['necrotic', 'poison'], cimm: [...UNDEAD_SPIRIT, 'unconscious'],
    attacks: [m('Drenar vida (redueix PV màx., CON 10)', '+4', '3d6', 'necrotic')], traits: ['Moviment incorpori', 'Sensibilitat a la llum del sol'] },
  shadow: { name: 'Ombra', cr: '1/2', hp: 16, ac: 12, speed: 40, abilities: [6, 14, 13, 6, 10, 8],
    vul: ['radiant'], res: ['acid', 'cold', 'fire', 'lightning', 'thunder'], nmRes: true, imm: ['necrotic', 'poison'],
    cimm: ['exhaustion', 'frightened', 'grappled', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained'],
    attacks: [m('Drenar força (−1d4 FUE)', '+4', '2d6+2', 'necrotic')], traits: ['Amorf', 'Sigil a l\'ombra', 'Feblesa a la llum del sol'] },
  mummy: { name: 'Mòmia', cr: '3', hp: 58, ac: 11, speed: 20, abilities: [16, 8, 15, 6, 10, 12], saves: { wis: 2 },
    vul: ['fire'], nmRes: true, imm: ['necrotic', 'poison'], cimm: MUMMY,
    attacks: [m('Puny podrit (+3d6 necròtic, malaltia)', '+5', '2d6+3', 'bludgeoning')], traits: ['Mirada terrible (espantat, SAV 11)'] },
  mummy_lord: { name: 'Senyor mòmia', cr: '15', hp: 97, ac: 17, speed: 20, abilities: [18, 10, 17, 11, 18, 16], saves: { con: 8, int: 5, wis: 9, cha: 8 },
    vul: ['fire'], imm: ['necrotic', 'poison'], nmImm: true, cimm: MUMMY,
    attacks: [m('Puny podrit (+6d6 necròtic)', '+9', '3d6+4', 'bludgeoning')],
    traits: ['Resistència a la màgia', 'Rejoveniment', 'Encanteris de clergue (SAV, CD 17)', 'Accions llegendàries'] },
  ghost: { name: 'Fantasma', cr: '4', hp: 45, ac: 11, speed: 0, move: 'vol 40 (levita)', abilities: [7, 13, 10, 10, 12, 17],
    res: ['acid', 'fire', 'lightning', 'thunder'], nmRes: true, imm: ['cold', 'necrotic', 'poison'], cimm: [...UNDEAD_SPIRIT, 'frightened'],
    attacks: [m('Toc marcidor', '+5', '4d6+3', 'necrotic')], traits: ['Visió eteri', 'Moviment incorpori', 'Rostre horrorós', 'Possessió (CAR 13)'] },

  // ── Bèsties ──────────────────────────────────────────────────────────────────────────
  giant_bat: { name: 'Ratpenat gegant', cr: '1/4', hp: 22, ac: 13, speed: 10, move: 'vol 60', abilities: [15, 16, 11, 2, 12, 6],
    attacks: [m('Mossegada', '+4', '1d6+2', 'piercing')], traits: ['Ecolocalització (cec si és sord)', 'Oïda aguda'] },
  bat: { name: 'Ratpenat', cr: '0', hp: 1, ac: 12, speed: 5, move: 'vol 30', abilities: [2, 15, 8, 2, 12, 4],
    attacks: [m('Mossegada', '+0', '1', 'piercing')], traits: ['Ecolocalització'] },
  giant_wolf_spider: { name: 'Aranya llop gegant', cr: '1/4', hp: 11, ac: 13, speed: 40, abilities: [12, 16, 13, 3, 12, 4],
    attacks: [m('Mossegada (+2d6 verí, CON 11)', '+3', '1d6+1', 'piercing')], traits: ['Escalar com una aranya', 'Sentit de la teranyina'] },
  spider: { name: 'Aranya', cr: '0', hp: 1, ac: 12, speed: 20, abilities: [2, 14, 8, 1, 10, 2],
    attacks: [m('Mossegada (+1d4 verí, CON 9)', '+4', '1', 'piercing')] },
  giant_spider: { name: 'Aranya gegant', cr: '1', hp: 26, ac: 14, speed: 30, abilities: [14, 16, 12, 2, 11, 4],
    attacks: [m('Mossegada (+2d8 verí, CON 11)', '+5', '1d8+3', 'piercing'), { name: 'Teranyina (retingut, recàrrega 5–6)', kind: 'ranged', rangeFt: 30, longFt: 60, bonus: '+5' }],
    traits: ['Escalar com una aranya', 'Sentit de la teranyina', 'Caminar per la teranyina'] },
  rat: { name: 'Rata', cr: '0', hp: 1, ac: 10, speed: 20, abilities: [2, 11, 9, 2, 10, 4],
    attacks: [m('Mossegada', '+0', '1', 'piercing')], traits: ['Olfacte agut'] },
  giant_rat: { name: 'Rata gegant', cr: '1/8', hp: 7, ac: 12, speed: 30, abilities: [7, 15, 11, 2, 10, 4],
    attacks: [m('Mossegada', '+4', '1d4+2', 'piercing')], traits: ['Tàctiques de grup', 'Olfacte agut'] },
  giant_poisonous_snake: { name: 'Serp verinosa gegant', cr: '1/4', hp: 11, ac: 14, speed: 30, abilities: [10, 18, 13, 2, 10, 3],
    attacks: [m('Mossegada (+3d6 verí, CON 11)', '+6', '1d4+4', 'piercing', 10)] },
  poisonous_snake: { name: 'Serp verinosa', cr: '1/8', hp: 2, ac: 13, speed: 30, abilities: [2, 16, 11, 1, 10, 3],
    attacks: [m('Mossegada (+2d4 verí, CON 10)', '+5', '1', 'piercing')] },
  wolf: { name: 'Llop', cr: '1/4', hp: 11, ac: 13, speed: 40, abilities: [12, 15, 12, 3, 12, 6],
    attacks: [m('Mossegada (tomba, FUE 11)', '+4', '2d4+2', 'piercing')], traits: ['Tàctiques de grup', 'Oïda i olfacte aguts'] },
  dire_wolf: { name: 'Llop terrible', cr: '1', hp: 37, ac: 14, speed: 50, abilities: [17, 15, 15, 3, 12, 7],
    attacks: [m('Mossegada (tomba, FUE 13)', '+5', '2d6+3', 'piercing')], traits: ['Tàctiques de grup', 'Oïda i olfacte aguts'] },
  raven: { name: 'Corb', cr: '0', hp: 1, ac: 12, speed: 10, move: 'vol 50', abilities: [2, 14, 8, 2, 12, 6],
    attacks: [m('Bec', '+4', '1', 'piercing')], traits: ['Mímica'] },
  hawk: { name: 'Falcó', cr: '0', hp: 1, ac: 13, speed: 10, move: 'vol 60', abilities: [5, 16, 8, 2, 14, 6],
    attacks: [m('Urpes', '+5', '1', 'slashing')], traits: ['Vista aguda'] },
  giant_fire_beetle: { name: 'Escarabat de foc gegant', cr: '0', hp: 4, ac: 13, speed: 30, abilities: [8, 10, 12, 1, 7, 3],
    attacks: [m('Mossegada', '+1', '1d6-1', 'slashing')], traits: ['Il·luminació (llum 10 ft)'] },
  beetle: { name: 'Escarabat (com un cranc)', cr: '0', hp: 2, ac: 11, speed: 20, abilities: [2, 11, 10, 1, 8, 2],
    attacks: [m('Pinça', '+0', '1', 'bludgeoning')], traits: ['Sense bloc oficial: es juga com un cranc'] },
  stirge: { name: 'Estirge (LMoP)', cr: '1/8', hp: 2, ac: 14, speed: 10, move: 'vol 40', abilities: [4, 16, 11, 2, 8, 6],
    attacks: [m('Xuclar sang (s\'hi enganxa, 1d4+3 per torn)', '+5', '1d4+3', 'piercing')] },
  giant_frog: { name: 'Granota gegant', cr: '1/4', hp: 18, ac: 11, speed: 30, move: 'nedar 30', abilities: [12, 13, 11, 2, 10, 3],
    attacks: [m('Mossegada (agafa, CD 11)', '+3', '1d6+1', 'piercing')], traits: ['Amfíbia', 'Salt dempeus', 'Engolir'] },
  giant_toad: { name: 'Gripau gegant', cr: '1', hp: 39, ac: 11, speed: 20, move: 'nedar 40', abilities: [15, 13, 13, 2, 10, 3],
    attacks: [m('Mossegada (+1d10 verí, agafa)', '+4', '1d10+2', 'piercing')], traits: ['Amfibi', 'Salt dempeus', 'Engolir'] },
  insect_swarm: { name: 'Eixam d\'insectes', cr: '1/2', hp: 22, ac: 12, speed: 20, move: 'escalar 20', abilities: [3, 13, 10, 1, 7, 1],
    res: BPS, cimm: ['charmed', 'frightened', 'grappled', 'paralyzed', 'petrified', 'prone', 'restrained', 'stunned'],
    attacks: [m('Picades (2d4 si té la meitat de PV)', '+3', '4d4', 'piercing', 0)], traits: ['Eixam: ocupa l\'espai d\'altres; no recupera PV'] },
  grick: { name: 'Grick', cr: '2', hp: 27, ac: 14, speed: 30, move: 'escalar 30', abilities: [14, 14, 11, 3, 14, 5], nmRes: true,
    attacks: [m('Tentacles', '+4', '2d6+2', 'slashing'), m('Bec', '+4', '1d6+2', 'piercing')], traits: ['Camuflatge a la roca'] },
  purple_worm: { name: 'Cuc porpra', cr: '15', hp: 247, ac: 18, speed: 50, move: 'excavar 30', abilities: [28, 7, 22, 1, 8, 4], saves: { con: 11, wis: 4 },
    attacks: [m('Mossegada (engoleix)', '+9', '3d8+9', 'piercing', 10), m('Fibló (+12d6 verí, CON 19)', '+9', '3d6+9', 'piercing', 10)], traits: ['Túnels'] },
  brown_bear: { name: 'Ós bru', cr: '1', hp: 34, ac: 11, speed: 40, abilities: [19, 10, 16, 2, 13, 7],
    attacks: [m('Mossegada', '+6', '1d8+4', 'piercing'), m('Urpes', '+6', '2d6+4', 'slashing')], traits: ['Olfacte agut', 'Atac múltiple'] },
  owlbear: { name: 'Os mussol', cr: '3', hp: 59, ac: 13, speed: 40, abilities: [20, 12, 17, 3, 12, 7],
    attacks: [m('Bec', '+7', '1d10+5', 'piercing'), m('Urpes', '+7', '2d8+5', 'slashing')], traits: ['Vista i olfacte aguts', 'Atac múltiple'] },

  // ── Aberracions, llims i altres ──────────────────────────────────────────────────────
  spectator: { name: 'Espectador (LMoP)', cr: '3', hp: 39, ac: 14, speed: 0, move: 'vol 30 (levita)', abilities: [8, 14, 14, 13, 14, 11], cimm: ['prone'],
    attacks: [m('Mossegada', '+1', '1d6-1', 'piercing')],
    traits: ['Raigs oculars (2 per torn, CD 13): confusió, paràlisi, por, ferida (3d10 necròtic)', 'Reacció: reflectir un conjur'] },
  beholder: { name: 'Contemplador', cr: '13', hp: 180, ac: 18, speed: 0, move: 'vol 20 (levita)', abilities: [10, 14, 18, 17, 15, 17], saves: { int: 8, wis: 7, cha: 8 }, cimm: ['prone'],
    attacks: [m('Mossegada', '+5', '4d6', 'piercing')], traits: ['Con antimàgia', '10 raigs oculars (CD 16)', 'Accions llegendàries'] },
  gray_ooze: { name: 'Llim gris', cr: '1/2', hp: 22, ac: 8, speed: 10, abilities: [12, 6, 16, 1, 6, 2],
    res: ['acid', 'cold', 'fire'], cimm: OOZE, attacks: [m('Pseudòpode (+2d6 àcid, corroeix el metall)', '+3', '1d6+1', 'bludgeoning')], traits: ['Amorf', 'Corroeix el metall', 'Aparença falsa'] },
  black_pudding: { name: 'Púding negre', cr: '4', hp: 85, ac: 7, speed: 20, abilities: [16, 5, 16, 1, 6, 1],
    imm: ['acid', 'cold', 'lightning', 'slashing'], cimm: OOZE, attacks: [m('Pseudòpode (+4d8 àcid)', '+5', '1d6+3', 'bludgeoning')],
    traits: ['Amorf', 'Corrosiu (armes i armadures)', 'Reacció: es divideix si rep dany de llamp o tallant'] },
  ochre_jelly: { name: 'Gelatina ocre (LMoP)', cr: '2', hp: 45, ac: 8, speed: 10, abilities: [15, 6, 14, 2, 6, 1],
    res: ['acid'], imm: ['lightning', 'slashing'], cimm: OOZE, attacks: [m('Pseudòpode (+1d6 àcid)', '+4', '2d6+2', 'bludgeoning')],
    traits: ['Amorf', 'Reacció: es divideix si rep dany de llamp o tallant'] },
  mimic: { name: 'Mímic', cr: '2', hp: 58, ac: 12, speed: 15, abilities: [17, 12, 15, 5, 13, 8], imm: ['acid'], cimm: ['prone'],
    attacks: [m('Pseudòpode (s\'hi enganxa)', '+5', '1d8+3', 'bludgeoning'), m('Mossegada (+1d8 àcid)', '+5', '1d8+3', 'piercing')],
    traits: ['Canviar de forma', 'Adhesiu', 'Aparença falsa'] },
  pixie: { name: 'Fada (pixie, VGtM)', cr: '1/4', hp: 1, ac: 15, speed: 10, move: 'vol 30', abilities: [2, 20, 8, 10, 14, 15],
    attacks: [], traits: ['Resistència a la màgia', 'Encanteris innats (SAV/CAR, CD 12): confusió, dormir, encantament, foc feèric, fantasmes, polimorfar'] },
  will_o_wisp: { name: 'Foc follet', cr: '2', hp: 22, ac: 19, speed: 0, move: 'vol 50 (levita)', abilities: [1, 28, 10, 13, 14, 11],
    res: ['acid', 'cold', 'fire', 'necrotic', 'thunder'], nmRes: true, imm: ['lightning', 'poison'], cimm: ELEMENTAL,
    attacks: [m('Descàrrega', '+4', '2d8', 'lightning')], traits: ['Consumir vida', 'Moviment incorpori', 'Invisibilitat a voluntat', 'Il·luminació variable'] },
  vrock: { name: 'Vrock', cr: '6', hp: 104, ac: 15, speed: 40, move: 'vol 60', abilities: [17, 15, 18, 8, 13, 8], saves: { dex: 5, wis: 4, cha: 2 },
    res: ['cold', 'fire', 'lightning'], nmRes: true, imm: ['poison'], cimm: ['poisoned'],
    attacks: [m('Bec', '+6', '2d6+3', 'piercing'), m('Urpes', '+6', '2d10+3', 'slashing')], traits: ['Resistència a la màgia', 'Espores (1/dia)', 'Xiscle atordidor (1/dia, CON 14)'] },
  hezrou: { name: 'Hezrou', cr: '8', hp: 136, ac: 16, speed: 30, abilities: [19, 17, 20, 5, 12, 13], saves: { str: 7, con: 8, wis: 4 },
    res: ['cold', 'fire', 'lightning'], nmRes: true, imm: ['poison'], cimm: ['poisoned'],
    attacks: [m('Mossegada', '+7', '2d10+4', 'piercing'), m('Urpa (×2)', '+7', '2d6+4', 'slashing')], traits: ['Resistència a la màgia', 'Pudor (enverinat, CON 14)'] },
  glabrezu: { name: 'Glabrezu', cr: '9', hp: 157, ac: 17, speed: 40, abilities: [20, 15, 21, 19, 17, 16], saves: { str: 9, con: 9, wis: 7, cha: 7 },
    res: ['cold', 'fire', 'lightning'], nmRes: true, imm: ['poison'], cimm: ['poisoned'],
    attacks: [m('Pinça (agafa)', '+9', '2d10+5', 'bludgeoning', 10), m('Puny', '+9', '2d4+2', 'bludgeoning')], traits: ['Resistència a la màgia', 'Encanteris innats: foscor, confusió, volar, paraula de poder atordir'] },

  // ── Dracs joves ──────────────────────────────────────────────────────────────────────
  young_black_dragon: { name: 'Drac negre jove', cr: '7', hp: 127, ac: 18, speed: 40, move: 'vol 80, nedar 40', abilities: [19, 14, 17, 12, 11, 15], saves: { dex: 5, con: 6, wis: 3, cha: 5 },
    imm: ['acid'], attacks: [m('Mossegada (+1d8 àcid)', '+7', '2d10+4', 'piercing', 10), m('Urpa (×2)', '+7', '2d6+4', 'slashing')],
    traits: ['Alè d\'àcid (recàrrega 5–6): línia de 30 ft, 11d8 àcid, DES 14 meitat', 'Amfibi'] },
  young_red_dragon: { name: 'Drac vermell jove', cr: '10', hp: 178, ac: 18, speed: 40, move: 'vol 80, escalar 40', abilities: [23, 10, 21, 14, 11, 19], saves: { dex: 4, con: 9, wis: 4, cha: 8 },
    imm: ['fire'], attacks: [m('Mossegada (+1d6 foc)', '+10', '2d10+6', 'piercing', 10), m('Urpa (×2)', '+10', '2d6+6', 'slashing')],
    traits: ['Alè de foc (recàrrega 5–6): con de 30 ft, 16d6 foc, DES 17 meitat'] },
  young_blue_dragon: { name: 'Drac blau jove', cr: '9', hp: 152, ac: 18, speed: 40, move: 'vol 80, excavar 20', abilities: [21, 10, 19, 14, 13, 17], saves: { dex: 4, con: 8, wis: 5, cha: 7 },
    imm: ['lightning'], attacks: [m('Mossegada (+1d10 llamp)', '+9', '2d10+5', 'piercing', 10), m('Urpa (×2)', '+9', '2d6+5', 'slashing')],
    traits: ['Alè de llamp (recàrrega 5–6): línia de 60 ft, 10d10 llamp, DES 16 meitat'] },
  young_green_dragon: { name: 'Drac verd jove (Venomfang, LMoP)', cr: '8', hp: 136, ac: 18, speed: 40, move: 'vol 80, nedar 40', abilities: [19, 12, 17, 16, 13, 15], saves: { dex: 4, con: 6, wis: 4, cha: 5 },
    imm: ['poison'], cimm: ['poisoned'], attacks: [m('Mossegada (+2d6 verí)', '+7', '2d10+4', 'piercing', 10), m('Urpa (×2)', '+7', '2d6+4', 'slashing')],
    traits: ['Alè verinós (recàrrega 5–6): con de 30 ft, 12d6 verí, CON 14 meitat', 'Amfibi'] },

  // ── Gòlems i elementals ──────────────────────────────────────────────────────────────
  stone_golem: { name: 'Gòlem de pedra', cr: '10', hp: 178, ac: 17, speed: 30, abilities: [22, 9, 20, 3, 11, 1],
    imm: ['poison', 'psychic'], nmImm: true, cimm: GOLEM, attacks: [m('Cop (×2)', '+10', '3d8+6', 'bludgeoning')],
    traits: ['Forma immutable', 'Resistència a la màgia', 'Armes màgiques', 'Lentitud (recàrrega 5–6, SAV 17)'] },
  fire_elemental: { name: 'Elemental de foc', cr: '5', hp: 102, ac: 13, speed: 50, abilities: [10, 17, 16, 6, 10, 7],
    nmRes: true, imm: ['fire', 'poison'], cimm: ELEMENTAL, attacks: [m('Toc (encén, 1d10 foc per torn)', '+6', '2d6+3', 'fire')],
    traits: ['Forma de foc: qui el toca o el colpeja a 5 ft rep 1d10 de foc', 'Il·luminació', 'Susceptible a l\'aigua: 1 de fred per cada 5 ft d\'aigua'] },
  clay_golem: { name: 'Gòlem d\'argila', cr: '9', hp: 133, ac: 14, speed: 20, abilities: [20, 9, 18, 3, 8, 1],
    imm: ['acid', 'poison', 'psychic'], nmImm: true, cimm: GOLEM, attacks: [m('Cop (×2, redueix PV màx.)', '+8', '2d10+5', 'bludgeoning')],
    traits: ['Absorció d\'àcid: es cura amb el dany d\'àcid', 'Embogir', 'Resistència a la màgia', 'Accelerar (recàrrega 5–6)'] },
  flesh_golem: { name: 'Gòlem de carn', cr: '5', hp: 93, ac: 9, speed: 30, abilities: [19, 9, 18, 6, 10, 5],
    imm: ['lightning', 'poison'], nmImm: true, cimm: GOLEM, attacks: [m('Cop (×2)', '+7', '2d8+4', 'bludgeoning')],
    traits: ['Absorció de llamp: es cura amb el dany de llamp', 'Aversió al foc: desavantatge si ha rebut foc', 'Resistència a la màgia', 'Embogir'] },
  iron_golem: { name: 'Gòlem de ferro', cr: '16', hp: 210, ac: 20, speed: 30, abilities: [24, 9, 20, 3, 11, 1],
    imm: ['fire', 'poison', 'psychic'], nmImm: true, cimm: GOLEM,
    attacks: [m('Cop', '+13', '3d8+7', 'bludgeoning'), m('Espasa', '+13', '3d10+7', 'slashing', 10)],
    traits: ['Absorció de foc: es cura amb el dany de foc', 'Resistència a la màgia', 'Alè verinós (recàrrega 6): con 15 ft, 10d8 verí, CON 19'] },
  invisible_stalker: { name: 'Caçador invisible', cr: '6', hp: 104, ac: 14, speed: 50, move: 'vol 50 (levita)', abilities: [16, 19, 14, 10, 15, 11],
    nmRes: true, imm: ['poison'], cimm: ELEMENTAL, attacks: [m('Cop (×2)', '+6', '2d6+3', 'bludgeoning')], traits: ['Invisible', 'Rastrejador perfecte'] },
  water_elemental: { name: 'Elemental d\'aigua', cr: '5', hp: 114, ac: 14, speed: 30, move: 'nedar 90', abilities: [18, 14, 18, 5, 10, 8],
    res: ['acid'], nmRes: true, imm: ['poison'], cimm: ELEMENTAL, attacks: [m('Cop (×2)', '+7', '2d8+4', 'bludgeoning')],
    traits: ['Forma d\'aigua', 'Congelar: el fred el frena', 'Onada (recàrrega 4–6, FUE 15)'] },
  air_elemental: { name: 'Elemental d\'aire', cr: '5', hp: 90, ac: 15, speed: 0, move: 'vol 90 (levita)', abilities: [14, 20, 14, 6, 10, 6],
    res: ['lightning', 'thunder'], nmRes: true, imm: ['poison'], cimm: ELEMENTAL, attacks: [m('Cop (×2)', '+8', '2d8+5', 'bludgeoning')],
    traits: ['Forma d\'aire', 'Remolí (recàrrega 4–6, FUE 13)'] },
  earth_elemental: { name: 'Elemental de terra', cr: '5', hp: 126, ac: 17, speed: 30, move: 'excavar 30', abilities: [20, 8, 20, 5, 10, 5],
    vul: ['thunder'], nmRes: true, imm: ['poison'], cimm: ['exhaustion', 'paralyzed', 'petrified', 'poisoned', 'unconscious'],
    attacks: [m('Cop (×2)', '+8', '2d8+5', 'bludgeoning', 10)], traits: ['Lliscar per la terra', 'Monstre de setge (doble dany a estructures)'] },
};

const mod = (score: number) => Math.floor((score - 10) / 2);
const ORDER: AbilityId[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Bonificació de salvació d'un monstre (la del bloc si en té competència; si no, el modificador). */
export function monsterSave(mo: Monster, ab: AbilityId): number | null {
  if (mo.saves?.[ab] !== undefined) return mo.saves[ab]!;
  return mo.abilities ? mod(mo.abilities[ORDER.indexOf(ab)]) : null;
}

/** Les sis característiques en l'ordre del bloc (per omplir formularis). */
export const ABILITY_ORDER = ORDER;
