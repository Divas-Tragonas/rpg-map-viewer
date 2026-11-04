# Prototip de la «Forja» (docs/millores.md, «d) ter»): vesteix el maniquí prisoner_a amb objectes
# d'ITEMS re-pixelats a escala de figureta. Ús: python3 scripts/sprite-kit-prototype.py sortida.png
import re, colorsys, sys
from PIL import Image
man=open('src/lib/sprites/manifest.ts').read()
def table(name):
    blk=man[man.index('export const '+name):]; blk=blk[:blk.index('};')]
    return {k:(int(x),int(y)) for k,x,y in re.findall(r'^\s+([a-z_0-9]+): \[(\d+), (\d+)\]',blk,re.M)}
CR=table('CREATURES'); IT=table('ITEMS')
H=Image.open('public/sprites/uf_heroes.png').convert('RGBA'); I=Image.open('public/sprites/uf_items.png').convert('RGBA')
lum=lambda p:(0.3*p[0]+0.59*p[1]+0.11*p[2])
def icon(n):
    x,y=IT[n]; im=I.crop((x,y,x+48,y+48)); return im.crop(im.getchannel('A').point(lambda a:255 if a>200 else 0).getbbox())
def palette(im):
    cs=sorted({p[:3] for p in im.getdata() if p[3]>200}, key=lum); return cs
def ramp(n, k=4):
    cs=palette(icon(n)); 
    if len(cs)<=k: return cs
    return [cs[round(i*(len(cs)-1)/(k-1))] for i in range(k)]
def repix(n, h=None, w=None):
    """Re-pixelat: redueix l'objecte i el torna a la paleta de l'objecte (sense mitges tintes)."""
    im=icon(n); pal=palette(im)
    if h: w=max(1,round(im.width*h/im.height))
    else: h=max(1,round(im.height*w/im.width))
    sm=im.resize((w,h),Image.BOX); out=Image.new('RGBA',(w,h)); o=out.load(); s=sm.load()
    for yy in range(h):
        for xx in range(w):
            p=s[xx,yy]
            if p[3]<110: continue
            q=min(pal,key=lambda c:sum((a-b)**2 for a,b in zip(c,p[:3]))); o[xx,yy]=(*q,255)
    return out
def is_skin(p): return p[3]>200 and p[0]>p[2]+40 and p[0]>150
def recolor(px, rows, cols, rmp, chain=False):
    for r in rows:
        for c in cols:
            p=px[c,r]
            if not is_skin(p): continue
            L=lum(p)/255; i=min(len(rmp)-1,int(L*len(rmp)))
            if chain and (r+c)%2: i=max(0,i-1)
            px[c,r]=(*rmp[i],255)
def build(spec):
    x,y=CR['prisoner_a']; f=H.crop((x,y,x+48,y+48)).copy(); px=f.load()
    # grillons fora: el gris de les mans passa a pell
    for r in range(48):
        for c in range(48):
            p=px[c,r]
            if p[3]>200 and abs(p[0]-p[1])<6 and abs(p[1]-p[2])<6 and p[0]<200: px[c,r]=(165,153,111,255)
    rmp=ramp(spec['armor']+'_chest')
    recolor(px, range(14,24), range(14,35), rmp, chain=spec.get('chain'))   # tors i espatlles
    recolor(px, range(29,40), range(15,34), ramp(spec['armor']+'_leg'))      # cames
    hm=repix(spec['armor']+'_helm', w=9); f.alpha_composite(hm,(24-hm.width//2+1, 16-hm.height))
    wp=repix(spec['weapon'], h=spec.get('wh',17)); f.alpha_composite(wp,(32-wp.width//2, 27-wp.height+3))
    if spec.get('shield'):
        sh=repix(spec['shield'], w=spec.get('sw',10)); f.alpha_composite(sh,(16-sh.width//2, 25-sh.height//2))
    return f
specs=[dict(armor='armor_gold',weapon='weapon_broadsword',shield='shield_gold_heater'),
       dict(armor='armor_chain',weapon='weapon_spear',shield='shield_iron_kite',chain=True,wh=22),
       dict(armor='armor_leather',weapon='weapon_handaxe',shield='shield_wood_buckler',sw=9,wh=12),
       dict(armor='armor_blood',weapon='weapon_greataxe',wh=18),
       dict(armor='armor_royal',weapon='weapon_mace',shield='shield_royal_kite',wh=13),
       dict(armor='armor_mystic',weapon='weapon_staff_jeweled',wh=22)]
out=Image.new('RGBA',(48*7,48),(40,40,40,255))
x,y=CR['knight']; k=H.crop((x,y,x+48,y+48)); out.paste(k,(0,0),k)
for i,s in enumerate(specs):
    g=build(s); out.paste(g,((i+1)*48,0),g)
out.resize((out.width*4,out.height*4),Image.NEAREST).save(sys.argv[1])
