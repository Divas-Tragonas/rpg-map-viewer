#!/usr/bin/env python3
"""
Icones del paquet «UPSCALE» (v5 snapshot 12): separa cada icona de les captures ampliades que va
passar el propietari (`assets/icon-packs/originals/*.png`) i en treu el fons.

Les captures són pixel art de 16 px per icona ampliat ×1,9085 amb suavitzat (per això es veien
borroses). En lloc d'ampliar-les més, es **recupera la resolució original**: es troba la quadrícula
de píxels d'art (fase de la freqüència 1/1,9085 de les vores) i es pren el píxel de pantalla del
centre de cada píxel d'art, que és el que el suavitzat ha deixat pur. A la pantalla es pinten
ampliades sense suavitzar (`image-rendering: pixelated`, múltiples enters): nítides a qualsevol mida.

  1. Fons: el panell (73,78,129) i la seva ombra (56,60,100), i tot el que hi ha entre els dos.
  2. Files: bandes horitzontals amb icones; una banda baixa (≤ 8 px) és el rètol d'una secció.
  3. Columnes: quadrícula de pas ~17,6 px (ajustada per full amb les icones de 16 d'ample exactes):
     les icones no cauen sobre píxels sencers, per això cada una es torna a mostrejar amb la seva fase.
  4. Desa `assets/icon-packs/<full>/<secció>_NN.png` (16×16 RGBA) i `<full>.png`, un full numerat.

Ús: `python3 scripts/icons-extract.py` (tots els fulls). Lent (~1 min per full): només cal si
canvien les captures.
"""
import sys, os, glob, re, numpy as np
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, 'assets', 'icon-packs')
P = 1.9085
PANEL = np.array([73., 78., 129.]); SHADOW = np.array([56., 60., 100.])
def bg(px):
    """Fons: a prop del segment panell–ombra (el panell, l'ombra i les seves barreges)."""
    v=PANEL-SHADOW; t=np.clip(((px-SHADOW)*v).sum(-1)/(v*v).sum(),-0.15,1.15)
    d=np.sqrt(((px-(SHADOW+t[...,None]*v))**2).sum(-1))
    return d<13
def phase(sig,p):
    sig=sig-sig.mean(); n=np.arange(len(sig))
    z=(sig*np.exp(-2j*np.pi*n/p)).sum()
    return (np.angle(z)/(2*np.pi))*p % p + 0.5
def sample(S,x0,y0,w,h):
    xs=x0+(np.arange(w)+0.5)*P; ys=y0+(np.arange(h)+0.5)*P
    xi=np.clip(np.round(xs-0.5).astype(int),0,S.shape[1]-1); yi=np.clip(np.round(ys-0.5).astype(int),0,S.shape[0]-1)
    return S[yi][:,xi]
def runs(v):
    out=[];start=None
    for i,x in enumerate(v):
        if x and start is None: start=i
        if not x and start is not None: out.append((start,i)); start=None
    if start is not None: out.append((start,len(v)))
    return out
def fit(sig, lo=1.85, hi=1.97):
    """Període i fase de la quadrícula de píxels d'art a partir de l'energia de les vores."""
    sig = sig - sig.mean(); n = np.arange(len(sig)); best = (0, 0, 0)
    for p in np.arange(lo, hi, 0.00005):
        z = (sig * np.exp(-2j * np.pi * n / p)).sum()
        if abs(z) > best[0]: best = (abs(z), p, np.angle(z))
    _, p, ph = best
    return p, (ph / (2 * np.pi)) * p % p + 0.5

def overview(S):
    """El full sencer a la resolució original, amb el període ajustat a tot el full."""
    px, ox = fit(np.abs(np.diff(S, axis=1)).sum(axis=(0, 2)))
    py, oy = fit(np.abs(np.diff(S, axis=0)).sum(axis=(1, 2)))
    W = int((S.shape[1] - ox) / px); H = int((S.shape[0] - oy) / py)
    xi = np.clip(np.round(ox + (np.arange(W) + 0.5) * px - 0.5).astype(int), 0, S.shape[1] - 1)
    yi = np.clip(np.round(oy + (np.arange(H) + 0.5) * py - 0.5).astype(int), 0, S.shape[0] - 1)
    return S[yi][:, xi]

def extract(sheet, sections, inner):
    src = os.path.join(BASE, 'originals', sheet + '.png'); outdir = os.path.join(BASE, sheet)
    S = np.asarray(Image.open(src).convert('RGB')).astype(float)
    gx = np.abs(np.diff(S, axis=1)).sum(axis=(0, 2)); gy = np.abs(np.diff(S, axis=0)).sum(axis=(1, 2))
    gox = phase(gx, P); goy = phase(gy, P)
    N = overview(S)   # tot el full a la resolució original (per trobar-hi les icones)
    for f in glob.glob(outdir + '/*.png'): os.remove(f)
    L,T,R,B=inner  # interior del panell (coords natives)
    fg=~bg(N); fg[:T]=0; fg[B:]=0; fg[:,:L]=0; fg[:,R:]=0
    prof=fg.sum(1)
    bands=[]
    for a,b in runs(prof>0):
        h=b-a; r=(h-16)%17.6
        # Rètol enganxat a la primera fila d'icones: 6-7 files fluixes a dalt i la resta d'icones.
        if h>18 and 4<=r<=10 and prof[a:a+5].mean()<40:
            cut=next((y for y in range(a+5,a+10) if prof[y]==0 or prof[y]>=40), a+7)
            bands.append((a,cut)); a=cut
            while a<b and prof[a]==0: a+=1
        bands.append((a,b))
    os.makedirs(outdir,exist_ok=True)
    # Quadrícula d'icones: pas i origen a partir dels trams de 16 px d'amplada exactes.
    xs=[]
    for a,b in runs(prof>0):
        for xa,xb in runs(fg[a:b].sum(0)>0):
            if xb-xa==16: xs.append(xa)
    xs=np.array(xs,float)
    best=None
    for pitch in np.arange(17.4,17.8,0.005):
        for x0 in np.arange(L,L+pitch,0.05):
            res=((xs-x0+pitch/2)%pitch-pitch/2)
            e=np.abs(res).mean()
            if best is None or e<best[0]: best=(e,pitch,x0)
    global PITCH,X0G,KMAX
    _,PITCH,X0G=best; KMAX=int((R-X0G-15)//PITCH)+1
    print('grid pitch',round(PITCH,3),'x0',round(X0G,2),'err',round(best[0],3),'cols',KMAX)
    si=-1; cnt={}; names=[]
    for a,b in bands:
        h=b-a
        if h<=8: si+=1; continue          # rètol de secció
        if si<0: si=0
        nrows=max(1,round((h-16)/PITCH)+1)
        for r in range(nrows):
            ya=a+r*PITCH
            for k in range(KMAX):
                xa=X0G+k*PITCH
                cell=fg[int(round(ya)):int(round(ya))+16, int(round(xa)):int(round(xa))+16]
                if cell.sum()<8: continue
                sx=gox+xa*P; sy=goy+ya*P
                # ajusta a la línia de la quadrícula d'art més propera (fase local)
                X0=int(max(0,sx-4)); X1=int(min(S.shape[1],sx+16*P+4)); Y0=int(max(0,sy-4)); Y1=int(min(S.shape[0],sy+16*P+4))
                reg=S[Y0:Y1,X0:X1]
                lx=phase(np.abs(np.diff(reg,axis=1)).sum(axis=(0,2)),P)+X0
                ly=phase(np.abs(np.diff(reg,axis=0)).sum(axis=(1,2)),P)+Y0
                lx+=round((sx-lx)/P)*P; ly+=round((sy-ly)/P)*P
                rgb=sample(S,lx,ly,16,16); al=~bg(rgb)
                if al.sum()<6: continue
                sec=sections[min(si,len(sections)-1)]
                cnt[sec]=cnt.get(sec,0)+1
                nm=f"{sec}_{cnt[sec]:02d}"
                Image.fromarray(np.dstack([np.clip(rgb,0,255),al*255]).astype(np.uint8),'RGBA').save(f"{outdir}/{nm}.png")
                names.append(nm)
    print(src,'sections',si+1,'expected',len(sections),cnt,sum(cnt.values()))

def contact(sheet, sections):
    """Full numerat de la carpeta (per triar icones): una fila per secció, 3× sense suavitzar."""
    sc, per = 3, 13; d = os.path.join(BASE, sheet); rows = []
    for sec in sections:
        fs = sorted(glob.glob(f'{d}/{sec}_*.png'))
        for i in range(0, len(fs), per): rows.append((sec, fs[i:i + per]))
    cw, ch = 16 * sc + 30, 16 * sc + 14
    c = Image.new('RGBA', (per * cw + 100, len(rows) * ch + 4), (30, 30, 36, 255)); g = ImageDraw.Draw(c)
    for r, (sec, fs) in enumerate(rows):
        g.text((2, r * ch + 20), sec[:14], fill=(255, 255, 0, 255))
        for i, f in enumerate(fs):
            n = re.findall(r'_(\d+)\.png', f)[0]
            im = Image.open(f).resize((16 * sc, 16 * sc), Image.NEAREST)
            x, y = 100 + i * cw, r * ch + 2
            c.alpha_composite(im, (x, y)); g.text((x + 16 * sc + 2, y + 18), n, fill=(220, 220, 220, 255))
    c.save(os.path.join(BASE, sheet + '.png'), optimize=True)

SHEETS = {
    'spells':  ('fire,ice,nature,air,holy,blood,necromancer,earth,dark,poison,water,lightning,arcane,ranger,melee,misc', (5, 26, 463, 711)),
    'weapons': ('sword,staff,warhammer,bow,spear,greataxe,crossbow,dagger,mace,battleaxe,arrow,axe,hammer,scythe', (5, 22, 461, 768)),
    'gear':    ('shield,headpiece,chestpiece,gloves,boots,cloak,amulet,belt,ring', (5, 23, 462, 495)),
    'items':   ('potion,shovel,fishing_pole,consumable,crafting,misc,magic_item', (5, 25, 463, 461)),
}

if __name__ == '__main__':
    for sheet, (secs, inner) in SHEETS.items():
        if len(sys.argv) > 1 and sheet not in sys.argv[1:]: continue
        extract(sheet, secs.split(','), inner)
        contact(sheet, secs.split(','))
