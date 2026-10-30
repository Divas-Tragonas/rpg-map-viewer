/**
 * Cops i curacions a les figuretes (app Píxel), deduïts de la vida dels tokens: no hi ha cap
 * missatge propi. La vida ja arriba a totes les pantalles (`players`, `libEnemies`,
 * `psdEnemyOverrides`) i cada una veu el mateix canvi, o sigui que tothom veu el mateix cop.
 *
 *  - **Cop rebut** (la vida baixa): flaixos blancs, una empenta enrere, l'impacte del full
 *    `uf_FX_impact.png` damunt de la figura i el número del dany que puja. La **força** depèn de
 *    la vida perduda respecte de la màxima (`severity`): un cop lleu és un sol flaix i un impacte
 *    petit; un de fort, tres flaixos, una sacsejada de la figura, l'impacte gran amb un esclat al
 *    darrere i gotes de sang, i el número gros en vermell.
 *  - **Atac**: si hi ha combat i el torn és d'un altre token, aquest s'inclina i fa una envestida
 *    cap a la víctima, i el cop arriba al punt més alt de l'envestida (més llarga com més fort).
 *    L'impacte depèn de qui ataca: tall d'arma (gent), arc d'espasa (jugadors), urpada (animals i
 *    monstres) o cop (gòlems…).
 *  - **Curació** (la vida puja): flaix vermell de poció, els anells de curar de `uf_FX.png`
 *    tenyits del mateix vermell i «+N».
 *
 * El primer valor de vida que es veu d'un token no compta (carregar una partida no és un cop).
 */
import { blit, parseSprite, tintedRegion } from './draw';
import { pfDrawChar, pfAdvance, PF_LINE } from './font';
import { PAL } from '@/lib/render/fxsprites';

const LUNGE_MS = 300;
/** Quan arriba el cop dins de l'envestida (el punt més endavant). */
const LUNGE_HIT_MS = 130;
const HEAL_MS = 900;

type ImpactStyle = 'slash' | 'claw' | 'swing' | 'star';
/** 0 = lleu, 1 = normal, 2 = fort. */
type Severity = 0 | 1 | 2;
interface Hit { t0: number; kind: 'hit' | 'heal'; dir: [number, number]; style: ImpactStyle; seed: number; amount: number; sev: Severity }

/** Per grau: durada, flaixos (fraccions [inici, fi]), empenta (px d'art), mida de l'impacte. */
const SEV = [
  { ms: 320, flashes: [[0, 0.16]], kick: 1.5, impact: 0.7, lunge: 6, number: 1 },
  { ms: 460, flashes: [[0, 0.14], [0.28, 0.4]], kick: 4, impact: 1, lunge: 8, number: 1.4 },
  { ms: 700, flashes: [[0, 0.1], [0.2, 0.3], [0.4, 0.5]], kick: 8, impact: 1.45, lunge: 11, number: 2 },
] as const;

/** Lleu: ≤ 5% de la vida màxima (o 1–2 punts). Fort: ≥ 25% (o 15 punts sense màxim conegut). */
function severity(amount: number, hpMax: number | undefined): Severity {
  const f = hpMax && hpMax > 0 ? amount / hpMax : amount / 40;
  if (f >= 0.25 || amount >= 15) return 2;
  if (f > 0.05 && amount > 2) return 1;
  return 0;
}

const _hp = new Map<string, number>();
const _pos = new Map<string, { x: number; y: number; sprite: string }>();
const _hits = new Map<string, Hit>();
const _lunges = new Map<string, { t0: number; tx: number; ty: number; reach: number }>();

const CLAW = /^(bat|spider|rat|wolf|bird|snake|beetle|moth|toad|worm|flies|dragon|demon|beholder|lizardman|minotaur|troll|ogre|vampire|wraith|banshee|zombie|mimic)/;
const BLUNT = /^(golem|elemental|slime|wisp|spirit|pixie)/;

function styleOf(attacker: string | null): ImpactStyle {
  if (!attacker) return 'star';
  if (attacker.startsWith('pl_')) return 'swing';
  const name = parseSprite(_pos.get(attacker)?.sprite ?? '').name;
  if (BLUNT.test(name)) return 'star';
  if (CLAW.test(name)) return 'claw';
  return 'slash';
}

/**
 * Apunta la vida i la posició (peus) d'un token, cada fotograma. `attacker` = el token que té
 * el torn (si n'hi ha), que és qui ha fet el cop.
 */
export function noteFigure(key: string, sprite: string, hp: number | undefined, hpMax: number | undefined,
  x: number, y: number, attacker: string | null, now: number) {
  _pos.set(key, { x, y, sprite });
  if (hp === undefined) return;
  const prev = _hp.get(key);
  _hp.set(key, hp);
  if (prev === undefined || prev === hp) return;
  const seed = (now * 7919) % 1000;
  if (hp > prev) { _hits.set(key, { t0: now, kind: 'heal', dir: [0, 0], style: 'star', seed, amount: hp - prev, sev: 1 }); return; }
  const amount = prev - hp, sev = severity(amount, hpMax);
  const by = attacker && attacker !== key ? attacker : null;
  const a = by ? _pos.get(by) : undefined;
  let dir: [number, number] = [0, 0];
  if (a) {
    const dx = x - a.x, dy = y - a.y, d = Math.hypot(dx, dy) || 1;
    dir = [dx / d, dy / d];
    _lunges.set(by!, { t0: now, tx: x, ty: y, reach: SEV[sev].lunge });
  }
  _hits.set(key, { t0: now + (a ? LUNGE_HIT_MS : 0), kind: 'hit', dir, style: styleOf(a ? by : null), seed, amount, sev });
}

export interface FigureFx {
  /** Desplaçament i inclinació de la figura (envestida, empenta i sacsejada). */
  dx: number; dy: number; rot: number;
  /** Flaix damunt de la figura. */
  flash: { alpha: number; tint: 'white' | 'heal' } | null;
}

const NONE: FigureFx = { dx: 0, dy: 0, rot: 0, flash: null };

/** Moviment i flaix de la figura ara mateix (`S` = mida de la figura; `calm` = sense moviment). */
export function figureFx(key: string, cx: number, footY: number, S: number, now: number, calm: boolean): FigureFx {
  const px = S / 48;
  let dx = 0, dy = 0, rot = 0;
  let flash: FigureFx['flash'] = null;
  const l = _lunges.get(key);
  if (l) {
    const p = (now - l.t0) / LUNGE_MS;
    if (p >= 1) _lunges.delete(key);
    else if (!calm) {
      const ux = l.tx - cx, uy = l.ty - footY, d = Math.hypot(ux, uy) || 1;
      // Envestida ràpida i tornada més lenta (el cop és a ~40%).
      const k = p < 0.43 ? Math.sin((p / 0.43) * Math.PI / 2) : Math.cos(((p - 0.43) / 0.57) * Math.PI / 2);
      dx += (ux / d) * k * px * l.reach; dy += (uy / d) * k * px * l.reach * 0.6;
      rot += Math.sign(ux || 1) * k * (0.1 + l.reach * 0.01);
    }
  }
  const h = _hits.get(key);
  if (h) {
    const ms = h.kind === 'heal' ? HEAL_MS : SEV[h.sev].ms;
    const e = now - h.t0;
    if (e >= ms) _hits.delete(key);
    else if (e >= 0) {
      const p = e / ms;
      if (h.kind === 'hit') {
        const s = SEV[h.sev];
        // Flaixos secs (pixel art: res de fos) i una empenta que torna amb fricció.
        if (s.flashes.some(([a, b]) => p >= a && p < b)) flash = { alpha: 1, tint: 'white' };
        if (!calm) {
          const kick = (1 - p) ** 2 * px * s.kick;
          const [kx, ky] = h.dir[0] || h.dir[1] ? h.dir : [0, -0.2];
          dx += kx * kick; dy += ky * kick * 0.6;
          // Cop fort: la figura tremola un moment (d'un píxel d'art a l'altre, sense fos).
          if (h.sev === 2 && p < 0.55) dx += (Math.floor(e / 45) % 2 ? 1 : -1) * px * 1.5;
        }
      } else {
        flash = { alpha: 0.6 * Math.sin(Math.min(1, p * 1.6) * Math.PI), tint: 'heal' };
      }
    }
  }
  return dx || dy || rot || flash ? { dx, dy, rot, flash } : NONE;
}

// Impactes (`uf_FX_impact.png`: 48 px, 3 fotogrames per efecte), anells de curar i gotes de sang
// (`uf_FX.png`, 24 px).
const IMPACT: Record<ImpactStyle, [number, number]> = { slash: [0, 0], claw: [3, 0], swing: [6, 0], star: [0, 1] };
const IMPACT_FRAME_MS = 70;
const HEAL_FRAMES: [number, number][] = [[6, 3], [7, 3], [8, 3], [9, 3]];
const BLOOD_FRAMES: [number, number][] = [[4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6]];
const POTION = [PAL.potion.deep, PAL.potion.mid, PAL.potion.light, PAL.potion.white];

/** Color del número: blanc el lleu, groc el normal, vermell el fort; vermell clar el «+N». */
const NUMBER_COLOR = ['#f2f2f2', '#ffd75e', '#ff4a3d'] as const;
const HEAL_COLOR = '#ff8a96';

// El número es pinta un cop en un llenç petit (lletra de píxel a escala 1) i s'amplia sense suavitzar.
const _numbers = new Map<string, HTMLCanvasElement>();
function numberCanvas(text: string, color: string): HTMLCanvasElement {
  const key = `${text}|${color}`;
  const hit = _numbers.get(key); if (hit) return hit;
  let w = 2;
  for (const ch of text) w += pfAdvance(ch);
  const c = document.createElement('canvas'); c.width = w + 2; c.height = PF_LINE + 2;
  const g = c.getContext('2d')!;
  // Contorn fosc d'un píxel (la lletra repetida al voltant) perquè es llegeixi sobre qualsevol terra.
  for (const [ox, oy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) {
    let x = ox; for (const ch of text) x += pfDrawChar(g, ch, x, oy, '#1a0d10');
  }
  let x = 1; for (const ch of text) x += pfDrawChar(g, ch, x, 1, color);
  _numbers.set(key, c);
  return c;
}

/** Pinta l'impacte o la curació i el número damunt de la figura (després de pintar-la). */
export function drawFigureHitFx(ctx: CanvasRenderingContext2D, key: string, cx: number, footY: number, S: number, now: number) {
  const h = _hits.get(key);
  if (!h) return;
  const e = now - h.t0;
  if (e < 0) return;
  const midY = footY - S * 0.42;
  const px = S / 48;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (h.kind === 'hit') {
    const s = SEV[h.sev];
    const flip = h.dir[0] < 0 || (h.dir[0] === 0 && h.seed > 500);
    // Cop fort: un esclat d'estrella al darrere i gotes de sang que salten cap enrere.
    if (h.sev === 2) {
      const fs = Math.floor(e / 80);
      if (fs < 3) blit(ctx, 'impact', (3 + fs) * 48, 48, 48, 48, cx - S * 0.75, midY - S * 0.75, S * 1.5, S * 1.5);
      const fb = Math.floor(e / 90);
      if (fb < BLOOD_FRAMES.length) {
        const [bc, br] = BLOOD_FRAMES[fb];
        const bs = S * 0.7, bx = cx + (h.dir[0] || (flip ? -0.6 : 0.6)) * S * 0.3, by = midY + S * 0.05;
        blit(ctx, 'fx', bc * 24, br * 24, 24, 24, bx - bs / 2, by - bs / 2, bs, bs);
      }
    }
    const f = Math.floor(e / IMPACT_FRAME_MS);
    if (f < 3) {
      const [c0, r] = IMPACT[h.style];
      const size = S * s.impact * (h.style === 'star' ? 0.8 : 1);
      ctx.save();
      ctx.translate(cx, midY);
      if (flip) ctx.scale(-1, 1);
      blit(ctx, 'impact', (c0 + f) * 48, r * 48, 48, 48, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  } else {
    const f = Math.floor(e / 130);
    if (f < HEAL_FRAMES.length) {
      const [c, r] = HEAL_FRAMES[f];
      const t = tintedRegion('fx', c * 24, r * 24, 24, 24, POTION);
      const size = S * 0.8;
      if (t) ctx.drawImage(t, cx - size / 2, midY - (e / HEAL_MS) * S * 0.2 - size / 2, size, size);
    }
  }
  // Número que puja i s'esvaeix (amb un rebot en sortir). Escala sencera: res de píxels deformats.
  const dur = h.kind === 'heal' ? HEAL_MS : Math.max(SEV[h.sev].ms, 650);
  if (e < dur) {
    const p = e / dur;
    const text = h.kind === 'heal' ? `+${h.amount}` : `-${h.amount}`;
    const nc = numberCanvas(text, h.kind === 'heal' ? HEAL_COLOR : NUMBER_COLOR[h.sev]);
    const k = Math.max(1, Math.round(px * (h.kind === 'heal' ? 1.4 : SEV[h.sev].number)));
    const pop = p < 0.12 ? 1 + (1 - p / 0.12) * 0.5 : 1;
    const w = nc.width * k * pop, hh = nc.height * k * pop;
    const y = footY - S * 0.95 - p * S * 0.35;
    ctx.globalAlpha *= p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
    ctx.drawImage(nc, Math.round(cx - w / 2), Math.round(y - hh), w, hh);
  }
  ctx.restore();
}
