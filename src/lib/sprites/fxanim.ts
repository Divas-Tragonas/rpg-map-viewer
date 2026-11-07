/**
 * Animacions d'efectes de l'app Píxel (full `fx_anims.png`, generat per `scripts/fx-atlas.py` a
 * partir de la tria de `assets/fx-packs/`). Un sol punt per pintar-les: conjurs
 * (`render/pixelspells.ts`), cops i curacions (`hitfx.ts`), estats sobre la figureta
 * (`statusfx.ts`) i zones (`render/zones.ts`).
 *
 * - **Escala**: `px` = mida de pantalla (px de mapa) d'un píxel d'art. Per lligar amb les
 *   figuretes s'usa el mateix píxel que la figura (`S / 48`) o un múltiple; només les àrees de
 *   reglament (bola de foc, núvols…) s'amplien fins a la seva mida.
 * - **Temps**: tot és funció pura del temps transcorregut (`animFrame`), així totes les pantalles
 *   veuen el mateix fotograma sense estat entre frames.
 * - **Tint**: les que són blanques o d'un sol color es passen a la paleta d'una escola (`PAL`)
 *   amb `tintedRegion` (un sol cop per animació i paleta).
 */
import { blit, tintedRegion } from './draw';
import { FX_ANIMS, type FxAnimId } from './fxanims';
import type { Palette } from '@/lib/render/fxsprites';

export { FX_ANIMS, type FxAnimId };

/** Fotograma que toca després de `ms` (−1 si una d'un sol cop ja s'ha acabat o encara no ha començat). */
export function animFrame(id: FxAnimId, ms: number, loop?: boolean): number {
  const a = FX_ANIMS[id];
  if (ms < 0) return -1;
  const f = Math.floor(ms / a.ms);
  if (loop ?? a.loop) return f % a.n;
  return f < a.n ? f : -1;
}

/** Durada d'una passada sencera (ms). */
export const animMs = (id: FxAnimId) => FX_ANIMS[id].ms * FX_ANIMS[id].n;

const ramp = (p: Palette, bright: boolean) => bright ? [p.deep, p.mid, p.light, p.white] : [p.deep, p.mid, p.light];
function tintedStrip(id: FxAnimId, p: Palette, bright: boolean) {
  const a = FX_ANIMS[id];
  return tintedRegion('anims', a.x, a.y, a.w * a.n, a.h, ramp(p, bright));
}

export interface AnimOpts {
  /** On va el punt (x, y): `center` = centre de la casella de l'autor; `foot` = la base del dibuix. */
  anchor?: 'center' | 'foot';
  flip?: boolean;
  /** Gir (radians) al voltant del punt. */
  rot?: number;
  /** Paleta d'una escola. `bright`: el blanc del dibuix queda blanc (si no, el color clar). */
  tint?: Palette;
  bright?: boolean;
}

/**
 * Pinta el fotograma `frame` de l'animació `id` amb el punt d'ancoratge a (x, y). Retorna false si
 * el full encara no s'ha carregat (qui crida ho deixa estar: el procedural ja no es pinta).
 */
export function drawAnim(ctx: CanvasRenderingContext2D, id: FxAnimId, frame: number, x: number, y: number, px: number, o: AnimOpts = {}): boolean {
  if (frame < 0) return true;
  const a = FX_ANIMS[id];
  const w = a.w * px, h = a.h * px;
  const dx = o.anchor === 'foot' ? -w / 2 : -a.ox * px;
  const dy = o.anchor === 'foot' ? -h : -a.oy * px;
  const tr = o.flip || o.rot;
  if (tr) { ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); if (o.flip) ctx.scale(-1, 1); }
  const X = tr ? dx : x + dx, Y = tr ? dy : y + dy;
  let ok: boolean;
  if (o.tint) {
    const t = tintedStrip(id, o.tint, !!o.bright);
    ok = !!t;
    if (t) {
      const prev = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
      ctx.drawImage(t, frame * a.w, 0, a.w, a.h, X, Y, w, h);
      ctx.imageSmoothingEnabled = prev;
    }
  } else {
    ok = blit(ctx, 'anims', a.x + frame * a.w, a.y, a.w, a.h, X, Y, w, h);
  }
  if (tr) ctx.restore();
  return ok;
}

/**
 * Animació enrajolada al llarg d'un segment (raigs): còpies de l'animació una darrere l'altra,
 * girades cap al destí, cadascuna amb un desfasament de fotogrames perquè no es vegin iguals.
 * L'última es retalla on acaba el segment.
 */
export function drawAnimAlong(ctx: CanvasRenderingContext2D, id: FxAnimId, ms: number, x0: number, y0: number, x1: number, y1: number,
  px: number, o: { tint?: Palette; bright?: boolean; seed?: number } = {}): void {
  const a = FX_ANIMS[id];
  const L = Math.hypot(x1 - x0, y1 - y0); if (L < 1) return;
  const tw = a.w * px, h = a.h * px;
  const src = o.tint ? tintedStrip(id, o.tint, !!o.bright) : null;
  ctx.save();
  ctx.translate(x0, y0); ctx.rotate(Math.atan2(y1 - y0, x1 - x0));
  ctx.imageSmoothingEnabled = false;
  const base = Math.floor(ms / a.ms) + (o.seed ?? 0);
  for (let i = 0, d = 0; d < L; i++, d += tw) {
    const f = (base + i * 3) % a.n;
    const part = Math.min(1, (L - d) / tw);
    const sw = Math.max(1, Math.round(a.w * part));
    if (src) ctx.drawImage(src, f * a.w, 0, sw, a.h, d, -a.oy * px, sw * px, h);
    else blit(ctx, 'anims', a.x + f * a.w, a.y, sw, a.h, d, -a.oy * px, sw * px, h);
  }
  ctx.restore();
}
