import type { Condition, Element } from '@/types';

// Versió de l'aplicació que es mostra a les pantalles de DM i jugador.
export const APP_VERSION = 'v4.13';

// Estats oficials de D&D 5e, en l'ordre de la làmina de referència.
// Cada estat porta el seu **color propi** (abans eren gairebé tots vermells/grisos):
// és el que permet endevinar d'un cop d'ull quins estats té un token quan n'acumula
// uns quants. L'isotip vectorial de cada `id` viu a `src/lib/conditions/icons.ts`.
//
// Els estats NO tenyeixen el token sencer: amb dos o tres estats alhora els tints se
// sumaven i el color final no volia dir res. L'única excepció és `invisible`, que no
// es fa amb cap `tint` sinó amb el tractament propi de `render/tokens.ts` (alpha del
// fantasma i contorn blau de guions).
export const CONDITIONS: Condition[] = [
  { id: 'blinded',       label: 'Encegat',     es: 'Cegado',       en: 'Blinded',       color: '#3f3f46' },
  { id: 'charmed',       label: 'Encisat',     es: 'Hechizado',    en: 'Charmed',       color: '#ec4899' },
  { id: 'deafened',      label: 'Ensordit',    es: 'Ensordecido',  en: 'Deafened',      color: '#a1a1aa' },
  { id: 'exhaustion',    label: 'Cansament',   es: 'Cansancio',    en: 'Exhaustion',    color: '#a16207' },
  { id: 'frightened',    label: 'Espantat',    es: 'Asustado',     en: 'Frightened',    color: '#7c3aed' },
  { id: 'grappled',      label: 'Agafat',      es: 'Agarrado',     en: 'Grappled',      color: '#0e7490' },
  { id: 'incapacitated', label: 'Incapacitat', es: 'Incapacitado', en: 'Incapacitated', color: '#dc2626' },
  { id: 'invisible',     label: 'Invisible',   es: 'Invisible',    en: 'Invisible',     color: '#67e8f9' },
  { id: 'paralyzed',     label: 'Paralitzat',  es: 'Paralizado',   en: 'Paralyzed',     color: '#facc15' },
  { id: 'petrified',     label: 'Petrificat',  es: 'Petrificado',  en: 'Petrified',     color: '#78716c' },
  { id: 'poisoned',      label: 'Enverinat',   es: 'Envenenado',   en: 'Poisoned',      color: '#16a34a' },
  { id: 'prone',         label: 'Tombat',      es: 'Derribado',    en: 'Prone',         color: '#c2410c' },
  { id: 'restrained',    label: 'Retingut',    es: 'Apresado',     en: 'Restrained',    color: '#4f46e5' },
  { id: 'stunned',       label: 'Atordit',     es: 'Aturdido',     en: 'Stunned',       color: '#f97316' },
  { id: 'unconscious',   label: 'Inconscient', es: 'Inconsciente', en: 'Unconscious',   color: '#1e40af' },
  { id: 'dying',         label: 'Morint',      es: 'Muriendo',     en: 'Dying',         color: '#7f1d1d' },
];

export const CONDITIONS_BY_ID = new Map(CONDITIONS.map(c => [c.id, c]));

export const ELEMENTS: Element[] = [
  { id: 'fire',      label: 'Fuego',   color: '#ff6b00', glow: '#ff4400', emoji: '🔥' },
  { id: 'ice',       label: 'Hielo',   color: '#7dd3fc', glow: '#38bdf8', emoji: '❄️'  },
  { id: 'water',     label: 'Agua',    color: '#3b82f6', glow: '#60a5fa', emoji: '💧' },
  { id: 'poison',    label: 'Veneno',  color: '#22c55e', glow: '#16a34a', emoji: '☠️'  },
  { id: 'lightning', label: 'Rayos',   color: '#eab308', glow: '#fde047', emoji: '⚡' },
  { id: 'magic',     label: 'Magia',   color: '#a855f7', glow: '#7c3aed', emoji: '✨' },
];

export const ELEMENTS_BY_ID = new Map(ELEMENTS.map(e => [e.id, e]));

export const PALETTE = [
  '#f0e8d8', '#555555', '#e05555', '#4f8fd6', '#52b86e',
  '#a366c4', '#e08030', '#42baba', '#d4ae38', '#92a4a4',
];

// Velocitat de moviment per defecte dels jugadors, en peus (1 casella = 5 ft)
export const DEFAULT_SPEED_FT = 30;

// Radi de visió per defecte dins de sales fosques, en peus (llum que emet cada token de jugador)
export const DEFAULT_VISION_FT = 30;

// Party actual de la campanya. La vida (hpMax) és provisional: els jugadors van
// pujar de nivell i encara no en tenim els valors reals — s'ajustaran des del
// PlayersPanel quan es confirmin a la propera sessió.
export const DEFAULT_PARTY = [
  { name: 'Jaume III',  color: '#e05555', hpMax: 45, speed: 30 }, // Vermell
  { name: 'Liriandor',  color: '#4f8fd6', hpMax: 45, speed: 30 }, // Blau
  { name: 'Yunquerin',  color: '#d4ae38', hpMax: 45, speed: 30 }, // Groc
  { name: 'Espardeny',  color: '#52b86e', hpMax: 45, speed: 30 }, // Verd
  { name: 'Cigarramic', color: '#a366c4', hpMax: 45, speed: 30 }, // Lila
];

export const ENEMY_TEMPLATES = [
  { id: 'goblin',   name: 'Goblin',   color: '#3a8a3a', hpMax: 7,   R: 25, sm: 0.70 },
  { id: 'wolf',     name: 'Llop',     color: '#8a7060', hpMax: 11,  R: 28, sm: 0.80 },
  { id: 'bear',     name: 'Ós',       color: '#8B5E3C', hpMax: 34,  R: 39, sm: 1.10 },
  { id: 'zombie',   name: 'Zombie',   color: '#4a7a4a', hpMax: 22,  R: 33, sm: 0.95 },
  { id: 'skeleton', name: 'Esquelet', color: '#c8b87a', hpMax: 13,  R: 26, sm: 0.75 },
  { id: 'orc',      name: 'Orc',      color: '#5a7a2a', hpMax: 15,  R: 35, sm: 1.00 },
  { id: 'troll',    name: 'Troll',    color: '#3a6030', hpMax: 84,  R: 53, sm: 1.50 },
  { id: 'rat',      name: 'Rata',     color: '#7a6060', hpMax: 2,   R: 14, sm: 0.40 },
  { id: 'bandit',   name: 'Bandid',   color: '#6a5a4a', hpMax: 11,  R: 35, sm: 1.00 },
  { id: 'spider',   name: 'Aranya',   color: '#3a3a5a', hpMax: 4,   R: 16, sm: 0.45 },
  { id: 'dragon',   name: 'Drac',     color: '#c0392b', hpMax: 178, R: 70, sm: 2.00 },
] as const;

export type EnemyTemplateId = typeof ENEMY_TEMPLATES[number]['id'];

export { ENEMY_IMAGES } from '@/lib/enemy-images';

export const SPELL_TYPES = [
  { type: 'fireball',          emoji: '🔥', color: '#ff8800', title: 'Bola de fuego',    mode: 'path' },
  { type: 'lightning',         emoji: '⚡', color: '#ffd200', title: 'Rayo eléctrico',   mode: 'path' },
  { type: 'magic_beam',        emoji: '✨', color: '#9988ff', title: 'Rayo mágico',      mode: 'path' },
  { type: 'magic_missile',     emoji: '🔮', color: '#c084fc', title: 'Proyectil mágico', mode: 'line' },
  { type: 'hideous_laughter',  emoji: '😂', color: '#facc15', title: 'Risa horrible',    mode: 'line' },
  { type: 'burning_hands',     emoji: '🤲', color: '#f97316', title: 'Manos ardientes',  mode: 'line' },
  { type: 'sleep',             emoji: '💤', color: '#818cf8', title: 'Dormir',           mode: 'area' },
  { type: 'grease',            emoji: '🫙', color: '#a3e635', title: 'Grasa',            mode: 'area' },
] as const;

// Area spell rules: AoE radius and max cast range in feet (1 square = 5ft)
export const AREA_SPELL_DATA: Record<string, { aoeRadiusFt: number; rangeFt: number; color: string; emoji: string }> = {
  sleep:  { aoeRadiusFt: 20, rangeFt: 90,  color: '#818cf8', emoji: '💤' },
  grease: { aoeRadiusFt: 10, rangeFt: 60,  color: '#a3e635', emoji: '🫙' },
};

export const C = {
  bg:          '#0d1117',
  panel:       '#161b22',
  dark:        '#080c12',
  border:      '#21262d',
  accent:      '#d4a017',
  text:        '#c9d1d9',
  bright:      '#e6edf3',
  dim:         '#8b949e',
  extras:      '#39d353',
  room:        '#58a6ff',
  enemy:       '#f85149',
  ok:          '#3fb950',
  warn:        '#d29922',
  hpHigh:      '#56d364',  // HP > 50% — rgb(86,211,100)
  hpMid:       '#e3b341',  // HP 25-50%
  magic:       '#a855f7',  // màgia / cinematica — rgb(168,85,247)
  magicBright: '#c084fc',  // màgia clara (magic_missile, text cinematica)
  enemyHL:     '#ffd200',  // resaltat d'enemics en combat (deliberadament ≠ accent)
} as const;

export const BC_CHANNEL = 'rpg_map_sync_v18';
export const TOKEN_LERP  = 0.07;
export const TSCALE      = 90;

// 1 grid cell = 5ft (D&D convention). Token radius (px) = gridSize * 0.09 * feet,
// so a 5ft (medium) token comes out to gridSize*0.45 — matching the existing
// "mida automàtica" auto-fit factor used by sizeAllTokens/addLibEnemy.
const FT_TO_RADIUS_FACTOR = 0.09;

export function radiusFromFeet(feet: number, gridSize: number): number {
  const gs = gridSize > 0 ? gridSize : 70;
  return Math.max(4, Math.round(gs * FT_TO_RADIUS_FACTOR * feet));
}

export function feetFromRadius(radiusPx: number, gridSize: number): number {
  const gs = gridSize > 0 ? gridSize : 70;
  return Math.round((radiusPx / (gs * FT_TO_RADIUS_FACTOR)) * 2) / 2;
}

// Pixel-art yellow wand cursor (hotspot 3,3)
const _wand = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect x="2" y="0" width="2" height="6" fill="white" opacity=".85"/><rect x="0" y="2" width="6" height="2" fill="white" opacity=".85"/><rect x="2" y="2" width="2" height="2" fill="white"/><rect x="5" y="5" width="3" height="3" fill="%23ffe000"/><rect x="7" y="7" width="3" height="3" fill="%23e6c000"/><rect x="9" y="9" width="3" height="3" fill="%23ffd700"/><rect x="11" y="11" width="3" height="3" fill="%23e6c000"/><rect x="13" y="13" width="3" height="3" fill="%23ffd700"/><rect x="15" y="15" width="3" height="3" fill="%23e6c000"/><rect x="17" y="17" width="3" height="3" fill="%23ffd700"/><rect x="19" y="19" width="3" height="3" fill="%23e6c000"/><rect x="21" y="21" width="3" height="3" fill="%23d4a017"/><rect x="23" y="23" width="3" height="3" fill="%238b5e00"/><rect x="25" y="25" width="3" height="3" fill="%237a4e00"/><rect x="27" y="27" width="3" height="3" fill="%235c3a00"/></svg>`;
export const WAND_CURSOR = `url("data:image/svg+xml,${_wand}") 3 3, crosshair`;
