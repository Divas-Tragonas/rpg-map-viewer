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

// Font de la UI. Registre "llibre medieval" (Diablo 2): serifa clàssica del
// sistema, molt llegible a mides petites. La resta d'estils inline hereten
// d'aquesta declaració al node arrel de DMView. Les fonts serif explícites
// (revelador de text) tenen fontFamily inline propi i no es veuen afectades.
export const FONT_UI = DARK_FANTASY
  ? "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif"
  : 'system-ui,sans-serif';

// Blackletter per als fragments de "registre alt" (títols, benvingudes).
// Només s'usa quan DARK_FANTASY és actiu.
export const FONT_BLACKLETTER = "'Pirata One', Georgia, serif";

// Colors del registre alt (fragments): vermell sang i or antic.
export const DF_BLOOD = '#a01820';
export const DF_GOLD  = '#c7a55a';

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

// Paleta dark fantasy estil Diablo 2: pedra i fusta fosca càlida com a
// substrat, text pergamí/os, or antic APAGAT (mai groc viu), vermell sang
// fosc, i cap blau/violeta cridaner — tot desaturat i càlid.
const C_DARK_FANTASY = {
  bg:          '#0c0a08',  // pedra fosca
  panel:       '#1a1410',  // fusta/pedra càlida
  dark:        '#070503',
  border:      '#4a3826',  // pedra tallada marró
  accent:      '#c7a55a',  // or antic (D2 gold)
  text:        '#d8c8a8',  // pergamí/os
  bright:      '#f0e6cc',
  dim:         '#8a7a62',  // marró grisós càlid
  extras:      '#5a9a5a',
  room:        '#7590a8',  // blau acer apagat
  enemy:       '#a02818',  // vermell sang fosc
  ok:          '#5a9a5a',
  warn:        '#c08a2a',
  hpHigh:      '#5aa050',
  hpMid:       '#c0a040',
  magic:       '#9a68c8',
  magicBright: '#c39ae8',
  enemyHL:     '#e8c04a',  // or de ressaltat (apagat, ≠ groc llampant)
};

export type Palette = typeof C_ORIGINAL;

export const ACTIVE_PALETTE: Palette = DARK_FANTASY ? C_DARK_FANTASY : C_ORIGINAL;
