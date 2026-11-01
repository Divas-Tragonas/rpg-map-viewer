#!/usr/bin/env python3
"""
Mapa de la missió de Conyberry (app Píxel), fet amb el full de poble (`scripts/oryx-village.py`):

    python3 scripts/mission-conyberry.py      # escriu `public/missions/conyberry/mapa.png`

Recrea el mapa pintat de la campanya (`src/missions/assets/map-cony-cirera.webp` de la wiki) a
36 × 25 caselles de 48 px. ⚠️ Tot ha de caure **al mateix lloc** que al mapa pintat: el tauler de
missions de la wiki passa de l'un a l'altre amb una onada de caselles (el «match cut») i qualsevol
cosa desplaçada salta. Les mides es van prendre amb el pintat reduït a 1728 × 1200 i una graella
de 48 px a sobre (1 px d'art = 2 px de mapa).
  - `GRID`: el terra de cada casella (`.` prat, `F` herba fosca sota els arbres, `p` camí,
    `s` còdols, `w` aigua, `d` moll);
  - murs i tanques (caselles, s'enllacen soles amb els veïns), cases (rectangles en píxels d'art,
    24 per casella, amb el color de la teulada), taulons, pou, barca i roques;
  - `TREES`: cada arbre on és al pintat (centre en px d'art; `L` gran, `M` mitjà, `b` mata).
    Es van treure de les taques d'arbres del pintat (una sola vegada, fora d'aquest script) i
    es poden polir a mà. ⚠️ Res de bosc repartit a l'atzar: el bosc de la v4.52–v4.61 omplia
    totes les caselles `F` i tapava el prat, els murs i els camins que es veuen al pintat.
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
....................................
..pp.FFp..........F....FFF..FF..FF..
...ppFFp.FFFFFFFFFFpp.FFFFFFFFFFFF..
....pF.p.....FFFF.ppp...FFF..FFF....
FF..pp.p.F...pppp...................
FF.FFppppppppp.FF.....FF..pppppppp..
.FFFFF.p.....p...FF......pp......p..
.FFFF..p.....p....F.....pp.......pp.
.F.FF..p.....p..........p.......F.pp
..FFF..pp....p....pFF..pp....ppppppp
.FFFF.pppppF.p...ppFFF.p...ppp..FF..
..FFppp...pppp..ppFFF..p..pp.....FF.
..ppp.......pp.Fp.FFFFFpppp..F...FF.
.F.F.......F.pp.p.....pppF..........
.F..F.....FFpppppppppppp.F..........
s.FFFF.....pp.FFp....FFppFF....F....
wsFF...ppppp...FppFFF.F.pFF.......FF
wsss..FF.......pppp.....p........FFF
wwsss.FFF..FF.....pp....pp....FF....
wwwsssFFF.F........p....pp....FFF.F.
wwwwsss............p..F.p.....FFFFF.
wwwwwssd....FF.F..pp....p.....FFFF..
wwwwwwddsss..FF...p.....pp....FFFFF.
wwwwwwwwwssss..FFFpp.....p.FFFFFFF..
wwwwwwwwwwssssFFFFFp.F...p.F........
""".strip().splitlines()
WALLS = [
    (2, 4), (3, 4), (3, 5), (3, 6), (4, 6), (4, 7), (5, 7), (5, 8), (5, 9),                       # el llarg de l'oest
    (8, 2), (8, 3), (9, 3), (9, 4), (10, 4), (11, 4), (12, 4), (13, 4),                            # dalt a l'esquerra
    (17, 5), (18, 5), (19, 5), (20, 5), (21, 5), (22, 5), (22, 4), (23, 4), (24, 4), (24, 5), (25, 5), (26, 5),   # dalt
    (34, 9), (33, 9), (33, 10), (32, 10), (31, 10), (30, 10), (29, 10), (29, 11), (28, 11), (28, 12), (27, 12),
    (27, 13), (27, 14), (27, 15), (27, 16), (27, 17), (26, 17), (26, 18), (25, 18), (25, 19), (24, 19), (24, 20),   # de l'est (s'atura abans de la porta de l'hostal, a (24, 21))
]
FENCES = [
    (17, 4), (18, 4), (19, 4), (20, 4), (21, 4), (21, 3), (21, 2),                                 # el cementiri
    (15, 5), (15, 6), (14, 6), (14, 7), (14, 8), (13, 8), (13, 9), (13, 10), (13, 11), (14, 11), (15, 11),   # la casa del batlle
    (21, 9), (22, 9), (21, 11), (22, 11),                                                          # vora el pou
    (25, 6), (26, 6), (27, 6), (27, 5), (28, 5), (29, 5), (30, 5), (31, 5), (31, 6), (31, 7), (31, 8), (30, 8), (29, 8),
    (25, 7), (25, 8), (25, 9), (25, 10),                                                           # el graner
    (2, 11), (2, 12), (2, 13), (2, 14), (4, 16), (5, 16),                                          # l'oest i la riba
    (9, 17), (9, 18), (9, 19), (9, 20), (10, 20), (11, 20), (12, 20),
    (15, 17), (14, 17), (14, 18), (14, 19), (14, 20),
    (19, 17), (19, 18), (19, 20), (19, 21), (19, 22), (20, 22), (21, 22), (22, 22), (22, 21), (23, 21), (23, 20),
]
WOOD = [(6, 12), (6, 16), (7, 15), (19, 7), (16, 22)]   # taulons: passeres, escales i el portal de fusta
# Cases: cada una és una llista de rectangles (x0, y0, x1, y1 en píxels d'art, teulada).
# ⚠️ L'ordre és el de `house` a `scripts/mission-conyberry-llocs.py`: les noves, al final.
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
    [(697, 142, 724, 166, 'brown')],      # el cobert del tancat del graner
    [(385, 98, 405, 118, 'brown')],       # el porxo del cementiri
]
WELL = (502, 297)                         # centre, px d'art
BOAT = (179, 548)                         # cantonada, px d'art
ROCKS = [(171, 110), (186, 113), (303, 101), (284, 144), (488, 45), (474, 64), (493, 57), (465, 86), (445, 84),
         (434, 88), (474, 98), (492, 80), (524, 68), (424, 86), (499, 37), (529, 95), (836, 200)]   # centre, px d'art
TREES = [
    (601, 28, 'M'), (141, 31, 'b'), (557, 31, 'b'), (127, 32, 'b'), (694, 33, 'M'), (383, 35, 'b'),
    (155, 36, 'b'), (315, 44, 'b'), (740, 44, 'b'), (610, 45, 'b'), (435, 46, 'M'), (794, 49, 'M'),
    (363, 50, 'b'), (411, 50, 'b'), (553, 50, 'M'), (761, 51, 'M'), (687, 53, 'b'), (238, 55, 'M'),
    (108, 57, 'b'), (265, 60, 'M'), (665, 60, 'M'), (303, 61, 'b'), (140, 63, 'L'), (392, 63, 'M'),
    (417, 64, 'b'), (585, 64, 'L'), (613, 66, 'b'), (717, 67, 'L'), (686, 68, 'b'), (550, 71, 'b'),
    (771, 71, 'b'), (111, 72, 'b'), (335, 72, 'L'), (21, 73, 'b'), (251, 73, 'b'), (303, 76, 'b'), (648,
    77, 'b'), (371, 83, 'M'), (625, 85, 'M'), (752, 86, 'M'), (601, 90, 'b'), (694, 96, 'M'), (732, 96,
    'b'), (22, 109, 'b'), (215, 116, 'b'), (38, 117, 'b'), (116, 123, 'b'), (96, 124, 'M'), (775, 126,
    'b'), (384, 128, 'M'), (558, 132, 'M'), (26, 137, 'M'), (427, 145, 'b'), (615, 155, 'b'), (21, 159,
    'b'), (641, 160, 'b'), (835, 162, 'b'), (455, 166, 'b'), (500, 167, 'b'), (430, 169, 'M'), (51, 172,
    'L'), (146, 182, 'b'), (23, 191, 'b'), (94, 194, 'L'), (777, 198, 'b'), (35, 200, 'b'), (195, 200,
    'b'), (776, 220, 'M'), (115, 221, 'b'), (487, 221, 'b'), (96, 223, 'b'), (49, 231, 'b'), (503, 232,
    'b'), (760, 235, 'b'), (111, 239, 'b'), (511, 243, 'b'), (77, 248, 'L'), (478, 252, 'L'), (282, 253,
    'M'), (579, 254, 'b'), (42, 259, 'M'), (510, 259, 'b'), (831, 260, 'b'), (130, 270, 'M'), (451, 270,
    'b'), (608, 272, 'b'), (105, 273, 'M'), (438, 277, 'b'), (86, 282, 'b'), (464, 282, 'b'), (65, 290,
    'b'), (815, 290, 'L'), (545, 291, 'b'), (445, 298, 'M'), (504, 301, 'M'), (273, 303, 'b'), (375,
    304, 'b'), (540, 304, 'b'), (35, 305, 'b'), (611, 315, 'M'), (690, 317, 'b'), (96, 321, 'b'), (266,
    325, 'b'), (289, 331, 'b'), (80, 332, 'M'), (38, 340, 'M'), (273, 346, 'M'), (607, 346, 'M'), (295,
    352, 'b'), (367, 355, 'b'), (521, 355, 'b'), (341, 358, 'M'), (635, 358, 'b'), (598, 364, 'b'),
    (557, 366, 'b'), (137, 367, 'b'), (841, 367, 'b'), (151, 368, 'b'), (105, 371, 'L'), (384, 376,
    'b'), (638, 376, 'b'), (755, 376, 'b'), (336, 378, 'b'), (361, 378, 'M'), (613, 382, 'M'), (832,
    384, 'M'), (69, 387, 'M'), (634, 390, 'b'), (850, 391, 'b'), (90, 396, 'b'), (444, 396, 'M'), (480,
    400, 'b'), (465, 406, 'b'), (839, 411, 'M'), (166, 421, 'b'), (181, 424, 'b'), (154, 428, 'b'),
    (192, 433, 'b'), (836, 433, 'b'), (205, 438, 'b'), (734, 445, 'M'), (834, 454, 'b'), (171, 455,
    'L'), (763, 455, 'b'), (784, 466, 'M'), (208, 470, 'M'), (745, 473, 'M'), (836, 475, 'M'), (720,
    478, 'b'), (764, 485, 'b'), (783, 488, 'b'), (542, 489, 'b'), (732, 495, 'b'), (812, 500, 'M'),
    (728, 510, 'b'), (792, 510, 'b'), (503, 515, 'b'), (760, 516, 'L'), (285, 519, 'b'), (315, 519,
    'b'), (359, 528, 'b'), (733, 535, 'b'), (310, 537, 'b'), (333, 538, 'M'), (804, 541, 'L'), (355,
    545, 'b'), (387, 550, 'b'), (702, 550, 'b'), (403, 551, 'b'), (475, 552, 'b'), (623, 554, 'b'),
    (420, 555, 'b'), (770, 557, 'M'), (727, 558, 'M'), (697, 568, 'b'), (748, 573, 'b'), (372, 574,
    'M'), (336, 575, 'b'), (405, 575, 'M'), (447, 575, 'M'), (469, 576, 'b'), (661, 579, 'M'), (350,
    582, 'b'), (519, 582, 'b'), (502, 583, 'b'), (639, 583, 'b'), (426, 584, 'b'), (568, 589, 'b'),
    (388, 591, 'b')
]
TREE_KIND = {'L': 'tree_l', 'M': 'tree_m', 'b': 'bush'}

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
    for c, r in WOOD: V.over(cv, V.dock(), c * A, r * A)
    walls, fences = set(WALLS), set(FENCES)
    for c, r in sorted(walls, key=lambda p: p[1]): V.over(cv, V.stonewall(bits(walls, c, r)), c * A, r * A)
    for c, r in sorted(fences, key=lambda p: p[1]): V.over(cv, V.fence(bits(fences, c, r)), c * A, r * A)
    for i, hs in enumerate(HOUSES):
        for k, (x0, y0, x1, y1, kd) in enumerate(hs): V.roof(cv, x0, y0, x1, y1, kd, seed=i * 10 + k)
    w = V.well(); V.over(cv, w, WELL[0] - w.shape[1] // 2, WELL[1] - w.shape[0] // 2)
    V.over(cv, V.boat(), *BOAT)
    rng = np.random.default_rng(7)
    for x, y in ROCKS:
        t = Tr['rock'][rng.integers(4)]; V.over(cv, t, x - t.shape[1] // 2, y - t.shape[0] // 2)
    # arbres de dalt a baix: els de sota tapen la copa dels de sobre, com al pintat
    for i, (x, y, k) in enumerate(sorted(TREES, key=lambda p: p[1])):
        t = Tr[TREE_KIND[k]][H(x, y) % len(Tr[TREE_KIND[k]])]
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
