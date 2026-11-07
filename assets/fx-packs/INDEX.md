# Paquets d'efectes en pixel art (`assets/fx-packs/`)

Tots els paquets que va passar el propietari a la v5 snapshot 10 (`NEW_PIXEL_ART_PACK.zip`), **sencers**:
fulls, fotogrames solts i GIF de previsualització, amb els noms de fitxer originals (només s'han
canviat els noms de les carpetes de dalt i s'ha tret un `desktop.ini`). **No es serveixen**: no són
a `public/`. L'app només carrega l'atles `public/sprites/fx_anims.png`, que genera
`scripts/fx-atlas.py` amb la tria que es fa servir.

**Fer servir una textura que encara no és a l'atles**: afegir-la a `ANIMS` de
`scripts/fx-atlas.py`, executar `python3 scripts/fx-atlas.py` i pintar-la amb `drawAnim`
(`src/lib/sprites/fxanim.ts`) pel seu `id`. La columna «Atles» diu l'`id` de les que ja hi són.

⚠️ El `.zip` no portava cap fitxer de llicència. Són paquets gratuïts (SoggySocks, «Free Pixel Fire
and Elemental Effects», «Magic Pack 9», mostra del «Magic VFX Pack 1»); abans de publicar l'app fora
de la colla, comprovar les condicions de cada autor a la pàgina d'on es van baixar.

| Carpeta | Paquet original |
|---|---|
| `fire-elemental/` | Free Pixel Fire and Elemental Effects (16 efectes a 32 i 64 px, 12 fps; vegeu `CATALOG.txt` i `contact_sheet.png`) |
| `magic-pack-9/` | Magic Pack 9 files (4 efectes en fotogrames solts + GIF) |
| `magic-vfx-1/` | Magic VFX Pack 1 – Sample (Impact i Whirlwind, fotogrames solts i full) |
| `soggy-combat/` | SoggySocks Combat FX (fulls de cel·les de 100 px) |
| `soggy-earth/` | SoggySocks Earth FX |
| `soggy-status/` | SoggySocks FX Status Effects (cel·les de 50 px) |
| `soggy-lightning/` | SoggySocks Lightning FX (blau i groc) |
| `soggy-nature/` | SoggySocks Nature FX |
| `soggy-water/` | SoggySocks Water FX |
| `soggy-icons/` | SoggySocks Mega Pack Icons (30 icones de 16 px: objectes; no són efectes) |

Els fulls són una tira horitzontal de cel·les quadrades (l'alçada del full), llevat de les icones (16 px).


## `fire-elemental/`

| Fitxer | Mida | Atles |
|---|---|---|
| `CATALOG.txt` | txt | — |
| `contact_sheet.png` | 1536×2048 | — |
| `effects/01_campfire/32x32/campfire_32x32.gif` | GIF | — |
| `effects/01_campfire/32x32/campfire_32x32_preview_x8.gif` | GIF | — |
| `effects/01_campfire/32x32/campfire_32x32_sheet.png` | 384×32 · 12 cel·les de 32 | — |
| `effects/01_campfire/64x64/campfire_64x64.gif` | GIF | — |
| `effects/01_campfire/64x64/campfire_64x64_preview_x4.gif` | GIF | — |
| `effects/01_campfire/64x64/campfire_64x64_sheet.png` | 768×64 · 12 cel·les de 64 | — |
| `effects/02_torch_flame/32x32/torch_flame_32x32.gif` | GIF | — |
| `effects/02_torch_flame/32x32/torch_flame_32x32_preview_x8.gif` | GIF | — |
| `effects/02_torch_flame/32x32/torch_flame_32x32_sheet.png` | 256×32 · 8 cel·les de 32 | — |
| `effects/02_torch_flame/64x64/torch_flame_64x64.gif` | GIF | — |
| `effects/02_torch_flame/64x64/torch_flame_64x64_preview_x4.gif` | GIF | — |
| `effects/02_torch_flame/64x64/torch_flame_64x64_sheet.png` | 512×64 · 8 cel·les de 64 | — |
| `effects/03_fire_explosion/32x32/fire_explosion_32x32.gif` | GIF | — |
| `effects/03_fire_explosion/32x32/fire_explosion_32x32_preview_x8.gif` | GIF | — |
| `effects/03_fire_explosion/32x32/fire_explosion_32x32_sheet.png` | 384×32 · 12 cel·les de 32 | **`fire_burst`** |
| `effects/03_fire_explosion/64x64/fire_explosion_64x64.gif` | GIF | — |
| `effects/03_fire_explosion/64x64/fire_explosion_64x64_preview_x4.gif` | GIF | — |
| `effects/03_fire_explosion/64x64/fire_explosion_64x64_sheet.png` | 768×64 · 12 cel·les de 64 | **`fire_explosion`** |
| `effects/04_burning_ground/32x32/burning_ground_32x32.gif` | GIF | — |
| `effects/04_burning_ground/32x32/burning_ground_32x32_preview_x8.gif` | GIF | — |
| `effects/04_burning_ground/32x32/burning_ground_32x32_sheet.png` | 384×32 · 12 cel·les de 32 | **`burning_ground`** |
| `effects/04_burning_ground/64x64/burning_ground_64x64.gif` | GIF | — |
| `effects/04_burning_ground/64x64/burning_ground_64x64_preview_x4.gif` | GIF | — |
| `effects/04_burning_ground/64x64/burning_ground_64x64_sheet.png` | 768×64 · 12 cel·les de 64 | — |
| `effects/05_ice_spikes/32x32/ice_spikes_32x32.gif` | GIF | — |
| `effects/05_ice_spikes/32x32/ice_spikes_32x32_preview_x8.gif` | GIF | — |
| `effects/05_ice_spikes/32x32/ice_spikes_32x32_sheet.png` | 320×32 · 10 cel·les de 32 | **`ice_spikes`** |
| `effects/05_ice_spikes/64x64/ice_spikes_64x64.gif` | GIF | — |
| `effects/05_ice_spikes/64x64/ice_spikes_64x64_preview_x4.gif` | GIF | — |
| `effects/05_ice_spikes/64x64/ice_spikes_64x64_sheet.png` | 640×64 · 10 cel·les de 64 | — |
| `effects/06_snow_swirl/32x32/snow_swirl_32x32.gif` | GIF | — |
| `effects/06_snow_swirl/32x32/snow_swirl_32x32_preview_x8.gif` | GIF | — |
| `effects/06_snow_swirl/32x32/snow_swirl_32x32_sheet.png` | 384×32 · 12 cel·les de 32 | **`snow_swirl`** |
| `effects/06_snow_swirl/64x64/snow_swirl_64x64.gif` | GIF | — |
| `effects/06_snow_swirl/64x64/snow_swirl_64x64_preview_x4.gif` | GIF | — |
| `effects/06_snow_swirl/64x64/snow_swirl_64x64_sheet.png` | 768×64 · 12 cel·les de 64 | — |
| `effects/07_frost_crystal/32x32/frost_crystal_32x32.gif` | GIF | — |
| `effects/07_frost_crystal/32x32/frost_crystal_32x32_preview_x8.gif` | GIF | — |
| `effects/07_frost_crystal/32x32/frost_crystal_32x32_sheet.png` | 384×32 · 12 cel·les de 32 | **`frost_crystal`** |
| `effects/07_frost_crystal/64x64/frost_crystal_64x64.gif` | GIF | — |
| `effects/07_frost_crystal/64x64/frost_crystal_64x64_preview_x4.gif` | GIF | — |
| `effects/07_frost_crystal/64x64/frost_crystal_64x64_sheet.png` | 768×64 · 12 cel·les de 64 | — |
| `effects/08_ice_burst/32x32/ice_burst_32x32.gif` | GIF | — |
| `effects/08_ice_burst/32x32/ice_burst_32x32_preview_x8.gif` | GIF | — |
| `effects/08_ice_burst/32x32/ice_burst_32x32_sheet.png` | 320×32 · 10 cel·les de 32 | — |
| `effects/08_ice_burst/64x64/ice_burst_64x64.gif` | GIF | — |
| `effects/08_ice_burst/64x64/ice_burst_64x64_preview_x4.gif` | GIF | — |
| `effects/08_ice_burst/64x64/ice_burst_64x64_sheet.png` | 640×64 · 10 cel·les de 64 | **`ice_burst`** |
| `effects/09_crackle/32x32/crackle_32x32.gif` | GIF | — |
| `effects/09_crackle/32x32/crackle_32x32_preview_x8.gif` | GIF | — |
| `effects/09_crackle/32x32/crackle_32x32_sheet.png` | 256×32 · 8 cel·les de 32 | **`crackle`** |
| `effects/09_crackle/64x64/crackle_64x64.gif` | GIF | — |
| `effects/09_crackle/64x64/crackle_64x64_preview_x4.gif` | GIF | — |
| `effects/09_crackle/64x64/crackle_64x64_sheet.png` | 512×64 · 8 cel·les de 64 | — |
| `effects/10_chain_arc/32x32/chain_arc_32x32.gif` | GIF | — |
| `effects/10_chain_arc/32x32/chain_arc_32x32_preview_x8.gif` | GIF | — |
| `effects/10_chain_arc/32x32/chain_arc_32x32_sheet.png` | 256×32 · 8 cel·les de 32 | — |
| `effects/10_chain_arc/64x64/chain_arc_64x64.gif` | GIF | — |
| `effects/10_chain_arc/64x64/chain_arc_64x64_preview_x4.gif` | GIF | — |
| `effects/10_chain_arc/64x64/chain_arc_64x64_sheet.png` | 512×64 · 8 cel·les de 64 | **`chain_arc`** |
| `effects/11_thunder_burst/32x32/thunder_burst_32x32.gif` | GIF | — |
| `effects/11_thunder_burst/32x32/thunder_burst_32x32_preview_x8.gif` | GIF | — |
| `effects/11_thunder_burst/32x32/thunder_burst_32x32_sheet.png` | 320×32 · 10 cel·les de 32 | — |
| `effects/11_thunder_burst/64x64/thunder_burst_64x64.gif` | GIF | — |
| `effects/11_thunder_burst/64x64/thunder_burst_64x64_preview_x4.gif` | GIF | — |
| `effects/11_thunder_burst/64x64/thunder_burst_64x64_sheet.png` | 640×64 · 10 cel·les de 64 | **`thunder_burst`** |
| `effects/12_spark_fountain/32x32/spark_fountain_32x32.gif` | GIF | — |
| `effects/12_spark_fountain/32x32/spark_fountain_32x32_preview_x8.gif` | GIF | — |
| `effects/12_spark_fountain/32x32/spark_fountain_32x32_sheet.png` | 384×32 · 12 cel·les de 32 | **`spark_fountain`** |
| `effects/12_spark_fountain/64x64/spark_fountain_64x64.gif` | GIF | — |
| `effects/12_spark_fountain/64x64/spark_fountain_64x64_preview_x4.gif` | GIF | — |
| `effects/12_spark_fountain/64x64/spark_fountain_64x64_sheet.png` | 768×64 · 12 cel·les de 64 | — |
| `effects/13_acid_puddle/32x32/acid_puddle_32x32.gif` | GIF | — |
| `effects/13_acid_puddle/32x32/acid_puddle_32x32_preview_x8.gif` | GIF | — |
| `effects/13_acid_puddle/32x32/acid_puddle_32x32_sheet.png` | 384×32 · 12 cel·les de 32 | **`acid_puddle`** |
| `effects/13_acid_puddle/64x64/acid_puddle_64x64.gif` | GIF | — |
| `effects/13_acid_puddle/64x64/acid_puddle_64x64_preview_x4.gif` | GIF | — |
| `effects/13_acid_puddle/64x64/acid_puddle_64x64_sheet.png` | 768×64 · 12 cel·les de 64 | — |
| `effects/14_acid_splash/32x32/acid_splash_32x32.gif` | GIF | — |
| `effects/14_acid_splash/32x32/acid_splash_32x32_preview_x8.gif` | GIF | — |
| `effects/14_acid_splash/32x32/acid_splash_32x32_sheet.png` | 320×32 · 10 cel·les de 32 | **`acid_splash`** |
| `effects/14_acid_splash/64x64/acid_splash_64x64.gif` | GIF | — |
| `effects/14_acid_splash/64x64/acid_splash_64x64_preview_x4.gif` | GIF | — |
| `effects/14_acid_splash/64x64/acid_splash_64x64_sheet.png` | 640×64 · 10 cel·les de 64 | — |
| `effects/15_poison_cloud/32x32/poison_cloud_32x32.gif` | GIF | — |
| `effects/15_poison_cloud/32x32/poison_cloud_32x32_preview_x8.gif` | GIF | — |
| `effects/15_poison_cloud/32x32/poison_cloud_32x32_sheet.png` | 384×32 · 12 cel·les de 32 | **`poison_puff`** |
| `effects/15_poison_cloud/64x64/poison_cloud_64x64.gif` | GIF | — |
| `effects/15_poison_cloud/64x64/poison_cloud_64x64_preview_x4.gif` | GIF | — |
| `effects/15_poison_cloud/64x64/poison_cloud_64x64_sheet.png` | 768×64 · 12 cel·les de 64 | **`poison_cloud`** |
| `effects/16_acid_drip/32x32/acid_drip_32x32.gif` | GIF | — |
| `effects/16_acid_drip/32x32/acid_drip_32x32_preview_x8.gif` | GIF | — |
| `effects/16_acid_drip/32x32/acid_drip_32x32_sheet.png` | 384×32 · 12 cel·les de 32 | — |
| `effects/16_acid_drip/64x64/acid_drip_64x64.gif` | GIF | — |
| `effects/16_acid_drip/64x64/acid_drip_64x64_preview_x4.gif` | GIF | — |
| `effects/16_acid_drip/64x64/acid_drip_64x64_sheet.png` | 768×64 · 12 cel·les de 64 | — |

Cada efecte té també `frames/` amb els fotogrames solts (els mateixos que el full).

## `magic-pack-9/`

| Fitxer | Mida | Atles |
|---|---|---|
| `sprites/DarkBolt/` (12 fotogrames solts) | 64×88 cadascun | **`dark_bolt`** |
| `sprites/FireBomb/` (15 fotogrames solts) | 64×64 cadascun | **`fire_dome`** |
| `sprites/Lightning/` (11 fotogrames solts) | 64×128 cadascun | **`sky_strike`** |
| `sprites/spark/` (8 fotogrames solts) | 32×32 cadascun | **`spark_orb`** |
| `Previews/Dark-Bolt.gif` | GIF | — |
| `Previews/Fire-bomb.gif` | GIF | — |
| `Previews/Lightning.gif` | GIF | — |
| `Previews/spark.gif` | GIF | — |

## `magic-vfx-1/`

| Fitxer | Mida | Atles |
|---|---|---|
| `Sprites/Impact/` (4 fotogrames solts) | 64×48 cadascun | **`impact_star`** |
| `Sprites/Whirlwind/` (19 fotogrames solts) | 64×48 cadascun | **`whirlwind`** |
| `Spritesheets/Impact.png` | 256×48 · 4 cel·les de 64×48 | — |
| `Spritesheets/Whirlwind.png` | 1216×48 · 19 cel·les de 64×48 | — |

## `soggy-combat/`

| Fitxer | Mida | Atles |
|---|---|---|
| `PNG/Bleed_large_sheet.png` | 600×100 · 6 cel·les de 100 | **`bleed`** |
| `PNG/impact_dust_cloud_sheet.png` | 700×100 · 7 cel·les de 100 | **`dust_cloud`** |
| `PNG/slash_v3_sheet.png` | 500×100 · 5 cel·les de 100 | — |

## `soggy-earth/`

| Fitxer | Mida | Atles |
|---|---|---|
| `PNG/earth_rocksmash_single_sheet.png` | 1300×100 · 13 cel·les de 100 | — |
| `PNG/earth_spike_single_sheet.png` | 1100×100 · 11 cel·les de 100 | — |

## `soggy-icons/`

| Fitxer | Mida | Atles |
|---|---|---|
| `PNG/Icons_Free.png` | 160×48 · 10 cel·les de 16 | — |

## `soggy-lightning/`

| Fitxer | Mida | Atles |
|---|---|---|
| `PNG/Lightning Blue_Free/impact_lightning 1 _B_sheet.png` | 600×100 · 6 cel·les de 100 | — |
| `PNG/Lightning Blue_Free/lightning_bolt__B_sheet.png` | 1200×100 · 12 cel·les de 100 | **`bolt_blue`** |
| `PNG/Lightning Blue_Free/lightning_orb_loop_B_sheet.png` | 700×100 · 7 cel·les de 100 | — |
| `PNG/Lightning Blue_Free/proj_lightning 4_B_sheet.png` | 600×100 · 6 cel·les de 100 | — |
| `PNG/Lightning Yellow_Free/impact_lightning 1_Y_sheet.png` | 600×100 · 6 cel·les de 100 | **`zap_yellow`** |
| `PNG/Lightning Yellow_Free/lightning_bolt_Y_sheet.png` | 1200×100 · 12 cel·les de 100 | — |
| `PNG/Lightning Yellow_Free/lightning_orb_loop_Y_sheet.png` | 700×100 · 7 cel·les de 100 | — |
| `PNG/Lightning Yellow_Free/proj_lightning_4_Y_sheet.png` | 600×100 · 6 cel·les de 100 | — |

## `soggy-nature/`

| Fitxer | Mida | Atles |
|---|---|---|
| `PNG/nature_impact_sheet.png` | 600×100 · 6 cel·les de 100 | **`nature_impact`** |
| `PNG/nature_vine_travel_loop_sheet.png` | 500×100 · 5 cel·les de 100 | **`vines`** |
| `PNG/proj_nature_1_sheet.png` | 700×100 · 7 cel·les de 100 | — |

## `soggy-status/`

| Fitxer | Mida | Atles |
|---|---|---|
| `PNG/statusfx_charmed_sheet.png` | 450×50 · 9 cel·les de 50 | **`status_charmed`** |
| `PNG/statusfx_confused_sheet.png` | 750×50 · 15 cel·les de 50 | — |
| `PNG/statusfx_stunned_sheet.png` | 400×50 · 8 cel·les de 50 | **`status_stunned`** |

## `soggy-water/`

| Fitxer | Mida | Atles |
|---|---|---|
| `PNG/impact_water_sheet.png` | 800×100 · 8 cel·les de 100 | **`water_splash`** |
| `PNG/proj_bubblebeam3_end_sheet.png` | 300×100 · 3 cel·les de 100 | — |
| `PNG/proj_bubblebeam3_sheet.png` | 600×100 · 6 cel·les de 100 | — |
| `PNG/proj_water_small_sheet.png` | 400×100 · 4 cel·les de 100 | — |
| `PNG/water_heal_sheet.png` | 1600×100 · 16 cel·les de 100 | **`heal_rise`** |
