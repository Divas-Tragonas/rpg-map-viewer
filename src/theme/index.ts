// ============================================================================
// TEMA VISUAL DE L'APP — interruptor únic
// ============================================================================
// Posar DARK_FANTASY a `false` per tornar EXACTAMENT a l'estètica original.
// Tot el que depèn del tema (paleta C, fonts, overlay CRT, CSS global,
// pantalles de benvinguda) penja d'aquesta constant. No cal tocar cap altre
// fitxer per revertir.
// ============================================================================

export const DARK_FANTASY = true;

// Classe aplicada a <html> quan el tema fosc està actiu. Les regles CSS del
// tema a globals.css van totes scoped sota `html.theme-df`.
export const THEME_CLASS = DARK_FANTASY ? 'theme-df' : '';

// Font de la UI. La resta d'estils inline hereten d'aquesta declaració al
// node arrel de DMView. Les fonts serif explícites (revelador de text)
// tenen fontFamily inline propi i no es veuen afectades.
export const FONT_UI = DARK_FANTASY
  ? "'VT323', 'Courier New', ui-monospace, monospace"
  : 'system-ui,sans-serif';

// Blackletter per als fragments de "registre alt" (títols, benvingudes).
// Només s'usa quan DARK_FANTASY és actiu.
export const FONT_BLACKLETTER = "'Pirata One', 'VT323', serif";

// Colors del registre alt (fragments): vermell sang i or.
export const DF_BLOOD = '#a01820';
export const DF_GOLD  = '#e8b84a';

// Paleta original (GitHub-dark). NO TOCAR: és la referència per revertir.
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

// Paleta dark fantasy: negre com a substrat, ombres desplaçades cap a
// magenta/blau fred, llums cap a groc. Les vores són BRONZE VISIBLE (no
// gris fosc): cada panell llegeix com a ferro reblat, no com a card web.
const C_DARK_FANTASY = {
  bg:          '#060409',
  panel:       '#191022',
  dark:        '#030204',
  border:      '#6b4a24',  // bronze — vores visibles, "apparatus"
  accent:      '#ffb020',  // àmbar fòsfor viu
  text:        '#e8d5a0',  // àmbar pergamí
  bright:      '#fff2c8',
  dim:         '#8f7ba6',  // violeta fred (ombres cap a magenta)
  extras:      '#4fc06a',
  room:        '#4f90d8',
  enemy:       '#e03828',
  ok:          '#4fc06a',
  warn:        '#e0a020',
  hpHigh:      '#63c95c',
  hpMid:       '#e6b93f',
  magic:       '#b45cf0',
  magicBright: '#d79cff',
  enemyHL:     '#ffd200',
};

export type Palette = typeof C_ORIGINAL;

export const ACTIVE_PALETTE: Palette = DARK_FANTASY ? C_DARK_FANTASY : C_ORIGINAL;
