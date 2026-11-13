#!/usr/bin/env python3
"""
Full de decorat dels paquets nous (v5.24): la tria de `assets/decor-packs/` que surt a la paleta de
Caselles (cofres, gerres, bosc i objectes petits).

Genera:
  - `public/sprites/decor_packs.png` — graella de caselles de 48 px (`COLS` columnes).
  - `src/lib/tilemap/packs.ts`       — GENERAT: on és cada peça i a quin grup de la paleta va.

⚠️ **La mida del píxel no es toca**: l'art es copia a 1× (un píxel de l'art = un píxel de mapa, com
l'Oryx). Una peça més petita que la casella es queda al mig, amb aire al voltant; una de més gran
ocupa un bloc de caselles (amplada senar perquè quedi centrada a la casella on es clica, l'àncora
és la del mig de la fila de baix). Es copia la cel·la sencera de l'autor (32 px els cofres i les
gerres, 16 els objectes petits, 80×96 els arbres): així es manté on l'autor posa cada peça.

⚠️ **Afegir peces sempre AL FINAL de `PIECES`**: els decorats es desen al mapa pel número de la
casella del full (`PACK_BASE` + índex). Si una peça d'abans canviés de lloc, els mapes desats
pintarien una altra cosa. Les peces noves s'encabeixen als forats que quedin sense moure les d'abans.

    python3 scripts/decor-packs.py
"""
import json
import math
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'decor-packs')
OUT_PNG = os.path.join(ROOT, 'public', 'sprites', 'decor_packs.png')
OUT_TS = os.path.join(ROOT, 'src', 'lib', 'tilemap', 'packs.ts')
TILE = 48
COLS = 20

# Grups de la paleta: id → (etiqueta, pestanya, tipus). `object` = objecte (es mou i es gira com els
# mobles); `decor` = decorat de terra d'una casella (s'apila a les capes de decorat).
GROUPS = {
    'chests': ('Cofres', 'objectes', 'object'),
    'pots': ('Gerres', 'objectes', 'object'),
    'forest': ('Bosc', 'objectes', 'object'),
    'tiny': ('Objectes petits', 'boti', 'object'),
    'broken': ('Gerres trencades', 'decorat', 'decor'),
    # Art propi a l'estil Oryx (`scripts/oryx-style-props.py`, v5.26)
    'ox_furniture': ('Mobles', 'objectes', 'object'),
    'ox_containers': ('Caixes, bótes i sacs', 'objectes', 'object'),
    'ox_vases': ('Gerros i àmfores', 'objectes', 'object'),
    'ox_chests': ('Cofres grans', 'objectes', 'object'),
    'ox_treasure': ('Monedes i tresor', 'boti', 'object'),
    # v5.30: brutícia de terra i el cau de goblins
    'ox_rubble': ('Runa i brutícia', 'decorat', 'decor'),
    'ox_goblin': ('Cau de goblins', 'objectes', 'object'),
}

PIECES = []  # (id, etiqueta, grup, fitxer, x, y, w, h)
FLIES = {}   # id → punts (px de la casella) on voleten mosques (v5.31, de `pieces.json`)


def add(pid, label, group, path, x, y, w, h):
    PIECES.append((pid, label, group, path, x, y, w, h))


# ── Cofres (Treasure Chests 1.2a): 5 models × 3 colors, tancat (fila parell) i obert (senar) ──
CHESTS = [('iron', 'Cofre ferrat'), ('wood', 'Cofre de fusta'), ('royal', 'Cofre reial'),
          ('beast', 'Cofre de la bèstia'), ('leather', 'Cofre de cuir')]
for v in range(3):
    for col, (cid, name) in enumerate(CHESTS):
        for o, state in ((0, 'tancat'), (1, 'obert')):
            add(f'chest_{cid}_{v + 1}_{"open" if o else "closed"}', f'{name} {v + 1} ({state})', 'chests',
                'treasure-chests/treasure chests.png', col * 32, (2 * v + o) * 32, 32, 32)

# ── Gerres (Breakable Pots 1.1a): un full per color; columna 0 = sencera, columna 3 = trossos ──
POT_COLORS = [('gray', 'gris'), ('red', 'vermella'), ('white', 'blanca'), ('yellow', 'groga')]
POT_SIZES = [('small', 'Gerra petita'), ('handles', 'Gerra amb nanses'), ('large', 'Gerra gran')]
for cid, cname in POT_COLORS:
    for r, (sid, sname) in enumerate(POT_SIZES):
        add(f'pot_{sid}_{cid}', f'{sname} {cname}', 'pots', f'breakable-pots/breakable pots ({cid}).png', 0, r * 32, 32, 32)
for cid, cname in POT_COLORS:
    for r, (sid, sname) in enumerate(POT_SIZES):
        add(f'potbroken_{sid}_{cid}', f'{sname} {cname} trencada', 'broken',
            f'breakable-pots/breakable pots ({cid}).png', 96, r * 32, 32, 32)

# ── Bosc (Gentle Forest 3.0a): les peces amb fons transparent, a les tres paletes gratuïtes ──
# (Les del full gran `gentle forest` van pintades sobre herba opaca: són terra, no objectes.)
PALETTES = [('v01', 'bosc'), ('v02', 'jungla'), ('v03', 'lluna')]
SMALL = [('stump', 'Soca'), ('rock', 'Roca'), ('bush', 'Mata'), ('fern', 'Falguera')]
for vid, vname in PALETTES:
    for i, (sid, sname) in enumerate(SMALL):
        add(f'forest_{sid}_{vid}', f'{sname} ({vname})', 'forest', f'gentle-forest/gentle sheets/gentle 32x32 {vid}.png',
            i * 32, 0, 32, 32)
for vid, vname in PALETTES:
    for i in range(2):
        add(f'forest_tree{i + 1}_{vid}', f'Arbre {i + 1} ({vname})', 'forest',
            f'gentle-forest/gentle sheets/gentle trees 80x96 {vid}.png', i * 80, 0, 80, 96)

# ── Objectes petits (Tiny Dungeon Items Pack, Pixel-Deck): 16×16, tots menys la portada ──
TINY = [
    ('ancient-book', 'Llibre antic'), ('barrel', 'Bóta'), ('battle-axe', 'Destral de guerra'),
    ('bear-trap', 'Parany'), ('blue-mana-potion', 'Poció blava'), ('bomb', 'Bomba'),
    ('bone-pile', 'Pila d\'ossos'), ('candle', 'Espelma'), ('coin-pile', 'Pila de monedes'),
    ('dagger', 'Daga'), ('gemstone', 'Gemma'), ('gold-coin', 'Moneda d\'or'), ('gold-key', 'Clau d\'or'),
    ('green-poison-potion', 'Poció verda'), ('iron-sword', 'Espasa de ferro'), ('lantern', 'Llanterna'),
    ('magic-scroll', 'Pergamí màgic'), ('magic-staff', 'Bastó màgic'), ('mushroom', 'Bolet'),
    ('old-key', 'Clau vella'), ('purple-mystery-potion', 'Poció morada'), ('red health potion', 'Poció vermella'),
    ('rope', 'Corda'), ('round-shield', 'Escut rodó'), ('rusty-sword', 'Espasa rovellada'),
    ('skeleton-key', 'Clau mestra'), ('skull-shield', 'Escut de la calavera'), ('skull', 'Calavera'),
    ('torch', 'Torxa'), ('treasure-chest', 'Cofre petit'), ('wooden-bow', 'Arc de fusta'),
    ('wooden-crate', 'Caixa de fusta'),
]
for fname, label in TINY:
    add('tiny_' + fname.replace('-', '_').replace(' ', '_'), label, 'tiny', f'tiny-dungeon-items/{fname}.png', 0, 0, 16, 16)

# ── Art propi a l'estil Oryx (v5.26): la llista la fa `scripts/oryx-style-props.py` (`pieces.json`) ──
with open(os.path.join(SRC, 'oryx-style', 'pieces.json'), encoding='utf-8') as _f:
    for _p in json.load(_f):
        add(_p['id'], _p['label'], _p['group'], f"oryx-style/{_p['id']}.png", 0, 0, _p['w'], _p['h'])
        if _p.get('flies'):
            FLIES[_p['id']] = _p['flies']


def block_size(w, h):
    """Caselles que ocupa una peça: les justes per encabir-la, amb amplada senar (centrada a l'àncora)."""
    cw, ch = math.ceil(w / TILE), math.ceil(h / TILE)
    if cw % 2 == 0:
        cw += 1
    return cw, ch


def main():
    ids = [p[0] for p in PIECES]
    assert len(ids) == len(set(ids)), 'ids repetits'
    # Col·locació «el primer forat on cap», en l'ordre de `PIECES`: una peça nova al final no mou les d'abans.
    occ = set()
    placed = []
    for p in PIECES:
        cw, ch = block_size(p[6], p[7])
        assert cw <= COLS
        r = 0
        while True:
            spot = next((c for c in range(COLS - cw + 1)
                         if all((c + i, r + j) not in occ for i in range(cw) for j in range(ch))), None)
            if spot is not None:
                break
            r += 1
        for i in range(cw):
            for j in range(ch):
                occ.add((spot + i, r + j))
        placed.append((p, spot, r, cw, ch))
    rows = max(r + ch for _, _, r, _, ch in placed)
    sheet = Image.new('RGBA', (COLS * TILE, rows * TILE), (0, 0, 0, 0))
    cache = {}
    out = []
    for (pid, label, group, path, x, y, w, h), c, r, cw, ch in placed:
        if path not in cache:
            cache[path] = Image.open(os.path.join(SRC, path)).convert('RGBA')
        art = cache[path].crop((x, y, x + w, y + h))
        ax, ay = (cw * TILE - w) // 2, (ch * TILE - h) // 2   # al mig del bloc, a 1×
        sheet.alpha_composite(art, (c * TILE + ax, r * TILE + ay))
        bb = art.getbbox() or (0, 0, w, h)   # el que es veu (miniatura de la paleta)
        out.append((pid, label, group, r * COLS + c, cw, ch, ax + bb[0], ay + bb[1], bb[2] - bb[0], bb[3] - bb[1]))
    os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True)
    sheet.save(OUT_PNG, optimize=True)
    try:  # com els altres fulls: optimitzador sense pèrdua si hi és (`pip install pyoxipng`)
        import oxipng
        oxipng.optimize(OUT_PNG, level=4)
    except ImportError:
        pass

    js = lambda s: "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"
    fl = lambda i: f', flies: {json.dumps(FLIES[i])}' if i in FLIES else ''
    lines = [
        '/**',
        ' * GENERAT per `scripts/decor-packs.py` — no editar a mà (tocar el script i tornar-lo a executar).',
        ' * Peces dels paquets de `assets/decor-packs/` al full `public/sprites/decor_packs.png`.',
        ' */',
        f'export const PACK_COLS = {COLS};',
        '',
        'export type PackGroupId = ' + ' | '.join(js(g) for g in GROUPS) + ';',
        'export interface PackGroup { id: PackGroupId; label: string; tab: \'objectes\' | \'boti\' | \'decorat\'; kind: \'object\' | \'decor\' }',
        'export const PACK_GROUPS: PackGroup[] = [',
        *[f'  {{ id: {js(g)}, label: {js(l)}, tab: {js(t)}, kind: {js(k)} }},' for g, (l, t, k) in GROUPS.items()],
        '];',
        '',
        '/**',
        ' * Una peça: `cell` = índex de la casella de dalt a l\'esquerra del bloc al full (fila·PACK_COLS + columna),',
        ' * `w`×`h` = caselles del bloc, `art` = el rectangle que es veu dins del bloc (px), per a la miniatura.',
        ' */',
        'export interface PackPiece { id: string; label: string; group: PackGroupId; cell: number; w: number; h: number; art: [number, number, number, number]; flies?: [number, number][] }',
        'export const PACK_PIECES: PackPiece[] = [',
        *[f'  {{ id: {js(i)}, label: {js(l)}, group: {js(g)}, cell: {cell}, w: {w}, h: {h}, art: [{a}, {b}, {c}, {d}]{fl(i)} }},'
          for i, l, g, cell, w, h, a, b, c, d in out],
        '];',
        '',
    ]
    with open(OUT_TS, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f'{len(out)} peces, full {COLS * TILE}×{rows * TILE} → {os.path.relpath(OUT_PNG, ROOT)}, {os.path.relpath(OUT_TS, ROOT)}')


if __name__ == '__main__':
    main()
