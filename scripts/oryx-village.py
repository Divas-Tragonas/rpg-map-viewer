#!/usr/bin/env python3
"""
Genera el full de poble de l'app Píxel (`public/sprites/uf_village.png`): terres, transicions,
arbres, roques, tanques, murs de pedra seca, moll, pou i barca, amb l'estètica dels mapes
pintats de la campanya (Conyberry): tons apagats d'aquarel·la i tinta fosca, no els verds
saturats del paquet.

    python3 scripts/oryx-village.py              # escriu el full
    python3 scripts/oryx-village.py --sheet x    # a més, el full sobre fons per revisar-lo

Mida de píxel: la del paquet. Tot es dibuixa a 24 px per casella (l'art de `uf_terrain.png`
és de 24 px ampliat ×2) i s'amplia ×2 sense suavitzar al final.

Criteri:
  - colors: rampes de 5 tons (fosc → clar) mesurades a la pintura de Conyberry (`RAMPS`);
    les terres del paquet (herba, terra clara, aigua) hi es passen amb un mapa de gradient,
    o sigui que conserven la textura de l'autor;
  - forma: llum de dalt a l'esquerra i ombra al terra cap a baix a la dreta, SENSE contorn (com tot
    el paquet: figuretes, roques, bardissa i parets es defineixen pel to fosc del seu propi color);
  - fullatge: grups de fulles a l'atzar i solapats amb la textura de la bardissa del paquet (res
    de graelles de boles ni de soroll fi: es veia fals);
  - transicions (camí, còdols, aigua sobre el que hi hagi a sota): graella dual (cada peça va
    a la cantonada de quatre caselles i es tria per quines són del terreny de sobre), amb vora
    irregular de soroll periòdic, així peces veïnes casen sempre.
Requereix Pillow i numpy (i, opcional, `pyoxipng`).
"""
import math, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'public', 'sprites', 'uf_terrain.png')
OUT = os.path.join(ROOT, 'public', 'sprites', 'uf_village.png')
A = 24          # píxels d'art per casella
COLS = 20

# To més fosc del mapa: no és cap contorn (no n'hi ha), és on van a parar els negres de les
# figuretes quan s'ajusten al mapa (`figureGrade` de les missions).
INK = (44, 36, 24)
SHADOW = (34, 30, 18)
RAMPS = {
    'grass': [(96, 98, 62), (124, 124, 84), (152, 149, 108), (178, 172, 132), (202, 196, 158)],
    'path':  [(146, 134, 102), (170, 160, 126), (193, 184, 150), (211, 202, 170), (228, 220, 190)],
    'sand':  [(140, 134, 110), (168, 162, 136), (192, 186, 160), (212, 207, 184), (230, 226, 206)],
    'leaf':  [(42, 46, 26), (66, 72, 42), (92, 98, 60), (122, 126, 84), (156, 156, 112)],
    'leaf2': [(38, 44, 30), (58, 68, 44), (82, 94, 62), (110, 120, 84), (142, 150, 110)],
    'stone': [(86, 84, 70), (122, 118, 100), (158, 154, 132), (190, 186, 164), (220, 216, 196)],
    'water': [(64, 84, 92), (84, 106, 112), (104, 128, 132), (130, 152, 152), (168, 182, 178)],
    'wood':  [(56, 42, 28), (86, 66, 44), (116, 92, 64), (148, 122, 90), (178, 156, 122)],
}

# ── ajudants ────────────────────────────────────────────────────────────────
def ramp(stops, x):
    x = np.clip(x, 0, 1) * (len(stops) - 1)
    i = np.minimum(x.astype(int), len(stops) - 2); f = (x - i)[..., None]
    s = np.array(stops, float)
    return s[i] * (1 - f) + s[i + 1] * f

def rgba(rgb, alpha=None):
    out = np.zeros(rgb.shape[:2] + (4,), np.uint8)
    out[..., :3] = np.clip(np.round(rgb), 0, 255)
    out[..., 3] = 255 if alpha is None else alpha
    return out

def over(dst, src, x=0, y=0):
    """Composa `src` (RGBA, uint8) a `dst` a (x, y), retallant a les vores."""
    h, w = src.shape[:2]; H, W = dst.shape[:2]
    x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, W), min(y + h, H)
    if x0 >= x1 or y0 >= y1: return
    s = src[y0 - y:y1 - y, x0 - x:x1 - x].astype(float); d = dst[y0:y1, x0:x1].astype(float)
    a = s[..., 3:4] / 255; da = d[..., 3:4] / 255
    oa = a + da * (1 - a)
    rgb = (s[..., :3] * a + d[..., :3] * da * (1 - a)) / np.maximum(oa, 1e-6)
    dst[y0:y1, x0:x1, :3] = np.round(rgb); dst[y0:y1, x0:x1, 3] = np.round(oa[..., 0] * 255)

def pnoise(seed, n=A, freq=4):
    """Soroll de valor periòdic (període `n`): les peces casen per totes les vores."""
    g = np.random.default_rng(seed).random((freq, freq))
    xs = np.arange(n) / n * freq; i0 = np.floor(xs).astype(int); f = xs - i0; f = f * f * (3 - 2 * f); i1 = (i0 + 1) % freq
    fy, fx = f[:, None], f[None, :]
    a, b, c, d = g[np.ix_(i0, i0)], g[np.ix_(i0, i1)], g[np.ix_(i1, i0)], g[np.ix_(i1, i1)]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

def fbm(seed, n=A):
    return pnoise(seed, n, 3) * 0.65 + pnoise(seed + 1, n, 6) * 0.35

def dilate(m):
    o = m.copy(); o[1:] |= m[:-1]; o[:-1] |= m[1:]; o[:, 1:] |= m[:, :-1]; o[:, :-1] |= m[:, 1:]; return o

def erode(m): return ~dilate(~m)

def lum(rgb): return (0.3 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2]) / 255

# ── terres ──────────────────────────────────────────────────────────────────
_src = None
def oryx(c, r):
    """Casella del full de terreny a escala d'art (24 px)."""
    global _src
    if _src is None: _src = Image.open(SRC).convert('RGBA')
    return np.array(_src.crop((c * 48, r * 48, c * 48 + 48, r * 48 + 48)).resize((A, A), Image.NEAREST)).astype(float)

def regrade(tiles, stops, lo_q=2, hi_q=98, span=(0.12, 0.88)):
    """Mapa de gradient d'un joc de peces a una rampa (rang de lluminositat comú a totes)."""
    L = [lum(t[..., :3]) for t in tiles]
    lo, hi = np.percentile(np.concatenate([l.ravel() for l in L]), [lo_q, hi_q])
    return [rgba(ramp(stops, span[0] + (l - lo) / max(hi - lo, 1e-6) * (span[1] - span[0]))) for l in L]

def pebbles(seed):
    rng = np.random.default_rng(seed)
    base = ramp(RAMPS['sand'], 0.42 + (fbm(seed) - 0.5) * 0.35)
    img = rgba(base)
    yy, xx = np.mgrid[0:A, 0:A] + 0.5
    for _ in range(16):
        px, py = rng.uniform(0, A, 2); rx = rng.uniform(1.2, 2.4); ry = rx * rng.uniform(0.7, 1.0)
        for ox in (-A, 0, A):
            for oy in (-A, 0, A):
                d = ((xx - px - ox) / rx) ** 2 + ((yy - py - oy) / ry) ** 2
                m = d < 1
                if not m.any(): continue
                t = 0.62 - (yy - py - oy) / ry * 0.22 - (xx - px - ox) / rx * 0.1
                col = ramp(RAMPS['stone'], t + rng.uniform(-0.08, 0.08))
                img[m, :3] = np.round(col[m])
                rim = dilate(m) & ~m & (yy > py + oy)
                img[rim, :3] = np.round(np.array(RAMPS['sand'][0]) * 0.92)
    return img

def floors():
    grass = regrade([oryx(c, 6) for c in (5, 6, 7, 8)], RAMPS['grass'], span=(0.3, 0.8))
    path = regrade([oryx(c, 7) for c in (5, 6, 7)], RAMPS['path'], span=(0.25, 0.85))
    dark = regrade([oryx(c, 6) for c in (5, 6, 7, 8)], RAMPS['grass'], span=(0.05, 0.5))
    return {'grass': grass, 'meadow': dark, 'path': path, 'sand': [pebbles(40 + i) for i in range(4)], 'water': water_frames()}

def water_frames(n=4):
    """Aigua quieta: taques suaus (quantitzades als tons de la rampa) i reflexos curts que llisquen."""
    W = RAMPS['water']
    base = pnoise(60, A, 6) * 0.6 + pnoise(61, A, 12) * 0.4
    lvl = np.digitize(base, [0.22, 0.8])
    pal = np.array([W[1], W[2], (W[2][0] + 6, W[2][1] + 6, W[2][2] + 5)], float)
    rng = np.random.default_rng(62)
    dashes = [(int(x), int(y), int(rng.integers(2, 4))) for x, y in ((3, 4), (15, 9), (8, 17), (19, 21))]
    frames = []
    for f in range(n):
        img = rgba(pal[lvl])
        for x, y, l in dashes:
            xs = (np.arange(l) + x + f) % A
            img[y, xs, :3] = W[4]; img[(y + 1) % A, xs, :3] = W[1]
        frames.append(img)
    return frames

def transition(tex, bits, seed, rim_out=(SHADOW, 0.18), rim_in=None, jitter=0.5):
    """
    Peça de graella dual: `bits` = cantonades del terreny de sobre (1 dalt-esq., 2 dalt-dreta,
    4 baix-dreta, 8 baix-esq.). Transparent on hi ha el de sota; la vora de fora s'enfosqueix.
    """
    TL, TR, BR, BL = [(bits >> k) & 1 for k in range(4)]
    P = A + 2
    u = (np.arange(P) - 1 + 0.5) / A; U, V = u[None, :], u[:, None]
    f = TL * (1 - U) * (1 - V) + TR * U * (1 - V) + BL * (1 - U) * V + BR * U * V
    nz = np.pad(fbm(seed), 1, mode='wrap') - 0.5
    inside = f + nz * jitter > 0.5
    out = np.zeros((P, P, 4), np.uint8)
    tt = np.pad(tex, ((1, 1), (1, 1), (0, 0)), mode='wrap')
    out[inside] = tt[inside]
    if rim_out:
        r = dilate(inside) & ~inside
        out[r, :3] = rim_out[0]; out[r, 3] = int(rim_out[1] * 255)
    if rim_in:
        r = inside & ~erode(inside)
        c = np.array(rim_in[0], float); a = rim_in[1]
        out[r, :3] = np.round(out[r, :3] * (1 - a) + c * a)
    return out[1:-1, 1:-1]

# ── arbres i roques ─────────────────────────────────────────────────────────
def vnoise(h, w, cell, seed):
    """Soroll de valor suau (no periòdic) amb cel·les de `cell` px: per a les masses de fulles."""
    rng = np.random.default_rng(seed)
    gh, gw = int(h / cell) + 3, int(w / cell) + 3
    g = rng.random((gh, gw))
    y = np.arange(h) / cell; x = np.arange(w) / cell
    y0 = y.astype(int); x0 = x.astype(int); fy = y - y0; fx = x - x0
    fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
    a = g[np.ix_(y0, x0)]; b = g[np.ix_(y0, x0 + 1)]; c = g[np.ix_(y0 + 1, x0)]; d = g[np.ix_(y0 + 1, x0 + 1)]
    fy = fy[:, None]; fx = fx[None, :]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

_leaf = None
def leaf_texture():
    """El fullatge del paquet (dalt de la bardissa, `uf_terrain` fila 22), en lluminositat 0..1."""
    global _leaf
    if _leaf is None:
        L = [lum(oryx(c, 22)[..., :3]) for c in (1, 4)]
        lo, hi = np.percentile(np.concatenate([l.ravel() for l in L]), [3, 97])
        _leaf = [np.clip((l - lo) / (hi - lo), 0, 1) for l in L]
    return _leaf

def canopy(size, R, seed, stops, clump=5.5, leafy=1.0):
    """
    Copa d'arbre (o roca) a l'estil del paquet: SENSE contorn ni línies (el paquet no en fa servir
    enlloc: la forma surt de l'ombrejat del seu propi color). Grups de fulles repartits a l'atzar,
    de mides diferents i molt solapats (els del mig damunt dels de fora: fa la cúpula), cadascun
    amb la llum de dalt a l'esquerra, i la textura de fulles de la bardissa del paquet per sobre.
    """
    rng = np.random.default_rng(seed)
    H = W = size
    cx, cy = size / 2 - R * 0.12, size / 2 - R * 0.16
    yy, xx = np.mgrid[0:H, 0:W] + 0.5
    t1, t2 = leaf_texture()
    oy, ox = rng.integers(0, A, 2); oy2, ox2 = rng.integers(0, A, 2)
    iy, ix = yy.astype(int), xx.astype(int)
    tex = 0.5 * t1[(iy + oy) % A, (ix + ox) % A] + 0.5 * t2[::-1, ::-1][(iy + oy2) % A, (ix + ox2) % A]
    # grups: a l'atzar amb una distància mínima (res de graella), mides variades
    pts = []
    for _ in range(4000):
        a = rng.uniform(0, 2 * math.pi); rr = R * math.sqrt(rng.uniform(0, 1)) * 0.9
        px, py = cx + math.cos(a) * rr, cy + math.sin(a) * rr
        r = clump * rng.uniform(0.75, 1.4) * (1.15 - 0.35 * rr / R)
        if rr + r > R * 1.02: r = R * 1.02 - rr
        if r < clump * 0.55: continue
        if any((px - qx) ** 2 + (py - qy) ** 2 < (0.62 * (r + qr)) ** 2 for qx, qy, qr in pts): continue
        pts.append((px, py, r))
    # dels de fora cap als del mig (els del mig queden a dalt de tot)
    pts.sort(key=lambda p: -np.hypot(p[0] - cx, p[1] - cy) + p[1] * 0.15)
    v = np.full((H, W), np.nan)
    for px, py, r in pts:
        dx, dy = (xx - px) / r, (yy - py) / r
        d2 = dx * dx + dy * dy
        m = d2 < 1
        # vora del grup trencada per la textura de fulles (no un cercle perfecte)
        m &= ~((d2 > 0.72) & (tex < 0.35 + 0.1 * (1 - leafy)))
        if not m.any(): continue
        nz = np.sqrt(np.clip(1 - d2, 0, 1))
        light = (-dx * 0.55 - dy * 0.7 + nz * 0.5)
        hgt = 1 - np.hypot(px - cx, py - cy) / R
        side = -((px - cx) * 0.55 + (py - cy) * 0.7) / R     # tota la copa: llum a dalt a l'esquerra
        v[m] = (light * 0.9 + hgt * 0.45 + side * 0.45 + (tex - 0.5) * 0.45 * leafy)[m]
    mask = ~np.isnan(v)
    mask = dilate(erode(mask)) & mask
    vv = np.where(mask, v, 0)
    cuts = np.percentile(vv[mask], [12, 33, 62, 87])
    lvl = np.digitize(vv, cuts)
    img = np.zeros((H, W, 4), np.uint8)
    pal = np.array(stops, np.uint8)
    img[mask, :3] = pal[lvl[mask]]; img[mask, 3] = 255
    out = np.zeros((H, W, 4), np.uint8)
    sx, sy = int(round(R * 0.22)) + 1, int(round(R * 0.3)) + 1
    sm = np.zeros_like(mask); sm[sy:, sx:] = mask[:H - sy, :W - sx]
    out[sm, :3] = SHADOW; out[sm, 3] = int(0.34 * 255)
    over(out, img)
    return out

def rock(R, seed, flat=0.75):
    """Roca llisa com les del paquet: sense contorn, llum a dalt, costats foscos i una esquerda."""
    rng = np.random.default_rng(seed)
    H = W = A
    cx, cy = A / 2 - 1, A / 2 - 1
    yy, xx = np.mgrid[0:H, 0:W] + 0.5
    ang = np.arctan2(yy - cy, xx - cx)
    rad = R * (1 + sum(rng.uniform(0.04, 0.09) * np.cos(k * ang + rng.uniform(0, 6.3)) for k in (2, 3)))
    dx, dy = (xx - cx) / rad, (yy - cy) / (rad * flat)
    d2 = dx * dx + dy * dy
    mask = d2 < 1
    nz = np.sqrt(np.clip(1 - d2, 0, 1))
    v = -dx * 0.45 - dy * 0.75 + nz * 0.9
    cuts = np.percentile(v[mask], [14, 36, 66, 90])
    lvl = np.digitize(v, cuts)
    # esquerda: un traç curt d'un to fosc
    k = rng.integers(0, 2)
    for i in range(int(R)):
        x = int(cx - R * 0.3 + i * 0.6); y = int(cy - R * 0.2 + i * (0.35 if k else -0.2))
        if 0 <= x < W and 0 <= y < H and mask[y, x]: lvl[y, x] = max(0, lvl[y, x] - 2)
    img = np.zeros((H, W, 4), np.uint8)
    pal = np.array(RAMPS['stone'], np.uint8)
    img[mask, :3] = pal[lvl[mask]]; img[mask, 3] = 255
    out = np.zeros((H, W, 4), np.uint8)
    sm = np.zeros_like(mask); sm[2:, 2:] = mask[:-2, :-2]
    out[sm, :3] = SHADOW; out[sm, 3] = 90
    over(out, img)
    return out

def trees():
    T = {}
    T['bush'] = [canopy(A, 9, 100 + i, RAMPS['leaf'], clump=4.2) for i in range(4)]
    T['tree_m'] = [canopy(2 * A, 18, 200 + i, RAMPS['leaf' if i % 2 else 'leaf2'], clump=5.2) for i in range(4)]
    T['tree_l'] = [canopy(3 * A, 28, 300 + i, RAMPS['leaf' if i % 2 == 0 else 'leaf2'], clump=6.2) for i in range(4)]
    T['tree_xl'] = [canopy(4 * A, 39, 400 + i, RAMPS['leaf'], clump=7.2) for i in range(2)]
    T['rock'] = [rock(5.5 + i % 2 * 2, 500 + i) for i in range(4)]
    return T

# ── tanques i murs (4 bits: 1 amunt, 2 dreta, 4 avall, 8 esquerra) ──────────
def fence(bits):
    img = np.zeros((A, A, 4), np.uint8)
    W = RAMPS['wood']
    def rect(x0, y0, x1, y1, col, a=255):
        img[y0:y1, x0:x1, :3] = col; img[y0:y1, x0:x1, 3] = a
    c = A // 2
    # ombres
    if bits & 2: rect(c, 13, A, 14, SHADOW, 80); rect(c, 17, A, 18, SHADOW, 80)
    if bits & 8: rect(0, 13, c, 14, SHADOW, 80); rect(0, 17, c, 18, SHADOW, 80)
    if bits & 4: rect(c + 1, c, c + 3, A, SHADOW, 80)
    if bits & 1: rect(c + 1, 0, c + 3, c, SHADOW, 80)
    for y in (10, 14):  # dos travessers
        # travesser: cara de dalt clara, cara del davant fosca (sense contorn: el paquet no en fa)
        if bits & 2: rect(c, y, A, y + 1, W[3]); rect(c, y + 1, A, y + 2, W[1]); rect(c, y + 2, A, y + 3, W[0])
        if bits & 8: rect(0, y, c, y + 1, W[3]); rect(0, y + 1, c, y + 2, W[1]); rect(0, y + 2, c, y + 3, W[0])
    if bits & 1: rect(c - 1, 0, c, c, W[3]); rect(c, 0, c + 1, c, W[1]); rect(c + 1, 0, c + 2, c, W[0])
    if bits & 4: rect(c - 1, c, c, A, W[3]); rect(c, c, c + 1, A, W[1]); rect(c + 1, c, c + 2, A, W[0])
    # pal: cap clar, costat il·luminat i costat fosc
    rect(c - 2, 8, c + 2, 18, W[2]); rect(c - 2, 8, c + 2, 9, W[4]); rect(c - 2, 9, c - 1, 18, W[3]); rect(c + 1, 9, c + 2, 18, W[0]); rect(c, 9, c + 1, 18, W[1])
    rect(c + 2, 17, c + 4, 19, SHADOW, 90)
    return img

def _stone(img, x, y, rx, ry, rng):
    yy, xx = np.mgrid[0:A, 0:A] + 0.5
    d = ((xx - x) / rx) ** 2 + ((yy - y) / ry) ** 2
    m = d < 1
    if not m.any(): return
    t = 0.66 - (yy - y) / ry * 0.32 - (xx - x) / rx * 0.08 + rng.uniform(-0.06, 0.06)
    col = ramp(RAMPS['stone'], t)
    sh = np.zeros_like(m); sh[2:, 1:] = m[:-2, :-1]
    s = sh & ~m & (img[..., 3] < 255)
    img[s, :3] = SHADOW; img[s, 3] = np.maximum(img[s, 3], 90)
    # vora de baix a la dreta del to més fosc de la pedra (la junta); la de dalt, sense res
    edge = m & ~erode(m) & ((xx - x) * 0.4 + (yy - y) * 0.9 > -0.3 * ry)
    img[m, :3] = np.round(col[m]); img[m, 3] = 255
    img[edge, :3] = RAMPS['stone'][0]

def stonewall(bits):
    """Mur de pedra seca: cadena de pedres del centre cap a cada veí (les de la vora casen)."""
    img = np.zeros((A, A, 4), np.uint8)
    c = A / 2
    pts = [(c, c, 0)]
    for k, (dx, dy) in enumerate(((0, -1), (1, 0), (0, 1), (-1, 0))):
        if bits & (1 << k):
            for s in (4, 8, 12): pts.append((c + dx * s, c + dy * s, k * 10 + s))
    for x, y, key in sorted(pts, key=lambda p: p[1]):
        rng = np.random.default_rng(int(round(x)) * 31 + int(round(y)) * 7 + 3)   # mateixa pedra a les dues bandes d'una vora
        offs = ((-1.5, -3.6), (1.8, 3.4), (0.0, -0.2)) if bits & 10 else ((-3.6, -1.5), (3.4, 1.8), (-0.2, 0.0))
        if not bits & 15: offs = ((-2.5, -2.0), (2.5, 2.0), (0.0, -0.2))
        for ox, oy in sorted(offs, key=lambda o: o[1]):
            _stone(img, x + ox + rng.uniform(-0.6, 0.6), y + oy + rng.uniform(-0.6, 0.6), rng.uniform(3.6, 4.4), rng.uniform(3.0, 3.6), rng)
    return img

# ── objectes ────────────────────────────────────────────────────────────────
def dock():
    W = RAMPS['wood']; img = np.zeros((A, A, 4), np.uint8); img[..., 3] = 255
    for i in range(0, A, 6):
        img[:, i:i + 6, :3] = W[2]; img[:, i, :3] = W[0]; img[:, i + 1, :3] = W[3]; img[:, i + 5, :3] = W[1]
        for j in range(3 + i % 7, A, 9): img[j, i + 1:i + 5, :3] = W[1]
    return img

def well():
    img = np.zeros((A, A, 4), np.uint8)
    yy, xx = np.mgrid[0:A, 0:A] + 0.5; c = A / 2
    d = np.hypot(xx - c, yy - c - 1)
    sh = np.hypot(xx - c - 2, yy - c - 3) < 10.5
    img[sh, :3] = SHADOW; img[sh, 3] = 90
    ring = (d < 10) & (d >= 5.5)
    ang = np.arctan2(yy - c, xx - c)
    t = 0.6 - (yy - c) / 10 * 0.3 + (np.floor(ang / (math.pi / 6)) % 2) * 0.12
    img[ring, :3] = np.round(ramp(RAMPS['stone'], t)[ring]); img[ring, 3] = 255
    joints = ring & (np.abs(((ang + math.pi) / (math.pi / 6)) % 1 - 0.5) > 0.44)
    img[joints, :3] = RAMPS['stone'][0]
    inner = d < 5.5
    img[inner, :3] = RAMPS['water'][0]; img[inner, 3] = 255
    img[(d < 3.5) & (yy < c), :3] = RAMPS['water'][1]
    edge = (d < 10) & (d >= 9.2) & (yy > c)          # cara de fora, a la banda de l'ombra
    img[edge, :3] = RAMPS['stone'][0]
    lip = (d < 6.4) & (d >= 5.5) & (yy < c + 1)      # vora de dins, a l'ombra de la paret
    img[lip, :3] = RAMPS['stone'][1]
    W = RAMPS['wood']   # travesser del torn
    img[int(c) - 1:int(c) + 1, 3:A - 3, :3] = W[3]; img[int(c) + 1, 3:A - 3, :3] = W[0]; img[int(c) - 2, 3:A - 3, :3] = W[4]
    img[int(c) - 2:int(c) + 2, 3:A - 3, 3] = 255
    return img

def boat():
    H, W = A, 2 * A
    img = np.zeros((H, W, 4), np.uint8)
    yy, xx = np.mgrid[0:H, 0:W] + 0.5
    cx, cy = W / 2, H / 2
    hull = (np.abs((yy - cy) / 6.5) ** 2 + np.abs((xx - cx) / 19) ** 1.6) < 1
    inner = (np.abs((yy - cy) / 4.5) ** 2 + np.abs((xx - cx) / 16) ** 1.6) < 1
    sh = np.zeros_like(hull); sh[2:, 2:] = hull[:-2, :-2]
    img[sh, :3] = SHADOW; img[sh, 3] = 100
    Wd = RAMPS['wood']
    img[hull, :3] = Wd[3]; img[hull, 3] = 255
    img[inner, :3] = Wd[1]
    img[inner & (yy < cy - 1), :3] = Wd[2]
    for x in (cx - 7, cx + 5): img[inner & (np.abs(xx - x) < 1.5), :3] = Wd[4]
    img[hull & ~erode(hull) & (yy > cy), :3] = Wd[1]
    img[inner & ~erode(inner), :3] = Wd[0]
    return img

# ── teulades (es dibuixen per rectangle, no són peces del full) ─────────────
ROOFS = {
    'red':   [(58, 36, 30), (98, 58, 44), (130, 80, 60), (158, 106, 82), (186, 140, 112)],
    'brown': [(52, 42, 30), (82, 68, 50), (110, 94, 70), (138, 122, 94), (168, 152, 120)],
}
PLASTER = [(150, 140, 116), (196, 186, 158)]

def roof(canvas, x0, y0, x1, y1, kind='red', seed=0):
    """Casa vista de dalt dins del rectangle (px d'art): teulada a dues aigües + façana a baix."""
    R = ROOFS[kind]; Wd = RAMPS['wood']; rng = np.random.default_rng(seed)
    w, h = x1 - x0, y1 - y0
    F = max(4, min(6, h // 5))
    sh = np.zeros((h + 3, w + 3, 4), np.uint8); sh[3:, 3:, :3] = SHADOW; sh[3:, 3:, 3] = 95
    over(canvas, sh, x0, y0)
    img = np.zeros((h, w, 4), np.uint8); img[..., 3] = 255
    # façana: arrebossat, entramat de fusta, porta i finestres
    fy = h - F
    img[fy:, :, :3] = PLASTER[1]; img[fy, :, :3] = PLASTER[0]
    for x in range(2, w - 1, 6): img[fy:, x, :3] = Wd[1]
    img[fy + F // 2, :, :3] = Wd[1]
    dx = w // 2 - 2
    img[fy + 1:, dx:dx + 4, :3] = Wd[0]; img[fy + 1:, dx + 1:dx + 3, :3] = Wd[1]
    for x in range(4, w - 4, 8):
        if abs(x - dx) > 4: img[fy + 1:fy + 3, x:x + 2, :3] = Wd[0]
    # teulada: files de teules d'amplada variable, desplaçades a l'atzar, amb alguna teula més clara
    # o més fosca i taques de desgast (soroll). Res de patró regular de rajola.
    rh = fy
    horiz = w >= rh
    span, length = (rh, w) if horiz else (w, rh)
    wear = vnoise(span, length, 6, seed + 7)
    grid = np.zeros((span, length), int)
    for row in range(0, span, 3):
        lit = row + 1 < span / 2
        base = 4 if lit else 2
        b = -int(rng.integers(0, 5))
        while b < length:
            wdt = int(rng.integers(3, 7))
            k = base + (1 if rng.random() < 0.08 else -1 if rng.random() < 0.18 else 0)
            for a in range(row, min(row + 3, span)):
                for x in range(max(b, 0), min(b + wdt, length)):
                    kk = k - (1 if (a == row and rng.random() > 0.12) else 0)   # junta de la fila (trencada)
                    if wear[a, x] > 0.72: kk -= 1                                # desgast
                    grid[a, x] = kk
            if 0 <= b < length: grid[row + 1:min(row + 3, span), b] = k - 1     # junta entre teules
            b += wdt
    grid = np.clip(grid, 0, 4)
    pal = np.array(R, np.uint8)
    for a in range(span):
        for x in range(length):
            y_, x_ = (a, x) if horiz else (x, a)
            img[y_, x_, :3] = pal[grid[a, x]]
    if horiz:
        m = rh // 2; img[m - 1:m + 1, :, :3] = R[4]; img[m + 1, :, :3] = R[0]
    else:
        m = w // 2; img[:rh, m - 1:m + 1, :3] = R[4]; img[:rh, m + 1, :3] = R[0]
    # ràfec: la vora de baix de la teulada fa ombra a la façana (del to més fosc, sense contorn)
    img[rh - 1, :, :3] = R[0]
    if horiz: img[:rh, -1, :3] = R[1]
    else: img[rh // 2:rh, :, :3] = img[rh // 2:rh, :, :3]
    # xemeneia
    if w > 10 and rh > 10:
        cx = x0 * 0 + int(w * 0.25); cy = 2 if horiz else int(rh * 0.25)
        img[cy:cy + 5, cx:cx + 4, :3] = RAMPS['stone'][2]; img[cy:cy + 1, cx:cx + 4, :3] = RAMPS['stone'][4]
        img[cy + 1:cy + 2, cx + 1:cx + 3, :3] = RAMPS['stone'][0]
        img[cy:cy + 5, cx + 3, :3] = RAMPS['stone'][1]; img[cy + 5, cx:cx + 4, :3] = R[0]
    over(canvas, img, x0, y0)

# ── full ────────────────────────────────────────────────────────────────────
# Lloc de cada cosa al full (fila, columna; `size` = caselles d'ample de cada variant).
# ⚠️ El codi de l'app (`lib/tilemap/palette.ts`) llegeix aquestes posicions.
LAYOUT = {
    'floors': {'grass': (0, 0), 'meadow': (0, 4), 'path': (0, 8), 'sand': (0, 11), 'water': (0, 15)},
    'overlays': {'path': 1, 'sand': 2, 'water': 3, 'meadow': 4},
    'fence': 5, 'wall': 6,
    'objects': {'bush': (7, 0, 1), 'rock': (7, 4, 1), 'tree_m': (8, 0, 2), 'tree_l': (10, 0, 3), 'tree_xl': (13, 0, 4)},
    'dock': (7, 8), 'well': (7, 9), 'boat': (7, 10),
}
ROWS_SHEET = 17

def build():
    F = floors(); Tr = trees()
    sheet = np.zeros((ROWS_SHEET * A, COLS * A, 4), np.uint8)
    def put(img, c, r): sheet[r * A:r * A + img.shape[0], c * A:c * A + img.shape[1]] = img
    for key, (r, c0) in LAYOUT['floors'].items():
        for i, t in enumerate(F[key]): put(t, c0 + i, r)
    OVER = overlays(F)
    for key, r in LAYOUT['overlays'].items():
        for b in range(1, 16): put(OVER[key][b], b, r)
    for b in range(16): put(fence(b), b, LAYOUT['fence']); put(stonewall(b), b, LAYOUT['wall'])
    for key, (r, c0, size) in LAYOUT['objects'].items():
        for i, t in enumerate(Tr[key]): put(t, c0 + i * size, r)
    r, c = LAYOUT['dock']; put(dock(), c, r)
    r, c = LAYOUT['well']; put(well(), c, r)
    r, c = LAYOUT['boat']; put(boat(), c, r)
    return sheet, F, Tr, OVER

def overlays(F):
    return {
        'path': {b: transition(F['path'][0], b, 11, rim_out=(SHADOW, 0.14)) for b in range(16)},
        'sand': {b: transition(F['sand'][0], b, 12, rim_out=(SHADOW, 0.12)) for b in range(16)},
        'water': {b: transition(F['water'][0], b, 13, rim_out=(RAMPS['water'][0], 0.5), rim_in=((214, 218, 204), 0.55), jitter=0.35) for b in range(16)},
        'meadow': {b: transition(F['meadow'][0], b, 14, rim_out=None, jitter=0.7) for b in range(16)},
    }

def x2(arr): return Image.fromarray(arr, 'RGBA').resize((arr.shape[1] * 2, arr.shape[0] * 2), Image.NEAREST)

def main():
    sheet, *_ = build()
    x2(sheet).save(OUT, optimize=True)
    try:
        import oxipng; oxipng.optimize(OUT, level=4)
    except ImportError:
        pass
    print('full de poble →', os.path.relpath(OUT, ROOT))
    if '--sheet' in sys.argv:
        im = x2(sheet); bg = Image.new('RGBA', im.size, (60, 64, 50, 255)); bg.alpha_composite(im)
        bg.save(sys.argv[sys.argv.index('--sheet') + 1])

if __name__ == '__main__':
    main()
