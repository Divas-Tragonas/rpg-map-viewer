// Spells d'àrea persistents: dormir i greix. Es pinten a la passada 'ground' (sota els
// tokens) i es queden fins que el DM els esborra.
//
// `e` arriba clampat a la meitat de la durada (veure `renderSpells`): l'aparició ha de
// cabre-hi sencera. El que es mou mentre l'àrea hi és (boira, bombolles, reflexos) va
// amb el rellotge absolut `tN`. Mateix llenguatge que la resta: sprites amb soroll,
// paletes `PAL`, llum suau i poques peces ben fetes.

import type { Point } from '@/types';
import { AREA_SPELL_DATA } from '@/constants';
import {
  mulberry32, mistSprite, greaseSprite, blit,
  TAU, easeOutCubic, smoothstep, dragged, glow, fxCell, rgb, PAL,
} from './fxsprites';

const ftToWorld = (ft: number, cell: number) => (ft / 5) * cell;

// ── Dormir — una boira de son que s'escampa i es queda ───────────────────────

export function drawSpellSleep(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  const c = pts[pts.length - 1]; if (!c) return;
  const P = PAL.dream, cell = fxCell(sc, gridSize), px = 1 / sc;
  const R = ftToWorld(AREA_SPELL_DATA.sleep.aoeRadiusFt, cell);
  const tN = performance.now() / 1000;
  const grow = easeOutCubic(Math.min(1, e / 1.1));   // la boira s'escampa
  const a = smoothstep(e, 0, 0.6);
  ctx.save();

  // Boira: una bufarada central i un anell de bufarades que giren lentament, repartides
  // perquè omplin tota l'àrea sense sortir-ne
  for (let i = 0; i < 7; i++) {
    const ring = i > 0, ang = (i / 6) * TAU + tN * 0.05;
    const d = ring ? R * 0.52 * grow * (0.9 + 0.1 * Math.sin(tN * 0.4 + i * 1.7)) : 0;
    ctx.globalAlpha = (ring ? 0.26 : 0.2) * a;
    blit(ctx, mistSprite(P.mid, i % 3), c.x + Math.cos(ang) * d, c.y + Math.sin(ang) * d, R * (ring ? 0.46 : 0.6) * grow, tN * 0.03 + i);
  }
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, P.deep, c.x, c.y, R * 1.05 * grow, 0.25 * a);

  // Onada d'aparició que marca el límit, i després un contorn suau que respira
  if (e < 1.2) {
    const k = e / 1.2;
    ctx.globalAlpha = 0.7 * (1 - k); ctx.strokeStyle = rgb(P.light);
    ctx.lineWidth = Math.max(px, cell * 0.2 * (1 - k));
    ctx.beginPath(); ctx.arc(c.x, c.y, R * grow, 0, TAU); ctx.stroke();
  }
  const br = 0.75 + 0.25 * Math.sin(tN * 1.4);
  ctx.globalAlpha = 0.5 * a * br; ctx.strokeStyle = rgb(P.light); ctx.lineWidth = 1.5 * px;
  ctx.beginPath(); ctx.arc(c.x, c.y, R * grow, 0, TAU); ctx.stroke();

  // Pols de somni: motes que s'enlairen a poc a poc i parpellegen
  const rnd = mulberry32(seed);
  for (let i = 0; i < 16; i++) {
    const ang = rnd() * TAU, d = Math.sqrt(rnd()) * R * 0.85 * grow, per = 3 + rnd() * 2.5, ph = rnd();
    const q = (tN / per + ph) % 1;
    const tw = 0.6 + 0.4 * Math.sin(tN * 3 + i);
    glow(ctx, i % 3 ? P.light : P.white, c.x + Math.cos(ang) * d, c.y + Math.sin(ang) * d - q * cell * 1.2,
      cell * 0.12, Math.sin(Math.PI * q) * tw * a);
  }

  // Zzz que pugen
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let z = 0; z < 2; z++) {
    const q = (tN * 0.28 + z * 0.5) % 1;
    const size = cell * (0.55 + 0.35 * q);
    const x = c.x + Math.sin(tN * 0.7 + z * 2.6) * R * 0.12 + (z ? 1 : -1) * R * 0.12;
    const y = c.y - R * (0.05 + q * 0.5);
    const za = Math.sin(Math.PI * q) * a;
    glow(ctx, P.mid, x, y, size * 1.1, 0.35 * za);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(x, y); ctx.rotate(Math.sin(tN * 0.7 + z) * 0.15);
    ctx.font = `italic 700 ${size}px Georgia, serif`;
    ctx.globalAlpha = za; ctx.fillStyle = rgb(P.white); ctx.fillText('z', 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// ── Greix — un bassal d'oli que esquitxa en caure i brilla ────────────────────

export function drawSpellGrease(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  const c = pts[pts.length - 1]; if (!c) return;
  const cell = fxCell(sc, gridSize), px = 1 / sc;
  const R = ftToWorld(AREA_SPELL_DATA.grease.aoeRadiusFt, cell);
  const SQ = 0.55; // mateix oval que la previsualització
  const tN = performance.now() / 1000;
  const spread = easeOutCubic(Math.min(1, e / 0.45));
  const a = Math.min(1, spread * 1.5);
  const rnd = mulberry32(seed);

  // Vora irregular que ondula lentament (harmònics amb llavor). Base 0,92R: el greix
  // no surt mai de l'àrea real.
  const ph1 = rnd() * TAU, ph2 = rnd() * TAU, ph3 = rnd() * TAU;
  const a1 = 0.05 + rnd() * 0.04, a2 = 0.025 + rnd() * 0.025, a3 = 0.015 + rnd() * 0.02;
  const BASE = R * 0.92 * spread;
  const blob = (r: number) => {
    ctx.beginPath();
    for (let i = 0; i <= 36; i++) {
      const th = (i / 36) * TAU;
      const w = 1 + a1 * Math.sin(3 * th + ph1 + tN * 0.3) + a2 * Math.sin(5 * th + ph2 - tN * 0.22) + a3 * Math.sin(8 * th + ph3 + tN * 0.4);
      const x = Math.cos(th) * r * w, y = Math.sin(th) * r * w;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  ctx.save();
  ctx.translate(c.x, c.y); ctx.scale(1, SQ);

  // Esquitxos de la caiguda: gotes que surten volant i es queden enganxades
  for (let i = 0; i < 12; i++) {
    const ang = rnd() * TAU, land = R * (0.55 + rnd() * 0.4), s = cell * (0.06 + rnd() * 0.07);
    const fly = Math.min(1, e / 0.35), d = land * easeOutCubic(fly);
    const x = Math.cos(ang) * d, y = Math.sin(ang) * d;
    ctx.globalAlpha = 0.85 * a; ctx.fillStyle = 'rgb(58,80,12)';
    ctx.beginPath();
    if (fly < 1) ctx.ellipse(x, y, s * 1.8, s * 0.8, ang, 0, TAU);  // allargada en vol
    else ctx.ellipse(x, y, s, s, 0, 0, TAU);
    ctx.fill();
  }

  // Cos: textura d'oli retallada a la forma, amb la vora més fosca
  if (BASE > 0) {
    ctx.save();
    blob(BASE); ctx.clip();
    ctx.globalAlpha = 0.88 * a;
    blit(ctx, greaseSprite(), 0, 0, R * 1.1, (seed % 628) / 100 + tN * 0.01);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, BASE * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.65, 'rgba(10,18,2,0.1)');
    g.addColorStop(1, 'rgba(10,18,2,0.55)');
    ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(-R * 1.2, -R * 1.2, R * 2.4, R * 2.4);

    // Brillantor humida: reflex ample que llisca i un segon més petit
    ctx.globalCompositeOperation = 'lighter';
    const sx = Math.cos(tN * 0.25) * R * 0.3, sy = Math.sin(tN * 0.19) * R * 0.25 - R * 0.2;
    glow(ctx, [150, 190, 70], sx, sy, R * 0.7, 0.22 * a);
    glow(ctx, [230, 245, 170], sx * 0.6 - R * 0.15, sy - R * 0.1, R * 0.22, 0.28 * a);

    // Bombolles que creixen i peten
    for (let i = 0; i < 4; i++) {
      const ang = rnd() * TAU, d = Math.sqrt(rnd()) * BASE * 0.7, per = 2.2 + rnd() * 1.6, ph = rnd();
      const q = (tN / per + ph) % 1;
      const bx = Math.cos(ang) * d, by = Math.sin(ang) * d, bs = cell * 0.12;
      if (q < 0.8) {
        const k = q / 0.8;
        ctx.globalAlpha = 0.55 * k * a; ctx.strokeStyle = 'rgb(220,240,160)'; ctx.lineWidth = px;
        ctx.beginPath(); ctx.arc(bx, by, bs * k, 0, TAU); ctx.stroke();
        glow(ctx, [240, 250, 200], bx - bs * k * 0.35, by - bs * k * 0.35, bs * 0.35, 0.6 * k * a);
      } else {
        const k = (q - 0.8) / 0.2;
        ctx.globalAlpha = 0.5 * (1 - k) * a; ctx.strokeStyle = 'rgb(200,230,140)'; ctx.lineWidth = px;
        ctx.beginPath(); ctx.arc(bx, by, bs * (1 + 1.5 * k), 0, TAU); ctx.stroke();
        for (let s = 0; s < 4; s++) {
          const sa = s * Math.PI / 2 + ph * 3, sd = dragged(bs * 12, 8, k * 0.25);
          glow(ctx, [220, 240, 160], bx + Math.cos(sa) * sd, by + Math.sin(sa) * sd, bs * 0.25, 0.7 * (1 - k) * a);
        }
      }
    }
    ctx.restore();

    // Vora enganxosa i reflex especular a la vora de dalt
    ctx.globalAlpha = 0.45 * a; ctx.strokeStyle = 'rgb(40,58,8)'; ctx.lineWidth = 2.2 * px; ctx.lineJoin = 'round';
    blob(BASE); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 * a * (0.75 + 0.25 * Math.sin(tN * 1.1)); ctx.strokeStyle = 'rgb(210,235,150)';
    ctx.lineWidth = 2.5 * px; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, BASE * 0.86, Math.PI * 1.12, Math.PI * 1.72); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}
