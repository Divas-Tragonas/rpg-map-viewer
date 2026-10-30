#!/usr/bin/env python3
"""
Genera les variants de color de les figuretes (app Píxel) a partir de `public/sprites/uf_heroes.png`:

    python3 scripts/oryx-variants.py            # escriu els fulls i `src/lib/sprites/variants.ts`
    python3 scripts/oryx-variants.py --sheet x  # a més, un full de revisió (original + variants) a x.png

Surten `public/sprites/uf_heroes_v1.png` i `uf_heroes_v2.png`: còpies del full amb les figures
recolorides a les MATEIXES coordenades (el manifest serveix per a tots tres).

Criteri (el va demanar el propietari del repo després de provar una paleta lliure, v4.45):
  - Cada figura es parteix en MATERIALS: rampes de 2–4 colors de l'autor que es toquen al dibuix
    i tenen el mateix to (capa, túnica, plomall, pell, cuir, metall…).
  - NO es toquen mai el metall i els grisos (armes, armadures, ossos), la pell, el cuir i la fusta,
    ni els ribets daurats: són el que fa que les parts es distingeixin.
  - Es tenyeix la ROBA (o el COS d'un monstre o d'un animal). Materials de to semblant van junts
    (el plomall segueix la capa, com els va combinar l'autor).
  - Colors amb sentit segons la criatura: roba en colors heràldics, animals en colors naturals,
    monstres en colors de fantasia. Res de rosa. `RULES` fixa a mà el que l'automàtic no encerta.
Requereix Pillow (i, opcional, `pyoxipng` per reduir els PNG).
"""
import colorsys, math, os, re, sys
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'public', 'sprites', 'uf_heroes.png')
OUT_TS = os.path.join(ROOT, 'src', 'lib', 'sprites', 'variants.ts')
T = 48
COLS = 4  # fotogrames per criatura al full

man = open(os.path.join(ROOT, 'src', 'lib', 'sprites', 'manifest.ts')).read().split('export const ITEMS')[0]
CREATURES = {m[1]: (int(m[2]), int(m[3])) for m in re.finditer(r'\n  (\w+): \[(\d+), (\d+)\]', man)}

# ── Colors ─────────────────────────────────────────────────────────────────────
CLOTH = {  # roba: colors heràldics
    'vermell': 'a33030', 'granat': '6e2233', 'blau': '2d5aa8', 'blau fosc': '273a73', 'verd': '2e7a3c',
    'verd fosc': '2c4f2e', 'lila': '62388f', 'negre': '3b3b42', 'turquesa': '1f7a7a', 'ocre': '9c7a2c', 'blanc': 'd8d6cc',
}
NATURAL = {  # animals
    'marró': '7a5230', 'gris': '7f8086', 'negre': '38383e', 'sorra': 'b89b62', 'rovell': '9e4f2a',
    'blanc': 'd9d8d0', 'verd molsa': '56693a', 'olivaci': '6b6a3a',
}
FANTASY = {  # monstres i criatures màgiques
    'vermell': 'b03a2e', 'blau': '2f63b8', 'verd': '3a8a3a', 'lila': '6c3c9e', 'negre': '3a3a44', 'turquesa': '23888a',
    'taronja': 'c8692a', 'gel': '8fc4dc', 'os': 'cfc6a8', 'ombra': '4a3f66', 'or': 'b8952e', 'gris': '7c7f88',
}

EXTRA = {  # colors de les regles fetes a mà
    'pell torrada': 'c08850', 'pell fosca': '7d4f33', 'pell clara': 'e0b48a', 'acer': '8a8d94', 'ferro': '4a4a52',
    'plata': 'c3c8d2', 'bronze': 'a0662e', 'coure': 'b5653a', 'gris blavós': '6f7f8a',
    'ombra lila': '2e2440', 'ombra lila 2': '4a3a66', 'ombra verda': '1f3324', 'ombra verda 2': '35593a',
}
ANIMALS = re.compile(r'^(bat|spider|rat|wolf|bird|snake|beetle|moth|toad|worm|flies)')
HUMANOIDS = re.compile(r'^(wizard|cultist|knight|archer|priest|barbarian|thief|druid|helion|necromancer|warrior|minstrel|paladin|dknight|templar|witch|monk|warden|prisoner|elf|drow|dwarf|valkyrie|halfling|lord|lady|merchant|vampire|lich|skeleton|zombie|mummy)')

# Regles a mà per figura. Cada variant: llista de (selector, color). Selectors:
#   'g1', 'g2'… = grups recolorables per ordre de mida · 'm3' = material 3 (sense filtre)
#   'hX-Y' = tots els materials de color amb to entre X i Y (0..1); 'hX-Y+' = només els saturats
#   (no la pell, que té el mateix to que una caputxa taronja) · 'N' = els grisos
# Un color pot ser un nom de les paletes o 'rrggbb'. `None` = sense variants.
_lizard = [[('g1', 'rovell')], [('g1', 'sorra')]]
RULES = {
    'wizard': [[('g1', 'vermell')], [('g1', 'negre')]],
    'thief': [[('g1', 'verd fosc')], [('g1', 'negre')]],
    'warrior_m': [[('g1', 'vermell')], [('g1', 'negre')]],
    # Armadura fosca, es queda: canvia el tabard vermell.
    'dknight': [[('h0.94-0.06+', 'blau')], [('h0.94-0.06+', 'verd')]],
    'goblin_shaman': [[('h0.94-0.06+', 'blau')], [('h0.94-0.06+', 'lila')]],
    'vampire': [[('h0.94-0.06+', 'blau fosc')], [('h0.94-0.06+', 'verd fosc')]],
    'mummy_pharoah': [[('h0.04-0.14+', 'blau')], [('h0.04-0.14+', 'turquesa')]],
    'merchant_a': [[('h0.03-0.11+', 'blau')], [('h0.03-0.11+', 'verd')]],
    'druid': [[('g1', 'ocre')], [('g1', 'granat')]],
    'necromancer': [[('g1', 'granat')], [('g1', 'verd fosc')]],
    # Pell de colors de la seva raça, no de fantasia.
    'goblin': [[('g1', 'olivaci')], [('g1', 'rovell')]],
    'goblin_warrior': [[('g1', 'olivaci')], [('g1', 'rovell')]],
    'troll': [[('g1', 'olivaci')], [('g1', 'gris blavós')]],
    'banshee': [[('g1', 'verd')], [('g1', 'ombra')]],
    'bat_giant': [[('g1', 'marró')], [('g1', 'gris')]],
    'bat': [[('g1', 'marró')], [('g1', 'gris')]],
    'snake_giant': [[('g1', 'marró')], [('g1', 'negre')]],
    'snake': [[('g1', 'marró')], [('g1', 'negre')]],
    'bird_dove': [[('N', 'gris')], [('N', 'sorra')]],
    'bird_crow': [[('g1', 'marró')], [('g1', 'blanc')]],
    'wolf_black': [[('N', 'gris')], [('N', 'blanc')]],
    **{k: _lizard for k in ('lizardman_green', 'lizardman_green_spear', 'lizardman_green_shaman')},
    **{k: [[('g1', 'verd')], [('g1', 'rovell')]] for k in ('lizardman_blue', 'lizardman_blue_spear', 'lizardman_blue_shaman')},
    'wisp': [[('g1', 'taronja')], [('g1', 'verd')]],
    'wisp_ancient': [[('g1', 'taronja')], [('g1', 'verd')]],
    'dragon_shadow': [[('m0', 'ombra lila'), ('m1', 'ombra lila 2')], [('m0', 'ombra verda'), ('m1', 'ombra verda 2')]],
    'golem_stone': [[('N', 'sorra')], [('N', 'ombra')]],
    'golem_metal': [[('g1', 'acer')], [('g1', 'rovell')]],
    'golem_mud': [[('g1', 'gris')], [('g1', 'rovell')]],
    'golem_ice': [[('g1', 'lila')], [('g1', 'verd')]],
    'elemental_air': [[('g1', 'lila')], [('g1', 'gris')]],
    'elemental_earth': [[('g1', 'gris')], [('g1', 'verd molsa')]],
    'elemental_water': [[('g1', 'verd')], [('g1', 'ombra')]],
    # Dracs: els colors de drac que el paquet no té (or, negre, plata, bronze, coure).
    'dragon_red': [[('g1', 'or')], [('g1', 'negre')]],
    'dragon_blue': [[('g1', 'plata')], [('g1', 'bronze')]],
    'dragon_green': [[('g1', 'negre')], [('g1', 'coure')]],
    'minotaur': [[('g1', 'marró')], [('g1', 'negre')]],
    'ogre': [[('g1', 'olivaci')], [('g1', 'gris blavós')]],
    'ogre_mystic': [[('g1', 'olivaci')], [('g1', 'gris blavós')]],
    'bird_crow': [[('N', 'marró')], [('N', 'blanc')]],
    'mimic': [[('g1', 'acer')], [('g1', 'ferro')]],
    # Gent sense roba de color: la variant és el to de pell.
    'barbarian_m': [[('h0.13-0.17', 'pell torrada')], [('h0.13-0.17', 'pell fosca')]],
    'barbarian_f': [[('h0.13-0.17', 'pell torrada')], [('h0.13-0.17', 'pell fosca')]],
    'prisoner_a': [[('m0', 'pell torrada')], [('m0', 'pell fosca')]],
    'prisoner_b': [[('m0', 'pell clara')], [('m0', 'pell torrada')]],
    'prisoner_c': [[('m0', 'pell clara')], [('m0', 'pell fosca')]],
    'spirit': [[('N', 'gel')], [('N', 'verd')]],
    'spirit_greater': [[('N', 'gel')], [('N', 'verd')]],
}

# ── Materials ──────────────────────────────────────────────────────────────────
def hsv(c): return colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)
def hdist(a, b): d = abs(a - b) % 1; return min(d, 1 - d)
def hex2hsv(h): return hsv((int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)))

def is_outline(c): return hsv(c)[2] < 0.16
def is_neutral(c): h, s, v = hsv(c); return s < 0.17 or v < 0.22

def materials(strip):
    """Materials d'una tira de fotogrames: [{colors, n, h, s, v, neutral}] per mida."""
    px = strip.load(); W = strip.width
    cnt, adj, ysum = {}, {}, {}
    top, bot = T, 0
    for y in range(T):
        for x in range(W):
            p = px[x, y]
            if p[3] < 200: continue
            top, bot = min(top, y), max(bot, y)
            c = p[:3]; cnt[c] = cnt.get(c, 0) + 1; ysum[c] = ysum.get(c, 0) + y
            for dx, dy in ((1, 0), (0, 1)):
                xx, yy = x + dx, y + dy
                if xx < W and yy < T and xx // T == x // T:
                    q = px[xx, yy]
                    if q[3] >= 200 and q[:3] != c:
                        k = tuple(sorted((c, q[:3]))); adj[k] = adj.get(k, 0) + 1
    par = {c: c for c in cnt}
    def find(c):
        while par[c] != c: par[c] = par[par[c]]; c = par[c]
        return c
    for (a, b), n in sorted(adj.items(), key=lambda kv: -kv[1]):
        if n < 2 or is_outline(a) or is_outline(b) or is_neutral(a) != is_neutral(b): continue
        (ha, sa, _), (hb, sb, _) = hsv(a), hsv(b)
        if is_neutral(a): good = (abs(sa - sb) < 0.12 and hdist(ha, hb) < 0.15) or (sa < 0.08 and sb < 0.08)
        else: good = hdist(ha, hb) < 0.06 and abs(sa - sb) < 0.35
        if good: par[find(a)] = find(b)
    groups = {}
    for c in cnt:
        if not is_outline(c): groups.setdefault(find(c), []).append(c)
    out = []
    for cs in groups.values():
        n = sum(cnt[c] for c in cs)
        cx = sum(math.cos(hsv(c)[0] * 2 * math.pi) * cnt[c] for c in cs)
        cy = sum(math.sin(hsv(c)[0] * 2 * math.pi) * cnt[c] for c in cs)
        out.append(dict(colors=set(cs), cnt={c: cnt[c] for c in cs}, n=n, h=(math.atan2(cy, cx) / (2 * math.pi)) % 1,
                        s=sum(hsv(c)[1] * cnt[c] for c in cs) / n, v=sum(hsv(c)[2] * cnt[c] for c in cs) / n,
                        neutral=is_neutral(cs[0]),
                        # Alçada del material dins de la figura: 0 = el cap, 1 = els peus.
                        y=(sum(ysum[c] for c in cs) / n - top) / max(1, bot - top)))
    out.sort(key=lambda m: -m['n'])
    return out

def kind(m, humanoid, body=False):
    """
    Què és un material: 'metal', 'skin', 'hair', 'leather', 'gold' (es queden) o 'cloth' (es pot tenyir).
    `body`: és el material de color més gran d'un monstre o d'un animal, o sigui el seu cos, encara
    que sigui marró (una rata, un gòlem de fang): llavors no compta com a cuir.
    """
    h, s, v = m['h'], m['s'], m['v']
    if m['neutral']: return 'metal'
    if humanoid and 0.0 <= h <= 0.16 and 0.15 <= s <= 0.62 and v >= 0.6: return 'skin'
    # Cabell i barba: to càlid (ros, pèl-roig, castany) a la part de dalt de la figura.
    if humanoid and 0.025 <= h <= 0.17 and m['y'] < 0.45 and v >= 0.45: return 'hair'
    if 0.03 <= h <= 0.14 and v < 0.62 and s >= 0.4 and not body: return 'leather'
    if 0.11 <= h <= 0.19 and s >= 0.5 and v >= 0.75: return 'gold'
    return 'cloth'

def cloth_groups(mats, humanoid, total):
    """Grups recolorables: materials de roba, i els petits de to semblant hi van junts."""
    first = next((m for m in mats if not m['neutral']), None)
    cloth = [m for m in mats if kind(m, humanoid, body=not humanoid and m is first) == 'cloth']
    groups = []
    for m in cloth:
        g = next((g for g in groups if hdist(g[0]['h'], m['h']) < 0.07), None)
        if g is not None: g.append(m)
        elif m['n'] >= max(10, 0.04 * total): groups.append([m])
    return groups

# ── Recolor ────────────────────────────────────────────────────────────────────
def fit(vals, target, lo, hi):
    """Porta la mitjana a `target` conservant els graons de la rampa, comprimint-los si no hi caben."""
    mean = sum(v * n for v, n in vals) / sum(n for _, n in vals)
    vmin, vmax = min(v for v, _ in vals), max(v for v, _ in vals)
    k = 1.0
    if vmax > mean: k = min(k, (hi - target) / (vmax - mean))
    if vmin < mean: k = min(k, (target - lo) / (mean - vmin))
    k = max(k, 0.35)
    return lambda v: min(hi, max(lo, target + (v - mean) * k))

def recolor_map(group, hexcol):
    """Color antic → color nou per a tots els colors d'un grup de materials."""
    th, ts, tv = hex2hsv(hexcol)
    allc = {}
    for m in group: allc.update(m['cnt'])
    hs = {c: hsv(c) for c in allc}
    cx = sum(math.cos(hs[c][0] * 2 * math.pi) * n for c, n in allc.items())
    cy = sum(math.sin(hs[c][0] * 2 * math.pi) * n for c, n in allc.items())
    mh = (math.atan2(cy, cx) / (2 * math.pi)) % 1
    neutral = all(m['neutral'] for m in group)
    fs = fit([(hs[c][1], n) for c, n in allc.items()], ts, 0.04 if ts < 0.15 else 0.12, 1.0)
    fv = fit([(hs[c][2], n) for c, n in allc.items()], tv, 0.2, 0.98)
    out = {}
    for c in allc:
        h, s, v = hs[c]
        h2 = th if neutral else (th + (h - mh)) % 1
        s2 = ts * (0.6 + 2 * s) if neutral else fs(s)
        r, g, b = colorsys.hsv_to_rgb(h2, min(1, s2), fv(v))
        out[c] = (round(r * 255), round(g * 255), round(b * 255))
    return out

# ── Tria de colors ─────────────────────────────────────────────────────────────
def palette_for(name):
    if ANIMALS.match(name): return NATURAL
    if HUMANOIDS.match(name): return CLOTH
    return FANTASY

def pick(palette, avoid_h, avoid_names=(), n=2, original=None):
    """Els `n` colors de la paleta que més es distingeixen del to original i dels altres materials."""
    scored = []
    for name, hx in palette.items():
        if name in avoid_names: continue
        h, s, v = hex2hsv(hx)
        if original is not None:
            oh, os_, ov = original
            if s >= 0.2 and os_ >= 0.2 and hdist(h, oh) < 0.12 and abs(v - ov) < 0.25: continue
        d = min([hdist(h, a) if s >= 0.2 else 0.25 for a in avoid_h] + [1])
        scored.append((d, name))
    scored.sort(key=lambda t: -t[0])
    chosen = []
    for _, nm in scored:
        h, s, v = hex2hsv(palette[nm])
        if all(not (hdist(h, hex2hsv(palette[c])[0]) < 0.1 and abs(v - hex2hsv(palette[c])[2]) < 0.25 and s > 0.2) for c in chosen):
            chosen.append(nm)
        if len(chosen) == n: break
    return chosen

def auto_variants(name, mats, total):
    humanoid = bool(HUMANOIDS.match(name))
    groups = cloth_groups(mats, humanoid, total)
    if not groups: return []
    pal = palette_for(name)
    kept_h = [m['h'] for m in mats if kind(m, humanoid) in ('skin', 'hair', 'leather', 'gold') and m['n'] >= 6]
    g1 = groups[0]
    o1 = (g1[0]['h'], g1[0]['s'], g1[0]['v'])
    c1 = pick(pal, kept_h + [g1[0]['h']], n=2, original=o1)
    out = [[('g1', c)] for c in c1]
    if len(groups) > 1 and len(out) == 2:
        # La segona variant també canvia el segon grup (la túnica sota la capa…), amb un color
        # que lligui amb el nou del primer i no repeteixi cap to que ja hi ha.
        g2 = groups[1]
        c2 = pick(pal, kept_h + [hex2hsv(pal[c1[1]])[0], g2[0]['h']], avoid_names=(c1[1],), n=1,
                  original=(g2[0]['h'], g2[0]['s'], g2[0]['v']))
        if c2: out[1].append(('g2', c2[0]))
    return out

def resolve(sel, mats, groups):
    if sel == 'N': return [m for m in mats if m['neutral']]
    if sel[0] == 'g': i = int(sel[1:]) - 1; return groups[i] if i < len(groups) else []
    if sel[0] == 'm': i = int(sel[1:]); return [mats[i]] if i < len(mats) else []
    if sel[0] == 'h':
        sat = sel.endswith('+')
        a, b = (float(x) for x in sel[1:].rstrip('+').split('-'))
        return [m for m in mats if not m['neutral'] and (not sat or m['s'] >= 0.62)
                and (a <= m['h'] <= b if a <= b else (m['h'] >= a or m['h'] <= b))]
    raise ValueError(sel)

def apply(strip, mats, groups, variant, pal):
    out = strip.copy(); px = out.load()
    cmap = {}
    for sel, col in variant:
        g = resolve(sel, mats, groups)
        if g: cmap.update(recolor_map(g, pal.get(col, col)))
    for y in range(out.height):
        for x in range(out.width):
            p = px[x, y]
            if p[3] >= 200 and p[:3] in cmap: px[x, y] = cmap[p[:3]] + (p[3],)
    return out

# ── Sortida ────────────────────────────────────────────────────────────────────
def main():
    sheet = Image.open(SRC).convert('RGBA')
    outs = [Image.new('RGBA', sheet.size, (0, 0, 0, 0)) for _ in range(2)]
    table = {}
    review = []
    for name, (x, y) in CREATURES.items():
        strip = sheet.crop((x, y, x + T * COLS, y + T))
        mats = materials(strip.crop((0, 0, T * 3, T)))  # els fotogrames de l'animació d'espera
        total = sum(m['n'] for m in mats)
        humanoid = bool(HUMANOIDS.match(name))
        groups = cloth_groups(mats, humanoid, total)
        variants = RULES.get(name, auto_variants(name, mats, total)) or []
        pal = palette_for(name)
        labels, imgs = [], []
        for i, v in enumerate(variants[:2]):
            img = apply(strip, mats, groups, v, {**CLOTH, **NATURAL, **FANTASY, **EXTRA, **pal})
            outs[i].alpha_composite(img, (x, y))
            names = []
            for _, c in v:
                c = re.sub(r' \d$', '', c)
                if c not in names: names.append(c)
            labels.append(' i '.join(names)); imgs.append(img)
        if labels: table[name] = labels
        review.append((name, strip, imgs, labels))
    for i, o in enumerate(outs):
        dst = os.path.join(ROOT, 'public', 'sprites', f'uf_heroes_v{i + 1}.png')
        o.save(dst, optimize=True)
        try:  # com els altres fulls: optimitzador sense pèrdua si hi és (`pip install pyoxipng`)
            import oxipng; oxipng.optimize(dst, level=4)
        except ImportError:
            pass
    with open(OUT_TS, 'w') as f:
        f.write('// GENERAT amb `scripts/oryx-variants.py` (no editar a mà): variants de color de cada\n')
        f.write('// figureta, a les mateixes coordenades que `uf_heroes.png` dins de `uf_heroes_v1/2.png`.\n\n')
        f.write('/** Criatura → colors de cada variant (la 1 és a `uf_heroes_v1.png`, la 2 a `uf_heroes_v2.png`). */\n')
        f.write('export const CREATURE_VARIANTS: Record<string, readonly string[]> = {\n')
        for k, v in table.items(): f.write(f"  {k}: [{', '.join(repr(s) for s in v)}],\n")
        f.write('};\n')
    if '--sheet' in sys.argv:
        dst = sys.argv[sys.argv.index('--sheet') + 1]
        SC, per = 2, 3
        cw, ch = T * SC * per + 12, T * SC + 14
        ncol = 4
        rows = math.ceil(len(review) / ncol)
        img = Image.new('RGBA', (cw * ncol, ch * rows), (34, 36, 44, 255)); d = ImageDraw.Draw(img)
        for k, (name, strip, imgs, labels) in enumerate(review):
            ox, oy = (k % ncol) * cw, (k // ncol) * ch
            for j, im in enumerate([strip] + imgs):
                img.alpha_composite(im.crop((0, 0, T, T)).resize((T * SC, T * SC), Image.NEAREST), (ox + j * T * SC, oy))
            d.text((ox + 2, oy + T * SC), f"{name}: {' | '.join(labels) or '—'}", fill=(220, 220, 220, 255))
        img.save(dst)
    print(len(table), 'figures amb variants de', len(CREATURES))

if __name__ == '__main__':
    main()
