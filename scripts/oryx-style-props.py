#!/usr/bin/env python3
"""
Objectes nous «a l'estil Oryx» (v5.26; refets a la v5.27 i a la v5.29): mobles, caixes, bótes,
gerros, cofres i tresor dibuixats per codi. Art propi: es pot redistribuir amb el repositori.

ESTUDI DE L'ESTIL (mesurat píxel a píxel a `uf_terrain.png` i `uf_items.png`; és el que mana):

  1. **48 px natius, detall d'1 px.** El full NO és art de 24 px ampliat: les línies, els claus i
     les esquerdes fan 1 px. (Les dues primeres versions es van dibuixar a 24 px i ampliar a 2×:
     el píxel es veia el doble de gros que el de la taula de l'autor. No tornar-hi.)
  2. **Tons plans.** Cada cara és d'un sol to; no hi ha degradats ni llum de costat. El volum el
     dóna l'orientació: el que mira amunt és clar (`W`), el que mira endavant és fosc (`K`), el de
     sota encara més. Una cara fa servir 2–3 tons, i molt junts.
  3. **El detall és dibuix, no ombrejat**: el cantell clar d'1 px al davant de la cara de dalt,
     píxels clars solts a les vores (desgast), claus d'1 px a les cantonades, alguna esquerda en
     diagonal amb el nus fosc, juntes d'1 px a la cara del davant.
  4. **Sense contorn** als mobles; als objectes petits de botí, el contorn és del mateix color
     (el marc daurat del cofre, l'anell de la moneda).
  5. **Perspectiva**: de dalt i de davant, molt de dalt. La taula ensenya 27 px de tauler i 13 de
     davant i potes; la caixa, 20 de tapa i 18 de davant; la tapa de la bóta és una el·lipse de
     26×14 (`TILT` 0,55). Mai una vista frontal pura.
  6. **Mides**: un moble omple la casella (34–42 px d'ample); un objecte de botí en fa 16–24.
  7. **Ombra**: franges planes sota la peça, alfa 64 / 38 / 13, de 2–3 px cadascuna; sota una
     taula, el bloc de 64 omple l'espai entre les potes. El botí porta una ratlla de 64 sota.
  8. **Colors**: fusta `#bf9f4b #aa8942 #957639 #755d2e #554421 #44361c #332a16`; pedra
     `#7c7c7c #6b655f #5a5a5a #4b4b4b #2c2c2c`; or `#ffee88 #f3d23c #dcb733 #c17f2c`.

Les peces rodones (bótes, gerros, sacs, copes) es fan amb `lathe()`: gira un perfil, el projecta
amb la perspectiva del full i tria el to **només per l'orientació** (amunt / de cara / avall /
dins), que és com ho fa l'autor.

Genera `assets/decor-packs/oryx-style/<id>.png` i `pieces.json` (la llista, en ordre). Després cal
executar `scripts/decor-packs.py`, que les posa al full `decor_packs.png` i a la paleta.

⚠️ Afegir peces sempre AL FINAL de `build()` i no canviar-ne la mida (vegeu `decor-packs.py`).

    python3 scripts/oryx-style-props.py && python3 scripts/decor-packs.py
"""
import json
import math
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'decor-packs', 'oryx-style')

TILT = 0.55                                       # aixafament de les el·lipses (la tapa de la bóta de l'autor)
VIEW = (0.0, TILT, math.sqrt(1 - TILT * TILT))    # cap a la càmera (x, amunt, davant)

# Rampes de 9 tons, de clar (0) a fosc (8). Els tons 1–7 de la fusta i 2–7 de la pedra són els de l'autor.
WOOD = ['#d6b866', '#bf9f4b', '#aa8942', '#957639', '#755d2e', '#554421', '#44361c', '#332a16', '#231c0f']
DARK_WOOD = ['#a8793c', '#8f6430', '#7a5328', '#684520', '#523619', '#3f2912', '#33200e', '#26170a', '#190f06']
STONE = ['#afafaf', '#8f8f8f', '#7c7c7c', '#6b655f', '#5a5a5a', '#4b4b4b', '#3a3a3a', '#2c2c2c', '#1c1c1c']
IRON = ['#fbfbfb', '#d6d6d6', '#bababa', '#9a9a9a', '#7c7c7c', '#5f5f5f', '#4b4b4b', '#2d2d2d', '#1f1f1f']
GOLD = ['#fbfbfb', '#ffee88', '#f3d23c', '#dcb733', '#c17f2c', '#9a6420', '#6e4517', '#4a2e0f', '#2e1c09']
SILVER = ['#ffffff', '#ececec', '#d0d0d0', '#b0b0b0', '#8e8e8e', '#727272', '#565656', '#3c3c3c', '#262626']
COPPER = ['#ffe6cc', '#f0b890', '#dc9460', '#c67c48', '#a05c30', '#804624', '#603218', '#42210f', '#281308']
CLAY = ['#f6e6b4', '#e9c98c', '#dc964a', '#c8813f', '#b27138', '#96592c', '#815128', '#5a3618', '#3a210d']
BURLAP = ['#f0e4bc', '#e2d09c', '#cdb67c', '#b89e64', '#9c824c', '#84693c', '#6a5430', '#4e3d22', '#342816']
PAPER = ['#ffffff', '#f4f1e0', '#e0deb5', '#d0cd90', '#b0ad82', '#8e8c70', '#6c6b5c', '#4c4c46', '#303030']
RED = ['#ffb0a0', '#f06a5a', '#dd1717', '#bf0000', '#ab1010', '#8a0c0c', '#680909', '#480606', '#2c0404']
BLUE = ['#b8e4ff', '#5cb8f0', '#0b91d2', '#0b78b8', '#0863a3', '#064c80', '#04385e', '#032640', '#021826']
GREEN = ['#c0f0b0', '#6cd070', '#2fa84f', '#208a3c', '#187030', '#125824', '#0c4019', '#082c11', '#051c0b']
PURPLE = ['#e4c0ff', '#b880e8', '#9050c8', '#7a3cb0', '#642e94', '#4e2276', '#3a1858', '#28103c', '#180a24']
WHITEC = ['#ffffff', '#f4f4f4', '#e4e4e4', '#cfcfcf', '#b6b6b6', '#8e8e8e', '#6c6c6c', '#4a4a4a', '#2c2c2c']
TEAL = ['#c8f4ff', '#6cdcf8', '#0fc4f1', '#0b91d2', '#0863a3', '#064c80', '#04385e', '#032640', '#021826']
DARK = ['#3a3a3a', '#2d2d2d', '#262626', '#1f1f1f', '#1a1a1a', '#161616', '#121212', '#0e0e0e', '#0a0a0a']

MATS = {
    'wood': WOOD, 'stone': STONE, 'iron': IRON, 'gold': GOLD, 'trim': GOLD, 'coin': GOLD, 'cloth': RED, 'cer': CLAY,
    'band': PAPER, 'sack': BURLAP, 'paper': PAPER, 'water': TEAL, 'leaf': GREEN, 'red': RED, 'blue': BLUE,
    'green': GREEN, 'purple': PURPLE, 'clay': CLAY, 'silver': SILVER, 'white': WHITEC, 'dark': DARK, 'hinge': GOLD,
}
SHADOW = {1: (1, 1, 1, 64), 2: (0, 0, 0, 38), 3: (0, 0, 0, 13)}


def rgba(v):
    return (int(v[1:3], 16), int(v[3:5], 16), int(v[5:7], 16), 255)


def hsh(x, y, seed=0):
    n = (x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)
    n = (n ^ (n >> 13)) * 1274126177
    return (n ^ (n >> 16)) & 0xffff


class Cv:
    """Llenç a 48 px natius. Cada píxel és `(material, to 0–8)` o `('sh', franja)`."""

    def __init__(self, w=48, h=48):
        self.w, self.h = w, h
        self.g = {}

    def p(self, x, y, mat, i=None):
        if 0 <= x < self.w and 0 <= y < self.h:
            if mat is None:
                self.g.pop((x, y), None)
            else:
                self.g[(x, y)] = (mat, max(0, min(8, i))) if mat != 'sh' else (mat, i)

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

    def frame(self, x0, y0, x1, y1, mat, i):
        self.hl(x0, x1, y0, mat, i); self.hl(x0, x1, y1, mat, i); self.vl(x0, y0, y1, mat, i); self.vl(x1, y0, y1, mat, i)

    def line(self, x0, y0, x1, y1, mat, i):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for k in range(n + 1):
            self.p(round(x0 + (x1 - x0) * k / n), round(y0 + (y1 - y0) * k / n), mat, i)

    def ell(self, cx, cy, rx, ry, mat, i, cond=None):
        for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0 and (cond is None or cond(x, y)):
                    self.p(x, y, mat, i)

    def tone(self, x, y, d):
        t = self.g.get((x, y))
        if t and t[0] != 'sh':
            self.p(x, y, t[0], t[1] + d)

    def art(self, x, y, rows, mat='wood', key=None):
        """Píxels a mà: un dígit = to de `mat`; una lletra de `key` = (material, to); '.' = res."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch == '.':
                    continue
                if ch.isdigit():
                    self.p(x + i, y + j, mat, int(ch))
                else:
                    self.p(x + i, y + j, *key[ch])

    def blit(self, other, dx=0, dy=0):
        for (x, y), t in other.g.items():
            if t[0] != 'sh':
                self.p(x + dx, y + dy, *t)

    def shade_under(self, x0, x1, y0, y1):
        """Ombra sota un moble amb potes (la taula de l'autor): 64 entre les potes, 38 als peus, 13 a sota."""
        for y in range(y0, y1 + 4):
            band = 1 if y <= y1 - 3 else 2 if y <= y1 else 3
            for x in range(x0, x1 + 1):
                if (x, y) not in self.g:
                    self.p(x, y, 'sh', band)

    def drop(self, n=3, bands=(1, 2, 3)):
        """Ombra de l'autor: sota l'últim píxel opac de cada columna, franges de `n` px (64 / 38 / 13)."""
        for x in range(self.w):
            ys = [y for y in range(self.h) if self.solid(x, y)]
            if not ys:
                continue
            for k in range(n * len(bands)):
                if (x, ys[-1] + 1 + k) not in self.g:
                    self.p(x, ys[-1] + 1 + k, 'sh', bands[k // n])

    def strip(self, x0, x1, y):
        """Ombra del botí de l'autor: una ratlla de 64 sota, més ampla al mig."""
        self.hl(x0 + 3, x1 - 3, y, 'sh', 1); self.hl(x0, x1, y + 1, 'sh', 1); self.hl(x0 + 3, x1 - 3, y + 2, 'sh', 1)

    def image(self, over=None):
        mats = {**MATS, **(over or {})}
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        for (x, y), (m, i) in self.g.items():
            im.putpixel((x, y), SHADOW[i] if m == 'sh' else rgba(mats[m][i]))
        return im


# ───────────────────────── Peces rodones ─────────────────────────

def lathe(cv, cx, prof, mat='cer', base=3, mat_at=None, mod=None, cap=None, cut=None, dy=0.0, hollow=True,
          gloss=None, shade=True):
    """
    Sòlid de revolució d'eix vertical vist amb la perspectiva del full. `prof` = [(alçada L, radi)]
    de dalt a baix, en píxels (L creix cap avall). El to surt de l'orientació, com a l'Oryx: `base`
    de cara, un de més clar el que mira amunt, un de més fosc el que mira avall i la vora, i la paret
    de dins (per la boca) dos de més foscos. `mat_at(L, θ)` → material (sanefes, cèrcols);
    `mod(L, θ)` → tons de més (juntes); `cut(θ)` → L per sobre de la qual no hi ha paret (trencat);
    `cap` = (L, radi, fn(dx, dz) → (material, to)) = tapa plana; `gloss` = (L0, L1): reflex clar.
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
        m = (radius(min(bot, L + 0.3)) - radius(max(top, L - 0.3))) / 0.6       # dr/dL: >0 = mira amunt
        c = 1 / math.sqrt(1 + m * m)
        up = m * c
        steps = max(32, int(r * 12))
        for s in range(steps):
            th = -math.pi + 2 * math.pi * s / steps
            if cut and L < cut(th):
                continue
            sx, cz = math.sin(th), math.cos(th)
            inside = up * VIEW[1] + cz * c * VIEW[2] < 0
            if inside:
                if not hollow:
                    continue
                i = base + 2
            else:
                i = base
                if shade:
                    if up > 0.5:
                        i -= 1
                    elif up < -0.45:
                        i += 1
                    if abs(sx) > 0.93:
                        i += 1
                    if gloss and gloss[0] <= L <= gloss[1] and -0.62 <= sx <= -0.42:
                        i -= 2
                if mod:
                    i += mod(L, th)
            mm = (mat_at(L, th) if mat_at else None) or mat
            plot(cx + r * sx, L + TILT * r * cz, VIEW[2] * r * cz - VIEW[1] * L, (mm, int(round(i))))
        L += 0.12
    if cap:
        cl, cr, fn = cap
        n = int(cr * 4) + 2
        for iz in range(-n, n + 1):
            for ix in range(-n, n + 1):
                dx, dz = ix / 4, iz / 4
                if dx * dx + dz * dz <= cr * cr:
                    plot(cx + dx, cl + TILT * dz, VIEW[2] * dz - VIEW[1] * cl + 0.01, fn(dx, dz))
    for (x, y), (_, (m, i)) in zb.items():
        cv.p(x, y, m, i)


def disc(mat, base, r, rings=(), lip=None):
    """Tapa plana: to `base`; `rings` = [(amplada, to)] de fora cap a dins; `lip` = to del cantell del davant."""
    def fn(dx, dz):
        d = r - math.hypot(dx, dz)
        acc = 0.0
        for w, t in rings:
            acc += w
            if d < acc:
                return mat, t
        if lip is not None and d < acc + 1.0 and dz > r * 0.25:
            return mat, lip
        return mat, base
    return fn


# ───────────────────────── Cares planes, a la manera de l'autor ─────────────────────────

def top_face(cv, x0, y0, x1, y1, mat='wood', base=3, seed=1, nails=True, cracks=()):
    """Cara de dalt: un sol to, píxels clars solts a les vores (desgast), claus i alguna esquerda."""
    cv.r(x0, y0, x1, y1, mat, base)
    for x in range(x0, x1 + 1):
        if hsh(x // 3, 0, seed) % 3 == 0:
            cv.p(x, y0, mat, base - 1)
        if hsh(x, 5, seed) % 13 == 0:
            cv.p(x, y0 + 1, mat, base - 1)
        if hsh(x // 2, 9, seed) % 9 == 0:
            cv.p(x, y1, mat, base - 1)
    for y in range(y0, y1 + 1):
        if hsh(y // 3, 1, seed) % 3 == 0:
            cv.p(x0, y, mat, base - 1)
        if hsh(y // 3, 2, seed) % 3 == 0:
            cv.p(x1, y, mat, base - 1)
        if hsh(y, 6, seed) % 11 == 0:
            cv.p(x0 + 1, y, mat, base - 1)
        if hsh(y, 7, seed) % 11 == 0:
            cv.p(x1 - 1, y, mat, base - 1)
    if nails and x1 - x0 > 12 and y1 - y0 > 8:
        for nx, ny in ((x0 + 2, y0 + 2), (x1 - 2, y0 + 2), (x0 + 2, y1 - 2), (x1 - 2, y1 - 2)):
            cv.p(nx, ny, mat, base + 1)
    for x, y, flip in cracks:
        crack(cv, x, y, flip, mat, base)


def crack(cv, x, y, flip=False, mat='wood', base=3):
    """L'esquerda de la taula de l'autor: el nus fosc i una ratlla en diagonal."""
    s = -1 if flip else 1
    cv.p(x, y, mat, 7)
    for dx, dy_ in ((-1, 0), (1, 0), (0, 1), (s, -1), (s, -2), (2 * s, -3), (2 * s, -4), (-s, 3)):
        cv.p(x + dx, y + dy_, mat, base + 1)


def lip(cv, x0, x1, y, mat='wood', tone=2):
    cv.hl(x0, x1, y, mat, tone)


def front_face(cv, x0, y0, x1, y1, mat='wood', base=6, lines=(), dark_top=0):
    cv.r(x0, y0, x1, y1, mat, base)
    for k in range(dark_top):
        cv.hl(x0, x1, y0 + k, mat, base + 1)
    for x in lines:
        cv.vl(x, y0 + dark_top, y1, mat, base + 1)


def legs(cv, xs, y0, y1, w=4, mat='wood'):
    for lx in xs:
        cv.r(lx, y0, lx + w - 1, y1, mat, 6)
        cv.r(lx, y0, lx + w - 1, min(y0 + 1, y1), mat, 7)          # l'ombra del tauler a dalt de la pota


PIECES = []  # (id, etiqueta, grup, imatge)


def add(pid, label, group, cv, over=None):
    PIECES.append((pid, label, group, cv.image(over)))


def variants(pid, label, group, cv, vs):
    for vid, vlabel, over in vs:
        add(f'{pid}_{vid}' if vid else pid, f'{label} {vlabel}'.strip(), group, cv, over)


DARKW = {'wood': DARK_WOOD}
WOODS = [('', '', {}), ('dark', 'fosca', DARKW)]
WOODS_M = [('', '', {}), ('dark', 'fosc', DARKW)]


# ───────────────────────── Mobles ─────────────────────────

def table(cv, x0, x1, y0, y1, leg_xs, seed=1, cracks=(), front=3, leg_h=10):
    """La taula de l'autor: tauler `y0..y1-1`, cantell clar `y1`, cantell fosc, potes i ombra."""
    top_face(cv, x0, y0, x1, y1 - 1, seed=seed, cracks=cracks)
    lip(cv, x0, x1, y1)
    front_face(cv, x0, y1 + 1, x1, y1 + front)
    ly0, ly1 = y1 + front + 1, y1 + front + leg_h
    legs(cv, leg_xs, ly0, ly1)
    cv.shade_under(x0, x1, ly0, ly1)


def chair(cushion=False):
    cv = Cv()
    x0, x1 = 13, 34
    # respatller: dos muntants i dues barres; entremig es veu el terra
    for px in (x0, x1 - 2):
        cv.r(px, 4, px + 2, 19, 'wood', 5); cv.vl(px, 4, 19, 'wood', 4)
        cv.r(px, 3, px + 2, 4, 'wood', 2)
    cv.r(x0, 5, x1, 6, 'wood', 2); cv.hl(x0, x1, 5, 'wood', 1)      # la barra de dalt, vista de dalt
    cv.r(x0, 7, x1, 10, 'wood', 5); cv.hl(x0, x1, 10, 'wood', 6)
    if cushion:
        cv.r(x0 + 3, 11, x1 - 3, 18, 'cloth', 4); cv.frame(x0 + 3, 11, x1 - 3, 18, 'cloth', 5)
        cv.hl(x0 + 4, x1 - 4, 12, 'cloth', 3)
        for bx, by in ((19, 14), (24, 14), (28, 14), (21, 16), (26, 16)):
            cv.p(bx, by, 'cloth', 6)
    else:
        cv.r(x0 + 3, 14, x1 - 3, 15, 'wood', 5); cv.hl(x0 + 3, x1 - 3, 13, 'wood', 3)
    # seient
    top_face(cv, x0 - 1, 20, x1 + 1, 32, seed=4, nails=False)
    cv.hl(x0 - 1, x1 + 1, 20, 'wood', 4)
    for px in (x0, x0 + 1, x0 + 2, x1 - 2, x1 - 1, x1):
        cv.p(px, 20, 'wood', 5)
    if cushion:
        cv.r(x0 + 1, 22, x1 - 1, 30, 'cloth', 3); cv.frame(x0 + 1, 22, x1 - 1, 30, 'cloth', 4)
        cv.hl(x0 + 2, x1 - 2, 22, 'cloth', 2); cv.hl(x0 + 1, x1 - 1, 31, 'cloth', 5)
        for px, py in ((x0 + 1, 22), (x1 - 1, 22)):
            cv.p(px, py, 'wood', 3)
    lip(cv, x0 - 1, x1 + 1, 33)
    front_face(cv, x0 - 1, 34, x1 + 1, 35)
    legs(cv, (x0 - 1, x1 - 1), 36, 43, w=3)
    cv.shade_under(x0 - 1, x1 + 1, 36, 43)
    return cv


def stool():
    cv = Cv()
    for x, y1 in ((16, 40), (29, 40), (22, 36)):
        cv.r(x, 26, x + 2, y1, 'wood', 6 if y1 == 40 else 7)
    cv.hl(18, 29, 35, 'wood', 7)
    lathe(cv, 23.5, [(21, 12), (24.5, 12)], 'wood', base=6, hollow=False, shade=False,
          cap=(21, 12, disc('wood', 3, 12, lip=2)))
    cv.p(19, 20, 'wood', 4); cv.p(28, 17, 'wood', 4); cv.p(25, 22, 'wood', 4)
    cv.shade_under(14, 33, 34, 40)
    return cv


def bench():
    cv = Cv()
    top_face(cv, 3, 17, 44, 27, seed=7, cracks=((30, 23, False),))
    lip(cv, 3, 44, 28)
    front_face(cv, 3, 29, 44, 30)
    legs(cv, (6, 38), 31, 39)
    cv.hl(10, 37, 34, 'wood', 7); cv.hl(10, 37, 35, 'wood', 6)        # travesser
    cv.shade_under(3, 44, 31, 39)
    return cv


def table_small():
    cv = Cv()
    table(cv, 9, 38, 10, 28, (12, 32), seed=3, cracks=((27, 17, False),), leg_h=9)
    return cv


def table_round():
    cv = Cv()
    cv.ell(23.5, 38.5, 15, 6.5, 'sh', 2); cv.ell(23.5, 38, 12, 5, 'sh', 1)
    cv.r(21, 22, 26, 36, 'wood', 6); cv.r(21, 22, 26, 25, 'wood', 7)   # peu
    cv.art(15, 36, ['...6666666666666...', '.66666666666666666.', '6666666666666666666', '.77777777777777777.'], 'wood')
    lathe(cv, 23.5, [(13, 20), (16.5, 20)], 'wood', base=6, hollow=False, shade=False,
          cap=(13, 20, disc('wood', 3, 20, lip=2)))
    for x in range(8, 40):                                         # desgast a la vora del fons
        if hsh(x // 3, 3, 8) % 3 == 0:
            ys = [y for y in range(48) if cv.solid(x, y)]
            cv.p(x, ys[0], 'wood', 2)
    crack(cv, 17, 11); crack(cv, 31, 16, True)
    return cv


def table_long(dress=None):
    cv = Cv(144, 48)
    table(cv, 3, 140, 3, 30, (7, 70, 133), seed=11,
          cracks=((28, 12, False), (58, 24, True), (96, 9, False), (121, 21, True)))
    if dress == 'cloth':
        x0, x1 = 20, 123
        cv.r(x0, 3, x1, 30, 'cloth', 3)                            # la tela sobre el tauler: un sol to
        cv.vl(x0, 3, 30, 'cloth', 2); cv.vl(x1, 3, 30, 'cloth', 4); cv.hl(x0, x1, 3, 'cloth', 4)
        cv.r(x0 + 3, 6, x1 - 3, 6, 'trim', 3); cv.r(x0 + 3, 27, x1 - 3, 27, 'trim', 3)
        cv.vl(x0 + 3, 6, 27, 'trim', 3); cv.vl(x1 - 3, 6, 27, 'trim', 3)
        for x in range(x0 + 12, x1 - 8, 12):                       # brodat
            cv.art(x - 2, 14, ['..3..', '.323.', '32123', '.323.', '..3..'], 'trim')
        cv.hl(x0, x1, 31, 'cloth', 2)                              # el doblec al cantell
        for x in range(x0, x1 + 1):                                # el que penja: plecs d'1 px
            f = (x - x0) % 8
            for y in range(32, 41):
                if y == 40 and f in (0, 1, 7):
                    continue
                cv.p(x, y, 'cloth', 6 if f == 0 else 4 if f == 4 else 5)
            if f not in (0, 1, 7):
                cv.p(x, 39, 'trim', 3)
    if dress == 'feast':
        K = {'p': ('white', 1), 'P': ('white', 0), 'q': ('white', 3), 'Q': ('white', 5), 'm': ('clay', 3), 'M': ('clay', 5),
             'n': ('clay', 1), 'i': ('iron', 2), 'I': ('iron', 1), 'j': ('iron', 4), 'J': ('iron', 5), 'k': ('iron', 7),
             'r': ('red', 2), 'R': ('red', 4), 'h': ('red', 0), 'g': ('leaf', 3), 'G': ('leaf', 5), 'y': ('gold', 1),
             'Y': ('gold', 0), 'o': ('gold', 3), 'w': ('purple', 6), 's': ('wood', 4), 'b': ('wood', 6)}
        plate = ['....pppppppp....', '..ppPPPPPPPPpp..', '.pPPqqqqqqqqPPp.', 'pPPqPPPPPPPPqPPp', 'pPqPPPPPPPPPPqPp',
                 'pPqPPPPPPPPPPqPp', 'pPPqPPPPPPPPqPPp', '.pPPqqqqqqqqPPp.', '..qpPPPPPPPPpq..', '....qqqqqqqq....']
        roast = ['..nnnn..', '.nmmmmn.', 'nmmnmmmM', 'mmmmmmMM', '.mMMMMM.', '..MMMM..']
        for x in (16, 62, 108):
            cv.art(x, 9, plate, key=K)
            cv.art(x + 4, 11, roast, key=K)
        mug = ['.IIIIII..', 'IwwwwwwI.', 'IiiiiijIj', 'IiiiiijjJ', 'IiiiiijjJ', 'IiiiiijIj', 'IiiiiijJ.', '.jjjjjJ..']
        for x in (40, 88):
            cv.art(x, 7, mug, key=K)
        cv.art(127, 4, ['.Y.', 'YyY', '.o.', '.p.', '.p.', '.p.', '.p.', '.q.', 'IijJ', 'jjJJ'], key=K)       # espelma
        cv.art(7, 18, ['..g..', '.rrG.', 'hrrrR', 'rrrrR', 'rrrRR', '.RRR.'], key=K)                         # poma
        for x in (46, 93):
            cv.art(x, 19, ['..nnnnnn..', '.nmnmnmnm.', 'nmmmmmmmmM', 'mmmmmmmmMM', '.MMMMMMMM.'], key=K)       # pa
        cv.art(76, 17, ['IIIIII', 'IwwwwI', '.iijj.', '..ij..', '..ij..', '.iijj.', 'iiijjJ'], key=K)          # copa
    return cv


def bed():
    cv = Cv(48, 96)
    x0, x1 = 5, 42
    # capçal: el cantell de dalt i la cara del davant amb un plafó
    cv.r(x0, 4, x1, 6, 'wood', 3); lip(cv, x0, x1, 4); cv.hl(x0, x1, 6, 'wood', 2)
    front_face(cv, x0, 7, x1, 19, base=5)
    cv.r(x0 + 4, 9, x1 - 4, 17, 'wood', 6); cv.frame(x0 + 4, 9, x1 - 4, 17, 'wood', 7)
    cv.hl(x0 + 5, x1 - 5, 17, 'wood', 4)
    for px in (x0, x1 - 3):
        cv.r(px, 2, px + 3, 19, 'wood', 4); cv.r(px, 1, px + 3, 3, 'wood', 2); cv.hl(px, px + 3, 1, 'wood', 1)
    # travessers, llençol i coixí
    cv.r(x0, 20, x1, 84, 'wood', 3)
    cv.r(x0 + 2, 20, x1 - 2, 40, 'paper', 1)
    cv.hl(x0 + 2, x1 - 2, 20, 'paper', 4); cv.hl(x0 + 2, x1 - 2, 21, 'paper', 3)
    cv.r(x0 + 6, 23, x1 - 6, 33, 'white', 0)
    cv.frame(x0 + 6, 23, x1 - 6, 33, 'white', 2)
    for px, py in ((x0 + 6, 23), (x1 - 6, 23), (x0 + 6, 33), (x1 - 6, 33)):
        cv.p(px, py, 'paper', 1)
    cv.hl(x0 + 7, x1 - 7, 34, 'paper', 3); cv.hl(x0 + 8, x1 - 6, 35, 'paper', 2)
    cv.hl(18, 29, 28, 'white', 2); cv.hl(20, 27, 29, 'white', 2)
    # flassada: un sol to, el doblec i quatre plecs d'1 px
    cv.r(x0 + 2, 39, x1 - 2, 83, 'cloth', 3)
    cv.r(x0 + 2, 39, x1 - 2, 42, 'cloth', 2); cv.hl(x0 + 2, x1 - 2, 43, 'cloth', 5)
    cv.hl(x0 + 2, x1 - 2, 39, 'cloth', 1)
    cv.vl(x1 - 2, 44, 83, 'cloth', 4); cv.hl(x0 + 2, x1 - 2, 83, 'cloth', 4); cv.vl(x0 + 2, 44, 82, 'cloth', 2)
    for xa, ya, xb, yb in ((12, 50, 18, 58), (30, 47, 35, 56), (16, 66, 24, 74), (31, 68, 36, 78), (10, 76, 13, 80)):
        cv.line(xa, ya, xb, yb, 'cloth', 4)
    cv.r(x0 + 2, 41, x1 - 2, 41, 'trim', 3)
    # peu del llit
    cv.r(x0, 84, x1, 85, 'wood', 3); lip(cv, x0, x1, 86)
    front_face(cv, x0, 87, x1, 89)
    for px in (x0, x1 - 3):
        cv.r(px, 82, px + 3, 84, 'wood', 2); cv.hl(px, px + 3, 82, 'wood', 1)
    legs(cv, (x0, x1 - 3), 90, 92)
    for y, b in ((90, 1), (91, 1), (92, 2), (93, 2), (94, 3), (95, 3)):
        for x in range(x0, x1 + 1):
            if (x, y) not in cv.g:
                cv.p(x, y, 'sh', b)
    return cv


SPINES = [('red', 4), ('blue', 4), ('green', 4), ('purple', 4), ('clay', 4), ('red', 5), ('blue', 5), ('wood', 4),
          ('green', 5), ('purple', 5), ('gold', 4), ('clay', 5), ('stone', 4)]


def bookshelf(kind='full'):
    cv = Cv()
    x0, x1 = 6, 41
    top_face(cv, x0, 3, x1, 10, seed=2)                            # el sostre del moble
    lip(cv, x0, x1, 11)
    front_face(cv, x0, 12, x1, 42, base=6)
    cv.r(x0 + 2, 13, x1 - 2, 40, 'wood', 8)                        # el fons, a les fosques
    cv.vl(x0, 12, 42, 'wood', 5); cv.vl(x0 + 1, 12, 42, 'wood', 6); cv.vl(x1, 12, 42, 'wood', 7)
    shelves = (21, 30, 39)
    for sy in shelves:                                             # lleixes: el tauler vist de dalt i el cantell
        cv.hl(x0 + 2, x1 - 2, sy, 'wood', 4); cv.hl(x0 + 2, x1 - 2, sy + 1, 'wood', 6)
    n = 0
    for si, sy in enumerate(shelves):
        x = x0 + 2
        while x <= x1 - 2:
            n += 1
            h = hsh(n, si, 21)
            wide = 2 + h % 2
            if x + wide - 1 > x1 - 2:
                break
            if kind == 'potions' and si == 1:
                break
            if kind == 'half' and (h % 7 < 3 or (si == 1 and x > 20)):
                x += 1 + h % 3
                continue
            tall = 6 - (h >> 3) % 3
            mat, tone = SPINES[(h >> 5) % len(SPINES)]
            cv.r(x, sy - tall, x + wide - 1, sy - 1, mat, tone)
            cv.vl(x + wide - 1, sy - tall, sy - 1, mat, tone + 1)   # la junta amb el llibre del costat
            cv.hl(x, x + wide - 1, sy - tall - 1, 'paper', 2 if wide == 2 else 3)   # els fulls, vistos de dalt
            if wide == 3:
                cv.hl(x, x + 1, sy - tall + 1, 'gold', 3); cv.hl(x, x + 1, sy - 2, 'gold', 3)
            elif h % 5 == 0:
                cv.p(x, sy - 3, 'gold', 3)
            x += wide
    if kind == 'potions':
        for x, m in ((10, 'red'), (17, 'blue'), (24, 'green'), (31, 'purple')):
            cv.art(x, 23, ['..cc..', '..gg..', '..gg..', '.g22g.', 'g2123g', 'g2233g', '.g33g.'], m,
                   {'c': ('wood', 2), 'g': ('iron', 2)})
    if kind == 'half':
        cv.art(26, 23, ['.0000.', '000000', '070070', '000000', '.0770.', '.0.0..'], 'white')            # calavera
        cv.art(10, 35, ['2222222', '4444445', '4444445'], 'clay')                                            # llibre ajagut
    cv.hl(x0, x1, 42, 'wood', 7)
    cv.drop(2)
    return cv


def wardrobe():
    cv = Cv()
    x0, x1 = 7, 40
    top_face(cv, x0, 3, x1, 10, seed=6)
    lip(cv, x0 - 1, x1 + 1, 11)                                   # cornisa
    front_face(cv, x0, 12, x1, 42, base=6)
    cv.hl(x0, x1, 12, 'wood', 7)
    cv.vl(x0, 13, 42, 'wood', 5); cv.vl(x1, 13, 42, 'wood', 7)
    cv.vl(23, 14, 40, 'wood', 8); cv.vl(24, 14, 40, 'wood', 5)    # la junta de les dues portes
    for a, b in ((x0 + 3, 20), (27, x1 - 3)):
        for ya, yb in ((15, 26), (29, 39)):
            cv.r(a, ya, b, yb, 'wood', 5)
            cv.hl(a, b, ya, 'wood', 7); cv.vl(a, ya, yb, 'wood', 7)      # plafó enfonsat: ombra a dalt i a l'esquerra
            cv.hl(a + 1, b, yb, 'wood', 4); cv.vl(b, ya + 1, yb, 'wood', 4)
    for kx in (21, 26):                                            # poms
        cv.r(kx, 27, kx, 28, 'gold', 2); cv.p(kx, 29, 'gold', 4)
    cv.hl(x0, x1, 41, 'wood', 6); cv.hl(x0, x1, 42, 'wood', 7)
    cv.drop(2)
    return cv


def throne():
    cv = Cv()
    # respatller: el cantell de dalt i la cara amb el plafó entapissat
    cv.r(11, 2, 36, 4, 'stone', 3); cv.hl(11, 36, 2, 'stone', 2)
    front_face(cv, 11, 5, 36, 24, 'stone', base=5)
    cv.vl(11, 5, 24, 'stone', 4); cv.vl(36, 5, 24, 'stone', 6)
    cv.frame(14, 7, 33, 23, 'trim', 3); cv.hl(14, 33, 7, 'trim', 2)
    cv.r(15, 8, 32, 22, 'cloth', 4); cv.hl(15, 32, 8, 'cloth', 5)
    for bx, by in ((19, 11), (24, 11), (28, 11), (21, 15), (26, 15), (19, 19), (24, 19), (28, 19)):
        cv.p(bx, by, 'cloth', 6); cv.p(bx, by - 1, 'cloth', 3)
    for fx in (10, 35):                                            # poms daurats
        cv.r(fx, 0, fx + 2, 2, 'trim', 3); cv.hl(fx, fx + 2, 0, 'trim', 1)
    cv.art(20, 0, ['..2222..', '.233332.', '23333334'], 'trim')
    # braços
    for a in (7, 35):
        cv.r(a, 18, a + 5, 23, 'stone', 3); cv.hl(a, a + 5, 23, 'stone', 2)
        front_face(cv, a, 24, a + 5, 36, 'stone', base=6)
        cv.r(a + 1, 19, a + 4, 20, 'trim', 3); cv.hl(a + 1, a + 4, 19, 'trim', 1)
    # coixí del seient
    cv.r(13, 25, 34, 33, 'cloth', 3); cv.frame(13, 25, 34, 33, 'cloth', 4); cv.hl(14, 33, 26, 'cloth', 2)
    cv.hl(13, 34, 34, 'cloth', 5)
    # base
    cv.hl(7, 40, 35, 'stone', 2)
    front_face(cv, 7, 36, 40, 38, 'stone', base=7)
    cv.r(5, 39, 42, 40, 'stone', 4); cv.hl(5, 42, 41, 'stone', 2)
    cv.r(5, 42, 42, 43, 'stone', 7)
    cv.drop(1)
    return cv


# ───────────────────────── Caixes, bótes i sacs ─────────────────────────

def crate_box(cv, x0, x1, yt, yl, yb, kind='lid', seed=1):
    """La caixa de l'autor: tapa `yt..yl-1` (bastiment clar i plafó), cantell `yl`, cara del davant fins a `yb`."""
    top_face(cv, x0, yt, x1, yl - 1, base=2, seed=seed, nails=False)
    a, b, c, d = x0 + 4, yt + 3, x1 - 4, yl - 4
    if kind == 'open':
        cv.r(a - 1, b - 1, c + 1, d + 1, 'wood', 8)                # el fons
        cv.r(a - 1, b - 1, c + 1, b + 2, 'wood', 6); cv.hl(a - 1, c + 1, b - 1, 'wood', 5)   # paret de dins, il·luminada
        cv.vl(a - 1, b - 1, d + 1, 'wood', 7); cv.vl(c + 1, b - 1, d + 1, 'wood', 7)
        for x in range(a + 4, c, 6):
            cv.vl(x, b, b + 2, 'wood', 7)
    else:
        cv.frame(a - 1, b - 1, c + 1, d + 1, 'wood', 3)
        cv.r(a, b, c, d, 'wood', 4)                                # plafó enfonsat
        cv.hl(a, c, b, 'wood', 5); cv.vl(a, b, d, 'wood', 5); cv.vl(c, b, d, 'wood', 5)
        if kind == 'planks':
            for y in range(b + 3, d, 3):
                cv.hl(a + 1, c - 1, y, 'wood', 5)
        if kind == 'brace':
            cv.line(a + 1, b + 1, c - 1, d, 'wood', 3); cv.line(a + 1, d, c - 1, b + 1, 'wood', 3)
        for nx, ny in ((x0 + 2, yt + 2), (x1 - 2, yt + 2), (x0 + 2, yl - 3), (x1 - 2, yl - 3)):
            cv.p(nx, ny, 'wood', 4)
    lip(cv, x0, x1, yl, tone=1)
    front_face(cv, x0, yl + 1, x1, yb, base=6)
    big = yb - yl > 14
    cv.hl(x0, x1, yl + 4 if big else yl + 3, 'wood', 7)            # el travesser de dalt
    step = max(5, (x1 - x0) // 5)
    for x in range(x0 + step, x1 - 2, step + 1):
        cv.vl(x, (yl + 5 if big else yl + 4), yb, 'wood', 7)
    cv.vl(x0, yl + 1, yb, 'wood', 7); cv.vl(x1, yl + 1, yb, 'wood', 7)
    cv.hl(x0, x1, yb, 'wood', 7)
    if kind == 'brace':
        cv.line(x0 + 2, yb - 2, x1 - 2, yl + 6, 'wood', 5); cv.line(x0 + 2, yb - 1, x1 - 2, yl + 7, 'wood', 5)


def crate_small():
    cv = Cv()
    crate_box(cv, 13, 34, 16, 28, 40, kind='planks')
    cv.drop()
    return cv


def crate_braced():
    cv = Cv()
    crate_box(cv, 7, 40, 2, 22, 40, kind='brace', seed=3)
    cv.drop()
    return cv


def crate_open(fill=None):
    cv = Cv()
    crate_box(cv, 7, 40, 2, 22, 40, kind='open')
    if fill == 'apples':
        K = {'s': ('wood', 6), 'l': ('leaf', 2)}
        for j, y in enumerate((5, 10, 13)):
            for x in range(11 + (j % 2) * 3, 34, 6):
                m = 'green' if hsh(x, y, 4) % 4 == 0 else 'red'
                cv.art(x, y, ['..sl.', '.222.', '21222', '22223', '22233', '.333.'], m, K)
    if fill == 'bottles':
        K = {'c': ('clay', 1), 'C': ('clay', 4), 'w': ('white', 0)}
        bottle = ['..cc..', '..CC..', '..44..', '.3444.', '3w4445', '344455', '344455', '.4455.']   # coll, tap i espatlles
        for x in (11, 18, 25, 32):
            cv.art(x, 4, bottle, 'green', K)
        for x in (14, 21, 28):
            cv.art(x, 10, bottle, 'green', K)
    cv.drop()
    return cv


def crate_stack():
    cv = Cv()
    cb = Cv()
    crate_box(cb, 13, 34, 16, 28, 40, kind='planks')
    cv.blit(cb, -11, 1); cv.blit(cb, 11, 1)
    for x in range(13, 35):                                        # l'ombra de la de dalt
        for y in range(18, 22):
            cv.tone(x, y, 2)
    cv.blit(cb, 0, -13)
    cv.drop()
    return cv


BARREL = [(9, 12.5), (13, 14), (22, 15), (31, 14), (37.5, 11.5)]


def barrel_iron(water=False):
    cv = Cv()
    stave = lambda L, th: 1 if (th + 9.0) % 0.3927 < 0.085 else 0
    hoop = lambda L, th: 'iron' if (13.5 <= L <= 15.6 or 29.5 <= L <= 31.6) else None
    if water:
        lathe(cv, 23.5, BARREL, 'wood', base=6, mod=stave, mat_at=hoop, shade=False,
              cap=(11.5, 11.2, disc('water', 3, 11.2, rings=((1.5, 5),), lip=1)))
        cv.art(17, 9, ['.111', '1...'], 'water'); cv.art(27, 12, ['11'], 'water')
    else:                                                          # la tapa de l'autor: cèrcol clar, solc fosc, tapa
        lathe(cv, 23.5, BARREL, 'wood', base=6, mod=stave, mat_at=hoop, hollow=False, shade=False,
              cap=(9, 12.5, disc('wood', 3, 12.5, rings=((1.2, 2), (1.6, 6)), lip=1)))
        cv.art(28, 7, ['.5.', '575', '.5.'], 'wood')               # el tap
        cv.hl(17, 22, 5, 'wood', 2)
    for (x, y), t in list(cv.g.items()):                           # els cèrcols: ferro fosc amb una mica de llum
        if t[0] == 'iron':
            cv.p(x, y, 'iron', 5 if x < 20 else 6)
    cv.drop()
    return cv


def barrel_side():
    cv = Cv()
    for x in range(5, 43):
        bulge = 0 if 13 <= x <= 34 else 1 if 9 <= x <= 38 else 2 if 6 <= x <= 41 else 4
        y0, y1 = 13 + bulge, 37 - bulge
        for y in range(y0, y1 + 1):
            t = (y - y0) / (y1 - y0)
            i = 3 if t < 0.34 else 5 if t < 0.62 else 6            # el llom mira amunt (clar); la panxa, endavant
            if (y - 13) % 4 == 3:
                i += 1                                             # juntes de les dogues
            cv.p(x, y, 'wood', i)
        if x in (10, 11, 36, 37):
            for y in range(y0, y1 + 1):
                cv.p(x, y, 'iron', 4 if (y - y0) / (y1 - y0) < 0.34 else 6)
    cv.vl(5, 17, 33, 'wood', 7); cv.vl(42, 17, 33, 'wood', 7)
    cv.art(22, 11, ['.44.', '4554', '5665'], 'wood')               # el tap de dalt
    cv.art(9, 36, ['..55..', '.5666.', '566667', '666677'], 'wood'); cv.art(33, 36, ['..55..', '.6665.', '766665', '776666'], 'wood')
    cv.drop()
    return cv


def keg():
    cv = Cv()
    cx, cy, r = 23.5, 24.0, 12.5
    for k in range(9, 0, -1):                                      # el cos, que se'n va cap al fons
        cv.ell(cx, cy - k, r, r, 'iron' if k in (2, 3, 7, 8) else 'wood', 5 if k in (2, 3, 7, 8) else 3)
    cv.ell(cx, cy, r, r, 'wood', 5)                                # el cap, de cara: cèrcol, solc i taulons
    cv.ell(cx, cy, r - 1.5, r - 1.5, 'wood', 7)
    cv.ell(cx, cy, r - 2.5, r - 2.5, 'wood', 6)
    for x in (18, 23, 29):
        for y in range(48):
            if cv.g.get((x, y)) == ('wood', 6):
                cv.p(x, y, 'wood', 7)
    cv.art(22, 29, ['2222', '3443', '.44.', '.46.', '.66.'], 'iron'); cv.art(26, 31, ['44', '.4'], 'iron')   # aixeta
    cv.art(8, 35, ['5555...', '.6666..', '.66666.', '.666666'], 'wood'); cv.art(33, 35, ['...5555', '..6666.', '.66666.', '666666.'], 'wood')
    cv.hl(11, 36, 39, 'wood', 7)
    cv.drop(2)
    return cv


SACK_PROF = [(15.5, 3.6), (17, 2.6), (19, 2.3), (21, 5), (25, 10), (30, 12.5), (35, 12), (38, 9.5), (39.2, 7)]


def draw_sack(cv, cx, dy=0.0, grain=False, mat='sack'):
    wr = lambda L, th: 1 if (abs(((th * 2.2 + L * 0.16) % 1.0) - 0.5) < 0.035 and 22 < L < 34) else 0
    if grain:
        prof = [(20, 9), (22, 10), (26, 12), (33, 12.5), (37.5, 10), (39.2, 7)]
        fill = lambda dx, dz: ('gold', 3 if hsh(int(dx + 40), int(dz * 2 + 40), 3) % 4 else 2 if hsh(int(dx), int(dz), 1) % 2 else 4)
        lathe(cv, cx, prof, mat, base=3, mod=wr, cap=(21.5, 8.2, fill), dy=dy)
    else:
        rope = lambda L, th: 'wood' if 18.3 <= L <= 19.8 else None
        lathe(cv, cx, SACK_PROF, mat, base=3, mod=wr, mat_at=rope, hollow=False, dy=dy,
              cap=(15.5, 3.6, lambda dx, dz: (mat, 5 if dx * dx + dz * dz < 4 else 3)))


def sack(grain=False):
    cv = Cv()
    draw_sack(cv, 23.5, grain=grain)
    cv.drop(2)
    return cv


def sack_pile():
    cv = Cv()
    draw_sack(cv, 13.5, dy=3); draw_sack(cv, 33.5, dy=3)
    draw_sack(cv, 23.5, dy=-7)
    cv.drop(2)
    return cv


# ───────────────────────── Gerros ─────────────────────────

VASE_TALL = [(7.5, 6.6), (9.5, 5.2), (12.5, 4.6), (16, 5.8), (20, 9.8), (25, 11.8), (29, 11), (34, 7.4), (37, 5.2), (38.4, 5.8)]
AMPHORA = [(6.5, 5.2), (8.5, 3.8), (13, 3.5), (17, 7), (21, 9.4), (25, 8.8), (31, 5.6), (36.5, 2.8), (38.6, 4.6)]
POT_ROUND = [(16.5, 9.2), (18.5, 8), (20.5, 9.6), (24.5, 13.6), (29.5, 14.6), (34, 12), (37.6, 7.4)]
URN = [(17.5, 6.4), (19.5, 5.6), (22, 9), (26, 10.8), (30, 9.2), (34.5, 6), (37.8, 4.6)]
BANDS = {'tall': (24.0, 26.2), 'amphora': (20.6, 22.4), 'round': (27.6, 29.8), 'urn': (25.2, 27.2)}
GLOSS = {'tall': (20, 30), 'amphora': (18, 26), 'round': (23, 31), 'urn': (22, 29)}


def vase(shape, top=None):
    cv = Cv()
    prof = {'tall': VASE_TALL, 'amphora': AMPHORA, 'round': POT_ROUND, 'urn': URN}[shape]
    band = BANDS[shape]
    ba = lambda L, th: 'band' if band[0] <= L <= band[1] else None
    if top == 'broken':
        jag = lambda th: 19.5 + 7.0 * abs(((th * 3 / math.pi + 0.4) % 2.0) - 1.0)
        lathe(cv, 23.5, prof, 'cer', base=3, mat_at=ba, cut=jag)
        K = {'a': ('cer', 2), 'b': ('cer', 3), 'c': ('cer', 5), 's': ('sh', 1)}
        cv.art(3, 34, ['.aab..', 'abbbc.', '.bccc.', '.ssss.'], key=K); cv.art(38, 30, ['..aab.', '.abbbc', 'bbccc.', '.ssss.'], key=K)
        cv.art(8, 27, ['ab', 'bc', 'ss'], key=K); cv.art(42, 39, ['ab.', 'bcc', 'sss'], key=K); cv.art(1, 41, ['ab', 'ss'], key=K)
    else:
        if shape == 'amphora':                                     # nanses, darrere el coll
            for sgn, tone in ((-1, 3), (1, 4)):
                pts = [(5, 10), (6, 9), (8, 9), (10, 10), (11, 12), (11, 15), (10, 17), (8, 18)]
                for (ax, ay), (bx, by) in zip(pts, pts[1:]):
                    cv.line(round(23.5 + sgn * ax), ay, round(23.5 + sgn * bx), by, 'cer', tone)
                    cv.line(round(23.5 + sgn * (ax + 1)), ay, round(23.5 + sgn * (bx + 1)), by, 'cer', tone + 1)
        # la boca: terra si hi ha una planta; si no, el forat fosc
        soil = (prof[0][0] + 1.2, prof[0][1] - 1.4, lambda dx, dz: ('wood', 7) if top in ('plant', 'flowers') else ('dark', 3))
        lathe(cv, 23.5, prof, 'cer', base=3, mat_at=ba, cap=soil, gloss=GLOSS[shape])
        if shape == 'urn':                                         # tapa i pom
            lathe(cv, 23.5, [(14.0, 1.2), (15.0, 5.4), (16.6, 7.4), (17.6, 7.4)], 'cer', base=3, hollow=False)
            lathe(cv, 23.5, [(10.6, 0.8), (11.6, 2.2), (13.0, 2.0), (14.0, 1.2)], 'trim', base=3, hollow=False)
    K = {'a': ('leaf', 1), 'b': ('leaf', 3), 'c': ('leaf', 5), 'r': ('red', 2), 'R': ('red', 4), 'y': ('gold', 1),
         'Y': ('gold', 3), 'w': ('white', 0), 'W': ('white', 3), 'p': ('purple', 2), 'P': ('purple', 4)}
    if top == 'plant':
        cv.art(9, 1, ['......b...........b...........', '.....bab..........bab.........', '.....bab....b.....bab....b....',
                      '..b..bbb...bab....bbb...bab...', '.bab..bbc..bab...cbb....bab...', '.bab..bbc..bbb...cbb...cbb....',
                      '.bbb...bbc.bbc..cbb....cbb....', '..bbc..bbc.bbc..cbb...cbb.....', '..bbc...bbcbbc.cbb...cbb......',
                      '...bbc..bbcbbc.cbb..cbb.......', '....bbc.bbcbbccbb..cbb........', '....bbcc.bcbbcbbc.cbb.........',
                      '.....bbccbcbbcbbccbb..........', '......bbcbcbbcbccbb...........', '.......bccccccccb.............',
                      '........cccccccc..............', '.........cccccc...............'], key=K)
    if top == 'flowers':
        cv.art(9, 0, ['......rr...........yy.........', '.....rrrr.........yyyy........', '....rrRRrr...ww..yyYYyy.......',
                      '....rrRRrr..wwww.yyYYyy.......', '.....rrrr..wwWWww.yyyy........', '..pp..rr...wwWWww..yy.........',
                      '.pppp..b....wwww...b..........', 'ppPPpp.b.....ww....b..........', 'ppPPpp.bb.....b...bb..........',
                      '.pppp...b.....b...b...........', '..pp....bb....b..bb...........', '...b.....b....b..b............',
                      '...bb....bb...b.bb............', '....bb....b...b.b.............', '.....bbc..bb..bbb.............',
                      '......bbccbbcbbbc.............', '.......cccccccccc.............', '........cccccccc..............'], key=K)
    cv.drop(2)
    return cv


# ───────────────────────── Cofres (el cofre de l'autor, a mida de moble) ─────────────────────────

def gold_mound(cv, cx, base, rx, ry, seed, mat='coin'):
    """El munt d'or del cofre de l'autor: una mitja el·lipse d'un sol to, la vora de dalt a dentetes,
    puntets foscos entre les monedes i espurnes blanques en creu."""
    for x in range(int(cx - rx), int(cx + rx) + 1):
        t = 1 - ((x - cx) / rx) ** 2
        if t <= 0:
            continue
        top = base - ry * math.sqrt(t)
        y0 = int(round(top)) - (1 if hsh(x, 0, seed) % 2 == 0 else 0)
        for y in range(y0, base + 1):
            i = 2
            if y == y0:
                i = 1
            elif hsh(x, y, seed) % 9 == 0:
                i = 4
            elif hsh(x, y, seed) % 7 == 0:
                i = 3
            elif hsh(x, y, seed) % 11 == 0:
                i = 1
            cv.p(x, y, mat, i)
    k = 0
    for n in range(40):
        h = hsh(n, 3, seed)
        x, y = int(cx - rx * 0.6 + h % int(rx * 1.2 + 1)), int(base - ry * 0.75 + (h >> 5) % max(1, int(ry * 0.6)))
        if all(cv.g.get((x + a, y + b), ('', 0))[0] == mat for a, b in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1))):
            for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                cv.p(x + a, y + b, mat, 1)
            cv.p(x, y, 'white', 0)
            k += 1
            if k >= max(1, int(rx / 6)):
                break


def chest(state='closed'):
    cv = Cv()
    x0, x1 = 7, 40
    if state == 'closed':
        # la tapa bombada, vista de dalt: tres franges de to, corretges i marc
        cv.r(x0, 11, x1, 26, 'wood', 3)
        cv.r(x0, 11, x1, 13, 'wood', 4); cv.r(x0, 23, x1, 26, 'wood', 4)
        cv.hl(x0 + 2, x1 - 2, 16, 'wood', 2); cv.hl(x0 + 2, x0 + 14, 15, 'wood', 2)
        for sx in (x0 + 6, x1 - 7):
            cv.r(sx, 11, sx + 1, 26, 'wood', 6)
        cv.frame(x0, 11, x1, 26, 'trim', 3); cv.hl(x0, x1, 11, 'trim', 2)
        for gx in (x0, x1):
            cv.vl(gx, 12, 15, 'trim', 1); cv.vl(gx, 13, 14, 'trim', 0)      # el reflex a les cantonades
        cv.r(22, 25, 25, 26, 'trim', 2)                              # la tanca
        cv.hl(x0, x1, 27, 'dark', 3)
    else:
        # tapa oberta, dreta al fons: marc, interior negre i la frontissa
        cv.r(x0, 3, x1, 17, 'dark', 3)
        cv.frame(x0, 3, x1, 17, 'hinge', 5); cv.hl(x0, x1, 3, 'trim', 2)
        cv.r(21, 3, 26, 3, 'trim', 1); cv.r(21, 4, 26, 5, 'hinge', 5)
        cv.p(x0, 3, 'trim', 0); cv.p(x1, 3, 'trim', 0)
        # la boca
        cv.r(x0, 18, x1, 27, 'dark', 3); cv.vl(x0, 18, 27, 'hinge', 5); cv.vl(x1, 18, 27, 'hinge', 5)
        if state == 'gold':
            gold_mound(cv, 23.5, 27, 14, 9.5, 7)
    ytop = 28
    cv.r(x0, ytop, x1, 40, 'wood', 6)
    cv.frame(x0, ytop, x1, 40, 'trim', 3)
    cv.p(x0 + 1, ytop + 1, 'trim', 3); cv.p(x1 - 1, ytop + 1, 'trim', 3)      # reforços de les cantonades
    cv.p(x0 + 1, 39, 'trim', 3); cv.p(x1 - 1, 39, 'trim', 3)
    cv.art(20, ytop, ['33333333', '.3....3.', '.3.33.3.', '..3773..', '.3.33.3.', '..3..3..'], 'trim')         # el pany
    cv.drop()
    return cv


# ───────────────────────── Monedes i tresor ─────────────────────────

COIN = ['..111111..', '.13222231.', '1322332231', '1322442231', '.13222231.', '4.111111.4', '.44444444.', '...4444...']


def stamp_coin(cv, x, y, mat='coin'):
    cv.art(x, y, COIN, mat)


def stack(cv, cx, base, n):
    """Pila de monedes: els cantells (2 px cada moneda, una mica desquadrats) i la de dalt de cara."""
    for k in range(n):
        y = base - 2 * k
        off = (hsh(k, cx, 5) % 3) - 1 if k else 0
        cv.r(cx - 5 + off, y, cx + 4 + off, y + 1, 'coin', 3)
        cv.hl(cx - 5 + off, cx + 4 + off, y + 1, 'coin', 4)
        cv.p(cx - 5 + off, y, 'coin', 4); cv.p(cx + 4 + off, y, 'coin', 4)
        cv.hl(cx - 3 + off, cx - 1 + off, y, 'coin', 2)
    stamp_coin(cv, cx - 5, base - 2 * n - 3)


def coin_stack():
    cv = Cv()
    stack(cv, 24, 37, 8)
    cv.strip(16, 31, 40)
    return cv


def coin_stacks():
    cv = Cv()
    stack(cv, 26, 31, 9); stack(cv, 14, 35, 5); stack(cv, 36, 37, 4); stack(cv, 24, 39, 2)
    cv.strip(8, 41, 42)
    return cv


def coins_loose():
    cv = Cv()
    for x, y in ((12, 10), (27, 13), (5, 19), (19, 21), (33, 23), (11, 30), (25, 32)):
        stamp_coin(cv, x, y)
        cv.hl(x + 1, x + 8, y + 9, 'sh', 1)
    return cv


def coin_pile(rx, ry, seed, ring):
    cv = Cv()
    base = 38
    gold_mound(cv, 23.5, base, rx, ry, seed)
    for k in range(ring):                                          # monedes senceres al peu del munt
        a = math.pi * (0.08 + 0.84 * (k + 0.5) / ring)
        stamp_coin(cv, int(23.5 - math.cos(a) * (rx - 2)) - 5, int(base - 3 + math.sin(a) * 4))
    cv.drop(2, (1, 2))
    return cv


INGOT = ['..1111111111111111..', '.111111111111111113.', '11111111111111111133', '22222222222222222334', '33333333333333333344',
         '33333333333333333344', '.4444444444444444444']


def bars():
    cv = Cv()
    cv.art(3, 29, INGOT, 'coin'); cv.art(25, 29, INGOT, 'coin')
    cv.art(14, 21, INGOT, 'coin')
    cv.hl(15, 33, 28, 'coin', 5)
    cv.strip(4, 43, 37)
    return cv


def crown():
    cv = Cv()
    K = {'p': ('white', 0), 'v': ('cloth', 4), 'V': ('cloth', 5), 'r': ('red', 2), 'R': ('red', 4), 'b': ('blue', 2),
         'B': ('blue', 4)}
    rows = ['....pp..........pp..........pp....',
            '....pp..........pp..........pp....',
            '....11..........11..........22....',
            '...1221........1221........2332...',
            '...1221...VV...1221...VV...2332...',
            '..122221.VvvV.122221.VvvV.233332..',
            '..122221VvvvvV122221VvvvvV233332..',
            '.12222221vvvv12222221vvvv123333332',
            '.122222221111222222221111233333332',
            '1222222222222222222222222233333333',
            '12222rr2222222bb2222222rr233333333',
            '1222rRRr22222bBBb22222rRRr33333334',
            '12222rr2222222bb2222222rr233333334',
            '1222222222222222222222222333333334',
            '.33333333333333333333333333333344.',
            '..444444444444444444444444444444..']
    cv.art(7, 19, rows, 'coin', K)
    cv.strip(9, 38, 36)
    return cv


def goblet():
    cv = Cv()
    lathe(cv, 23.5, [(15, 7.4), (18, 7.2), (23, 5.4), (26, 2.2), (27, 1.6), (32, 1.6), (34, 3), (35.6, 6.2), (36.6, 6.4)],
          'coin', base=3, gloss=(17, 24),
          mat_at=lambda L, th: 'red' if 19.6 <= L <= 21.6 and abs(th) < 0.3 else None,
          cap=(17, 6.2, lambda dx, dz: ('cloth', 5 if dz < 0 else 4)))
    cv.strip(15, 32, 41)
    return cv


GEM = ['...1111...', '..100112..', '.10011223.', '1001122334', '1111222334', '.22223334.', '..223344..', '...2344...', '....34....']


def gems():
    cv = Cv()
    for x, y, m in ((18, 11, 'red'), (30, 16, 'blue'), (6, 19, 'green'), (19, 24, 'purple'), (32, 29, 'green'), (9, 31, 'blue')):
        cv.art(x, y, GEM, m)
        cv.hl(x + 2, x + 7, y + 10, 'sh', 1)
    return cv


def pouch():
    cv = Cv()
    wr = lambda L, th: 1 if (abs(((th * 2.2 + L * 0.16) % 1.0) - 0.5) < 0.04 and 26 < L < 35) else 0
    lathe(cv, 18.5, [(18.5, 4.6), (20, 3.2), (22, 2.8), (24, 5.6), (27.5, 9.6), (32, 11.2), (36, 9.6), (37.6, 7)],
          'cer', base=2, mod=wr, mat_at=lambda L, th: 'trim' if 21.4 <= L <= 22.8 else None,
          cap=(19.6, 3.4, lambda dx, dz: ('dark', 3)))
    for x, y in ((31, 27), (36, 32), (28, 34)):
        stamp_coin(cv, x, y)
    cv.strip(8, 44, 42)
    return cv


def jewels():
    cv = Cv()
    for k in range(22):                                            # collaret de perles
        a = k * 2 * math.pi / 22
        x, y = round(17.5 + 12.5 * math.cos(a)), round(25.5 + 7.5 * math.sin(a))
        cv.art(x - 1, y - 1, ['.0.', '012', '.2.'], 'white')
        cv.p(x, y + 2, 'sh', 1)
    cv.art(13, 32, ['..1111..', '.100112.', '10011223', '.222334.', '..2344..', '...34...'], 'blue')
    for cx, cy, m, g in ((36.5, 31.5, 'coin', 'red'), (31.5, 13.5, 'silver', 'green')):          # anells
        cv.ell(cx, cy, 5.5, 3.6, m, 3)
        cv.ell(cx, cy - 0.6, 3.6, 2.0, None, 0)
        cv.art(int(cx - 2.5), int(cy - 6.5), ['.1111.', '100112', '.2234.', '..34..'], g)
        cv.hl(int(cx - 4), int(cx + 4), int(cy + 5), 'sh', 1)
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
           ('white', 'blanc', {'cer': WHITEC, 'band': BLUE}), ('green', 'verd', {'cer': GREEN, 'band': PAPER})]
    for vid, label in (('tall', 'Gerro alt'), ('amphora', 'Àmfora'), ('round', 'Olla'), ('urn', 'Urna')):
        variants(f'ox_vase_{vid}', label, V, vase(vid), CER)
    variants('ox_vase_broken', 'Gerro trencat', V, vase('tall', 'broken'), CER)
    add('ox_vase_plant', 'Gerro amb planta', V, vase('round', 'plant'), CER[0][2])
    add('ox_vase_flowers', 'Gerro amb flors', V, vase('round', 'flowers'), CER[2][2])
    # Cofres
    for state, label in (('closed', 'tancat'), ('empty', 'obert'), ('gold', 'amb or')):
        add(f'ox_chest_{state}', f'Cofre gran {label}', X, chest(state))
    for state, label in (('closed', 'tancat'), ('empty', 'obert')):
        add(f'ox_chest_dark_{state}', f'Cofre fosc {label}', X, chest(state), {'wood': DARK_WOOD})
    IRONC = {'wood': STONE, 'trim': IRON, 'hinge': IRON}
    for state, label in (('closed', 'tancat'), ('empty', 'obert')):
        add(f'ox_chest_iron_{state}', f'Cofre de ferro {label}', X, chest(state), IRONC)
    add('ox_chest_iron_gold', 'Cofre de ferro amb or', X, chest('gold'), IRONC)
    # Monedes i tresor
    METALS = [('gold', 'd\'or', {}), ('silver', 'de plata', {'coin': SILVER}), ('copper', 'de coure', {'coin': COPPER})]
    variants('ox_coin_stack', 'Pila de monedes', T, coin_stack(), METALS)
    variants('ox_coin_stacks', 'Piles de monedes', T, coin_stacks(), METALS)
    variants('ox_coins_loose', 'Monedes escampades', T, coins_loose(), METALS)
    variants('ox_coin_pile', 'Munt de monedes', T, coin_pile(13, 9, 5, 3), METALS)
    variants('ox_coin_hoard', 'Gran munt de monedes', T, coin_pile(20, 22, 11, 5), METALS)
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
