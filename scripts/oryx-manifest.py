#!/usr/bin/env python3
"""
Genera `src/lib/sprites/manifest.ts` a partir del paquet Oryx «Ultimate Fantasy» descomprimit.

    python3 scripts/oryx-manifest.py /camí/al/paquet/descomprimit

Busca cada PNG solt de `uf_split/` dins del seu full (comparant l'alfa exacte i el color dels
píxels opacs: els píxels transparents dels fitxers solts no tenen el mateix RGB que el full)
i n'escriu el nom i la posició. Només surten noms i coordenades, cap píxel: els fulls tenen
llicència de l'autor i no van al repositori (veure `src/lib/sprites/pack.ts`).
Requereix Pillow i numpy.
"""
import sys, os, numpy as np
from PIL import Image

root = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'lib', 'sprites', 'manifest.ts')

def norm(a):
    a = a.astype(np.int16); a[a[..., 3] == 0] = 0; return a

def locate(sheet, folder, fine=False):
    S = norm(np.array(Image.open(os.path.join(root, sheet)).convert('RGBA')))
    H, W = S.shape[:2]
    res = {}
    for f in sorted(os.listdir(os.path.join(root, folder))):
        if not f.endswith('.png'): continue
        T = norm(np.array(Image.open(os.path.join(root, folder, f)).convert('RGBA')))
        h, w = T.shape[:2]
        if T[..., 3].max() == 0: continue
        m = T[..., 3] > 0
        best = None
        for sx, sy in ((w, h), (8, 8)) + (((1, 1),) if fine else ()):
            for y in range(0, H - h + 1, sy):
                for x in range(0, W - w + 1, sx):
                    blk = S[y:y + h, x:x + w]
                    if not np.array_equal(blk[..., 3] > 0, m): continue
                    d = np.abs(blk[m] - T[m]).max()
                    if best is None or d < best[0]: best = (d, x, y)
            if best and best[0] <= 2: break
        if best and best[0] <= 40: res[f[:-4]] = (best[1], best[2])
    return res

heroes = locate('uf_heroes.png', 'uf_split/uf_heroes')
items = locate('uf_items.png', 'uf_split/uf_items')
port = locate('uf_portraits.png', 'uf_split/uf_portraits', fine=True)
# Dues peces que el fitxer solt no permet trobar (difereixen del full): posició per la graella.
port.setdefault('earring_silver', (2, 102)); port.setdefault('scar_left', (152, 552))

cre = {n.rsplit('_', 1)[0]: p for n, p in heroes.items() if n.endswith('_1')}
L = ["// GENERAT a partir dels noms dels fitxers del paquet (uf_split) i de la posició de cada",
     "// sprite als fulls. Només són noms i coordenades (cap píxel): els fulls no són al repo.",
     "// Per regenerar-lo: veure `scripts/oryx-manifest.py`.", ""]
def block(doc, name, pairs):
    L.append(doc); L.append(f"export const {name}: Record<string, readonly [number, number]> = {{")
    for n, (x, y) in pairs: L.append(f"  {n}: [{x}, {y}],")
    L.append("};"); L.append("")
block("/** Criatures i personatges (`uf_heroes.png`): nom → [x, y] del primer dels 4 fotogrames (48 px, en fila). */",
      'CREATURES', sorted(cre.items(), key=lambda t: (t[1][1], t[1][0])))
block("/** Objectes (`uf_items.png`, 48 px): nom → [x, y]. */", 'ITEMS', sorted(items.items()))
block("/** Peces del generador de retrats (`uf_portraits.png`, 48 px): nom → [x, y]. */", 'PORTRAIT_PARTS', sorted(port.items()))
open(OUT, 'w').write('\n'.join(L).rstrip() + '\n')
print('ok', len(cre), len(items), len(port))
