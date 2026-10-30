#!/usr/bin/env python3
"""
Genera els temes de masmorra del mapa de caselles (app Píxel) a partir de `public/sprites/uf_terrain.png`:

    python3 scripts/oryx-themes.py              # escriu `public/sprites/uf_terrain_themes.png`
    python3 scripts/oryx-themes.py --sheet x    # a més, una mostra (una sala de cada tema) a x.png

Cada tema és un bloc de 4 files de 48 px al full nou (20 columnes, com el de terreny):
  files 0–2: el joc de paret d'origen recolorit, sencer (peces, pilar i portes a les mateixes
             columnes: `wallTileFor` i les portes el llegeixen igual que els de `uf_terrain.png`);
  fila 3:    el terra del tema (variants a les columnes 1–5).
Al codi, les caselles d'aquest full són `THEME_BASE + fila·20 + columna` (`lib/tilemap/model.ts`)
i els temes són a `THEMES` (`lib/tilemap/palette.ts`), en el mateix ordre que aquí.

Criteri del recolor (mapa de gradient, com es fan les variants de paleta del pixel art):
  - la PEDRA (píxels poc saturats) pren la rampa del tema per lluminositat (rang fix `LO`–`HI`):
    la textura i les ombres de l'autor es conserven;
  - la MOLSA (verds) del terra pren l'accent del tema (gebre, brases, or…) a les juntes; la de les
    parets, el color de la pedra (amb l'accent semblaven núvols retallats);
  - la resta (fusta de les portes, estendards, ossos) no es toca.
Requereix Pillow (i, opcional, `pyoxipng`).
"""
import colorsys, os, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'public', 'sprites', 'uf_terrain.png')
OUT = os.path.join(ROOT, 'public', 'sprites', 'uf_terrain_themes.png')
T, COLS = 48, 20

# Jocs de paret d'origen (fila de `WALL_SETS`) i terres d'origen (fila, columnes de les variants).
DUNGEON, CRYPT = 12, 15
SLAB_GREY, SLAB_BLUE = (2, range(1, 6)), (1, range(1, 6))

# id, nom, paret d'origen, terra d'origen, rampa de la pedra (fosc → clar), rampa de l'accent
# (None = la molsa es queda com és) i lluminositat del terra respecte de la paret.
THEMES = [
    ('ice', 'Gel', DUNGEON, SLAB_GREY,
     [(14, 24, 40), (30, 56, 88), (62, 104, 146), (112, 162, 202), (206, 234, 250)],
     [(150, 205, 235), (210, 240, 255), (255, 255, 255)], 0.9),
    ('lava', 'Volcà', DUNGEON, SLAB_GREY,
     [(12, 9, 9), (30, 23, 22), (52, 40, 38), (80, 64, 58), (114, 94, 84)],
     [(130, 30, 8), (230, 92, 22), (255, 186, 70)], 0.95),
    ('moss', 'Cripta de molsa', CRYPT, SLAB_BLUE,
     [(12, 20, 14), (32, 50, 36), (60, 86, 64), (96, 126, 98), (148, 176, 148)],
     None, 1.0),
    ('temple', 'Temple daurat', DUNGEON, SLAB_GREY,
     [(52, 38, 24), (110, 88, 62), (168, 146, 110), (214, 198, 162), (246, 238, 214)],
     [(118, 78, 10), (198, 148, 38), (250, 214, 110)], 0.9),
]

def hsv(p): return colorsys.rgb_to_hsv(p[0] / 255, p[1] / 255, p[2] / 255)
def lum(p): return (0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]) / 255

def ramp(stops, x):
    x = min(1.0, max(0.0, x)) * (len(stops) - 1)
    i = min(int(x), len(stops) - 2); f = x - i
    a, b = stops[i], stops[i + 1]
    return tuple(round(a[k] + (b[k] - a[k]) * f) for k in range(3))

def kind(p):
    h, s, v = hsv(p)
    if s < 0.28: return 'stone'
    if 0.2 <= h <= 0.48: return 'moss'
    return 'keep'

# Rang de lluminositat de la pedra de l'autor (paret i terra tenen la mateixa mitjana, ~0,35):
# fix, no per bloc, perquè la paret i el terra d'un tema guardin la relació de l'original.
LO, HI = 0.08, 0.58

def recolor(img, stone, accent, gain=1.0, moss_as_stone=False):
    lo, hi = LO, HI
    out = img.copy(); px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            p = px[x, y]
            if p[3] == 0: continue
            k = kind(p)
            if k == 'moss' and accent and moss_as_stone: k = 'stone'
            if k == 'stone':
                px[x, y] = ramp(stone, (lum(p) - lo) / (hi - lo) * gain) + (p[3],)
            elif k == 'moss' and accent:
                px[x, y] = ramp(accent, lum(p) / 0.6) + (p[3],)
    return out

def main():
    src = Image.open(SRC).convert('RGBA')
    sheet = Image.new('RGBA', (COLS * T, 4 * T * len(THEMES)), (0, 0, 0, 0))
    for i, (tid, label, wall_row, (floor_row, floor_cols), stone, accent, gain) in enumerate(THEMES):
        walls = src.crop((0, wall_row * T, COLS * T, (wall_row + 3) * T))
        # A les parets, les taques de molsa de l'autor amb l'accent semblaven núvols retallats:
        # hi van del color de la pedra. L'accent queda per a les juntes del terra.
        sheet.alpha_composite(recolor(walls, stone, accent, moss_as_stone=True), (0, 4 * i * T))
        for j, c in enumerate(floor_cols):
            tile = src.crop((c * T, floor_row * T, (c + 1) * T, (floor_row + 1) * T))
            sheet.alpha_composite(recolor(tile, stone, accent, gain), ((1 + j) * T, (4 * i + 3) * T))
    sheet.save(OUT, optimize=True)
    try:
        import oxipng; oxipng.optimize(OUT, level=4)
    except ImportError:
        pass
    print('temes:', ', '.join(t[1] for t in THEMES), '→', os.path.relpath(OUT, ROOT))
    if '--sheet' in sys.argv:
        preview(sheet, sys.argv[sys.argv.index('--sheet') + 1])

def preview(sheet, dst):
    """Una sala petita de cada tema (paret de dalt de dues files, laterals i paret de baix)."""
    W, H = 7, 6
    img = Image.new('RGBA', (len(THEMES) * (W + 1) * T, H * T), (0, 0, 0, 255))
    for i in range(len(THEMES)):
        B = 4 * i
        def put(c, r, col, row): img.alpha_composite(sheet.crop((col * T, row * T, (col + 1) * T, (row + 1) * T)), ((i * (W + 1) + c) * T, r * T))
        for r in range(H):
            for c in range(W):
                put(c, r, 1 + (c * 7 + r * 3) % 5, B + 3)
        for c in range(W):
            put(c, 0, 1 + c % 3, B); put(c, 1, 1 + c % 2, B + 2); put(c, H - 1, 1 + c % 2, B + 2)
        for r in range(1, H - 1):
            put(0, r, 1 + r % 3, B + 1); put(W - 1, r, 1 + r % 3, B + 1)
        put(3, 1, 10, B + 1)  # porta tancada a la paret de dalt
    img.save(dst)

if __name__ == '__main__':
    main()
