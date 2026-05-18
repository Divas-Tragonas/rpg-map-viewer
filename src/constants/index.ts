import type { Condition, Element } from '@/types';

export const CONDITIONS: Condition[] = [
  { id: 'grappled',      label: 'Agarrado',     bg: '#6b7280', tint: null      },
  { id: 'frightened',    label: 'Asustado',     bg: '#7c3aed', tint: null      },
  { id: 'stunned',       label: 'Aturdido',     bg: '#ea580c', tint: '#f97316' },
  { id: 'blinded',       label: 'Cegado',       bg: '#374151', tint: null      },
  { id: 'prone',         label: 'Derribado',    bg: '#78350f', tint: null      },
  { id: 'deafened',      label: 'Ensordecido',  bg: '#9ca3af', tint: null      },
  { id: 'poisoned',      label: 'Envenenado',   bg: '#15803d', tint: '#22c55e' },
  { id: 'charmed',       label: 'Hechizado',    bg: '#be185d', tint: '#f472b6' },
  { id: 'unconscious',   label: 'Inconsciente', bg: '#1e293b', tint: '#475569' },
  { id: 'invisible',     label: 'Invisible',    bg: '#0369a1', tint: null      },
  { id: 'paralyzed',     label: 'Paralizado',   bg: '#a16207', tint: '#eab308' },
  { id: 'petrified',     label: 'Petrificado',  bg: '#57534e', tint: '#a8a29e' },
  { id: 'restrained',    label: 'Apresado',     bg: '#92400e', tint: null      },
  { id: 'incapacitated', label: 'Incapacitado', bg: '#991b1b', tint: null      },
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
  '#e8e0d0', '#2c2c2c', '#b84040', '#4472a8', '#4a9460',
  '#8a52a0', '#c46e28', '#3a9090', '#b09030', '#7a8888',
];

export const DEFAULT_PARTY = [
  { name: 'Jugador 1', color: '#4472a8', hpMax: 45 },
  { name: 'Jugador 2', color: '#b84040', hpMax: 60 },
  { name: 'Jugador 3', color: '#4a9460', hpMax: 38 },
  { name: 'Jugador 4', color: '#8a52a0', hpMax: 52 },
  { name: 'Jugador 5', color: '#c46e28', hpMax: 42 },
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
  { type: 'fireball',   emoji: '🔥', color: '#ff8800', title: 'Bola de fuego'  },
  { type: 'lightning',  emoji: '⚡', color: '#ffd200', title: 'Rayo eléctrico' },
  { type: 'magic_beam', emoji: '✨', color: '#9988ff', title: 'Rayo mágico'    },
] as const;

export const C = {
  bg:     '#0d1117',
  panel:  '#161b22',
  dark:   '#080c12',
  border: '#21262d',
  accent: '#d4a017',
  text:   '#c9d1d9',
  bright: '#e6edf3',
  dim:    '#8b949e',
  extras: '#39d353',
  zone:   '#58a6ff',
  enemy:  '#f85149',
  ok:     '#3fb950',
  warn:   '#d29922',
} as const;

export const BC_CHANNEL = 'rpg_map_sync_v18';
export const TOKEN_LERP  = 0.07;
export const TSCALE      = 90;
