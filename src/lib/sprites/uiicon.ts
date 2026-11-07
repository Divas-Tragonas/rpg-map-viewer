/**
 * Icones de pixel art de la interfície (v5 snapshot 12): conjurs, poders, elements de les zones i armes
 * dels atacs, del full `public/sprites/ui_icons.png` (tria de `assets/icon-packs/`, generat per
 * `scripts/ui-icons.py`). Substitueixen els emojis, que a Windows sortien com a glifs monocroms.
 *
 * Es pinten sempre ampliades sense suavitzar i a múltiples enters de 16 px (`PixelIcon`), o sigui
 * nítides a qualsevol pantalla.
 */
import { UI_ICONS, UI_ICON_COLS, UI_ICON_ROWS, type UiIconId } from './uiicons';
import { SPRITES_URL } from './pack';

export { UI_ICONS, UI_ICON_COLS, UI_ICON_ROWS, type UiIconId };
export const UI_ICONS_URL = `${SPRITES_URL}ui_icons.png`;

/** El nom és una icona del full? (els conjurs per `type`, els elements amb `el_`). */
export const isUiIcon = (name: string | undefined | null): name is UiIconId => !!name && name in UI_ICONS;

/** Columna i fila d'una icona dins del full. */
export function uiIconCell(id: UiIconId): { col: number; row: number } {
  const i = UI_ICONS[id];
  return { col: i % UI_ICON_COLS, row: Math.floor(i / UI_ICON_COLS) };
}

/** Icona d'un element de zona màgica (`ELEMENTS[].id`). */
export const elementIcon = (id: string): UiIconId | null => isUiIcon(`el_${id}`) ? `el_${id}` as UiIconId : null;

// Paraules clau del nom d'un atac (català, castellà i anglès, com arriben de les fitxes i del bestiari).
const WEAPON_WORDS: [RegExp, UiIconId][] = [
  [/ballest|crossbow/i, 'w_crossbow'],
  [/\barc\b|arco|\bbow\b|longbow|shortbow/i, 'w_bow'],
  [/fletx|flecha|arrow|virot|dart|dardo/i, 'w_arrow'],
  [/daga|dagger|punyal|pu[ñn]al|ganivet|cuchill|knife|stiletto/i, 'w_dagger'],
  [/destral de guerra|gran destral|greataxe|gran hacha|hacha a dos/i, 'w_greataxe'],
  [/destral de batalla|battleaxe|hacha de batalla/i, 'w_battleaxe'],
  [/destral|hacha|\baxe\b|handaxe/i, 'w_axe'],
  [/martell de guerra|warhammer|martillo de guerra|maul|mall/i, 'w_warhammer'],
  [/martell|martillo|hammer/i, 'w_hammer'],
  [/estrella del mat|morningstar|lucero|maça|maza|\bmace\b|flail|mangual/i, 'w_mace'],
  [/garrot|porra|club|greatclub|clava/i, 'w_club'],
  [/llança|lanza|spear|pike|pica|javelin|javelina|trident|tridente|alabarda|halberd|glaive|guja/i, 'w_spear'],
  [/bast[oó]|b[aá]culo|staff|quarterstaff|vara/i, 'w_staff'],
  [/dall|guadaña|scythe|falç|hoz|sickle/i, 'w_scythe'],
  [/espasa gran|mandoble|greatsword|montant/i, 'w_greatsword'],
  [/espasa|espada|sword|scimitar|cimitarra|rapier|estoque|sable/i, 'w_sword'],
  [/mossegada|mordisco|mordedura|\bbite\b/i, 'w_bite'],
  [/urpa|garra|claw|talon|esgarrap|zarpa/i, 'w_claw'],
  [/cop de puny|pu[ñn]etazo|unarmed|desarmat|slam|embestida|gore|cornada|tentacle|tent[aá]culo|cop\b|golpe/i, 'w_fist'],
];

/** Icona d'un atac: per l'arma del nom; si no, pel tipus (cos a cos, a distància, llançadissa). */
export function attackIcon(name: string, kind?: string): UiIconId {
  for (const [re, id] of WEAPON_WORDS) if (re.test(name)) return id;
  if (/spell|conjur|hechizo|m[aà]gi/i.test(name)) return 'w_spell';
  return kind === 'ranged' ? 'w_bow' : kind === 'thrown' ? 'w_dagger' : 'w_sword';
}
