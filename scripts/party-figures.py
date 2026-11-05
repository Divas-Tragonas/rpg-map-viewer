#!/usr/bin/env python3
"""
Figuretes pròpies de la colla (DIVAS), fetes a partir del paquet Oryx:

    python3 scripts/party-figures.py            # afegeix la fila de la colla a `uf_heroes.png`
    python3 scripts/party-figures.py --sheet x  # a més, un full de revisió (original → nova) a x.png

Afegeix UNA fila (y = 624) al final de `public/sprites/uf_heroes.png` (i una fila buida als fulls de
variants, perquè els tres fulls tinguin la mateixa mida). Les coordenades surten a
`src/lib/sprites/manifest.ts` (`templar_axe`, `warrior_green`). És idempotent: parteix sempre de
les 624 primeres files (el full original) i torna a escriure la fila.

  - `templar_axe` (Jaume III): el templari vermell amb la destral del bàrbar (`barbarian_m`) en lloc
    de l'alabarda. Es treu l'alabarda (columna 33 i el ferro de dalt), i s'hi enganxa la destral
    del bàrbar del mateix fotograma, desplaçada perquè el mànec quedi dins del guant del templari.
  - `warrior_green` (Espardeny): el guerrer (`warrior_m`) amb la roba blava tenyida del verd del
    seu halo (#52b86e): es gira el to dels píxels blaus i es conserva la rampa de llum.
"""
import colorsys, os, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SPR = os.path.join(ROOT, 'public', 'sprites')
T, FRAMES, BASE_H = 48, 4, 624
ROW_Y = BASE_H

TEMPLAR, BARBARIAN, WARRIOR = (1344, 48), (960, 0), (192, 48)

HAND_T = (223, 223, 146)      # guant del templari
AXE_B = {(232, 232, 232), (162, 162, 162), (158, 123, 30), (128, 93, 23)}  # ferro i mànec del bàrbar
SHAFT_X = 33                  # columna del mànec (templari i bàrbar)


def frame(img, pos, f):
    x, y = pos
    return img.crop((x + f * T, y, x + (f + 1) * T, y + T))


def first_row(img, col, rgb, start=15):
    for r in range(start, T):
        p = img.getpixel((col, r))
        if p[3] and p[:3] == rgb:
            return r
    raise SystemExit(f'no trobo {rgb} a la columna {col}')


def templar_axe(sheet, f):
    t = frame(sheet, TEMPLAR, f).copy()
    b = frame(sheet, BARBARIAN, f)
    # 1. Fora l'alabarda: tot el que no és el guant a les columnes 33–36 (el cos no hi arriba).
    for r in range(T):
        for c in range(SHAFT_X, SHAFT_X + 4):
            p = t.getpixel((c, r))
            if not p[3] or p[3] < 255 or p[:3] == HAND_T:
                continue
            if r >= 37:  # el peu del mànec és damunt de l'ombra del terra: es torna ombra
                q = t.getpixel((c + 1, r))
                t.putpixel((c, r), q if 0 < q[3] < 255 else (1, 1, 1, 38))
            else:
                t.putpixel((c, r), (0, 0, 0, 0))
    # 2. La destral del bàrbar, amb el mànec dins del guant.
    dy = first_row(t, SHAFT_X, HAND_T) - first_row(b, SHAFT_X, (223, 223, 146))
    for r in range(T):
        for c in range(SHAFT_X - 1, T):
            p = b.getpixel((c, r))
            if not p[3] or p[:3] not in AXE_B:
                continue
            y = r + dy
            if 0 <= y < T and t.getpixel((c, y))[:3] != HAND_T:
                t.putpixel((c, y), p)
    return t


GREEN_H = colorsys.rgb_to_hsv(0x52 / 255, 0xb8 / 255, 0x6e / 255)[0]


def warrior_green(sheet, f):
    w = frame(sheet, WARRIOR, f).copy()
    px = w.load()
    for y in range(T):
        for x in range(T):
            r, g, b, a = px[x, y]
            if not a:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s > 0.25 and 0.52 < h < 0.75:  # blaus (roba i capa)
                nr, ng, nb = colorsys.hsv_to_rgb(GREEN_H, min(1, s * 0.95), v * 0.92)
                px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return w


FIGURES = [('templar_axe', templar_axe, TEMPLAR), ('warrior_green', warrior_green, WARRIOR)]


def main():
    path = os.path.join(SPR, 'uf_heroes.png')
    src = Image.open(path).convert('RGBA')
    base = src.crop((0, 0, src.width, BASE_H))
    out = Image.new('RGBA', (src.width, BASE_H + T), (0, 0, 0, 0))
    out.paste(base, (0, 0))
    for i, (_, fn, _) in enumerate(FIGURES):
        for f in range(FRAMES):
            out.paste(fn(base, f), (i * T * FRAMES + f * T, ROW_Y))
    out.save(path, optimize=True)
    for v in ('uf_heroes_v1.png', 'uf_heroes_v2.png'):
        p = os.path.join(SPR, v)
        im = Image.open(p).convert('RGBA')
        o = Image.new('RGBA', (im.width, BASE_H + T), (0, 0, 0, 0))
        o.paste(im.crop((0, 0, im.width, BASE_H)), (0, 0))
        o.save(p, optimize=True)
    try:  # mateixos píxels, PNG més petit (com la resta de fulls)
        import oxipng
        for f in ('uf_heroes.png', 'uf_heroes_v1.png', 'uf_heroes_v2.png'):
            oxipng.optimize(os.path.join(SPR, f), level=6)
    except ImportError:
        print('(sense pyoxipng: els PNG queden sense optimitzar)')
    for i, (name, _, _) in enumerate(FIGURES):
        print(f'  {name}: [{i * T * FRAMES}, {ROW_Y}],')
    if '--sheet' in sys.argv:
        dst = sys.argv[sys.argv.index('--sheet') + 1]
        rev = Image.new('RGBA', (T * FRAMES * 2, T * len(FIGURES)), (60, 60, 60, 255))
        for i, (_, _, orig) in enumerate(FIGURES):
            rev.alpha_composite(base.crop((orig[0], orig[1], orig[0] + T * FRAMES, orig[1] + T)), (0, i * T))
            rev.alpha_composite(out.crop((i * T * FRAMES, ROW_Y, (i + 1) * T * FRAMES, ROW_Y + T)), (T * FRAMES, i * T))
        rev.resize((rev.width * 4, rev.height * 4), Image.NEAREST).save(dst)


if __name__ == '__main__':
    main()
