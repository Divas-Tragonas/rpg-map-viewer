// ============================================================================
// FONAMENT DEL REDESIGN — sistema de tokens
// ============================================================================
// Els tokens CSS (globals.css, scoped a html.theme-df) i aquest mirall TS
// són la ÚNICA font de color de l'app. El mirall TS existeix perquè el
// canvas (render phases) no pot llegir CSS custom properties.
// Posar DARK_FANTASY a `false` desactiva el tema sencer (classe CSS,
// fonts, overlay) i recupera la paleta original.
// ============================================================================

export const DARK_FANTASY = true;

export const THEME_CLASS = DARK_FANTASY ? 'theme-df' : '';

// --------------------------------------------------------------------------
// TOKENS — mirall exacte de les CSS custom properties de globals.css.
// --------------------------------------------------------------------------
export const T = {
  bg:      '#0A0A0C',
  panel:   '#14141C',
  panelIn: '#0D0D14',
  bevelHi: '#4A4A5A',
  bevelLo: '#000000',
  accent:  '#C41E1E',
  gold:    '#E8B84B',
  amber:   '#FFAA00',
  bone:    '#E8E0D0',
  danger:  '#FF5555',
  magic:   '#AA00AA',
  ok:      '#55AA55',
  dim:     '#5A5A6A',
} as const;

// Mòdul de layout: tot padding/gap/mida és múltiple d'aquest valor.
export const U = 8;

// Fonts: VT323 per a dades i etiquetes, Pirata One NOMÉS per a capçaleres.
// next/font (layout.tsx) genera noms de família hashejats i els exposa a
// --font-vt323 / --font-pirata; per això les referències van via var().
export const FONT_UI = DARK_FANTASY
  ? "var(--font-vt323), 'Courier New', monospace"
  : 'system-ui,sans-serif';
export const FONT_BLACKLETTER = 'var(--font-pirata), serif';

// Registre alt (fragments): sang i or.
export const DF_BLOOD = T.accent;
export const DF_GOLD  = T.gold;

// --------------------------------------------------------------------------
// Paleta original (pre-redesign). NO TOCAR: és la referència per revertir.
// --------------------------------------------------------------------------
const C_ORIGINAL = {
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
};

// --------------------------------------------------------------------------
// Adaptador de compatibilitat: els components existents (encara no
// reconstruïts) i les render phases del canvas consumeixen `C`. Aquest
// mapa tradueix la interfície vella als tokens nous. Quan un component es
// reconstrueixi, ha de passar a consumir `T` (o les CSS vars) directament.
// Els dos únics colors que no són tokens literals (room, magicBright) són
// brights CGA coherents amb la ficció de paleta de 16 colors.
// --------------------------------------------------------------------------
const C_FROM_TOKENS = {
  bg:          T.bg,
  panel:       T.panel,
  dark:        T.panelIn,
  border:      T.bevelHi,
  accent:      T.gold,     // l'accent "actiu/ressaltat" de la UI vella és l'or
  text:        T.bone,
  bright:      T.bone,
  dim:         T.dim,
  extras:      T.ok,
  room:        '#5555FF',  // CGA bright blue (sales al canvas)
  enemy:       T.accent,   // vermell sang
  ok:          T.ok,
  warn:        T.amber,
  hpHigh:      T.ok,
  hpMid:       T.amber,
  magic:       T.magic,
  magicBright: '#FF55FF',  // CGA bright magenta
  enemyHL:     T.amber,
};

export type Palette = typeof C_ORIGINAL;

export const ACTIVE_PALETTE: Palette = DARK_FANTASY ? C_FROM_TOKENS : C_ORIGINAL;
