/**
 * Estats (condicions) damunt de la figureta de l'app Píxel. Els badges i l'anell continuen dient
 * QUINS estats té el token; això fa que la figura també ho expliqui d'un cop d'ull:
 *
 *   Tombat, Inconscient, Morint        → estirada a terra (Inconscient i Morint, quieta)
 *   Petrificat                         → de pedra i quieta
 *   Enverinat · Morint                 → batec verd · batec vermell
 *   Paralitzat · Encisat               → contorn del color de l'estat (groc · rosa), que batega
 *   Agafat, Retingut, Incapacitat      → quieta (no fa l'animació d'espera)
 *   Atordit · Espantat · Cansament     → es balanceja · tremola · respira a mig ritme
 *   Encegat, Ensordit, Invisible       → res de nou (Invisible ja té el seu tractament)
 *
 * Els efectes de color es fan amb `getImageData` un sol cop per figureta i efecte (`ctx.filter`
 * no existeix a Safari, i la pantalla de jugador sovint és un iPad), igual que `grayCreature`.
 */
import { CONDITIONS } from '@/constants';
import { TILE, drawCreature, creatureFrame, hasCreature, sheetReady } from './draw';

export interface FigureLook {
  lying: boolean;
  skin: 'stone' | 'poison' | 'blood' | null;
  motion: 'idle' | 'frozen' | 'wobble' | 'tremble' | 'slow';
  /** Contorn (color de l'estat) o null. */
  outline: string | null;
}

const FREEZE = ['petrified', 'paralyzed', 'unconscious', 'dying', 'restrained', 'grappled', 'incapacitated'];
const condColor = (id: string) => CONDITIONS.find(c => c.id === id)?.color ?? '#ffffff';

/** La figura és estirada a terra? (també ho fa servir el render per baixar-hi els badges dels estats) */
export const isLying = (conds: readonly string[]) => conds.includes('prone') || conds.includes('unconscious') || conds.includes('dying');

export function figureLook(conds: readonly string[]): FigureLook {
  const has = (id: string) => conds.includes(id);
  const stone = has('petrified');
  return {
    lying: isLying(conds),
    skin: stone ? 'stone' : has('dying') ? 'blood' : has('poisoned') ? 'poison' : null,
    motion: FREEZE.some(has) ? 'frozen' : has('stunned') ? 'wobble' : has('frightened') ? 'tremble' : has('exhaustion') ? 'slow' : 'idle',
    outline: stone ? null : has('paralyzed') ? condColor('paralyzed') : has('charmed') ? condColor('charmed') : null,
  };
}

const NONE: FigureLook = { lying: false, skin: null, motion: 'idle', outline: null };
const sameLook = (a: FigureLook, b: FigureLook) => a.lying === b.lying && a.skin === b.skin && a.motion === b.motion && a.outline === b.outline;
export const plainLook = (l: FigureLook) => sameLook(l, NONE);

// ── Tires d'efecte (els 3 fotogrames d'espera, un canvas per figureta i efecte) ──
const FRAMES = 3;
type Kind = 'clean' | 'stone' | 'poison' | 'blood' | 'white' | 'heal' | `outline:${string}`;
const _strips = new Map<string, HTMLCanvasElement>();

/** Hash enter de la posició dins del fotograma: el gra de la pedra és igual a tots els fotogrames. */
const grain = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) & 255) / 255; };
const mix = (a: readonly number[], b: readonly number[], t: number) => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t);
const STONE = [[48, 46, 42], [206, 200, 186]] as const;
const POISON = [[16, 80, 28], [160, 240, 110]] as const;
const BLOOD = [[80, 6, 10], [240, 90, 76]] as const;
// Flaixos de `hitfx.ts`: silueta blanca (cop) o vermell de poció (curació).
const WHITE = [[255, 255, 255], [255, 255, 255]] as const;
const HEAL = [[214, 34, 58], [255, 190, 198]] as const;
const SKIN_RAMP = { stone: STONE, poison: POISON, blood: BLOOD, white: WHITE, heal: HEAL } as const;
const hexRgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

function strip(sprite: string, kind: Kind): HTMLCanvasElement | null {
  const key = `${sprite}|${kind}`;
  const hit = _strips.get(key); if (hit) return hit;
  if (!hasCreature(sprite) || !sheetReady(sprite)) return null;
  const W = TILE * FRAMES;
  const c = document.createElement('canvas'); c.width = W; c.height = TILE;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  for (let f = 0; f < FRAMES; f++) drawCreature(g, sprite, f, f * TILE, 0, TILE);
  const img = g.getImageData(0, 0, W, TILE), d = img.data;
  // L'ombra semitransparent del full es treu: estirada a terra quedaria dreta, i tenyida no lliga.
  const solid = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < TILE && d[(y * W + x) * 4 + 3] >= 200;
  const out = new Uint8ClampedArray(d.length);
  const line = kind.startsWith('outline:') ? hexRgb(kind.slice(8)) : null;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (line) {
      // Contorn: cada píxel buit que toca la figura (també els forats de dins: costelles, braços).
      if (solid(x, y)) continue;
      const fx = x % TILE;
      if ((fx > 0 && solid(x - 1, y)) || (fx < TILE - 1 && solid(x + 1, y)) || solid(x, y - 1) || solid(x, y + 1)) {
        out[i] = line[0]; out[i + 1] = line[1]; out[i + 2] = line[2]; out[i + 3] = 255;
      }
      continue;
    }
    if (d[i + 3] < 200) continue;
    let rgb = [d[i], d[i + 1], d[i + 2]];
    if (kind !== 'clean') {
      const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
      const [lo, hi] = SKIN_RAMP[kind as keyof typeof SKIN_RAMP];  // el contorn ja ha fet `continue`
      rgb = mix(lo, hi, kind === 'stone' ? Math.min(1, Math.max(0, l * 1.05 + (grain(x % TILE, y) - 0.5) * 0.16)) : l);
    }
    out[i] = rgb[0]; out[i + 1] = rgb[1]; out[i + 2] = rgb[2]; out[i + 3] = 255;
  }
  g.putImageData(new ImageData(out, W, TILE), 0, 0);
  _strips.set(key, c);
  return c;
}

/**
 * De l'ombra dels peus al centre del quadrat de la figura, en fraccions de `S`: el quadrat comença
 * a `cy − S·0,62` i l'ombra és a `cy + R·0,62` amb `S = 2,4·R` (veure `drawPixelFigure`).
 */
const FOOT_TO_CENTER = 0.62 + 0.62 / 2.4 - 0.5;

let _reduced: MediaQueryList | null = null;
export const reducedMotion = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return (_reduced ??= window.matchMedia('(prefers-reduced-motion: reduce)')).matches;
};

/**
 * Pinta la figureta amb el seu estat. (cx, footY) = el centre de l'ombra dels peus; `S` = la
 * mida del quadrat de la figura; `seed` desfasa les animacions entre tokens.
 */
export function drawFigureState(ctx: CanvasRenderingContext2D, sprite: string, look: FigureLook,
  cx: number, footY: number, S: number, left: boolean, seed: number, now = performance.now(),
  /** Flaix d'un cop o d'una curació (`hitfx.ts`), damunt de tot amb la mateixa postura. */
  flash: { alpha: number; tint: 'white' | 'heal' } | null = null) {
  const calm = reducedMotion();
  const frame = look.motion === 'frozen' ? 0 : creatureFrame(look.motion === 'slow' ? now * 0.5 : now, seed);
  const px = S / TILE;  // un píxel de l'art
  const pulse = calm ? 0.5 : 0.5 + 0.5 * Math.sin(now / 1000 * Math.PI * 1.6 + seed);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (look.lying) {
    // Estirada: girada un quart de volta, el cap cap on mirava, amb l'esquena a l'ombra.
    ctx.translate(cx, footY - S * 0.04);
    ctx.rotate(left ? Math.PI / 2 : -Math.PI / 2);
  } else {
    ctx.translate(cx, footY);
    if (!calm && look.motion === 'wobble') ctx.rotate(Math.sin(now / 1000 * Math.PI * 1.7 + seed) * 0.1);
    ctx.translate(0, -S * FOOT_TO_CENTER);
    if (left) ctx.scale(-1, 1);
  }
  if (!calm && look.motion === 'tremble') ctx.translate((Math.floor(now / 70 + seed) % 2 ? 1 : -1) * px, 0);
  const at = (c: HTMLCanvasElement) => ctx.drawImage(c, frame * TILE, 0, TILE, TILE, -S / 2, -S / 2, S, S);
  if (look.outline) {
    const o = strip(sprite, `outline:${look.outline}`);
    if (o) { const a = ctx.globalAlpha; ctx.globalAlpha = a * (0.55 + 0.45 * pulse); at(o); ctx.globalAlpha = a; }
  }
  const base = look.skin === 'stone' ? strip(sprite, 'stone') : look.lying ? strip(sprite, 'clean') : null;
  if (base) at(base);
  else drawCreature(ctx, sprite, frame, -S / 2, -S / 2, S);
  if (look.skin === 'poison' || look.skin === 'blood') {
    const t = strip(sprite, look.skin);
    if (t) { const a = ctx.globalAlpha; ctx.globalAlpha = a * (0.35 + 0.3 * pulse); at(t); ctx.globalAlpha = a; }
  }
  if (flash && flash.alpha > 0) {
    const t = strip(sprite, flash.tint);
    if (t) { const a = ctx.globalAlpha; ctx.globalAlpha = a * flash.alpha; at(t); ctx.globalAlpha = a; }
  }
  ctx.restore();
}
