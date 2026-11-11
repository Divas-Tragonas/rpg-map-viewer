// Alè de foc — el con de flames d'un drac, en quatre temps:
//
//   1. INSPIRACIÓ  la gola s'encén i xucla espurnes un instant (0,14 s).
//   2. BRAMUL      un front de flames escombra el con (arriba al final en ~0,45 s) i al
//                  darrere el raig es manté: dard blanc a la gola, flames que es refreden
//                  i s'inflen a mesura que el con s'obre, guspires que salten més enllà.
//   3. TERRA       (passada 'ground', sota els tokens) el terra queda socarrimat al pas
//                  del front, amb flametes que hi segueixen cremant i brases que es refreden.
//   4. FUM         s'alça de tot el con quan el foc afluixa.
//
// El con és l'àrea de reglament (mateixa obertura que `spellCells`: atan(0,5), tan ample
// com llarg), o sigui que tot es mesura amb la seva llargada i no amb `fxUnit`.
// Partícules deterministes, com la bola de foc: funció pura de (llavor, temps).

import type { Point } from '@/types';
import {
  mulberry32, glowSprite, smokeSprite, scorchSprite, blit, blitStretch, fire, streak, PAL,
  TAU, clamp01, easeOutCubic, smoothstep, dragged, glow, fxCell,
} from './fxsprites';

export const BREATH_FIRE_DUR = 3.6;
const INHALE = 0.14;        // s de la gola encenent-se abans del bramul
const FRONT = 0.46;         // s que triga el front a arribar al final del con
const ROAR_END = 1.6;       // s en què s'acaba l'emissió
const HALF = Math.atan(0.5);
const K = 4.2;              // fricció de les flames: surten rabents i es frenen al final

const { white: WHITE, light: AMBER, mid: ORANGE, deep: RED } = PAL.fire;

interface Cone { A: Point; ang: number; range: number; cell: number }

function coneOf(pts: Point[], sc: number, gridSize: number): Cone | null {
  if (pts.length < 2) return null;
  const A = pts[0], B = pts[pts.length - 1], cell = fxCell(sc, gridSize);
  return { A, ang: Math.atan2(B.y - A.y, B.x - A.x), range: Math.max(Math.hypot(B.x - A.x, B.y - A.y), cell * 1.5), cell };
}

/** Fins on ha arribat el front de flames (0..1 de la llargada). */
const frontAt = (e: number) => easeOutCubic(clamp01((e - INHALE) / FRONT));
/** Intensitat del raig: s'encén de cop i afluixa al final del bramul. */
const roarAt = (e: number) => smoothstep(e, INHALE, INHALE + 0.08) * (1 - smoothstep(e, ROAR_END - 0.35, ROAR_END + 0.1));
const endFadeAt = (e: number) => 1 - smoothstep(e, BREATH_FIRE_DUR - 0.9, BREATH_FIRE_DUR);

const polar = (c: Cone, a: number, d: number): Point => ({ x: c.A.x + Math.cos(a) * d, y: c.A.y + Math.sin(a) * d });

// ── Passada 'ground': socarrim, flametes i brases (sota els tokens) ──────────

const GROUND_SPOTS = 30;

export function drawBreathFireGround(ctx: CanvasRenderingContext2D, pts: Point[], e: number, sc: number, gridSize: number, seed: number): void {
  const c = coneOf(pts, sc, gridSize);
  if (!c || e < INHALE) return;
  const { range } = c, endFade = endFadeAt(e);
  const rnd = mulberry32(seed ^ 0x5c0c);
  ctx.save();
  // Cada taca apareix quan el front li passa per sobre: el terra s'ennegreix d'aprop a lluny.
  const spots: { p: Point; w: number; born: number; ph: number; hot: number }[] = [];
  for (let i = 0; i < GROUND_SPOTS; i++) {
    const u = 0.14 + 0.72 * Math.sqrt((i + rnd()) / GROUND_SPOTS);         // repartides per àrea
    const a = c.ang + (rnd() * 2 - 1) * HALF * 0.6, rot = rnd() * TAU, ph = rnd() * TAU, hot = rnd();
    const born = INHALE + FRONT * (1 - Math.cbrt(1 - u)) + 0.05;           // invers de `frontAt`
    const w = range * u * 0.2 * (0.8 + 0.5 * hot);            // sempre dins del con
    const p = polar(c, a, range * u);
    spots.push({ p, w, born, ph, hot });
    const on = smoothstep(e, born, born + 0.25);
    if (on <= 0) continue;
    ctx.globalAlpha = 0.34 * on * endFade;
    blit(ctx, scorchSprite(), p.x, p.y, w * 1.25, rot);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < GROUND_SPOTS; i++) {
    const s = spots[i], tau = e - s.born;
    if (tau < 0) continue;
    // Flametes: el terra segueix cremant una estona i s'apaga (les de més lluny, abans)
    const burn = smoothstep(tau, 0, 0.15) * (1 - smoothstep(tau, 1.2 + 1.1 * s.hot, 1.9 + 1.2 * s.hot)) * endFade;
    if (burn > 0.01 && i % 2 === 0) {
      const lick = 0.75 + 0.25 * Math.sin(e * (9 + (i % 5)) + s.ph);
      fire(ctx, s.p.x, s.p.y - s.w * 0.25 * lick, s.w * 0.55 * lick, Math.sin(e * 3 + s.ph) * 0.4, 0.9 + 1.5 * clamp01(tau / 2.6), 0.75 * burn, i % 3);
    }
    // Brases: polsen i es refreden
    const cool = Math.exp(-tau * 0.7) * smoothstep(tau, 0.05, 0.3) * endFade;
    const pulse = 0.55 + 0.45 * Math.sin(tau * (3 + (i % 4)) + s.ph);
    glow(ctx, ORANGE, s.p.x, s.p.y, s.w * 0.9, 0.3 * cool * pulse);
    glow(ctx, AMBER, s.p.x + Math.cos(s.ph) * s.w * 0.4, s.p.y + Math.sin(s.ph) * s.w * 0.4, s.w * 0.16, 0.9 * cool * pulse);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// ── Passada 'air': el raig de flames (sobre els tokens) ──────────────────────

export function drawSpellBreathFire(ctx: CanvasRenderingContext2D, pts: Point[], e: number, _dur: number, sc: number, gridSize: number, seed: number): void {
  const c = coneOf(pts, sc, gridSize);
  if (!c) return;
  const { A, ang, range } = c, px = 1 / sc;
  const dir = { x: Math.cos(ang), y: Math.sin(ang) };
  const roar = roarAt(e), front = frontAt(e), endFade = endFadeAt(e);
  const flick = 0.86 + 0.14 * Math.sin(e * 37 + seed) * Math.sin(e * 23);
  ctx.save();
  ctx.lineCap = 'round';

  // ── Fum (blend normal, per sota del foc): s'alça de tot el con quan el foc afluixa ──
  {
    const rnd = mulberry32(seed ^ 0x5b0c);
    const N = 30;
    for (let i = 0; i < N; i++) {
      const te = 0.55 + (i + rnd()) / N * 1.5, u = 0.3 + 0.75 * Math.sqrt(rnd());
      const a = ang + (rnd() * 2 - 1) * HALF * 0.85, life = 1.2 + rnd() * 0.7, rot = rnd() * TAU, rs = rnd();
      const age = e - te;
      if (age < 0 || age > life) continue;
      const lf = age / life, p = polar(c, a, range * u * (1 + 0.06 * lf));
      ctx.globalAlpha = 0.34 * Math.sin(Math.PI * Math.sqrt(lf)) * endFade;
      blit(ctx, smokeSprite(i % 3), p.x + range * 0.03 * Math.sin(age * 1.7 + rot), p.y - range * 0.1 * age,
        range * u * (0.1 + 0.16 * lf) * (0.8 + 0.5 * rs), rot + age * 0.4);
    }
  }

  ctx.globalCompositeOperation = 'lighter';

  // ── Inspiració: la gola s'encén i xucla espurnes ──
  if (e < INHALE + 0.1) {
    const k = clamp01(e / INHALE), out = 1 - smoothstep(e, INHALE, INHALE + 0.1);
    glow(ctx, ORANGE, A.x, A.y, range * (0.3 - 0.14 * k), 0.6 * k * out);
    glow(ctx, WHITE, A.x, A.y, range * 0.07 * (0.4 + k), k * out);
    const rnd = mulberry32(seed ^ 0x1a4a);
    for (let i = 0; i < 12; i++) {
      const a = ang + (rnd() * 2 - 1) * HALF * 1.6, d0 = range * (0.14 + 0.2 * rnd()), t0 = rnd() * 0.3;
      const kk = clamp01((k - t0) / (1 - t0));
      if (kk <= 0 || kk >= 1) continue;
      const at = (t: number) => polar(c, a, d0 * (1 - t * t));
      streak(ctx, at(Math.max(0, kk - 0.18)), at(kk), AMBER, 1.5 * px, kk);
    }
  }

  // ── Llum que el foc projecta sobre el mapa ──
  const lit = Math.max(roar, 0.35 * (1 - smoothstep(e, ROAR_END, ROAR_END + 0.9))) * (e < INHALE ? 0 : 1);
  if (lit > 0.01) {
    const m = polar(c, ang, range * 0.5 * Math.max(0.3, front));
    glow(ctx, ORANGE, m.x, m.y, range * (0.5 + 0.55 * front), 0.32 * lit * flick);
  }

  // ── Falca de calor: dona forma llegible al con, sota les flames ──
  if (roar > 0.01) {
    const L = range * front;
    const g = ctx.createRadialGradient(A.x, A.y, 0, A.x, A.y, Math.max(L, 1));
    g.addColorStop(0, `rgba(255,224,150,${0.5 * roar * flick})`);
    g.addColorStop(0.5, `rgba(255,128,34,${0.32 * roar})`);
    g.addColorStop(0.92, `rgba(214,58,12,${0.16 * roar})`);
    g.addColorStop(1, 'rgba(200,50,10,0)');
    // Tres falques cada cop més estretes: els costats queden esfumats i no com un triangle retallat.
    ctx.globalAlpha = 1 / 3; ctx.fillStyle = g;
    for (const w of [1, 0.8, 0.58]) {
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.arc(A.x, A.y, L, ang - HALF * w, ang + HALF * w); ctx.closePath(); ctx.fill();
    }
  }

  // ── Flames: emissió contínua des de la gola, més densa a l'eix del con ──
  {
    const rnd = mulberry32(seed ^ 0xb0a7);
    const N = 210;
    for (let i = 0; i < N; i++) {
      const te = INHALE + Math.pow((i + rnd()) / N, 1.15) * (ROAR_END - INHALE);   // més denses a l'arrencada
      const a = ang + (rnd() + rnd() - 1) * HALF * 0.95, reach = range * (0.84 + rnd() * 0.24);
      const life = 0.55 + rnd() * 0.3, rs = rnd(), rot = rnd() * TAU, wob = rnd() * TAU, spin = (rnd() - 0.5) * 6;
      const age = e - te;
      if (age < 0 || age > life) continue;
      const lf = age / life, d = dragged(reach * K, K, age), u = d / range;
      const lat = Math.sin(age * 10 + wob) * range * 0.035 * u;                    // remolins: més amples lluny
      const x = A.x + Math.cos(a) * d - Math.sin(a) * lat, y = A.y + Math.sin(a) * d + Math.cos(a) * lat;
      fire(ctx, x, y, range * (0.035 + 0.15 * u) * (0.75 + 0.5 * rs), rot + age * spin, 0.25 + 2.75 * Math.pow(lf, 0.6),
        smoothstep(age, 0, 0.04) * Math.pow(1 - lf, 1.15) * 0.62, i % 3);
    }
  }

  // ── Front de flames: la primera bufada que escombra el con ──
  if (e > INHALE && e < INHALE + FRONT + 0.25) {
    const fa = (1 - smoothstep(e, INHALE + FRONT * 0.6, INHALE + FRONT + 0.25));
    const rnd = mulberry32(seed ^ 0xf407);
    for (let i = 0; i < 12; i++) {
      const a = ang + ((i + 0.5) / 12 * 2 - 1) * HALF * 0.9, rot = rnd() * TAU, rs = rnd();
      const p = polar(c, a, range * front * (0.74 + 0.24 * rs));
      fire(ctx, p.x, p.y, range * (0.05 + 0.13 * front) * (0.9 + 0.4 * rs), rot + e * 4, 0.6 + 1.6 * front, 0.55 * fa, i % 3);
    }
  }

  // ── Guspires: salten més enllà del con i pugen amb l'aire calent ──
  {
    const rnd = mulberry32(seed ^ 0x5a4);
    for (let i = 0; i < 46; i++) {
      const te = INHALE + (i + rnd()) / 46 * (ROAR_END - INHALE), a = ang + (rnd() * 2 - 1) * HALF * 1.1;
      const sp = range * (3.2 + rnd() * 2.2), life = 0.5 + rnd() * 0.5, hot = rnd(), sway = rnd() * TAU;
      const age = e - te;
      if (age < 0 || age > life) continue;
      const pos = (t: number) => {
        const d = dragged(sp, 3, t);
        return { x: A.x + Math.cos(a) * d + Math.sin(t * 9 + sway) * range * 0.012, y: A.y + Math.sin(a) * d - range * 0.12 * t * t };
      };
      streak(ctx, pos(Math.max(0, age - 0.035)), pos(age), hot > 0.55 ? WHITE : hot > 0.2 ? AMBER : ORANGE, (1 + 1.2 * hot) * px, 1 - (age / life) ** 2);
    }
  }

  // ── La gola: dard incandescent estirat cap endavant ──
  if (roar > 0.01) {
    const jx = A.x + dir.x * range * 0.2, jy = A.y + dir.y * range * 0.2;
    ctx.globalAlpha = 0.5 * roar * flick;
    blitStretch(ctx, glowSprite(ORANGE), A.x + dir.x * range * 0.3, A.y + dir.y * range * 0.3, range * 0.42, range * 0.13, ang);
    ctx.globalAlpha = 0.75 * roar * flick;
    blitStretch(ctx, glowSprite(AMBER), jx, jy, range * 0.3, range * 0.07, ang);
    ctx.globalAlpha = 0.95 * roar;
    blitStretch(ctx, glowSprite(WHITE), A.x + dir.x * range * 0.12, A.y + dir.y * range * 0.12, range * 0.17 * flick, range * 0.032, ang);
    glow(ctx, WHITE, A.x, A.y, range * 0.06, roar);
    glow(ctx, RED, A.x, A.y, range * 0.28, 0.35 * roar);
  }
  // Flaix de l'encesa
  if (e > INHALE - 0.02 && e < INHALE + 0.22) {
    const k = 1 - smoothstep(e, INHALE, INHALE + 0.22);
    ctx.globalAlpha = 0.9 * k;
    blitStretch(ctx, glowSprite(WHITE), A.x + dir.x * range * 0.18, A.y + dir.y * range * 0.18, range * 0.4, range * 0.16, ang);
  }

  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

/** Tremolor de la càmera mentre dura el bramul (px de pantalla): un brunzit greu, no un cop. */
export function breathFireShake(e: number, s: number): Point {
  const amp = 3.2 * roarAt(e) * (0.55 + 0.45 * (1 - frontAt(e)));
  if (amp < 0.05) return { x: 0, y: 0 };
  return {
    x: amp * (0.6 * Math.sin(e * 53 + s) + 0.4 * Math.sin(e * 97 + s * 2)),
    y: amp * (0.6 * Math.cos(e * 61 + s) + 0.4 * Math.sin(e * 89 + s * 3)),
  };
}
