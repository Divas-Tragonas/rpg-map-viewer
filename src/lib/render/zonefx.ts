// Zones màgiques a la pantalla dels jugadors (foc, gel, aigua, verí, llamps, màgia).
//
// Cada zona es compon cada fotograma en un llenç de treball a la resolució de pantalla:
//  1. capes de textura enrajolada (`textures/tiles.ts`) que es desplacen o giren,
//  2. una vora interior que brilla del color de l'element,
//  3. partícules de l'element (flames i espurnes, gebre, escuma i ones, bombolles, arcs, remolí),
//  4. la màscara de la zona amb la vora difuminada, que ho retalla tot,
// i el resultat es copia al mapa amb un sol `drawImage`. Abans era soroll calculat en JS
// texel a texel 8–20 cops per segon: borrós, a salts i més car.
//
// Les partícules són deterministes (llavor de la zona + temps), com les dels spells: cap
// estat entre fotogrames. Totes les mides surten de la casella (`fxCell`), així la textura
// té la mateixa escala al mapa sigui quina sigui la mida de la zona. Sense graella es fa
// servir una casella fixa (`NO_GRID_CELL`): una mida que depengués del zoom faria que la
// textura «nedés» i obligaria a refer la màscara a cada pas de roda.

import type { PaintedZone, Point } from '@/types';
import { pointInPolygon } from '@/lib/geometry';
import {
  TILE, fireGround, fireFlame, iceSheet, waterDeep, caustics, waterWaves, poisonSludge, poisonGlow, stormField, stormVeins,
  nebula, arcaneFlow, vortex,
} from '@/lib/textures/tiles';
import {
  mulberry32, glow, streak, blit, blitStretch, glowSprite, fireSprite, smokeSprite, mistSprite,
  rgb, PAL, TAU, smoothstep, easeOutCubic, type RGB3,
} from './fxsprites';

type G = CanvasRenderingContext2D;

// ── Geometria de cada zona (memòria cau per objecte, com `getZonePath`) ──────

interface ZoneGeo {
  cell: number;                                 // casella amb què s'ha construït (si canvia, es refà)
  path: Path2D;
  L: number; T: number; W: number; H: number;   // rectangle de treball: bbox + marge per a la vora suau
  cx: number; cy: number;
  rx: number; ry: number;                       // semieixos del bbox (el remolí de la màgia s'hi adapta)
  area: number;                                 // px² de mapa
  samples: Point[];                             // punts de l'interior on neixen les partícules
  edge: Point[];                                // punts de la vora cada ~0,4 caselles (gebre, escuma)
  seed: number;
  mask: HTMLCanvasElement | null;
  mk: number;                                   // píxels de màscara per px de mapa
}

const _geo = new WeakMap<PaintedZone, ZoneGeo>();

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function zoneGeo(zone: PaintedZone, cell: number): ZoneGeo {
  const hit = _geo.get(zone);
  if (hit && hit.cell === cell) return hit;
  const pts = zone.points;
  const { left, top, w, h, cx, cy } = zone.bbox;
  const feather = cell * 0.18;                   // sigma del difuminat de la vora
  const pad = feather * 3 + 2;
  const L = left - pad, T = top - pad, W = w + pad * 2, H = h + pad * 2;
  const path = new Path2D();
  pts.forEach((p, i) => (i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y)));
  path.closePath();
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a.x * b.y - b.x * a.y; }
  area = Math.abs(area) / 2;
  const seed = hashStr(zone.id);
  const rnd = mulberry32(seed);
  const samples: Point[] = [];
  for (let k = 0; k < 2000 && samples.length < 160; k++) {
    const x = left + rnd() * w, y = top + rnd() * h;
    if (pointInPolygon(x, y, pts)) samples.push({ x, y });
  }
  if (samples.length === 0) samples.push({ x: cx, y: cy });
  let perim = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; perim += Math.hypot(b.x - a.x, b.y - a.y); }
  const step = Math.max(cell * 0.4, perim / 160), edge: Point[] = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], len = Math.hypot(b.x - a.x, b.y - a.y);
    while (acc <= len) { const u = len ? acc / len : 0; edge.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }); acc += step; }
    acc -= len;
  }
  const mk = Math.min(1, MASK_MAX / Math.max(W, H));
  const geo: ZoneGeo = { cell, path, L, T, W, H, cx, cy, rx: w / 2, ry: h / 2, area, samples, edge, seed, mask: buildMask(path, L, T, W, H, feather, mk), mk };
  _geo.set(zone, geo);
  return geo;
}

const MASK_MAX = 320;

/**
 * Forma de la zona amb la vora difuminada. Es fa amb `shadowBlur` i no amb `filter: blur()`
 * perquè el filtre del canvas no el suporten totes les versions de Safari (i la pantalla de
 * jugador sovint és un iPad): la forma es pinta fora del llenç i només hi cau l'ombra.
 */
function buildMask(path: Path2D, L: number, T: number, W: number, H: number, feather: number, mk: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(W * mk)); cv.height = Math.max(1, Math.ceil(H * mk));
  const g = cv.getContext('2d');
  if (!g) return null;
  const off = cv.width + 64;
  g.setTransform(mk, 0, 0, mk, -L * mk - off, -T * mk);
  g.shadowColor = '#fff'; g.shadowBlur = feather * mk * 2; g.shadowOffsetX = off;
  g.fillStyle = '#fff'; g.fill(path);
  return cv;
}

// ── Llenç de treball i capes ─────────────────────────────────────────────────

const WORK_MAX = 1024;
const NO_GRID_CELL = 70;
let _work: HTMLCanvasElement | null = null;
let _wctx: G | null = null;

function workCtx(w: number, h: number): G | null {
  if (typeof document === 'undefined') return null;
  if (!_work) { _work = document.createElement('canvas'); _work.width = w; _work.height = h; _wctx = _work.getContext('2d'); }
  if (_work.width < w || _work.height < h) {
    _work.width = Math.max(_work.width, w); _work.height = Math.max(_work.height, h);
    _wctx = _work.getContext('2d');
  }
  return _wctx;
}

const _pats = new Map<HTMLCanvasElement, CanvasPattern | null>();

/**
 * Omple la zona amb una textura enrajolada. `size` = costat d'una rajola en coords de mapa;
 * `ox/oy` la desplacen (animació) i `rot` la gira al voltant del centre de la zona. El patró
 * va ancorat a la zona: si el DM l'arrossega, la textura s'hi mou.
 */
function layer(g: G, tile: HTMLCanvasElement | null, geo: ZoneGeo, size: number, ox: number, oy: number,
  alpha: number, op: GlobalCompositeOperation = 'source-over', rot = 0): void {
  if (!tile || alpha <= 0.004) return;
  let p = _pats.get(tile);
  if (p === undefined) { p = g.createPattern(tile, 'repeat'); _pats.set(tile, p); }
  if (!p) return;
  const s = size / TILE;
  const m = new DOMMatrix().translateSelf(geo.cx, geo.cy);
  if (rot) m.rotateSelf((rot * 180) / Math.PI);
  m.translateSelf(-geo.cx + (ox % size), -geo.cy + (oy % size)).scaleSelf(s, s);
  p.setTransform(m);
  g.globalAlpha = alpha; g.globalCompositeOperation = op; g.fillStyle = p;
  g.fillRect(geo.L, geo.T, geo.W, geo.H);
}

/** Vora interior que brilla: traços concèntrics retallats a la zona (la meitat de fora no hi és). */
const RIM_STEPS = [[1, 0.16], [0.6, 0.24], [0.32, 0.34], [0.12, 0.5]] as const;
function rim(g: G, geo: ZoneGeo, color: RGB3, width: number, alpha: number, op: GlobalCompositeOperation = 'lighter'): void {
  if (alpha <= 0.004) return;
  g.save();
  g.clip(geo.path);
  g.globalCompositeOperation = op; g.strokeStyle = rgb(color); g.lineJoin = 'round';
  for (const [f, a] of RIM_STEPS) { g.globalAlpha = alpha * a; g.lineWidth = width * f * 2; g.stroke(geo.path); }
  g.restore();
}

// ── Partícules ───────────────────────────────────────────────────────────────

function h2(a: number, b: number): number {
  let x = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12;
  return (x >>> 0) / 4294967296;
}

/** Quantes partícules per casella de zona, entre un mínim i un màxim. */
const count = (geo: ZoneGeo, cell: number, perCell: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.round((geo.area / (cell * cell)) * perCell)));

/**
 * `n` partícules que viuen ~`life` s i tornen a néixer en un altre punt de la zona. `fn` rep
 * on neix, l'edat 0..1 i un PRNG propi d'aquella vida (sempre el mateix per a la mateixa vida).
 */
function particles(geo: ZoneGeo, n: number, life: number, salt: number, t: number,
  fn: (p: Point, a: number, i: number, r: () => number) => void): void {
  for (let i = 0; i < n; i++) {
    const per = life * (0.75 + 0.5 * h2(i, geo.seed ^ salt));
    const c = t / per + h2(i + 999, geo.seed ^ salt), k = Math.floor(c);
    const r = mulberry32((geo.seed ^ salt ^ Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 1, 0x85ebca6b)) >>> 0);
    fn(geo.samples[Math.floor(r() * geo.samples.length)], c - k, i, r);
  }
}

/** Destell d'estrella de quatre puntes (gel, aigua). Cal estar en 'lighter'. */
function sparkle(g: G, c: RGB3, x: number, y: number, len: number, a: number, rot: number): void {
  if (a <= 0.01) return;
  const spr = glowSprite(c);
  g.globalAlpha = Math.min(1, a);
  blitStretch(g, spr, x, y, len, len * 0.09, rot);
  blitStretch(g, spr, x, y, len, len * 0.09, rot + Math.PI / 2);
  glow(g, c, x, y, len * 0.35, a);
}

// ── Foc — terra esquerdat de brases, flames que pugen, espurnes i fum ────────

/**
 * Llengua de flama (mescla additiva): halo vermell a la base, cos taronja, nucli calent i una
 * punta estreta que s'inclina amb `lean`. Feta de sprites de foc estirats, no de cercles.
 */
const TONGUE: readonly (readonly [number, number, number, number, number])[] = [
  // temperatura, alçada (× s, cap amunt), semiample, semialt, opacitat
  [2, 0.05, 0.6, 0.45, 0.55],
  [1, -0.25, 0.42, 0.62, 0.8],
  [0, -0.05, 0.22, 0.3, 0.7],
  [2, -0.8, 0.2, 0.5, 0.75],
];
function tongue(g: G, x: number, y: number, s: number, lean: number, v: number): void {
  if (s <= 0) return;
  for (const [temp, dy, rx, ry, al] of TONGUE) {
    g.globalAlpha = al;
    blitStretch(g, fireSprite(temp, v), x - lean * dy * s, y + dy * s, rx * s, ry * s, lean);
  }
}

function drawFire(g: G, geo: ZoneGeo, t: number, cell: number): void {
  const P = PAL.fire;
  layer(g, fireGround(), geo, cell * 6, 0, 0, 1);
  // Fum (blend normal) per sota de les flames
  g.globalCompositeOperation = 'source-over';
  particles(geo, count(geo, cell, 0.25, 2, 18), 3.2, 0x5e0, t, (p, a, i, r) => {
    const rot = r() * TAU, dx = (r() - 0.5) * cell * 0.6;
    g.globalAlpha = 0.2 * Math.sin(Math.PI * a);
    blit(g, smokeSprite(i % 3), p.x + dx * a, p.y - cell * 0.8 * a, cell * (0.5 + 0.7 * a), rot + a * 0.6);
  });
  // Dues capes de llengües que pugen a velocitats diferents: en sumar-se, parpellegen
  const flick = 0.85 + 0.15 * Math.sin(t * 7.3 + geo.seed) * Math.sin(t * 3.1);
  layer(g, fireFlame(), geo, cell * 2.6, t * cell * 0.1, -t * cell * 0.5, 0.75 * flick, 'lighter');
  layer(g, fireFlame(), geo, cell * 1.6, -t * cell * 0.18, -t * cell * 0.85, 0.55, 'lighter');
  rim(g, geo, P.mid, cell * 0.55, 0.55 * flick);
  // Llengües de flama que neixen, s'estiren, es dobleguen i s'apaguen per tota la zona
  g.globalCompositeOperation = 'lighter';
  particles(geo, count(geo, cell, 1.4, 8, 64), 0.75, 0xf1a, t, (p, a, i, r) => {
    const flick = 1 + 0.12 * Math.sin(t * 23 + i * 2.3);
    const s = cell * (0.35 + 0.35 * r()) * Math.sin(Math.PI * Math.min(1, a * 1.15)) * flick;
    const lean = 0.25 * Math.sin(t * 3.7 + i * 1.7) + (r() - 0.5) * 0.3;
    tongue(g, p.x + (r() - 0.5) * cell * 0.3, p.y - cell * 0.12 * a, s, lean, i % 3);
  });
  // Espurnes que pugen
  particles(geo, count(geo, cell, 1, 5, 50), 1.6, 0xe5b, t, (p, a, i, r) => {
    const vx = (r() - 0.5) * cell * 0.8, hot = r();
    glow(g, hot > 0.5 ? P.white : P.light, p.x + vx * a + Math.sin(a * 9 + i) * cell * 0.06, p.y - cell * 1.3 * a,
      cell * (0.05 + 0.04 * hot), Math.sin(Math.PI * a) * 0.9);
  });
}

// ── Gel — placa de cristalls, gebre a la vora, reflex que la travessa, destells ──

function drawIce(g: G, geo: ZoneGeo, t: number, cell: number): void {
  const P = PAL.frost;
  layer(g, iceSheet(), geo, cell * 5, 0, 0, 1);
  rim(g, geo, [236, 248, 255], cell * 0.5, 0.3, 'source-over');
  // Gebre: el glaç s'acumula a la vora en flocs (quiets: el gebre no es mou)
  g.globalCompositeOperation = 'source-over';
  geo.edge.forEach((e, i) => {
    const hh = h2(i, geo.seed ^ 0x9e7);
    g.globalAlpha = 0.3 + 0.3 * hh;
    blit(g, mistSprite([238, 248, 255], i % 3), e.x, e.y, cell * (0.26 + 0.28 * hh), hh * TAU);
  });
  // Reflex: una franja de llum creua la placa en diagonal cada pocs segons
  const per = 6, k = (((t + (geo.seed % 97) / 13) % per) / per) / 0.3;
  if (k < 1) {
    const d = Math.hypot(geo.W, geo.H), bw = cell * 1.1, x = -d / 2 + d * k;
    g.save();
    g.translate(geo.cx, geo.cy); g.rotate(-0.6);
    const gr = g.createLinearGradient(x - bw, 0, x + bw, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(235,248,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.sin(Math.PI * k); g.fillStyle = gr;
    g.fillRect(x - bw, -d / 2, bw * 2, d);
    g.restore();
  }
  g.globalCompositeOperation = 'lighter';
  particles(geo, count(geo, cell, 0.7, 4, 40), 2.4, 0x91a, t, (p, a, i, r) => {
    sparkle(g, P.white, p.x, p.y, cell * (0.12 + 0.16 * r()), Math.pow(Math.sin(Math.PI * a), 4), r() * 0.6);
  });
  // Boirina freda que llisca arran de terra
  g.globalCompositeOperation = 'source-over';
  particles(geo, count(geo, cell, 0.18, 1, 10), 5, 0x3157, t, (p, a, i, r) => {
    g.globalAlpha = 0.16 * Math.sin(Math.PI * a);
    blit(g, mistSprite([225, 242, 255], i % 3), p.x + (a - 0.5) * cell * 1.2, p.y, cell * (0.9 + 0.5 * r()), r() * TAU);
  });
}

// ── Aigua — fons blau, càustiques que es mouen, escuma a la vora, ones ───────

function drawWater(g: G, geo: ZoneGeo, t: number, cell: number, px: number): void {
  layer(g, waterDeep(), geo, cell * 6, t * cell * 0.04, t * cell * 0.025, 1);
  // Càustiques: dues còpies que es creuen i es mouen en direccions diferents
  layer(g, caustics(), geo, cell * 4, t * cell * 0.16, t * cell * 0.07, 0.3, 'lighter');
  layer(g, caustics(), geo, cell * 3, -t * cell * 0.12, t * cell * 0.14, 0.22, 'lighter', 0.9);
  // Reflexos de la superfície: crestes d'onades suaus que llisquen
  layer(g, waterWaves(), geo, cell * 3, t * cell * 0.25, -t * cell * 0.12, 0.3, 'lighter', 0.4);
  rim(g, geo, [215, 242, 255], cell * 0.3, 0.35, 'source-over');
  // Escuma a la vora: flocs blancs que respiren amb les onades
  g.globalCompositeOperation = 'source-over';
  geo.edge.forEach((e, i) => {
    const hh = h2(i, geo.seed ^ 0xf0a), pulse = 0.5 + 0.5 * Math.sin(t * (1.2 + hh) + hh * TAU);
    g.globalAlpha = 0.16 + 0.24 * pulse;
    blit(g, mistSprite([236, 248, 255], i % 3), e.x, e.y, cell * (0.2 + 0.16 * pulse + 0.1 * hh), hh * TAU + t * 0.2);
  });
  // Ones: cercles que s'obren on cau una gota
  g.strokeStyle = 'rgb(215,242,255)';
  particles(geo, count(geo, cell, 0.2, 2, 12), 2.6, 0x21f, t, (p, a, _i, r) => {
    const big = 0.4 + 0.5 * r();
    for (let j = 0; j < 3; j++) {
      const aj = (a - j * 0.12) / 0.75;
      if (aj <= 0 || aj >= 1) continue;
      g.globalAlpha = 0.3 * (1 - aj) ** 2;
      g.lineWidth = Math.max(px, cell * 0.035 * (1 - aj));
      g.beginPath(); g.arc(p.x, p.y, cell * big * easeOutCubic(aj), 0, TAU); g.stroke();
    }
  });
  g.globalCompositeOperation = 'lighter';
  particles(geo, count(geo, cell, 0.5, 3, 30), 1.8, 0x5c1, t, (p, a, _i, r) => {
    sparkle(g, [220, 245, 255], p.x, p.y, cell * (0.08 + 0.08 * r()), Math.pow(Math.sin(Math.PI * a), 6) * 0.8, 0);
  });
}

// ── Verí — fang tòxic que bull: taques que brillen, bombolles i miasma ───────

const LIME: RGB3 = [150, 255, 60];

function drawPoison(g: G, geo: ZoneGeo, t: number, cell: number, px: number): void {
  layer(g, poisonSludge(), geo, cell * 5, t * cell * 0.035, -t * cell * 0.02, 1);
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.4 + geo.seed);
  layer(g, poisonGlow(), geo, cell * 3.5, -t * cell * 0.06, t * cell * 0.045, 0.3 + 0.25 * pulse, 'lighter');
  rim(g, geo, LIME, cell * 0.45, 0.35 + 0.15 * pulse);
  // Bombolles que s'inflen i esclaten
  particles(geo, count(geo, cell, 1.4, 5, 70), 2, 0xb0b, t, (p, a, _i, r) => {
    const R = cell * (0.05 + 0.09 * r()), POP = 0.85;
    if (a < POP) {
      const k = a / POP, rad = R * easeOutCubic(k), on = smoothstep(k, 0, 0.2);
      if (rad < px) return;
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 0.75 * on; g.fillStyle = 'rgb(52,110,18)';
      g.beginPath(); g.arc(p.x, p.y, rad, 0, TAU); g.fill();
      g.globalAlpha = 0.7 * on; g.strokeStyle = rgb(LIME); g.lineWidth = Math.max(px, rad * 0.12); g.stroke();
      g.globalCompositeOperation = 'lighter';
      glow(g, [235, 255, 200], p.x - rad * 0.35, p.y - rad * 0.35, rad * 0.45, 0.7 * on);
    } else {
      const k = (a - POP) / (1 - POP);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.8 * (1 - k); g.strokeStyle = rgb(LIME); g.lineWidth = Math.max(px, R * 0.12 * (1 - k));
      g.beginPath(); g.arc(p.x, p.y, R * (1 + 1.3 * k), 0, TAU); g.stroke();
      for (let d = 0; d < 4; d++) {   // esquitxos
        const an = (d * TAU) / 4 + r() * 1.5, q0 = R * (1 + 0.6 * k), q1 = R * (1.2 + 1.6 * k);
        streak(g, { x: p.x + Math.cos(an) * q0, y: p.y + Math.sin(an) * q0 }, { x: p.x + Math.cos(an) * q1, y: p.y + Math.sin(an) * q1 },
          LIME, Math.max(px, R * 0.1), 0.7 * (1 - k));
      }
    }
  });
  // Miasma: vapors verds que s'arrosseguen per sobre
  g.globalCompositeOperation = 'source-over';
  particles(geo, count(geo, cell, 0.22, 1, 14), 4.5, 0x31a, t, (p, a, i, r) => {
    g.globalAlpha = 0.26 * Math.sin(Math.PI * a);
    blit(g, mistSprite([110, 190, 50], i % 3), p.x + (r() - 0.5) * cell * a, p.y - cell * 0.6 * a, cell * (0.8 + 0.6 * a), r() * TAU + a * 0.4);
  });
}

// ── Llamps — núvol carregat, arcs que salten entre punts, llampecs, espurnes ─

/** Llamp en ziga-zaga entre A i B (desplaçament del punt mig, 4 nivells). */
function bolt(A: Point, B: Point, r: () => number): Point[] {
  let pts = [A, B];
  let amp = Math.hypot(B.x - A.x, B.y - A.y) * 0.22;
  for (let lvl = 0; lvl < 4; lvl++) {
    const nx: Point[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i], dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1;
      const off = (r() - 0.5) * 2 * amp;
      nx.push({ x: (p.x + q.x) / 2 - (dy / l) * off, y: (p.y + q.y) / 2 + (dx / l) * off }, q);
    }
    pts = nx; amp *= 0.55;
  }
  return pts;
}

function drawLightning(g: G, geo: ZoneGeo, t: number, cell: number, px: number): void {
  const P = PAL.storm;
  layer(g, stormField(), geo, cell * 5, t * cell * 0.12, -t * cell * 0.07, 1);
  // Electricitat estàtica: filaments que tremolen (l'opacitat salta 12 cops per segon)
  const buzz = 0.25 + 0.35 * h2(Math.floor(t * 12), geo.seed);
  layer(g, stormVeins(), geo, cell * 4, -t * cell * 0.05, t * cell * 0.04, buzz, 'lighter');
  // Llampec: de tant en tant tota la zona s'il·lumina (amb un parpelleig)
  const fper = 2.6 + (geo.seed % 7) * 0.2, fa = (t + (geo.seed % 31) / 10) % fper;
  const flash = fa < 0.35 ? (1 - fa / 0.35) ** 2 * (0.6 + 0.4 * Math.sin(fa * 90) ** 2) : 0;
  if (flash > 0.01) {
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.32 * flash; g.fillStyle = 'rgb(150,180,255)';
    g.fillRect(geo.L, geo.T, geo.W, geo.H);
  }
  rim(g, geo, P.mid, cell * 0.4, 0.45 + 0.4 * flash);
  // Arcs: cada un salta uns instants entre dos punts de la zona i en tria uns altres;
  // la forma canvia 24 cops per segon. Durant el llampec s'encenen tots.
  g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round'; g.lineCap = 'round';
  const frame = Math.floor(t * 24), maxLen = cell * 3;
  const n = count(geo, cell, 0.35, 3, 14);
  for (let j = 0; j < n; j++) {
    const per = 0.7 + 0.9 * h2(j, geo.seed), c = t / per + h2(j + 77, geo.seed), k = Math.floor(c), a = c - k;
    const life = Math.max(a < 0.28 ? 1 - a / 0.28 : 0, flash);
    if (life < 0.02) continue;
    const r = mulberry32((geo.seed ^ Math.imul(j + 1, 0x9e3779b1) ^ Math.imul(k + 1, 0x85ebca6b)) >>> 0);
    const A = geo.samples[Math.floor(r() * geo.samples.length)];
    let B = geo.samples[Math.floor(r() * geo.samples.length)];
    const dl = Math.hypot(B.x - A.x, B.y - A.y);
    if (dl > maxLen) B = { x: A.x + ((B.x - A.x) / dl) * maxLen, y: A.y + ((B.y - A.y) / dl) * maxLen };
    if (dl < cell * 0.6) B = { x: A.x + cell * (r() - 0.5) * 2, y: A.y + cell * (r() - 0.5) * 2 };
    const jr = mulberry32((geo.seed ^ Math.imul(frame + 1, 0x27d4eb2d) ^ Math.imul(j + 1, 0x165667b1)) >>> 0);
    const path = bolt(A, B, jr);
    // Una branca que surt d'un punt del llamp cap a un costat
    const m = path[4 + Math.floor(jr() * 8)], ba = Math.atan2(B.y - A.y, B.x - A.x) + (jr() < 0.5 ? -1 : 1) * (0.5 + jr() * 0.6);
    const bl = Math.hypot(B.x - A.x, B.y - A.y) * 0.35;
    const branch = bolt(m, { x: m.x + Math.cos(ba) * bl, y: m.y + Math.sin(ba) * bl }, jr).slice(0, 12);
    const fl = life * (0.7 + 0.3 * jr());
    for (const [col, w, al] of [[P.deep, cell * 0.22, 0.25], [P.mid, cell * 0.09, 0.6], [P.white, Math.max(px, cell * 0.03), 1]] as [RGB3, number, number][]) {
      g.strokeStyle = rgb(col);
      for (const [pts, wk] of [[path, 1], [branch, 0.6]] as [Point[], number][]) {
        g.globalAlpha = al * fl * wk; g.lineWidth = Math.max(px, w * wk);
        g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
        for (let q = 1; q < pts.length; q++) g.lineTo(pts[q].x, pts[q].y);
        g.stroke();
      }
    }
    glow(g, P.light, A.x, A.y, cell * 0.35, 0.6 * fl);
    glow(g, P.light, B.x, B.y, cell * 0.35, 0.6 * fl);
  }
  // Espurnes que salten
  particles(geo, count(geo, cell, 0.6, 3, 30), 0.6, 0x5a7, t, (p, a, _i, r) => {
    const an = r() * TAU, sp = cell * (0.8 + r() * 1.2);
    const at = (u: number) => { const d = sp * u * (1 - 0.5 * u); return { x: p.x + Math.cos(an) * d, y: p.y + Math.sin(an) * d }; };
    streak(g, at(Math.max(0, a - 0.08)), at(a), P.white, px * 1.5, (1 - a) * 0.9);
  });
}

// ── Màgia — fluid arcà que gira cap al centre, com un portal ─────────────────

/** Remolí centrat a la zona i estirat a la seva forma (el·lipse del bbox). */
function swirl(g: G, geo: ZoneGeo, spr: HTMLCanvasElement | null, rot: number, alpha: number): void {
  if (!spr || alpha <= 0.004) return;
  g.save();
  g.translate(geo.cx, geo.cy); g.scale(geo.rx, geo.ry); g.rotate(rot);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha;
  g.drawImage(spr, -1, -1, 2, 2);
  g.restore();
}

function drawMagic(g: G, geo: ZoneGeo, t: number, cell: number): void {
  const P = PAL.arcane;
  layer(g, nebula(), geo, cell * 6, 0, 0, 1, 'source-over', t * 0.04);
  // Corrents del fluid: dues capes que llisquen i giren en sentits contraris
  layer(g, arcaneFlow(), geo, cell * 4.5, t * cell * 0.12, -t * cell * 0.05, 0.38, 'lighter', -t * 0.06);
  layer(g, arcaneFlow(), geo, cell * 3.2, -t * cell * 0.08, t * cell * 0.1, 0.28, 'lighter', t * 0.09);
  // Remolí: dues espirals a velocitats diferents. El gir va en sentit contrari a l'espiral,
  // així els braços semblen xuclats cap al centre (en el mateix sentit, sortirien)
  swirl(g, geo, vortex(1.4), -t * 0.55, 0.68);
  swirl(g, geo, vortex(0.7), -t * 0.32 + 1.7, 0.48);
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.2 + geo.seed);
  rim(g, geo, P.mid, cell * 0.5, 0.35 + 0.15 * pulse);
  // Motes que el remolí xucla cap al centre, en espiral
  g.globalCompositeOperation = 'lighter';
  particles(geo, count(geo, cell, 0.8, 5, 50), 3.4, 0x40e, t, (p, a, i) => {
    const dx = p.x - geo.cx, dy = p.y - geo.cy, f = 1 - 0.85 * a * a, an = -a * 1.8;
    const x = geo.cx + (dx * Math.cos(an) - dy * Math.sin(an)) * f, y = geo.cy + (dx * Math.sin(an) + dy * Math.cos(an)) * f;
    const tw = 0.6 + 0.4 * Math.sin(t * 9 + i * 1.7);
    glow(g, i % 3 ? P.light : [255, 190, 245], x, y, cell * 0.08, Math.sin(Math.PI * a) * tw);
  });
  particles(geo, count(geo, cell, 0.4, 3, 24), 1.6, 0x5b7, t, (p, a, _i, r) => {
    sparkle(g, [250, 215, 255], p.x, p.y, cell * (0.07 + 0.08 * r()), Math.pow(Math.sin(Math.PI * a), 5) * 0.8, 0.4);
  });
}

// ── Entrada ──────────────────────────────────────────────────────────────────

type ZoneDraw = (g: G, geo: ZoneGeo, t: number, cell: number, px: number) => void;
const DRAW: Record<string, ZoneDraw> = {
  fire: drawFire, ice: drawIce, water: drawWater, poison: drawPoison, lightning: drawLightning, magic: drawMagic,
};

/**
 * Pinta una zona màgica (pantalla de jugador). `ctx` ha d'estar en coords de mapa; `t` en
 * segons; `alpha` per a l'aparició. Les zones fora de pantalla no es componen.
 */
export function drawZoneFx(ctx: G, zone: PaintedZone, t: number, sc: number, gridSize: number, alpha = 1): void {
  if (zone.points.length < 3) return;
  const cell = gridSize > 0 ? gridSize : NO_GRID_CELL;
  const geo = zoneGeo(zone, cell);
  if (!geo.mask) return;
  const m = ctx.getTransform();
  const sx = m.a * geo.L + m.e, sy = m.d * geo.T + m.f;
  if (sx > ctx.canvas.width || sy > ctx.canvas.height || sx + geo.W * m.a < 0 || sy + geo.H * m.d < 0) return;
  const k = Math.min(sc, WORK_MAX / Math.max(geo.W, geo.H));
  const ww = Math.max(1, Math.ceil(geo.W * k)), wh = Math.max(1, Math.ceil(geo.H * k));
  const g = workCtx(ww, wh);
  if (!g || !_work) return;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, ww, wh);
  g.setTransform(k, 0, 0, k, -geo.L * k, -geo.T * k);
  (DRAW[zone.element] ?? drawFire)(g, geo, t, cell, 1 / k);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in';
  g.drawImage(geo.mask, 0, 0, (geo.mask.width / geo.mk) * k, (geo.mask.height / geo.mk) * k);
  g.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(_work, 0, 0, ww, wh, geo.L, geo.T, ww / k, wh / k);
  ctx.restore();
}
