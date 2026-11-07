# Icones en pixel art (`assets/icon-packs/`)

Les quatre captures del paquet «UPSCALE» (v5 snapshot 12), **separades en icones soltes de 16×16
amb el fons transparent**: 1.686 icones. Les captures (`originals/`) eren pixel art ampliat ×1,9085
amb suavitzat (per això es veien borroses); `scripts/icons-extract.py` en recupera la resolució
original (el centre de cada píxel d'art) i treu el panell i l'ombra. A l'app es pinten ampliades
sense suavitzar, a múltiples de 16 px: nítides a qualsevol mida.

**No es serveixen** (no són a `public/`). L'app només carrega `public/sprites/ui_icons.png`, la tria
de `scripts/ui-icons.py`.

**Fer servir una icona nova**: buscar-la al full numerat de la seva carpeta (`spells.png`,
`weapons.png`, `gear.png`, `items.png`: una fila per secció, el número és el `NN` del fitxer),
afegir-la a `PICKS` de `scripts/ui-icons.py` (`'nom': 'carpeta/secció_NN'`), executar
`python3 scripts/ui-icons.py` i pintar-la amb `<PixelIcon name="nom" />` (o `blit(ctx, 'icons', …)`
al canvas, veure `uiIconCell`).

⚠️ El `.zip` no portava llicència: abans de publicar l'app fora de la colla, comprovar les
condicions de l'autor del paquet.

| Carpeta | Seccions (fitxers `secció_NN.png`) | Icones |
|---|---|---|
| `spells/` | fire (29), ice (28), nature (28), air (20), holy (20), blood (19), necromancer (19), earth (27), dark (23), poison (35), water (25), lightning (20), arcane (21), ranger (22), melee (54), misc (22) | 412 |
| `weapons/` | sword (56), staff (53), warhammer (37), bow (37), spear (40), greataxe (47), crossbow (38), dagger (42), mace (37), battleaxe (45), arrow (34), axe (44), hammer (38), scythe (2) | 550 |
| `gear/` | shield (30), headpiece (58), chestpiece (53), gloves (31), boots (33), cloak (20), amulet (38), belt (32), ring (26) | 321 |
| `items/` | potion (45), shovel (24), fishing_pole (23), consumable (90), crafting (119), misc (58), magic_item (44) | 403 |

## Les que fa servir l'app (`scripts/ui-icons.py`)

| Fitxer | Nom a l'app |
|---|---|
| `items/potion_01.png` | `cure_wounds` |
| `spells/arcane_01.png` | `magic_beam` |
| `spells/arcane_02.png` | `thaumaturgy` |
| `spells/arcane_05.png` | `hold` |
| `spells/arcane_11.png` | `mage_hand` |
| `spells/arcane_12.png` | `magic_missile` |
| `spells/arcane_13.png` | `el_magic`, `w_spell` |
| `spells/arcane_16.png` | `mage_armor` |
| `spells/arcane_19.png` | `detect_magic` |
| `spells/dark_15.png` | `hideous_laughter` |
| `spells/dark_17.png` | `dread` |
| `spells/fire_03.png` | `fire_bolt` |
| `spells/fire_16.png` | `el_fire` |
| `spells/fire_21.png` | `burning_hands` |
| `spells/fire_27.png` | `fireball` |
| `spells/fire_29.png` | `breath_fire` |
| `spells/holy_02.png` | `light` |
| `spells/holy_11.png` | `bless` |
| `spells/holy_14.png` | `radiant_bolt` |
| `spells/holy_20.png` | `sacred_flame` |
| `spells/ice_08.png` | `el_ice` |
| `spells/ice_22.png` | `breath_cold` |
| `spells/ice_25.png` | `ray_of_frost` |
| `spells/lightning_03.png` | `thunder` |
| `spells/lightning_10.png` | `shocking_grasp` |
| `spells/lightning_12.png` | `lightning`, `el_lightning` |
| `spells/melee_20.png` | `w_fist` |
| `spells/melee_33.png` | `shield` |
| `spells/melee_45.png` | `w_claw` |
| `spells/misc_04.png` | `vanish` |
| `spells/misc_05.png` | `eye_ray` |
| `spells/misc_09.png` | `charm_person` |
| `spells/misc_17.png` | `w_bite` |
| `spells/misc_20.png` | `prestidigitation` |
| `spells/misc_21.png` | `sleep` |
| `spells/nature_10.png` | `entangle` |
| `spells/necromancer_02.png` | `necrotic_ray` |
| `spells/poison_05.png` | `breath_poison` |
| `spells/poison_09.png` | `acid_arrow` |
| `spells/poison_10.png` | `el_poison` |
| `spells/poison_12.png` | `grease` |
| `spells/poison_13.png` | `breath_acid` |
| `spells/poison_14.png` | `cloud` |
| `spells/water_10.png` | `el_water` |
| `weapons/arrow_08.png` | `w_arrow` |
| `weapons/axe_08.png` | `w_axe` |
| `weapons/battleaxe_08.png` | `w_battleaxe` |
| `weapons/bow_06.png` | `w_bow` |
| `weapons/crossbow_05.png` | `w_crossbow` |
| `weapons/dagger_08.png` | `w_dagger` |
| `weapons/greataxe_08.png` | `w_greataxe` |
| `weapons/hammer_08.png` | `w_hammer` |
| `weapons/mace_02.png` | `w_club` |
| `weapons/mace_08.png` | `w_mace` |
| `weapons/scythe_02.png` | `w_scythe` |
| `weapons/spear_08.png` | `w_spear` |
| `weapons/staff_01.png` | `w_staff` |
| `weapons/sword_07.png` | `w_greatsword` |
| `weapons/sword_08.png` | `w_sword` |
| `weapons/warhammer_07.png` | `w_warhammer` |
