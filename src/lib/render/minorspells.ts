// Spells menors de línia: projectil màgic, risa horrible i mans ardents.
//
// Mateix llenguatge que la bola de foc i els raigs (paletes `PAL`, `impactBurst`, llum
// dinàmica amb `glow`, partícules deterministes per llavor) però més continguts: són
// spells de nivell 1 i han de llegir-se clars i ràpids, no competir amb una bola de foc.

import type { Point } from '@/types';
import {
  mulberry32, smokeSprite, blit, blitStretch, glowSprite, fire, streak, impactBurst,
  TAU, clamp01, easeOutCubic, smoothstep, dragged, glow, fxCell, rgb, PAL,
} from './fxsprites';

// ── Projectil màgic — tres dards arcans que busquen l'objectiu ───────────────

export const MAGIC_MISSILE_DUR = 1.7;
const MM_CAST = 0.18, MM_STAGGER = 0.12, MM_TRAVEL = 0.55, MM_IMPACT = 0.5;

function bez(A: Point, C: Point, B: Point, t: number): Point {
  const u = 1 - t;
  return { x: u * u * A.x + 2 * u * t * C.x + t * t * B.x, y: u * u * A.y + 2 * u * t * C.y + t * t * B.y };
}

export function drawSpellMagicMissile(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  if (pts.length < 2) return;
  const P = PAL.arcane, cell = fxCell(sc, gridSize), px = 1 / sc;
  const [A, B] = pts;
  const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const rnd = mulberry32(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  // Càrrega: la mà s'encén i els dards es materialitzen un a un
  const castOn = smoothstep(e, 0, MM_CAST) * (1 - smoothstep(e, MM_CAST + 2 * MM_STAGGER, MM_CAST + 2 * MM_STAGGER + 0.2));
  glow(ctx, P.mid, A.x, A.y, cell * 1.1, 0.45 * castOn);
  glow(ctx, P.white, A.x, A.y, cell * 0.25, 0.8 * castOn);

  for (let m = 0; m < 3; m++) {
    const bend = len * 0.2 * (m === 0 ? -1 : m === 1 ? 1 : -0.4) * (0.7 + rnd() * 0.6);
    const hitX = (rnd() - 0.5) * cell * 0.5, hitY = (rnd() - 0.5) * cell * 0.5;
    const C = { x: (A.x + B.x) / 2 + nx * bend, y: (A.y + B.y) / 2 + ny * bend };
    const T = { x: B.x + hitX, y: B.y + hitY };
    const t0 = MM_CAST + m * MM_STAGGER, local = e - t0;
    if (local < 0) {
      // Dard encara a la mà: una espurna que espera
      const g = bez(A, C, T, 0.04);
      glow(ctx, P.white, g.x, g.y, cell * 0.14, smoothstep(e, m * 0.05, MM_CAST));
      continue;
    }
    if (local <= MM_TRAVEL) {
      const u = local / MM_TRAVEL, tt = 0.55 * u + 0.45 * u * u; // accelera en arribar
      // Estela: cinta que s'aprima enrere (puntes planes: amb les rodones, en additiu,
      // cada unió se sumava dues vegades i la cua semblava discontínua)
      ctx.lineCap = 'butt';
      for (let k = 12; k >= 1; k--) {
        const ta = tt - k * 0.022, tb = tt - (k - 1) * 0.022;
        if (ta < 0) continue;
        const a = bez(A, C, T, ta), b = bez(A, C, T, tb), f = 1 - k / 13;
        streak(ctx, a, b, k < 4 ? P.light : P.mid, Math.max(px, cell * 0.16 * f), 0.75 * f);
      }
      ctx.lineCap = 'round';
      const p = bez(A, C, T, tt), q = bez(A, C, T, Math.max(0, tt - 0.02));
      const ang = Math.atan2(p.y - q.y, p.x - q.x);
      glow(ctx, P.deep, p.x, p.y, cell * 1.6, 0.25);                // llum sobre el mapa
      glow(ctx, P.mid, p.x, p.y, cell * 0.6, 0.7);
      ctx.globalAlpha = 0.95;
      blitStretch(ctx, glowSprite(P.white), p.x, p.y, cell * 0.42, cell * 0.13, ang); // cap allargat per la velocitat
      glow(ctx, P.white, p.x, p.y, cell * 0.16, 1);
    } else {
      impactBurst(ctx, T.x, T.y, cell * 0.45, P, (local - MM_TRAVEL) / MM_IMPACT, seed + m * 101, px);
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// ── Risa horrible — un encanteri juganer que s'enganxa a l'objectiu ──────────

export const HIDEOUS_LAUGHTER_DUR = 2.6;
const HL_TRAVEL = 0.7;
const GOLD: [number, number, number] = [255, 214, 120];

export function drawSpellHideousLaughter(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  if (pts.length < 2) return;
  const P = PAL.charm, cell = fxCell(sc, gridSize), px = 1 / sc;
  const [A, B] = pts;
  const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const at = (u: number) => {
    const wv = Math.sin(u * TAU * 1.5) * len * 0.05 * (1 - u); // vol juganer, que es redreça en arribar
    return { x: A.x + dx * u + nx * wv, y: A.y + dy * u + ny * wv };
  };
  const endFade = 1 - smoothstep(e, HIDEOUS_LAUGHTER_DUR - 0.4, HIDEOUS_LAUGHTER_DUR);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  // Purpurina que deixa el projectil (queda al món i cau una mica)
  {
    const rnd = mulberry32(seed ^ 0x1a6);
    for (let i = 0; i < 34; i++) {
      const te = (i + rnd()) / 34 * HL_TRAVEL, life = 0.4 + rnd() * 0.4, side = rnd() - 0.5, gold = rnd() < 0.4;
      const age = e - te;
      if (age < 0 || age > life) continue;
      const p = at(te / HL_TRAVEL), lf = age / life;
      glow(ctx, gold ? GOLD : P.light, p.x + nx * side * cell * 0.5, p.y + ny * side * cell * 0.5 + cell * 0.4 * age,
        cell * 0.13, Math.sin(Math.PI * lf) * 0.9);
    }
  }

  if (e < HL_TRAVEL) {
    const u = e / HL_TRAVEL, p = at(u);
    glow(ctx, P.deep, p.x, p.y, cell * 1.5, 0.25);
    glow(ctx, P.mid, p.x, p.y, cell * 0.55, 0.7);
    glow(ctx, P.white, p.x, p.y, cell * 0.16, 1);
    for (let k = 0; k < 2; k++) {                     // dues boletes que hi orbiten
      const a = e * 14 + k * Math.PI;
      glow(ctx, k ? GOLD : P.light, p.x + Math.cos(a) * cell * 0.32, p.y + Math.sin(a) * cell * 0.32, cell * 0.12, 1);
    }
    glow(ctx, P.mid, A.x, A.y, cell * 0.8, 0.5 * (1 - u));
  } else {
    const tau = e - HL_TRAVEL;
    impactBurst(ctx, B.x, B.y, cell * 0.5, P, tau / 0.5, seed, px);
    // Aura que "riu": batecs curts i ràpids, com riallades
    const laugh = Math.pow(Math.abs(Math.sin(tau * 11)), 3);
    glow(ctx, P.mid, B.x, B.y, cell * (1.1 + 0.15 * laugh), (0.2 + 0.25 * laugh) * smoothstep(tau, 0, 0.2) * endFade);

    // «HA!» que salten, amb rebot d'entrada, i s'enlairen
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const rnd = mulberry32(seed ^ 0x51ed270b);
    for (let i = 0; i < 4; i++) {
      const t0 = 0.1 + i * 0.32 + rnd() * 0.1, side = (rnd() - 0.5) * 2, rot = (rnd() - 0.5) * 0.5;
      const age = tau - t0, life = 0.9;
      if (age < 0 || age > life) continue;
      const lf = age / life;
      const pop = 1 + 0.35 * Math.sin(Math.PI * clamp01(age / 0.18)) * (age < 0.18 ? 1 : 0); // rebot
      const x = B.x + side * cell * 0.7, y = B.y - cell * (0.5 + 1.1 * easeOutCubic(lf));
      const a = (lf < 0.15 ? lf / 0.15 : 1 - smoothstep(lf, 0.6, 1)) * endFade;
      const size = cell * 0.48 * pop;
      glow(ctx, P.mid, x, y, size * 1.3, 0.45 * a);
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.translate(x, y); ctx.rotate(rot + Math.sin(tau * 9 + i) * 0.08);
      ctx.font = `900 ${size}px system-ui, sans-serif`;
      ctx.globalAlpha = a; ctx.lineWidth = size * 0.12; ctx.lineJoin = 'round';
      ctx.strokeStyle = rgb(P.deep); ctx.strokeText('HA!', 0, 0);
      ctx.fillStyle = i % 2 ? rgb(GOLD) : rgb(P.white); ctx.fillText('HA!', 0, 0);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// ── Mans ardents — con de flames com un llançaflames curt ────────────────────

export const BURNING_HANDS_DUR = 2.4;
const BH_IGNITE = 0.1, BH_EMIT_END = 1.7;

export function drawSpellBurningHands(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  if (pts.length < 2) return;
  const P = PAL.fire, cell = fxCell(sc, gridSize), px = 1 / sc;
  const [A, B] = pts;
  const range = Math.hypot(B.x - A.x, B.y - A.y) || cell;
  const ang = Math.atan2(B.y - A.y, B.x - A.x), HALF = Math.PI / 6;
  const on = smoothstep(e, 0, BH_IGNITE) * (1 - smoothstep(e, BH_EMIT_END - 0.25, BH_EMIT_END));
  const K = 3.2; // fricció: les flames surten ràpides i es frenen al final del con
  ctx.save();

  // Fum a la punta del con (blend normal, per sota)
  {
    const rnd = mulberry32(seed ^ 0x5b0c);
    for (let i = 0; i < 16; i++) {
      const te = BH_IGNITE + (i + rnd()) / 16 * (BH_EMIT_END - BH_IGNITE), a = ang + (rnd() * 2 - 1) * HALF * 0.8;
      const life = 1 + rnd() * 0.6, rot = rnd() * TAU;
      const age = e - te;
      if (age < 0 || age > life) continue;
      const lf = age / life, d = range * (0.75 + 0.3 * lf);
      ctx.globalAlpha = 0.28 * Math.sin(Math.PI * lf);
      blit(ctx, smokeSprite(i % 3), A.x + Math.cos(a) * d, A.y + Math.sin(a) * d - cell * 0.4 * age, cell * (0.4 + 0.6 * lf), rot + age * 0.5);
    }
  }

  ctx.globalCompositeOperation = 'lighter';
  const flick = 0.85 + 0.15 * Math.sin(e * 31 + seed) * Math.sin(e * 17);
  glow(ctx, P.mid, A.x + Math.cos(ang) * range * 0.5, A.y + Math.sin(ang) * range * 0.5, range * 0.95, 0.35 * on * flick); // llum sobre el mapa

  // Falca de calor: dona forma llegible al con (on arriba el foc), sota les flames
  if (on > 0.01) {
    const g = ctx.createRadialGradient(A.x, A.y, 0, A.x, A.y, range);
    g.addColorStop(0, `rgba(255,210,120,${0.3 * on * flick})`);
    g.addColorStop(0.55, `rgba(255,120,30,${0.16 * on})`);
    g.addColorStop(1, 'rgba(200,50,10,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.arc(A.x, A.y, range, ang - HALF, ang + HALF); ctx.closePath(); ctx.fill();
  }

  // Flames: emissió contínua des de les mans, repartida pel con (més densa al centre)
  {
    const rnd = mulberry32(seed ^ 0xb0a7);
    const N = 120;
    for (let i = 0; i < N; i++) {
      const te = BH_IGNITE * 0.5 + (i + rnd()) / N * (BH_EMIT_END - BH_IGNITE * 0.5);
      const a = ang + (rnd() * 2 - 1) * HALF * 0.9, reach = range * (0.8 + rnd() * 0.25);
      const life = 0.5 + rnd() * 0.25, rs = rnd(), rot = rnd() * TAU, wob = rnd() * TAU;
      const age = e - te;
      if (age < 0 || age > life) continue;
      const lf = age / life, d = dragged(reach * K, K, age);
      const lat = Math.sin(age * 12 + wob) * cell * 0.15 * lf;
      const x = A.x + Math.cos(a) * d - Math.sin(a) * lat, y = A.y + Math.sin(a) * d + Math.cos(a) * lat;
      fire(ctx, x, y, cell * (0.16 + 0.42 * lf) * (0.8 + 0.4 * rs), rot + age * 3, 0.15 + lf * 2.9,
        smoothstep(age, 0, 0.04) * (1 - lf) ** 1.1, i % 3);
    }
  }
  // Espurnes que surten més enllà del con
  {
    const rnd = mulberry32(seed ^ 0x5a4);
    for (let i = 0; i < 26; i++) {
      const te = BH_IGNITE + (i + rnd()) / 26 * (BH_EMIT_END - BH_IGNITE), a = ang + (rnd() * 2 - 1) * HALF;
      const sp = range * (3.5 + rnd() * 2), life = 0.35 + rnd() * 0.3, hot = rnd();
      const age = e - te;
      if (age < 0 || age > life) continue;
      const pos = (t: number) => { const d = dragged(sp, 3, t); return { x: A.x + Math.cos(a) * d, y: A.y + Math.sin(a) * d + cell * t * t }; };
      streak(ctx, pos(Math.max(0, age - 0.03)), pos(age), hot > 0.5 ? P.white : P.light, (1 + hot) * px, 1 - age / life);
    }
  }
  // Les mans: nucli blanc i flaix d'encesa
  glow(ctx, P.light, A.x, A.y, cell * 0.8 * flick, 0.7 * on);
  glow(ctx, P.white, A.x, A.y, cell * 0.3, on);
  if (e < BH_IGNITE + 0.15) glow(ctx, P.white, A.x, A.y, cell * 1.2, 1 - smoothstep(e, 0, BH_IGNITE + 0.15));

  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}
