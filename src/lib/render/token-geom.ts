/**
 * Geometria dels tokens, compartida pel render (`render/tokens.ts`) i pel ratolí (`useMouseHandlers`):
 *
 * - **Centre**: un jugador es desa per la cantonada (`pos + R`); un enemic de la biblioteca, pel centre.
 * - **Figureta** (estil Píxel): l'ombra va al centre del token i la figura la trepitja. L'art d'Oryx no
 *   està centrat dins la seva casella de 48 px (els peus són a la fila 37–42 i el cos es decanta un o
 *   dos píxels), o sigui que la posició es calcula **del contingut real de cada sprite** (`creatureBounds`,
 *   capsa alfa del fotograma 0, una vegada per sprite), no amb números fixos.
 * - **Hit-test**: en l'ordre en què es pinten (biblioteca, jugadors i el seleccionat a sobre de tot).
 * - **Apilats**: offset purament visual per obrir en ventall els tokens que són un sobre l'altre.
 */
import { TOKEN_STACK_TOL } from '@/constants';
import type { LibEnemy, Player } from '@/types';
import { packReady } from '@/lib/sprites/pack';
import { hasCreature, drawCreature, TILE } from '@/lib/sprites/draw';
import { reducedMotion } from '@/lib/sprites/states';

type Pt = { x: number; y: number };
type Ref<T> = { current: T };

/** Refs que necessita el hit-test (els té tant el `DMRefs` com el `FrameContext`). */
export interface TokenRefs {
  rLibEnemies: Ref<LibEnemy[]>;
  rPlayers: Ref<Player[]>;
  rPos: Ref<Record<string, Pt>>;
  rTokenSizeOverride: Ref<Record<string, number>>;
  rSelectedToken: Ref<number | string | null>;
  rAppStyle?: Ref<string>;
}

// ── Figureta ──────────────────────────────────────────────────────────────────
/** Costat del quadrat de la figura respecte del radi del token. */
export const FIG_SCALE = 2.4;
/**
 * Del peu a la vora de dalt del quadrat de la figura, en fraccions de `S`: és el que fa servir
 * `drawFigureState` (`FOOT_TO_CENTER + 0,5`, `lib/sprites/states.ts`).
 */
export const FIG_TOP = 0.62 + 0.62 / FIG_SCALE;
/** Aplanat de les el·lipses dels peus (ombra, color, estats, torn). */
export const FOOT_FLAT = 0.36;
/**
 * Els peus (i l'ombra i els halos) van una mica per sota del centre de la casella, en fracció de R:
 * la figura puja per sobre dels peus, i amb els peus al centre el cos quedava a la meitat de dalt.
 */
export const FOOT_DROP = 0.3;
export const footOf = (cy: number, R: number) => cy + R * FOOT_DROP;
/** Semieixos de l'ombra dels peus (fracció de R): la base dels halos de l'app Píxel. */
export const SHADOW_RX = 0.82, SHADOW_RY = 0.28;
/**
 * El·lipse a la distància `d` (px de mapa) de l'ombra: s'eixampla `d` pels DOS eixos, no s'escala,
 * perquè quedi a la mateixa distància de l'ombra per tot arreu.
 */
export const footEllipse = (R: number, d: number) => ({ rx: R * SHADOW_RX + d, ry: R * SHADOW_RY + d });
/** Quant s'enfonsen els peus dins l'ombra (fracció de R): trepitja l'ombra, no hi sura. */
const FOOT_SINK = 0.06;

export interface FigBounds { cx: number; l: number; r: number; top: number; bottom: number }
const FIG_FALLBACK: FigBounds = { cx: 0.49, l: 0.25, r: 0.73, top: 0.2, bottom: 0.875 };
const _bounds = new Map<string, FigBounds>();

/** Capsa del contingut opac de la criatura (fraccions del costat de la casella). */
export function creatureBounds(sprite: string): FigBounds {
  const hit = _bounds.get(sprite);
  if (hit) return hit;
  if (typeof document === 'undefined') return FIG_FALLBACK;
  const c = document.createElement('canvas'); c.width = c.height = TILE;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g || !drawCreature(g, sprite, 0, 0, 0, TILE)) return FIG_FALLBACK;  // full encara no carregat: es torna a provar
  let data: Uint8ClampedArray;
  try { data = g.getImageData(0, 0, TILE, TILE).data; } catch { _bounds.set(sprite, FIG_FALLBACK); return FIG_FALLBACK; }
  let n = 0, sx = 0, l = TILE, r = -1, t = TILE, b = -1;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    if (data[(y * TILE + x) * 4 + 3] < 24) continue;
    n++; sx += x; if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y;
  }
  const out = n ? { cx: (sx / n + 0.5) / TILE, l: l / TILE, r: (r + 1) / TILE, top: t / TILE, bottom: (b + 1) / TILE } : FIG_FALLBACK;
  _bounds.set(sprite, out);
  return out;
}

/** El token es pinta com a figureta? (estil Píxel, paquet carregat i criatura coneguda). */
export function pixelSpriteOf(appStyle: string | undefined, sprite: string | undefined): string | null {
  return appStyle === 'pixel' && packReady() && hasCreature(sprite) ? sprite : null;
}

/**
 * On s'ha de dir a `drawFigureState` que hi ha el peu perquè el contingut de l'sprite quedi amb el
 * centre horitzontal a `cx` i els peus a `footY` (enfonsats `FOOT_SINK` dins l'ombra). `left`: la
 * figura està girada (mirall), o sigui que el decantament horitzontal canvia de signe.
 */
export function placeFigure(sprite: string, cx: number, footY: number, R: number, left: boolean): { x: number; foot: number; top: number } {
  const S = R * FIG_SCALE, b = creatureBounds(sprite);
  const x = cx - (left ? -1 : 1) * (b.cx - 0.5) * S;
  const foot = footY + R * FOOT_SINK + (FIG_TOP - b.bottom) * S;
  return { x, foot, top: foot - FIG_TOP * S };
}

/** Capsa del cos de la figura (px de mapa) amb els peus a `footY`: per al hit-test i la selecció. */
export function figureBox(sprite: string, cx: number, footY: number, R: number): { l: number; r: number; t: number; b: number } {
  const S = R * FIG_SCALE, bd = creatureBounds(sprite);
  const half = Math.max(bd.cx - bd.l, bd.r - bd.cx) * S;
  const b = footY + R * FOOT_SINK;
  return { l: cx - half, r: cx + half, t: b - (bd.bottom - bd.top) * S, b };
}

/**
 * Centre del cos de la figureta (px de mapa) d'un token de centre `cy`: on s'han de centrar els
 * efectes que van «sobre el token» (la creu de derrotat). Amb els peus per sota del centre de la
 * casella, la figura queda per sobre i el centre de la casella cau a les cames.
 */
export function figureMid(sprite: string, cy: number, R: number): number {
  const b = figureBox(sprite, 0, footOf(cy, R), R);
  return (b.t + b.b) / 2;
}

/**
 * La mateixa geometria en fraccions de la casella, per als efectes que només coneixen el punt del
 * token i la casella (els conjurs de l'app Píxel, `render/pixelspells.ts`). Suposen la mida habitual
 * d'un token (R = 0,45 casella, la d'«Ajustar mida», `sizeAllTokens`) i un sprite d'alçada mitjana
 * (`FIG_FALLBACK`): peus, centre del cos i cap, respecte del centre de la casella.
 */
const R_PER_CELL = 0.45;
const FIG_H = (FIG_FALLBACK.bottom - FIG_FALLBACK.top) * FIG_SCALE;  // alçada de la figura, en R
export const FIG_FOOT_DY = (FOOT_DROP + FOOT_SINK) * R_PER_CELL;
export const FIG_HEAD_DY = (FOOT_DROP + FOOT_SINK - FIG_H) * R_PER_CELL;
export const FIG_BODY_DY = (FIG_FOOT_DY + FIG_HEAD_DY) / 2;

// ── Tokens en ordre de pintura ────────────────────────────────────────────────
export interface TokenSlot { key: string; x: number; y: number; R: number; sprite: string | null }

/**
 * Tots els tokens en l'ordre en què es pinten (de sota a sobre): biblioteca, jugadors, el seleccionat
 * i, a sobre de tot, el que el cursor assenyala dins d'un ventall obert. Amb `visual`, el centre i el
 * radi inclouen l'offset i l'augment del ventall dels apilats.
 */
export function tokenSlots(refs: TokenRefs, visual = true): TokenSlot[] {
  const out: TokenSlot[] = [];
  const pos = refs.rPos.current, ov = refs.rTokenSizeOverride.current, style = refs.rAppStyle?.current;
  for (const en of refs.rLibEnemies.current) {
    const key = `lib_${en.id}`, p = pos[key] || { x: 0, y: 0 }, R = ov[key] ?? en.R;
    out.push({ key, x: p.x, y: p.y, R, sprite: pixelSpriteOf(style, en.sprite) });
  }
  for (const pl of refs.rPlayers.current) {
    const key = `pl_${pl.id}`, p = pos[key] || { x: pl.x, y: pl.y }, R = ov[key] ?? 22;
    out.push({ key, x: p.x + R, y: p.y + R, R, sprite: pixelSpriteOf(style, pl.sprite) });
  }
  const toTop = (key: string | null) => {
    const i = key ? out.findIndex(s => s.key === key) : -1;
    if (i >= 0 && i < out.length - 1) out.push(out.splice(i, 1)[0]);
  };
  toTop(refs.rSelectedToken.current != null ? String(refs.rSelectedToken.current) : null);
  toTop(_hover);
  if (visual && _spread.size) for (const s of out) { const o = _spread.get(s.key); if (o) { s.x += o.x; s.y += o.y; s.R *= o.k; } }
  return out;
}

/** Marge del cercle de la base, en px de pantalla (com abans als jugadors). */
const HIT_PAD = 4;
const onBase = (s: TokenSlot, mx: number, my: number, sc: number) => Math.hypot(mx - s.x, my - s.y) <= s.R + HIT_PAD / sc;
const onFigure = (s: TokenSlot, mx: number, my: number) => {
  if (!s.sprite) return false;
  const b = figureBox(s.sprite, s.x, footOf(s.y, s.R), s.R);
  return mx >= b.l && mx <= b.r && my >= b.t && my <= b.b;
};

/**
 * Token sota el punt (px de mapa), el de més amunt en l'ordre de pintura. Primer es mira la base (el
 * cercle de la casella) i, si no n'hi ha cap, el cos de les figuretes: el cap d'una figura que puja
 * dins la casella de dalt no li pren el clic al token que hi ha a la casella.
 */
export function tokenAt(refs: TokenRefs, mx: number, my: number, sc: number, opts?: { visual?: boolean; filter?: (key: string) => boolean }): TokenSlot | null {
  const list = tokenSlots(refs, opts?.visual ?? true).filter(s => !opts?.filter || opts.filter(s.key));
  for (let i = list.length - 1; i >= 0; i--) if (onBase(list[i], mx, my, sc)) return list[i];
  for (let i = list.length - 1; i >= 0; i--) if (onFigure(list[i], mx, my)) return list[i];
  return null;
}

/** Capsa a la pantalla (px de mapa) del token, per col·locar-hi el menú al costat. */
export function tokenBounds(s: TokenSlot): { l: number; r: number; t: number; b: number } {
  if (s.sprite) {
    const fy = footOf(s.y, s.R), f = figureBox(s.sprite, s.x, fy, s.R);
    return { l: Math.min(f.l, s.x - s.R), r: Math.max(f.r, s.x + s.R), t: f.t, b: fy + s.R * SHADOW_RY };
  }
  return { l: s.x - s.R, r: s.x + s.R, t: s.y - s.R, b: s.y + s.R };
}

// ── Tokens apilats: ventall en passar-hi el cursor ────────────────────────────
/**
 * Offset VISUAL de cada token (px de mapa) i el seu augment (`k`). Viu al mòdul i no a l'estat ni a
 * `DMRefs`: no el llegeix cap component, no es desa ni viatja als jugadors, i només el fan servir el
 * render i el hit-test (com `_facing` a `render/tokens.ts`). La posició real (`rPos`) no es toca mai.
 */
interface Spread { x: number; y: number; tx: number; ty: number; k: number; tk: number }
const _spread = new Map<string, Spread>();
/** Ventall obert: centre, abast (mentre el cursor hi és, no es recalcula) i membres. */
interface Cluster { cx: number; cy: number; reach: number; keys: Set<string> }
let _cluster: Cluster | null = null;
/** Ventall a punt d'obrir-se: s'obre (al rAF) si el cursor encara hi és passat `SPREAD_DELAY`. */
let _pending: { sig: string; at: number; cluster: Cluster; targets: Map<string, Pt> } | null = null;
/** Token que el cursor assenyala dins del ventall obert (creix i va a sobre de tot). */
let _hover: string | null = null;
let _lastT = 0;
const ZERO: Pt = { x: 0, y: 0 };
/** Separació entre veïns del ventall, en radis: < 2 vol dir que encara s'encavalquen una mica. */
const SPREAD_GAP = 1.6;
/** Constant de temps de l'animació (ms): ~3τ fins que s'atura. */
const SPREAD_TAU = 55;
/**
 * Espera (ms) amb el cursor sobre el munt abans d'obrir-lo: passar-hi per sobre de camí a una altra
 * banda no l'ha d'obrir. Uns 0,4 s: prou per no saltar a cada pas, poc per no fer esperar.
 */
const SPREAD_DELAY = 400;
/** Augment del token assenyalat dins del ventall. */
const HOVER_SCALE = 1.18;

export const spreadOffset = (key: string): Pt => _spread.get(key) ?? ZERO;
export const spreadScale = (key: string): number => _spread.get(key)?.k ?? 1;
export const spreadHover = (): string | null => _hover;

function collapse() {
  _cluster = null; _pending = null; _hover = null;
  for (const s of _spread.values()) { s.tx = 0; s.ty = 0; s.tk = 1; }
}

/** Tanca el ventall (es tornen a juntar animats; `instant`, de cop). */
export function clearTokenSpread(instant = false) {
  if (instant) { _spread.clear(); _cluster = null; _pending = null; _hover = null; } else collapse();
}

/**
 * El munt de tokens sota el punt (posicions reals): el token assenyalat i els que en té a menys de
 * `TOKEN_STACK_TOL` caselles, en cadena. Null si no hi ha cap token o si està sol.
 */
export function stackAt(refs: TokenRefs, mx: number, my: number, sc: number, gridSize: number, slop = 0): TokenSlot[] | null {
  const real = tokenSlots(refs, false);
  const hov = tokenAt(refs, mx, my, sc, { visual: false })
    ?? (slop > 0 ? real.slice().reverse().find(s => Math.hypot(mx - s.x, my - s.y) <= s.R + slop) ?? null : null);
  if (!hov) return null;
  const tol = TOKEN_STACK_TOL * (gridSize > 0 ? gridSize : hov.R * 2);
  const group: TokenSlot[] = [real.find(s => s.key === hov.key)!];
  const left = real.filter(s => s.key !== hov.key);
  for (let i = 0; i < group.length; i++) {
    for (let j = left.length - 1; j >= 0; j--) {
      if (Math.hypot(left[j].x - group[i].x, left[j].y - group[i].y) < tol) group.push(left.splice(j, 1)[0]);
    }
  }
  return group.length < 2 ? null : group;
}

/** Hi ha un ventall obert (o a punt d'obrir-se)? */
export const tokenSpreadOpen = (): boolean => !!_cluster || !!_pending;
/** El punt és dins de l'abast del ventall obert? */
export const insideTokenSpread = (mx: number, my: number): boolean =>
  !!_cluster && Math.hypot(mx - _cluster.cx, my - _cluster.cy) <= _cluster.reach;

/**
 * Pantalla de jugador (tacte, sense hover): obre el ventall del munt sota el punt de cop, sense
 * l'espera de `SPREAD_DELAY` (la pulsació llarga ja ha fet d'espera). Retorna si n'ha obert un.
 */
export function openTokenSpreadNow(refs: TokenRefs, mx: number, my: number, sc: number, gridSize: number, slop = 0): boolean {
  collapse();
  if (!stackAt(refs, mx, my, sc, gridSize, slop)) return false;
  updateTokenSpread(refs, mx, my, sc, gridSize, slop);
  if (!_pending) return false;
  _pending.at = 0;
  return true;
}

/**
 * Cridat des del `pointermove` del DM (no a cada frame). Si el cursor és sobre un token que en té
 * d'altres a menys de `TOKEN_STACK_TOL` caselles (en cadena), prepara el ventall al voltant del seu
 * centre, i `advanceTokenSpread` l'obre quan el cursor hi ha estat `SPREAD_DELAY`. Mentre el cursor
 * no surt del ventall obert, no es recalcula (si no, en anar a buscar un token obert el cursor ja no
 * seria sobre el munt i es tancaria): només es mira quin token assenyala.
 */
export function updateTokenSpread(refs: TokenRefs, mx: number, my: number, sc: number, gridSize: number, slop = 0) {
  if (_cluster && Math.hypot(mx - _cluster.cx, my - _cluster.cy) <= _cluster.reach) {
    const keys = _cluster.keys;
    const h = tokenAt(refs, mx, my, sc, { filter: k => keys.has(k) })?.key ?? null;
    if (h !== _hover) {
      _hover = h;
      for (const [k, s] of _spread) s.tk = k === h ? HOVER_SCALE : 1;
    }
    return;
  }
  const group = stackAt(refs, mx, my, sc, gridSize, slop);
  if (!group) { collapse(); return; }
  // Ordre estable (d'esquerra a dreta) i primer cap a l'esquerra: les figuretes són altes, de costat no es tapen.
  group.sort((a, b) => a.x - b.x || a.y - b.y || (a.key < b.key ? -1 : 1));
  const sig = group.map(s => s.key).join('|');
  if (_pending?.sig === sig) return;  // ja està esperant: no es torna a comptar el temps
  if (_cluster) collapse();
  const n = group.length;
  const cx = group.reduce((a, s) => a + s.x, 0) / n, cy = group.reduce((a, s) => a + s.y, 0) / n;
  const Rm = Math.max(...group.map(s => s.R));
  // Veïns del cercle separats SPREAD_GAP·R (corda = 2·r·sin(π/n)); amb dos, un a cada costat.
  const rad = (SPREAD_GAP * Rm) / (2 * Math.sin(Math.PI / n));
  const targets = new Map<string, Pt>();
  group.forEach((s, i) => {
    const a = Math.PI + (2 * Math.PI * i) / n;
    targets.set(s.key, { x: cx + rad * Math.cos(a) - s.x, y: cy + rad * Math.sin(a) * 0.8 - s.y });
  });
  _pending = { sig, at: performance.now() + SPREAD_DELAY, cluster: { cx, cy, reach: rad + Rm * 2.2, keys: new Set(targets.keys()) }, targets };
}

/** Un pas de l'animació del ventall, des del bucle rAF (abans de pintar els tokens). */
export function advanceTokenSpread(now: number) {
  if (_pending && now >= _pending.at) {
    for (const [k, t] of _pending.targets) {
      const cur = _spread.get(k);
      if (cur) { cur.tx = t.x; cur.ty = t.y; } else _spread.set(k, { x: 0, y: 0, tx: t.x, ty: t.y, k: 1, tk: 1 });
    }
    _cluster = _pending.cluster; _pending = null;
  }
  if (!_spread.size) { _lastT = now; return; }
  const dt = Math.min(100, Math.max(0, now - (_lastT || now)));
  _lastT = now;
  const f = reducedMotion() ? 1 : 1 - Math.exp(-dt / SPREAD_TAU);
  for (const [key, s] of _spread) {
    s.x += (s.tx - s.x) * f; s.y += (s.ty - s.y) * f; s.k += (s.tk - s.k) * f;
    if (s.tx === 0 && s.ty === 0 && s.tk === 1 && Math.abs(s.x) < 0.05 && Math.abs(s.y) < 0.05 && Math.abs(s.k - 1) < 0.002) _spread.delete(key);
  }
}
