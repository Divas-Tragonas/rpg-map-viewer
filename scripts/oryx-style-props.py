#!/usr/bin/env python3
"""
Objectes nous «a l'estil Oryx» (v5.26, refets a la v5.27): mobles, caixes, bótes, gerros, cofres
i tresor dibuixats per codi amb les regles del full `uf_terrain.png` / `uf_items.png` de l'autor:

  - graella lògica de 24 px ampliada a 2× (una casella = 48 px), sense contorn negre;
  - la rampa de fusta i de pedra de l'Oryx, allargada per dalt i per baix per poder fer volum;
  - **una sola perspectiva**: vista de dalt i de davant (uns 25° sobre l'horitzontal). De cada
    peça es veu la cara de dalt (clara) i la del davant (fosca); les rodones ensenyen la boca o la
    tapa com una el·lipse aixafada a 0,4 (`TILT`), igual que la tapa de la bóta de l'autor;
  - **una sola llum**, de dalt a l'esquerra i una mica del davant (`LIGHT`);
  - l'ombra de tres franges sota la peça (alfa 64 / 38 / 13).

Les peces rodones (bótes, gerros, sacs, copes, monedes, corona…) no es pinten a mà: `lathe()` fa
girar un perfil al voltant de l'eix vertical, el projecta amb la perspectiva de dalt amb un
z-buffer i tria el to de la rampa segons la normal i la llum. Així la boca, l'interior, les sanefes
i els cèrcols surten corbats com toca. Els mobles de cares planes es pinten amb `face_top` /
`face_front` (to de dalt, to del davant, cantells, juntes i veta).

Art propi (no és de cap paquet): es pot redistribuir amb el repositori.

Genera `assets/decor-packs/oryx-style/<id>.png` i `pieces.json` (la llista, en ordre). Després cal
executar `scripts/decor-packs.py`, que les posa al full `decor_packs.png` i a la paleta.

⚠️ Afegir peces sempre AL FINAL de `build()` i no canviar-ne la mida (vegeu `decor-packs.py`).

    python3 scripts/oryx-style-props.py && python3 scripts/decor-packs.py
"""
import colorsys
import json
import math
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'decor-packs', 'oryx-style')

TILT = 0.4                                   # sin de l'elevació de la càmera: aixafament de les el·lipses
VIEW = (0.0, TILT, math.sqrt(1 - TILT * TILT))   # cap a la càmera (x, amunt, davant)
_l = (-0.5, 0.65, 0.57)
LIGHT = tuple(v / math.sqrt(sum(c * c for c in _l)) for v in _l)


def hue_ramp(h, s, sign=1, hi=0.82, lo=0.08):
    """Rampa de 9 tons (clar → fosc) amb el to que es desplaça: els clars càlids, els foscos freds."""
    out = []
    for i in range(9):
        t = i / 8
        light = hi + (lo - hi) * t ** 0.85
        sat = s * (0.72 + 0.28 * math.sin(math.pi * min(1.0, t * 0.8 + 0.25)))
        r, g, b = colorsys.hls_to_rgb(((h + sign * 28 * (t - 0.35)) % 360) / 360, light, sat)
        out.append('#%02x%02x%02x' % (round(r * 255), round(g * 255), round(b * 255)))
    return out


# Rampes de 9 tons, de clar (0) a fosc (8). Fusta i pedra: els tons 1–7 són els de l'Oryx.
WOOD = ['#d6b866', '#bf9f4b', '#aa8942', '#957639', '#755d2e', '#554421', '#44361c', '#332a16', '#231c0f']
DARK_WOOD = ['#b98a46', '#9c7034', '#835b2a', '#6c4a22', '#573a1b', '#442d15', '#342210', '#27190c', '#1a1008']
STONE = ['#afafaf', '#8f8f8f', '#7c7c7c', '#6b655f', '#5a5a5a', '#4b4b4b', '#3a3a3a', '#2c2c2c', '#1c1c1c']
IRON = ['#f0f0f0', '#cfcfd4', '#a9a9b0', '#8a8a92', '#6e6e76', '#55555c', '#404046', '#2d2d32', '#1b1b1f']
GOLD = ['#fff9c4', '#ffee88', '#f3d23c', '#dcb733', '#c9982b', '#b07a24', '#8a5a1c', '#633d13', '#40260b']
SILVER = ['#ffffff', '#eef0f4', '#d6d9e0', '#b6bac4', '#989ca8', '#7b7f8c', '#5f6370', '#454854', '#2c2e38']
COPPER = ['#ffe0c0', '#f6bf90', '#e29a5e', '#cb7d42', '#b06530', '#8e4d24', '#6d3919', '#4d2710', '#301708']
CLAY = ['#f8d6a4', '#ecb878', '#dc964a', '#c8813f', '#b27138', '#96592c', '#7a4622', '#5a3218', '#3a1f0e']
BURLAP = ['#efe0b0', '#dcc790', '#c8ae72', '#b3975c', '#9c814b', '#846b3d', '#6b5630', '#4f3f23', '#352a17']
PAPER = ['#ffffff', '#f6f4ea', '#e6e3d2', '#cfccba', '#b3b0a2', '#96948c', '#787880', '#5c5c68', '#40404c']
RED, BLUE, GREEN, PURPLE = hue_ramp(2, 0.78, -1), hue_ramp(212, 0.72), hue_ramp(128, 0.55), hue_ramp(276, 0.55, -1)
TEAL = hue_ramp(190, 0.75)

MATS = {
    'wood': WOOD, 'stone': STONE, 'iron': IRON, 'gold': GOLD, 'trim': GOLD, 'coin': GOLD, 'cloth': RED, 'cer': CLAY,
    'band': PAPER, 'sack': BURLAP, 'paper': PAPER, 'water': TEAL, 'leaf': GREEN, 'red': RED, 'blue': BLUE,
    'green': GREEN, 'purple': PURPLE, 'clay': CLAY, 'silver': SILVER,
}
SHADOW = {1: (1, 1, 1, 64), 2: (0, 0, 0, 38), 3: (0, 0, 0, 13)}


def rgba(v):
    return (int(v[1:3], 16), int(v[3:5], 16), int(v[5:7], 16), 255)


def hsh(x, y, seed=0):
    n = (x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)
    n = (n ^ (n >> 13)) * 1274126177
    return (n ^ (n >> 16)) & 0xffff


class Cv:
    """Llenç en píxels lògics (2× al full). Cada píxel és `(material, to 0–8)` o `('sh', franja)`."""

    def __init__(self, w=24, h=24):
        self.w, self.h = w, h
        self.g = {}

    def p(self, x, y, mat, i=None):
        if 0 <= x < self.w and 0 <= y < self.h:
            if mat is None:
                self.g.pop((x, y), None)
            else:
                self.g[(x, y)] = (mat, max(0, min(8, i))) if mat != 'sh' else (mat, i)

    def get(self, x, y):
        return self.g.get((x, y))

    def solid(self, x, y):
        t = self.g.get((x, y))
        return t is not None and t[0] != 'sh'

    def r(self, x0, y0, x1, y1, mat, i=None):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.p(x, y, mat, i)

    def hl(self, x0, x1, y, mat, i=None):
        self.r(x0, y, x1, y, mat, i)

    def vl(self, x, y0, y1, mat, i=None):
        self.r(x, y0, x, y1, mat, i)

    def tone(self, x, y, d):
        t = self.g.get((x, y))
        if t and t[0] != 'sh':
            self.p(x, y, t[0], t[1] + d)

    def art(self, x, y, rows, mat='wood', key=None):
        """Píxels a mà: un dígit = to de `mat`; una lletra de `key` = (material, to); '.' = res; '_' = esborra."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch == '.':
                    continue
                if ch == '_':
                    self.p(x + i, y + j, None)
                elif ch.isdigit():
                    self.p(x + i, y + j, mat, int(ch))
                else:
                    self.p(x + i, y + j, *key[ch])

    def blit(self, other, dx=0, dy=0):
        for (x, y), t in other.g.items():
            if t[0] != 'sh':
                self.p(x + dx, y + dy, *t)

    def shade_under(self, x0, x1, y0, y1):
        """Ombra sota un moble amb potes (com la taula de l'Oryx): 64 entre les potes, després 38 i 13."""
        for y in range(y0, y1 + 3):
            band = 1 if y < y1 else 2 if y == y1 else 3
            for x in range(x0, x1 + 1):
                if (x, y) not in self.g:
                    self.p(x, y, 'sh', band)

    def drop(self, bands=(1, 2, 3)):
        """Ombra de l'Oryx: sota l'últim píxel opac de cada columna, les franges 64 / 38 / 13."""
        for x in range(self.w):
            ys = [y for y in range(self.h) if self.solid(x, y)]
            if not ys:
                continue
            for i, b in enumerate(bands):
                if (x, ys[-1] + 1 + i) not in self.g:
                    self.p(x, ys[-1] + 1 + i, 'sh', b)

    def image(self, over=None):
        mats = {**MATS, **(over or {})}
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        for (x, y), (m, i) in self.g.items():
            im.putpixel((x, y), SHADOW[i] if m == 'sh' else rgba(mats[m][i]))
        return im.resize((self.w * 2, self.h * 2), Image.NEAREST)


# ───────────────────────── Motor de les peces rodones ─────────────────────────

def lathe(cv, cx, prof, mat='cer', a=1, z=7, mat_at=None, mod=None, cap=None, cut=None, dy=0.0, edge=True, hollow=True):
    """
    Sòlid de revolució d'eix vertical vist amb la perspectiva del full. `prof` = [(alçada L, radi)]
    de dalt a baix, en píxels lògics (L creix cap avall). `a`/`z` = to més clar i més fosc.
    `mat_at(L, θ)` → material (sanefes, cèrcols); `mod(L, θ)` → tons de més (juntes, arrugues);
    `cut(θ)` → L per sobre de la qual no hi ha paret (vores trencades, puntes d'una corona);
    `cap` = (L, radi, fn(dx, dz) → (material, to)) = una tapa plana (la tapa d'una bóta, el líquid).
    Sense tapa, per la boca es veu la paret de dins (més fosca); `hollow=False` = massís (no es pinta).
    """
    zb = {}

    def plot(xf, yf, near, tok):
        k = (math.floor(xf + 0.5), math.floor(yf + dy + 0.5))
        if k not in zb or near > zb[k][0]:
            zb[k] = (near, tok)

    def radius(L):
        for (l0, r0), (l1, r1) in zip(prof, prof[1:]):
            if l0 <= L <= l1:
                return r0 + (r1 - r0) * (L - l0) / (l1 - l0) if l1 > l0 else r1
        return prof[-1][1]

    L, top, bot = prof[0][0], prof[0][0], prof[-1][0]
    while L <= bot + 1e-9:
        r = radius(L)
        m = (radius(min(bot, L + 0.15)) - radius(max(top, L - 0.15))) / 0.3      # dr/dL: >0 = mira amunt
        c = 1 / math.sqrt(1 + m * m)
        up = m * c
        steps = max(24, int(r * 14))
        for s in range(steps):
            th = -math.pi + 2 * math.pi * s / steps
            if cut and L < cut(th):
                continue
            sx, cz = math.sin(th), math.cos(th)
            n = (sx * c, up, cz * c)
            inside = n[1] * VIEW[1] + n[2] * VIEW[2] < 0
            b = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]
            if inside:
                if not hollow:
                    continue
                i = 8 - max(0.0, -b) * 2.5               # la paret de dins: fosca, una mica de llum a la dreta
            else:
                b = max(0.0, (b + 0.25) / 1.25)         # llum embolcallant: el costat fosc no queda negre
                i = z - b * (z - a)
                if b > 0.95:
                    i = a - 1
                if L < top + 0.55:
                    i -= 1                              # el llavi de dalt agafa llum
            if mod:
                i += mod(L, th)
            mm = (mat_at(L, th) if mat_at else None) or mat
            plot(cx + r * sx, L + TILT * r * cz, VIEW[2] * r * cz - VIEW[1] * L, (mm, int(round(i)), inside))
        L += 0.07
    if cap:
        cl, cr, fn = cap
        n = int(cr * 5) + 2
        for iz in range(-n, n + 1):
            for ix in range(-n, n + 1):
                dx, dz = ix / 5 * 1.0, iz / 5 * 1.0
                if dx * dx + dz * dz <= cr * cr:
                    m, i = fn(dx, dz)
                    plot(cx + dx, cl + TILT * dz, VIEW[2] * dz - VIEW[1] * cl + 0.01, (m, i, True))
    for (x, y), (_, (m, i, flat)) in zb.items():
        if edge and not flat and ((x + 1, y) not in zb or (x, y + 1) not in zb):
            i += 1                      # vora dreta i de sota una mica més fosca: retalla la peça sense contorn
        cv.p(x, y, m, i)
    return set(zb)


def disc(mat, base=3, r=1.0, rim=None, seams=None, shade=False):
    """Tapa plana per a `lathe`: to `base`, vora `rim`, llum al fons a l'esquerra, juntes cada `seams` px
    i, amb `shade`, l'ombra que hi fa la vora del fons (tapa enfonsada, líquid)."""
    def fn(dx, dz):
        d = math.hypot(dx, dz)
        i = base
        if seams and int(math.floor(dx + 100.5)) % seams == 0:
            i += 1
        if rim is not None and d > r - 1.0:
            return mat, rim + (1 if dx > r * 0.35 else 0)
        if shade and dz < -r * 0.35:
            i += 2 if dz < -r * 0.6 else 1
        elif dx < -r * 0.3 and dz < r * 0.2 and d > r * 0.45:
            i -= 1
        return mat, i
    return fn


# ───────────────────────── Cares planes ─────────────────────────

def face_top(cv, x0, y0, x1, y1, mat='wood', base=3, rows=(), cols=(), seed=1, grain=True):
    """Cara de dalt: clara, amb el cantell esquerre més clar, el dret més fosc, juntes i veta."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            i = base
            h = hsh(x, y, seed)
            if grain and h % 19 == 0:
                i += 1
            elif grain and h % 37 == 1:
                i -= 1
            if y in rows or x in cols:
                i = base + 1
            if x == x0:
                i = base - 1
            elif x == x1:
                i = base + 1
            cv.p(x, y, mat, i)


def face_front(cv, x0, y0, x1, y1, mat='wood', base=5, cols=(), rows=(), lip=True):
    """Cara del davant: fosca, amb l'ombra del cantell de dalt, les vores i les juntes."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            i = base
            if x in cols or y in rows:
                i = base + 1
            if x == x0:
                i = base - 1
            elif x == x1:
                i = base + 1
            if y == y1:
                i += 1
            if lip and y == y0:
                i = base + 2
            cv.p(x, y, mat, i)


def legs(cv, xs, y0, y1, back=(), mat='wood'):
    for bx in back:                              # potes del darrere: més fosques i més curtes
        cv.vl(bx, y0, y1 - 2, mat, 7)
    for lx in xs:
        cv.vl(lx, y0, y1, mat, 5); cv.vl(lx + 1, y0, y1, mat, 6)
        cv.p(lx, y0, mat, 6); cv.p(lx + 1, y0, mat, 7); cv.p(lx + 1, y1, mat, 7)


PIECES = []  # (id, etiqueta, grup, imatge)


def add(pid, label, group, cv, over=None):
    PIECES.append((pid, label, group, cv.image(over)))


def variants(pid, label, group, cv, vs):
    for vid, vlabel, over in vs:
        add(f'{pid}_{vid}' if vid else pid, f'{label} {vlabel}'.strip(), group, cv, over)


DARK = {'wood': DARK_WOOD}
WOODS = [('', '', {}), ('dark', 'fosca', DARK)]
WOODS_M = [('', '', {}), ('dark', 'fosc', DARK)]


# ───────────────────────── Mobles ─────────────────────────

def table(cv, x0, x1, y0, y1, leg_xs, back=(), rows=(), cols=(), seed=1):
    """Taula: tauler `y0..y1-1`, cantell clar, faldó, potes i l'ombra a sota."""
    face_top(cv, x0, y0, x1, y1 - 1, rows=rows, cols=cols, seed=seed)
    cv.hl(x0, x1, y0, 'wood', 4)                                   # cantell del fons
    cv.hl(x0, x1, y1, 'wood', 2); cv.hl(x0, x0 + (x1 - x0) // 3, y1, 'wood', 1)
    face_front(cv, x0, y1 + 1, x1, y1 + 2, base=5)
    bottom = min(y1 + 7, cv.h - 3)
    legs(cv, leg_xs, y1 + 3, bottom, back)
    cv.shade_under(x0, x1, y1 + 3, bottom)


def chair(cushion=False):
    cv = Cv()
    for px in (7, 15):                                             # muntants del respatller
        cv.vl(px, 2, 8, 'wood', 4); cv.vl(px + 1, 2, 8, 'wood', 5)
        cv.hl(px, px + 1, 1, 'wood', 2)
    cv.hl(7, 16, 2, 'wood', 2); cv.hl(7, 10, 2, 'wood', 1)        # travesser de dalt
    cv.hl(7, 16, 3, 'wood', 4); cv.hl(7, 16, 4, 'wood', 5); cv.p(16, 3, 'wood', 5); cv.p(16, 4, 'wood', 6)
    if cushion:                                                    # respatller entapissat
        cv.r(9, 5, 14, 8, 'cloth', 4); cv.hl(9, 14, 5, 'cloth', 3); cv.vl(14, 5, 8, 'cloth', 5); cv.vl(9, 6, 8, 'cloth', 3)
        cv.p(11, 6, 'cloth', 6); cv.p(12, 7, 'cloth', 6)
    else:                                                          # dues barres, es veu el terra entremig
        cv.hl(9, 14, 6, 'wood', 3); cv.hl(9, 14, 7, 'wood', 5)
    face_top(cv, 6, 9, 17, 14, seed=4, rows=(11,))                 # seient
    cv.hl(6, 17, 9, 'wood', 4)
    for px in (7, 8, 15, 16):
        cv.p(px, 9, 'wood', 6)                                     # ombra dels muntants
    cv.hl(6, 17, 15, 'wood', 2); cv.hl(6, 10, 15, 'wood', 1)
    cv.hl(6, 17, 16, 'wood', 6)
    if cushion:
        cv.r(7, 10, 16, 13, 'cloth', 3); cv.hl(8, 15, 10, 'cloth', 2); cv.vl(7, 11, 12, 'cloth', 2)
        cv.vl(16, 10, 13, 'cloth', 4); cv.hl(7, 16, 14, 'cloth', 5); cv.p(7, 10, 'wood', 4); cv.p(16, 10, 'wood', 4)
        cv.hl(9, 11, 11, 'cloth', 1); cv.p(16, 14, 'cloth', 6)
    legs(cv, (6, 16), 17, 20, back=(8, 15))
    cv.shade_under(6, 17, 17, 20)
    return cv


def stool():
    cv = Cv()
    for x, y0, y1, i in ((9, 13, 17, 7), (14, 13, 17, 7)):          # potes del darrere
        cv.vl(x, y0, y1, 'wood', i)
    for x in (6, 16):                                              # potes del davant, obertes
        cv.vl(x, 14, 19, 'wood', 5); cv.vl(x + 1, 14, 19, 'wood', 6); cv.p(x + 1, 19, 'wood', 7)
    cv.hl(8, 15, 17, 'wood', 6); cv.hl(8, 15, 16, 'wood', 5)        # travesser
    lathe(cv, 11.5, [(10, 5.6), (12, 5.6)], 'wood', a=4, z=7, hollow=False, cap=(10, 5.6, disc('wood', 3, 5.6, rim=2)))
    cv.shade_under(6, 17, 15, 19)
    return cv


def bench():
    cv = Cv()
    face_top(cv, 1, 8, 22, 12, rows=(10,), seed=7)
    cv.hl(1, 22, 8, 'wood', 4)
    cv.hl(1, 22, 13, 'wood', 2); cv.hl(1, 8, 13, 'wood', 1)
    face_front(cv, 1, 14, 22, 15)
    legs(cv, (2, 20), 16, 19, back=(4, 19))
    cv.hl(4, 19, 17, 'wood', 7)                                    # travesser de baix
    cv.shade_under(1, 22, 16, 19)
    return cv


def table_small():
    cv = Cv()
    table(cv, 5, 18, 4, 12, (5, 17), back=(7, 16), rows=(7, 10), seed=3)
    return cv


def table_round():
    cv = Cv()
    for y in range(17, 23):                                        # ombra a terra
        for x in range(24):
            if ((x - 11.5) / 8.5) ** 2 + ((y - 19.5) / 3.2) ** 2 <= 1:
                cv.p(x, y, 'sh', 1 if ((x - 11.5) / 7.0) ** 2 + ((y - 19.2) / 2.2) ** 2 <= 1 else 2)
    lathe(cv, 11.5, [(8, 1.5), (15, 1.3), (16.5, 1.8), (17.8, 4.6), (18.6, 4.8)], 'wood', a=4, z=8, hollow=False)   # peu
    lathe(cv, 11.5, [(5.2, 9.7), (7.2, 9.7)], 'wood', a=4, z=7, hollow=False,
          cap=(5.2, 9.7, disc('wood', 3, 9.7, rim=2)))
    for x, y in ((8, 5), (15, 6), (12, 3)):
        cv.tone(x, y, 1)
    return cv


def table_long(dress=None):
    cv = Cv(72, 24)
    table(cv, 2, 69, 2, 13, (3, 35, 67), back=(6, 65), rows=(5, 9), cols=(24, 47), seed=11)
    if dress == 'cloth':
        x0, x1 = 9, 62
        for y in range(2, 14):                                     # la tela sobre el tauler
            for x in range(x0, x1 + 1):
                i = 3 if y < 12 else 4
                if hsh(x, y, 5) % 29 == 0:
                    i += 1
                cv.p(x, y, 'cloth', i - 1 if x == x0 else i + 1 if x == x1 else i)
        cv.hl(x0, x1, 2, 'cloth', 4)
        for x in range(x0 + 4, x1 - 2, 6):                         # brodat
            cv.art(x, 6, ['.2.', '212', '.2.'], 'trim')
        cv.hl(x0 + 1, x1 - 1, 12, 'trim', 3)
        for y in range(14, 20):                                    # el que penja pel davant, amb plecs
            for x in range(x0, x1 + 1):
                f = (x - x0) % 5
                i = (6, 5, 4, 5, 7)[f]
                if y == 19 and f in (0, 4):
                    continue
                cv.p(x, y, 'cloth', i)
        cv.hl(x0, x1, 14, 'cloth', 3)
        for x in range(x0, x1 + 1):
            if (x - x0) % 5 not in (0, 4):
                cv.p(x, 18, 'trim', 3 if (x - x0) % 5 != 2 else 2)
    if dress == 'feast':
        K = {'p': ('paper', 1), 'P': ('paper', 0), 'q': ('paper', 3), 'Q': ('paper', 5), 'm': ('clay', 3), 'M': ('clay', 5),
             'n': ('clay', 1), 'i': ('iron', 1), 'j': ('iron', 3), 'J': ('iron', 5), 'k': ('iron', 7), 'r': ('red', 3),
             'R': ('red', 5), 'h': ('red', 1), 'g': ('leaf', 4), 'y': ('gold', 1), 'Y': ('gold', 0), 'o': ('gold', 3),
             's': ('wood', 5), 'w': ('purple', 6)}
        plate = ['..pppp..', '.pPPPPp.', 'pPnmmMPp', 'pPmmMMPq', '.qPPPPq.', '..QQQQ..', '..ssss..']
        for x in (9, 31, 53):
            cv.art(x, 4, plate, key=K)
        mug = ['.ii.', 'iwwj', 'ijjJj', 'ijjJj', 'jjJJ.', '.ss.']
        for x in (20, 43):
            cv.art(x, 4, mug, key=K)
        cv.art(63, 1, ['.Y.', '.y.', '.o.', '.p.', '.p.', '.q.', 'ijJ', '.s.'], key=K)       # espelma
        cv.art(4, 8, ['.g.', 'hrR', 'rrR', '.R.'], key=K)                                    # poma
        for x in (25, 47):
            cv.art(x, 9, ['.nnn.', 'nmnmm', 'mmmMM', '.MMM.', '.sss.'], key=K)               # pa
        cv.art(37, 9, ['.ii.', 'ijjj', 'iJJJ', '.jJ.', '.jJ.', 'ijJJ', '.ss.'], key=K)       # copa
    return cv


def bed():
    cv = Cv(24, 48)
    # capçal: cara del davant, amb el cantell de dalt i dos poms
    cv.hl(3, 20, 1, 'wood', 2); cv.hl(3, 9, 1, 'wood', 1)
    face_front(cv, 3, 2, 20, 8, base=4, lip=False)
    cv.r(6, 3, 17, 7, 'wood', 5); cv.hl(6, 17, 3, 'wood', 7); cv.vl(6, 3, 7, 'wood', 6); cv.hl(7, 17, 7, 'wood', 4)
    cv.vl(11, 4, 6, 'wood', 6); cv.vl(12, 4, 6, 'wood', 4)
    for x in (3, 19):
        cv.r(x, 0, x + 1, 0, 'wood', 1); cv.vl(x, 1, 8, 'wood', 3); cv.vl(x + 1, 1, 8, 'wood', 5)
    # matalàs i llençol
    cv.vl(3, 9, 39, 'wood', 3); cv.vl(20, 9, 39, 'wood', 5)
    cv.r(4, 9, 19, 17, 'paper', 2); cv.hl(4, 19, 9, 'paper', 5); cv.hl(4, 19, 10, 'paper', 3); cv.vl(4, 11, 17, 'paper', 1)
    cv.vl(19, 10, 17, 'paper', 3)
    # coixí
    cv.r(6, 10, 17, 14, 'paper', 1); cv.hl(7, 16, 10, 'paper', 0); cv.vl(6, 11, 13, 'paper', 0)
    cv.vl(17, 11, 14, 'paper', 2); cv.hl(6, 17, 15, 'paper', 3); cv.hl(7, 18, 16, 'paper', 4)
    cv.p(6, 10, 'paper', 3); cv.p(17, 10, 'paper', 3); cv.p(6, 15, 'paper', 4); cv.p(17, 15, 'paper', 4)
    cv.hl(10, 13, 12, 'paper', 2); cv.p(11, 13, 'paper', 2)
    # flassada: el doblec, els plecs i el costat dret a l'ombra
    for y in range(18, 39):
        for x in range(4, 20):
            i = 3
            w = math.sin(x * 0.55 + y * 0.42) + 0.35 * math.sin(y * 0.9 - x * 0.2)
            if w > 0.95:
                i = 2
            elif w < -0.9:
                i = 4
            if x >= 18:
                i += 1
            if x == 4:
                i -= 1
            if y >= 37:
                i += 1
            cv.p(x, y, 'cloth', i)
    cv.hl(4, 19, 17, 'cloth', 1); cv.hl(4, 19, 18, 'cloth', 2); cv.hl(4, 19, 19, 'cloth', 2); cv.hl(4, 19, 20, 'cloth', 5)
    cv.hl(5, 18, 19, 'trim', 3)
    # peu del llit
    cv.hl(3, 20, 39, 'wood', 2); cv.hl(3, 9, 39, 'wood', 1)
    face_front(cv, 3, 40, 20, 43, base=5)
    cv.r(6, 41, 17, 42, 'wood', 6)
    for x in (3, 19):
        cv.vl(x, 39, 45, 'wood', 4); cv.vl(x + 1, 39, 45, 'wood', 6); cv.hl(x, x + 1, 38, 'wood', 1)
    cv.shade_under(3, 20, 44, 45)
    return cv


SPINES = [('red', 5), ('blue', 5), ('green', 5), ('purple', 5), ('gold', 5), ('clay', 5), ('red', 6), ('blue', 6),
          ('wood', 4), ('green', 6), ('purple', 6), ('clay', 4)]


def bookshelf(kind='full'):
    cv = Cv()
    face_top(cv, 3, 0, 20, 2, seed=2)                              # sostre del moble
    cv.hl(3, 20, 0, 'wood', 4)
    cv.hl(2, 21, 3, 'wood', 2); cv.hl(2, 8, 3, 'wood', 1)          # cornisa
    cv.r(3, 4, 20, 20, 'wood', 8)
    cv.hl(3, 20, 4, 'wood', 7)
    cv.vl(3, 4, 20, 'wood', 4); cv.vl(20, 4, 20, 'wood', 6)
    for sy in (9, 14, 19):                                         # lleixes: es veu el tauler de dalt
        cv.hl(4, 19, sy, 'wood', 3); cv.p(4, sy, 'wood', 2)
    cv.hl(3, 20, 20, 'wood', 6); cv.p(3, 20, 'wood', 5)
    cv.hl(3, 20, 21, 'wood', 7)
    n = 0
    for si, base in enumerate((8, 13, 18)):                        # fila de sota de cada prestatge
        x = 4
        while x <= 19:
            n += 1
            h = hsh(n, si, 9)
            if kind == 'potions' and si == 1:
                break
            if kind == 'half' and (h % 5 < 2 or (si == 1 and x > 10)):
                x += 1 + h % 2
                continue
            tall = 4 - (1 if h % 3 == 0 else 0)
            mat, tone = SPINES[h % len(SPINES)]
            wide = 2 if (h % 4 == 0 and x < 19) else 1
            for k in range(wide):
                cv.vl(x + k, base - tall + 1, base, mat, tone + k)
                cv.p(x + k, base - tall, 'paper', 2 + k)           # els fulls, vistos de dalt
            if wide == 2:
                cv.p(x, base - 1, 'gold', 2)
            elif h % 7 == 0:
                cv.p(x, base - 2, 'gold', 3)
            x += wide
    if kind == 'potions':
        for x, m in ((5, 'red'), (9, 'blue'), (13, 'green'), (17, 'purple')):
            cv.art(x, 10, ['.c.', '.g.', 'abb', 'bdd'][0:4], key={'c': ('wood', 2), 'g': ('paper', 2), 'a': (m, 1),
                                                                 'b': (m, 3), 'd': (m, 5)})
    if kind == 'half':
        cv.art(13, 10, ['.01.', '0112', '0818', '.23.'], 'paper')   # calavera
        cv.art(5, 16, ['33.', '.55', '..7'], 'clay')               # llibre caigut
    cv.drop()
    return cv


def wardrobe():
    cv = Cv()
    face_top(cv, 4, 0, 19, 1, seed=6)
    cv.hl(4, 19, 0, 'wood', 4)
    cv.hl(3, 20, 2, 'wood', 2); cv.hl(3, 9, 2, 'wood', 1)          # cornisa
    face_front(cv, 4, 3, 19, 19, base=4)
    cv.hl(4, 19, 3, 'wood', 7)
    cv.vl(11, 4, 18, 'wood', 7); cv.vl(12, 4, 18, 'wood', 5)       # junta de les portes
    for x0 in (5, 13):
        for y0 in (5, 12):
            cv.r(x0, y0, x0 + 5, y0 + 5, 'wood', 5)
            cv.hl(x0, x0 + 5, y0, 'wood', 7); cv.vl(x0, y0, y0 + 5, 'wood', 6)
            cv.hl(x0 + 1, x0 + 5, y0 + 5, 'wood', 3); cv.vl(x0 + 5, y0 + 1, y0 + 5, 'wood', 3)
    cv.p(10, 11, 'gold', 1); cv.p(13, 11, 'gold', 1); cv.p(10, 12, 'gold', 4); cv.p(13, 12, 'gold', 4)
    cv.hl(3, 20, 19, 'wood', 5); cv.hl(3, 20, 20, 'wood', 7); cv.p(3, 19, 'wood', 4)
    cv.drop()
    return cv


def throne():
    cv = Cv()
    # respatller de pedra amb el plafó entapissat i el marc daurat
    cv.hl(6, 17, 1, 'stone', 1); cv.hl(6, 10, 1, 'stone', 0)
    face_front(cv, 6, 2, 17, 11, 'stone', base=4, lip=False)
    cv.r(7, 2, 16, 11, 'trim', 3); cv.hl(7, 16, 2, 'trim', 1); cv.vl(7, 3, 11, 'trim', 2); cv.vl(16, 3, 11, 'trim', 5)
    cv.r(8, 3, 15, 11, 'cloth', 4); cv.hl(8, 15, 3, 'cloth', 6); cv.vl(8, 4, 11, 'cloth', 3); cv.vl(15, 4, 11, 'cloth', 5)
    for x, y in ((10, 5), (13, 5), (10, 8), (13, 8)):               # botons de l'entapissat
        cv.p(x, y, 'cloth', 6); cv.p(x - 1, y, 'cloth', 3); cv.p(x, y + 1, 'cloth', 3)
    cv.art(10, 0, ['.12.', '1234'], 'trim')
    for x in (5, 17):
        cv.art(x, 0, ['12', '34'], 'trim')
    # braços
    for x0 in (4, 17):
        cv.r(x0, 9, x0 + 2, 10, 'stone', 2); cv.hl(x0, x0 + 2, 9, 'stone', 1)
        face_front(cv, x0, 11, x0 + 2, 16, 'stone', base=4)
        cv.p(x0 + 1, 11, 'trim', 1); cv.p(x0 + 1, 12, 'trim', 4)
    # coixí del seient
    cv.r(7, 12, 16, 14, 'cloth', 3); cv.hl(7, 16, 12, 'cloth', 4); cv.hl(8, 15, 13, 'cloth', 2); cv.vl(7, 13, 14, 'cloth', 2)
    cv.vl(16, 12, 14, 'cloth', 4); cv.hl(7, 16, 15, 'cloth', 5); cv.hl(9, 12, 13, 'cloth', 1)
    # base
    cv.hl(4, 19, 16, 'stone', 2); cv.hl(4, 9, 16, 'stone', 1)
    face_front(cv, 4, 17, 19, 18, 'stone', base=5)
    cv.hl(3, 20, 19, 'stone', 3); cv.hl(3, 8, 19, 'stone', 2)
    cv.hl(3, 20, 20, 'stone', 6); cv.p(3, 20, 'stone', 5); cv.p(20, 20, 'stone', 7)
    cv.drop()
    return cv


# ───────────────────────── Caixes, bótes i sacs ─────────────────────────

def crate_box(cv, x0, x1, yt, yl, yb, open_=False, brace=True, seed=1):
    """Caixa: tapa `yt..yl-1` (bastiment i taulons), cantell `yl`, cara del davant fins a `yb`."""
    face_top(cv, x0, yt, x1, yl - 1, base=2, grain=False)          # bastiment de la tapa
    cv.hl(x0, x1, yt, 'wood', 3)
    if open_:
        cv.r(x0 + 1, yt + 1, x1 - 1, yl - 2, 'wood', 8)            # el fons, a les fosques
        cv.hl(x0 + 1, x1 - 1, yt + 1, 'wood', 5)                   # paret de dins del fons, que rep llum
        cv.hl(x0 + 1, x1 - 1, yt + 2, 'wood', 6)
        cv.vl(x0 + 1, yt + 1, yl - 2, 'wood', 7)
        cv.vl(x1 - 1, yt + 2, yl - 2, 'wood', 6)
        for x in range(x0 + 4, x1 - 1, 4):
            cv.p(x, yt + 1, 'wood', 6); cv.p(x, yt + 2, 'wood', 7)
    else:
        face_top(cv, x0 + 2, yt + 2, x1 - 2, yl - 3, base=3, seed=seed,
                 rows=tuple(range(yt + 4, yl - 3, 2)) if yl - yt > 7 else (yt + 3,))
        cv.hl(x0 + 2, x1 - 2, yt + 2, 'wood', 5); cv.vl(x0 + 2, yt + 2, yl - 3, 'wood', 5)   # ombra del bastiment
        for x, y in ((x0, yt), (x1, yt), (x0, yl - 1), (x1, yl - 1)):
            cv.p(x, y, 'wood', 5)                                  # claus
    cv.hl(x0, x1, yl, 'wood', 1); cv.hl(x0, x0 + (x1 - x0) // 2, yl, 'wood', 0)
    face_front(cv, x0, yl + 1, x1, yb, base=5)
    if yb - yl > 5:
        cv.r(x0 + 2, yl + 3, x1 - 2, yb - 2, 'wood', 7)            # taulons enfonsats
        cv.hl(x0 + 2, x1 - 2, yl + 3, 'wood', 8)
        for x in range(x0 + 4, x1 - 2, 3):
            cv.vl(x, yl + 3, yb - 2, 'wood', 8)
        cv.vl(x0, yl + 1, yb, 'wood', 4); cv.vl(x0 + 1, yl + 2, yb - 1, 'wood', 5)
        cv.vl(x1, yl + 1, yb, 'wood', 7); cv.vl(x1 - 1, yl + 2, yb - 1, 'wood', 6)
        cv.hl(x0, x1, yb, 'wood', 7)
        if brace:                                                  # travesser en diagonal
            n = x1 - x0 - 4
            for k in range(n + 1):
                y = yb - 2 - round(k * (yb - yl - 5) / n)
                cv.p(x0 + 2 + k, y, 'wood', 4); cv.p(x0 + 2 + k, y + 1, 'wood', 6)
            cv.hl(x0 + 2, x1 - 2, yb - 1, 'wood', 6)
    else:
        for x in range(x0 + 3, x1, 3):
            cv.vl(x, yl + 2, yb - 1, 'wood', 7)


def crate_small():
    cv = Cv()
    crate_box(cv, 7, 16, 8, 13, 19)
    cv.drop()
    return cv


def crate_braced():
    cv = Cv()
    crate_box(cv, 4, 20, 1, 10, 19, seed=3)
    cv.drop()
    return cv


def crate_open(fill=None):
    cv = Cv()
    crate_box(cv, 4, 20, 1, 10, 19, open_=True, brace=False)
    if fill == 'apples':
        for j, y in enumerate((3, 5, 6)):
            for x in range(5 + (j % 2) * 2, 18, 4 if j < 2 else 3):
                m = 'green' if hsh(x, y, 4) % 4 == 0 else 'red'
                cv.art(x, y, ['123', '245', '.56'], m)
                cv.p(x + 1, y - 1, 'wood', 6)
    if fill == 'bottles':
        for x in (6, 9, 12, 15, 18):
            cv.art(x - 1, 3, ['.c', '.2', '13', '25', '36', '46'], 'green', key={'c': ('clay', 1)})
    cv.drop()
    return cv


def crate_stack():
    cv = Cv()
    cb = Cv()
    crate_box(cb, 7, 16, 8, 13, 19)
    cv.blit(cb, -5, 1); cv.blit(cb, 5, 1)
    for x in range(7, 17):                                         # ombra de la de dalt sobre les de baix
        for y in (9, 10):
            cv.tone(x, y, 2)
    cv.blit(cb, 0, -8)
    cv.drop()
    return cv


def barrel_iron(water=False):
    cv = Cv()
    stave = lambda L, th: (1 if (th + 9.0) % 0.449 < 0.09 else 0) - (1 if int((th + 9.0) / 0.449) % 3 == 0 and L > 6 else 0)
    hoop = lambda L, th: 'iron' if (7.3 <= L <= 8.5 or 15.3 <= L <= 16.5) else None
    prof = [(4.8, 5.9), (6.5, 6.4), (11.5, 7.0), (16.5, 6.4), (18.2, 5.8)]
    if water:
        lathe(cv, 11.5, prof, 'wood', a=4, z=8, mod=stave, mat_at=hoop, cap=(6.2, 5.3, disc('water', 3, 5.3, shade=True)))
    else:                                                          # tapa a ras: cèrcol clar i taulons
        lathe(cv, 11.5, prof, 'wood', a=4, z=8, mod=stave, mat_at=hoop, hollow=False,
              cap=(4.8, 5.9, disc('wood', 3, 5.9, rim=1)))
    if water:
        cv.art(8, 5, ['.11', '1..'], 'water'); cv.p(14, 7, 'water', 2)
    else:
        cv.p(13, 5, 'wood', 6); cv.p(14, 5, 'wood', 5)             # el tap
    cv.drop()
    return cv


def barrel_side():
    cv = Cv()
    tones = [3, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7, 8, 8]
    for x in range(3, 21):
        bulge = 0 if 7 <= x <= 16 else 1 if 5 <= x <= 18 else 2
        y0, y1 = 6 + bulge, 18 - bulge
        for y in range(y0, y1 + 1):
            i = tones[round((y - y0) * 12 / (y1 - y0))]
            if (y - 6) % 3 == 2:
                i += 1                                             # juntes de les dogues
            if x in (3, 20):
                i += 1
            cv.p(x, y, 'wood', i)
            if x in (6, 7, 16, 17):
                cv.p(x, y, 'iron', max(1, i - 2 + (1 if x in (7, 17) else 0)))
    cv.art(11, 5, ['34', '56'], 'wood')                            # el tap de dalt
    cv.art(4, 18, ['45', '567', '6778'], 'wood'); cv.art(16, 18, ['.45', '.567', '6778'], 'wood')   # falques
    cv.drop()
    return cv


def keg():
    cv = Cv()
    def ring(cy, r, mat, i):
        for y in range(24):
            for x in range(24):
                if (x - 11.5) ** 2 + (y - cy) ** 2 <= r * r:
                    cv.p(x, y, mat, i - 1 if x < 9 else i + 1 if x > 15 else i)
    for k, (mat, i) in zip((4, 3, 2, 1), (('wood', 5), ('iron', 3), ('wood', 3), ('iron', 2))):   # el cos, cap al fons
        ring(10.5 - k * 0.8, 6.4, mat, i)
    ring(10.9, 6.4, 'wood', 5)                                     # el cap del barril, mirant endavant
    ring(10.9, 5.3, 'wood', 4)
    for y in range(24):
        for x in range(24):
            if (x - 11.5) ** 2 + (y - 10.9) ** 2 <= 5.3 * 5.3:
                i = 4 + (1 if x in (9, 12, 15) else 0) + (1 if y > 13 else 0) - (1 if (x + y) < 17 else 0)
                cv.p(x, y, 'wood', i)
    cv.art(11, 13, ['12', '34', '.5', '.6'], 'iron'); cv.p(13, 14, 'iron', 4)      # aixeta
    cv.art(4, 16, ['4455', '.566', '.677'], 'wood'); cv.art(16, 16, ['4556', '566.', '677.'], 'wood')
    cv.hl(6, 17, 19, 'wood', 7)
    cv.drop()
    return cv


SACK_PROF = [(8.0, 1.9), (8.8, 1.3), (9.6, 1.1), (10.4, 2.4), (12.0, 4.8), (14.5, 6.0), (17.0, 5.8), (18.5, 4.6), (19.0, 3.4)]


def draw_sack(cv, cx, dy=0.0, grain=False, mat='sack', scale=1.0):
    wr = lambda L, th: 1 if (math.sin(th * 4 + L * 0.9) > 0.86 and L < 15) or (L > 17 and math.sin(th * 3) > 0.9) else 0
    if grain:
        prof = [(10.0, 4.4), (10.8, 4.7), (13.0, 5.8), (16.5, 6.0), (18.5, 4.6), (19.0, 3.4)]
        fill = lambda dx, dz: ('gold', 2 + hsh(int(dx * 2), int(dz * 3), 3) % 3)
        lathe(cv, cx, prof, mat, a=1, z=7, mod=wr, cap=(10.9, 3.9, fill), dy=dy)
    else:
        prof = [(L, r * scale) for L, r in SACK_PROF]
        rope = lambda L, th: 'wood' if 9.3 <= L <= 10.0 else None
        lathe(cv, cx, prof, mat, a=1, z=7, mod=wr, mat_at=rope, cap=(8.0, 1.9 * scale, lambda dx, dz: (mat, 4)), dy=dy)


def sack(grain=False):
    cv = Cv()
    draw_sack(cv, 11.5, grain=grain)
    cv.drop()
    return cv


def sack_pile():
    cv = Cv()
    draw_sack(cv, 6.5, dy=1); draw_sack(cv, 16.5, dy=1)
    draw_sack(cv, 11.5, dy=-4, scale=0.95)
    cv.drop()
    return cv


# ───────────────────────── Gerros ─────────────────────────

VASE_TALL = [(4.2, 3.3), (5.0, 2.7), (6.4, 2.3), (8.0, 2.8), (10.0, 4.8), (12.5, 5.8), (14.5, 5.5), (17.0, 3.6),
             (18.4, 2.6), (19.0, 2.9)]
AMPHORA = [(3.6, 2.7), (4.5, 2.0), (7.0, 1.8), (9.0, 3.6), (11.0, 4.7), (13.0, 4.3), (16.0, 2.6), (18.4, 1.4), (19.2, 2.3)]
POT_ROUND = [(8.4, 4.6), (9.3, 4.0), (10.2, 4.8), (12.2, 6.8), (14.6, 7.3), (17.0, 6.0), (18.6, 3.8)]
URN = [(9.0, 3.2), (9.8, 2.8), (11.2, 4.6), (13.0, 5.4), (15.0, 4.6), (17.2, 3.0), (18.8, 2.3)]


def vase(shape, top=None):
    cv = Cv()
    band = {'tall': (12.0, 13.3), 'amphora': (10.6, 11.6), 'round': (13.6, 14.9), 'urn': (12.6, 13.7)}[shape]
    prof = {'tall': VASE_TALL, 'amphora': AMPHORA, 'round': POT_ROUND, 'urn': URN}[shape]
    ba = lambda L, th: 'band' if band[0] <= L <= band[1] else None
    if top == 'broken':
        jag = lambda th: 10.0 + 3.2 * abs(((th * 3 / math.pi + 0.4) % 2.0) - 1.0)
        lathe(cv, 11.5, prof, 'cer', a=1, z=7, mat_at=ba, cut=jag)
        K = {'a': ('cer', 2), 'b': ('cer', 4), 'c': ('cer', 6), 's': ('sh', 1)}
        cv.art(1, 17, ['ab.', 'bcc', '.ss'], key=K); cv.art(19, 15, ['.ab', 'abc', 'ss.'], key=K)
        cv.art(3, 13, ['a', 's'], key=K); cv.art(21, 19, ['b', 's'], key=K)
    else:
        if shape == 'amphora':                                     # nanses, darrere el coll
            for (x, y), i in zip(((8, 5), (7, 5), (6, 6), (6, 7), (6, 8), (7, 9)), (2, 2, 3, 3, 4, 5)):
                cv.p(x, y, 'cer', i); cv.p(23 - x, y, 'cer', i + 2)
        soil = (prof[0][0] + 0.5, prof[0][1] - 0.7, lambda dx, dz: ('wood', 7)) if top in ('plant', 'flowers') else None
        lathe(cv, 11.5, prof, 'cer', a=1, z=7, mat_at=ba, cap=soil)
        if shape == 'urn':                                         # tapa i pom
            lathe(cv, 11.5, [(7.6, 0.6), (8.0, 2.8), (8.6, 3.7), (9.1, 3.7)], 'cer', a=1, z=7, hollow=False)
            lathe(cv, 11.5, [(6.2, 0.4), (6.7, 1.0), (7.3, 0.9), (7.7, 0.5)], 'trim', a=1, z=6, hollow=False)
    K = {'a': ('leaf', 2), 'b': ('leaf', 4), 'c': ('leaf', 6), 'r': ('red', 2), 'R': ('red', 4), 'y': ('gold', 1),
         'Y': ('gold', 3), 'w': ('paper', 0), 'W': ('paper', 3), 'p': ('purple', 3), 'P': ('purple', 5)}
    if top == 'plant':
        cv.art(4, 1, ['...a.....a.....', '..ab..a..ab..a.', '..abb.ab.bb.ab.', '.a.bbcabbbc.bb.', '.ab.bcbbcbc.bc.',
                      '..bb.cbbcc.bc..', '...bc.bbc.cc...', '....ccbcccc....', '.....cbcc......'], key=K)
    if top == 'flowers':
        cv.art(4, 0, ['....rr.....yy..', '...rRRr...yYYy.', '....RR..ww.YY..', '..pp.b.wWWw.b..', '.pPPp.b.WW.b...',
                      '..PP..bb.b.b...', '...b..abbbb....', '...ab..bbc.....', '....bb.bcc.....', '.....cbbc......'], key=K)
    cv.drop()
    return cv


# ───────────────────────── Cofres ─────────────────────────

LID = [5, 4, 3, 2, 2, 3, 4, 5]                                     # la tapa és mig cilindre: tons de fons a davant


def chest(state='closed'):
    cv = Cv()
    x0, x1 = 4, 19
    bands = (6, 7, 16, 17)
    if state == 'closed':
        for k, i in enumerate(LID):
            y = 4 + k
            for x in range(x0, x1 + 1):
                if k == 0 and x in (x0, x1):
                    continue
                t = i + (1 if x == x1 else -1 if x == x0 else 0) + (1 if (x - x0) % 4 == 2 and k not in (3, 4) else 0)
                cv.p(x, y, 'wood', t)
                if x in bands:
                    cv.p(x, y, 'trim', max(0, i - 1 + (1 if x in (7, 17) else 0)))
        cv.hl(x0 + 1, x0 + 8, 7, 'wood', 1)                        # llum al llom de la tapa
        for x in bands:
            cv.p(x, 7, 'trim', 0 if x in (6, 16) else 1)
        cv.hl(x0, x1, 12, 'wood', 8)                               # la junta de la tapa
        ytop = 13
    else:
        # tapa oberta, dreta al fons: es veu el folre de dins
        cv.r(x0, 0, x1, 8, 'wood', 4); cv.hl(x0 + 1, x1 - 1, 0, 'wood', 2); cv.p(x0, 0, None); cv.p(x1, 0, None)
        cv.vl(x0, 1, 8, 'wood', 3); cv.vl(x1, 1, 8, 'wood', 6)
        for y in range(1, 9):
            for x in range(x0 + 1, x1):
                cv.p(x, y, 'cloth', 7 if y < 3 else 6 if y < 6 else 5)
            cv.p(x0 + 1, y, 'cloth', 7); cv.p(x1 - 1, y, 'cloth', 6)
        for x in bands:
            cv.p(x, 0, 'trim', 1 if x in (6, 16) else 2); cv.vl(x, 1, 8, 'trim', 5 if x in (6, 16) else 6)
        # la boca: paret del fons, parets dels costats i el fons
        cv.r(x0, 9, x1, 12, 'wood', 8)
        cv.hl(x0 + 1, x1 - 1, 9, 'wood', 6); cv.hl(x0 + 1, x1 - 1, 10, 'wood', 7)
        cv.vl(x0, 9, 12, 'wood', 2); cv.vl(x1, 9, 12, 'wood', 4)
        if state == 'gold':
            heap(cv, 11.5, 12.6, 7.0, 3.6, 12, 7, mat='coin', rz=2.2)
            cv.art(13, 9, ['.12.', '1345', '.56.'], 'red'); cv.art(7, 10, ['.12', '134', '.5.'], 'blue')
            cv.p(9, 8, 'paper', 0); cv.p(15, 10, 'paper', 0)
        cv.hl(x0, x1, 13, 'wood', 1); cv.hl(x0, x0 + 6, 13, 'wood', 0)     # cantell del davant
        for x in bands:
            cv.p(x, 13, 'trim', 1)
        ytop = 14
    face_front(cv, x0, ytop, x1, 19, base=5, rows=(16,))
    for x in bands:
        for y in range(ytop, 20):
            cv.p(x, y, 'trim', (3 if x in (6, 16) else 4) + (2 if y == ytop else 1 if y == 19 else 0))
    cv.hl(x0, x1, 20, 'wood', 7); cv.p(x0, 20, 'trim', 4); cv.p(x1, 20, 'trim', 6); cv.p(x0, 19, 'trim', 3); cv.p(x1, 19, 'trim', 5)
    ly = 11 if state == 'closed' else 14
    cv.art(11, ly, ['12', '13', '38', '34'] if state == 'closed' else ['13', '38', '34'], 'trim')    # pany
    cv.drop()
    return cv


# ───────────────────────── Monedes i tresor ─────────────────────────

COIN = ['.0111.', '113122', '111223', '.5566.']                 # una moneda ajaguda: la cara i el cantell


def coin(cv, cx, L, mat='coin', lit=0):
    rows = [''.join(ch if ch == '.' else str(min(8, int(ch) + lit)) for ch in r) for r in COIN] if lit else COIN
    cv.art(int(round(cx - 3)), int(round(L - 1)), rows, mat)


def heap(cv, cx, base, rx, height, n, seed, mat='coin', rz=None):
    """Munt de monedes: un turó fosc i, a sobre, monedes posades de fons a davant sobre la seva superfície."""
    rz = rz or rx
    steps = 12
    prof = [(base - height * math.cos(math.pi / 2 * k / steps), max(0.4, rx * math.sin(math.pi / 2 * k / steps)))
            for k in range(steps + 1)]
    lathe(cv, cx, prof, mat, a=5, z=7, edge=False, hollow=False)
    pts = []
    s = seed
    for k in range(n):
        s = (s * 1103515245 + 12345) % 2147483648
        rho = math.sqrt(((s >> 8) % 1000) / 1000) * 0.98
        s = (s * 1103515245 + 12345) % 2147483648
        phi = ((s >> 8) % 1000) / 1000 * 2 * math.pi
        u, v = rho * math.cos(phi), rho * math.sin(phi)
        pts.append((v - math.sqrt(max(0.0, 1 - rho * rho)) * 0.3, u, v, height * math.sqrt(max(0.0, 1 - rho * rho))))
    for k in range(int(rx * 0.9)):                                 # la vora del davant, a terra
        phi = math.pi * (k + 0.5) / int(rx * 0.9)
        pts.append((math.sin(phi) + 0.2, math.cos(phi) * 1.05, math.sin(phi) * 1.05, 0.0))
    for _, u, v, h in sorted(pts):
        lit = round(2.6 * (1 - h / height) * (0.5 + 0.5 * max(0.0, v))) + (1 if u > 0.3 else 0) + (1 if u > 0.75 else 0)
        coin(cv, round(cx + u * (rx - 2.0)) + 0.5, base - h + TILT * v * rz - 0.6, mat=mat, lit=min(3, lit))


def small_shadow(cv):
    cv.drop((1, 2))


def coin_stack():
    cv = Cv()
    stripes = lambda L, th: 1 if int(L * 1.0 + 0.3) % 2 else -1
    lathe(cv, 11.5, [(9.0, 2.7), (17.0, 2.7)], 'coin', a=2, z=6, mod=stripes, hollow=False,
          cap=(9.0, 2.7, lambda dx, dz: ('coin', 1 if dx * dx + dz * dz > 2.2 else 2)))
    small_shadow(cv)
    return cv


def coin_stacks():
    cv = Cv()
    stripes = lambda L, th: 1 if int(L + 0.3) % 2 else -1
    for cx, top, bot in ((13.5, 6.0, 15.0), (6.5, 11.0, 16.0), (18.5, 12.0, 17.0), (11.5, 14.0, 18.0)):
        lathe(cv, cx, [(top, 2.7), (bot, 2.7)], 'coin', a=2, z=6, mod=stripes, hollow=False,
              cap=(top, 2.7, lambda dx, dz: ('coin', 1 if dx * dx + dz * dz > 2.2 else 2)))
    small_shadow(cv)
    return cv


def coins_loose():
    cv = Cv()
    for cx, L in ((8.5, 8.5), (15.5, 10.0), (4.5, 12.5), (11.5, 13.5), (18.5, 15.0), (7.5, 17.0), (14.5, 18.0)):
        coin(cv, cx, L)
        for x in range(int(cx - 1.5), int(cx + 2.5)):
            if not cv.solid(x, int(L + 2.6)):
                cv.p(x, int(L + 2.6), 'sh', 1)
    return cv


def coin_pile(rx, height, n, seed):
    cv = Cv()
    heap(cv, 11.5, 16.5, rx, height, n, seed, rz=rx * 0.8)
    for k in range(2 + int(height) // 4):                          # espurnes
        h = hsh(k, seed, 5)
        x, y = 6 + h % 12, int(17 - height * 0.9) + (h >> 4) % max(2, int(height * 0.7))
        if cv.solid(x, y):
            cv.p(x, y, 'paper', 0)
            if height > 6:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if cv.solid(x + dx, y + dy):
                        cv.p(x + dx, y + dy, 'coin', 0)
    cv.drop((1, 1, 2) if height > 6 else (1, 2))
    return cv


INGOT = ['.11111111..', '0111111123.', '2222222234.', '33333333456', '.4444444567']


def bars():
    cv = Cv()
    cv.art(0, 12, INGOT, 'coin'); cv.art(12, 12, INGOT, 'coin')
    cv.art(6, 14, ['...........', '.5555555.67'], 'coin')
    cv.art(6, 8, INGOT, 'coin')
    for x in range(7, 17):
        cv.tone(x, 13, 1)
    small_shadow(cv)
    return cv


def crown():
    cv = Cv()
    K = {'p': ('paper', 0), 'v': ('cloth', 5), 'V': ('cloth', 6), 'r': ('red', 3), 'R': ('red', 5), 'b': ('blue', 3)}
    cv.art(4, 8, ['..p.....p.....p.', '..1.....1.....3.', '.111...111...233', '.111vVV111vVV233', '0111111112222334',
                  '011rR112b2223rR4', '1111112222333445', '.55555566666777.'], 'coin', K)
    small_shadow(cv)
    return cv


def goblet():
    cv = Cv()
    lathe(cv, 11.5, [(8.4, 3.6), (9.6, 3.5), (11.6, 2.7), (13.0, 1.1), (13.6, 0.8), (15.6, 0.8), (16.6, 1.5),
                     (17.4, 3.0), (17.9, 3.1)], 'coin', a=1, z=6,
          mat_at=lambda L, th: 'red' if 10.3 <= L <= 11.0 and abs(th) < 0.35 else None,
          cap=(9.3, 3.0, lambda dx, dz: ('cloth', 5 if dz < 0.3 else 4)))
    small_shadow(cv)
    return cv


GEM = ['.012.', '01234', '12345', '.345.', '..5..']


def gems():
    cv = Cv()
    for x, y, m in ((9, 7, 'red'), (14, 9, 'blue'), (4, 11, 'green'), (10, 12, 'purple'), (16, 14, 'red'), (6, 15, 'blue')):
        cv.art(x, y, GEM if (x + y) % 2 == 0 else [r[::1] for r in GEM[:4]] + ['.....'], m)
        cv.p(x + 1, y + 1, 'paper', 0)
    small_shadow(cv)
    return cv


def pouch():
    cv = Cv()
    wr = lambda L, th: 1 if math.sin(th * 4 + L) > 0.85 and L < 15 else 0
    lathe(cv, 9.5, [(9.0, 2.2), (9.8, 1.5), (10.6, 1.3), (11.4, 2.6), (13.0, 4.6), (15.5, 5.4), (17.4, 4.6), (18.0, 3.4)],
          'cer', a=1, z=7, mod=wr, mat_at=lambda L, th: 'trim' if 10.3 <= L <= 10.9 else None,
          cap=(9.4, 1.6, lambda dx, dz: ('coin', 2 if dz > 0 else 5)))
    for cx, L in ((17.5, 15.0), (20.5, 16.6), (16.5, 17.6), (19.5, 13.4)):
        coin(cv, cx, L)
    small_shadow(cv)
    return cv


def jewels():
    cv = Cv()
    # collaret de perles
    for k in range(15):
        a = -math.pi * 0.05 + k * 2 * math.pi / 15
        x, y = round(9.5 + 6.2 * math.cos(a)), round(12.5 + 3.4 * math.sin(a))
        cv.p(x, y, 'paper', 1 if math.cos(a) < 0.3 else 3); cv.p(x, y + 1, 'paper', 4 if math.sin(a) > 0 else 2)
    cv.art(8, 15, ['.12.', '1234', '.45.'], 'blue')
    # anells
    for cx, L, m, g in ((17.5, 15.0, 'coin', 'red'), (12.5, 9.5, 'silver', 'green')):
        lathe(cv, cx, [(L, 2.3), (L + 1.0, 2.3)], m, a=1, z=6, edge=False)
        cv.art(int(cx - 0.5), int(L - 2), ['12', '34'], g)
    small_shadow(cv)
    return cv


def build():
    F, K, V, X, T = 'ox_furniture', 'ox_containers', 'ox_vases', 'ox_chests', 'ox_treasure'
    cloth = lambda r: {'cloth': r}
    # Mobles
    variants('ox_chair', 'Cadira', F, chair(), WOODS)
    variants('ox_chair_cushion', 'Cadira amb coixí', F, chair(True),
             [('red', 'vermell', {}), ('blue', 'blau', cloth(BLUE)), ('green', 'verd', cloth(GREEN))])
    variants('ox_stool', 'Tamboret', F, stool(), WOODS_M)
    variants('ox_bench', 'Banc', F, bench(), WOODS_M)
    variants('ox_table_small', 'Tauleta', F, table_small(), WOODS)
    variants('ox_table_round', 'Taula rodona', F, table_round(), WOODS)
    variants('ox_table_long', 'Taula llarga', F, table_long(), WOODS)
    variants('ox_table_long_cloth', 'Taula llarga amb estovalles', F, table_long('cloth'),
             [('red', 'vermelles', {}), ('blue', 'blaves', cloth(BLUE)), ('purple', 'morades', cloth(PURPLE))])
    add('ox_table_long_feast', 'Taula llarga parada', F, table_long('feast'))
    variants('ox_bed', 'Llit', F, bed(), [('red', 'vermell', {}), ('blue', 'blau', cloth(BLUE)),
                                           ('green', 'verd', cloth(GREEN)), ('purple', 'morat', cloth(PURPLE))])
    add('ox_bookshelf', 'Prestatgeria plena', F, bookshelf('full'))
    add('ox_bookshelf_half', 'Prestatgeria mig buida', F, bookshelf('half'))
    add('ox_bookshelf_potions', 'Prestatgeria amb pocions', F, bookshelf('potions'))
    variants('ox_wardrobe', 'Armari', F, wardrobe(), WOODS_M)
    variants('ox_throne', 'Tron', F, throne(), [('red', 'vermell', {}), ('blue', 'blau', cloth(BLUE)),
                                                ('purple', 'morat', cloth(PURPLE))])
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
    add('ox_sack', 'Sac', K, sack())
    add('ox_sack_grain', 'Sac de gra', K, sack(True))
    add('ox_sack_pile', 'Pila de sacs', K, sack_pile())
    # Gerros
    CER = [('clay', 'd\'argila', {'band': PAPER}), ('blue', 'blau', {'cer': BLUE, 'band': GOLD}),
           ('white', 'blanc', {'cer': PAPER, 'band': BLUE}), ('green', 'verd', {'cer': GREEN, 'band': PAPER})]
    for vid, label in (('tall', 'Gerro alt'), ('amphora', 'Àmfora'), ('round', 'Olla'), ('urn', 'Urna')):
        variants(f'ox_vase_{vid}', label, V, vase(vid), CER)
    variants('ox_vase_broken', 'Gerro trencat', V, vase('tall', 'broken'), CER)
    add('ox_vase_plant', 'Gerro amb planta', V, vase('round', 'plant'), CER[0][2])
    add('ox_vase_flowers', 'Gerro amb flors', V, vase('round', 'flowers'), CER[2][2])
    # Cofres
    for state, label in (('closed', 'tancat'), ('empty', 'obert'), ('gold', 'amb or')):
        add(f'ox_chest_{state}', f'Cofre gran {label}', X, chest(state))
    for state, label in (('closed', 'tancat'), ('empty', 'obert')):
        add(f'ox_chest_dark_{state}', f'Cofre fosc {label}', X, chest(state), {'wood': DARK_WOOD, 'cloth': PURPLE})
    IRONC = {'wood': STONE, 'trim': IRON, 'cloth': BLUE}
    for state, label in (('closed', 'tancat'), ('empty', 'obert')):
        add(f'ox_chest_iron_{state}', f'Cofre de ferro {label}', X, chest(state), IRONC)
    add('ox_chest_iron_gold', 'Cofre de ferro amb or', X, chest('gold'), IRONC)
    # Monedes i tresor
    METALS = [('gold', 'd\'or', {}), ('silver', 'de plata', {'coin': SILVER}), ('copper', 'de coure', {'coin': COPPER})]
    variants('ox_coin_stack', 'Pila de monedes', T, coin_stack(), METALS)
    variants('ox_coin_stacks', 'Piles de monedes', T, coin_stacks(), METALS)
    variants('ox_coins_loose', 'Monedes escampades', T, coins_loose(), METALS)
    variants('ox_coin_pile', 'Munt de monedes', T, coin_pile(7.0, 4.5, 14, 5), METALS)
    variants('ox_coin_hoard', 'Gran munt de monedes', T, coin_pile(10.0, 8.0, 40, 11), METALS)
    variants('ox_bars', 'Lingots', T, bars(), METALS[:2])
    add('ox_crown', 'Corona', T, crown())
    add('ox_goblet', 'Copa d\'or', T, goblet())
    add('ox_goblet_silver', 'Copa de plata', T, goblet(), {'coin': SILVER, 'cloth': PURPLE, 'red': BLUE})
    add('ox_gems', 'Gemmes', T, gems())
    add('ox_pouch', 'Bossa de monedes', T, pouch())
    add('ox_jewels', 'Joies', T, jewels())


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
