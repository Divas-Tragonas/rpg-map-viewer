#!/usr/bin/env python3
"""
Peces d'interior de l'app Píxel (cases enrunades, farga, capella, hostal…), amb l'estètica del
full de poble (`scripts/oryx-village.py`): les mateixes rampes apagades, llum de dalt a l'esquerra,
ombra al terra cap a baix a la dreta i SENSE contorns (com tot el paquet).

No escriu cap full: el fan servir els scripts dels llocs de les missions
(`scripts/mission-conyberry-llocs.py`). Per revisar les peces:

    python3 scripts/oryx-interiors.py --sheet /tmp/interiors.png

Escala: 24 px d'art per casella (×2 al final, com el poble). Cada peça retorna una imatge RGBA
amb l'ombra inclosa a la dreta i a baix; es col·loca per la cantonada de dalt a l'esquerra de la
seva planta. Les peces del paquet (bóta, cofre, taules, canelobres, teranyines, ossos, làpides,
estàtua…) es passen per un mapa de gradient a les rampes del poble, com les terres del poble.
"""
import importlib.util, math, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
_spec = importlib.util.spec_from_file_location('village', os.path.join(HERE, 'oryx-village.py'))
V = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(V)
A, SHADOW, INK = V.A, V.SHADOW, V.INK
ramp, rgba, over, dilate, erode, lum, vnoise = V.ramp, V.rgba, V.over, V.dilate, V.erode, V.lum, V.vnoise

R = dict(V.RAMPS)
R.update({
    # tapa de les parets (el gruix de la paret vist des de dalt): fosc però no negre
    'cap':     [(40, 34, 26), (52, 45, 34), (64, 56, 43), (78, 69, 53), (96, 86, 67)],
    'plaster': [(118, 108, 86), (146, 136, 112), (172, 162, 136), (192, 182, 154), (210, 202, 176)],
    'wood_dk': [(40, 30, 20), (58, 44, 30), (80, 62, 42), (104, 82, 58), (130, 106, 76)],
    'straw':   [(108, 90, 48), (140, 118, 66), (170, 148, 90), (196, 176, 116), (220, 204, 146)],
    'metal':   [(42, 44, 46), (66, 68, 70), (94, 96, 96), (126, 126, 122), (162, 160, 152)],
    'rust':    [(66, 40, 28), (98, 60, 38), (128, 82, 52), (154, 108, 72), (180, 138, 98)],
    'bronze':  [(66, 52, 30), (102, 80, 44), (138, 112, 62), (170, 144, 88), (200, 178, 124)],
    'red':     [(68, 36, 32), (96, 52, 44), (122, 70, 58), (146, 96, 80), (172, 128, 108)],
    'blue':    [(40, 48, 60), (58, 68, 82), (80, 90, 104), (106, 116, 126), (140, 148, 152)],
    'green':   [(44, 52, 36), (62, 72, 50), (84, 94, 66), (110, 118, 88), (142, 148, 116)],
    'ochre':   [(84, 64, 34), (116, 92, 50), (146, 120, 70), (172, 148, 96), (198, 178, 128)],
    'dry':     [(58, 46, 30), (84, 68, 44), (110, 92, 62), (138, 118, 84), (166, 148, 110)],
    'ash':     [(38, 36, 34), (60, 58, 54), (86, 84, 78), (116, 112, 104), (148, 144, 134)],
    'paper':   [(148, 138, 110), (174, 164, 136), (198, 190, 162), (216, 210, 184), (230, 226, 204)],
    'leather': [(54, 38, 28), (78, 56, 40), (102, 76, 54), (128, 100, 74), (154, 128, 98)],
})
VOID = (24, 21, 16)

# ── ajudants de dibuix ───────────────────────────────────────────────────────
def img(w, h): return np.zeros((h, w, 4), np.uint8)

def fill(im, x0, y0, x1, y1, col, a=255):
    H, W = im.shape[:2]
    x0, y0, x1, y1 = max(int(x0), 0), max(int(y0), 0), min(int(x1), W), min(int(y1), H)
    if x0 >= x1 or y0 >= y1: return
    im[y0:y1, x0:x1, :3] = col; im[y0:y1, x0:x1, 3] = a

def put(im, mask, col, a=255):
    im[mask, :3] = col; im[mask, 3] = a

def ellipse(h, w, cx, cy, rx, ry):
    yy, xx = np.mgrid[0:h, 0:w] + 0.5
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 < 1

def shadowed(src, dx=2, dy=2, a=90):
    """Afegeix l'ombra al terra (cap a baix a la dreta) d'una peça: la imatge creix dx, dy."""
    h, w = src.shape[:2]
    out = img(w + dx, h + dy)
    m = src[..., 3] > 0
    sm = np.zeros((h + dy, w + dx), bool); sm[dy:, dx:] = m
    put(out, sm, SHADOW, a)
    over(out, src)
    return out

def shade_blob(mask, stops, seed=0, tex=0.0, cuts=(14, 36, 66, 90), light=(-0.45, -0.75)):
    """Volum arrodonit (sense contorn): llum de dalt a l'esquerra quantitzada a la rampa."""
    h, w = mask.shape
    yy, xx = np.mgrid[0:h, 0:w] + 0.5
    ys, xs = np.nonzero(mask)
    cy, cx = ys.mean() + 0.5, xs.mean() + 0.5
    ry, rx = max(np.ptp(ys), 1) / 2 + 0.5, max(np.ptp(xs), 1) / 2 + 0.5
    dx, dy = (xx - cx) / rx, (yy - cy) / ry
    v = dx * light[0] + dy * light[1] + np.sqrt(np.clip(1 - dx * dx - dy * dy, 0, 1)) * 0.9
    if tex: v = v + (vnoise(h, w, 2, seed) - 0.5) * tex
    c = np.percentile(v[mask], cuts)
    lvl = np.digitize(v, c)
    out = img(w, h)
    pal = np.array(stops, np.uint8)
    out[mask, :3] = pal[lvl[mask]]; out[mask, 3] = 255
    return out

def prism(w, d, stops, front=3, top_lvl=3, grain=None, seed=0, legs=0):
    """
    Caixa vista de dalt en 3/4: tapa de w×d i cara del davant de `front` px (més fosca). Vora
    de dalt i esquerra un to més clara, la dreta un to més fosca. `grain` = 'h' o 'v' (taulons).
    """
    rng = np.random.default_rng(seed)
    S = stops
    im = img(w, d + front + legs)
    fill(im, 0, 0, w, d, S[top_lvl])
    if grain:
        if grain == 'h':
            for y in range(3, d - 1, 4):
                fill(im, 0, y, w, y + 1, S[top_lvl - 1])
                for _ in range(max(1, w // 10)):
                    x = int(rng.integers(0, max(w - 1, 1))); fill(im, x, y - 3, x + 1, y, S[top_lvl - 1])
        else:
            for x in range(4, w - 1, 5):
                fill(im, x, 0, x + 1, d, S[top_lvl - 1])
    fill(im, 0, 0, w, 1, S[min(top_lvl + 1, 4)]); fill(im, 0, 0, 1, d, S[min(top_lvl + 1, 4)])
    fill(im, w - 1, 1, w, d, S[top_lvl - 1])
    fill(im, 0, d, w, d + front, S[max(top_lvl - 2, 0)])
    if front > 1: fill(im, 0, d + front - 1, w, d + front, S[0])
    if legs:
        fill(im, 1, d + front, 3, d + front + legs, S[0]); fill(im, w - 3, d + front, w - 1, d + front + legs, S[0])
    return im

# ── peces del paquet passades a les rampes del poble ─────────────────────────
def oryx_piece(c, r, stops, span=(0.12, 0.92), keep_alpha=0.0):
    """Peça de `uf_terrain.png` (24 px d'art) amb un mapa de gradient a la rampa, conservant l'alfa."""
    t = V.oryx(c, r)
    a = t[..., 3]
    m = a > 10
    L = lum(t[..., :3])
    lo, hi = np.percentile(L[m], [2, 98]) if m.any() else (0, 1)
    v = span[0] + (L - lo) / max(hi - lo, 1e-6) * (span[1] - span[0])
    out = rgba(ramp(stops, v), np.where(m, a if keep_alpha else 255, 0).astype(np.uint8))
    if keep_alpha: out[..., 3] = (a * keep_alpha).astype(np.uint8)
    return out

_items = None
def item(c, r, sat=0.45, dark=0.9):
    """Objecte petit de `uf_items.png` (llibre, poció, clau…) a 1:1, menys saturat i retallat."""
    global _items
    if _items is None: _items = Image.open(os.path.join(V.ROOT, 'public', 'sprites', 'uf_items.png')).convert('RGBA')
    t = np.array(_items.crop((c * 48, r * 48, c * 48 + 48, r * 48 + 48)).resize((A, A), Image.NEAREST)).astype(float)
    g = lum(t[..., :3])[..., None] * 255
    t[..., :3] = (g + (t[..., :3] - g) * sat) * dark + np.array(R['ochre'][2]) * (1 - dark) * 0.5
    t = np.clip(t, 0, 255).astype(np.uint8)
    # l'ombra del full (gris semitransparent a sota) fora: ja en posem nosaltres
    t[(t[..., 3] < 250)] = 0
    ys, xs = np.nonzero(t[..., 3])
    return t[ys.min():ys.max() + 1, xs.min():xs.max() + 1] if len(ys) else t

def trim(im):
    ys, xs = np.nonzero(im[..., 3])
    return im[ys.min():ys.max() + 1, xs.min():xs.max() + 1] if len(ys) else im

def barrel(): return shadowed(trim(oryx_piece(5, 31, R['wood'])))
def chest(): return shadowed(trim(oryx_piece(4, 31, R['wood'], span=(0.05, 0.85))))
def small_table(kind=12): return shadowed(trim(oryx_piece(kind, 31, R['wood'], span=(0.1, 0.85))))
def candelabra(): return shadowed(trim(oryx_piece(1, 31, R['bronze'], span=(0.05, 0.95))), 1, 1, 70)
def tombstone(broken=False): return shadowed(trim(oryx_piece(7 if broken else 6, 31, R['stone'], span=(0.1, 0.9))))
def statue(): return shadowed(trim(oryx_piece(8, 31, R['stone'], span=(0.05, 0.95))))
def coffin(): return shadowed(trim(oryx_piece(9, 31, R['wood_dk'], span=(0.1, 0.9))))
def cobweb(k=0):
    c = (6, 7, 8, 9, 10)[k % 5]
    t = trim(oryx_piece(c, 32, R['paper'], span=(0.5, 1.0), keep_alpha=0.75))
    return t
def bones(k=0): return trim(oryx_piece((11, 12, 13, 14)[k % 4], 32, R['paper'], span=(0.2, 0.95)))
def grindstone():
    w = trim(oryx_piece(15, 32, R['stone'], span=(0.1, 0.9)))
    return shadowed(w)
def puddle(k=0): return trim(oryx_piece((3, 4)[k % 2], 35, R['water'], span=(0.0, 0.7), keep_alpha=0.85))

# ── mobles ──────────────────────────────────────────────────────────────────
def table(w, d, seed=0, clutter=(), stops=None):
    """Taula llarga (w×d px d'art) amb el que hi hagi a sobre: 'plates', 'mugs', 'papers', 'book', 'candle', 'cloth'."""
    S = stops or R['wood']
    t = prism(w, d, S, front=3, grain='h', seed=seed, legs=3)
    rng = np.random.default_rng(seed + 9)
    if 'cloth' in clutter:
        C = R['red']; fill(t, 2, 1, w - 2, d - 1, C[2]); fill(t, 2, 1, w - 2, 2, C[3]); fill(t, w - 3, 2, w - 2, d - 1, C[1])
        fill(t, 3, d - 1, w - 3, d + 2, C[1])
    for k in clutter:
        n = max(2, w // 12)
        for i in range(n):
            x = int(4 + i * (w - 8) / max(n - 1, 1) + rng.integers(-1, 2)); y = int(rng.integers(2, max(d - 5, 3)))
            if k == 'plates':
                m = ellipse(5, 6, 3, 2.5, 3, 2.3); pl = img(6, 5); put(pl, m, R['paper'][3]); put(pl, ellipse(5, 6, 3, 2.5, 1.6, 1.1), R['paper'][2])
                over(t, pl, x - 3, y)
            elif k == 'mugs':
                if rng.random() < 0.6:
                    fill(t, x, y, x + 3, y + 3, R['wood_dk'][2]); fill(t, x, y, x + 3, y + 1, R['wood_dk'][4]); fill(t, x + 1, y + 1, x + 2, y + 2, R['wood_dk'][0])
            elif k == 'papers':
                px = int(rng.integers(2, max(w - 8, 3))); fill(t, px, y, px + 6, y + 5, R['paper'][3]); fill(t, px + 1, y + 1, px + 5, y + 2, R['paper'][1]); fill(t, px + 1, y + 3, px + 4, y + 4, R['paper'][1])
                break
    if 'book' in clutter:
        b = item(0, 1); over(t, b, w // 2 - b.shape[1] // 2, max(0, d // 2 - b.shape[0] // 2 - 1))
    if 'candle' in clutter:
        x = w - 6; fill(t, x, 2, x + 2, 6, R['paper'][4]); fill(t, x, 6, x + 3, 7, R['bronze'][1])
    if 'potion' in clutter:
        p = item(8, 0); over(t, p, 3, 1)
    return shadowed(t)

def bench(w, seed=0): return shadowed(prism(w, 5, R['wood'], front=2, grain='h', seed=seed, legs=2))

def stool(): return shadowed(prism(7, 6, R['wood'], front=2, legs=2), 1, 1)

def chair(flip=False):
    c = prism(8, 7, R['wood'], front=2, legs=2)
    back = img(8, 3); fill(back, 0, 0, 8, 3, R['wood'][1]); fill(back, 0, 0, 8, 1, R['wood'][3])
    out = img(8, 12); over(out, back, 0, 0); over(out, c, 0, 3)
    if flip: out = out[::-1].copy()
    return shadowed(out, 1, 1)

def tipped_chair():
    """Cadira bolcada: de costat, amb les potes enlaire."""
    out = img(11, 8)
    fill(out, 0, 3, 11, 6, R['wood'][2]); fill(out, 0, 3, 11, 4, R['wood'][3]); fill(out, 0, 5, 11, 6, R['wood'][1])
    for x in (1, 8): fill(out, x, 0, x + 2, 3, R['wood'][1])
    fill(out, 0, 6, 3, 8, R['wood'][1])
    return shadowed(out, 1, 1, 70)

def bed(cloth='red', seed=0, w=18, d=40, messy=True):
    S = R['wood']; C = R[cloth]; rng = np.random.default_rng(seed)
    b = prism(w, d, S, front=3, top_lvl=2)
    fill(b, 0, 0, w, 4, S[1]); fill(b, 0, 0, w, 1, S[3])                 # capçal
    # coixí
    m = ellipse(8, w - 4, (w - 4) / 2, 4, (w - 4) / 2, 3.6); pil = shade_blob(m, R['paper'], cuts=(10, 30, 60, 92)); over(b, pil, 2, 5)
    # manta amb plecs
    by = 14
    fill(b, 1, by, w - 1, d - 1, C[2]); fill(b, 1, by, w - 1, by + 2, C[3]); fill(b, 1, by + 2, w - 1, by + 3, C[1])
    for _ in range(4 if messy else 1):
        y = int(rng.integers(by + 5, d - 3)); x = int(rng.integers(2, w - 7))
        fill(b, x, y, x + int(rng.integers(4, 8)), y + 1, C[1]); fill(b, x, y - 1, x + 3, y, C[3])
    fill(b, w - 2, by, w - 1, d - 1, C[1])
    fill(b, 1, d - 1, w - 1, d + 2, C[1])
    return shadowed(b)

def cradle():
    b = prism(12, 16, R['wood'], front=3, top_lvl=2)
    fill(b, 2, 3, 10, 14, R['blue'][2]); fill(b, 2, 3, 10, 5, R['paper'][3])
    return shadowed(b)

def shelf(w, seed=0, kind='books', h=22):
    """Prestatgeria contra la paret del nord (puja per damunt de la casella: col·locar-la a y−h+A)."""
    S = R['wood_dk']; rng = np.random.default_rng(seed)
    im = img(w, h)
    fill(im, 0, 0, w, h, S[1]); fill(im, 0, 0, w, 2, S[3]); fill(im, 0, 0, 1, h, S[2]); fill(im, w - 1, 0, w, h, S[0])
    rows = [3, 9, 15]
    for y0 in rows:
        fill(im, 1, y0 + 5, w - 1, y0 + 6, S[3])           # lleixa
        x = 2
        while x < w - 2:
            if kind == 'books':
                bw = int(rng.integers(1, 3)); hh = int(rng.integers(3, 6))
                if rng.random() < 0.18: x += int(rng.integers(2, 5)); continue
                col = R[('red', 'blue', 'green', 'ochre', 'leather')[int(rng.integers(0, 5))]]
                fill(im, x, y0 + 5 - hh, x + bw, y0 + 5, col[int(rng.integers(1, 4))]); fill(im, x, y0 + 5 - hh, x + bw, y0 + 6 - hh, col[3])
                x += bw
            else:  # jars: gerros i olles
                if rng.random() < 0.3: x += 3; continue
                jw = int(rng.integers(3, 5)); col = R[('ochre', 'paper', 'green', 'rust')[int(rng.integers(0, 4))]]
                fill(im, x, y0 + 1, x + jw, y0 + 5, col[2]); fill(im, x, y0 + 1, x + jw, y0 + 2, col[4]); fill(im, x + jw - 1, y0 + 2, x + jw, y0 + 5, col[1])
                x += jw + 1
    return shadowed(im, 2, 1, 80)

def wardrobe(w=20):
    im = prism(w, 6, R['wood_dk'], front=18, top_lvl=3)
    fill(im, w // 2, 7, w // 2 + 1, 23, R['wood_dk'][0])
    fill(im, w // 2 - 3, 14, w // 2 - 2, 16, R['bronze'][3]); fill(im, w // 2 + 2, 14, w // 2 + 3, 16, R['bronze'][3])
    return shadowed(im)

def hearth(w=40, cold=True, seed=0, pot=False):
    """Llar de foc contra la paret del nord: marc de pedra, boca fosca amb cendra i tions."""
    S = R['stone']; rng = np.random.default_rng(seed)
    h = 26
    im = img(w, h)
    fill(im, 0, 0, w, h, S[2]); fill(im, 0, 0, w, 2, S[4]); fill(im, 0, 0, 2, h, S[3]); fill(im, w - 2, 0, w, h, S[1])
    for y in range(3, h, 5):          # filades de pedra
        fill(im, 0, y, w, y + 1, S[1])
        for x in range(int(rng.integers(0, 5)), w, 8): fill(im, x, y - 4 if y > 3 else 0, x + 1, y, S[1])
    bx0, bx1, by0 = 6, w - 6, 7
    fill(im, bx0, by0, bx1, h, (30, 26, 22))
    fill(im, bx0, by0, bx1, by0 + 2, (20, 18, 16))
    ash = ellipse(8, bx1 - bx0, (bx1 - bx0) / 2, 6, (bx1 - bx0) / 2 - 1, 4)
    a = img(bx1 - bx0, 8); put(a, ash, R['ash'][2]); put(a, ash & ellipse(8, bx1 - bx0, (bx1 - bx0) / 2 - 2, 5, (bx1 - bx0) / 3, 2.4), R['ash'][3])
    over(im, a, bx0, h - 8)
    for i in range(2):  # tions cremats
        x = bx0 + 4 + i * 8; fill(im, x, h - 6 + i, x + 9, h - 4 + i, (36, 30, 24)); fill(im, x, h - 6 + i, x + 9, h - 5 + i, (58, 48, 36))
    if not cold:
        fill(im, bx0 + 8, h - 5, bx0 + 12, h - 3, R['rust'][4])
    if pot:
        m = ellipse(9, 12, 6, 4.5, 6, 4.3); p = shade_blob(m, R['metal']); fill(p, 2, 1, 10, 3, (24, 22, 20))
        over(im, p, (w - 12) // 2, h - 12)
    return shadowed(im, 2, 1, 80)

def counter(w, d=10, seed=0):
    im = prism(w, d, R['wood'], front=8, top_lvl=3, grain='h', seed=seed)
    for x in range(3, w - 1, 6): fill(im, x, d + 1, x + 1, d + 7, R['wood'][0])
    return shadowed(im)

def keg_rack(n=3):
    w = n * 13 + 2
    im = img(w, 16)
    fill(im, 0, 12, w, 15, R['wood_dk'][1]); fill(im, 0, 12, w, 13, R['wood_dk'][3])
    for i in range(n):
        m = ellipse(14, 12, 6, 7, 6, 6.6); k = shade_blob(m, R['wood'], cuts=(10, 30, 62, 90))
        k[ellipse(14, 12, 6, 7, 3.4, 3.8)] = (*R['wood'][1], 255); k[ellipse(14, 12, 6, 7, 2, 2.4)] = (*R['wood'][3], 255)
        k[ellipse(14, 12, 6, 7, 5.8, 6.4) & ~ellipse(14, 12, 6, 7, 5, 5.6)] = (*R['metal'][2], 255)
        over(im, k, 1 + i * 13, 0)
    return shadowed(im)

def crate(seed=0, w=14, d=11):
    im = prism(w, d, R['wood'], front=6, top_lvl=3, grain='v', seed=seed)
    fill(im, 0, 2, w, 3, R['wood'][1]); fill(im, 0, d - 3, w, d - 2, R['wood'][1])
    return shadowed(im)

def sacks(n=2, seed=0):
    rng = np.random.default_rng(seed)
    im = img(10 + 8 * n, 14)
    for i in range(n):
        m = ellipse(12, 11, 5.5, 6.5, 5.2, 5.5) | ellipse(12, 11, 5.5, 2.5, 2, 2.4)
        s = shade_blob(m, R['paper'] if i % 2 else R['straw'], seed + i, tex=0.4)
        fill(s, 4, 3, 7, 4, R['leather'][1])
        over(im, s, i * 8 + int(rng.integers(0, 2)), int(rng.integers(0, 2)))
    return shadowed(trim(im), 2, 1)

def hay(w=30, h=20, seed=0, stops=None):
    rng = np.random.default_rng(seed)
    m = np.zeros((h, w), bool)
    for _ in range(6):
        cx, cy = rng.uniform(w * 0.25, w * 0.75), rng.uniform(h * 0.35, h * 0.65)
        m |= ellipse(h, w, cx, cy, rng.uniform(w * 0.2, w * 0.4), rng.uniform(h * 0.25, h * 0.4))
    im = shade_blob(m, stops or R['straw'], seed, tex=0.6)
    for _ in range(w * h // 14):     # palla: traços curts
        x, y = int(rng.integers(1, w - 4)), int(rng.integers(1, h - 2))
        if m[y, x] and m[y, min(x + 3, w - 1)]:
            k = int(rng.integers(2, 5)); col = (stops or R['straw'])[int(rng.integers(1, 5))]
            if rng.random() < 0.5: im[y, x:x + k, :3] = col
            else:
                for j in range(k):
                    if y + j < h and x + j < w and m[y + j, x + j]: im[y + j, x + j, :3] = col
    return shadowed(im, 2, 2, 80)

def straw_floor(w, h, seed=0):
    """Palla escampada pel terra (sense volum ni ombra)."""
    rng = np.random.default_rng(seed)
    im = img(w, h)
    for _ in range(w * h // 9):
        x, y = int(rng.integers(0, w - 3)), int(rng.integers(0, h))
        k = int(rng.integers(2, 5)); col = R['straw'][int(rng.integers(1, 4))]
        im[y, x:x + k, :3] = col; im[y, x:x + k, 3] = 255
    return im

def trough(w=30, water=True, stops=None):
    S = stops or R['wood']
    im = prism(w, 10, S, front=4, top_lvl=3)
    fill(im, 2, 2, w - 2, 8, (36, 44, 46) if water else R['straw'][2])
    if water: fill(im, 3, 3, w - 6, 4, R['water'][1])
    return shadowed(im)

def stall_board(length, vertical=True):
    """Envà baix de taulons (estables): una fila de taulons d'1 casella de gruix aparent."""
    S = R['wood']
    if vertical:
        im = img(6, length + 3)
        fill(im, 1, 0, 5, length, S[2]); fill(im, 1, 0, 2, length, S[3]); fill(im, 4, 0, 5, length, S[1])
        fill(im, 1, length, 5, length + 3, S[0])
        for y in range(4, length, 8): fill(im, 1, y, 5, y + 1, S[1])
        fill(im, 0, 0, 6, 3, S[3]); fill(im, 0, length - 3, 6, length, S[1])
    else:
        im = img(length, 8)
        fill(im, 0, 1, length, 4, S[3]); fill(im, 0, 4, length, 7, S[1]); fill(im, 0, 7, length, 8, S[0])
        for x in range(0, length, 12): fill(im, x, 0, x + 3, 8, S[2])
    return shadowed(im, 2, 2, 70)

def anvil(rusty=True, seed=0):
    """Enclusa rovellada sobre una soca: cos de ferro amb la banya a l'esquerra."""
    rng = np.random.default_rng(seed)
    im = img(32, 26)
    over(im, stump(seed), 7, 12)
    M = R['metal']; Ru = R['rust']
    yy, xx = np.mgrid[0:14, 0:30]
    body = np.zeros((14, 30), bool)
    body[0:5, 6:28] = True                                   # taula
    body[1:4, 0:7] = (np.abs(yy[1:4, 0:7] - 2) <= (xx[1:4, 0:7]) / 3)   # banya
    body[5:9, 11:22] = True                                  # cintura
    body[9:14, 8:25] = True                                  # peu
    a = img(30, 14)
    put(a, body, M[2])
    put(a, body & (yy == 0), M[4]); put(a, body & (yy == 1), M[3])
    put(a, body & (yy >= 3) & (yy <= 4), M[1]); put(a, body & (yy >= 5) & (yy <= 8), M[1]); put(a, body & (yy == 9), M[2]); put(a, body & (yy >= 10), M[1])
    put(a, body & (xx >= 26) & (yy < 5), M[1])
    if rusty:
        n = vnoise(14, 30, 3, seed + 5)
        rm = body & (n > 0.55)
        a[rm, :3] = np.array(Ru[2]); a[rm & (yy <= 1), :3] = Ru[3]; a[rm & (yy >= 3), :3] = Ru[1]
    over(im, a, 1, 2)
    return shadowed(trim(im))

def woodpile(w=44, seed=0):
    """Pila de llenya: troncs tallats vistos de cap (rodanxes) en dues fileres."""
    rng = np.random.default_rng(seed)
    im = img(w, 18)
    fill(im, 0, 12, w, 16, R['wood_dk'][1])
    for row, y in ((0, 7), (1, 1)):
        x = 1 + row * 3
        while x < w - 6:
            m = ellipse(8, 8, 4, 4, 3.6, 3.4); lg = img(8, 8); put(lg, m, R['wood'][3]); put(lg, m & ~ellipse(8, 8, 4, 4, 2.6, 2.4), R['wood'][1])
            put(lg, ellipse(8, 8, 4, 4, 0.9, 0.9), R['wood'][2])
            over(im, lg, x, y + int(rng.integers(0, 2))); x += 7
    return shadowed(trim(im))

def forge(w=48, h=40, seed=0):
    """Forn de la farga: bloc de pedra amb el clot de les brases (fred) i la campana de fums."""
    S = R['stone']; rng = np.random.default_rng(seed)
    im = img(w, h)
    top = prism(w, h - 8, S, front=8, top_lvl=2)
    for y in range(4, h - 8, 5): fill(top, 0, y, w, y + 1, S[1])
    for y in range(h - 8, h, 4): fill(top, 0, y, w, y + 1, S[0])
    over(im, top)
    pit = ellipse(16, 28, 14, 8, 13, 7)
    p = img(28, 16); put(p, pit, (30, 26, 22)); put(p, pit & ellipse(16, 28, 14, 9, 9, 4.5), R['ash'][1])
    for _ in range(14):
        x, y = int(rng.integers(5, 23)), int(rng.integers(4, 13))
        if pit[y, x]: p[y, x, :3] = R['ash'][int(rng.integers(0, 3))] if rng.random() < 0.85 else R['rust'][2]
    over(im, p, (w - 28) // 2, 6)
    return shadowed(im)

def bellows():
    m = ellipse(10, 18, 9, 5, 8.5, 4.6) | (np.mgrid[0:10, 0:18][1] > 15) & (np.abs(np.mgrid[0:10, 0:18][0] - 5) < 2)
    b = shade_blob(m, R['leather'])
    fill(b, 0, 3, 4, 7, R['wood'][2]); fill(b, 0, 3, 4, 4, R['wood'][4])
    return shadowed(b)

def coal(w=18, h=10, seed=0):
    rng = np.random.default_rng(seed)
    m = ellipse(h, w, w / 2, h / 2, w / 2 - 0.5, h / 2 - 0.5)
    im = shade_blob(m, [(26, 24, 22), (36, 34, 30), (50, 48, 44), (66, 64, 58), (88, 86, 80)], seed, tex=1.2)
    return shadowed(im, 1, 1, 70)

def scrap(seed=0, n=7):
    rng = np.random.default_rng(seed)
    im = img(22, 14)
    for _ in range(n):
        x, y = int(rng.integers(0, 18)), int(rng.integers(0, 11)); k = int(rng.integers(2, 6))
        M = R['rust'] if rng.random() < 0.7 else R['metal']
        if rng.random() < 0.5: fill(im, x, y, x + k, y + 2, M[2]); fill(im, x, y, x + k, y + 1, M[3])
        else: fill(im, x, y, x + 2, y + k, M[2]); fill(im, x, y, x + 1, y + k, M[3])
    return shadowed(im, 1, 1, 70)

def tool_rack(w=30):
    """Eines penjades a la paret (cara de la paret): tenalles, martells, una serra."""
    im = img(w, 14)
    fill(im, 0, 1, w, 3, R['wood_dk'][2]); fill(im, 0, 1, w, 2, R['wood_dk'][4])
    M = R['metal']
    for i, x in enumerate(range(3, w - 3, 6)):
        k = i % 3
        if k == 0: fill(im, x, 3, x + 1, 12, M[2]); fill(im, x + 2, 3, x + 3, 12, M[1]); fill(im, x, 11, x + 3, 13, M[3])
        elif k == 1: fill(im, x + 1, 3, x + 2, 11, R['wood'][2]); fill(im, x - 1, 10, x + 4, 13, M[2]); fill(im, x - 1, 10, x + 4, 11, M[4])
        else: fill(im, x, 3, x + 4, 5, M[3]); fill(im, x + 1, 5, x + 3, 12, R['rust'][2])
    return im

def wheel(r=9, broken=False, seed=0):
    s = 2 * r + 1
    yy, xx = np.mgrid[0:s, 0:s] + 0.5
    d = np.hypot(xx - s / 2, yy - s / 2)
    im = img(s, s)
    put(im, (d < r) & (d >= r - 2), R['wood'][2]); put(im, (d < r) & (d >= r - 0.8) & (yy < s / 2), R['wood'][4])
    ang = np.arctan2(yy - s / 2, xx - s / 2)
    for k in range(6 if not broken else 4):
        a0 = k * math.pi / 3
        put(im, (d < r - 1.5) & (np.abs(np.sin(ang - a0)) * d < 0.8) & (np.cos(ang - a0) > 0), R['wood'][1])
    put(im, d < 2.2, R['wood'][3])
    if broken: im[:, :s // 3] = 0
    return shadowed(trim(im), 1, 1, 80)

def cart(seed=0):
    """Carro trencat: plataforma de taulons inclinada i una roda."""
    bed_ = prism(30, 18, R['wood'], front=4, grain='v', seed=seed)
    im = img(40, 30)
    over(im, bed_, 4, 4)
    fill(im, 0, 10, 6, 12, R['wood'][1])                # vara
    over(im, wheel(7)[:, :], 10, 14)
    return shadowed(trim(im))

def rug(w, d, cloth='red', seed=0, worn=True):
    C = R[cloth]; rng = np.random.default_rng(seed)
    im = img(w, d)
    fill(im, 0, 0, w, d, C[1]); fill(im, 2, 2, w - 2, d - 2, C[2])
    for x in range(4, w - 4, 4): fill(im, x, 3, x + 2, 4, C[3]); fill(im, x, d - 4, x + 2, d - 3, C[3])
    fill(im, 5, 6, w - 5, d - 6, C[1]); fill(im, 6, 7, w - 6, d - 7, C[2])
    if worn:
        h = vnoise(d, w, 5, seed) > 0.72
        im[h & (im[..., 3] > 0), :3] = np.round(im[h & (im[..., 3] > 0), :3] * 0.82).astype(np.uint8)
        hole = vnoise(d, w, 4, seed + 3) > 0.84
        im[hole, 3] = 0
    for x in range(0, w, 2): fill(im, x, d, x + 1, d + 1, C[3])      # serrells
    return im

def pew(w, seed=0):
    im = img(w, 12)
    seat = prism(w, 5, R['wood'], front=2, grain='h', seed=seed, legs=2)
    fill(im, 0, 0, w, 3, R['wood'][1]); fill(im, 0, 0, w, 1, R['wood'][3])
    over(im, seat, 0, 3)
    return shadowed(im)

def broken_pew(w, seed=0):
    p = pew(w, seed)
    k = int(np.random.default_rng(seed).integers(w // 3, 2 * w // 3))
    p[:, k:k + 3] = 0
    p[4:, k + 3:] = np.roll(p[4:, k + 3:], 2, axis=0)
    return p

def altar(w=40, seed=0):
    S = R['stone']
    im = prism(w, 12, S, front=8, top_lvl=3)
    C = R['red']
    fill(im, 6, 0, w - 6, 12, C[2]); fill(im, 6, 0, w - 6, 1, C[3]); fill(im, 6, 12, w - 6, 18, C[1])
    for x in range(8, w - 8, 3): fill(im, x, 18, x + 1, 19, C[1])
    fill(im, w // 2 - 3, 3, w // 2 + 3, 8, R['paper'][3]); fill(im, w // 2, 3, w // 2 + 1, 8, R['paper'][1])   # llibre obert
    for x in (3, w - 5): fill(im, x, 1, x + 2, 6, R['paper'][4]); fill(im, x - 1, 6, x + 3, 7, R['bronze'][2])
    return shadowed(im)

def lectern():
    im = prism(10, 7, R['wood_dk'], front=6, top_lvl=3, legs=0)
    fill(im, 1, 1, 9, 6, R['paper'][3]); fill(im, 5, 1, 6, 6, R['paper'][1])
    return shadowed(im)

def bell(seed=0):
    """Campana de bronze caiguda, de costat, amb una esquerda."""
    m = np.zeros((18, 22), bool)
    yy, xx = np.mgrid[0:18, 0:22] + 0.5
    m |= ellipse(18, 22, 11, 9, 10, 8)
    b = shade_blob(m, R['bronze'], seed, tex=0.25)
    b[ellipse(18, 22, 15, 9, 4, 6.5), :3] = R['bronze'][0]
    b[ellipse(18, 22, 16, 9, 2, 4), :3] = (30, 26, 20)
    for i in range(7): b[4 + i, 6 + (i % 2), :3] = R['bronze'][0]
    return shadowed(b, 2, 2, 90)

def rubble(w=30, h=20, seed=0, stops=None, n=None):
    """Runa: pedres de mides diferents amuntegades (sense contorn), amb pols al voltant."""
    rng = np.random.default_rng(seed)
    S = stops or R['stone']
    im = img(w, h)
    dust = ellipse(h, w, w / 2, h / 2 + 1, w / 2 - 0.5, h / 2 - 0.5) & (vnoise(h, w, 3, seed) > 0.35)
    put(im, dust, R['ash'][3], 120)
    pts = [(rng.uniform(4, w - 4), rng.uniform(4, h - 3), rng.uniform(1.8, 4.2)) for _ in range(n or max(5, w * h // 40))]
    for x, y, r in sorted(pts, key=lambda p: p[1]):
        m = ellipse(h, w, x, y, r * rng.uniform(0.9, 1.3), r * rng.uniform(0.7, 1.0))
        sh = np.zeros_like(m); sh[1:, 1:] = m[:-1, :-1]
        put(im, sh & ~m, SHADOW, 110)
        yy = np.mgrid[0:h, 0:w][0] + 0.5
        t = 0.62 - (yy - y) / max(r, 1) * 0.3 + rng.uniform(-0.12, 0.08)
        col = ramp(S, t)
        im[m, :3] = np.round(col[m]); im[m, 3] = 255
        edge = m & ~erode(m) & (yy > y)
        im[edge, :3] = S[0]
    return im

def beam(length=46, angle=0.3, seed=0):
    """Biga caiguda (de la teulada), en diagonal."""
    w = int(abs(math.cos(angle)) * length) + 8; h = int(abs(math.sin(angle)) * length) + 8
    yy, xx = np.mgrid[0:h, 0:w] + 0.5
    x0, y0 = 4, (4 if angle > 0 else h - 4); ux, uy = math.cos(angle), math.sin(angle)
    t = (xx - x0) * ux + (yy - y0) * uy
    n = -(xx - x0) * uy + (yy - y0) * ux
    m = (t > 0) & (t < length) & (np.abs(n) < 2.6)
    im = img(w, h)
    put(im, m, R['wood_dk'][2]); put(im, m & (n < -1.2), R['wood_dk'][3]); put(im, m & (n > 1.3), R['wood_dk'][0])
    rng = np.random.default_rng(seed)
    for _ in range(4):
        k = rng.uniform(4, length - 4); put(im, m & (np.abs(t - k) < 0.6), R['wood_dk'][1])
    return shadowed(im, 2, 2, 90)

def pot(r=6):
    s = 2 * r + 2
    m = ellipse(s, s, s / 2, s / 2, r, r * 0.85)
    p = shade_blob(m, R['metal']); p[ellipse(s, s, s / 2, s / 2 - 1, r - 2, r * 0.85 - 2.2), :3] = (28, 26, 24)
    return shadowed(p, 1, 1)

def jar(stops='ochre', broken=False):
    m = ellipse(9, 8, 4, 5, 3.6, 4) | ellipse(9, 8, 4, 1.5, 2, 1.5)
    j = shade_blob(m, R[stops])
    if broken: j[:4] = 0
    return shadowed(j, 1, 1, 80)

def shards(seed=0, stops='ochre'):
    rng = np.random.default_rng(seed); im = img(16, 10)
    for _ in range(7):
        x, y = int(rng.integers(0, 14)), int(rng.integers(0, 8)); k = int(rng.integers(1, 3))
        fill(im, x, y, x + k + 1, y + k, R[stops][int(rng.integers(1, 4))])
    return im

def papers(seed=0, n=5):
    rng = np.random.default_rng(seed); im = img(26, 18)
    for _ in range(n):
        x, y = int(rng.integers(0, 20)), int(rng.integers(0, 13))
        fill(im, x, y, x + 6, y + 5, R['paper'][int(rng.integers(2, 4))]); fill(im, x + 1, y + 1, x + 5, y + 2, R['paper'][1])
        if rng.random() < 0.5: fill(im, x + 1, y + 3, x + 4, y + 4, R['paper'][1])
    return im

def trapdoor(cell=A):
    im = img(cell - 4, cell - 4); n = cell - 4
    fill(im, 0, 0, n, n, R['wood_dk'][1]); fill(im, 1, 1, n - 1, n - 1, R['wood'][2])
    for x in range(1, n - 1, 5): fill(im, x, 1, x + 1, n - 1, R['wood'][1])
    fill(im, 1, 1, n - 1, 2, R['wood'][3])
    m = ellipse(6, 6, 3, 3, 2.8, 2.8) & ~ellipse(6, 6, 3, 3, 1.6, 1.6); r = img(6, 6); put(r, m, R['metal'][3])
    over(im, r, n // 2 - 3, n // 2 - 3)
    return im

def stairs_up(w=A, steps=5):
    """Escala que puja (cap al nord): graons que s'aclareixen cap amunt."""
    h = A
    im = img(w, h)
    for i in range(steps):
        y0 = h - (i + 1) * (h // steps); y1 = y0 + h // steps
        S = R['wood']
        fill(im, 1, y0, w - 1, y1, S[min(1 + i // 2, 4)]); fill(im, 1, y0, w - 1, y0 + 1, S[min(2 + i // 2, 4)])
    fill(im, 0, 0, 1, h, R['wood_dk'][1]); fill(im, w - 1, 0, w, h, R['wood_dk'][0])
    return im

def ladder(h=40):
    im = img(12, h)
    fill(im, 1, 0, 3, h, R['wood'][2]); fill(im, 9, 0, 11, h, R['wood'][1])
    for y in range(3, h, 6): fill(im, 3, y, 9, y + 1, R['wood'][3])
    return shadowed(im, 2, 1, 70)

def loom():
    im = prism(26, 14, R['wood'], front=3, top_lvl=2)
    for x in range(3, 23, 2): fill(im, x, 2, x + 1, 12, R['paper'][3] if x % 4 else R['red'][3])
    fill(im, 2, 6, 24, 9, R['red'][2]); fill(im, 0, 0, 26, 2, R['wood'][3]); fill(im, 0, 12, 26, 14, R['wood'][1])
    return shadowed(im)

def toy_horse():
    im = img(9, 7)
    fill(im, 1, 2, 7, 4, R['wood'][3]); fill(im, 6, 0, 8, 3, R['wood'][3]); fill(im, 1, 4, 2, 6, R['wood'][1]); fill(im, 5, 4, 6, 6, R['wood'][1])
    fill(im, 0, 6, 9, 7, R['red'][1])
    return shadowed(im, 1, 1, 70)

def saddle():
    m = ellipse(9, 12, 6, 4.5, 5.6, 4)
    s = shade_blob(m, R['leather']); fill(s, 5, 0, 7, 3, R['leather'][1])
    return shadowed(s, 1, 1, 80)

def bucket():
    m = ellipse(8, 8, 4, 4, 3.6, 3.6); b = shade_blob(m, R['wood']); b[ellipse(8, 8, 4, 3.6, 2.2, 2), :3] = (40, 46, 46)
    return shadowed(b, 1, 1, 80)

def stump(seed=0):
    m = ellipse(12, 16, 8, 6, 7.6, 5.4); s = shade_blob(m, R['wood'], seed, tex=0.3)
    s[ellipse(12, 16, 8, 5.2, 5, 3), :3] = R['wood'][3]; s[ellipse(12, 16, 8, 5.2, 2.6, 1.6), :3] = R['wood'][2]
    return shadowed(s)

def dry_bush(seed=0, size=A, Rr=9):
    """Matoll sec (on s'hi poden amagar les plagues de branquetes)."""
    return V.canopy(size, Rr, 700 + seed, R['dry'], clump=3.6, leafy=1.3)

def weeds(seed=0, n=6, w=20, h=14, stops=None):
    """Mates d'herba i males herbes que surten entre les lloses (el bosc es menja el poble)."""
    rng = np.random.default_rng(seed); im = img(w, h); S = stops or R['leaf']
    for _ in range(n):
        x, y = rng.uniform(2, w - 2), rng.uniform(3, h - 1)
        for k in range(int(rng.integers(3, 6))):
            a = rng.uniform(-1.1, 1.1); L = rng.uniform(2, 5)
            for j in range(int(L)):
                px, py = int(x + math.sin(a) * j), int(y - math.cos(a) * j)
                if 0 <= px < w and 0 <= py < h: im[py, px, :3] = S[min(1 + j, 4)]; im[py, px, 3] = 255
    return im

def vine(h=20, seed=0):
    """Heura que s'enfila per la cara d'una paret des de baix."""
    rng = np.random.default_rng(seed); w = 14; im = img(w, h); S = R['leaf']
    x = w / 2
    for y in range(h - 1, -1, -1):
        x += rng.uniform(-0.8, 0.8); x = min(max(x, 2), w - 3)
        im[y, int(x), :3] = S[1]; im[y, int(x), 3] = 255
        if rng.random() < 0.45:
            dx = int(rng.choice([-2, -1, 1, 2])); m = ellipse(3, 3, 1.5, 1.5, 1.4, 1.2); lf = img(3, 3); put(lf, m, S[int(rng.integers(2, 5))])
            over(im, lf, int(x) + dx - 1, y - 1)
    return im

def scorch(w, h, seed=0):
    """Taca de cremat al terra (la guerra de fa cent anys): enfosqueix el que hi ha a sota."""
    n = vnoise(h, w, 5, seed) * 0.6 + vnoise(h, w, 2, seed + 1) * 0.4
    yy, xx = np.mgrid[0:h, 0:w] + 0.5
    fall = 1 - np.hypot((xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2))
    v = n * 0.5 + fall
    im = img(w, h)
    put(im, v > 0.55, (30, 26, 20), 110); put(im, v > 0.75, (24, 20, 16), 170)
    return im

def light_patch(w, h, seed=0):
    """Clap de llum (un forat al sostre): aclareix el terra en dos tons, amb vora irregular."""
    n = vnoise(h, w, 4, seed)
    yy, xx = np.mgrid[0:h, 0:w] + 0.5
    d = np.hypot((xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2)) + (n - 0.5) * 0.35
    im = img(w, h)
    put(im, d < 1, (232, 226, 196), 46); put(im, d < 0.62, (240, 236, 210), 80)
    return im

# ── terres ──────────────────────────────────────────────────────────────────
def plank_floor(seed, stops=None, ph=6):
    """Parquet de taulons horitzontals (4 per casella): to per tauló, junta fosca, veta suau i algun nus."""
    S = stops or R['wood']; rng = np.random.default_rng(seed)
    t = np.zeros((A, A, 3), float)
    grain = V.pnoise(seed + 50, A, 6)
    for k in range(A // ph):
        y0 = k * ph
        base = 2.35 + rng.uniform(-0.35, 0.35)
        t[y0:y0 + ph] = ramp(S, (base + (grain[y0:y0 + ph] - 0.5) * 0.5) / 4)
        t[y0 + ph - 1] = S[1]                                 # junta (fosca)
        t[y0] = ramp(S, (base + 0.45) / 4)                 # cantell il·luminat
        j = int(rng.integers(2, A - 2))                       # testa del tauló
        t[y0:y0 + ph - 1, j] = S[1]
        if rng.random() < 0.3:
            x = int(rng.integers(2, A - 3)); t[y0 + 2, x:x + 2] = S[1]
    return rgba(t)

def flag_floor(seed, stops=None):
    """Lloses irregulars: rectangles de mides variades, junta fosca, cantell clar a dalt a l'esquerra."""
    S = stops or R['stone']; rng = np.random.default_rng(seed)
    t = np.zeros((A, A, 3), float)
    tex = V.pnoise(seed + 70, A, 8)
    y = 0
    while y < A:
        h = int(rng.choice([8, 12])) if A - y > 12 else A - y
        x = -int(rng.integers(0, 8))
        while x < A:
            w = int(rng.integers(8, 15))
            lv = 1.45 + rng.uniform(-0.3, 0.3)
            x0, x1 = max(x, 0), min(x + w, A)
            t[y:y + h, x0:x1] = ramp(S, (lv + (tex[y:y + h, x0:x1] - 0.5) * 0.45) / 4)
            t[y:y + h, x0] = ramp(S, (lv + 0.3) / 4)
            t[y, x0:x1] = ramp(S, (lv + 0.3) / 4)
            if x + w - 1 < A: t[y:y + h, x + w - 1] = S[0]
            x += w
        t[min(y + h - 1, A - 1), :] = S[0]
        y += h
    return rgba(t)

def floor_tiles():
    earth = V.regrade([V.oryx(c, 5) for c in (0, 1, 2, 3)], R['dry'], span=(0.28, 0.62))
    F = V.floors()
    return {'wood': [plank_floor(10 + i) for i in range(4)],
            'wood_dk': [plank_floor(20 + i, R['wood_dk']) for i in range(4)],
            'stone': [flag_floor(30 + i) for i in range(4)],
            'earth': earth, **F}


# ── full de revisió ─────────────────────────────────────────────────────────
def review_sheet(path):
    pieces = [
        barrel(), chest(), small_table(12), small_table(13), small_table(14), candelabra(), tombstone(), tombstone(True), statue(), coffin(),
        cobweb(0), cobweb(4), bones(0), bones(3), grindstone(), puddle(0),
        table(48, 18, 1, ('plates', 'mugs')), table(40, 16, 2, ('papers', 'candle', 'book')), bench(40), stool(), chair(), tipped_chair(),
        bed('red', 1), bed('blue', 2), cradle(), shelf(40, 1), shelf(30, 2, 'jars'), wardrobe(), hearth(), hearth(40, pot=True),
        counter(60), keg_rack(3), crate(), sacks(3), hay(), trough(), stall_board(40), stall_board(40, False),
        anvil(), forge(), bellows(), coal(), scrap(), tool_rack(), wheel(), wheel(9, True), cart(), rug(48, 30), pew(44), broken_pew(44, 3), altar(),
        lectern(), woodpile(), bell(), rubble(), beam(), pot(), jar(), jar('green', True), shards(), papers(), trapdoor(), stairs_up(), ladder(), loom(), toy_horse(),
        saddle(), bucket(), stump(), dry_bush(0), dry_bush(1, 2 * A, 16), weeds(), vine(), scorch(40, 30), light_patch(40, 30),
    ]
    W = 20 * A
    x = y = 4; rowh = 0; placed = []
    for p in pieces:
        h, w = p.shape[:2]
        if x + w > W - 4: x = 4; y += rowh + 6; rowh = 0
        placed.append((p, x, y)); x += w + 6; rowh = max(rowh, h)
    sheet = np.zeros((y + rowh + 4, W, 4), np.uint8)
    F = floor_tiles()
    for r in range(sheet.shape[0] // A + 1):
        for c in range(W // A):
            over(sheet, F['wood'][(r + c) % 4] if c < 10 else F['stone'][(r * 3 + c) % 4], c * A, r * A)
    for p, x, y in placed: over(sheet, p, x, y)
    V.x2(sheet).save(path)
    print('peces →', path)

if __name__ == '__main__':
    if '--sheet' in sys.argv: review_sheet(sys.argv[sys.argv.index('--sheet') + 1])
