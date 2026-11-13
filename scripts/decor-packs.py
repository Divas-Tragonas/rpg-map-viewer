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
OUT_PNG2 = os.path.join(ROOT, 'public', 'sprites', 'decor_sheets.png')
OUT_TS = os.path.join(ROOT, 'src', 'lib', 'tilemap', 'packs.ts')
# Les peces retallades dels fulls de tessel·les (v5.33) van a un segon full (cap navegador no vol una imatge de
# 25.000 px d'alçada). Els seus índexs comencen a `PACK2_OFF`: el codi de casella és PACK_BASE + índex igual que al primer.
PACK2_OFF = 20000
SHEET_GROUPS = {'tx_dungeon', 'tx_guild', 'tx_glass', 'tx_home', 'tx_chapel', 'tx_farm', 'tx_bridges', 'tx_roads',
                'tx_cursed_land', 'tx_undead_land'}
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
    # v5.32: paquets de textures de CraftPix (`assets/texture-packs/`), vegeu `TEXTURE_SETS`
    'tx_trees': ('Arbres i troncs', 'objectes', 'object'),
    'tx_bushes': ('Arbusts i plantes', 'objectes', 'object'),
    'tx_crystals': ('Cristalls', 'objectes', 'object'),
    'tx_ruins': ('Ruïnes', 'objectes', 'object'),
    'tx_forest': ('Bosc màgic', 'objectes', 'object'),
    'tx_rocks': ('Roques i pedres', 'objectes', 'object'),
    'tx_rocky': ('Zona rocosa', 'objectes', 'object'),
    'tx_cave': ('Coves', 'objectes', 'object'),
    'tx_cursed_plants': ('Terra maleïda: plantes', 'objectes', 'object'),
    'tx_cursed_bones': ('Terra maleïda: ossos', 'objectes', 'object'),
    'tx_cursed_other': ('Terra maleïda: altres', 'objectes', 'object'),
    'tx_undead_graves': ('Morts vivents: tombes', 'objectes', 'object'),
    'tx_undead_bones': ('Morts vivents: ossos i calaveres', 'objectes', 'object'),
    'tx_undead_trees': ('Morts vivents: arbres i plantes', 'objectes', 'object'),
    'tx_undead_other': ('Morts vivents: ruïnes i altres', 'objectes', 'object'),
    'tx_icons': ('Icones de fantasia', 'boti', 'object'),
    # v5.33: peces retallades dels fulls de tessel·les (`tx_sheet`)
    'tx_dungeon': ('Masmorra (fulls)', 'objectes', 'object'),
    'tx_guild': ('Gremi (fulls)', 'objectes', 'object'),
    'tx_glass': ('Taller de vidre (fulls)', 'objectes', 'object'),
    'tx_home': ('Casa i jardí (fulls)', 'objectes', 'object'),
    'tx_chapel': ('Capella (fulls)', 'objectes', 'object'),
    'tx_farm': ('Granja (fulls)', 'objectes', 'object'),
    'tx_bridges': ('Ponts (fulls)', 'objectes', 'object'),
    'tx_roads': ('Camins (fulls)', 'objectes', 'object'),
    'tx_cursed_land': ('Terra maleïda: terreny (fulls)', 'objectes', 'object'),
    'tx_undead_land': ('Morts vivents: terreny (fulls)', 'objectes', 'object'),
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

# ── Paquets de textures de CraftPix (v5.32, `assets/texture-packs/`): només les peces ja retallades ──
# Cada peça és un PNG solt; es tria la variant «amb ombra» (les altres —sense ombra, ombra amb herba—
# són còpies del mateix dibuix). ⚠️ Peces noves (o paquets nous) sempre AL FINAL i en ordre estable:
# els mapes desats guarden el número de la casella del full.
TX = os.path.join('..', 'texture-packs')
WORDS = {
    'bones': 'ossos', 'bone': 'ossos', 'grave': 'tomba', 'ruin': 'ruïna', 'ruins': 'ruïnes', 'rock': 'roca',
    'tree': 'arbre', 'plant': 'planta', 'crystal': 'cristall', 'scull': 'calavera', 'sculls': 'calaveres',
    'pile': 'munt', 'door': 'porta', 'arm': 'braç', 'dead': 'mort', 'broken': 'trencat', 'thorn': 'espinós',
    'bush': 'arbust', 'cactus': 'cactus', 'fern': 'falguera', 'mushroom': 'bolet', 'mushrooms': 'bolets',
    'autumn': 'tardor', 'snow': 'neu', 'burned': 'cremat', 'blue': 'blau', 'orange': 'taronja', 'pink': 'rosa',
    'red': 'vermell', 'green': 'verd', 'white': 'blanc', 'black': 'negre', 'yellow': 'groc', 'violet': 'violeta',
    'flowers': 'flors', 'simple': 'simple', 'sand': 'sorra', 'water': 'aigua', 'brown': 'marró', 'gray': 'gris',
    'light': 'clar', 'dark': 'fosc', 'grass': 'herba', 'ground': 'terra', 'caves': 'cova', 'cave': 'cova',
    'entrance': 'entrada', 'dragon': 'drac', 'full': 'sencer', 'body': 'cos', 'tail': 'cua', 'wing': 'ala',
    'eye': 'ull', 'eyes': 'ulls', 'many': 'molts', 'jaws': 'queixals', 'meat': 'carn', 'flower': 'flor',
    'fetus': 'fetus', 'luminous': 'lluminós', 'curved': 'corbat', 'swirling': 'cargolat', 'living': 'viu',
    'gazebo': 'glorieta', 'idol': 'ídol', 'deer': 'cérvol', 'human': 'humà', 'wolf': 'llop', 'willow': 'salze',
    'mega': 'mega', 'balls': 'boles', 'ent': 'ent', 'man': 'home', 'woman': 'dona', 'building': 'edifici',
    'gates': 'portes', 'totem': 'tòtem', 'statue': 'estàtua', 'caveman': 'home de les cavernes', 'web': 'teranyina',
    'cocoon': 'capoll', 'centipede': 'centpeus', 'skeleton': 'esquelet', 'dinosaur': 'dinosaure', 'demon': 'dimoni',
    'magic': 'màgic', 'circle': 'cercle', 'lich': 'lich', 'head': 'cap', 'part': 'part', 'vertical': 'vertical',
    'pearl': 'perla', 'liana': 'liana', 'bridges': 'ponts', 'bonefire': 'foguera d\'ossos', 'beige': 'beix',
    'shadow': '', 'no': '', 'rpck': 'roca', 'chanterelles': 'rovellons', 'tree1': 'arbre',
}


def tx_label(stem, strip=()):
    """«Bones_shadow1_3» → «Ossos 1 3»: paraules traduïdes, la resta tal qual, números al final."""
    import re
    words = re.findall(r'[A-Za-z]+|\d+', stem.replace('-', ' '))
    out = []
    for w in words:
        if w.lower() in strip:
            continue
        t = WORDS.get(w.lower(), w.lower()) if not w.isdigit() else w
        if t:
            out.append(t)
    lab = ' '.join(out).strip() or stem
    return lab[0].upper() + lab[1:]


def tx_id(prefix, stem):
    import re
    return prefix + '_' + re.sub(r'[^a-z0-9]+', '_', stem.lower()).strip('_')


def tx_add(prefix, pack, subdir, group, accept=lambda s: True, grouper=None, strip=('shadow',)):
    """Afegeix tots els PNG d'una carpeta (en ordre alfabètic) que `accept` deixa passar."""
    d = os.path.join(SRC, TX, pack, subdir)
    for f in sorted(os.listdir(d)):
        if not f.lower().endswith('.png'):
            continue
        stem = f[:-4]
        if not accept(stem):
            continue
        im = Image.open(os.path.join(d, f))
        w, h = im.size
        g = grouper(stem) if grouper else group
        add(tx_id(prefix, stem + '_' + str(w)), tx_label(stem, strip), g, f'{TX}/{pack}/{subdir}/{f}', 0, 0, w, h)


import re as _re
tx_add('tree', 'trees', 'PNG/Assets_separately/Trees_shadow', 'tx_trees')
tx_add('bush', 'bushes', 'PNG/Assets_shadow', 'tx_bushes')
tx_add('crys', 'crystals', 'PNG/Assets_shadow', 'tx_crystals')
tx_add('ruin', 'ruins', 'PNG/Assets_shadow', 'tx_ruins')
tx_add('wood', 'forest-objects', 'PNG/Assets', 'tx_forest')
tx_add('rock', 'rocks-stones', 'PNG/Objects_separately', 'tx_rocks',
       accept=lambda s: 'no_shadow' not in s and 'grass_shadow' not in s)
tx_add('rocky', 'rocky-area', 'PNG/Objects_separately', 'tx_rocky')
for _sz in ('16', '32', '64', '128', '256'):
    tx_add('cave' + _sz, 'cave-objects', f'PNG/Objects_separately/{_sz}', 'tx_cave')
tx_add('curs', 'cursed-land', 'PNG/Objects_separetely', None, grouper=lambda s: (
    'tx_cursed_bones' if s.startswith('Bones') else
    'tx_cursed_plants' if _re.search(r'plant|flower|Fetus', s) else 'tx_cursed_other'))
tx_add('und', 'undead-tileset', 'PNG/Objects_separately', None, grouper=lambda s: (
    'tx_undead_graves' if s.startswith('Grave') else
    'tx_undead_bones' if _re.match(r'(Bones|Pile_sculls|Scull|Dead_arm)', s) else
    'tx_undead_trees' if _re.match(r'(Tree|Broken|Dead_tree|Thorn|Plant)', s) else 'tx_undead_other'))
tx_add('icon', 'fantasy-icons', 'PNG/Separately', 'tx_icons', accept=lambda s: not s.endswith('_2'), strip=('icon',))


# ── Fulls de tessel·les (v5.33): cada peça = una taca connexa del full (un objecte, una casa, un tros de
# camí o de vora d'aigua; no s'hi usen els fulls `water_detilazation`: són només ones i brillantors per posar sobre l'aigua) retallada al que es veu. Les tessel·les són de 16 px (3×3 = una casella de 48):
# a 1×, com la resta. ⚠️ Els fulls enormes (taques de més de 4 caselles) es tallen en blocs de 48 px
# alineats a la graella de 16, i els de dues peces idèntiques només en deixen una.
def tx_components(path, gap=1):
    """Caixes (x0, y0, x1, y1) de les taques connexes de l'alfa d'un full, en ordre de lectura."""
    import numpy as np
    from collections import deque
    a = np.array(Image.open(path).convert('RGBA'))[:, :, 3] > 0
    h, w = a.shape
    d = a.copy()
    for dy in range(-gap, gap + 1):
        for dx in range(-gap, gap + 1):
            d |= np.roll(np.roll(a, dy, 0), dx, 1)
    lab = np.zeros((h, w), np.int32)
    boxes = []
    for y in range(h):
        for x in range(w):
            if d[y, x] and not lab[y, x]:
                k = len(boxes) + 1
                q = deque([(y, x)]); lab[y, x] = k
                x0 = x1 = x; y0 = y1 = y
                while q:
                    cy, cx = q.popleft()
                    x0 = min(x0, cx); x1 = max(x1, cx); y0 = min(y0, cy); y1 = max(y1, cy)
                    for ny in (cy - 1, cy, cy + 1):
                        for nx in (cx - 1, cx, cx + 1):
                            if 0 <= ny < h and 0 <= nx < w and d[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = k; q.append((ny, nx))
                sub = a[y0:y1 + 1, x0:x1 + 1]
                ys, xs = np.where(sub)
                if len(ys) >= 4:
                    boxes.append((x0 + int(xs.min()), y0 + int(ys.min()), x0 + int(xs.max()) + 1, y0 + int(ys.max()) + 1))
    boxes.sort(key=lambda b: (b[1] // 16, b[0]))
    return boxes


_TX_SEEN = set()


def tx_sheet(prefix, pack, rel, group, label, gap=1):
    path = os.path.join(SRC, TX, pack, rel)
    im = Image.open(path).convert('RGBA')
    n = 0
    for (x0, y0, x1, y1) in tx_components(path, gap):
        w, h = x1 - x0, y1 - y0
        if w > 192 or h > 192:   # taca enorme: blocs de 48 px alineats a la graella de 16
            gx, gy = x0 // 16 * 16, y0 // 16 * 16
            crops = [(x, y, min(x + 48, x1 + 15), min(y + 48, y1 + 15))
                     for y in range(gy, y1, 48) for x in range(gx, x1, 48)]
        else:
            crops = [(x0, y0, x1, y1)]
        for (a, b, c, d) in crops:
            c, d = min(c, im.width), min(d, im.height)
            art = im.crop((a, b, c, d))
            bb = art.getbbox()
            if not bb:
                continue
            a, b, c, d = a + bb[0], b + bb[1], a + bb[2], b + bb[3]
            art = im.crop((a, b, c, d))
            key = (art.size, art.tobytes())
            if key in _TX_SEEN:
                continue
            _TX_SEEN.add(key)
            n += 1
            add(f'{prefix}_{n:03d}', f'{label} {n}', group, f'{TX}/{pack}/{rel}', a, b, c - a, d - b)


for _args in [
    ('dg_obj', 'dungeon-assets', 'PNG/Objects.png', 'tx_dungeon', 'Objectes de masmorra'),
    ('dg_wall', 'dungeon-assets', 'PNG/walls_floor.png', 'tx_dungeon', 'Parets i terra de masmorra'),
    ('dg_crkf', 'dungeon-assets', 'PNG/decorative_cracks_floor.png', 'tx_dungeon', 'Esquerdes de terra'),
    ('dg_crkw', 'dungeon-assets', 'PNG/decorative_cracks_walls.png', 'tx_dungeon', 'Esquerdes de paret'),
    ('dp_obj', 'dungeon-props', 'PNG/Objects.png', 'tx_dungeon', 'Atrezzo de masmorra'),
    ('dp_skull', 'dungeon-props', 'PNG/scull.png', 'tx_dungeon', 'Calavera gegant'),
    ('dp_web', 'dungeon-props', 'PNG/web.png', 'tx_dungeon', 'Teranyina'),
    ('dp_flask', 'dungeon-props', 'PNG/Flasks_monsters.png', 'tx_dungeon', 'Flascons de monstres'),
    ('dp_cann', 'dungeon-props', 'PNG/Cannon_restricted_size.png', 'tx_dungeon', 'Canó'),
    ('do_oth', 'dungeon-objects', 'PNG/Other_objects.png', 'tx_dungeon', 'Altres objectes'),
    ('do_ped', 'dungeon-objects', 'PNG/pedestals.png', 'tx_dungeon', 'Pedestals'),
    ('do_sup', 'dungeon-objects', 'PNG/supplies_objects.png', 'tx_dungeon', 'Provisions'),
    ('gh_int', 'guild-hall', 'PNG/Interior_objects.png', 'tx_guild', 'Interior del gremi'),
    ('gh_ext', 'guild-hall', 'PNG/Exterior.png', 'tx_guild', 'Exterior del gremi'),
    ('gh_win', 'guild-hall', 'PNG/Windows_doors.png', 'tx_guild', 'Finestres i portes'),
    ('gh_wi', 'guild-hall', 'PNG/Walls_interior.png', 'tx_guild', 'Parets interiors'),
    ('gh_ws', 'guild-hall', 'PNG/Walls_street.png', 'tx_guild', 'Parets de carrer'),
    ('gh_crk', 'guild-hall', 'PNG/Decorative_cracks.png', 'tx_guild', 'Esquerdes'),
    ('gb_int', 'glassblowers', 'PNG/Interior_objects.png', 'tx_glass', 'Interior del taller'),
    ('gb_ext', 'glassblowers', 'PNG/Exterior_house.png', 'tx_glass', 'Exterior del taller'),
    ('gb_wi', 'glassblowers', 'PNG/Walls_interior.png', 'tx_glass', 'Parets interiors'),
    ('mc_int', 'main-characters-home', 'PNG/Interior.png', 'tx_home', 'Interior de la casa'),
    ('mc_ext', 'main-characters-home', 'PNG/exterior.png', 'tx_home', 'Exterior de la casa'),
    ('mc_det', 'main-characters-home', 'PNG/house_details.png', 'tx_home', 'Detalls de la casa'),
    ('mc_grs', 'main-characters-home', 'PNG/ground_grass_details.png', 'tx_home', 'Herba i detalls'),
    ('mc_wf', 'main-characters-home', 'PNG/walls_floor.png', 'tx_home', 'Parets i terra de la casa'),
    ('cp_int', 'chapel', 'PNG/Interior_objects.png', 'tx_chapel', 'Interior de la capella'),
    ('cp_ext', 'chapel', 'PNG/Exterior.png', 'tx_chapel', 'Exterior de la capella'),
    ('cp_wi', 'chapel', 'PNG/Walls_Interior.png', 'tx_chapel', 'Parets de la capella'),
    ('cp_sta', 'chapel', 'PNG/Animation/Statues.png', 'tx_chapel', 'Estàtues'),
    ('fa_pla', 'farm-plants', 'PNG/Plants.png', 'tx_farm', 'Plantes de conreu'),
    ('fa_sup', 'farm-plants', 'PNG/Supplies.png', 'tx_farm', 'Eines i caixes'),
    ('br_br', 'bridges', 'PNG_n_Tiled/Bridges.png', 'tx_bridges', 'Pont'),
    ('rd_gg', 'path-road', 'PNG_Tiled/Ground_grass.png', 'tx_roads', 'Herba'),
    *[(f'rd_{k}{v[0]}', 'path-road', f'PNG_Tiled/Road{k}{v[1]}.png', 'tx_roads', f'Camí {k}{v[2]}')
      for k in range(1, 6) for v in (('', '', ''), ('g', '_grass', ' (herba)'), ('t', '_ground', ' (terra)'))
      if os.path.exists(os.path.join(SRC, TX, 'path-road', f'PNG_Tiled/Road{k}{v[1]}.png'))],
    ('cl_gnd', 'cursed-land', 'PNG/Ground.png', 'tx_cursed_land', 'Terra'),
    ('cl_det', 'cursed-land', 'PNG/details.png', 'tx_cursed_land', 'Detalls'),
    ('cl_spt', 'cursed-land', 'PNG/spots.png', 'tx_cursed_land', 'Taques'),
    ('cl_bri', 'cursed-land', 'PNG/bridges.png', 'tx_cursed_land', 'Ponts'),
    ('cl_wc', 'cursed-land', 'PNG/Water_coasts.png', 'tx_cursed_land', 'Vora d\'aigua'),
    ('ud_gnd', 'undead-tileset', 'PNG/Ground_rocks.png', 'tx_undead_land', 'Terra de roca'),
    ('ud_det', 'undead-tileset', 'PNG/Details.png', 'tx_undead_land', 'Detalls'),
    ('ud_wc', 'undead-tileset', 'PNG/Water_coasts.png', 'tx_undead_land', 'Vora d\'aigua'),
]:
    tx_sheet(*_args)


def block_size(w, h):
    """Caselles que ocupa una peça: les justes per encabir-la, amb amplada senar (centrada a l'àncora)."""
    cw, ch = math.ceil(w / TILE), math.ceil(h / TILE)
    if cw % 2 == 0:
        cw += 1
    return cw, ch


def main():
    ids = [p[0] for p in PIECES]
    assert len(ids) == len(set(ids)), 'ids repetits'
    cache = {}

    def build(pieces, off, out_png):
        """«El primer forat on cap», en l'ordre de `pieces`: una peça nova al final no mou les d'abans."""
        occ = set()
        placed = []
        for p in pieces:
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
        res = []
        for (pid, label, group, path, x, y, w, h), c, r, cw, ch in placed:
            if path not in cache:
                cache[path] = Image.open(os.path.join(SRC, path)).convert('RGBA')
            art = cache[path].crop((x, y, x + w, y + h))
            ax, ay = (cw * TILE - w) // 2, (ch * TILE - h) // 2   # al mig del bloc, a 1×
            sheet.alpha_composite(art, (c * TILE + ax, r * TILE + ay))
            bb = art.getbbox() or (0, 0, w, h)   # el que es veu (miniatura de la paleta)
            res.append((pid, label, group, off + r * COLS + c, cw, ch, ax + bb[0], ay + bb[1], bb[2] - bb[0], bb[3] - bb[1]))
        os.makedirs(os.path.dirname(out_png), exist_ok=True)
        sheet.save(out_png, optimize=True)
        try:  # com els altres fulls: optimitzador sense pèrdua si hi és (`pip install pyoxipng`)
            import oxipng
            oxipng.optimize(out_png, level=4)
        except ImportError:
            pass
        return res, rows

    out, rows = build([p for p in PIECES if p[2] not in SHEET_GROUPS], 0, OUT_PNG)
    out2, rows2 = build([p for p in PIECES if p[2] in SHEET_GROUPS], PACK2_OFF, OUT_PNG2)
    order = {p[0]: i for i, p in enumerate(PIECES)}
    out = sorted(out + out2, key=lambda o: order[o[0]])

    js = lambda s: "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"
    fl2 = lambda i: f', {json.dumps(FLIES[i])}' if i in FLIES else ''
    lines = [
        '/**',
        ' * GENERAT per `scripts/decor-packs.py` — no editar a mà (tocar el script i tornar-lo a executar).',
        ' * Peces dels paquets de `assets/decor-packs/` al full `public/sprites/decor_packs.png`.',
        ' */',
        f'export const PACK_COLS = {COLS};',
        '/** Índex (`cell`) a partir del qual les peces són al segon full, `decor_sheets.png` (índex local = cell − PACK2_OFF). */',
        f'export const PACK2_OFF = {PACK2_OFF};',
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
        '/** Constructor compacte: amb milers de peces, un literal d\'objecte per peça feia explotar el tipus unió de TypeScript. */',
        'const P = (id: string, label: string, group: PackGroupId, cell: number, w: number, h: number, a: number, b: number, c: number, d: number, flies?: [number, number][]): PackPiece =>',
        '  (flies ? { id, label, group, cell, w, h, art: [a, b, c, d], flies } : { id, label, group, cell, w, h, art: [a, b, c, d] });',
        'export const PACK_PIECES: PackPiece[] = [',
        *[f'  P({js(i)}, {js(l)}, {js(g)}, {cell}, {w}, {h}, {a}, {b}, {c}, {d}{fl2(i)}),'
          for i, l, g, cell, w, h, a, b, c, d in out],
        '];',
        '',
    ]
    with open(OUT_TS, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f'{len(out)} peces: full 1 {COLS * TILE}×{rows * TILE}, full 2 {COLS * TILE}×{rows2 * TILE} → {os.path.relpath(OUT_TS, ROOT)}')


if __name__ == '__main__':
    main()
