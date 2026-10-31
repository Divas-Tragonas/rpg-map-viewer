#!/usr/bin/env python3
"""
Llocs de la missió de Conyberry (Cony Cirera): els grups de cases on es pot entrar.

    python3 scripts/mission-conyberry-llocs.py            # mapes + `src/lib/places/conyberry.ts`
    python3 scripts/mission-conyberry-llocs.py --only farga

Cada lloc és un mapa propi (`public/missions/conyberry/<id>.png`, caselles de 48 px com el poble)
fet amb les peces d'interior (`scripts/oryx-interiors.py`) i el full de poble. Del mateix
dibuix en surt la geometria de joc (parets, portes i sales amb nom), perquè les sales fosques,
la llum per línia de visió i les col·lisions funcionin sense que el DM hagi de dibuixar res.

Què hi ha a cada lloc ve de la wiki (`packages/model/src/towns.ts`: Farga vella, Casa del
batlle, Capella enrunada, Hostal vell) i del Notion (mòduls «Les runes de Cony Cirera» i «L'Àgata»:
el bosc s'ha menjat el poble, arrasat a la Gran Guerra de fa cent anys; plagues de branquetes que
semblen matolls secs). Els que la wiki no anomena (graner, casa de la taula parada, rectoria)
són propostes.

Graella de cada lloc (un caràcter per casella):
  fora:   `.` herba  `:` herba alta  `,` camí  `T` herba amb un arbre
  terra:  `=` taulons  `-` taulons foscos  `_` lloses  `e` terra batuda
  parets: `#` entramat i arrebossat  `S` pedra   (1 casella de gruix)
  pas:    `D` porta oberta  `C` porta tancada  `B` esvoranc (paret esfondrada: porta oberta)
  `x`:    buit (fora del lloc, no es pot trepitjar)
"""
import importlib.util, json, math, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, '..')
def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, file))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); return mod
I = _load('interiors', 'oryx-interiors.py')
M = _load('mission', 'mission-conyberry.py')
V = I.V
A, R, over, fill, put, img = I.A, I.R, I.over, I.fill, I.put, I.img
OUT_DIR = os.path.join(ROOT, 'public', 'missions', 'conyberry')
TS_OUT = os.path.join(ROOT, 'src', 'lib', 'places', 'conyberry.ts')
CELL = 2 * A   # px de mapa per casella

OUTSIDE = set('.:,T')
FLOORS = {'=': 'wood', '-': 'wood_dk', '_': 'stone', 'e': 'earth'}
WALLS = set('#S')
DOORS = set('DCB')

# ── els llocs ───────────────────────────────────────────────────────────────
# `house`: índex a `HOUSES` de `mission-conyberry.py` i rectangle que té la porta (la marca del
# DM i on torna la colla en sortir). `door` a mà quan la porta no és la del mig de la façana.
PLACES = []

def place(**kw): PLACES.append(kw); return kw

# 1 · Farga vella — «una farga abandonada, amb l'enclusa encara a fora, rovellada» (wiki)
place(
    id='farga', name='Farga vella', kind='exterior', house=(0, 1),
    text="El pati de la farga: el taller obert de pedra, l'enclusa rovellada a fora i la casa del ferrer.",
    grid="""
::T::::T::::::::T:::
:#########:SSSSSSSS:
:#====#==#:S______S:
:#====D==#:S______B:
:#====#==#:S______S:
:###D#####:S______S:
..,,,,,,,,,,,,,,,,..
.,,,,,,,,,,,,,,,,,,.
:.,,,,,,,,,,,,,,,,.:
::..,,,,,,,,,,,,..::
T:::...,,,,,,..::::T
::::::.,,,,,,.::::::
:::T:::.,,,,.:::T:::
""",
    rooms=[('Casa del ferrer', 3, 3, True), ('Cambra del ferrer', 7, 3, True)],
    spawn=[(9, 10), (10, 10), (8, 11), (9, 11), (10, 11)], exit=(9, 11),
)
# 2 · Casa del batlle — «la casa més gran del poble, amb el pati tancat. Fa temps que les portes no tanquen» (wiki)
place(
    id='batlle', name='Casa del batlle', kind='interior', house=(1, 1),
    text="La casa més gran del poble, al voltant d'un pati tancat: sala gran, despatx, cambra, cuina, rebost i un magatzem esfondrat.",
    grid="""
::::T:::::::::::::T:::
:####################:
:#====#--------#====#:
:#====D--------C====#:
:#====#--------#====#:
:##########D#########:
:#___#....._...#eeee#:
:#___D....._...#eeee#:
:#___#....._...Beeee#:
:##D##....._...#eeeeB:
:#___#....._...#eeee#:
:#___#....._...#eeee#:
:#####....._...######:
:::::SSSSSDDSSSS::::::
:T:::::::,,,::::::::::
::::::::,,,,,:::::T:::
""",
    rooms=[('Despatx del batlle', 3, 3, True), ('Sala gran', 10, 3, True), ('Cambra del batlle', 17, 3, True),
           ('Cuina', 3, 7, True), ('Rebost', 3, 10, True), ('Magatzem esfondrat', 17, 10, True), ('Pati', 8, 9, False)],
    spawn=[(10, 14), (11, 14), (9, 14), (10, 15), (11, 15)], exit=(10, 14),
)
# 3 · Graner — el més gran del poble, a tocar del sender que porta a la cabanya de l'Àgata
place(
    id='graner', name='Graner', kind='interior', house=(3, 0), door=(27, 11),
    text="Un graner amb el sostre mig caigut. Entre la palla podrida hi ha crescut bardissa seca… o no és bardissa.",
    grid="""
:::T::::::::::T::::
:##########B######:
:#eeeeeeeeeee#===#:
:#eeeeeeeeeeeD===#:
:#eeeeeeeeeee#####:
:#eeeeeeeeeeeeeee#:
:#eeeeeeeeeeeeeee#:
:#eeeeeeeeeeeeeee#:
:######DD#########:
::::::,,,,::::::T::
T:::::,,,,:::::::::
:::::,,,,,,::::::::
::::,,,,,,,,:::T:::
""",
    rooms=[('Graner', 7, 5, True), ('Racó del pagès', 15, 3, True)],
    spawn=[(6, 9), (7, 9), (8, 9), (6, 10), (7, 10)], exit=(7, 11),
)
# 4 · Casa de la taula parada — la Gran Guerra s'hi va quedar aturada (proposta: un «eco»)
place(
    id='taula', name='Casa de la taula parada', kind='interior', house=(4, 0), door=(6, 11),
    text='Una casa on el temps es va aturar: la taula encara parada per sopar, cadires bolcades i el terra cremat.',
    grid="""
::::T:::::::T::::
:###############:
:#======#======#:
:#======D======#:
:#======###C####:
:#======D======#:
:#======#======#:
:##D###D########:
:,,,#=====#....T:
:,,,#=====#.....:
:,,.##B####.....:
:,,,:::::::::T:::
::,,,::::::::::::
:T:,,,:::::::::::
""",
    rooms=[('Menjador', 4, 4, True), ('Cambra', 11, 2, True), ('Rebost', 11, 5, True), ('Obrador', 7, 8, True)],
    spawn=[(2, 8), (3, 8), (2, 9), (3, 9), (1, 9)], exit=(2, 12),
)
# 5 · Rectoria — la casa del capellà, al costat de la capella (proposta)
place(
    id='rectoria', name='Rectoria', kind='interior', house=(6, 1),
    text="La casa del capellà: una biblioteca de llibres florits, la cel·la i una cuineta. Al costat, l'hort abandonat.",
    grid="""
:::::::::::::T::
:#######::::::::
:#=====#:eeeee::
:#=====#:eeeee::
:#=====######:::
:###D###____#:::
:#=====#____#:::
:#=====D____#:::
:#=====#____#:::
:#=====######:::
:#=====#::::T:::
:###D###::::::::
:::,,,::::::::::
:T,,,,::::::::T:
""",
    rooms=[('Biblioteca', 4, 3, True), ('Cel·la del rector', 4, 8, True), ('Cuineta', 10, 6, True)],
    spawn=[(3, 12), (4, 12), (5, 12), (3, 13), (4, 13)], exit=(4, 12),
)
# 6 · Capella enrunada — «una capella de pedra amb el campanar mig esfondrat» (wiki)
place(
    id='capella', name='Capella enrunada', kind='interior', house=(7, 0), door=(24, 16),
    text='La nau amb un forat al sostre, la campana caiguda entre la runa, la sagristia i un petit cementiri.',
    grid="""
:::::::::::::::::::::
::::SSSSSSSSSSSSS::T:
::::S___________S::::
::::S___________B::::
::::S___________S::::
::::S___________S::::
::::S___________S::::
::::S___________S::::
::::S___________S::::
::::SSSSSDDSSDSSS::::
:::::::::,,S____S::::
:::::::::,,S____S::::
:::::::::,,S____S::::
:::::::::,,SSSSSS::T:
:T::::::,,,,:::::::::
""",
    rooms=[('Nau', 10, 5, True), ('Sagristia', 13, 11, True)],
    spawn=[(9, 10), (10, 10), (9, 11), (10, 11), (9, 12)], exit=(9, 13),
)
# 7 · Hostal vell — «un hostal gran amb pati i estables, buit des de fa generacions» (wiki)
place(
    id='hostal', name='Hostal vell', kind='interior', house=(9, 0), door=(24, 21),
    text='La sala comuna amb la barra, la cuina, el rebost i els estables. Al pati, un carro que ja no anirà enlloc.',
    grid="""
:::::::::::::::::::T::
:###########::::::::::
:#____#____#::::::::::
:#____D____##########:
:##D####D###eeeeeeee#:
:#=========#eeeeeeee#:
:#=========#eeeeeeee#:
:#=========Deeeeeeee#:
:#=========#eeeeeeee#:
:#=========#eeeeeeee#:
:####D#########DD####:
:::,,,,,,,,,,,,,,,::::
:T:,,,,,,,,,,,,,,,,:T:
:::::,,,,:::::::::::::
""",
    rooms=[('Cuina', 3, 2, True), ('Rebost', 8, 2, True), ('Sala comuna', 6, 7, True), ('Estables', 15, 6, True)],
    spawn=[(4, 11), (5, 11), (6, 11), (4, 12), (5, 12)], exit=(5, 12),
)

# ── mobles i decorat de cada lloc ───────────────────────────────────────────
# (peça, columna, fila, dx, dy[, 'floor' | 'wall']) en px d'art des de la cantonada de la casella.
# 'floor' = arran de terra (sota les parets i els mobles); 'wall' = penjat a la cara d'una paret.
# Les peces que van contra la paret del nord (prestatgeries, llars) pugen damunt de la seva cara.
def north(fn, c, r, h, dx=0):
    """Peça contra la paret del nord: la base a mitja casella, el cos damunt de la cara."""
    return (fn, c, r, dx, A // 2 - h + 6)

def F_farga():
    return [
        # casa del ferrer
        north(lambda: I.hearth(40, seed=1, pot=True), 2, 2, 26), (lambda: I.shelf(34, 4, 'jars'), 4, 2, 6, -10),
        (lambda: I.rug(60, 40, 'green', 5), 2, 3, 10, 2, 'floor'), (lambda: I.table(44, 20, 3, ('mugs', 'plates')), 3, 3, 0, 4),
        (I.stool, 2, 3, 12, 10), (I.stool, 4, 4, 6, 2), (I.tipped_chair, 5, 4, 0, 6), (lambda: I.cobweb(2), 5, 2, 12, -2),
        (lambda: I.bed('blue', 6), 7, 2, 2, 0), (I.chest, 8, 4, 0, 2), (lambda: I.scorch(36, 26, 7), 7, 4, 0, 0, 'floor'),
        (lambda: I.cobweb(4), 8, 2, 10, -2),
        # taller (obert al pati)
        (lambda: I.forge(48, 40, 8), 12, 2, 0, -10), (I.bellows, 14, 2, 2, 6), (lambda: I.tool_rack(70), 15, 1, 0, 9, 'wall'),
        (lambda: I.table(56, 18, 9), 15, 3, 0, 2), (lambda: I.scrap(10, 5), 15, 3, 10, -2), (lambda: I.trough(36, True, R['stone']), 12, 4, 2, 4),
        (lambda: I.coal(24, 14, 10), 16, 5, 0, 0), (lambda: I.scrap(11), 13, 5, 6, 6), (I.grindstone, 17, 4, -4, 0),
        (I.barrel, 14, 5, 6, 0), (lambda: I.rubble(30, 22, 12), 17, 3, 4, 2), (lambda: I.weeds(13), 17, 2, 4, 8, 'floor'),
        (lambda: I.woodpile(46, 14), 10, 3, -10, 0),
        # pati
        (lambda: I.anvil(True, 14), 10, 7, 0, 0), (lambda: I.wheel(9, False), 9, 5, 4, 10), (lambda: I.cart(15), 2, 8, 0, 0),
        (lambda: I.wheel(8, True), 5, 9, 6, 2), (lambda: I.scrap(16, 6), 13, 7, 0, 4), (I.bucket, 12, 7, 6, 10), (I.barrel, 16, 7, 0, 0),
        (lambda: I.dry_bush(1), 0, 7, 0, 0), (lambda: I.dry_bush(2), 18, 8, 0, 0), (lambda: I.weeds(17, 8, 24, 16), 6, 7, 0, 0, 'floor'),
        (lambda: I.weeds(18, 6), 14, 9, 0, 0, 'floor'), (I.stump, 7, 7, 0, 6), (lambda: I.woodpile(40, 19), 6, 6, 0, -4),
        (lambda: I.coal(20, 12, 20), 12, 6, 4, 2), (lambda: I.sacks(2, 21), 14, 6, 0, 0), (lambda: I.crate(22), 3, 10, 0, 0),
        (lambda: I.trough(40, True), 2, 6, 0, 8), (lambda: I.rubble(26, 16, 23), 19, 4, -2, 0), (lambda: I.dry_bush(3), 4, 11, 0, 0),
        (lambda: I.dry_bush(4), 15, 10, 0, 0), (lambda: I.scrap(24, 9), 7, 9, 0, 0),
    ]

def F_batlle():
    return [
        # despatx
        (lambda: I.shelf(64, 21), 2, 2, 8, -10), (lambda: I.rug(60, 40, 'blue', 24), 2, 3, 12, 2, 'floor'),
        (lambda: I.table(44, 20, 22, ('papers', 'candle', 'book')), 3, 3, 0, 2), (lambda: I.chair(), 3, 3, 16, 14),
        (I.chest, 5, 4, 0, 0), (lambda: I.papers(23, 6), 2, 4, 0, 4, 'floor'), (lambda: I.cobweb(0), 2, 2, -4, -2),
        # sala gran
        north(lambda: I.hearth(44, seed=25), 10, 2, 26, 2), (lambda: I.rug(150, 50, 'red', 26), 7, 3, 20, 0, 'floor'),
        (lambda: I.table(130, 22, 27, ('plates', 'mugs', 'cloth')), 8, 3, 0, 4),
        (lambda: I.bench(110, 28), 8, 3, 10, -6), (lambda: I.bench(100, 29), 8, 4, 16, 8), (I.tipped_chair, 13, 4, 12, 8),
        (I.candelabra, 7, 2, 2, -2), (I.candelabra, 14, 2, 4, -2), (lambda: I.cobweb(4), 14, 2, 12, -2), (lambda: I.shards(30), 12, 4, 0, 10, 'floor'),
        # cambra
        (lambda: I.bed('red', 31), 16, 2, 2, 0), (lambda: I.wardrobe(22), 18, 2, 0, -8), (I.chest, 16, 4, 0, 10),
        (lambda: I.rug(40, 26, 'green', 32), 17, 3, 4, 8, 'floor'), (lambda: I.cobweb(1), 19, 2, 8, -2),
        # cuina
        north(lambda: I.hearth(40, seed=33, pot=True), 2, 6, 26), (lambda: I.table(36, 18, 35, ('mugs',)), 2, 7, 8, 6),
        (I.barrel, 4, 6, 4, -2), (lambda: I.sacks(2, 36), 3, 8, 0, 4), (lambda: I.shards(37), 2, 8, 0, 8, 'floor'),
        # rebost
        (I.barrel, 2, 10, 0, -2), (I.barrel, 3, 10, 0, 0), (lambda: I.crate(38), 4, 10, 0, 0), (lambda: I.sacks(3, 39), 2, 11, 0, 2),
        (lambda: I.jar('ochre', True), 4, 11, 4, 4), (lambda: I.bones(1), 3, 11, 6, 8, 'floor'),
        # magatzem esfondrat
        (lambda: I.light_patch(84, 70, 40), 16, 7, 0, 0, 'floor'), (lambda: I.rubble(50, 30, 41), 16, 6, 6, 4),
        (lambda: I.beam(70, 0.35, 42), 16, 8, 0, 0), (lambda: I.beam(54, -0.5, 43), 17, 10, 0, 0),
        (lambda: I.crate(44), 18, 11, 0, 0), (lambda: I.dry_bush(3), 18, 7, 0, 0), (lambda: I.dry_bush(4), 16, 11, 0, 0),
        (lambda: I.weeds(45, 9, 30, 20), 17, 8, 0, 0, 'floor'), (lambda: I.rubble(26, 18, 46), 19, 9, 6, 2),
        # pati
        (lambda: V.canopy(3 * A, 26, 47, R['dry'], clump=5.5, leafy=1.2), 12, 8, 0, -4), (lambda: I.weeds(48, 10, 40, 30), 6, 6, 0, 0, 'floor'),
        (lambda: I.weeds(49, 8, 30, 24), 12, 10, 0, 0, 'floor'), (lambda: I.bench(50, 50), 6, 11, 4, 6), (lambda: I.dry_bush(5), 14, 11, 0, 0),
        (lambda: I.dry_bush(6), 6, 7, 0, 0), (lambda: I.wheel(9, True), 8, 10, 0, 0), (I.barrel, 13, 6, 6, 0),
    ]

def F_graner():
    return [
        (lambda: I.straw_floor(11 * A, 6 * A, 60), 2, 2, 0, 0, 'floor'), (lambda: I.straw_floor(4 * A, 3 * A, 61), 13, 5, 0, 0, 'floor'),
        (lambda: I.light_patch(90, 76, 62), 9, 2, 4, 0, 'floor'), (lambda: I.weeds(63, 10, 40, 30), 10, 3, 0, 0, 'floor'),
        (lambda: I.hay(60, 40, 64), 2, 2, 2, 2), (lambda: I.hay(44, 30, 65), 4, 3, 4, 2), (lambda: I.hay(40, 26, 66), 2, 6, 4, 0),
        (lambda: I.ladder(44), 12, 2, 6, -6), (lambda: I.rubble(40, 26, 67), 10, 2, 2, -4), (lambda: I.beam(80, 0.45, 68), 8, 3, 0, 0),
        (lambda: I.dry_bush(10), 9, 3, 0, 4), (lambda: I.dry_bush(11), 11, 4, 0, 4), (lambda: I.dry_bush(12, 2 * A, 15), 5, 5, 0, 0),
        (lambda: I.dry_bush(13), 10, 6, 0, 0), (lambda: I.cart(69), 7, 5, 0, 0), (lambda: I.sacks(3, 70), 3, 7, 0, 0), (I.barrel, 6, 2, 0, 0),
        (lambda: I.wheel(9, True), 12, 7, 0, 0), (lambda: I.cobweb(3), 2, 2, -4, -4),
        # estables (envans baixos)
        (lambda: I.stall_board(3 * A - 6), 14, 5, -4, 0), (lambda: I.stall_board(3 * A - 6), 16, 5, -4, 0),
        (lambda: I.trough(40, False), 14, 5, 4, 2), (lambda: I.trough(40, False), 15, 5, 16, 2), (lambda: I.hay(30, 20, 71), 15, 7, 0, 0),
        (I.saddle, 14, 7, 0, 4), (I.bucket, 16, 7, 6, 6),
        # racó del pagès
        (lambda: I.hay(36, 22, 72, R['straw']), 14, 2, 0, 0), (lambda: I.small_table(12), 16, 2, 0, 4), (I.stool, 15, 3, 6, 6),
        (lambda: I.cobweb(1), 16, 2, 10, -4),
        # fora
        (lambda: I.dry_bush(14), 2, 9, 0, 0), (lambda: I.dry_bush(15), 12, 10, 0, 0), (lambda: I.weeds(73, 8, 30, 20), 10, 9, 0, 0, 'floor'),
    ]

def F_taula():
    return [
        # menjador: la taula parada, una cadira bolcada, el terra cremat
        north(lambda: I.hearth(40, seed=80, pot=True), 2, 2, 26), (lambda: I.shelf(40, 81, 'jars'), 5, 2, 4, -10),
        (lambda: I.scorch(80, 64, 82), 4, 4, 6, 0, 'floor'), (lambda: I.scorch(40, 32, 83), 2, 5, 0, 8, 'floor'),
        (lambda: I.table(60, 26, 84, ('plates', 'mugs', 'cloth')), 3, 3, 4, 2),
        (I.chair, 3, 3, 4, -8), (I.chair, 4, 3, 10, -8), (lambda: I.chair(True), 3, 4, 8, 8), (I.tipped_chair, 5, 4, 0, 12),
        (lambda: I.cradle(), 7, 5, 0, 0), (I.toy_horse, 2, 5, 10, 10), (lambda: I.shards(85), 5, 4, 0, 6, 'floor'), (lambda: I.cobweb(4), 7, 2, 10, -2),
        (I.chest, 2, 6, 0, 2),
        # cambra
        (lambda: I.bed('red', 86), 9, 2, 2, 0), (lambda: I.bed('blue', 87, 16, 36), 11, 2, 0, 0), (lambda: I.bed('green', 88, 16, 36), 13, 2, 0, 0),
        (lambda: I.cobweb(1), 14, 2, 8, -2),
        # rebost
        (lambda: I.trapdoor(), 13, 6, 2, 0, 'floor'), (I.barrel, 9, 5, 0, -2), (I.barrel, 10, 5, 0, 0), (lambda: I.sacks(2, 90), 11, 5, 0, 2),
        (lambda: I.jar('green', True), 14, 5, 0, 2), (lambda: I.shards(91, 'green'), 12, 6, 0, 6, 'floor'), (lambda: I.crate(92), 9, 6, 4, 0),
        # obrador
        (I.loom, 5, 8, 4, 0), (I.stool, 6, 9, 0, 0), (lambda: I.sacks(2, 93), 8, 8, 0, 2), (lambda: I.rubble(36, 22, 94), 5, 9, 6, 8),
        (lambda: I.weeds(95, 8, 30, 20), 7, 9, 0, 0, 'floor'), (lambda: I.cobweb(0), 5, 8, -4, -6),
        # fora
        (lambda: I.dry_bush(16), 12, 9, 0, 0), (lambda: I.weeds(96, 9, 40, 24), 11, 8, 0, 0, 'floor'),
    ]

def F_rectoria():
    return [
        # biblioteca
        (lambda: I.shelf(60, 100), 2, 2, 0, -10), (lambda: I.shelf(54, 101), 4, 2, 14, -10), (lambda: I.rug(70, 40, 'red', 102), 2, 3, 12, 0, 'floor'),
        (I.lectern, 4, 3, 4, 4), (lambda: I.table(40, 18, 103, ('papers', 'candle')), 2, 4, 0, 0),
        (lambda: I.papers(104, 7), 5, 3, 0, 4, 'floor'), (lambda: I.papers(105, 4), 3, 3, 0, 0, 'floor'), (lambda: I.cobweb(4), 6, 2, 6, -2),
        # cel·la
        (lambda: I.bed('blue', 106), 2, 6, 0, 0), (I.stool, 4, 6, 4, 6), (lambda: I.small_table(14), 5, 6, 4, -4), (I.chest, 5, 9, 4, 0),
        (lambda: I.rug(36, 24, 'green', 107), 3, 8, 6, 0, 'floor'), (I.candelabra, 6, 6, 4, -4), (lambda: I.cobweb(1), 6, 6, 10, -2),
        (lambda: I.papers(108, 3), 3, 9, 0, 6, 'floor'), (lambda: I.wardrobe(20), 2, 9, 0, -6), (I.stool, 4, 8, 12, 0),
        # cuineta
        north(lambda: I.hearth(40, seed=109, pot=True), 8, 5, 26), (lambda: I.shelf(36, 110, 'jars'), 10, 5, 4, -10),
        (lambda: I.small_table(12), 9, 7, 0, 0), (I.barrel, 11, 7, 4, 0), (lambda: I.sacks(2, 111), 8, 8, 0, 0),
        (lambda: I.shards(112), 10, 8, 0, 6, 'floor'),
        # hort
        (lambda: I.weeds(113, 14, 5 * A, 2 * A), 9, 2, 0, 0, 'floor'), (lambda: I.dry_bush(20), 10, 2, 0, 0), (lambda: I.dry_bush(21), 12, 3, 0, 0),
        (lambda: I.dry_bush(22), 13, 1, 6, 0),
    ]

def F_capella():
    return [
        # nau
        (lambda: I.light_patch(130, 100, 120), 8, 4, 0, 0, 'floor'), (lambda: I.weeds(121, 12, 60, 50), 9, 5, 0, 0, 'floor'),
        (lambda: I.altar(64, 122), 9, 2, 4, -2), (I.candelabra, 8, 2, 6, -2), (I.candelabra, 12, 2, 2, -2),
        (I.statue, 6, 2, 0, -8), (I.statue, 14, 2, 0, -8), (I.lectern, 12, 3, 4, 6), (lambda: I.rug(60, 30, 'red', 123), 9, 3, 6, 6, 'floor'),
        (lambda: I.pew(60, 124), 5, 5, 4, 0), (lambda: I.broken_pew(60, 125), 5, 6, 4, 6), (lambda: I.pew(60, 126), 5, 7, 4, 12),
        (lambda: I.pew(60, 127), 12, 5, 0, 0), (lambda: I.pew(60, 128), 12, 6, 0, 6), (lambda: I.broken_pew(60, 129), 12, 7, 0, 12),
        (lambda: I.rubble(56, 44, 130), 14, 3, 0, -6), (I.bell, 14, 4, 8, 6), (lambda: I.beam(70, 0.6, 131), 12, 3, 0, 4),
        (lambda: I.beam(60, -0.25, 132), 8, 6, 0, 4), (lambda: I.rubble(30, 20, 133), 10, 6, 0, 6),
        (lambda: I.cobweb(0), 5, 2, -4, -2), (lambda: I.cobweb(4), 15, 8, 8, 6), (lambda: I.dry_bush(30), 6, 8, 0, 0),
        # sagristia
        (lambda: I.wardrobe(24), 12, 10, 0, -8), (I.chest, 15, 10, 0, 0), (lambda: I.shelf(30, 134), 14, 10, -6, -10),
        (lambda: I.small_table(14), 13, 12, 0, -4), (lambda: I.cobweb(1), 15, 10, 8, -2),
        # fora: el campanar caigut i el cementiri
        (lambda: I.rubble(60, 70, 135), 17, 1, 0, 0), (lambda: I.rubble(40, 30, 136), 17, 5, 4, 0),
        (lambda: I.tombstone(), 1, 2, 0, 0), (lambda: I.tombstone(True), 2, 4, 4, 2), (lambda: I.tombstone(), 0, 6, 8, 0),
        (lambda: I.tombstone(), 2, 7, 0, 0), (lambda: I.tombstone(True), 1, 9, 4, 0), (lambda: I.tombstone(), 3, 11, 0, 0),
        (lambda: I.tombstone(), 6, 11, 0, 0), (lambda: I.tombstone(True), 5, 13, 0, 0), (lambda: I.dry_bush(31), 1, 12, 0, 0),
        (lambda: I.dry_bush(32), 18, 9, 0, 0), (lambda: I.weeds(137, 10, 60, 40), 1, 4, 0, 0, 'floor'),
    ]

def F_hostal():
    return [
        # cuina
        north(lambda: I.hearth(40, seed=140, pot=True), 2, 2, 26), (lambda: I.table(36, 16, 141, ('mugs',)), 3, 3, 4, -2),
        (I.barrel, 5, 2, 0, -2), (lambda: I.sacks(2, 142), 2, 3, 0, 6), (lambda: I.shards(143), 4, 3, 0, 10, 'floor'),
        # rebost
        (lambda: I.keg_rack(3), 7, 2, 2, -8), (I.barrel, 10, 2, 0, 0), (lambda: I.crate(144), 9, 3, 0, 2), (lambda: I.trapdoor(), 7, 3, 2, 0, 'floor'),
        (lambda: I.cobweb(4), 10, 2, 8, -2),
        # sala comuna
        north(lambda: I.hearth(44, seed=145), 2, 5, 26), (lambda: I.keg_rack(3), 7, 5, 6, -8), (lambda: I.counter(70, 10, 146), 7, 6, 2, 4),
        (lambda: I.rug(70, 44, 'red', 147), 2, 6, 12, 10, 'floor'),
        (lambda: I.small_table(12), 3, 7, 0, 0), (I.stool, 2, 7, 8, 6), (I.stool, 4, 7, 4, 4),
        (lambda: I.small_table(13), 5, 8, 4, 4), (I.stool, 6, 8, 6, 8), (I.tipped_chair, 4, 9, 0, 6),
        (lambda: I.table(56, 18, 148, ('mugs', 'plates')), 7, 8, 0, 4), (lambda: I.bench(52, 149), 7, 9, 2, 4),
        (lambda: I.stairs_up(), 10, 8, 0, 0, 'floor'), (lambda: I.stairs_up(), 10, 9, 0, 0, 'floor'),
        (lambda: I.shards(150), 6, 6, 0, 10, 'floor'), (lambda: I.cobweb(0), 2, 5, -4, -2),
        # estables
        (lambda: I.straw_floor(8 * A, 6 * A, 151), 12, 4, 0, 0, 'floor'),
        (lambda: I.stall_board(3 * A), 14, 4, -4, -4), (lambda: I.stall_board(3 * A), 16, 4, -4, -4), (lambda: I.stall_board(3 * A), 18, 4, -4, -4),
        (lambda: I.trough(40, False), 12, 4, 2, 0), (lambda: I.trough(40, False), 14, 4, 4, 0), (lambda: I.trough(40, False), 16, 4, 4, 0),
        (lambda: I.trough(40, True), 18, 4, 4, 0), (lambda: I.hay(40, 26, 152), 17, 8, 0, 0), (lambda: I.hay(34, 22, 153), 12, 8, 4, 4),
        (I.saddle, 13, 7, 0, 0), (I.bucket, 15, 7, 6, 4), (lambda: I.wheel(9), 15, 9, 0, 0), (lambda: I.dry_bush(40), 19, 7, 0, 0),
        (lambda: I.cobweb(1), 19, 4, 8, -2),
        # pati
        (lambda: I.cart(154), 9, 11, 0, 0), (lambda: I.trough(48, True, R['stone']), 17, 11, 0, 4), (I.barrel, 2, 11, 0, 4),
        (lambda: I.dry_bush(41), 0, 11, 0, 0), (lambda: I.weeds(155, 10, 40, 24), 12, 12, 0, 0, 'floor'), (lambda: I.weeds(156, 8, 30, 20), 1, 12, 0, 0, 'floor'),
    ]

FURNITURE = {'farga': F_farga, 'batlle': F_batlle, 'graner': F_graner, 'taula': F_taula, 'rectoria': F_rectoria, 'capella': F_capella, 'hostal': F_hostal}

# ── graella ─────────────────────────────────────────────────────────────────
def parse(p):
    rows = [r for r in p['grid'].strip('\n').split('\n')]
    w = len(rows[0])
    for i, r in enumerate(rows):
        assert len(r) == w, f"{p['id']}: la fila {i} fa {len(r)} caràcters i no {w}"
    return rows

def ch(G, c, r):
    if r < 0 or r >= len(G) or c < 0 or c >= len(G[0]): return 'x'
    return G[r][c]

def is_wall(G, c, r): return ch(G, c, r) in WALLS
def is_open(G, c, r):
    k = ch(G, c, r); return k not in WALLS and k != 'x'

def door_axis(G, c, r):
    """'h' = porta en una paret horitzontal (parets o portes a esquerra i dreta)."""
    side = lambda k: k in WALLS or k in DOORS
    return 'h' if side(ch(G, c - 1, r)) and side(ch(G, c + 1, r)) else 'v'

def floor_of(G, c, r):
    """Terra d'una casella de porta: el de la casella del costat de dins."""
    order = ((0, 1), (0, -1), (1, 0), (-1, 0)) if door_axis(G, c, r) == 'h' else ((1, 0), (-1, 0), (0, 1), (0, -1))
    for dc, dr in order:
        k = ch(G, c + dc, r + dr)
        if k in FLOORS: return FLOORS[k]
    for dc, dr in order:
        k = ch(G, c + dc, r + dr)
        if k in OUTSIDE: return 'out'
    return 'earth'

# ── geometria de joc (mateix criteri que `src/lib/tilemap/geometry.ts`) ──────
def geometry(G):
    rows, cols = len(G), len(G[0])
    h, v = {}, {}
    for r in range(rows):
        for c in range(cols):
            if not is_wall(G, c, r): continue
            if is_open(G, c, r - 1): h.setdefault(r, []).append(c)
            if is_open(G, c, r + 1): h.setdefault(r + 1, []).append(c)
            if is_open(G, c - 1, r): v.setdefault(c, []).append(r)
            if is_open(G, c + 1, r): v.setdefault(c + 1, []).append(r)
    walls = []
    def merge(lines, horiz):
        for k, lst in lines.items():
            s = sorted(set(lst)); start = prev = s[0]
            def flush(a, b):
                walls.append((a * CELL, k * CELL, (b + 1) * CELL, k * CELL) if horiz else (k * CELL, a * CELL, k * CELL, (b + 1) * CELL))
            for x in s[1:]:
                if x == prev + 1: prev = x; continue
                flush(start, prev); start = prev = x
            flush(start, prev)
    merge(h, True); merge(v, False)
    doors = []
    for r in range(rows):
        for c in range(cols):
            k = G[r][c]
            if k not in DOORS: continue
            seg = ((c * CELL, (r + .5) * CELL, (c + 1) * CELL, (r + .5) * CELL) if door_axis(G, c, r) == 'h'
                   else ((c + .5) * CELL, r * CELL, (c + .5) * CELL, (r + 1) * CELL))
            walls.append(seg)
            doors.append((*seg, 0 if k == 'C' else 1))
    return walls, doors

# ── dibuix ──────────────────────────────────────────────────────────────────
CAP = R['cap']
CAP_STONE = [(46, 44, 38), (60, 58, 50), (74, 72, 62), (90, 88, 76), (110, 108, 94)]
H = lambda c, r: ((c * 73856093) ^ (r * 19349663)) & 0xffffffff

def render(p, G, items):
    rows, cols = len(G), len(G[0])
    cv = np.zeros((rows * A, cols * A, 4), np.uint8)
    T = I.floor_tiles(); OV = V.overlays(T)
    # 1 · fora: herba, herba alta i camí (graella dual, com el poble)
    for r in range(rows):
        for c in range(cols): over(cv, T['grass'][H(c, r) % 4], c * A, r * A)
    kind = lambda c, r: ch(G, min(max(c, 0), cols - 1), min(max(r, 0), rows - 1))
    for key, members in (('meadow', ':T'), ('path', ',')):
        for j in range(rows + 1):
            for i in range(cols + 1):
                b = sum(1 << k for k, (c, r) in enumerate(((i - 1, j - 1), (i, j - 1), (i, j), (i - 1, j))) if kind(c, r) in members)
                if b: over(cv, T[key][H(i, j) % len(T[key])] if b == 15 else OV[key][b], i * A - A // 2, j * A - A // 2)
    # 2 · terres de dins (també sota les portes) i el buit
    for r in range(rows):
        for c in range(cols):
            k = G[r][c]
            f = FLOORS.get(k) or (floor_of(G, c, r) if k in DOORS else None)
            if k == 'x': fill(cv, c * A, r * A, (c + 1) * A, (r + 1) * A, I.VOID)
            elif f and f != 'out': over(cv, T[f][H(c, r) % 4], c * A, r * A)
            elif k in WALLS: fill(cv, c * A, r * A, (c + 1) * A, (r + 1) * A, CAP[1])
    # 3 · el que va arran de terra (catifes, cremats, palla, clapes de llum, males herbes)
    for it in sorted([i for i in items if len(i) > 5 and i[5] == 'floor'], key=lambda i: i[2]):
        fn, c, r, dx, dy = it[:5]; over(cv, fn(), c * A + dx, r * A + dy)
    # 4 · ombra de les parets al terra (llum de dalt a l'esquerra) i una mica d'oclusió a tot el voltant
    wm = np.zeros((rows * A, cols * A), bool)
    for r in range(rows):
        for c in range(cols):
            if is_wall(G, c, r): wm[r * A:(r + 1) * A, c * A:(c + 1) * A] = True
    sh = np.zeros_like(wm); sh[4:, 4:] = wm[:-4, :-4]; sh &= ~wm
    occ = V.dilate(wm) & ~wm
    for m, a in ((sh, 0.30), (occ, 0.22)):
        cv[m, :3] = np.round(cv[m, :3] * (1 - a) + np.array(SHADOW_RGB) * a).astype(np.uint8)
    # 5 · parets: tapa (el gruix vist de dalt) i cara (la que mira al sud)
    for r in range(rows):
        for c in range(cols):
            if is_wall(G, c, r): draw_wall(cv, G, c, r)
            elif G[r][c] in DOORS: draw_door(cv, G, c, r)
    # 6 · coses de paret i mobles, de dalt a baix
    wall_items = [i for i in items if len(i) > 5 and i[5] == 'wall']
    for fn, c, r, dx, dy, *_ in wall_items: over(cv, fn(), c * A + dx, r * A + dy)
    rest = [i for i in items if not (len(i) > 5 and i[5] in ('floor', 'wall'))]
    trees = []
    for r in range(rows):
        for c in range(cols):
            if G[r][c] == 'T':
                rng = np.random.default_rng(H(c, r))
                k = ['tree_m', 'tree_l', 'bush', 'tree_m'][int(rng.integers(0, 4))]
                trees.append((k, (c + .5) * A + rng.uniform(-4, 4), (r + .5) * A + rng.uniform(-4, 4), int(rng.integers(0, 4))))
    built = [(fn(), c * A + dx, r * A + dy) for fn, c, r, dx, dy, *_ in rest]
    Tr = V.trees()
    built += [(Tr[k][i % len(Tr[k])], int(x - Tr[k][0].shape[1] / 2), int(y - Tr[k][0].shape[0] / 2)) for k, x, y, i in trees]
    for im, x, y in sorted(built, key=lambda b: b[2] + b[0].shape[0]):
        over(cv, im, x, y)
    return cv

SHADOW_RGB = (34, 30, 18)

def draw_wall(cv, G, c, r):
    stone = G[r][c] == 'S'
    S = CAP_STONE if stone else CAP
    x0, y0 = c * A, r * A
    face = is_open(G, c, r + 1)
    capH = 8 if face else A
    rng = np.random.default_rng(H(c, r) + 3)
    n = V.vnoise(A, A, 4, H(c, r) % 997)
    cap = np.round(V.ramp(S, 0.42 + (n - 0.5) * 0.3)).astype(np.uint8)
    cv[y0:y0 + capH, x0:x0 + A, :3] = cap[:capH]; cv[y0:y0 + capH, x0:x0 + A, 3] = 255
    # vores de la tapa: clares on hi toca la llum (dalt, esquerra), fosques a l'altra banda
    if is_open(G, c, r - 1): fill(cv, x0, y0, x0 + A, y0 + 1, S[4])
    if is_open(G, c - 1, r): fill(cv, x0, y0, x0 + 1, y0 + capH, S[3])
    if is_open(G, c + 1, r): fill(cv, x0 + A - 1, y0, x0 + A, y0 + capH, S[0])
    if not face: return
    fill(cv, x0, y0 + capH - 1, x0 + A, y0 + capH, S[3])
    fy0, fy1 = y0 + capH, y0 + A
    if stone:
        P = R['stone']
        for k, yy in enumerate(range(fy0, fy1, 5)):
            off = (k * 5 + c * 7) % 9
            fill(cv, x0, yy, x0 + A, min(yy + 5, fy1), P[2])
            fill(cv, x0, yy, x0 + A, yy + 1, P[3])
            for xx in range(x0 - off, x0 + A, 9):
                lv = 1 + int(rng.integers(0, 3)) % 3
                fill(cv, max(xx + 1, x0), yy + 1, min(xx + 8, x0 + A), min(yy + 4, fy1), P[lv])
                if xx >= x0: fill(cv, xx, yy, xx + 1, min(yy + 5, fy1), P[0])
            fill(cv, x0, min(yy + 4, fy1 - 1), x0 + A, min(yy + 5, fy1), P[0])
        if rng.random() < 0.35:   # molsa al peu
            for i in range(int(rng.integers(3, 8))):
                xx = x0 + int(rng.integers(0, A - 2)); hh = int(rng.integers(1, 5))
                fill(cv, xx, fy1 - hh, xx + int(rng.integers(1, 4)), fy1, R['leaf'][int(rng.integers(1, 4))])
    else:
        P = R['plaster']; W = R['wood_dk']
        n2 = V.vnoise(16, A, 5, H(c, r) % 991 + 7)
        pl = np.round(V.ramp(P, 0.44 + (n2 - 0.5) * 0.45)).astype(np.uint8)
        cv[fy0:fy1, x0:x0 + A, :3] = pl[:fy1 - fy0]; cv[fy0:fy1, x0:x0 + A, 3] = 255
        # arrebossat caigut: es veu el canyís
        if rng.random() < 0.32:
            hx, hy = x0 + int(rng.integers(2, 12)), fy0 + int(rng.integers(3, 8))
            hw, hh = int(rng.integers(5, 10)), int(rng.integers(3, 6))
            fill(cv, hx, hy, hx + hw, hy + hh, R['wood'][1])
            for yy in range(hy, hy + hh, 2): fill(cv, hx, yy, hx + hw, yy + 1, R['wood'][2])
            fill(cv, hx, hy, hx + hw, hy + 1, P[1])
        # entramat de fusta: biga de dalt, muntants i sòcol
        fill(cv, x0, fy0, x0 + A, fy0 + 2, W[2]); fill(cv, x0, fy0, x0 + A, fy0 + 1, W[3])
        for xx in range(x0 - (x0 % 12), x0 + A, 12):
            if xx >= x0: fill(cv, xx, fy0, xx + 2, fy1, W[2]); fill(cv, xx, fy0, xx + 1, fy1, W[3])
        fill(cv, x0, fy1 - 3, x0 + A, fy1, W[1]); fill(cv, x0, fy1 - 3, x0 + A, fy1 - 2, W[2])
        if rng.random() < 0.3:   # heura que puja
            vi = I.vine(14, H(c, r) % 1000); over(cv, vi, x0 + int(rng.integers(0, 10)), fy1 - 14)
    fill(cv, x0, fy1 - 1, x0 + A, fy1, (40, 34, 24))

def draw_door(cv, G, c, r):
    k = G[r][c]; x0, y0 = c * A, r * A
    axis = door_axis(G, c, r)
    stone = 'S' in (ch(G, c - 1, r), ch(G, c + 1, r), ch(G, c, r - 1), ch(G, c, r + 1))
    S = CAP_STONE if stone else CAP
    if k == 'B':   # esvoranc: restes de paret i runa
        rb = I.rubble(A + 8, 14, H(c, r) % 500, R['stone'] if stone else R['plaster'])
        if axis == 'h':
            fill(cv, x0, y0, x0 + 5, y0 + 8, S[2]); fill(cv, x0 + A - 4, y0, x0 + A, y0 + 6, S[2])
            over(cv, rb, x0 - 4, y0 + 6)
        else:
            fill(cv, x0, y0, x0 + A, y0 + 4, S[2]); fill(cv, x0, y0 + A - 3, x0 + A, y0 + A, S[2])
            over(cv, rb, x0 - 4, y0 + 5)
        return
    W = R['wood']
    if axis == 'h':
        # la tapa continua per sobre (llinda) i a sota s'obre el pas, amb els brancals
        cap_face = is_open(G, c, r + 1)
        fill(cv, x0, y0, x0 + A, y0 + 7, S[2]); fill(cv, x0, y0 + 6, x0 + A, y0 + 7, S[3])
        if is_open(G, c, r - 1): fill(cv, x0, y0, x0 + A, y0 + 1, S[4])
        fill(cv, x0, y0 + 7, x0 + A, y0 + 10, (34, 30, 24))
        fill(cv, x0, y0 + 7, x0 + 2, y0 + A, R['wood_dk'][2]); fill(cv, x0 + A - 2, y0 + 7, x0 + A, y0 + A, R['wood_dk'][1])
        if k == 'C':
            fill(cv, x0 + 2, y0 + 8, x0 + A - 2, y0 + A, W[2])
            for xx in range(x0 + 6, x0 + A - 2, 5): fill(cv, xx, y0 + 8, xx + 1, y0 + A, W[1])
            fill(cv, x0 + 2, y0 + 8, x0 + A - 2, y0 + 9, W[3]); fill(cv, x0 + A - 7, y0 + 15, x0 + A - 5, y0 + 17, R['metal'][3])
        else:   # fulla oberta contra el brancal (vista de cantell)
            fill(cv, x0 + 2, y0 + 9, x0 + 5, y0 + A + 6, W[2]); fill(cv, x0 + 2, y0 + 9, x0 + 3, y0 + A + 6, W[3])
            fill(cv, x0 + 5, y0 + 10, x0 + 7, y0 + A + 7, (34, 30, 18, ))
    else:
        fill(cv, x0, y0, x0 + A, y0 + 3, S[2]); fill(cv, x0, y0 + A - 3, x0 + A, y0 + A, S[2]); fill(cv, x0, y0 + A - 3, x0 + A, y0 + A - 2, S[3])
        if k == 'C':
            fill(cv, x0 + 9, y0 + 3, x0 + 15, y0 + A - 3, W[2]); fill(cv, x0 + 9, y0 + 3, x0 + 10, y0 + A - 3, W[3]); fill(cv, x0 + 14, y0 + 3, x0 + 15, y0 + A - 3, W[0])
        else:
            fill(cv, x0 + 3, y0 + 3, x0 + 18, y0 + 6, W[2]); fill(cv, x0 + 3, y0 + 3, x0 + 18, y0 + 4, W[3])

# ── on és cada lloc al poble ────────────────────────────────────────────────
def village_spots(p):
    hi, ri = p['house']
    x0, y0, x1, y1, _ = M.HOUSES[hi][ri]
    door = p.get('door') or ((x0 + (x1 - x0) // 2) // A, math.ceil(y1 / A))
    hc = M.house_cells(); walls = set(M.WALLS) | set(M.FENCES)
    free = lambda c, r: 0 <= c < M.COLS and 0 <= r < M.ROWS and (c, r) not in hc and (c, r) not in walls and M.GRID[r][c] != 'F'
    cand = sorted(((c, r) for c in range(door[0] - 4, door[0] + 5) for r in range(door[1] - 2, door[1] + 5) if free(c, r)),
                  key=lambda q: (abs(q[0] - door[0]) + abs(q[1] - door[1]) * 1.2, q[1], q[0]))
    assert len(cand) >= 5 and free(*door), f"{p['id']}: no hi ha lloc davant de la porta {door}"
    return door, cand[:5]

# ── sortida ─────────────────────────────────────────────────────────────────
def ts_value(o):
    return json.dumps(o, ensure_ascii=False)

def main():
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
    os.makedirs(OUT_DIR, exist_ok=True)
    entries = []
    for p in PLACES:
        G = parse(p)
        rows, cols = len(G), len(G[0])
        walls, doors = geometry(G)
        door, back = village_spots(p)
        for name, c, r, _ in p['rooms']: assert is_open(G, c, r) and G[r][c] not in OUTSIDE or name == 'Pati', f"{p['id']}: la sala {name} no és a dins"
        for c, r in p['spawn'] + [p['exit']]: assert is_open(G, c, r), f"{p['id']}: ({c},{r}) no es pot trepitjar"
        if not only or only == p['id']:
            cv = render(p, G, FURNITURE[p['id']]())
            out = os.path.join(OUT_DIR, f"{p['id']}.png")
            V.x2(cv).convert('RGB').save(out, optimize=True)
            print(f"{p['name']} → {os.path.relpath(out, ROOT)} ({cols}×{rows})")
        entries.append({
            'id': p['id'], 'name': p['name'], 'kind': p['kind'], 'text': p['text'],
            'map': f"missions/conyberry/{p['id']}.png", 'cols': cols, 'rows': rows,
            'door': list(door), 'back': [list(q) for q in back],
            'spawn': [list(q) for q in p['spawn']], 'exit': list(p['exit']),
            'walls': [round(v) for w in walls for v in w], 'doors': [round(v) for d in doors for v in d],
            'rooms': [{'name': n, 'c': c, 'r': r, 'dark': d} for n, c, r, d in p['rooms']],
        })
    os.makedirs(os.path.dirname(TS_OUT), exist_ok=True)
    with open(TS_OUT, 'w') as f:
        f.write('// GENERAT per `scripts/mission-conyberry-llocs.py`: no l\'editis a mà.\n')
        f.write("import type { MissionPlace } from '@/lib/missions';\n\n")
        f.write('export const CONYBERRY_PLACES: MissionPlace[] = [\n')
        for e in entries:
            f.write('  {\n')
            for k, v in e.items():
                f.write(f'    {k}: {ts_value(v)},\n')
            f.write('  },\n')
        f.write('];\n')
    print('geometria →', os.path.relpath(TS_OUT, ROOT))

if __name__ == '__main__':
    main()
