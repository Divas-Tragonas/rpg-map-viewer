#!/usr/bin/env python3
"""
Objectes nous «a l'estil Oryx» (v5.26; refets a la v5.27 i a la v5.29; goblins a la v5.30): mobles, caixes, bótes,
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
BONE = ['#ffffff', '#e4dfd2', '#bfb8a8', '#a39c8c', '#857f72', '#69645a', '#4e4a43', '#35322d', '#1f1d1a']
MUD = ['#9a7a50', '#806440', '#6a5234', '#57422a', '#463421', '#36281a', '#281d13', '#1b130c', '#0f0a06']
SLIME = ['#e4f78c', '#bce04e', '#93c236', '#6fa22a', '#508222', '#39621a', '#264612', '#172d0b', '#0c1a05']
RUST = ['#e8ac7c', '#cc8850', '#ac6a38', '#8e5029', '#703d1e', '#542c15', '#3a1e0e', '#251308', '#150a04']
RAG = ['#c0c098', '#a2a27a', '#868660', '#6c6c4c', '#55553b', '#40402c', '#2d2d1f', '#1d1d14', '#0f0f0a']
STRAW = ['#f6e8a4', '#e6d074', '#cfb452', '#b29840', '#907a33', '#6e5d28', '#4e421d', '#322a13', '#191509']
MEAT = ['#f6b8a8', '#e28e7e', '#c66660', '#a64c4c', '#863a3a', '#662c2c', '#481f1f', '#2d1313', '#170a0a']
FIRE = ['#ffffff', '#fff6a8', '#ffd444', '#ffa024', '#f06412', '#c23e0a', '#822605', '#4a1603', '#220b01']
DARK = ['#3a3a3a', '#2d2d2d', '#262626', '#1f1f1f', '#1a1a1a', '#161616', '#121212', '#0e0e0e', '#0a0a0a']

MATS = {
    'wood': WOOD, 'stone': STONE, 'iron': IRON, 'gold': GOLD, 'trim': GOLD, 'coin': GOLD, 'cloth': RED, 'cer': CLAY,
    'band': PAPER, 'sack': BURLAP, 'paper': PAPER, 'water': TEAL, 'leaf': GREEN, 'red': RED, 'blue': BLUE,
    'green': GREEN, 'purple': PURPLE, 'clay': CLAY, 'silver': SILVER, 'white': WHITEC, 'dark': DARK, 'hinge': GOLD,
    'bone': BONE, 'mud': MUD, 'slime': SLIME, 'rust': RUST, 'rag': RAG, 'straw': STRAW, 'meat': MEAT, 'fire': FIRE,
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


FLY_SPOTS = {}   # id de la peça → punts on voleten mosques


def add(pid, label, group, cv, over=None):
    PIECES.append((pid, label, group, cv.image(over)))
    if getattr(cv, 'flies', None):
        FLY_SPOTS[pid] = cv.flies


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

def gold_mound(cv, cx, base, rx, ry, seed, mat='coin', sparkle=True):
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
    for n in range(40 if sparkle else 0):
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


# ───────────────────────── Runa i brutícia (decorat de terra) ─────────────────────────
# Com els ossos, la pols i els bassals de l'autor: siluetes planes d'un o dos tons, vistes de dalt,
# amb una ombra d'1 px a sota (`contact`). Res no omple la casella: són restes escampades.

def contact(cv):
    """L'ombra dels ossos de l'autor: 1 px d'alfa 64 sota cada píxel que no en té cap a sota."""
    for (x, y) in list(cv.g):
        if cv.solid(x, y) and (x, y + 1) not in cv.g:
            cv.p(x, y + 1, 'sh', 1)


def rock(cv, x, y, w, h, seed, mat='stone', tones=(2, 4, 6)):
    """Una pedra: contorn irregular, clara a dalt (mira amunt), fosca a baix (mira endavant)."""
    for i in range(w):
        t = i / (w - 1) if w > 1 else 0.5
        arch = math.sin(math.pi * t) ** 0.6
        y0 = y + round((1 - arch) * h * 0.6) + (hsh(i, seed, 1) % 2 if 0 < i < w - 1 else 0)
        y1 = y + h - 1 - round((1 - arch) * h * 0.25)
        for yy in range(y0, y1 + 1):
            f = (yy - y0) / max(1, y1 - y0)
            cv.p(x + i, yy, mat, tones[0] if f < 0.38 else tones[1] if f < 0.78 else tones[2])
    if w > 7:
        cv.p(x + w // 2 + 1, y + h // 2, mat, tones[2]); cv.p(x + w // 2, y + h // 2 - 1, mat, tones[2])


def blob(cv, cx, cy, rx, ry, seed, mat, tone, rim=None):
    """Una taca o un bassal: el contorn ondulat dels bassals de l'autor, un to i la vora d'un altre."""
    pts = set()
    for y in range(int(cy - ry * 1.4), int(cy + ry * 1.4) + 1):
        for x in range(int(cx - rx * 1.4), int(cx + rx * 1.4) + 1):
            a = math.atan2((y - cy) / ry, (x - cx) / rx)
            lim = 1 + 0.17 * math.sin(3 * a + seed) + 0.1 * math.sin(5 * a + seed * 2.3)
            if math.hypot((x - cx) / rx, (y - cy) / ry) <= lim:
                pts.add((x, y))
    for x, y in pts:
        edge = any((x + a, y + b) not in pts for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        cv.p(x, y, mat, rim if (edge and rim is not None) else tone)
    return pts


def board(cv, x0, y0, x1, y1, w=3, tones=(2, 3, 5), mat='wood'):
    """Un tauló a terra: gruix `w`, el cantell de dalt clar i el de baix fosc, les puntes estellades."""
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for k in range(n + 1):
        x, y = round(x0 + (x1 - x0) * k / n), round(y0 + (y1 - y0) * k / n)
        ww = w - (1 if k in (0, n) or (k in (1, n - 1) and hsh(k, x0, y0) % 2) else 0)
        for j in range(ww):
            cv.p(x, y + j, mat, tones[0] if j == 0 else tones[2] if j == ww - 1 else tones[1])
    cv.p(round(x0 + (x1 - x0) * 0.3), round(y0 + (y1 - y0) * 0.3) + 1, mat, tones[2])


BONE_A = ['.2.2....', '2222....', '.222....', '..222...', '...222..', '....222.', '....2222', '....2.2.']
BONE_B = ['....2.2.', '....2222', '....222.', '...222..', '..222...', '.222....', '2222....', '.2.2....']
BONE_H = ['2........2', '2222222222', '2........2']
SKULL_S = ['.2222.', '222222', '2.22.2', '222222', '.2222.', '.2.22.']
RIBS = ['.2..2..2..2..', '2..2..2..2..2', '2222222222222', '2..2..2..2..2', '.2..2..2..2..']
FISHBONE = ['..........2..2..2.......', '22.......2..2..2..2..222', '.2222222222222222222.2.2', '22.......2..2..2..2..222',
            '..........2..2..2.......']
HORNED = ['2..........2', '22........22', '.22.2222.22.', '..22222222..', '..2.2222.2..', '..22222222..', '...22..22...',
          '...222222...', '....2..2....']
FLY = {'f': ('dark', 3), 'w': ('white', 0)}


def flies(cv, pts):
    """v5.31: les mosques ja no es pinten a l'art (serien quietes): es guarden com a punts (`cv.flies`, px de la
    peça) i el joc les anima a sobre (`drawTileLive`, `lib/tilemap/flies.ts`)."""
    cv.flies = [(x + 1, y + 1) for x, y in pts]   # el centre de l'antic dibuix de 3×2


def rubble(seed, big, small):
    cv = Cv()
    done = []
    n = seed * 97
    while len(done) < big + small:
        n = (n * 1103515245 + 12345) % 2147483648
        is_big = len(done) < big
        w = (8 + (n >> 4) % 5) if is_big else (3 + (n >> 4) % 3)
        h = (6 + (n >> 9) % 3) if is_big else (2 + (n >> 9) % 2)
        x, y = 4 + (n >> 12) % (40 - w), 6 + (n >> 18) % (34 - h)
        if all(x + w + 1 < a or a + c + 1 < x or y + h + 1 < b or b + d + 1 < y for a, b, c, d in done):
            done.append((x, y, w, h))
    for i, (x, y, w, h) in enumerate(sorted(done, key=lambda r: r[1] + r[3])):
        rock(cv, x, y, w, h, seed + i)
    for k in range(10):                                            # pols i grava
        h = hsh(k, seed, 7)
        cv.p(5 + h % 38, 6 + (h >> 6) % 36, 'stone', 4)
    contact(cv)
    return cv


def bricks():
    cv = Cv()
    def brick(x, y, w, h):
        cv.r(x, y, x + w - 1, y + h - 3, 'clay', 5); cv.hl(x, x + w - 1, y, 'clay', 4)
        cv.r(x, y + h - 2, x + w - 1, y + h - 1, 'clay', 7)
        cv.p(x + w - 1, y, None); cv.p(x, y + h - 1, None)
    for x, y, w, h in ((6, 8, 11, 7), (24, 5, 9, 6), (30, 17, 12, 7), (10, 22, 10, 7), (22, 30, 11, 7), (5, 34, 7, 5)):
        brick(x, y, w, h)
    for x, y in ((20, 14), (36, 9), (18, 20), (39, 30), (16, 33), (28, 24), (8, 18), (34, 38), (25, 16)):
        cv.r(x, y, x + 1 + hsh(x, y) % 2, y + 1, 'clay', 5 + hsh(y, x) % 2)
    for k in range(10):
        h = hsh(k, 3, 9)
        cv.p(4 + h % 40, 5 + (h >> 6) % 38, 'stone', 3)
    contact(cv)
    return cv


def dirt_pile():
    cv = Cv()
    blob(cv, 24, 26, 15, 9, 2.0, 'mud', 3, 4)
    blob(cv, 22, 23, 10, 5, 4.0, 'mud', 2)
    for x, y in ((14, 24), (30, 27), (25, 20), (19, 29), (33, 23)):
        cv.p(x, y, 'mud', 1)
    rock(cv, 31, 28, 5, 3, 3); rock(cv, 9, 30, 4, 3, 5); rock(cv, 22, 31, 3, 2, 8)
    contact(cv)
    return cv


def puddle(mat, tone, rim, seed, bubbles=False, drips=True):
    cv = Cv()
    blob(cv, 23, 24, 13, 9, seed, mat, tone, rim)
    if drips:
        blob(cv, 39, 14, 3, 2, seed + 1, mat, tone, rim); blob(cv, 8, 37, 2.4, 1.8, seed + 2, mat, tone, rim)
        cv.p(42, 20, mat, rim); cv.p(5, 32, mat, rim); cv.p(36, 36, mat, rim)
    cv.hl(15, 19, 19, mat, tone - 1); cv.p(14, 20, mat, tone - 1)                # el reflex
    if bubbles:
        for x, y in ((22, 23), (29, 27), (17, 28)):
            cv.art(x, y, ['.11.', '1..1', '1..1', '.11.'], mat); cv.p(x + 1, y + 1, 'white', 0)
    return cv


def stain(seed):
    """Taca de greix: només ombra, deixa veure el terra de sota."""
    cv = Cv()
    blob(cv, 23, 24, 14, 9, seed, 'sh', 2, 3)
    blob(cv, 22, 23, 9, 5, seed + 2, 'sh', 1)
    blob(cv, 39, 33, 3, 2, seed + 1, 'sh', 2)
    return cv


def blood_dry():
    cv = Cv()
    blob(cv, 22, 23, 9, 6, 1.4, 'red', 6, 5)
    blob(cv, 34, 30, 4, 3, 2.2, 'red', 6, 5)
    for x, y in ((9, 15), (12, 12), (36, 18), (40, 24), (14, 33), (30, 38), (8, 28), (27, 12), (33, 13), (18, 36)):
        cv.p(x, y, 'red', 5)
        if hsh(x, y) % 2:
            cv.p(x + 1, y, 'red', 6)
    for k in range(7):                                             # el rastre, cap a la dreta
        cv.r(36 + k, 33 + k // 2, 37 + k, 33 + k // 2, 'red', 6)
    return cv


def dung(scatter=False):
    cv = Cv()
    K = {'h': ('mud', 2)}
    if scatter:
        for x, y in ((10, 12), (22, 9), (31, 18), (15, 25), (27, 30), (36, 34), (8, 35)):
            cv.art(x, y, ['.44.', '4h55', '4556', '.66.'], 'mud', K)
        flies(cv, ((19, 17), (33, 26)))
    else:
        cv.art(13, 14, ['.........44.........', '........4h45........', '........4455........', '......4444555.......',
                        '.....44h4445556.....', '.....44444555566....', '....4444445555566...', '..44h44444555555666.',
                        '.444444444555555566.', '4444h4444455555556666', '4444444444555555566666', '.44444444555555566666.',
                        '..5555555555566666...'], 'mud', K)
        flies(cv, ((9, 13), (35, 10), (38, 22), (20, 8)))
    contact(cv)
    return cv


def bones(kind):
    cv = Cv()
    if kind == 'gnawed':
        cv.art(8, 10, BONE_A, 'bone'); cv.art(27, 8, BONE_B, 'bone'); cv.art(16, 22, RIBS, 'bone')
        cv.art(32, 28, BONE_A, 'bone'); cv.art(9, 32, BONE_H, 'bone'); cv.art(25, 36, SKULL_S, 'bone')
        for x, y in ((21, 14), (38, 22), (14, 38), (36, 40), (6, 24)):
            cv.p(x, y, 'bone', 2)
    if kind == 'fish':
        cv.art(11, 14, FISHBONE, 'bone'); cv.art(14, 30, FISHBONE[1:4], 'bone'); cv.p(13, 15, None)
        for x, y in ((9, 24), (37, 23), (30, 37), (40, 34)):
            cv.p(x, y, 'bone', 2)
    if kind == 'horned':
        cv.art(18, 14, HORNED, 'bone'); cv.art(8, 30, BONE_H, 'bone'); cv.art(30, 28, BONE_A, 'bone')
        cv.art(14, 36, ['2.2.2.2', '2222222'], 'bone')
    contact(cv)
    return cv


def rags(kind=0):
    cv = Cv()
    if kind == 0:
        pts = blob(cv, 22, 23, 12, 8, 3.3, 'rag', 3, 4)
        for xa, ya, xb, yb in ((14, 20, 22, 25), (24, 18, 30, 26), (17, 27, 26, 29)):
            cv.line(xa, ya, xb, yb, 'rag', 5)
        for x, y in ((19, 22), (20, 22), (27, 25)):                # forats
            cv.p(x, y, None)
        blob(cv, 37, 34, 4, 2.4, 1.0, 'rag', 4, 5)
        cv.line(33, 12, 40, 16, 'rag', 3); cv.line(33, 13, 40, 17, 'rag', 5)
    else:
        blob(cv, 23, 24, 13, 7, 5.1, 'cloth', 5, 6)
        blob(cv, 21, 22, 7, 3, 2.0, 'cloth', 4)
        for xa, ya, xb, yb in ((13, 22, 20, 27), (26, 21, 33, 27)):
            cv.line(xa, ya, xb, yb, 'cloth', 7)
        for x, y in ((18, 25), (29, 23), (30, 23), (24, 28)):
            cv.p(x, y, None)
        for x in range(12, 34, 3):                                 # serrell esfilagarsat
            cv.p(x, 32, 'cloth', 6); cv.p(x + 1, 33, 'cloth', 6)
    contact(cv)
    return cv


def planks():
    cv = Cv()
    board(cv, 6, 14, 30, 9); board(cv, 14, 26, 41, 31, w=4); board(cv, 8, 36, 22, 30); board(cv, 28, 16, 40, 22)
    for xa, ya, xb, yb in ((33, 9, 37, 8), (5, 24, 9, 26), (25, 38, 30, 39), (38, 36, 41, 34), (20, 20, 23, 21)):
        cv.line(xa, ya, xb, yb, 'wood', 3)
    for x, y in ((12, 13), (26, 11), (20, 28), (36, 31)):          # claus
        cv.p(x, y, 'iron', 6)
    contact(cv)
    return cv


def ashes():
    cv = Cv()
    blob(cv, 23, 25, 14, 9, 0.7, 'stone', 4, 5)
    blob(cv, 22, 24, 9, 5, 2.9, 'stone', 3)
    board(cv, 12, 22, 30, 28, w=3, tones=(6, 7, 8)); board(cv, 16, 30, 33, 20, w=3, tones=(6, 7, 8))
    for x, y in ((20, 25), (25, 23), (28, 26), (17, 27)):
        cv.p(x, y, 'fire', 4); cv.p(x + 1, y, 'fire', 5)
    for x, y in ((10, 20), (35, 30), (30, 17), (14, 32), (37, 22)):
        cv.p(x, y, 'stone', 2)
    return cv


def scraps():
    cv = Cv()
    K = {'r': ('red', 3), 'R': ('red', 5), 'c': ('paper', 2), 'C': ('paper', 4), 's': ('wood', 6), 'm': ('clay', 2),
         'M': ('clay', 4), 'n': ('clay', 6), 'b': ('bone', 2), 'g': ('slime', 4)}
    cv.art(8, 10, ['...s....', '.rrsrr..', 'rrccccR.', '.rcCccR.', '..cccc..', '.rccCcR.', 'rrrccRR.', '.rrRRR..'], key=K)     # cor de poma
    cv.art(22, 18, ['......mmmm..', '....mmmmmmm.', '...mmmMmmmMm', '...mmmmmmMMn', '....MmmMMMn.', '...bMMMnnn..', '..bb........',
                    '.bb.........', 'bbbb........', 'b.b.........'], key=K)                                               # os amb carn
    cv.art(10, 30, ['.mmmm..', 'mmgmMM.', 'mMmgMMn', '.MMnnn.'], key=K)                                                     # crosta florida
    for x, y in ((20, 12), (33, 34), (36, 14), (17, 38), (28, 36)):
        cv.p(x, y, 'clay', 3)
    flies(cv, ((31, 12), (6, 24)))
    contact(cv)
    return cv


def fish_rotten():
    cv = Cv()
    K = {'a': ('slime', 5), 'b': ('slime', 6), 'c': ('rag', 2), 'e': ('dark', 3), 'w': ('bone', 2), 'd': ('slime', 7)}
    cv.art(8, 16, ['.....aaaaaaaaa.............', '...aaacccccccaaaa.......aa.', '..aacccccccccccaaaa...aaab.', '.aaecccwcwcwcccccaaaaaaabb.',
                   'aaaccccwcwcwcccccccbaaabbb.', '.aacccccccccccccbbbb.aaabb.', '..abbcccccccbbbbbb.....aab.', '....bbbbbbbbbb.........bb..'], key=K)
    blob(cv, 22, 33, 9, 3, 2.0, 'sh', 2)
    flies(cv, ((14, 10), (28, 11), (36, 26), (6, 28)))
    contact(cv)
    return cv


def straw(seed=1, dense=True):
    cv = Cv()
    n = seed * 31
    for k in range(120 if dense else 55):
        n = (n * 1103515245 + 12345) % 2147483648
        rho = math.sqrt(((n >> 8) % 1000) / 1000)
        a = ((n >> 3) % 628) / 100
        x, y = 23.5 + rho * 19 * math.cos(a), 24 + rho * 13 * math.sin(a)
        ang = ((n >> 14) % 314) / 100
        ln = 3 + (n >> 20) % 4
        cv.line(round(x), round(y), round(x + ln * math.cos(ang)), round(y + ln * math.sin(ang) * 0.6), 'straw',
                (2, 3, 3, 4, 5)[(n >> 6) % 5])
    return cv


def glass():
    cv = Cv()
    K = {'w': ('white', 0), 'c': ('clay', 2)}
    for x, y, rows in ((8, 10, ['.1...', '122..', '1223.', '.233.']), (24, 8, ['..12', '.122', '1223', '.33.']), (33, 20, ['1....', '12...', '1223.', '.2233']),
                       (14, 26, ['.12.', '1223', '.23.']), (26, 32, ['..1..', '.122.', '12233', '.233.']), (38, 34, ['12', '23'])):
        cv.art(x, y, rows, 'green'); cv.p(x + 1, y + 1, 'white', 0)
    cv.art(17, 15, ['.cc.....', '.33.....', '.33.....', '2333....', '23w33...', '233333..', '.3333w..', '..3.3...'], 'green', K)   # el coll de l'ampolla
    for x, y in ((21, 28), (31, 14), (10, 36), (36, 28), (20, 38)):
        cv.p(x, y, 'green', 1)
    contact(cv)
    return cv


def jug_tipped():
    cv = Cv()
    blob(cv, 33, 30, 9, 5, 1.9, 'purple', 6, 5)                    # el vi vessat
    cv.hl(30, 34, 28, 'purple', 4)
    K = {'d': ('dark', 3), 'h': ('clay', 1)}
    cv.art(5, 14, ['.....222222222........', '...2222222222222......', '..22hh2222222222233...', '.222h22222222222223333', '.222222222222222223dd3',
                   '2222222222222222223dd3', '2233333333333333333dd3', '.333333333333333333333', '.3333333333333334433..', '..33444444444444444...',
                   '...4444444444444......', '.....444444444........'], 'clay', K)
    cv.vl(12, 15, 24, 'band', 2); cv.vl(13, 15, 24, 'band', 2)
    contact(cv)
    return cv


def mushrooms(mat, spot):
    cv = Cv()
    def shroom(x, y, w):
        h = max(3, w // 2)
        for j in range(h):
            inset = (h - 1 - j) if j < h - 1 else 0
            for i in range(inset, w - inset):
                cv.p(x + i, y + j, mat, 2 if j == 0 else 3 if j < h - 1 else 5)
        cv.r(x + w // 2 - 1, y + h, x + w // 2, y + h + 2, 'bone', 2); cv.vl(x + w // 2, y + h, y + h + 2, 'bone', 3)
        if w > 5:
            cv.p(x + 2, y + 1, *spot); cv.p(x + w - 3, y + 2 if h > 3 else y + 1, *spot)
    for x, y, w in ((9, 12, 9), (21, 8, 6), (28, 18, 11), (14, 26, 7), (33, 32, 6), (22, 33, 5), (6, 34, 5)):
        shroom(x, y, w)
    contact(cv)
    return cv


def rat():
    cv = Cv()
    K = {'e': ('dark', 3), 't': ('meat', 2), 'p': ('meat', 1)}
    cv.art(10, 18, ['........4444444.........', '...44.4444444444444.....', '..4pp4444444444444444...', '.444444e44444444444444..',
                    'p4444444444444444444444t', '.5544444444444444444455tt', '...5555p5555555p55555...tt', '.....p......p............ttt'], 'stone', K)
    blob(cv, 22, 29, 8, 2.4, 1.0, 'red', 6)
    contact(cv)
    return cv


def chains():
    cv = Cv()
    def link(x, y, flat):
        cv.art(x, y, ['.33.', '3..5', '.55.'] if flat else ['35', '35', '35'], 'iron')
    pts = [(8 + k * 3, 14 + round(5 * math.sin(k * 0.55))) for k in range(11)]
    for k, (x, y) in enumerate(pts):
        link(x, y, k % 2 == 0)
    for k in range(8):
        link(10 + k * 3, 30 + round(3 * math.sin(k * 0.8 + 1)), k % 2 == 0)
    for x, y in ((2, 11), (39, 9), (33, 31)):                      # manilles
        cv.art(x, y, ['.3333.', '33..35', '3....5', '3....5', '35..55', '.5555.'], 'iron')
    contact(cv)
    return cv


def rusty():
    cv = Cv()
    for k in range(26):                                            # espasa rovellada, en diagonal
        x, y = 12 + k, 27 - round(k * 0.62)
        cv.p(x, y - 1, 'iron', 3 if hsh(k, 1) % 4 else 5)
        cv.p(x, y, 'rust', 2 if hsh(k, 2) % 3 else 4)
        cv.p(x, y + 1, 'rust', 4 if hsh(k, 3) % 3 else 6)
    cv.art(37, 9, ['..3', '.32', '32.'], 'iron')                   # la punta, escantellada
    cv.line(9, 22, 14, 31, 'iron', 5); cv.line(10, 22, 15, 31, 'iron', 6)       # creuera
    cv.art(5, 28, ['...55', '..55.', '.55..', '44...', '44...'], 'wood')
    # tros d'escut
    for y in range(28, 42):
        for x in range(24, 44):
            d = math.hypot(x - 36, y - 40)
            if 0 < d <= 11 and x < 36 + (y - 30) * 0.5 and y < 40:
                cv.p(x, y, 'iron' if d > 9.6 else 'wood', 5 if d > 9.6 else (4 if (x + y) % 5 else 5))
    cv.p(31, 35, 'iron', 4); cv.p(28, 37, 'iron', 4)
    contact(cv)
    return cv


def footprints():
    cv = Cv()
    foot = ['2.2.2', '2.2.2', '.....', '.222.', '22222', '22222', '.222.', '.222.', '..2..']
    for x, y in ((9, 31), (19, 23), (26, 12), (36, 4)):
        for j, row in enumerate(foot):
            for i, ch in enumerate(row):
                if ch != '.':
                    cv.p(x + i, y + j, 'sh', 1)
    for x, y in ((14, 38), (33, 18), (8, 22)):
        cv.p(x, y, 'sh', 2); cv.p(x + 1, y + 1, 'sh', 2)
    return cv


def scrawl():
    cv = Cv()
    rows = ['....44444444....', '..444......444..', '.44..........44.', '.4............4.', '4..444....444..4', '4..444....444..4',
            '4..444....444..4', '4......44......4', '.4.....44.....4.', '.44..........44.', '..444.4.4.4.44..', '....4.4.4.4.4...',
            '....444444444...']
    cv.art(16, 6, rows, 'red')
    cv.line(8, 26, 40, 40, 'red', 4); cv.line(40, 26, 8, 40, 'red', 4)
    for x, y in ((6, 24), (9, 23), (41, 24), (38, 23), (6, 41), (9, 42), (41, 41), (38, 42)):
        cv.r(x, y, x + 1, y + 1, 'red', 4)
    for x, y in ((20, 19), (28, 20), (20, 20), (20, 21)):          # regalims
        cv.p(x, y, 'red', 5)
    return cv


# ───────────────────────── Cau de goblins (objectes) ─────────────────────────

def rubble_pile():
    cv = Cv()
    layers = [(9, ((18, 11, 9),)), (15, ((11, 12, 10), (24, 10, 8))), (22, ((6, 10, 9), (16, 13, 10), (30, 11, 9))),
              (30, ((2, 11, 9), (13, 9, 8), (22, 12, 10), (34, 11, 9)))]
    for li, (y, rocks) in enumerate(layers):                       # de dalt (fons) a baix (davant)
        for k, (x, w, h) in enumerate(rocks):
            rock(cv, x, y + (li + k) % 2, w, h, li * 7 + k)
    for x, y, w in ((0, 39, 4), (41, 38, 5), (20, 41, 4), (30, 41, 3)):
        rock(cv, x, y, w, 3, x)
    cv.drop(2)
    return cv


def trash_heap():
    cv = Cv()
    steps = 10
    prof = [(38 - 20 * math.cos(math.pi / 2 * k / steps), max(0.6, 19 * math.sin(math.pi / 2 * k / steps))) for k in range(steps + 1)]
    lathe(cv, 23.5, prof, 'mud', base=4, hollow=False)
    board(cv, 8, 30, 26, 22); board(cv, 22, 34, 40, 30, w=4)
    blob(cv, 30, 22, 6, 3.4, 3.0, 'rag', 3, 4); blob(cv, 14, 36, 5, 2.6, 1.2, 'cloth', 5, 6)
    cv.art(20, 15, SKULL_S, 'bone'); cv.art(28, 34, BONE_A, 'bone'); cv.art(9, 24, FISHBONE[1:4], 'bone')
    cv.art(33, 25, ['.cc.', '.33.', '2333', '2w33', '2333', '.33.'], 'green', {'c': ('clay', 2), 'w': ('white', 0)})
    cv.art(15, 20, ['.rr.', 'rrrR', '.RR.'], key={'r': ('red', 3), 'R': ('red', 5)})
    rock(cv, 4, 37, 6, 4, 2); rock(cv, 37, 38, 5, 3, 4)
    flies(cv, ((12, 12), (34, 14), (26, 8)))
    cv.drop(2)
    return cv


SKULL_L = ['..222222..', '.22222222.', '2222222222', '2277227722', '2277227722', '2222772222', '.22222222.', '.32323232.',
           '..3.3.3.3.']


def skull_pile():
    cv = Cv()
    for x, y in ((14, 8), (24, 9), (8, 18), (19, 19), (30, 18), (3, 29), (14, 30), (25, 30), (36, 29)):
        cv.art(x, y, SKULL_L, 'bone')
        cv.hl(x + 1, x + 8, y + 9, 'bone', 5)
    cv.art(2, 39, BONE_H, 'bone'); cv.art(30, 40, BONE_H, 'bone')
    cv.drop(2)
    return cv


def totem():
    cv = Cv()
    cv.r(22, 4, 25, 42, 'wood', 5); cv.vl(22, 4, 42, 'wood', 4); cv.vl(25, 4, 42, 'wood', 6)
    cv.hl(22, 25, 3, 'wood', 2)
    for y in (12, 22, 31):
        cv.p(23, y, 'wood', 7); cv.p(24, y + 2, 'wood', 7)
    cv.r(10, 14, 37, 16, 'wood', 5); cv.hl(10, 37, 14, 'wood', 3); cv.hl(10, 37, 16, 'wood', 6)      # travesser
    cv.art(19, 5, SKULL_L, 'bone')
    for x in (7, 33):                                              # cranis penjats
        cv.vl(x + 3, 17, 19, 'rag', 3); cv.art(x, 20, SKULL_S, 'bone')
    for x, y, m in ((12, 8, 'red'), (33, 8, 'red'), (9, 10, 'slime'), (36, 10, 'slime')):          # plomes
        cv.art(x, y, ['.2.', '232', '232', '.4.', '.4.'], m)
    cv.art(20, 24, ['4.4444.4', '44444444', '.4.44.4.'], 'rag')                                     # corda
    rock(cv, 15, 39, 8, 5, 1); rock(cv, 25, 40, 7, 4, 3)
    cv.drop(2)
    return cv


def banner():
    cv = Cv()
    cv.r(22, 2, 24, 43, 'wood', 5); cv.vl(22, 2, 43, 'wood', 4)
    cv.art(21, 0, ['.222.', '23334'], 'bone')
    cv.r(8, 6, 38, 7, 'wood', 5); cv.hl(8, 38, 6, 'wood', 3)
    for x in range(10, 37):                                        # la tela, esparracada per baix
        bottom = 30 + (hsh(x // 3, 0, 4) % 6) - (3 if x % 9 == 4 else 0)
        for y in range(8, bottom):
            cv.p(x, y, 'cloth', 4 if (x - 10) % 9 not in (0, 8) else 5)
        cv.p(x, bottom, 'cloth', 6)
    cv.hl(10, 36, 8, 'cloth', 6)
    for x, y in ((14, 20), (15, 21), (30, 16), (31, 16), (20, 27)):                              # forats
        cv.p(x, y, None)
    cv.art(18, 11, ['.222222.', '22222222', '2.2222.2', '2.2222.2', '22222222', '.22..22.', '.222222.', '..2.2.2.'], 'bone')
    cv.art(15, 21, ['2.........2', '.22.....22.', '...22.22...', '.....2.....', '...22.22...', '.22.....22.'], 'bone')
    rock(cv, 17, 40, 7, 4, 2); rock(cv, 24, 41, 6, 3, 5)
    cv.drop(2)
    return cv


FLAME = ['......4......', '.....44......', '.....434.....', '....44344....', '....43334..4.', '.4.4433344.44', '.44433233444.',
         '.44332223344.', '4433221223344', '4433211123344', '4433211123344', '.44322122344.', '.44332223344.', '..443333344..']


def cauldron():
    cv = Cv()
    board(cv, 6, 36, 24, 40, w=3, tones=(5, 6, 8)); board(cv, 22, 41, 42, 36, w=3, tones=(5, 6, 8))
    for x, y in ((9, 34), (37, 33), (5, 38), (40, 39)):            # flames que surten per sota
        cv.art(x - 2, y - 4, ['..2..', '.232.', '23132', '.343.'], 'fire')
    lathe(cv, 23.5, [(15, 12.5), (17, 14.5), (24, 16), (31, 14), (36, 8.5)], 'iron', base=7, shade=False,
          cap=(17.5, 12, lambda dx, dz: ('slime', 4 if dx * dx + dz * dz > 100 else 3)))
    for (x, y), t in list(cv.g.items()):
        if t == ('iron', 7) and y < 18:
            cv.p(x, y, 'iron', 6)                                  # la vora de dalt
    for x, y in ((18, 16), (26, 19), (22, 21)):                    # bombolles
        cv.art(x, y, ['.11.', '1..1', '.11.'], 'slime'); cv.p(x + 1, y, 'white', 0)
    cv.art(27, 13, ['.2', '22', '2.', '2.'], 'bone')               # un os que sobresurt
    for x in (7, 39):
        cv.art(x - 1, 20, ['.66.', '6..6', '6..6', '.66.'], 'iron')
    cv.hl(14, 20, 27, 'iron', 6); cv.hl(13, 16, 28, 'iron', 6)     # el reflex de la panxa
    cv.drop(2)
    return cv


def campfire(lit):
    cv = Cv()
    blob(cv, 23.5, 27, 12, 7, 1.3, 'stone', 5, 6)
    board(cv, 12, 24, 34, 29, w=3, tones=(6, 7, 8)); board(cv, 14, 31, 33, 22, w=3, tones=(6, 7, 8))
    for x, y in ((20, 26), (27, 25), (23, 29), (17, 28), (30, 28)):
        cv.p(x, y, 'fire', 3 if lit else 5); cv.p(x + 1, y, 'fire', 4 if lit else 6)
    for k in range(10):                                            # el rotlle de pedres
        a = 2 * math.pi * k / 10 + 0.2
        w = 7 if k % 2 else 6
        rock(cv, round(23.5 + 17 * math.cos(a) - w / 2), round(27 + 10.5 * math.sin(a) - 2), w, 5, k)
    contact(cv)
    if lit:                                                        # la flama, per davant de les pedres del fons
        cv.art(17, 9, FLAME, 'fire')
        cv.p(21, 5, 'fire', 3); cv.p(27, 7, 'fire', 4); cv.p(19, 8, 'fire', 4)             # espurnes
    else:
        cv.art(20, 12, ['..5...', '.5....', '..5.5.', '...5..'], 'stone')       # un fil de fum
    return cv


def straw_bed():
    cv = Cv()
    pts = blob(cv, 23.5, 25, 18, 12, 0.4, 'straw', 4, 5)
    n = 7
    for k in range(150):
        n = (n * 1103515245 + 12345) % 2147483648
        x, y = 3 + (n >> 6) % 42, 9 + (n >> 13) % 32
        ang = ((n >> 20) % 314) / 100
        ln = 3 + (n >> 3) % 4
        for t in range(ln):
            px, py = round(x + t * math.cos(ang)), round(y + t * math.sin(ang) * 0.6)
            if (px, py) in pts:
                cv.p(px, py, 'straw', (2, 3, 3, 5)[(n >> 9) % 4])
    blob(cv, 26, 27, 11, 7, 2.2, 'mud', 3, 5)                      # la pell
    for x, y in ((22, 25), (29, 28), (25, 30), (31, 24), (20, 29)):
        cv.r(x, y, x + 1, y, 'mud', 2)
    cv.art(15, 21, ['2.2', '.2.'], 'mud'); cv.art(36, 31, ['.2.', '2.2'], 'mud')
    blob(cv, 11, 17, 5, 3, 1.1, 'rag', 3, 4); cv.hl(9, 13, 16, 'rag', 2)       # el coixí de draps
    cv.drop(1, (1, 2))
    return cv


def crate_broken():
    cv = Cv()
    crate_box(cv, 7, 34, 8, 24, 40, kind='open')
    for (x, y) in list(cv.g):                                      # el cantó de la dreta, esbotzat
        jag = 27 + abs(((y * 0.37) % 2.0) - 1.0) * 5
        if x > jag and y < 33 + (x - 27) * 0.4:
            cv.p(x, y, None)
    board(cv, 30, 30, 44, 34); board(cv, 33, 38, 45, 36, w=4); board(cv, 36, 22, 44, 26)
    for xa, ya, xb, yb in ((38, 16, 42, 15), (40, 29, 44, 30), (32, 42, 36, 43)):
        cv.line(xa, ya, xb, yb, 'wood', 3)
    cv.drop(2)
    return cv


def barrel_broken():
    cv = Cv()
    stave = lambda L, th: 1 if (th + 9.0) % 0.3927 < 0.085 else 0
    hoop = lambda L, th: 'iron' if 29.5 <= L <= 31.6 else None
    jag = lambda th: 14 + 9 * abs(((th * 2.5 / math.pi + 0.3) % 2.0) - 1.0)
    lathe(cv, 19.5, BARREL, 'wood', base=6, mod=stave, mat_at=hoop, shade=False, cut=jag)
    for (x, y), t in list(cv.g.items()):
        if t[0] == 'iron':
            cv.p(x, y, 'iron', 5 if x < 16 else 6)
    board(cv, 33, 26, 45, 30, tones=(3, 5, 6)); board(cv, 34, 36, 46, 33, tones=(3, 5, 6)); board(cv, 36, 18, 44, 21, tones=(3, 5, 6))
    for y in range(36, 46):                                        # un cèrcol a terra
        for x in range(26, 46):
            d = ((x - 36) / 9.0) ** 2 + ((y - 41) / 3.6) ** 2
            if 0.62 <= d <= 1.0:
                cv.p(x, y, 'iron', 5 if y < 41 else 6)
    cv.drop(2)
    return cv


def cage(inside=None):
    cv = Cv()
    x0, x1 = 7, 40
    cv.r(x0, 5, x1, 22, 'sh', 1)                                   # per dalt es veu el fons, a les fosques
    if inside == 'bones':
        cv.art(14, 10, SKULL_L, 'bone'); cv.art(26, 12, BONE_A, 'bone'); cv.art(17, 30, RIBS, 'bone')
    for x in range(x0 + 4, x1 - 2, 5):                             # barrots de dalt
        cv.vl(x, 5, 22, 'iron', 4)
    cv.frame(x0, 4, x1, 23, 'iron', 4); cv.frame(x0 + 1, 5, x1 - 1, 22, 'iron', 5)
    cv.hl(x0, x1, 4, 'iron', 3)
    cv.hl(x0, x1, 24, 'iron', 3)                                   # cantell del davant
    cv.r(x0, 25, x1, 41, 'sh', 1)
    if inside == 'bones':
        cv.art(17, 32, RIBS, 'bone'); cv.art(10, 34, SKULL_S, 'bone')
    cv.r(x0, 25, x1, 26, 'iron', 6); cv.r(x0, 40, x1, 41, 'iron', 7)
    for x in range(x0, x1 + 1, 5):                                 # barrots del davant
        cv.vl(x, 25, 41, 'iron', 5); cv.vl(x + 1, 25, 41, 'iron', 6) if x + 1 <= x1 else None
    cv.art(27, 30, ['.33.', '3..3', '2222', '2332', '2222'], 'gold')                           # el cadenat
    cv.drop(2)
    return cv


def barricade():
    cv = Cv()
    for k, (x, top) in enumerate(((4, 12), (11, 6), (18, 10), (25, 4), (32, 9), (39, 13))):
        for y in range(top, 41):
            inset = max(0, 3 - (y - top)) // 2 if y < top + 6 else 0
            for i in range(inset, 5 - inset):
                cv.p(x + i, y, 'wood', 3 if i == inset else 5 if i == 4 - inset else 4)
        cv.p(x + 2, top, 'wood', 1); cv.p(x + 2, top + 1, 'wood', 2)
        cv.p(x + 1, top + 14 + k % 3, 'wood', 6)
    for y in (22, 33):                                             # travessers lligats
        cv.r(2, y, 45, y + 2, 'wood', 3); cv.hl(2, 45, y, 'wood', 2); cv.hl(2, 45, y + 2, 'wood', 6)
        for x in (5, 12, 19, 26, 33, 40):
            cv.art(x, y - 1, ['3.3', '.3.', '3.3', '.3.', '3.3'], 'rag')
    cv.drop(2)
    return cv


def bone_heap():
    cv = Cv()
    gold_mound(cv, 23.5, 37, 18, 17, 23, mat='bone', sparkle=False)
    for x, y in ((6, 34), (18, 37), (30, 35)):
        cv.art(x, y, SKULL_L[:7], 'bone'); cv.hl(x + 1, x + 8, y + 7, 'bone', 5)
    cv.art(14, 22, SKULL_S, 'bone'); cv.art(27, 25, BONE_A, 'bone'); cv.art(20, 14, BONE_B, 'bone'); cv.art(16, 30, RIBS, 'bone')
    cv.drop(2, (1, 2))
    return cv


def build_goblin():
    """v5.30 — Runa i brutícia (decorat de terra) i el cau de goblins (objectes)."""
    R, G = 'ox_rubble', 'ox_goblin'
    add('ox_rubble_a', 'Runa', R, rubble(1, 3, 6))
    add('ox_rubble_b', 'Runa escampada', R, rubble(2, 1, 9))
    add('ox_rubble_c', 'Pedres grosses', R, rubble(3, 4, 3))
    add('ox_bricks', 'Maons trencats', R, bricks())
    add('ox_dirt_pile', 'Munt de terra', R, dirt_pile())
    add('ox_mud', 'Bassal de fang', R, puddle('mud', 5, 4, 1.0))
    add('ox_slime', 'Bassal llefiscós', R, puddle('slime', 3, 2, 2.2, bubbles=True))
    add('ox_stain', 'Taca de greix', R, stain(0.6))
    add('ox_blood_dry', 'Sang seca', R, blood_dry())
    add('ox_dung', 'Femta', R, dung())
    add('ox_dung_scatter', 'Cagarades', R, dung(True))
    add('ox_bones_gnawed', 'Ossos rosegats', R, bones('gnawed'))
    add('ox_bones_fish', 'Espines de peix', R, bones('fish'))
    add('ox_bones_horned', 'Crani banyut', R, bones('horned'))
    add('ox_rags', 'Parracs', R, rags(0))
    add('ox_rags_red', 'Drap esparracat', R, rags(1))
    add('ox_planks', 'Fustes trencades', R, planks())
    add('ox_ashes', 'Cendres', R, ashes())
    add('ox_scraps', 'Restes de menjar', R, scraps())
    add('ox_fish_rotten', 'Peix podrit', R, fish_rotten())
    add('ox_straw', 'Palla', R, straw(1))
    add('ox_straw_thin', 'Palla escampada', R, straw(4, False))
    add('ox_glass', 'Vidres trencats', R, glass())
    add('ox_jug_tipped', 'Gerra bolcada', R, jug_tipped())
    add('ox_mushrooms', 'Bolets', R, mushrooms('red', ('white', 0)))
    add('ox_mushrooms_cave', 'Bolets de cova', R, mushrooms('slime', ('slime', 0)))
    add('ox_rat', 'Rata morta', R, rat())
    add('ox_chains', 'Cadenes i manilles', R, chains())
    add('ox_rusty', 'Ferralla rovellada', R, rusty())
    add('ox_footprints', 'Petjades', R, footprints())
    add('ox_scrawl', 'Gargot de goblin', R, scrawl())
    add('ox_rubble_pile', 'Munt de runa', G, rubble_pile())
    add('ox_trash_heap', 'Munt d\'escombraries', G, trash_heap())
    add('ox_skull_pile', 'Pila de cranis', G, skull_pile())
    add('ox_bone_heap', 'Munt d\'ossos', G, bone_heap())
    add('ox_totem', 'Tòtem de cranis', G, totem())
    add('ox_banner_goblin', 'Estendard esparracat', G, banner())
    add('ox_banner_goblin_green', 'Estendard esparracat verd', G, banner(), {'cloth': GREEN})
    add('ox_cauldron', 'Olla de brou', G, cauldron())
    add('ox_campfire', 'Foguera', G, campfire(True))
    add('ox_campfire_dead', 'Foguera apagada', G, campfire(False))
    add('ox_straw_bed', 'Jaç de palla', G, straw_bed())
    add('ox_crate_broken', 'Caixa esbotzada', G, crate_broken())
    add('ox_barrel_broken', 'Bóta rebentada', G, barrel_broken())
    add('ox_cage', 'Gàbia', G, cage())
    add('ox_cage_bones', 'Gàbia amb ossos', G, cage('bones'))
    add('ox_barricade', 'Barricada d\'estaques', G, barricade())




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
    build_goblin()


def main():
    build()
    ids = [p[0] for p in PIECES]
    assert len(ids) == len(set(ids)), 'ids repetits'
    os.makedirs(OUT, exist_ok=True)
    meta = []
    for pid, label, group, im in PIECES:
        im.save(os.path.join(OUT, pid + '.png'), optimize=True)
        meta.append({'id': pid, 'label': label, 'group': group, 'w': im.width, 'h': im.height,
                     **({'flies': FLY_SPOTS[pid]} if pid in FLY_SPOTS else {})})
    with open(os.path.join(OUT, 'pieces.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'{len(PIECES)} peces → {os.path.relpath(OUT, ROOT)}')


if __name__ == '__main__':
    main()
