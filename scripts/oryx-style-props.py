#!/usr/bin/env python3
"""
Objectes nous «a l'estil Oryx» (v5.26): mobles, caixes, bótes, gerros, cofres i tresor dibuixats
per codi amb les regles del full `uf_terrain.png` / `uf_items.png` de l'autor:

  - graella lògica de 24 px ampliada a 2× (una casella = 48 px), sense contorn negre;
  - la rampa de fusta i de pedra de l'Oryx (mateixos colors: `#957639`, `#aa8942`, `#44361c`…);
  - vista de dalt amb la cara del davant a sota, i l'ombra de tres franges (alfa 64 / 38 / 13).

Art propi (no és de cap paquet): es pot redistribuir amb el repositori.

Genera `assets/decor-packs/oryx-style/<id>.png` i `pieces.json` (la llista, en ordre). Després cal
executar `scripts/decor-packs.py`, que les posa al full `decor_packs.png` i a la paleta.

⚠️ Afegir peces sempre AL FINAL de `build()` (vegeu l'avís de `decor-packs.py`).

    python3 scripts/oryx-style-props.py && python3 scripts/decor-packs.py
"""
import json
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'decor-packs', 'oryx-style')

PAL = {
    # fusta Oryx (de clara a fosca)
    'G': '#bf9f4b', 'H': '#b99748', 'L': '#aa8942', 'W': '#957639', 'M': '#755d2e', 'D': '#554421',
    'K': '#44361c', 'B': '#3b3019', 'X': '#332a16',
    # pedra Oryx
    'z': '#afafaf', 'u': '#7c7c7c', 't': '#6b655f', 's': '#5a5a5a', 'v': '#4b4b4b', 'w': '#2c2c2c',
    # metall i negre
    'I': '#e8e8e8', 'i': '#bababa', 'j': '#8e8e8e', 'n': '#1f1f1f', 'F': '#fbfbfb',
    # or
    'Y': '#ffee88', 'y': '#f3d23c', 'g': '#dcb733', 'o': '#c17f2c',
    # color principal (variants): clar, base, fosc
    'C': '#ff5a4a', 'c': '#dd1717', 'e': '#ab1010',
    # ceràmica / sac (variants): llum, base, ombra, ombra fosca, sanefa
    'P': '#e9b06c', 'p': '#dc964a', 'q': '#b27138', 'Q': '#815128', 'k': '#e9dd9c',
    # tela clara i paper
    'm': '#e9dd9c', 'r': '#e0deb5', 'R': '#d0cd90',
    # aigua, verd
    'A': '#0fc4f1', 'a': '#0b91d2', 'b': '#0863a3', 'N': '#7fd08a', 'f': '#3fa35a', 'E': '#2a7740',
    # ombres de l'Oryx
    '1': (1, 1, 1, 64), '2': (0, 0, 0, 38), '3': (0, 0, 0, 13),
}

DARK_WOOD = {'G': '#aa8942', 'H': '#aa8942', 'L': '#957639', 'W': '#755d2e', 'M': '#554421', 'D': '#44361c',
             'K': '#332a16', 'B': '#2b2212', 'X': '#231c0f'}
IRON = {'G': '#afafaf', 'H': '#afafaf', 'L': '#7c7c7c', 'W': '#5a5a5a', 'M': '#4b4b4b', 'D': '#434343',
        'K': '#2c2c2c', 'B': '#232323', 'X': '#1a1a1a', 'g': '#bababa', 'y': '#e8e8e8', 'o': '#8e8e8e'}
BLUE = {'C': '#4fb4f0', 'c': '#0b91d2', 'e': '#0863a3'}
GREEN = {'C': '#7fd08a', 'c': '#3fa35a', 'e': '#2a7740'}
PURPLE = {'C': '#b57be0', 'c': '#8443b8', 'e': '#5c2a86'}
CERAMICS = [
    ('clay', 'd\'argila', {}),
    ('blue', 'blau', {'P': '#6fb6e8', 'p': '#2f7fc1', 'q': '#1f5a94', 'Q': '#143c66', 'k': '#dcb733'}),
    ('white', 'blanc', {'P': '#fbfbfb', 'p': '#e0e0e0', 'q': '#b6b6b6', 'Q': '#8e8e8e', 'k': '#2f7fc1'}),
    ('green', 'verd', {'P': '#7fd08a', 'p': '#3fa35a', 'q': '#2a7740', 'Q': '#1b4f2b', 'k': '#e9dd9c'}),
]
BURLAP = {'P': '#d8c08a', 'p': '#c2a468', 'q': '#9a7d48', 'Q': '#6e5730'}
SILVER = {'Y': '#ffffff', 'y': '#d6d6d6', 'g': '#b6b6b6', 'o': '#8e8e8e'}
COPPER = {'Y': '#f0b080', 'y': '#d98a4e', 'g': '#b8692f', 'o': '#8a4a1f'}


def rgba(v):
    if isinstance(v, tuple):
        return v
    return (int(v[1:3], 16), int(v[3:5], 16), int(v[5:7], 16), 255)


class Cv:
    """Llenç en píxels lògics (2× al full). Cada píxel és una lletra de `PAL`; '.' = transparent."""

    def __init__(self, w=24, h=24):
        self.w, self.h = w, h
        self.g = [['.'] * w for _ in range(h)]

    def p(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.g[y][x] = c

    def get(self, x, y):
        return self.g[y][x] if 0 <= x < self.w and 0 <= y < self.h else '.'

    def r(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.p(x, y, c)

    def hl(self, x0, x1, y, c):
        self.r(x0, y, x1, y, c)

    def vl(self, x, y0, y1, c):
        self.r(x, y0, x, y1, c)

    def ell(self, cx, cy, rx, ry, c):
        for y in range(self.h):
            for x in range(self.w):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0:
                    self.p(x, y, c)

    def art(self, x, y, rows):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != '.':
                    self.p(x + i, y + j, ch)

    def drop(self, bands='123'):
        """Ombra de l'Oryx: sota l'últim píxel opac de cada columna, les franges 64/38/13."""
        for x in range(self.w):
            ys = [y for y in range(self.h) if self.g[y][x] not in '.123']
            if not ys:
                continue
            for i, b in enumerate(bands):
                if self.get(x, ys[-1] + 1 + i) == '.':
                    self.p(x, ys[-1] + 1 + i, b)

    def image(self, over=None):
        pal = {**PAL, **(over or {})}
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        for y in range(self.h):
            for x in range(self.w):
                ch = self.g[y][x]
                if ch != '.':
                    im.putpixel((x, y), rgba(pal[ch]))
        return im.resize((self.w * 2, self.h * 2), Image.NEAREST)


PIECES = []  # (id, etiqueta, grup, imatge)


def add(pid, label, group, cv, over=None):
    PIECES.append((pid, label, group, cv.image(over)))


def variants(pid, label, group, cv, vs):
    for vid, vlabel, over in vs:
        add(f'{pid}_{vid}' if vid else pid, f'{label} {vlabel}'.strip(), group, cv, over)


WOODS = [('', '', {}), ('dark', 'fosca', DARK_WOOD)]
WOODS_M = [('', '', {}), ('dark', 'fosc', DARK_WOOD)]


# ───────────────────────── Mobles ─────────────────────────

def table_top(cv, x0, x1, y0, y1, legs=None):
    """Taula com la de l'Oryx: tauler `y0..y1-1`, cantell clar, cantell fosc i potes amb l'ombra entremig."""
    cv.r(x0, y0, x1, y1 - 1, 'W')
    cv.hl(x0, x1, y1, 'L')
    cv.hl(x0, x1, y1 + 1, 'K')
    bottom = min(y1 + 6, cv.h - 3)
    legs = legs or [x0 + 2, x1 - 3]
    cv.r(x0, y1 + 2, x1, bottom - 1, '1')
    cv.hl(x0, x1, bottom, '2')
    for lx in legs:
        cv.r(lx, y1 + 2, lx + 1, bottom, 'K')
        cv.hl(lx, lx + 1, y1 + 2, 'B')
    cv.r(x0, bottom + 1, x1, min(bottom + 2, cv.h - 1), '3')


def knots(cv, pts):
    for x, y, c in pts:
        cv.p(x, y, c)


def chair():
    cv = Cv()
    cv.r(7, 3, 16, 10, 'W')            # respatller
    cv.hl(7, 16, 3, 'L')
    cv.r(9, 5, 14, 8, 'M')
    cv.vl(11, 5, 8, 'W'); cv.vl(12, 5, 8, 'W')
    cv.hl(7, 16, 10, 'K')
    cv.r(6, 11, 17, 15, 'W')           # seient
    cv.hl(6, 17, 11, 'L')
    cv.p(15, 13, 'M'); cv.p(8, 14, 'L')
    cv.hl(6, 17, 16, 'L'); cv.hl(6, 17, 17, 'K')
    cv.r(6, 18, 17, 19, '1'); cv.hl(6, 17, 20, '2')
    for lx in (6, 16):
        cv.r(lx, 18, lx + 1, 20, 'K'); cv.hl(lx, lx + 1, 18, 'B')
    cv.hl(6, 17, 21, '3'); cv.hl(6, 17, 22, '3')
    return cv


def chair_cushion():
    cv = chair()
    cv.r(7, 12, 16, 14, 'c'); cv.hl(7, 16, 12, 'C'); cv.hl(7, 16, 15, 'e')
    cv.r(9, 5, 14, 8, 'c'); cv.hl(9, 14, 5, 'C')
    return cv


def stool():
    cv = Cv()
    cv.ell(11.5, 10.5, 5.6, 3.6, 'W')
    cv.hl(9, 14, 7, 'L'); cv.p(8, 8, 'L'); cv.p(7, 9, 'L')
    cv.p(13, 11, 'M')
    for x in range(6, 18):               # cantell
        ys = [y for y in range(24) if cv.g[y][x] == 'W' or cv.g[y][x] == 'L' or cv.g[y][x] == 'M']
        if ys:
            cv.p(x, ys[-1] + 1, 'L'); cv.p(x, ys[-1] + 2, 'K')
    for lx in (7, 11, 15):
        cv.r(lx, 15, lx + 1, 18, 'K')
    cv.r(9, 16, 10, 17, '1'); cv.r(13, 16, 14, 17, '1')
    cv.hl(7, 16, 19, '2'); cv.hl(7, 16, 20, '3')
    return cv


def bench():
    cv = Cv()
    table_top(cv, 1, 22, 8, 13, legs=[2, 11, 20])
    knots(cv, [(6, 10, 'M'), (17, 11, 'M'), (22, 9, 'L'), (13, 9, 'L')])
    cv.hl(1, 22, 8, 'L')
    return cv


def table_small():
    cv = Cv()
    table_top(cv, 5, 18, 5, 14)
    knots(cv, [(9, 8, 'M'), (15, 11, 'X'), (18, 7, 'L'), (11, 5, 'L')])
    return cv


def table_round():
    cv = Cv()
    cv.ell(11.5, 9.5, 9.6, 6.6, 'W')
    top = [[x for x in range(24) if cv.g[y][x] == 'W'] for y in range(24)]
    for x in range(24):
        ys = [y for y in range(24) if cv.g[y][x] == 'W']
        if ys and x >= 2:
            cv.p(x, ys[-1] + 1, 'L'); cv.p(x, ys[-1] + 2, 'K')
    for y in range(3, 7):                  # llum a la vora de dalt
        if top[y]:
            cv.p(top[y][0], y, 'L'); cv.p(top[y][-1], y, 'L')
    cv.hl(8, 15, 3, 'L')
    knots(cv, [(8, 8, 'M'), (15, 11, 'M'), (12, 6, 'X')])
    cv.r(10, 17, 13, 20, 'K'); cv.hl(10, 13, 17, 'B')     # peu central
    cv.hl(8, 15, 20, 'K')
    cv.r(5, 17, 9, 18, '1'); cv.r(14, 17, 18, 18, '1')
    cv.hl(6, 7, 19, '1'); cv.hl(16, 17, 19, '1')
    cv.hl(7, 16, 21, '2'); cv.hl(8, 15, 22, '3')
    return cv


def table_long(dress=None):
    cv = Cv(72, 24)
    table_top(cv, 2, 69, 2, 15, legs=[4, 35, 66])
    knots(cv, [(8, 3, 'L'), (15, 6, 'X'), (22, 12, 'M'), (30, 4, 'M'), (41, 9, 'X'), (50, 13, 'M'),
               (58, 5, 'L'), (64, 11, 'M'), (69, 7, 'L'), (69, 10, 'L'), (2, 9, 'L')])
    for x in (24, 47):                       # juntes dels taulons
        cv.vl(x, 2, 14, 'M')
    if dress == 'cloth':
        cv.r(10, 2, 61, 15, 'c'); cv.hl(10, 61, 15, 'e'); cv.vl(10, 2, 15, 'C'); cv.vl(61, 2, 15, 'e')
        cv.r(10, 16, 61, 17, 'e')
        for x in range(10, 62, 3):
            cv.p(x, 18, 'e')
        for x in range(14, 60, 6):
            cv.art(x, 8, ['.y.', 'yYy', '.y.'])
    if dress == 'feast':
        for x in (9, 31, 53):                # plats amb menjar
            cv.art(x, 5, ['..iiii..', '.iIIIIi.', 'iIIqpIIi', 'iIqppqIi', '.iIIIIi.', '..jjjj..'])
        for x in (21, 44):                   # gerres
            cv.art(x, 4, ['.jjj.', 'jiiij', 'jiiijj', 'jiiij', '.jjj.'])
        cv.art(63, 3, ['.Y.', '.y.', '.F.', '.F.', 'jij'])     # espelma
        cv.art(3, 9, ['cC.', 'cc.', '.E.'])                  # poma
        cv.art(26, 11, ['.pPp.', 'pPppq', '.qqq.'])          # pa
        cv.art(48, 10, ['.pPp.', 'pPppq', '.qqq.'])
    return cv


def bed():
    cv = Cv(24, 48)
    cv.r(3, 2, 20, 7, 'W'); cv.hl(3, 20, 2, 'L')         # capçal
    cv.r(5, 4, 18, 6, 'M'); cv.vl(11, 4, 6, 'W'); cv.vl(12, 4, 6, 'W')
    cv.hl(3, 20, 8, 'K')
    cv.r(3, 9, 20, 39, 'W')                               # bastiment
    cv.r(4, 9, 19, 18, 'm')                               # llençol
    cv.r(6, 10, 17, 14, 'F'); cv.hl(6, 17, 15, 'R'); cv.vl(17, 11, 14, 'r')   # coixí
    cv.p(6, 10, 'm'); cv.p(17, 10, 'm')
    cv.r(4, 19, 19, 38, 'c')                              # flassada
    cv.r(4, 17, 19, 18, 'r'); cv.hl(4, 19, 19, 'C')
    cv.vl(19, 20, 38, 'e'); cv.hl(4, 19, 38, 'e')
    for x, y in ((7, 24), (13, 28), (9, 33), (16, 23), (15, 35)):
        cv.p(x, y, 'e'); cv.p(x + 1, y + 1, 'e')
    cv.r(3, 39, 20, 41, 'W'); cv.hl(3, 20, 39, 'L')       # peu del llit
    cv.hl(3, 20, 42, 'K')
    cv.r(3, 43, 20, 43, '1'); cv.hl(3, 20, 44, '2')
    for lx in (3, 19):
        cv.r(lx, 43, lx + 1, 44, 'K')
    cv.hl(3, 20, 45, '3'); cv.hl(3, 20, 46, '3')
    return cv


BOOKS = 'cCaebfEygcPaqfCebyQacfEgCbe'


def bookshelf(kind='full'):
    cv = Cv()
    cv.r(3, 1, 20, 2, 'W'); cv.hl(3, 20, 1, 'L')
    cv.r(3, 3, 20, 20, 'K')
    cv.r(4, 3, 19, 19, 'X')
    for sy in (8, 14):
        cv.hl(4, 19, sy, 'M')
    cv.hl(3, 20, 20, 'B')
    n = 0
    for si, y0 in enumerate((3, 9, 15)):
        x = 4
        while x <= 19:
            n += 1
            h = 5 - (n * 7 % 3 == 0) - (n * 5 % 7 == 0)
            col = BOOKS[(n * 3 + si) % len(BOOKS)]
            if kind == 'half' and (n * 11 % 5 < 2 or (si == 1 and x > 11)):
                x += 1
                continue
            if kind == 'potions' and si == 1:
                break
            cv.vl(x, y0 + 5 - h, y0 + 4, col)
            if n % 4 == 0 and x < 19:       # llibre gruixut
                cv.vl(x + 1, y0 + 5 - h, y0 + 4, col); cv.p(x + 1, y0 + 6 - h, 'y')
                x += 1
            x += 1
    if kind == 'potions':
        for x, c1, c2 in ((5, 'c', 'e'), (9, 'a', 'b'), (13, 'f', 'E'), (17, 'y', 'o')):
            cv.art(x, 9, ['.i.', '.i.', c1 * 3, c1 + c2 * 2, '.' + c2 + '.'][0:5])
            cv.p(x, 13, c2); cv.p(x + 2, 13, c2)
    if kind == 'half':
        cv.art(13, 11, ['.F.', 'FnF', '.F.'])        # calavera
    cv.drop()
    return cv


def wardrobe():
    cv = Cv()
    cv.r(4, 1, 19, 2, 'W'); cv.hl(4, 19, 1, 'L')
    cv.r(4, 3, 19, 20, 'W')
    cv.vl(4, 3, 20, 'K'); cv.vl(19, 3, 20, 'K'); cv.hl(4, 19, 3, 'K'); cv.hl(4, 19, 20, 'B')
    cv.vl(11, 4, 19, 'K'); cv.vl(12, 4, 19, 'M')
    for x0 in (6, 14):
        cv.r(x0, 5, x0 + 3, 10, 'M'); cv.r(x0, 13, x0 + 3, 18, 'M')
        cv.hl(x0, x0 + 3, 5, 'D'); cv.hl(x0, x0 + 3, 13, 'D')
    cv.p(10, 12, 'y'); cv.p(13, 12, 'y'); cv.p(10, 13, 'o'); cv.p(13, 13, 'o')
    cv.drop()
    return cv


def throne():
    cv = Cv()
    cv.r(6, 1, 17, 12, 's'); cv.hl(6, 17, 1, 'u')         # respatller de pedra
    cv.vl(6, 2, 12, 't'); cv.vl(17, 2, 12, 'v')
    cv.art(5, 0, ['y', 'g']); cv.art(18, 0, ['y', 'g']); cv.art(11, 0, ['yy'])
    cv.r(8, 3, 15, 11, 'c'); cv.hl(8, 15, 3, 'C'); cv.vl(15, 4, 11, 'e')
    cv.art(11, 5, ['yy', 'yy'])
    cv.r(4, 9, 6, 17, 's'); cv.r(17, 9, 19, 17, 's')     # braços
    cv.hl(4, 6, 9, 'u'); cv.hl(17, 19, 9, 'u')
    cv.p(4, 9, 'y'); cv.p(19, 9, 'y')
    cv.r(7, 12, 16, 16, 'c'); cv.hl(7, 16, 12, 'C'); cv.hl(7, 16, 16, 'e')   # coixí
    cv.r(4, 17, 19, 20, 'w'); cv.hl(4, 19, 17, 'v'); cv.hl(5, 18, 19, 'v')
    cv.hl(4, 19, 17, 's'); cv.hl(7, 16, 17, 'u')
    cv.drop()
    return cv


# ───────────────────────── Caixes, bótes i sacs ─────────────────────────

def crate_small():
    cv = Cv()
    cv.r(7, 8, 16, 13, 'L'); cv.r(9, 10, 14, 11, 'M'); cv.hl(8, 15, 9, 'D'); cv.vl(8, 9, 12, 'D')
    cv.hl(9, 15, 12, 'W'); cv.vl(15, 10, 12, 'W')
    cv.hl(7, 16, 14, 'G')
    cv.r(7, 15, 16, 19, 'K'); cv.hl(7, 16, 15, 'X'); cv.vl(10, 16, 19, 'X'); cv.vl(13, 16, 19, 'X')
    cv.vl(16, 15, 19, 'B')
    cv.drop()
    return cv


def crate_braced():
    cv = Cv()
    cv.r(4, 1, 20, 9, 'L'); cv.r(6, 3, 18, 7, 'W')
    cv.hl(6, 18, 2, 'D'); cv.vl(5, 2, 8, 'D'); cv.hl(6, 18, 8, 'W'); cv.vl(19, 2, 8, 'W')
    for y in (4, 6):                         # taulons de la tapa
        cv.hl(6, 18, y, 'M')
    cv.r(11, 3, 13, 7, 'L'); cv.vl(11, 3, 7, 'D'); cv.p(12, 5, 'X')   # travesser i clau
    cv.p(4, 4, 'H'); cv.p(20, 6, 'H'); cv.p(11, 1, 'H')
    cv.hl(4, 20, 10, 'G')
    cv.r(4, 11, 20, 19, 'K'); cv.hl(4, 20, 12, 'X'); cv.hl(4, 20, 19, 'B'); cv.vl(20, 11, 19, 'B')
    for i in range(6):                       # travesser en diagonal
        cv.p(6 + i * 2, 13 + i, 'D'); cv.p(7 + i * 2, 13 + i, 'D'); cv.p(8 + i * 2, 13 + i, 'M')
    cv.r(4, 13, 5, 18, 'D'); cv.r(18, 13, 19, 18, 'D')
    cv.drop()
    return cv


def crate_open(fill=None):
    cv = Cv()
    cv.r(4, 2, 20, 10, 'L')
    cv.r(6, 4, 18, 9, 'X'); cv.hl(6, 18, 4, 'B'); cv.hl(6, 18, 3, 'W'); cv.vl(5, 3, 9, 'W'); cv.vl(19, 3, 9, 'M')
    cv.hl(4, 20, 2, 'H')
    if fill == 'apples':
        for i, (x, y) in enumerate(((6, 6), (9, 5), (12, 6), (15, 5), (8, 8), (11, 8), (14, 8), (17, 7))):
            cv.art(x, y, ['Cc', 'ce']); cv.p(x + 1, y - 1, 'E' if i % 2 else 'f')
    if fill == 'bottles':
        for x in (7, 10, 13, 16):
            cv.art(x, 5, ['i.', 'fE', 'fE', 'EE'])
    cv.hl(4, 20, 11, 'G')
    cv.r(4, 12, 20, 19, 'K'); cv.hl(4, 20, 13, 'X'); cv.hl(4, 20, 19, 'B'); cv.vl(20, 12, 19, 'B')
    for x in (8, 12, 16):
        cv.vl(x, 14, 18, 'X')
    cv.drop()
    return cv


def crate_stack():
    cv = Cv()
    small = crate_small()
    for dx, dy in ((-5, 3), (5, 3), (0, -7)):
        for y in range(24):
            for x in range(24):
                ch = small.g[y][x]
                if ch not in '.123':
                    cv.p(x + dx, y + dy, ch)
    cv.drop()
    return cv


def barrel_iron(water=False):
    cv = Cv()
    for y in range(5, 21):                   # cos: panxa al mig
        inset = 1 if (y < 8 or y > 17) else 0
        if y == 20:
            inset = 3
        if y == 19:
            inset = 2
        cv.hl(5 + inset, 18 - inset, y, 'K')
    for x in (8, 11, 12, 15):
        cv.vl(x, 7, 19, 'X')
    cv.vl(5, 8, 17, 'B'); cv.vl(18, 8, 17, 'B')
    cv.vl(6, 8, 17, 'D'); cv.vl(7, 9, 16, 'D')
    for y in (9, 16):                        # cèrcols de ferro
        cv.hl(5, 18, y, 'j'); cv.hl(6, 9, y, 'i'); cv.p(18, y, 'v'); cv.p(5, y, 'v')
    cv.ell(11.5, 5.0, 6.4, 3.3, 'W')        # tapa
    cv.hl(8, 15, 2, 'D'); cv.p(6, 3, 'D'); cv.p(7, 3, 'D'); cv.p(16, 3, 'D'); cv.p(17, 3, 'D')
    cv.hl(8, 15, 8, 'H'); cv.p(6, 7, 'H'); cv.p(7, 7, 'H'); cv.p(16, 7, 'H'); cv.p(17, 7, 'H')
    cv.p(5, 5, 'D'); cv.p(18, 5, 'D'); cv.p(5, 4, 'D'); cv.p(18, 4, 'D')
    if water:
        cv.ell(11.5, 5.0, 4.6, 2.2, 'a'); cv.hl(9, 12, 4, 'A'); cv.p(14, 6, 'b'); cv.p(13, 6, 'b'); cv.p(8, 5, 'b')
    else:
        cv.p(11, 4, 'L'); cv.hl(13, 15, 5, 'D'); cv.p(14, 4, 'D'); cv.p(14, 6, 'D')
    cv.drop()
    return cv


def barrel_side():
    cv = Cv()
    for y in range(7, 19):
        inset = (2 if y in (7, 18) else 1 if y in (8, 17) else 0)
        col = 'L' if y < 9 else 'W' if y < 13 else 'M' if y < 16 else 'K'
        cv.hl(3 + inset, 20 - inset, y, col)
    for y in (10, 13, 16):
        cv.hl(4, 19, y, 'D' if y < 14 else 'X')
    for x in (6, 17):
        cv.vl(x, 7, 18, 'j'); cv.vl(x, 7, 9, 'i'); cv.vl(x, 16, 18, 'v')
    cv.vl(3, 9, 16, 'K'); cv.vl(20, 9, 16, 'K')
    cv.p(11, 7, 'D'); cv.p(12, 7, 'D'); cv.p(11, 6, 'M'); cv.p(12, 6, 'M')   # tap
    cv.art(4, 19, ['KK', 'BB']); cv.art(18, 19, ['KK', 'BB'])               # falques
    cv.drop()
    return cv


def keg():
    cv = Cv()
    cv.ell(11.5, 10.5, 6.6, 6.6, 'K')
    cv.ell(11.5, 10.5, 5.6, 5.6, 'j')
    cv.ell(11.5, 10.5, 4.7, 4.7, 'W')
    for x in (9, 12, 14):
        cv.vl(x, 7, 14, 'M')
    cv.hl(9, 14, 6, 'L'); cv.p(8, 7, 'L'); cv.p(7, 8, 'L'); cv.p(7, 6, 'i'); cv.p(8, 5, 'i'); cv.hl(9, 12, 5, 'i')
    cv.art(11, 13, ['ii', 'jj', '.j']); cv.p(13, 14, 'j')     # aixeta
    cv.r(5, 17, 7, 19, 'K'); cv.r(16, 17, 18, 19, 'K'); cv.hl(5, 18, 18, 'D'); cv.hl(5, 18, 19, 'K')
    cv.drop()
    return cv


SACK = ['....qQq.....', '...qpPpq....', '....QkQ.....', '...qpPppq...', '..qpPPpppq..', '.qpPPpppppq.',
        '.qpPppppppqQ', '.qpppppppqqQ', '.qpppppppqqQ', '..qqppppqqQ.', '...QQQQQQQ..']
SACK_OPEN = ['...qqqqqq...', '..qyYyygyq..', '..qgyygygq..', '...qqqqqq...', '..qpPPpppq..', '.qpPPpppppq.',
             '.qpPppppppqQ', '.qpppppppqqQ', '.qpppppppqqQ', '..qqppppqqQ.', '...QQQQQQQ..']


def sack(rows=SACK):
    cv = Cv()
    cv.art(6, 8, rows)
    cv.drop()
    return cv


def sack_pile():
    cv = Cv()
    cv.art(1, 9, SACK); cv.art(11, 9, SACK); cv.art(6, 3, SACK)
    cv.drop()
    return cv


# ───────────────────────── Gerros ─────────────────────────

VASE_TALL = ['..qPPPPPPq..', '..QQqqqqQQ..', '...qpPppq...', '...qpPppq...', '..qpPpppqq..', '.qpPPppppqq.',
             'qpPPppppppqQ', 'qpPpppppppqQ', 'qkkkkkkkkkkQ', 'qpPpppppppqQ', 'qpppppppppqQ', '.qppppppppqQ',
             '.qqppppppqQ.', '..qqppppqQQ.', '...qqqqqQQ..', '...QQQQQQ...']
AMPHORA = ['....qPPq....', '....QqqQ....', '.....pp.....', '..qq.pp.qq..', '.q..qPpq..q.', '.q.qPpppq.q.',
           '..qpPppppq..', '..qkkkkkkq..', '..qpPppppqQ.', '..qpppppqqQ.', '..qpppppqQ..', '...qpppqQ...',
           '...qpppqQ...', '....qpqQ....', '....qqQQ....', '...QQQQQQ...']
POT_ROUND = ['...qPPPPq...', '...QqqqqQ...', '..qppppppq..', '.qpPPppppqq.', 'qpPPpppppqqQ', 'qkkkkkkkkkkQ',
             'qpPppppppqqQ', 'qppppppppqQQ', '.qppppppqqQ.', '..qqqqqqQQ..']
URN = ['.....yy.....', '....qPPq....', '..qPPPPPPq..', '..QQQQQQQQ..', '...qpPppq...', '..qpPppppq..',
       '.qpPpppppqq.', '.qkkkkkkkkQ.', '.qpPpppppqQ.', '.qpppppppqQ.', '..qpppppqQ..', '...qpppqQ...',
       '....qqQQ....', '...qPPPPq...', '...QQQQQQ...']
VASE_BROKEN = ['............', '............', '............', '............', '............', '.q...q......',
               'qpq.qpPq..qQ', 'qpPqpppppqqQ', 'qkkkkkkkkkkQ', 'qpPpppppppqQ', 'qpppppppppqQ', '.qppppppppqQ',
               '.qqppppppqQ.', '..qqppppqQQ.', '...qqqqqQQ..', '...QQQQQQ...']


def vase(rows, top=None, y=None):
    cv = Cv()
    y = (20 - len(rows)) if y is None else y
    cv.art(6, y, rows)
    if top == 'plant':
        cv.art(5, y - 5, ['..f...N..f..', '.fN..fN.fN..', '..fN.fE.Nf..', '...fEfEfE...', '....EfEE....', '....QEEQ....'])
    if top == 'flowers':
        cv.art(5, y - 6, ['...c....y...', '..cCc..yYy..', '...c.C..y...', '...E.CcE....', '...fE.Ef....', '....EfE.....',
                          '....QEEQ....'])
    if top == 'shards':
        cv.art(1, 17, ['qp.', '.qQ']); cv.art(19, 16, ['.pq', 'qQ.']); cv.p(3, 14, 'p'); cv.p(21, 19, 'q')
    cv.drop()
    return cv


# ───────────────────────── Cofres ─────────────────────────

def chest(state='closed'):
    cv = Cv()
    x0, x1 = 4, 19
    if state == 'closed':
        cv.r(x0, 5, x1, 10, 'W'); cv.hl(x0, x1, 5, 'L'); cv.hl(x0 + 1, x1 - 1, 6, 'L'); cv.hl(x0, x1, 10, 'M')
        cv.r(x0, 11, x1, 13, 'M'); cv.hl(x0, x1, 13, 'K')
        for x in (9, 14):
            cv.vl(x, 6, 12, 'M')
        for x in (6, 17):                     # ferramenta daurada
            cv.vl(x, 5, 13, 'g'); cv.p(x, 5, 'Y'); cv.p(x, 6, 'y'); cv.vl(x, 11, 13, 'o')
        cv.hl(x0, x1, 14, 'g'); cv.p(x0, 14, 'o'); cv.p(x1, 14, 'o')
    else:
        cv.r(x0, 1, x1, 8, 'K'); cv.hl(x0, x1, 1, 'L'); cv.vl(x0, 2, 8, 'W'); cv.vl(x1, 2, 8, 'M')   # tapa dreta
        cv.r(x0 + 2, 3, x1 - 2, 7, 'X'); cv.hl(x0 + 1, x1 - 1, 2, 'W')
        for x in (6, 17):
            cv.vl(x, 1, 8, 'g'); cv.p(x, 1, 'Y'); cv.vl(x, 6, 8, 'o')
        cv.r(x0, 9, x1, 13, 'X'); cv.vl(x0, 9, 13, 'W'); cv.vl(x1, 9, 13, 'M')                         # interior
        if state == 'gold':
            cv.r(x0 + 1, 10, x1 - 1, 13, 'g'); cv.hl(x0 + 3, x1 - 3, 9, 'g'); cv.hl(x0 + 5, x1 - 5, 8, 'y')
            for i, (x, y) in enumerate(((6, 10), (9, 9), (12, 10), (15, 9), (7, 12), (10, 11), (13, 12), (16, 11), (11, 8))):
                cv.art(x, y, ['yY', 'oy'] if i % 2 else ['Yy', 'yo'])
            cv.p(8, 8, 'F'); cv.p(16, 9, 'F'); cv.art(13, 9, ['Cc', 'ce'])
        cv.hl(x0, x1, 14, 'g'); cv.p(x0, 14, 'o'); cv.p(x1, 14, 'o')
    cv.r(x0, 15, x1, 19, 'K'); cv.hl(x0, x1, 19, 'B'); cv.vl(x1, 15, 19, 'B')
    for x in (9, 14):
        cv.vl(x, 15, 18, 'X')
    for x in (6, 17):
        cv.vl(x, 15, 19, 'o'); cv.p(x, 15, 'g')
    cv.art(11, 13 if state == 'closed' else 14, ['yy', 'yn', 'oo'] if state == 'closed' else ['yy', 'on'])   # pany
    cv.drop()
    return cv


# ───────────────────────── Monedes i tresor (mida d'objecte petit) ─────────────────────────

def small(rows, x=None, y=None, sh=None):
    """Objecte petit com els de `uf_items.png`: al mig, amb l'ombra de dues files (alfa 64)."""
    cv = Cv()
    w = max(len(r) for r in rows)
    x = (24 - w) // 2 if x is None else x
    y = 17 - len(rows) if y is None else y
    cv.art(x, y, rows)
    s0, s1 = sh or (x + 1, x + w - 2)
    cv.r(s0, 18, s1, 19, '1')
    return cv


COIN_STACK = ['.YYYY.', 'YyyyyY', 'oggggo', 'gyyyyg', 'oggggo', 'gyyyyg', 'oggggo', 'gyyyyg', '.oooo.']
COIN_STACKS = ['........YYYY.', '.......YyyyyY', '.......oggggo', '.YYYY..gyyyyg', 'YyyyyY.oggggo', 'oggggo.gyyyyg',
               'gyyyyg.oggggo', 'oggggoYYYYyyg', 'gyyyyYyyyyYgo', '.ooooogggggo.', '......gyyyyg.', '.......oooo..']
COINS_LOOSE = ['....YY.......', '...YyyY...YY.', '...oggo..Yyyg', '.YY.oo...oggo', 'Yyyg...YY.oo.', 'oggo..Yyyg...',
               '.oo...oggo...', '.......oo....']
BARS = ['....YYYYYYY....', '...YyyyyyygO...', '...ggggggggo...', '.YYYYYY.YYYYYY.', 'Yyyyyygoyyyyyyg', 'gggggggoggggggo',
        '.oooooo..ooooo.']
CROWN = ['.c...a...c.', '.y..yYy..y.', '.yy.yyy.yy.', '.yYyyYyyyg.', '.gcggaggcg.', '.oggggggoo.']
GOBLET = ['.YyyyyyG.', '.yeeeeeg.', '.yyyyygg.', '..yyygg..', '...yg....', '...yg....', '..yygg...', '.oggggo..']
GEMS = ['....Cc.......', '...Ccce..AA..', '....ce..Aaab.', '..NN.....ab..', '.Nffe.Cc.....', '..fE.Ccce....',
        '......ce.....']
POUCH = ['...qnnq........', '...pnnpp.......', '....mpm........', '...qQqQ...YY...', '.pppppppp.yyg..', 'qppppmpppp.oo..',
         'qppppppppp..YY.', '.pppppppQ.YYyyg', '.QQQpppQQYyygo.', '....QQQ..oggo..']
RING_PILE = ['....yy....a..', '...y..y..yAy.', '...y..y.y.a.y', '.c..yy..y...y', 'yCy......yyy.', 'y.y.iIi......',
             '.y..i.i......', '.....i.......']


def coin_pile(wide, tall, seed):
    """Munt de monedes: mitja el·lipse plena de monedes (3×2) col·locades en files esglaonades."""
    cv = Cv()
    cx, base = 11.5, 18
    inside = lambda x, y: y <= base and ((x - cx) / (wide / 2)) ** 2 + ((y - base) / tall) ** 2 <= 1.0
    for y in range(24):
        for x in range(24):
            if inside(x, y):
                cv.p(x, y, 'g')
    n = seed
    for y in range(base - int(tall), base + 1, 2):
        off = (y // 2) % 2 * 2
        for x in range(off, 24, 4):
            n = (n * 1103515245 + 12345) % 2147483648
            if inside(x, y) and inside(x + 2, y):
                cv.art(x, y, ['YyY' if n % 3 == 0 else 'yYy', 'oyg' if n % 2 else 'ooy'])
    for x in range(24):                      # vora de sota més fosca i contorn de dalt clar
        ys = [y for y in range(24) if cv.g[y][x] != '.']
        if ys:
            cv.p(x, ys[-1], 'o')
            if cv.g[ys[0]][x] == 'g':
                cv.p(x, ys[0], 'y')
    n = seed * 7 + 3
    for _ in range(2 + int(tall) // 4):       # espurnes
        n = (n * 1103515245 + 12345) % 2147483648
        x, y = 4 + n % 16, base - 1 - (n // 16) % max(1, int(tall) - 1)
        if inside(x, y):
            cv.p(x, y, 'F')
    cv.drop('112' if tall > 6 else '11')
    return cv


def build():
    F, K, V, X, T = 'ox_furniture', 'ox_containers', 'ox_vases', 'ox_chests', 'ox_treasure'
    # Mobles
    variants('ox_chair', 'Cadira', F, chair(), WOODS)
    variants('ox_chair_cushion', 'Cadira amb coixí', F, chair_cushion(),
             [('red', 'vermell', {}), ('blue', 'blau', BLUE), ('green', 'verd', GREEN)])
    variants('ox_stool', 'Tamboret', F, stool(), WOODS_M)
    variants('ox_bench', 'Banc', F, bench(), WOODS_M)
    variants('ox_table_small', 'Tauleta', F, table_small(), WOODS)
    variants('ox_table_round', 'Taula rodona', F, table_round(), WOODS)
    variants('ox_table_long', 'Taula llarga', F, table_long(), WOODS)
    variants('ox_table_long_cloth', 'Taula llarga amb estovalles', F, table_long('cloth'),
             [('red', 'vermelles', {}), ('blue', 'blaves', BLUE), ('purple', 'morades', PURPLE)])
    add('ox_table_long_feast', 'Taula llarga parada', F, table_long('feast'))
    variants('ox_bed', 'Llit', F, bed(), [('red', 'vermell', {}), ('blue', 'blau', BLUE), ('green', 'verd', GREEN),
                                           ('purple', 'morat', PURPLE)])
    add('ox_bookshelf', 'Prestatgeria plena', F, bookshelf('full'))
    add('ox_bookshelf_half', 'Prestatgeria mig buida', F, bookshelf('half'))
    add('ox_bookshelf_potions', 'Prestatgeria amb pocions', F, bookshelf('potions'))
    variants('ox_wardrobe', 'Armari', F, wardrobe(), WOODS_M)
    variants('ox_throne', 'Tron', F, throne(), [('red', 'vermell', {}), ('blue', 'blau', BLUE), ('purple', 'morat', PURPLE)])
    # Caixes, bótes i sacs
    variants('ox_crate_small', 'Caixa petita', K, crate_small(), WOODS)
    variants('ox_crate_braced', 'Caixa reforçada', K, crate_braced(), WOODS)
    variants('ox_crate_open', 'Caixa oberta', K, crate_open(), WOODS)
    add('ox_crate_apples', 'Caixa de pomes', K, crate_open('apples'))
    add('ox_crate_bottles', 'Caixa d\'ampolles', K, crate_open('bottles'))
    variants('ox_crate_stack', 'Pila de caixes', K, crate_stack(), WOODS)
    variants('ox_barrel_iron', 'Bóta ferrada', K, barrel_iron(), WOODS)
    add('ox_barrel_water', 'Bóta d\'aigua', K, barrel_iron(True))
    variants('ox_barrel_side', 'Bóta ajaguda', K, barrel_side(), WOODS)
    add('ox_keg', 'Barrilet amb aixeta', K, keg())
    add('ox_sack', 'Sac', K, sack(), BURLAP)
    add('ox_sack_grain', 'Sac de gra', K, sack(SACK_OPEN), BURLAP)
    add('ox_sack_pile', 'Pila de sacs', K, sack_pile(), BURLAP)
    # Gerros
    for rows, vid, label in ((VASE_TALL, 'tall', 'Gerro alt'), (AMPHORA, 'amphora', 'Àmfora'),
                             (POT_ROUND, 'round', 'Olla'), (URN, 'urn', 'Urna')):
        variants(f'ox_vase_{vid}', label, V, vase(rows), CERAMICS)
    variants('ox_vase_broken', 'Gerro trencat', V, vase(VASE_BROKEN, 'shards'), CERAMICS)
    add('ox_vase_plant', 'Gerro amb planta', V, vase(POT_ROUND, 'plant'))
    add('ox_vase_flowers', 'Gerro amb flors', V, vase(POT_ROUND, 'flowers'), CERAMICS[2][2])
    # Cofres
    for state, label in (('closed', 'tancat'), ('empty', 'obert'), ('gold', 'amb or')):
        add(f'ox_chest_{state}', f'Cofre gran {label}', X, chest(state))
    for state, label in (('closed', 'tancat'), ('empty', 'obert')):
        add(f'ox_chest_dark_{state}', f'Cofre fosc {label}', X, chest(state), DARK_WOOD)
    for state, label in (('closed', 'tancat'), ('empty', 'obert')):
        add(f'ox_chest_iron_{state}', f'Cofre de ferro {label}', X, chest(state), IRON)
    add('ox_chest_iron_gold', 'Cofre de ferro amb or', X, chest('gold'), {k: v for k, v in IRON.items() if k not in 'gyo'})
    # Monedes i tresor
    METALS = [('gold', 'd\'or', {}), ('silver', 'de plata', SILVER), ('copper', 'de coure', COPPER)]
    variants('ox_coin_stack', 'Pila de monedes', T, small(COIN_STACK), METALS)
    variants('ox_coin_stacks', 'Piles de monedes', T, small(COIN_STACKS), METALS)
    variants('ox_coins_loose', 'Monedes escampades', T, small(COINS_LOOSE, sh=(8, 15)), METALS)
    variants('ox_coin_pile', 'Munt de monedes', T, coin_pile(13, 6, 5), METALS)
    variants('ox_coin_hoard', 'Gran munt de monedes', T, coin_pile(21, 12, 11), METALS)
    variants('ox_bars', 'Lingots', T, small([r.replace('O', 'o') for r in BARS]), METALS[:2])
    add('ox_crown', 'Corona', T, small(CROWN))
    add('ox_goblet', 'Copa d\'or', T, small(GOBLET, sh=(9, 14)))
    add('ox_goblet_silver', 'Copa de plata', T, small(GOBLET, sh=(9, 14)), {**SILVER, 'e': '#5c2a86'})
    add('ox_gems', 'Gemmes', T, small(GEMS, sh=(7, 16)))
    add('ox_pouch', 'Bossa de monedes', T, small(POUCH))
    add('ox_jewels', 'Joies', T, small(RING_PILE, sh=(7, 16)))


def main():
    build()
    ids = [p[0] for p in PIECES]
    assert len(ids) == len(set(ids)), 'ids repetits'
    os.makedirs(OUT, exist_ok=True)
    meta = []
    for pid, label, group, im in PIECES:
        im.save(os.path.join(OUT, pid + '.png'), optimize=True)
        meta.append({'id': pid, 'label': label, 'group': group, 'w': im.width, 'h': im.height})
    with open(os.path.join(OUT, 'pieces.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'{len(PIECES)} peces → {os.path.relpath(OUT, ROOT)}')


if __name__ == '__main__':
    main()
