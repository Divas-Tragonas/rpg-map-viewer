/**
 * Animacions dels estats damunt de la figureta (app Píxel, v5 snapshot 10). Complementen
 * `states.ts` (postura, pell, moviment i contorn) i l'anell de colors dels peus: l'anell diu QUINS estats té
 * el token; això fa que es vegi d'un cop d'ull què li passa.
 *
 *   Atordit      → estrelles que giren sobre el cap
 *   Encisat      → cors que surten del cap
 *   Paralitzat   → espurnes elèctriques pel cos
 *   Enverinat    → un núvol de verí petit al cap
 *   Retingut     → lianes que s'enrosquen als peus
 *   Inconscient  → zetes que pugen (full Oryx)
 *   Beneït       → espurnes daurades als peus
 *
 * Tot va a l'escala de píxel de la figura (`S / 48`) i és funció del temps: totes les pantalles
 * veuen el mateix. Amb `prefers-reduced-motion` es queden en un fotograma fix. No es pinten a
 * les figures derrotades ni a les invisibles (al jugador, el seu anell d'estats tampoc surt).
 */
import { PAL } from '@/lib/render/fxsprites';
import { animFrame, drawAnim, FX_ANIMS, type FxAnimId } from './fxanim';
import { blit } from './draw';
import { sheet } from './pack';

interface StatusAnim {
  anim: FxAnimId;
  /** On: cap, cos o peus. */
  at: 'head' | 'body' | 'feet';
  k: number;
  alpha?: number;
  tint?: typeof PAL[keyof typeof PAL];
  /** Dues còpies als costats dels peus, una d'elles girada. */
  pair?: boolean;
}

const STATUS_ANIMS: Record<string, StatusAnim> = {
  stunned:   { anim: 'status_stunned', at: 'head', k: 1.5 },
  charmed:   { anim: 'status_charmed', at: 'head', k: 1.1 },
  paralyzed: { anim: 'crackle', at: 'body', k: 1.1, alpha: 0.9 },
  poisoned:  { anim: 'poison_puff', at: 'head', k: 0.8, alpha: 0.8 },
  restrained:{ anim: 'vines', at: 'feet', k: 0.85, pair: true },
  blessed:   { anim: 'spark_fountain', at: 'feet', k: 1.0, alpha: 0.7, tint: PAL.radiant },
};
/** Ordre de pintat (els de sota primer). */
const ORDER = ['blessed', 'restrained', 'paralyzed', 'poisoned', 'charmed', 'stunned'] as const;

/** Té algun estat amb animació? (per no fer res a la majoria de figures) */
export const hasStatusFx = (conds: readonly string[]) => conds.some(c => c in STATUS_ANIMS || c === 'unconscious');

/**
 * Pinta les animacions dels estats. `headY`: dalt del cos de la figura; `footY`: els peus; `S`: mida
 * de la figura; `lying`: estirada (el cap queda arran de terra, a un costat).
 */
export function drawStatusFx(ctx: CanvasRenderingContext2D, conds: readonly string[], cx: number, headY: number, footY: number,
  S: number, now: number, seed: number, lying: boolean, calm: boolean) {
  if (!sheet('anims') || !hasStatusFx(conds)) return;
  const px = S / 48;
  const t = calm ? 400 : now + seed * 97;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const headX = lying ? cx + S * 0.22 : cx;
  const hy = lying ? footY - S * 0.18 : headY;
  for (const id of ORDER) {
    if (!conds.includes(id)) continue;
    const s = STATUS_ANIMS[id];
    const a = FX_ANIMS[s.anim];
    const frame = animFrame(s.anim, t, true);
    ctx.globalAlpha = s.alpha ?? 1;
    const o = { tint: s.tint, bright: true };
    if (s.at === 'head') {
      drawAnim(ctx, s.anim, frame, headX, hy - a.h * px * s.k * 0.15, px * s.k, { ...o, anchor: 'foot' });
    } else if (s.at === 'body') {
      drawAnim(ctx, s.anim, frame, cx, lying ? footY - S * 0.1 : (headY + footY) / 2, px * s.k, o);
    } else if (s.pair) {
      drawAnim(ctx, s.anim, frame, cx - S * 0.16, footY + px * 2, px * s.k, { ...o, anchor: 'foot' });
      drawAnim(ctx, s.anim, (frame + 2) % a.n, cx + S * 0.16, footY + px * 2, px * s.k, { ...o, anchor: 'foot', flip: true });
    } else {
      drawAnim(ctx, s.anim, frame, cx, footY + px * 2, px * s.k, { ...o, anchor: 'foot' });
    }
  }
  if (conds.includes('unconscious')) {
    // Zetes del full Oryx (`uf_FX.png`, 24 px): tres que pugen, creixen i s'esvaeixen, desfasades.
    for (let i = 0; i < 3; i++) {
      const p = calm ? 0.25 + i * 0.25 : ((t / 1600 + i / 3) % 1);
      const z = (0.45 + p * 0.5) * S * 0.6;
      ctx.globalAlpha = Math.min(1, p * 4) * (1 - p);
      blit(ctx, 'fx', 2 * 24, 4 * 24, 24, 24, headX + p * S * 0.25 - z / 2, hy - p * S * 0.45 - z, z, z);
    }
  }
  ctx.restore();
}
