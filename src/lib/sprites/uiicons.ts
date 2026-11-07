// GENERAT per `scripts/ui-icons.py` a partir de `assets/icon-packs/`: no editar a mà.
// Full: `public/sprites/ui_icons.png` (SheetId `icons`), icones de 16×16 en files de `UI_ICON_COLS`.

export const UI_ICON_COLS = 16;
export const UI_ICON_ROWS = 4;

export const UI_ICONS = {
  fireball: 0,  // spells/fire_27
  lightning: 1,  // spells/lightning_12
  magic_beam: 2,  // spells/arcane_01
  magic_missile: 3,  // spells/arcane_12
  hideous_laughter: 4,  // spells/dark_15
  burning_hands: 5,  // spells/fire_21
  ray_of_frost: 6,  // spells/ice_25
  shocking_grasp: 7,  // spells/lightning_10
  charm_person: 8,  // spells/misc_09
  sleep: 9,  // spells/misc_21
  grease: 10,  // spells/poison_12
  sacred_flame: 11,  // spells/holy_20
  bless: 12,  // spells/holy_11
  mage_hand: 13,  // spells/arcane_11
  thaumaturgy: 14,  // spells/arcane_02
  prestidigitation: 15,  // spells/misc_20
  cure_wounds: 16,  // items/potion_01
  mage_armor: 17,  // spells/arcane_16
  light: 18,  // spells/holy_02
  shield: 19,  // spells/melee_33
  detect_magic: 20,  // spells/arcane_19
  breath_fire: 21,  // spells/fire_29
  breath_cold: 22,  // spells/ice_22
  breath_poison: 23,  // spells/poison_05
  breath_acid: 24,  // spells/poison_13
  fire_bolt: 25,  // spells/fire_03
  necrotic_ray: 26,  // spells/necromancer_02
  eye_ray: 27,  // spells/misc_05
  hold: 28,  // spells/arcane_05
  dread: 29,  // spells/dark_17
  cloud: 30,  // spells/poison_14
  vanish: 31,  // spells/misc_04
  thunder: 32,  // spells/lightning_03
  entangle: 33,  // spells/nature_10
  radiant_bolt: 34,  // spells/holy_14
  acid_arrow: 35,  // spells/poison_09
  el_fire: 36,  // spells/fire_16
  el_ice: 37,  // spells/ice_08
  el_water: 38,  // spells/water_10
  el_poison: 39,  // spells/poison_10
  el_lightning: 40,  // spells/lightning_12
  el_magic: 41,  // spells/arcane_13
  w_sword: 42,  // weapons/sword_08
  w_greatsword: 43,  // weapons/sword_07
  w_dagger: 44,  // weapons/dagger_08
  w_axe: 45,  // weapons/axe_08
  w_greataxe: 46,  // weapons/greataxe_08
  w_battleaxe: 47,  // weapons/battleaxe_08
  w_mace: 48,  // weapons/mace_08
  w_club: 49,  // weapons/mace_02
  w_hammer: 50,  // weapons/hammer_08
  w_warhammer: 51,  // weapons/warhammer_07
  w_spear: 52,  // weapons/spear_08
  w_staff: 53,  // weapons/staff_01
  w_bow: 54,  // weapons/bow_06
  w_crossbow: 55,  // weapons/crossbow_05
  w_arrow: 56,  // weapons/arrow_08
  w_scythe: 57,  // weapons/scythe_02
  w_bite: 58,  // spells/misc_17
  w_claw: 59,  // spells/melee_45
  w_fist: 60,  // spells/melee_20
  w_spell: 61,  // spells/arcane_13
} as const;

export type UiIconId = keyof typeof UI_ICONS;
