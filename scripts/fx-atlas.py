#!/usr/bin/env python3
"""
Atles d'animacions d'efectes de l'app Píxel (v5 snapshot 10).

Llegeix la tria d'animacions de `assets/fx-packs/` (els paquets sencers són al repositori, veure
`assets/fx-packs/INDEX.md`) i genera:

  - `public/sprites/fx_anims.png`  — un full amb una fila per animació. Cada fotograma es retalla
    a la caixa que ocupa l'animació sencera (la unió de tots els fotogrames), o sigui que tots
    els fotogrames d'una animació tenen la mateixa mida i el mateix origen.
  - `src/lib/sprites/fxanims.ts`   — GENERAT: on és cada animació dins del full i on queda el
    centre de la casella original (per centrar-la igual que l'autor).

Per afegir-ne una: una entrada a `ANIMS` i tornar a executar `python3 scripts/fx-atlas.py`.
No es toca mai el PNG ni el `.ts` a mà.

Píxels: es copien tal qual (RGBA, sense escalar ni tornar a quantitzar).
"""
import os
import re
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACKS = os.path.join(ROOT, 'assets', 'fx-packs')
OUT_PNG = os.path.join(ROOT, 'public', 'sprites', 'fx_anims.png')
OUT_TS = os.path.join(ROOT, 'src', 'lib', 'sprites', 'fxanims.ts')

FE = 'fire-elemental/effects'

# id, origen, mida de casella (w, h) o None si són fitxers solts, ms per fotograma, en bucle?, descripció
# `frames`: llista d'índexs (0-based) si només se'n vol una part.
ANIMS = [
    # ── Foc, gel, llamp i àcid (Free Pixel Fire & Elemental Effects, 12 fps) ──
    dict(id='fire_explosion',   src=f'{FE}/03_fire_explosion/64x64/fire_explosion_64x64_sheet.png', cell=(64, 64), ms=70, loop=False, d="Esclat de foc vist de dalt: bola, anell i fum (bola de foc)"),
    dict(id='fire_burst',       src=f'{FE}/03_fire_explosion/32x32/fire_explosion_32x32_sheet.png', cell=(32, 32), ms=60, loop=False, d="Esclat de foc petit (raig de foc, mans ardents, alès)"),
    dict(id='burning_ground',   src=f'{FE}/04_burning_ground/32x32/burning_ground_32x32_sheet.png', cell=(32, 32), ms=83, loop=True,  d="Flametes arran de terra (brases, zones de foc)"),
    dict(id='ice_spikes',       src=f'{FE}/05_ice_spikes/32x32/ice_spikes_32x32_sheet.png',         cell=(32, 32), ms=70, loop=False, d="Punxes de gel que surten de terra"),
    dict(id='snow_swirl',       src=f'{FE}/06_snow_swirl/32x32/snow_swirl_32x32_sheet.png',         cell=(32, 32), ms=90, loop=True,  d="Remolí de neu (alè de fred, zones de gel)"),
    dict(id='frost_crystal',    src=f'{FE}/07_frost_crystal/32x32/frost_crystal_32x32_sheet.png',   cell=(32, 32), ms=110, loop=True, d="Cristall de gel que brilla (zones de gel)"),
    dict(id='ice_burst',        src=f'{FE}/08_ice_burst/64x64/ice_burst_64x64_sheet.png',           cell=(64, 64), ms=60, loop=False, d="Esclat de gel: nucli i anell de glaç"),
    dict(id='crackle',          src=f'{FE}/09_crackle/32x32/crackle_32x32_sheet.png',               cell=(32, 32), ms=70, loop=True,  d="Espurnes elèctriques (Paralitzat, xoc, zones de llamp)"),
    dict(id='chain_arc',        src=f'{FE}/10_chain_arc/64x64/chain_arc_64x64_sheet.png',           cell=(64, 64), ms=60, loop=True,  d="Arc elèctric horitzontal que s'enrajola (raig elèctric)"),
    dict(id='thunder_burst',    src=f'{FE}/11_thunder_burst/64x64/thunder_burst_64x64_sheet.png',   cell=(64, 64), ms=65, loop=False, d="Esclat de tro: nucli groc i anell de llamps"),
    dict(id='spark_fountain',   src=f'{FE}/12_spark_fountain/32x32/spark_fountain_32x32_sheet.png', cell=(32, 32), ms=80, loop=True,  d="Font d'espurnes (prestidigitació, beneït, zones de màgia)"),
    dict(id='acid_puddle',      src=f'{FE}/13_acid_puddle/32x32/acid_puddle_32x32_sheet.png',       cell=(32, 32), ms=100, loop=True, d="Bassal d'àcid que bull (zones de verí)"),
    dict(id='acid_splash',      src=f'{FE}/14_acid_splash/32x32/acid_splash_32x32_sheet.png',       cell=(32, 32), ms=70, loop=False, d="Esquitx d'àcid (fletxa àcida, alè d'àcid)"),
    dict(id='poison_cloud',     src=f'{FE}/15_poison_cloud/64x64/poison_cloud_64x64_sheet.png',     cell=(64, 64), ms=100, loop=True, d="Núvol de verí gran (núvols, alè de verí)"),
    dict(id='poison_puff',      src=f'{FE}/15_poison_cloud/32x32/poison_cloud_32x32_sheet.png',     cell=(32, 32), ms=110, loop=True, d="Núvol de verí petit (Enverinat)"),
    # ── Magic Pack 9 (fitxers solts) ──
    dict(id='dark_bolt',        src='magic-pack-9/sprites/DarkBolt',  cell=None, ms=75, loop=False, d="Raig fosc que cau i esclat d'ombra (necròtic, terror)"),
    dict(id='fire_dome',        src='magic-pack-9/sprites/FireBomb',  cell=None, ms=70, loop=False, frames=list(range(7, 15)), d="Cúpula de foc de perfil (impacte del raig de foc a la figura)"),
    dict(id='sky_strike',       src='magic-pack-9/sprites/Lightning', cell=None, ms=70, loop=False, d="Llamp que cau del cel i esclata (flama sagrada, raig radiant)"),
    dict(id='spark_orb',        src='magic-pack-9/sprites/spark',     cell=None, ms=70, loop=False, d="Esfera elèctrica que esclata (agafada electritzant)"),
    # ── Magic VFX Pack 1 ──
    dict(id='impact_star',      src='magic-vfx-1/Sprites/Impact',     cell=None, ms=60, loop=False, d="Impacte blanc amb esquerdes (projectil màgic, cops de conjur; es tenyeix)"),
    dict(id='whirlwind',        src='magic-vfx-1/Sprites/Whirlwind',  cell=None, ms=55, loop=False, d="Remolí de vent (desaparèixer)"),
    # ── SoggySocks ──
    dict(id='bleed',            src='soggy-combat/PNG/Bleed_large_sheet.png',          cell=(100, 100), ms=70, loop=False, d="Esquitx de sang (cops forts)"),
    dict(id='dust_cloud',       src='soggy-combat/PNG/impact_dust_cloud_sheet.png',    cell=(100, 100), ms=70, loop=False, d="Núvol de pols (cop que tomba, taumatúrgia)"),
    dict(id='status_charmed',   src='soggy-status/PNG/statusfx_charmed_sheet.png',     cell=(50, 50), ms=110, loop=True, d="Cors (Encisat)"),
    dict(id='status_stunned',   src='soggy-status/PNG/statusfx_stunned_sheet.png',     cell=(50, 50), ms=100, loop=True, d="Estrelles que giren (Atordit)"),
    dict(id='zap_yellow',       src='soggy-lightning/PNG/Lightning Yellow_Free/impact_lightning 1_Y_sheet.png', cell=(100, 100), ms=60, loop=False, d="Impacte elèctric groc"),
    dict(id='bolt_blue',        src='soggy-lightning/PNG/Lightning Blue_Free/lightning_bolt__B_sheet.png',      cell=(100, 100), ms=55, loop=False, d="Llampec curt amb parpelleig (raig elèctric)"),
    dict(id='nature_impact',    src='soggy-nature/PNG/nature_impact_sheet.png',        cell=(100, 100), ms=70, loop=False, d="Esclat de fulles (enredar)"),
    dict(id='vines',            src='soggy-nature/PNG/nature_vine_travel_loop_sheet.png', cell=(100, 100), ms=110, loop=True, d="Liana que es retorça (Retingut, enredar)"),
    dict(id='water_splash',     src='soggy-water/PNG/impact_water_sheet.png',          cell=(100, 100), ms=75, loop=False, d="Esquitx d'aigua (zones d'aigua)"),
    dict(id='heal_rise',        src='soggy-water/PNG/water_heal_sheet.png',            cell=(100, 100), ms=60, loop=False, frames=list(range(3, 16)), d="Gotes que pugen i brillen (curació, tenyit de poció; sense el doll del principi, que tenyit semblava sang)"),
]


def num(path):
    m = re.findall(r'(\d+)\.png$', path)
    return int(m[0]) if m else 0


def load_frames(a):
    src = os.path.join(PACKS, a['src'])
    if a['cell'] is None:
        files = sorted((os.path.join(src, f) for f in os.listdir(src) if f.endswith('.png')), key=num)
        frames = [Image.open(f).convert('RGBA') for f in files]
        cw, ch = frames[0].size
    else:
        im = Image.open(src).convert('RGBA')
        cw, ch = a['cell']
        frames = [im.crop((i * cw, 0, i * cw + cw, ch)) for i in range(im.width // cw)]
    if 'frames' in a:
        frames = [frames[i] for i in a['frames']]
    # Fora els fotogrames buits del final (els del mig fan de pausa: es queden).
    while frames and frames[-1].getchannel('A').getbbox() is None:
        frames.pop()
    return frames, cw, ch


def main():
    rows = []
    for a in ANIMS:
        frames, cw, ch = load_frames(a)
        u = None
        for f in frames:
            b = f.getchannel('A').getbbox()
            if b:
                u = b if u is None else (min(u[0], b[0]), min(u[1], b[1]), max(u[2], b[2]), max(u[3], b[3]))
        if u is None:
            sys.exit(f"{a['id']}: buida")
        rows.append((a, [f.crop(u) for f in frames], u, cw, ch))
    W = max(len(fr) * fr[0].width for _, fr, *_ in rows)
    H = sum(fr[0].height for _, fr, *_ in rows)
    atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    y = 0
    out = []
    for a, frames, u, cw, ch in rows:
        w, h = frames[0].size
        for i, f in enumerate(frames):
            atlas.paste(f, (i * w, y))
        # Origen: centre de la casella original respecte de la cantonada del retall.
        out.append((a, y, w, h, len(frames), cw / 2 - u[0], ch / 2 - u[1]))
        y += h
    atlas.save(OUT_PNG, optimize=True)

    lines = [
        '// GENERAT per `scripts/fx-atlas.py` a partir de `assets/fx-packs/`: no editar a mà.',
        '// Full: `public/sprites/fx_anims.png` (SheetId `anims`). Una fila per animació; tots els',
        '// fotogrames d\'una animació tenen la mateixa caixa (w×h) i van seguits d\'esquerra a dreta.',
        '',
        'export interface FxAnim {',
        '  /** Cantonada del primer fotograma dins del full. */',
        '  x: number; y: number;',
        '  /** Mida de cada fotograma (px d\'art). */',
        '  w: number; h: number;',
        '  /** Fotogrames i ms per fotograma. */',
        '  n: number; ms: number;',
        '  /** En bucle (si no, es reprodueix un cop). */',
        '  loop: boolean;',
        '  /** Centre de la casella original de l\'autor, mesurat des de la cantonada del fotograma. */',
        '  ox: number; oy: number;',
        '}',
        '',
        'export const FX_ANIMS = {',
    ]
    for a, y, w, h, n, ox, oy in out:
        lines.append(f"  /** {a['d']}. */")
        lines.append(f"  {a['id']}: {{ x: 0, y: {y}, w: {w}, h: {h}, n: {n}, ms: {a['ms']}, loop: {str(a['loop']).lower()}, ox: {ox:g}, oy: {oy:g} }},")
    lines += ['} as const satisfies Record<string, FxAnim>;', '', 'export type FxAnimId = keyof typeof FX_ANIMS;', '']
    with open(OUT_TS, 'w') as fh:
        fh.write('\n'.join(lines))
    print(f'{OUT_PNG}: {W}x{H}, {len(out)} animacions')


if __name__ == '__main__':
    main()
