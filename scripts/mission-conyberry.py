#!/usr/bin/env python3
"""
Mapa de la missió de Conyberry (app Píxel), fet amb el full de poble (`scripts/oryx-village.py`):

    python3 scripts/mission-conyberry.py      # escriu `public/missions/conyberry/mapa.png`

Recrea el mapa pintat de la campanya (el poble, el llac, els murs de pedra seca i el bosc) a
36 × 25 caselles de 48 px. Tot el que hi ha és aquí, a mà, per poder-lo anar polint:
  - `GRID`: el terra de cada casella (`.` prat, `F` bosc, `p` camí, `s` còdols, `w` aigua, `d` moll);
  - murs i tanques (caselles, s'enllacen soles amb els veïns), cases (rectangles en píxels
    d'art, 24 per casella, amb el color de la teulada), pou, barca, roques i arbres solts.
Els arbres del bosc es reparteixen sols a les caselles `F` (llavor fixa: sempre surt igual).
La missió (on és la colla, l'ajust de color de les figuretes…) és a `src/lib/missions.ts`.
"""
import importlib.util, os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'public', 'missions', 'conyberry', 'mapa.png')
_spec = importlib.util.spec_from_file_location('village', os.path.join(os.path.dirname(__file__), 'oryx-village.py'))
V = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(V)
A = V.A

GRID = """
FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF
F.p..FF..FF...FFFFF....FFFFFFFFFFF.F
F..p.FF..FFFFFFFFFF....FFFFFFFFFFF.F
F...pFF.....FFFFF......FFFFFFFFFF..F
FFF.Fp.........ppppppppp.FFF.ppp...F
FFF...p.......pppp.....p...ppp.pp..F
FFFF.Fpp.....pp...FFF....F.FFF..pp.F
FFFF...p.....p......F............ppF
FFFFF..pp...pp......F...........FFpF
FFFFF..ppp..p.......FF..pp.....FFFpF
FFFpppppppppp.....FFFFFpp...pp.FFFFF
FFpp........pp....FFFFFp.pppp..FFFFF
FFF...F....F.pp..FFFFFFpppp.....FFFF
FFFFFFF...pF..ppp....ppp..F.F......F
FFFFFFFFpppF..pppppppppp.FF.F......F
s.FFFFFpp..FF.p.ppFF...p.F..F.....FF
wssFFFpp......p.ppFF...ppF.F......FF
wwss..p.......p...FF...pp.........FF
wwwssppFFF.............pp....FFFFFFF
wwwwsspFFF..............p.....FFFFFF
wwwwwssFFFFFFFF.....FFFFp.....FFFFFF
wwwwwwddF..FFFF.....FF..p.....FFFFFF
wwwwwwdss...FFFFFF..FF..pp....FFFFFF
wwwwwwwss.....FFFFFFFF...pFFFFFFFFFF
wwwwwwwsss....FFFFFFF....pFFF......F
""".strip().splitlines()
WALLS = [(2, 3), (3, 3), (3, 4), (3, 5), (4, 5), (4, 6), (4, 7), (5, 7), (5, 8), (5, 9), (8, 2), (8, 3), (9, 3), (9, 4), (10, 4), (11, 4), (12, 4), (16, 5), (17, 5), (18, 5), (19, 5), (20, 5), (21, 5), (22, 5), (23, 4), (23, 5), (24, 4), (24, 5), (24, 19), (24, 20), (25, 5), (25, 17), (25, 18), (25, 19), (26, 5), (26, 6), (26, 15), (26, 16), (26, 17), (27, 12), (27, 13), (27, 14), (27, 15), (28, 11), (28, 12), (29, 10), (29, 11), (30, 10)]
FENCES = [(2, 11), (7, 15), (9, 16), (9, 17), (13, 9), (13, 10), (13, 11), (14, 5), (14, 6), (14, 11), (16, 4), (17, 4), (18, 4), (19, 4), (20, 4), (21, 4), (22, 21), (30, 7), (31, 6), (31, 7)]
# Cases: cada una és una llista de rectangles (x0, y0, x1, y1 en píxels d'art, teulada).
HOUSES = [
    [(213, 146, 268, 218, 'red'), (263, 163, 314, 206, 'brown')],
    [(362, 160, 408, 212, 'brown'), (367, 209, 414, 265, 'brown'), (421, 186, 461, 232, 'brown')],
    [(507, 146, 556, 212, 'brown'), (545, 150, 596, 221, 'red')],
    [(622, 172, 702, 247, 'brown')],
    [(178, 267, 259, 330, 'brown'), (215, 324, 252, 367, 'brown')],
    [(255, 385, 298, 471, 'brown'), (292, 385, 338, 431, 'red'), (298, 428, 338, 472, 'red')],
    [(371, 416, 421, 511, 'brown'), (415, 454, 458, 505, 'red')],
    [(488, 379, 567, 436, 'brown'), (493, 433, 567, 477, 'red')],
    [(708, 298, 763, 356, 'red'), (763, 330, 811, 379, 'red'), (708, 367, 745, 428, 'red'), (763, 376, 811, 428, 'brown')],
    [(619, 454, 671, 531, 'brown'), (665, 459, 708, 537, 'red')],
]
WELL = (20, 12)
BOAT = (112, 552)
BIGTREE = (487, 229)
ROCKS = [(458, 42), (481, 74), (441, 85), (160, 91), (22, 355), (521, 51), (492, 56), (504, 79)]   # px d'art, cantonada
TREES = [(321, 298), (269, 298), (613, 321), (619, 367), (562, 270), (172, 436), (103, 350), (309, 350), (516, 517)]   # px d'art, centre

COLS, ROWS = len(GRID[0]), len(GRID)
H = lambda c, r: ((c * 73856093) ^ (r * 19349663)) & 0xffffffff

def kind(c, r):
    return GRID[min(max(r, 0), ROWS - 1)][min(max(c, 0), COLS - 1)]

def house_cells():
    out = set()
    for hs in HOUSES:
        for x0, y0, x1, y1, _ in hs:
            out |= {(c, r) for c in range(x0 // A, x1 // A + 1) for r in range(y0 // A, y1 // A + 1)}
    return out

def bits(cells, c, r):
    return sum(1 << k for k, (dc, dr) in enumerate(((0, -1), (1, 0), (0, 1), (-1, 0))) if (c + dc, r + dr) in cells)

def render():
    F = V.floors(); Tr = V.trees(); OV = V.overlays(F)
    cv = np.zeros((ROWS * A, COLS * A, 4), np.uint8)
    for r in range(ROWS):
        for c in range(COLS): V.over(cv, F['grass'][H(c, r) % 4], c * A, r * A)
    # terres amb vora irregular (graella dual), de baix a dalt
    for key, members in (('meadow', 'F'), ('sand', 'swd'), ('path', 'p'), ('water', 'wd')):
        for j in range(ROWS + 1):
            for i in range(COLS + 1):
                b = sum(1 << k for k, (c, r) in enumerate(((i - 1, j - 1), (i, j - 1), (i, j), (i - 1, j))) if kind(c, r) in members)
                if b: V.over(cv, F[key][H(i, j) % len(F[key])] if b == 15 else OV[key][b], i * A - A // 2, j * A - A // 2)
    for r in range(ROWS):
        for c in range(COLS):
            if GRID[r][c] == 'd': V.over(cv, V.dock(), c * A, r * A)
    walls, fences = set(WALLS), set(FENCES)
    for c, r in sorted(walls, key=lambda p: p[1]): V.over(cv, V.stonewall(bits(walls, c, r)), c * A, r * A)
    for c, r in sorted(fences, key=lambda p: p[1]): V.over(cv, V.fence(bits(fences, c, r)), c * A, r * A)
    for i, hs in enumerate(HOUSES):
        for k, (x0, y0, x1, y1, kd) in enumerate(hs): V.roof(cv, x0, y0, x1, y1, kd, seed=i * 10 + k)
    V.over(cv, V.well(), WELL[0] * A, WELL[1] * A)
    V.over(cv, V.boat(), *BOAT)
    rng = np.random.default_rng(7)
    for x, y in ROCKS: V.over(cv, Tr['rock'][rng.integers(4)], x, y)
    # bosc: arbres repartits a les caselles F, lluny de les cases
    hc = house_cells(); pts = []
    for _ in range(6000):
        x, y = rng.uniform(0, COLS * A), rng.uniform(0, ROWS * A)
        if GRID[int(y // A)][int(x // A)] != 'F': continue
        if any(abs(x - (c + .5) * A) < A * 1.1 and abs(y - (r + .5) * A) < A * 1.1 for c, r in hc): continue
        if abs(x - (WELL[0] + .5) * A) < A * 1.6 and abs(y - (WELL[1] + .5) * A) < A * 1.6: continue   # el pou es veu
        if any((x - px) ** 2 + (y - py) ** 2 < (0.9 * A) ** 2 for px, py, _ in pts): continue
        pts.append((x, y, rng.choice(['tree_l', 'tree_l', 'tree_m', 'tree_m', 'bush'])))
    for x, y in TREES: pts.append((x, y, rng.choice(['tree_m', 'bush', 'tree_l'])))
    pts.append((*BIGTREE, 'tree_xl'))
    for x, y, k in sorted(pts, key=lambda p: p[1]):
        t = Tr[k][rng.integers(len(Tr[k]))]
        V.over(cv, t, int(x - t.shape[1] / 2), int(y - t.shape[0] / 2))
    return cv

def main():
    cv = render()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    V.x2(cv).convert('RGB').save(OUT, optimize=True)
    try:
        import oxipng; oxipng.optimize(OUT, level=4)
    except ImportError:
        pass
    print('Conyberry →', os.path.relpath(OUT, ROOT), f'({COLS}×{ROWS} caselles de {2 * A} px)')

if __name__ == '__main__':
    main()
