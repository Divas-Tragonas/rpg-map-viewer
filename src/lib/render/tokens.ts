import type { FrameContext } from './types';
import type { HpHit } from '@/types';
import { TOKEN_LERP, C } from '@/constants';
import { drawConditionBadges } from '@/lib/conditions';
import { drawCreature, grayCreature } from '@/lib/sprites/draw';
import { drawFigureState, figureLook, isLying, reducedMotion } from '@/lib/sprites/states';
import { noteFigure, figureFx, drawFigureHitFx } from '@/lib/sprites/hitfx';
import { pointInPolygon } from '@/lib/geometry';
import { FIG_SCALE, FOOT_FLAT, placeFigure, pixelSpriteOf, spreadOffset, spreadScale, spreadHover, footOf, footEllipse, SHADOW_RX, SHADOW_RY } from './token-geom';

// ── Estil Píxel: el token és una figureta (criatura del paquet Oryx) ───────────
// Cap a on mira cada token: es gira quan es mou cap a l'esquerra (els sprites miren a la dreta).
const _facing = new Map<string, { x: number; left: boolean }>();

/**
 * Traça d'un aro al voltant d'un token, a la distància `d` (px de mapa) de la seva **base**: la vora
 * del disc o, a l'app Píxel, l'el·lipse de l'ombra dels peus. A l'app Píxel l'aro és l'el·lipse de
 * l'ombra **eixamplada `d` pels dos eixos** (no escalada): així queda a la mateixa distància de
 * l'ombra per tot arreu (abans, escalant, als costats se separava i a dalt i a baix s'hi encavalcava).
 * `cx, cy`: centre del token (el de la casella); els peus són una mica més avall (`footOf`).
 */
function ringPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, d: number, R: number, foot: boolean) {
  ctx.beginPath();
  if (foot) { const e = footEllipse(R, d); ctx.ellipse(cx, footOf(cy, R), e.rx, e.ry, 0, 0, Math.PI * 2); }
  else ctx.arc(cx, cy, R + d, 0, Math.PI * 2);
}

// ── Halos ─────────────────────────────────────────────────────────────────────
// Tots són anells concèntrics a la base, cadascun al seu carril (distància fixa a la base, en px de
// pantalla), de dins a fora (veure docs/tokens-i-combat.md, «Halos»):
//   1. Estats    — anell SEGMENTAT de colors (`drawConditionBadges`): disc, per dins de la vora;
//                  Píxel, tocant l'ombra per fora.
//   2. Color     — línia CONTÍNUA fina amb un fil fosc de contrast. És també el halo del TORN i del
//                  RESSALTAR ENEMICS: llavors fa un doble resplendor del color del token que respira.
//   3. Selecció  — blau DISCONTINU que parpelleja (el de sempre).
interface HaloSlots { state: number; color: number; sel: number }
/** Gruix de l'anell dels estats, igual que a `drawConditionBadges` (Píxel: ×0,9; el fons fosc fa ×1,7). */
const stateLw = (R: number, sc: number, foot: boolean) => Math.max(3 / sc, R * 0.11) * (foot ? 0.9 : 1);
function haloSlots(R: number, sc: number, foot: boolean): HaloSlots {
  const lw = stateLw(R, sc, foot);
  const state = foot ? lw * 0.85 + 0.5 / sc : -lw / 2;     // centre de l'anell dels estats
  const stateOut = foot ? lw * 1.7 + 0.5 / sc : 0;          // vora de fora de l'anell (i del seu fons fosc)
  const color = stateOut + 2.5 / sc;
  const sel = color + 5 / sc;
  return { state, color, sel };
}

/**
 * Halo del color del token. Sempre igual; amb `glow` > 0 (té el torn: 1; ressaltar enemics: el seu
 * alfa) hi afegeix un **doble resplendor del mateix color** que respira. Abans el torn era un aro daurat
 * a part i el ressaltar, un altre de groc: tres anells més al voltant del token, i com que anaven en
 * px de pantalla canviaven de proporció amb el zoom. El resplendor va en proporció a la mida del token
 * a la pantalla (`R·sc`), o sigui que es veu igual a qualsevol zoom. `phase` desfasa la respiració.
 */
function drawColorHalo(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, sc: number, color: string, foot: boolean,
  invis = false, glow = 0, phase = 0) {
  const d = haloSlots(R, sc, foot).color;
  const ink = invis ? 'rgba(100,180,255,.75)' : color;
  ctx.save();
  if (invis) ctx.setLineDash([5 / sc, 3 / sc]);
  if (glow > 0.01) {
    const p = reducedMotion() ? 0.5 : 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 3 + phase);
    const px = R * sc;  // radi del token a la pantalla: shadowBlur va en px de pantalla
    const a = ctx.globalAlpha;
    // Dos passos: un vel ample i molt difuminat i un de més estret i viu, tots dos sobre la línia.
    ctx.strokeStyle = ink; ctx.shadowColor = ink;
    ctx.globalAlpha = a * glow * (0.3 + 0.2 * p);
    ctx.lineWidth = Math.max(4, px * 0.16) / sc; ctx.shadowBlur = Math.max(8, px * (0.3 + 0.12 * p));
    ringPath(ctx, cx, cy, d, R, foot); ctx.stroke();
    ctx.globalAlpha = a * glow * (0.55 + 0.3 * p);
    ctx.lineWidth = Math.max(2.5, px * 0.06) / sc; ctx.shadowBlur = Math.max(4, px * (0.1 + 0.05 * p));
    ringPath(ctx, cx, cy, d, R, foot); ctx.stroke();
    ctx.globalAlpha = a; ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  }
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1 / sc;
  ringPath(ctx, cx, cy, d + 1.6 / sc, R, foot); ctx.stroke();
  ctx.strokeStyle = ink; ctx.lineWidth = 2.2 / sc;
  ringPath(ctx, cx, cy, d, R, foot); ctx.stroke();
  ctx.restore();
}

/** Selecció del DM: el blau discontinu que parpelleja, al seu carril (per fora del de color). */
function drawSelectionRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, sc: number, foot: boolean) {
  const pulse = reducedMotion() ? 0.5 : 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 4.5);
  ctx.save(); ctx.strokeStyle = `rgba(100,210,255,${0.65 + 0.35 * pulse})`; ctx.lineWidth = 2.5 / sc; ctx.setLineDash([6 / sc, 3 / sc]);
  ringPath(ctx, cx, cy, haloSlots(R, sc, foot).sel, R, foot); ctx.stroke(); ctx.restore();
}

/** Opcions de l'anell dels estats a l'app Píxel: als peus, a la mateixa distància de l'ombra per tot arreu. */
const footRing = (cy: number, R: number, sc: number) => {
  const e = footEllipse(R, haloSlots(R, sc, true).state);
  return { footY: footOf(cy, R), flat: FOOT_FLAT, rx: e.rx, ry: e.ry };
};

/**
 * Mida del nom sota els tokens a la pantalla de jugador (`fc.labelScale`). Al DM és la de sempre
 * (10–11 px de pantalla); a la de jugador creix amb l'amplada de la finestra, des de la mateixa mida
 * en una tablet fins a gairebé el doble en una TV de 1920 px (la del tauler de missions de la wiki,
 * on els noms de 10 px no es llegien des del sofà). Com que va per amplada en px CSS, a la TV ocupa
 * la mateixa part de la pantalla sigui quina sigui l'escala del sistema.
 */
const NAME_REF_W = 1100, NAME_SCALE_MAX = 2.2;
export const nameScaleFor = (screenW: number) => Math.min(NAME_SCALE_MAX, Math.max(1, screenW / NAME_REF_W));
/** Unitat (en px de mapa) de les mides del nom: 1 px de pantalla al DM, més gran a la pantalla de jugador. */
const nameUnit = (fc: FrameContext) => (fc.labelScale ?? 1) / fc.sc;

/**
 * Nom sota un token. `cx, cy, r`: centre i radi del token (px de mapa); `fig`: figureta (estil Píxel);
 * `badges`: té estats (els seus badges van sobre el cap). Mides en px de pantalla a escala 1 (`size` de
 * la lletra, sempre en negreta; `gap` des de la vora de baix del token, `boxH` del fons). `pri`: 0 jugadors,
 * 1 enemics.
 */
export interface NameTag {
  key: string; text: string; cx: number; cy: number; r: number; fig: boolean; badges: boolean;
  size: number; gap: number; boxH: number;
  color: string; bg: string; alpha: number; pri: number;
}

/** Tots els noms van en negreta (DM i jugador): a la TV, la lletra prima es perdia damunt del mapa. */
const nameFont = (t: NameTag, u: number) => `bold ${t.size * u}px system-ui`;

/** Pinta el nom centrat a `x` amb el fons a partir de `top` (px de mapa). */
function drawNameTag(ctx: CanvasRenderingContext2D, t: NameTag, u: number, x: number, top: number) {
  ctx.font = nameFont(t, u); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const tw = ctx.measureText(t.text).width;
  ctx.globalAlpha = t.alpha;
  ctx.fillStyle = t.bg; ctx.fillRect(x - tw / 2 - 4 * u, top, tw + 8 * u, t.boxH * u);
  ctx.fillStyle = t.color; ctx.fillText(t.text, x, top + (12 - t.gap) * u);
}

/** Al DM, el nom es pinta on toca; a la pantalla de jugador (`fc.nameTags`) es pinten tots junts a `renderNameTags`. */
function nameTag(ctx: CanvasRenderingContext2D, fc: FrameContext, t: NameTag) {
  if (fc.nameTags) { fc.nameTags.push(t); return; }
  const u = nameUnit(fc);
  drawNameTag(ctx, t, u, t.cx, t.cy + t.r + t.gap * u);
}

type Box = { l: number; r: number; t: number; b: number };
const overlapArea = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
/** Cos d'un token a la pantalla (la part de la figureta o del disc que un nom no hauria de tapar). */
const tokenBody = (t: NameTag): Box => t.fig
  ? { l: t.cx - t.r * 0.75, r: t.cx + t.r * 0.75, t: footOf(t.cy, t.r) - t.r * 1.75, b: footOf(t.cy, t.r) + t.r * 0.4 }
  : { l: t.cx - t.r, r: t.cx + t.r, t: t.cy - t.r, b: t.cy + t.r };

/**
 * Noms de la pantalla de jugador, després de totes les figuretes i abans de la foscor de les sales
 * (`renderRooms`), que amaga els de dins. Amb els noms grossos de la TV i el mapa sencer a la pantalla,
 * la colla junta feia noms encavalcats i la fila de sota els tapava. Cada nom va al lloc que el mogui
 * menys sense tocar cap altre nom i tapant tan poc com pugui les altres figuretes: a sota (o una o dues
 * línies més avall), a sobre del cap si no té estats, i desplaçat de costat fins a `NAME_SHIFT` de la
 * seva amplada. Tapar una figureta sencera costa com moure'l `NAME_COVER` línies. El lloc de l'últim
 * frame té avantatge (`_nameSlot`): mentre els tokens llisquen, el nom no salta d'un lloc a l'altre.
 * Primer els jugadors (no es mouen mai per un enemic) i, al final, els enemics de dins d'una sala fosca
 * no revelada: no han d'empènyer cap nom visible (delataria on són).
 */
const NAME_ROWS = 3, NAME_SHIFT = 0.45, NAME_COVER = 4, NAME_STICK = 0.5;
let _nameSlot = new Map<string, number>();
export function renderNameTags(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const tags = fc.nameTags;
  if (!tags?.length) { _nameSlot.clear(); return; }
  const u = nameUnit(fc), pad = 2 * u;
  const dark = (fc.rRooms?.current ?? []).filter(r => r.dark && !r.revealed && r.points.length >= 3);
  ctx.save();
  const items = tags.map((t, i) => {
    ctx.font = nameFont(t, u);
    const pri = t.pri > 0 && dark.some(r => pointInPolygon(t.cx, t.cy, r.points)) ? 2 : t.pri;
    return { t, i, pri, w: ctx.measureText(t.text).width + 8 * u, h: t.boxH * u, body: tokenBody(t), x: t.cx, top: 0, slot: 0 };
  });
  items.sort((a, b) => a.pri - b.pri || a.body.b - b.body.b || a.t.cx - b.t.cx || a.i - b.i);
  const placed: Box[] = [];
  const slots = new Map<string, number>();
  for (const it of items) {
    const { t, w, h } = it, line = h + pad, l0 = t.cx - w / 2;
    // Llocs (slot): 0..NAME_ROWS-1 a sota, -1 i -2 a sobre del cap.
    const cands: { slot: number; top: number; cost: number }[] = [];
    for (let k = 0; k < NAME_ROWS; k++) cands.push({ slot: k, top: t.cy + t.r + t.gap * u + k * line, cost: k * line });
    if (!t.badges) for (let k = 0; k < 2; k++) cands.push({ slot: -1 - k, top: it.body.t - t.gap * u - h - k * line, cost: (k + 1) * line });
    const last = _nameSlot.get(t.key);
    let best = { x: t.cx, top: cands[0].top, slot: 0, cost: Infinity };
    for (const c of cands) {
      const top = c.top, bot = top + h;
      const vcost = c.cost - (c.slot === last ? NAME_STICK * line : 0);
      if (vcost >= best.cost) continue;
      // Per tapar, el nom compta fins al seu token: un nom que salta per sobre d'una altra figureta
      // (dues línies més avall, per sota de la fila del costat) ja no se sap de qui és.
      const et = c.slot < 0 ? top : t.cy + t.r, eb = c.slot < 0 ? it.body.t : bot;
      const nearL = placed.filter(p => p.t < bot + pad && p.b > top - pad);
      const nearB = items.filter(o => o !== it && o.body.t < eb && o.body.b > et).map(o => o.body);
      const shifts = [0];
      for (const p of nearL) shifts.push(p.r + pad - l0, p.l - pad - (l0 + w));
      for (const p of nearB) shifts.push(p.r - l0, p.l - (l0 + w));
      for (const dx of shifts) {
        if (Math.abs(dx) > w * NAME_SHIFT) continue;
        const box = { l: l0 + dx, r: l0 + dx + w, t: top, b: bot };
        if (nearL.some(p => box.r + pad > p.l && box.l - pad < p.r)) continue;
        const reach = { l: box.l, r: box.r, t: et, b: eb };
        const cover = nearB.reduce((sum, b) => sum + overlapArea(reach, b) / ((b.r - b.l) * (b.b - b.t)), 0);
        const cost = vcost + Math.abs(dx) + cover * NAME_COVER * line;
        if (cost < best.cost) best = { x: t.cx + dx, top, slot: c.slot, cost };
      }
    }
    // Sense cap lloc lliure (molts tokens molt junts): a sota, encara que en toqui un altre.
    it.x = best.x; it.top = best.top; it.slot = best.slot;
    slots.set(t.key, it.slot);
    placed.push({ l: it.x - w / 2, r: it.x + w / 2, t: it.top, b: it.top + h });
  }
  _nameSlot = slots;
  // Si s'han de tocar, els jugadors queden a sobre.
  for (let k = items.length - 1; k >= 0; k--) drawNameTag(ctx, items[k].t, u, items[k].x, items[k].top);
  ctx.restore();
}

/**
 * Centre per als badges dels estats. Amb figureta, sobre el cap (`drawConditionBadges` els puja 0,55·R
 * més des d'aquí); estirada, baixen fins a ella.
 */
const FIG_BADGE_LIFT = 0.62;
const badgeY = (cy: number, R: number, sprite: string | null, conds: readonly string[]) =>
  !sprite ? cy : isLying(conds) ? footOf(cy, R) + R * (1.4 - FIG_BADGE_LIFT) : footOf(cy, R) - R * FIG_BADGE_LIFT;

/** El token es pinta com a figureta? (estil Píxel, paquet carregat i criatura coneguda). */
const pixelSprite = (fc: FrameContext, sprite: string | undefined) => pixelSpriteOf(fc.rAppStyle?.current, sprite);

/**
 * Quin token es pinta a la passada de dalt (`pass: 'top'`): el que el cursor assenyala dins d'un ventall
 * obert i, si no n'hi ha, el seleccionat; així queda damunt dels altres (mateix ordre que `tokenSlots`).
 */
export type TokenPass = 'all' | 'base' | 'top';
const topKeyOf = (fc: FrameContext) => !fc.isDM ? null
  : spreadHover() ?? (fc.rSelectedToken.current != null ? String(fc.rSelectedToken.current) : null);
const skipInPass = (key: string, top: string | null, pass: TokenPass) => pass !== 'all' && ((key === top) !== (pass === 'top'));

/**
 * Figureta damunt d'una base: ombra el·líptica i anell del color de l'equip als peus, centrats al
 * centre del token (`cx, cy`, el de la casella), i la criatura animada (4 fotogrames d'espera,
 * desfasats per token) trepitjant l'ombra, centrada pel seu contingut real (`placeFigure`).
 * Derrotat → dreta i en grisos. Substitueix només el disc del token: nom, vida, estats i aros es
 * pinten igual. Pinta la base i RETORNA la funció que pinta la figura: qui crida la crida després
 * dels aros dels peus, perquè quedin sota la figura.
 */
function drawPixelFigure(ctx: CanvasRenderingContext2D, fc: FrameContext, key: string, sprite: string,
  cx: number, cy: number, R: number, team: string,
  opts: { defeated?: number; alpha?: number; invis?: boolean; conds?: readonly string[]; hp?: number; hpMax?: number; hpHit?: HpHit;
    /** Resplendor del halo de color (torn o ressaltat), veure `drawColorHalo`. */ glow?: number; phase?: number }): () => void {
  const { sc } = fc;
  // Cops i curacions (`lib/sprites/hitfx.ts`): es dedueixen de la vida; qui ataca és qui té el torn.
  const turn = fc.rTurn?.current;
  const now = performance.now();
  const footY = footOf(cy, R);
  noteFigure(key, sprite, opts.hp, opts.hpMax, cx, footY, turn?.active ? String(turn.order[turn.turnIndex]) : null, now, opts.hpHit);
  const f = _facing.get(key);
  if (!f) _facing.set(key, { x: cx, left: false });
  else if (Math.abs(cx - f.x) > R * 0.25) { f.left = cx < f.x; f.x = cx; }  // marge: res de girs per tremolors del LERP
  const left = _facing.get(key)!.left;
  const S = R * FIG_SCALE;
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  // Ombra als peus i l'aro del color de l'equip per fora, al seu carril.
  ctx.fillStyle = 'rgba(0,0,0,.38)';
  ctx.beginPath(); ctx.ellipse(cx, footY, R * SHADOW_RX, R * SHADOW_RY, 0, 0, Math.PI * 2); ctx.fill();
  drawColorHalo(ctx, cx, cy, R, sc, team, true, opts.invis, opts.glow, opts.phase);
  ctx.restore();
  // La figura es pinta DESPRÉS: abans hi van els aros dels peus (estats, torn, ressaltat,
  // selecció), que no l'han de tapar mai.
  const alpha = opts.alpha ?? 1;
  return () => {
    ctx.save();
    ctx.globalAlpha = alpha;
    const hit = figureFx(key, cx, footY, S, now, reducedMotion());
    if (hit.dx || hit.dy || hit.rot) {
      // Envestida i empenta: la figura es mou i s'inclina sobre els peus (l'ombra es queda).
      ctx.translate(cx + hit.dx, footY + hit.dy); ctx.rotate(hit.rot); ctx.translate(-cx, -footY);
    }
    const pf = placeFigure(sprite, cx, footY, R, left);
    const d = opts.defeated ?? 0;
    if (d > 0) {
      // Derrotat: la figura es queda dreta, quieta i perd el color (es fon des del color).
      const gray = grayCreature(sprite);
      ctx.imageSmoothingEnabled = false;
      if (d < 1) drawCreature(ctx, sprite, 0, pf.x - S / 2, pf.top, S, left);
      ctx.globalAlpha *= Math.min(1, d) * 0.85;
      if (gray) {
        if (left) { ctx.translate(pf.x + S / 2, 0); ctx.scale(-1, 1); ctx.drawImage(gray, 0, pf.top, S, S); }
        else ctx.drawImage(gray, pf.x - S / 2, pf.top, S, S);
      }
    } else {
      if (opts.invis) ctx.globalAlpha *= 0.45;
      // Amb els estats a la figura (`lib/sprites/states.ts`): estirada, de pedra, quieta, contorn…
      // Estirada, la figura es posa de través sobre l'ombra (sense la correcció dels peus).
      const look = figureLook(opts.conds ?? []);
      drawFigureState(ctx, sprite, look, look.lying ? cx : pf.x, look.lying ? footY : pf.foot, S, left, key.length * 3.1 + key.charCodeAt(key.length - 1), now, hit.flash);
    }
    ctx.restore();
    if (alpha > 0.3) drawFigureHitFx(ctx, key, cx, footY, S, now);
  };
}

// Moviment del token seguint el camí (corba suau de Chaikin): velocitat de creuer (fracció
// de la mida de casella per frame) + frenada suau (ease-out) al final. Ajusta PATH_CRUISE
// per fer-lo més ràpid/lent.
const PATH_CRUISE = 0.08;  // ~4.8 caselles/s a 60fps (gs·0.08 px/frame)
const PATH_BRAKE  = 0.14;  // ease-out de frenada a prop del destí

/**
 * Avança un frame el token `key` pel camí de moviment pendent (`rMovePath`) i retorna la
 * posició resultant, o `null` si no en té cap (llavors mana el LERP recte de sempre).
 *
 * El token recorre la polilínia a **velocitat de creuer constant** (px de mapa per frame,
 * escalada amb la mida de casella) amb una **frenada suau** al final: molt més lent i
 * cinematogràfic que un LERP, i es veu clarament per on passa. En arribar, esborra
 * l'entrada de `rMovePath`. La fa servir tant la pantalla de jugador com la del DM (allà,
 * per als moviments que arriben d'una pantalla de jugador).
 */
function advanceMovePath(fc: FrameContext, key: string): { x: number; y: number } | null {
  const mp = fc.rMovePath?.current[key];
  if (!mp || mp.pts.length < 2) return null;
  const pts = mp.pts;
  let vp = fc.visualPosRef.current[key];
  if (!vp) { vp = { ...pts[0] }; fc.visualPosRef.current[key] = vp; }
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  const gs = fc.rGridSize.current > 0 ? fc.rGridSize.current : 70;
  const cruise = gs * PATH_CRUISE;       // velocitat constant (lenta)
  const remaining = total - mp.t;
  // min(creuer, frenada): cruise mana la major part; a prop del final la frenada
  // (ease-out) fa que s'aturi suau en lloc d'un tall sec.
  mp.t += Math.min(cruise, remaining * PATH_BRAKE);
  if (total - mp.t < 0.5) {
    vp.x = pts[pts.length - 1].x; vp.y = pts[pts.length - 1].y;
    if (fc.rMovePath) delete fc.rMovePath.current[key];
  } else {
    let acc = 0, px = pts[0].x, py = pts[0].y;
    for (let i = 1; i < pts.length; i++) {
      const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      if (acc + seg >= mp.t) {
        const f = seg > 0 ? (mp.t - acc) / seg : 0;
        px = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f;
        py = pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f;
        break;
      }
      acc += seg; px = pts[i].x; py = pts[i].y;
    }
    vp.x = px; vp.y = py;
  }
  return vp;
}

const _tokenImgCache = new Map<string, HTMLImageElement>();
function getTokenImg(src: string): HTMLImageElement {
  let img = _tokenImgCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    _tokenImgCache.set(src, img);
  }
  return img;
}


/**
 * Ombra d'un token de disc: concèntrica (una mica més gran i difosa), no desplaçada cap avall a la
 * dreta, perquè el centre visual del token i el de l'ombra coincideixin amb el de la casella.
 */
function drawDiscShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, sc: number) {
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.arc(cx, cy, R + 4 / sc, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.arc(cx, cy, R + 2 / sc, 0, Math.PI * 2); ctx.fill();
}

/** Selecció del DM (si `key` és a la selecció), al seu carril de halo. */
function selectionFor(ctx: CanvasRenderingContext2D, fc: FrameContext, key: string, cx: number, cy: number, R: number, foot: boolean) {
  if (!fc.isDM) return;
  if (fc.rSelectedToken.current !== key && !fc.rMultiSelected.current.has(key)) return;
  drawSelectionRing(ctx, cx, cy, R, fc.sc, foot);
}

/**
 * `pass`: `'base'` pinta tots els tokens menys el seleccionat i `'top'` només el seleccionat, perquè
 * quedi damunt dels altres (el mateix ordre que fa servir el hit-test, `token-geom.ts`).
 */
export function renderLibEnemyTokens(ctx: CanvasRenderingContext2D, fc: FrameContext, pass: TokenPass = 'all'): void {
  const {
    sc, pp, isDM, rLibEnemies, rConditions, rDefeated, defeatedAnimRef, invisAlphaRef,
    visualPosRef, rTokenSizeOverride, rHighlightAlpha, rTurn,
  } = fc;
  const _turn = rTurn?.current;
  const _activeId = _turn?.active ? _turn.order[_turn.turnIndex] : null;
  const top = topKeyOf(fc);

  rLibEnemies.current.forEach(en => {
    if (skipInPass(`lib_${en.id}`, top, pass)) return;
    const rawEp = (pp[`lib_${en.id}`] as { x: number; y: number } | undefined) || { x: 0, y: 0 };
    let ep: { x: number; y: number };
    if (isDM) {
      // Ventall dels tokens apilats (`token-geom.ts`): offset només visual.
      const so = spreadOffset(`lib_${en.id}`);
      ep = so.x || so.y ? { x: rawEp.x + so.x, y: rawEp.y + so.y } : rawEp;
    } else {
      const key = `lib_${en.id}`;
      const vp = visualPosRef.current[key];
      if (!vp) { visualPosRef.current[key] = { ...rawEp }; ep = rawEp; }
      else { vp.x += (rawEp.x - vp.x) * TOKEN_LERP; vp.y += (rawEp.y - vp.y) * TOKEN_LERP; ep = vp; }
    }
    // Dins d'un ventall, el token que assenyala el cursor creix una mica (`spreadScale`, només DM).
    const R = (rTokenSizeOverride.current[`lib_${en.id}`] ?? en.R) * spreadScale(`lib_${en.id}`);
    const enCondIds = (rConditions.current[`lib_${en.id}`] as string[] | undefined) || [];
    const isInvis = enCondIds.includes('invisible');
    const isDefeated = !!rDefeated.current[`lib_${en.id}`];
    const isVis = en.visible !== false;


    let enAlpha: number;
    if (isDM) {
      enAlpha = isVis ? 1 : 0.3;
    } else {
      const target = (!isVis || isInvis) ? 0 : 1;
      const prev = (invisAlphaRef.current[`lib_${en.id}`] as number | undefined) ?? target;
      const next = prev + (target - prev) * 0.07;
      invisAlphaRef.current[`lib_${en.id}`] = Math.abs(next - target) < 0.004 ? target : next;
      enAlpha = invisAlphaRef.current[`lib_${en.id}`] as number;
      if (enAlpha < 0.02) return;
    }

    let colorProg = 0, crossProg = 0;
    if (isDefeated) {
      if (isDM) { colorProg = 1; crossProg = 1; }
      else {
        const key = `lib_${en.id}`;
        let prog = (defeatedAnimRef.current[key] as number | undefined) ?? 0;
        if (prog < 1) { prog = Math.min(1, prog + 0.018); defeatedAnimRef.current[key] = prog; }
        colorProg = Math.min(1, prog * 2); crossProg = Math.max(0, prog * 2 - 1);
      }
    }

    ctx.globalAlpha = enAlpha;
    const libSprite = pixelSprite(fc, en.sprite);
    // Torn actiu o ressaltar enemics: el halo de color resplendeix (veure `drawColorHalo`).
    const _ha = rHighlightAlpha.current;
    const hlGlow = _ha > 0.01 && isVis && !isDefeated && enAlpha > 0.3 && !en.ally ? _ha : 0;
    const turnGlow = _activeId != null && _activeId === `lib_${en.id}` && !isDefeated && enAlpha > 0.3 ? 1 : 0;
    const glow = Math.max(hlGlow, turnGlow), phase = turnGlow ? 0 : en.id * 0.43;
    if (!libSprite) drawDiscShadow(ctx, ep.x, ep.y, R, sc);

    let fig: (() => void) | null = null;
    if (libSprite) {
      fig = drawPixelFigure(ctx, fc, `lib_${en.id}`, libSprite, ep.x, ep.y, R, en.color, { defeated: isDefeated ? colorProg : 0, alpha: enAlpha, invis: isInvis, glow, phase, conds: enCondIds, hp: en.hpMax > 0 ? Math.max(0, en.hp ?? en.hpMax) : undefined, hpMax: en.hpMax, hpHit: en.hpHit });
    } else if (isDefeated && colorProg > 0) {
      ctx.save();
      ctx.filter = `grayscale(${Math.round(colorProg * 100)}%)`;
      ctx.globalAlpha = enAlpha * (1 - colorProg * 0.35);
      ctx.fillStyle = en.color;
      ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.fill();
      if (en.imageData) {
        const dtImg = getTokenImg(en.imageData);
        if (dtImg.complete && dtImg.naturalWidth > 0) {
          ctx.save(); ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.clip();
          ctx.drawImage(dtImg, ep.x - R, ep.y - R, R * 2, R * 2); ctx.restore();
        }
      }
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2 / sc;
      ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.globalAlpha = enAlpha * colorProg * 0.42;
      ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#cc1111'; ctx.fillRect(ep.x - R, ep.y - R, R * 2, R * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = en.color;
      ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.fill();
      if (en.imageData) {
        const tImg = getTokenImg(en.imageData);
        if (tImg.complete && tImg.naturalWidth > 0) {
          ctx.save(); ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.clip();
          ctx.drawImage(tImg, ep.x - R, ep.y - R, R * 2, R * 2); ctx.restore();
        }
      }
      ctx.strokeStyle = isInvis ? 'rgba(100,180,255,.6)' : 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5 / sc;
      if (isInvis) ctx.setLineDash([5 / sc, 3 / sc]);
      ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (!libSprite) drawColorHalo(ctx, ep.x, ep.y, R, sc, en.color, false, isInvis, glow, phase);

    const showStates = isDM || !isInvis;
    ctx.globalAlpha = enAlpha;
    if (!en.imageData && !libSprite) {
      ctx.font = `bold ${11 / sc}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(en.name.slice(0, 2).toUpperCase(), ep.x, ep.y);
    }
    ctx.textBaseline = 'alphabetic';
    if (showStates) {
      nameTag(ctx, fc, { key: `lib_${en.id}`, text: en.name, cx: ep.x, cy: ep.y, r: R, fig: !!libSprite, badges: enCondIds.length > 0, size: 11, gap: 2, boxH: 13,
        color: isVis ? '#ffaaaa' : '#888', bg: 'rgba(8,12,18,.85)', alpha: enAlpha, pri: 1 });
    }
    ctx.globalAlpha = 1;
    const badges = (parts?: { ring?: boolean; badges?: boolean }) => {
      if (showStates) drawConditionBadges(ctx, ep.x, badgeY(ep.y, R, libSprite, enCondIds), R, enCondIds, sc, libSprite ? footRing(ep.y, R, sc) : undefined, parts);
    };
    badges(fig ? { badges: false } : undefined);  // amb figureta, aquí només l'anell (sota la figura)

    if (isDM && en.hpMax > 0) {
      const hp = Math.max(0, en.hp ?? en.hpMax);
      const hpRatio = hp / en.hpMax;
      const barW = R * 2, barH = Math.max(13 / sc, R * 0.35);
      const barX = ep.x - R, barY = ep.y + R + 16 / sc;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? C.hpHigh : hpRatio > 0.25 ? C.hpMid : C.enemy;
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
      const barFontSize = Math.max(9 / sc, barH * 0.62);
      ctx.font = `bold ${barFontSize}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 2 / sc;
      ctx.fillText(`${hp}/${en.hpMax}`, ep.x, barY + barH / 2);
      ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    }

    const drawCross = () => {
      if (isDefeated && showStates && (isDM || crossProg > 0)) {
        const cr = R * 0.82;
        ctx.save(); ctx.strokeStyle = C.enemy; ctx.lineWidth = 5 / sc; ctx.lineCap = 'round';
        if (isDM) {
          ctx.beginPath(); ctx.moveTo(ep.x - cr, ep.y - cr); ctx.lineTo(ep.x + cr, ep.y + cr); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(ep.x + cr, ep.y - cr); ctx.lineTo(ep.x - cr, ep.y + cr); ctx.stroke();
        } else {
          const lineLen = cr * 2 * 1.42;
          const p1 = Math.min(1, crossProg * 2);
          if (p1 > 0) { ctx.setLineDash([p1 * lineLen, lineLen * 2]); ctx.beginPath(); ctx.moveTo(ep.x - cr, ep.y - cr); ctx.lineTo(ep.x + cr, ep.y + cr); ctx.stroke(); }
          const p2 = Math.max(0, crossProg * 2 - 1);
          if (p2 > 0) { ctx.setLineDash([p2 * lineLen, lineLen * 2]); ctx.beginPath(); ctx.moveTo(ep.x + cr, ep.y - cr); ctx.lineTo(ep.x - cr, ep.y + cr); ctx.stroke(); }
          ctx.setLineDash([]);
        }
        ctx.restore();
      }
    };
    if (!fig) drawCross();

    selectionFor(ctx, fc, `lib_${en.id}`, ep.x, ep.y, R, !!libSprite);

    // Amb figureta: la figura damunt de tots els aros dels peus, i els badges i la creu a sobre.
    if (fig) { fig(); ctx.globalAlpha = 1; badges({ ring: false }); drawCross(); }

    ctx.globalAlpha = 1;
  });
}

// Ghost semitransparent de la destinació del drag (pantalla de jugador). Es pinta sobre
// els tokens però sota la foscor de sales: mostra ON anirà el token sense moure'l encara
// (el token real es queda quiet i no il·lumina fins que es deixa anar).
export function renderDragGhost(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const prev = fc.rDragPreview?.current;
  if (!prev) return;
  const { sc, rPlayers, rTokenSizeOverride } = fc;
  const pl = rPlayers.current.find(p => `pl_${p.id}` === prev.id);
  if (!pl) return;
  const R = rTokenSizeOverride.current[prev.id] ?? 22;
  const cx = prev.x + R, cy = prev.y + R;
  const ghostSprite = pixelSprite(fc, pl.sprite);
  if (ghostSprite) {
    ctx.save(); ctx.globalAlpha = 0.55;
    const S = R * FIG_SCALE, pf = placeFigure(ghostSprite, cx, footOf(cy, R), R, false);
    drawCreature(ctx, ghostSprite, 0, pf.x - S / 2, pf.top, S);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = pl.color;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2 / sc; ctx.setLineDash([5 / sc, 3 / sc]);
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = `bold ${13 / sc}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(pl.name.slice(0, 2).toUpperCase(), cx, cy);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.restore();
}

/** Últim radi pintat de cada jugador a la pantalla de jugador (veure el LERP de `renderPlayerTokens`). */
const _lastR = new Map<string, number>();

/** Tokens dels jugadors (`pass`: veure `renderLibEnemyTokens`). La posició és la cantonada; el centre, `+R`. */
export function renderPlayerTokens(ctx: CanvasRenderingContext2D, fc: FrameContext, pass: TokenPass = 'all'): void {
  const {
    sc, pp, isDM, rPlayers, rConditions, visualPosRef, rSelectedToken, rTokenSizeOverride,
    rDefeated, defeatedAnimRef, rTurn,
  } = fc;
  const _turn = rTurn?.current;
  const _activeId = _turn?.active ? _turn.order[_turn.turnIndex] : null;
  const top = topKeyOf(fc);
  rPlayers.current.forEach(pl => {
    if (skipInPass(`pl_${pl.id}`, top, pass)) return;
    const baseR = rTokenSizeOverride.current[`pl_${pl.id}`] ?? 22;
    const rawPos = pp[`pl_${pl.id}`] || { x: pl.x, y: pl.y };
    let ppos = rawPos;
    const key = `pl_${pl.id}`;
    if (isDM) {
      // El DM no suavitza res del que mou ell mateix (el token segueix el ratolí), però SÍ
      // que reprodueix l'animació de desplaçament dels moviments que arriben d'una pantalla
      // de jugador (`rMovePath`, omplert a `handlePlayerTokenMove`): així veu el token
      // desplaçar-se i per on ha passat, en lloc d'un salt sec. En acabar, s'esborra
      // l'entrada de `visualPosRef` perquè la llum torni a seguir `rPos` directament.
      const anim = advanceMovePath(fc, key);
      if (anim) ppos = anim;
      else if (visualPosRef.current[key]) delete visualPosRef.current[key];
      // Ventall dels tokens apilats (`token-geom.ts`): offset només visual.
      const so = spreadOffset(key);
      if (so.x || so.y) ppos = { x: ppos.x + so.x, y: ppos.y + so.y };
    } else {
      const vp = visualPosRef.current[key];
      // La posició és la cantonada: si el radi canvia, la cantonada de destí es mou −ΔR i el LERP
      // l'hi portaria a poc a poc mentre el radi ja ha canviat, i el token feia un salt i tornava.
      // Es mou també la cantonada visual perquè el centre es quedi quiet.
      const lr = _lastR.get(key);
      if (vp && lr !== undefined && lr !== baseR) { vp.x -= baseR - lr; vp.y -= baseR - lr; }
      _lastR.set(key, baseR);
      if (!vp) { visualPosRef.current[key] = { ...rawPos }; ppos = rawPos; }
      // Drag local a la pantalla de jugador: el token segueix el dit sense LERP
      else if (rSelectedToken.current === key) { vp.x = rawPos.x; vp.y = rawPos.y; ppos = vp; }
      else {
        // Camí de moviment pendent (vorejant parets, forma d'L): es recorre a velocitat de
        // creuer amb frenada suau. Sense camí, LERP recte de sempre. Així la llum no talla
        // per sales fosques que el token no travessa.
        const anim = advanceMovePath(fc, key);
        if (anim) ppos = anim;
        else { vp.x += (rawPos.x - vp.x) * TOKEN_LERP; vp.y += (rawPos.y - vp.y) * TOKEN_LERP; ppos = vp; }
      }
    }
    // Dins d'un ventall, el token que assenyala el cursor creix una mica (`spreadScale`, només DM); la
    // cantonada es desplaça perquè creixi des del centre.
    const k = spreadScale(key), R = baseR * k;
    if (k !== 1) ppos = { x: ppos.x - baseR * (k - 1), y: ppos.y - baseR * (k - 1) };
    const plCondIds = rConditions.current[`pl_${pl.id}`] || [];
    const isInvis = plCondIds.includes('invisible');
    if (isInvis && !isDM) return;
    const isDefeated = !!rDefeated.current[`pl_${pl.id}`];
    let colorProg = 0, crossProg = 0;
    if (isDefeated) {
      if (isDM) { colorProg = 1; crossProg = 1; }
      else {
        const key = `pl_${pl.id}`;
        let prog = defeatedAnimRef.current[key] ?? 0;
        if (prog < 1) { prog = Math.min(1, prog + 0.018); defeatedAnimRef.current[key] = prog; }
        colorProg = Math.min(1, prog * 2); crossProg = Math.max(0, prog * 2 - 1);
      }
    }
    ctx.globalAlpha = 1;
    const plSprite = pixelSprite(fc, pl.sprite);
    const glow = _activeId != null && _activeId === `pl_${pl.id}` && !isDefeated ? 1 : 0;  // torn: el halo de color resplendeix
    if (!plSprite) drawDiscShadow(ctx, ppos.x + R, ppos.y + R, R, sc);
    let fig: (() => void) | null = null;
    if (plSprite) {
      fig = drawPixelFigure(ctx, fc, `pl_${pl.id}`, plSprite, ppos.x + R, ppos.y + R, R, pl.color, { defeated: isDefeated ? colorProg : 0, invis: isInvis, glow, conds: plCondIds, hp: pl.hpMax > 0 ? pl.hp ?? pl.hpMax : undefined, hpMax: pl.hpMax, hpHit: pl.hpHit });
    } else if (isDefeated && colorProg > 0) {
      ctx.save();
      ctx.filter = `grayscale(${Math.round(colorProg * 100)}%)`;
      ctx.globalAlpha = 1 - colorProg * 0.35;
      ctx.fillStyle = pl.color;
      ctx.beginPath(); ctx.arc(ppos.x + R, ppos.y + R, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2 / sc;
      ctx.beginPath(); ctx.arc(ppos.x + R, ppos.y + R, R, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.globalAlpha = colorProg * 0.42;
      ctx.beginPath(); ctx.arc(ppos.x + R, ppos.y + R, R, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#cc1111'; ctx.fillRect(ppos.x, ppos.y, R * 2, R * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = pl.color;
      ctx.beginPath(); ctx.arc(ppos.x + R, ppos.y + R, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = isInvis ? 'rgba(100,180,255,.6)' : 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5 / sc;
      if (isInvis) ctx.setLineDash([5 / sc, 3 / sc]);
      ctx.beginPath(); ctx.arc(ppos.x + R, ppos.y + R, R, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (!plSprite) drawColorHalo(ctx, ppos.x + R, ppos.y + R, R, sc, pl.color, false, isInvis, glow);
    if (!plSprite) {
      ctx.fillStyle = '#fff'; ctx.font = `bold ${13 / sc}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pl.name.slice(0, 2).toUpperCase(), ppos.x + R, ppos.y + R);
    }
    ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
    nameTag(ctx, fc, { key: `pl_${pl.id}`, text: pl.name, cx: ppos.x + R, cy: ppos.y + R, r: R, fig: !!plSprite, badges: plCondIds.length > 0, size: 10, gap: 3, boxH: 12,
      color: pl.color, bg: 'rgba(8,12,18,.8)', alpha: 1, pri: 0 });
    ctx.textAlign = 'left';
    const badges = (parts?: { ring?: boolean; badges?: boolean }) =>
      drawConditionBadges(ctx, ppos.x + R, badgeY(ppos.y + R, R, plSprite, plCondIds), R, plCondIds, sc, plSprite ? footRing(ppos.y + R, R, sc) : undefined, parts);
    badges(fig ? { badges: false } : undefined);  // amb figureta, aquí només l'anell (sota la figura)

    if (isDM && pl.hpMax > 0) {
      const hp = pl.hp ?? pl.hpMax, hpRatio = Math.max(0, Math.min(1, hp / pl.hpMax));
      const barW = R * 2, barH = 5 / sc, barX = ppos.x, barY = ppos.y + R * 2 + 18 / sc;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? C.hpHigh : hpRatio > 0.25 ? C.hpMid : C.enemy;
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
      ctx.font = `bold ${9 / sc}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#e6edf3';
      ctx.fillText(`${hp}/${pl.hpMax}`, ppos.x + R, barY + barH + 9 / sc); ctx.textAlign = 'left';
    }

    const drawCross = () => {
      if (isDefeated && (isDM || crossProg > 0)) {
        const cx = ppos.x + R, cy = ppos.y + R, cr = R * 0.82;
        ctx.save(); ctx.strokeStyle = C.enemy; ctx.lineWidth = 5 / sc; ctx.lineCap = 'round';
        if (isDM) {
          ctx.beginPath(); ctx.moveTo(cx - cr, cy - cr); ctx.lineTo(cx + cr, cy + cr); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx + cr, cy - cr); ctx.lineTo(cx - cr, cy + cr); ctx.stroke();
        } else {
          const lineLen = cr * 2 * 1.42;
          const p1 = Math.min(1, crossProg * 2);
          if (p1 > 0) { ctx.setLineDash([p1 * lineLen, lineLen * 2]); ctx.beginPath(); ctx.moveTo(cx - cr, cy - cr); ctx.lineTo(cx + cr, cy + cr); ctx.stroke(); }
          const p2 = Math.max(0, crossProg * 2 - 1);
          if (p2 > 0) { ctx.setLineDash([p2 * lineLen, lineLen * 2]); ctx.beginPath(); ctx.moveTo(cx + cr, cy - cr); ctx.lineTo(cx - cr, cy + cr); ctx.stroke(); }
          ctx.setLineDash([]);
        }
        ctx.restore();
      }
    };
    if (!fig) drawCross();

    selectionFor(ctx, fc, `pl_${pl.id}`, ppos.x + R, ppos.y + R, R, !!plSprite);

    // Amb figureta: la figura damunt de tots els aros dels peus, i els badges i la creu a sobre.
    if (fig) { fig(); ctx.globalAlpha = 1; badges({ ring: false }); drawCross(); }
  });
}
