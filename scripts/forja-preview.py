#!/usr/bin/env python3
"""
Previsualització i validació de les peces de la Forja (`src/lib/sprites/kit-art.json`).

Fa el mateix que `src/lib/sprites/kit.ts` (mantenir-los iguals): neteja el maniquí, hi pinta el cos,
el casc, l'arma (amb el puny per sobre) i l'escut, als 3 fotogrames de l'animació d'espera.

  python3 scripts/forja-preview.py sortida.png [escala]

Escriu una graella: cada fila és una recepta (els 3 fotogrames + la figureta original de referència)
i, a sota, totes les peces de cada tipus. Avisa si una fila d'una peça no té l'amplada de la resta.
"""
import json, re, sys
from PIL import Image

ROOT = __file__.rsplit('/scripts/', 1)[0]
ART = json.load(open(f'{ROOT}/src/lib/sprites/kit-art.json'))
MAN = open(f'{ROOT}/src/lib/sprites/manifest.ts').read()
HEROES = Image.open(f'{ROOT}/public/sprites/uf_heroes.png').convert('RGBA')
T = 48


def creature(name):
    m = re.search(rf'\b{name}: \[(\d+), (\d+)\]', MAN)
    return int(m.group(1)), int(m.group(2))


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def validate():
    bad = []
    def check(kind, name, rows):
        w = {len(r) for r in rows}
        if len(w) > 1: bad.append(f'{kind}/{name}: amplades {sorted(w)}')
    for b, body in ART['bodies'].items():
        for i, p in enumerate(body['pieces']): check('body', f'{b}#{i}', p['rows'])
    for k in ('helms', 'weapons', 'shields'):
        for n, p in ART[k].items():
            if 'rows' in p: check(k, n, p['rows'])
    return bad


def colors(mat):
    ramp = [rgb(c) for c in mat['ramp']]
    acc = [rgb(c) for c in mat.get('skirt', mat['accent'])]
    wood = [rgb(c) for c in ART['wood']]
    m = {str(i): ramp[i] for i in range(5)}
    m.update(a=acc[0], b=acc[1], k=rgb(ART['ink']), w=wood[0], W=wood[1], x=wood[2], g=rgb(ART['grip']))
    return m


def paint(px, rows, x, y, cmap):
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == '.' or ch not in cmap: continue
            X, Y = x + i, y + j
            if 0 <= X < T and 0 <= Y < T: px[X, Y] = (*cmap[ch], 255)


def lum(p): return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]


def ramp_recolor(px, box, ramp, top=3):
    """Torna els píxels opacs de la caixa a la rampa (per lluminositat relativa)."""
    x0, y0, w, h = box
    pts = [(X, Y) for X in range(x0, x0 + w) for Y in range(y0, y0 + h) if 0 <= Y < T and px[X, Y][3] > 200]
    if not pts: return
    ls = [lum(px[p]) for p in pts]; lo, hi = min(ls), max(ls)
    for p, l in zip(pts, ls):
        i = 0 if hi == lo else round((l - lo) / (hi - lo) * top)
        px[p] = (*ramp[i], 255)


def compose(recipe, frame):
    base, armor, helm, weapon, wmetal, shield, smat = recipe
    bx, by = creature(base)
    im = HEROES.crop((bx + frame * T, by, bx + frame * T + T, by + T)).copy(); px = im.load()
    up = ART['groups']['up'][frame]
    # 1. Maniquí net: fora cadenes i grillons (els grillons passen a pell).
    c0, c1 = ART['chainRows']
    for X in ART['chainCols']:
        for Y in range(c0 + up, c1 + up + 1): px[X, Y] = (0, 0, 0, 0)
    for box, sample in ((ART['fistBoxL'], (16, 25)), (ART['fistBoxR'], (31, 25))):
        x0, y0, w, h = box
        for X in range(x0 - 1, x0 + w + 1):
            for Y in range(y0 + up, y0 + h + up):
                p = px[X, Y]
                if p[3] > 200 and abs(p[0] - p[1]) < 8 and abs(p[1] - p[2]) < 8:
                    s = px[sample[0], sample[1] + up]
                    px[X, Y] = s if not (abs(s[0] - s[1]) < 8 and abs(s[1] - s[2]) < 8) else (165, 153, 111, 255)
    # 2. Cos.
    if armor != 'none':
        mat = ART['materials'][armor]; cm = colors(mat)
        body = ART['bodies'][ART['armors'][armor]['body']]
        for p in body['pieces']:
            paint(px, p['rows'], p['x'], p['y'] + ART['groups'][p['group']][frame], cm)
        ramp = [rgb(c) for c in mat['ramp']]
        # El taparrabos del maniquí fa de faldó, amb l'accent de l'armadura.
        lc = ART['loincloth']; lcs = {rgb(c) for c in lc['colors']}
        acc = [rgb(c) for c in mat.get('skirt', mat['accent'])]
        x0, y0, w, h = lc['box']
        for X in range(x0, x0 + w):
            for Y in range(y0 + up, y0 + h + up):
                q = px[X, Y]
                if q[3] > 200 and q[:3] in lcs: px[X, Y] = (*(acc[1] if lum(q) < 110 else acc[0]), 255)
        if body.get('gauntlets'):
            for b in (ART['fistBoxL'], ART['fistBoxR']): ramp_recolor(px, (b[0], b[1] + up, b[2], b[3]), ramp[:4])
        if body.get('sabatons'):
            ramp_recolor(px, (14, 35, 7, 5), ramp[:4]); ramp_recolor(px, (27, 35, 7, 5), ramp[:4])
    # 3. Casc (abans, fora el cabell que sobresurt).
    if helm != 'none':
        h = ART['helms'][helm]
        x0, y0, w, hh = ART['hairClear']
        for X in range(x0, x0 + w):
            for Y in range(y0 + up, 12 + up): px[X, Y] = (0, 0, 0, 0)
        paint(px, h['rows'], h['x'], h['y'] + up, colors(ART['materials'][h['material']]))
    # 4. Arma darrere del puny dret.
    fx, fy, fw, fh = ART['fistBoxR']
    fist = {(X, Y): px[X, Y] for X in range(fx, fx + fw) for Y in range(fy + up, fy + fh + up) if px[X, Y][3] > 200}
    if weapon != 'none':
        wd = ART['weapons'][weapon]; gx, gy = wd['grip']
        paint(px, wd['rows'], ART['fistR'][0] - gx, ART['fistR'][1] - gy + up, colors(ART['weaponMetals'][wmetal]))
        for k, v in fist.items(): px[k] = v
    # 5. Escut damunt del braç esquerre.
    if shield != 'none':
        sd = ART['shields'][shield]; rows = sd['rows']
        sx = ART['fistL'][0] - len(rows[0]) // 2; sy = ART['fistL'][1] - len(rows) // 2 - 1
        paint(px, rows, sx, sy + up, colors(ART['shieldMaterials'][smat]))
    return im


RECIPES = [
    ('prisoner_a', 'gold', 'gold', 'broadsword', 'steel', 'heater', 'gold'),
    ('prisoner_b', 'plate', 'plate', 'mace', 'steel', 'kite', 'iron'),
    ('prisoner_c', 'royal', 'royal', 'sword', 'gold', 'heater', 'royal'),
    ('prisoner_a', 'blood', 'blood', 'greataxe', 'steel', 'none', 'iron'),
    ('prisoner_b', 'chain', 'chain', 'spear', 'steel', 'buckler', 'wood'),
    ('prisoner_c', 'studded', 'studded', 'axe', 'steel', 'buckler', 'wood'),
    ('prisoner_a', 'leather', 'leather', 'bow', 'steel', 'none', 'wood'),
    ('prisoner_b', 'cloth', 'cloth', 'dagger', 'steel', 'none', 'wood'),
    ('prisoner_c', 'wild', 'wild', 'club', 'steel', 'none', 'wood'),
    ('prisoner_a', 'mystic', 'mystic', 'jeweled', 'mystic', 'none', 'mystic'),
    ('prisoner_b', 'plate', 'none', 'hammer', 'steel', 'great', 'iron'),
    ('prisoner_c', 'none', 'none', 'trident', 'vorpal', 'kite', 'flame'),
]

if __name__ == '__main__':
    bad = validate()
    for b in bad: print('⚠', b)
    out_path = sys.argv[1] if len(sys.argv) > 1 else 'forja.png'
    scale = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    refs = ['knight', 'warrior_m', 'paladin', 'barbarian_m', 'thief', 'wizard']
    sheet = Image.new('RGBA', (T * 8, T * len(RECIPES)), (40, 40, 40, 255))
    for r, rec in enumerate(RECIPES):
        for f in range(3):
            g = compose(rec, f); sheet.paste(g, (f * T, r * T), g)
        g = compose(rec, 0); big = g.resize((T, T)); sheet.paste(big, (4 * T, r * T), big)
        x, y = creature(refs[r % len(refs)]); ref = HEROES.crop((x, y, x + T, y + T)); sheet.paste(ref, (6 * T, r * T), ref)
    sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST).save(out_path)
    print('ok', out_path)
