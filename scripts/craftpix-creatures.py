#!/usr/bin/env python3
"""
Criatures dels paquets de CraftPix (v5.33): animals, plantes depredadores, monjos, sacerdot, ciutadans i
lluitador. Fan servir el mateix sistema que el bestiari d'Oryx: 3 fotogrames d'espera (cicle 1-2-3-2).

Genera:
  - `public/sprites/cp_creatures.png`  — una criatura per fila, 3 fotogrames de 64 px (CELL).
  - `src/lib/sprites/cp-creatures.ts`  — GENERAT: nom → [x, y], etiqueta i grup.

De cada full d'animació d'espera (4 files = 4 direccions, la 1a és de cara) es prenen 3 fotogrames
repartits per la primera meitat del cicle (0, n/4, n/2: amb el 1-2-3-2 fa un respir suau). La mida del
píxel no es toca (1×): es retalla al que es veu (el mateix per als 3 fotogrames, perquè no saltin) i es
posa al mig, amb els peus a la mateixa altura que les figuretes d'Oryx (fila 52 de la casella de 64).

⚠️ Criatures noves sempre AL FINAL de `CREATURES` (el nom és a les partides desades; l'ordre no).

    python3 scripts/craftpix-creatures.py
"""
import json
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'texture-packs')
OUT_PNG = os.path.join(ROOT, 'public', 'sprites', 'cp_creatures.png')
OUT_TS = os.path.join(ROOT, 'src', 'lib', 'sprites', 'cp-creatures.ts')
CELL = 64
FEET = 52   # fila de la casella de 64 px on queden els peus (l'Oryx: ~4 px sobre la vora de la de 48)

H = 'hunt-animals/PNG/Without_shadow'
P = 'predator-plants/PNG'
C = 'chapel/PNG/Animation'
G = 'guild-hall/PNG'
# (id, etiqueta, grup, fitxer)
CREATURES = [
    ('cp_boar', 'Senglar', 'Animals de caça', f'{H}/Boar/Boar_Idle.png'),
    ('cp_deer', 'Cérvol', 'Animals de caça', f'{H}/Deer/Deer_Idle.png'),
    ('cp_fox', 'Guineu', 'Animals de caça', f'{H}/Fox/Fox_Idle.png'),
    ('cp_hare', 'Llebre', 'Animals de caça', f'{H}/Hare/Hare_Idle.png'),
    ('cp_black_grouse', 'Gall de bruc', 'Animals de caça', f'{H}/Black_grouse/Black_grouse_Idle.png'),
    ('cp_plant1', 'Planta depredadora vermella', 'Plantes depredadores', f'{P}/Plant1/Without_shadow/Plant1_Idle_without_shadow.png'),
    ('cp_plant2', 'Planta depredadora 2', 'Plantes depredadores', f'{P}/Plant2/Without_shadow/Plant2_Idle_without_shadow.png'),
    ('cp_plant3', 'Planta depredadora 3', 'Plantes depredadores', f'{P}/Plant3/Without_shadow/Plant3_Idle_without_shadow.png'),
    ('cp_monk1', 'Monjo 1', 'Monjos i clergues', f'{C}/Mon1k_Idle_without_shadow.png'),
    ('cp_monk2', 'Monjo 2', 'Monjos i clergues', f'{C}/Mon2k_Idle_without_shadow.png'),
    ('cp_monk3', 'Monjo 3', 'Monjos i clergues', f'{C}/Mon3k_Idle_without_shadow.png'),
    ('cp_monk4', 'Monjo 4', 'Monjos i clergues', f'{C}/Mon4k_Idle_without_shadow.png'),
    ('cp_priest', 'Sacerdot', 'Monjos i clergues', f'{C}/Priest_Idle_without_shadow.png'),
    ('cp_citizen1', 'Ciutadà 1', 'Ciutadans', f'{G}/Citizen1_Idle_without_shadow.png'),
    ('cp_citizen2', 'Ciutadà 2', 'Ciutadans', f'{G}/Citizen2_Idle_without_shadow.png'),
    ('cp_fighter', 'Lluitador', 'Ciutadans', f'{G}/Fighter2_Idle_without_shadow.png'),
]


def frames(path):
    """Els 3 fotogrames d'espera (fila 0) d'un full de 4 files de fotogrames quadrats."""
    im = Image.open(os.path.join(SRC, path)).convert('RGBA')
    fh = im.height // 4
    assert im.width % fh == 0, path
    n = im.width // fh
    idx = [0, n // 4, n // 2]
    return [im.crop((i * fh, 0, i * fh + fh, fh)) for i in idx]


def main():
    ids = [c[0] for c in CREATURES]
    assert len(ids) == len(set(ids))
    sheet = Image.new('RGBA', (3 * CELL, len(CREATURES) * CELL), (0, 0, 0, 0))
    out = {}
    for row, (cid, label, group, path) in enumerate(CREATURES):
        fr = frames(path)
        boxes = [f.getbbox() for f in fr if f.getbbox()]
        x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
        x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
        w, h = x1 - x0, y1 - y0
        assert w <= CELL and h <= FEET, (cid, w, h)
        for k, f in enumerate(fr):
            sheet.alpha_composite(f.crop((x0, y0, x1, y1)), (k * CELL + (CELL - w) // 2, row * CELL + FEET - h))
        out[cid] = (0, row * CELL, label, group)
    os.makedirs(os.path.dirname(OUT_PNG), exist_ok=True)
    sheet.save(OUT_PNG, optimize=True)
    try:
        import oxipng
        oxipng.optimize(OUT_PNG, level=4)
    except ImportError:
        pass
    js = json.dumps
    lines = [
        '// GENERAT per `scripts/craftpix-creatures.py` — no editar a mà (tocar el script i tornar-lo a executar).',
        '// Criatures dels paquets de CraftPix a `public/sprites/cp_creatures.png`: una per fila, 3 fotogrames de `CP_CELL` px.',
        '',
        f'export const CP_CELL = {CELL};',
        '/** Nom → [x, y] del primer fotograma. */',
        'export const CP_CREATURES: Record<string, readonly [number, number]> = {',
        *[f'  {k}: [{v[0]}, {v[1]}],' for k, v in out.items()],
        '};',
        '/** Nom → [etiqueta, grup]. */',
        'export const CP_INFO: Record<string, readonly [string, string]> = {',
        *[f'  {k}: [{js(v[2], ensure_ascii=False)}, {js(v[3], ensure_ascii=False)}],' for k, v in out.items()],
        '};',
        '',
    ]
    with open(OUT_TS, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f'{len(out)} criatures → {os.path.relpath(OUT_PNG, ROOT)} ({3 * CELL}×{len(CREATURES) * CELL})')


if __name__ == '__main__':
    main()
