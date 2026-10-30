/**
 * Cops i curacions a les figuretes (app Píxel), deduïts de la vida dels tokens: no hi ha cap
 * missatge propi. La vida ja arriba a totes les pantalles (`players`, `libEnemies`,
 * `psdEnemyOverrides`) i cada una veu el mateix canvi, o sigui que tothom veu el mateix cop.
 *
 *  - **Cop rebut** (la vida baixa): dos flaixos blancs, una empenta enrere i l'impacte del full
 *    `uf_FX_impact.png` damunt de la figura.
 *  - **Atac**: si hi ha combat i el torn és d'un altre token, aquest s'inclina i fa una envestida
 *    cap a la víctima, i el cop arriba al punt més alt de l'envestida. L'impacte depèn de qui ataca:
 *    tall d'arma (gent), arc d'espasa (jugadors), urpada (animals i monstres) o cop (gòlems…).
 *  - **Curació** (la vida puja): flaix verd suau i els anells de curar de `uf_FX.png`.
 *
 * El primer valor de vida que es veu d'un token no compta (carregar una partida no és un cop).
 */
import { blit, parseSprite } from './draw';

const LUNGE_MS = 300;
/** Quan arriba el cop dins de l'envestida (el punt més endavant). */
const LUNGE_HIT_MS = 130;
const HIT_MS = 420;
const HEAL_MS = 700;

type ImpactStyle = 'slash' | 'claw' | 'swing' | 'star';
interface Hit { t0: number; kind: 'hit' | 'heal'; dir: [number, number]; style: ImpactStyle; seed: number }

const _hp = new Map<string, number>();
const _pos = new Map<string, { x: number; y: number; sprite: string }>();
const _hits = new Map<string, Hit>();
const _lunges = new Map<string, { t0: number; tx: number; ty: number }>();

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
export function noteFigure(key: string, sprite: string, hp: number | undefined, x: number, y: number, attacker: string | null, now: number) {
  _pos.set(key, { x, y, sprite });
  if (hp === undefined) return;
  const prev = _hp.get(key);
  _hp.set(key, hp);
  if (prev === undefined || prev === hp) return;
  const seed = (now * 7919) % 1000;
  if (hp > prev) { _hits.set(key, { t0: now, kind: 'heal', dir: [0, 0], style: 'star', seed }); return; }
  const by = attacker && attacker !== key ? attacker : null;
  const a = by ? _pos.get(by) : undefined;
  let dir: [number, number] = [0, 0];
  if (a) {
    const dx = x - a.x, dy = y - a.y, d = Math.hypot(dx, dy) || 1;
    dir = [dx / d, dy / d];
    _lunges.set(by!, { t0: now, tx: x, ty: y });
  }
  _hits.set(key, { t0: now + (a ? LUNGE_HIT_MS : 0), kind: 'hit', dir, style: styleOf(a ? by : null), seed });
}

export interface FigureFx {
  /** Desplaçament i inclinació de la figura (envestida i empenta). */
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
      dx += (ux / d) * k * px * 8; dy += (uy / d) * k * px * 5;
      rot += Math.sign(ux || 1) * k * 0.16;
    }
  }
  const h = _hits.get(key);
  if (h) {
    const ms = h.kind === 'heal' ? HEAL_MS : HIT_MS;
    const e = now - h.t0;
    if (e >= ms) _hits.delete(key);
    else if (e >= 0) {
      const p = e / ms;
      if (h.kind === 'hit') {
        // Dos flaixos secs (pixel art: res de fos) i una empenta que torna amb fricció.
        const on = p < 0.14 || (p > 0.28 && p < 0.4);
        if (on) flash = { alpha: 1, tint: 'white' };
        if (!calm) {
          const kick = (1 - p) ** 2 * px * 4;
          const [kx, ky] = h.dir[0] || h.dir[1] ? h.dir : [0, -0.2];
          dx += kx * kick; dy += ky * kick * 0.6;
        }
      } else {
        flash = { alpha: 0.55 * Math.sin(p * Math.PI), tint: 'heal' };
      }
    }
  }
  return dx || dy || rot || flash ? { dx, dy, rot, flash } : NONE;
}

// Impactes (`uf_FX_impact.png`: 48 px, 3 fotogrames per efecte) i anells de curar (`uf_FX.png`).
const IMPACT: Record<ImpactStyle, [number, number]> = { slash: [0, 0], claw: [3, 0], swing: [6, 0], star: [0, 1] };
const IMPACT_FRAME_MS = 70;
const HEAL_FRAMES: [number, number][] = [[6, 3], [7, 3], [8, 3], [9, 3]];

/** Pinta l'impacte o la curació damunt de la figura (després de pintar-la). */
export function drawFigureHitFx(ctx: CanvasRenderingContext2D, key: string, cx: number, footY: number, S: number, now: number) {
  const h = _hits.get(key);
  if (!h) return;
  const e = now - h.t0;
  if (e < 0) return;
  const midY = footY - S * 0.42;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (h.kind === 'hit') {
    const f = Math.floor(e / IMPACT_FRAME_MS);
    if (f < 3) {
      const [c0, r] = IMPACT[h.style];
      const size = S * (h.style === 'star' ? 0.8 : 1);
      // Els talls es giren cap al costat d'on ve el cop.
      const flip = h.dir[0] < 0 || (h.dir[0] === 0 && h.seed > 500);
      ctx.translate(cx, midY);
      if (flip) ctx.scale(-1, 1);
      blit(ctx, 'impact', (c0 + f) * 48, r * 48, 48, 48, -size / 2, -size / 2, size, size);
    }
  } else {
    const f = Math.floor(e / 120);
    if (f < HEAL_FRAMES.length) {
      const [c, r] = HEAL_FRAMES[f];
      const size = S * 0.75;
      ctx.globalAlpha *= 0.9;
      blit(ctx, 'fx', c * 24, r * 24, 24, 24, cx - size / 2, midY - (e / HEAL_MS) * S * 0.2 - size / 2, size, size);
    }
  }
  ctx.restore();
}
