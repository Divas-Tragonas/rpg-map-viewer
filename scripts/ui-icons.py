#!/usr/bin/env python3
"""
Atles d'icones de la interfície (v5 snapshot 12): la tria de `assets/icon-packs/` que fa servir l'app
(conjurs, poders de les criatures, elements de les zones i armes dels atacs).

Genera:
  - `public/sprites/ui_icons.png` — icones de 16×16 en una quadrícula de `COLS` columnes.
  - `src/lib/sprites/uiicons.ts`  — GENERAT: índex de cada icona pel seu nom.

Per canviar-ne una: tocar `PICKS` (nom → `<full>/<secció>_NN`, veure els fulls numerats
`assets/icon-packs/<full>.png`) i tornar a executar `python3 scripts/ui-icons.py`.
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'icon-packs')
OUT_PNG = os.path.join(ROOT, 'public', 'sprites', 'ui_icons.png')
OUT_TS = os.path.join(ROOT, 'src', 'lib', 'sprites', 'uiicons.ts')
COLS = 16

PICKS = {
    # ── Conjurs dels grimoris (`SPELL_TYPES`) ──
    'fireball':         'spells/fire_27',
    'lightning':        'spells/lightning_12',
    'magic_beam':       'spells/arcane_01',
    'magic_missile':    'spells/arcane_12',
    'hideous_laughter': 'spells/dark_15',
    'burning_hands':    'spells/fire_21',
    'ray_of_frost':     'spells/ice_25',
    'shocking_grasp':   'spells/lightning_10',
    'charm_person':     'spells/misc_09',
    'sleep':            'spells/misc_21',
    'grease':           'spells/poison_12',
    'sacred_flame':     'spells/holy_20',
    'bless':            'spells/holy_11',
    'mage_hand':        'spells/arcane_11',
    'thaumaturgy':      'spells/arcane_02',
    'prestidigitation': 'spells/misc_20',
    'cure_wounds':      'items/potion_01',      # vermell de poció: l'usuari no vol la curació verda
    'mage_armor':       'spells/arcane_16',
    'light':            'spells/holy_02',
    'shield':           'spells/melee_33',
    'detect_magic':     'spells/arcane_19',
    # ── Poders de les criatures ──
    'breath_fire':      'spells/fire_29',
    'breath_cold':      'spells/ice_22',
    'breath_poison':    'spells/poison_05',
    'breath_acid':      'spells/poison_13',
    'fire_bolt':        'spells/fire_03',
    'necrotic_ray':     'spells/necromancer_02',
    'eye_ray':          'spells/misc_05',
    'hold':             'spells/arcane_05',
    'dread':            'spells/dark_17',
    'cloud':            'spells/poison_14',
    'vanish':           'spells/misc_04',
    'thunder':          'spells/lightning_03',
    'entangle':         'spells/nature_10',
    'radiant_bolt':     'spells/holy_14',
    'acid_arrow':       'spells/poison_09',
    # ── Elements de les zones màgiques (`ELEMENTS`) ──
    'el_fire':          'spells/fire_16',
    'el_ice':           'spells/ice_08',
    'el_water':         'spells/water_10',
    'el_poison':        'spells/poison_10',
    'el_lightning':     'spells/lightning_12',
    'el_magic':         'spells/arcane_13',
    # ── Armes dels atacs (`attackIcon`) ──
    'w_sword':          'weapons/sword_08',
    'w_greatsword':     'weapons/sword_07',
    'w_dagger':         'weapons/dagger_08',
    'w_axe':            'weapons/axe_08',
    'w_greataxe':       'weapons/greataxe_08',
    'w_battleaxe':      'weapons/battleaxe_08',
    'w_mace':           'weapons/mace_08',
    'w_club':           'weapons/mace_02',
    'w_hammer':         'weapons/hammer_08',
    'w_warhammer':      'weapons/warhammer_07',
    'w_spear':          'weapons/spear_08',
    'w_staff':          'weapons/staff_01',
    'w_bow':            'weapons/bow_06',
    'w_crossbow':       'weapons/crossbow_05',
    'w_arrow':          'weapons/arrow_08',
    'w_scythe':         'weapons/scythe_02',
    'w_bite':           'spells/misc_17',
    'w_claw':           'spells/melee_45',
    'w_fist':           'spells/melee_20',
    'w_spell':          'spells/arcane_13',
}


def main():
    names = list(PICKS)
    rows = (len(names) + COLS - 1) // COLS
    atlas = Image.new('RGBA', (COLS * 16, rows * 16), (0, 0, 0, 0))
    for i, n in enumerate(names):
        im = Image.open(os.path.join(SRC, PICKS[n] + '.png')).convert('RGBA')
        assert im.size == (16, 16), n
        atlas.paste(im, ((i % COLS) * 16, (i // COLS) * 16))
    atlas.save(OUT_PNG, optimize=True)
    lines = [
        '// GENERAT per `scripts/ui-icons.py` a partir de `assets/icon-packs/`: no editar a mà.',
        '// Full: `public/sprites/ui_icons.png` (SheetId `icons`), icones de 16×16 en files de `UI_ICON_COLS`.',
        '',
        f'export const UI_ICON_COLS = {COLS};',
        f'export const UI_ICON_ROWS = {rows};',
        '',
        'export const UI_ICONS = {',
    ]
    for i, n in enumerate(names):
        lines.append(f"  {n}: {i},  // {PICKS[n]}")
    lines += ['} as const;', '', 'export type UiIconId = keyof typeof UI_ICONS;', '']
    with open(OUT_TS, 'w') as fh:
        fh.write('\n'.join(lines))
    print(f'{OUT_PNG}: {len(names)} icones')


if __name__ == '__main__':
    main()
