import type { CamRect, Point } from '@/types';
import { clampCamToMap } from '@/lib/camera';
import { mulberry32, dragged } from '@/lib/render/fxsprites';
import { CinematicTimeline } from './timeline';

/**
 * Cinemàtica de presentació d'un boss («boss reveal»). Un sol mòdul per al DM i el
 * jugador: abans eren ~200 línies copiades a `useCinematic` i `PlayerView`, que ja
 * havien divergit.
 *
 * Cada execució és PROPIETÀRIA de tot el que crea (elements, timeouts, partícules):
 * `dispose()` ho desfà tot. Així una cinemàtica que es llança just després de saltar-ne
 * una altra no rep la neteja retardada de l'anterior.
 */

/** Durada total i moment en què la càmera torna a la vista normal (ms). */
export const BOSS_INTRO_DUR = 5100;
export const BOSS_INTRO_CAM_END = 4200;

export interface BossIntroOptions {
  stage: HTMLElement;
  bossName: string;
  portrait: HTMLCanvasElement | HTMLImageElement | null;
  /** Llavor de les partícules: mateixa llavor → mateixes partícules a totes les pantalles. */
  seed: number;
  /** Arrencar ja avançada (p. ex. el temps que el jugador ha trigat a descodificar el retrat). */
  offsetMs?: number;
  /** La càmera ha de tornar a la vista normal. */
  onCamEnd?: () => void;
  /** S'ha acabat (o s'ha saltat) i ja no queda res a la pantalla. */
  onDone?: () => void;
}

export interface BossIntro {
  /** Cridar cada frame des del tick de la pantalla. */
  tick(now: number): void;
  /** Sortida ràpida (Esc del DM o `BOSS_INTRO_SKIP`). */
  skip(): void;
  /** Treure-ho tot a l'instant, sense animació de sortida. */
  dispose(): void;
  readonly done: boolean;
}

/**
 * Càmera de la cinemàtica a cada pantalla. `rect` és l'objectiu en coordenades de mapa
 * (`null` = tornar a la vista normal). Al DM, `cur*` és la vista que s'interpola cap a
 * l'objectiu i `active` es manté fins que ha tornat a la vista normal; el jugador ja té
 * el seu propi LERP de càmera i només fa servir `rect`.
 */
export interface CinematicCam { active: boolean; rect: CamRect | null; curZoom: number; curPan: Point }
export const newCinematicCam = (): CinematicCam => ({ active: false, rect: null, curZoom: 1, curPan: { x: 0, y: 0 } });

/** Hash estable d'un id de token per a la llavor de partícules. */
export function seedFor(id: number | string): number {
  const s = String(id);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * Enquadrament de la càmera sobre el boss, en coordenades de MAPA (veure
 * `lib/camera.ts`). El calcula el DM a partir del seu enquadrament compartit i viatja
 * dins `BOSS_INTRO.cam`: cada pantalla el fa encaixar amb `camToView`, o sigui que
 * totes enquadren el mateix tros de mapa sigui quina sigui la seva mida.
 */
export function bossCamRect(tokenPos: Point, cur: CamRect, mw: number, mh: number): CamRect {
  // Meitat del que es veu ara (zoom ×2), però sense quedar-se més obert que 1/1,8 del
  // mapa ni més tancat que 1/4: el mateix rang que tenia el zoom antic (×1,8…×4).
  const hi = Math.min(mw / 1.8 / cur.w, mh / 1.8 / cur.h);
  const lo = Math.max(mw / 4 / cur.w, mh / 4 / cur.h);
  const f = Math.max(Math.min(0.5, hi), Math.min(lo, hi));
  return clampCamToMap({ cx: tokenPos.x, cy: tokenPos.y, w: cur.w * f, h: cur.h * f }, mw, mh);
}

const PORTRAIT_MAX_W = 600;
/** Un GIF animat s'envia tal qual (perdria l'animació), però no si és massa gros. */
const GIF_MAX_CHARS = 3_000_000;

/**
 * Retrat → data URL per enviar-lo a les pantalles: JPEG de 600 px d'ample com a màxim.
 * Els GIF animats es conserven (amb un límit de mida). Retorna `null` si no es pot.
 */
export function encodePortrait(el: HTMLCanvasElement | HTMLImageElement | null): string | null {
  if (!el) return null;
  const img = el as HTMLImageElement & { _rawDataUrl?: string };
  const rawGif = img._rawDataUrl || (img.src?.startsWith?.('data:image/gif') ? img.src : null);
  if (rawGif && rawGif.length <= GIF_MAX_CHARS) return rawGif;
  try {
    const srcW = (el as HTMLCanvasElement).width || img.naturalWidth || 0;
    const srcH = (el as HTMLCanvasElement).height || img.naturalHeight || 0;
    if (!srcW || !srcH) return null;
    const k = Math.min(1, PORTRAIT_MAX_W / srcW);
    const c = document.createElement('canvas');
    c.width = Math.round(srcW * k); c.height = Math.round(srcH * k);
    c.getContext('2d')!.drawImage(el, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.88);
  } catch { return null; }
}

// ── Partícules ───────────────────────────────────────────────────────────────
// Funció pura de (llavor, índex, temps): mateixa pluja d'espurnes a totes les pantalles
// i independent dels fps (abans `cpUpdate(1/60)` fix anava el doble de ràpid a 120 Hz).

const P_FROM = 700, P_TO = 5400;        // finestra en què neixen (ms)
const P_RATE = 34;                      // espurnes per segon
const P_DRAG = 1.83;                    // fricció (≈ 0,97 per frame a 60 fps)
const P_COLS = ['#d4a017', '#ff9900', '#ffd700'];

function drawSparks(ctx: CanvasRenderingContext2D, W: number, H: number, seed: number, tMs: number, alphaMul: number) {
  const tS = tMs / 1000;
  const first = Math.max(0, Math.floor(((tMs - P_FROM) / 1000 - 1.7) * P_RATE));
  const last = Math.floor((Math.min(tMs, P_TO) - P_FROM) / 1000 * P_RATE);
  for (let i = first; i <= last; i++) {
    const rnd = mulberry32(seed ^ Math.imul(i + 1, 0x9E3779B1));
    // Tots els rnd() abans de qualsevol `continue` (veure bola de foc).
    const born = P_FROM / 1000 + i / P_RATE;
    const life = 0.6 + rnd() * 1.1;
    const ang = rnd() * Math.PI * 2, spd = 40 + rnd() * 110;
    const x0 = W * (0.3 + rnd() * 0.45), y0 = H * (0.25 + rnd() * 0.5);
    const r = 1 + rnd() * 2.5;
    const col = P_COLS[i % P_COLS.length];
    const age = tS - born;
    if (age < 0 || age > life) continue;
    const k = 1 - age / life;
    const d = dragged(spd, P_DRAG, age);
    ctx.globalAlpha = k * 0.85 * alphaMul;
    ctx.shadowColor = col; ctx.shadowBlur = r * 3; ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x0 + Math.cos(ang) * d, y0 + Math.sin(ang) * d, r * k, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

// ── Estils ───────────────────────────────────────────────────────────────────

function ensureStyle() {
  if (document.getElementById('cin-style')) return;
  const st = document.createElement('style');
  st.id = 'cin-style';
  st.textContent = `
    @keyframes cinGlitch{0%,94%,100%{transform:translateX(0) scale(1)}95%{transform:translateX(-3px) skewX(-1deg)}97%{transform:translateX(3px) skewX(1deg)}}
    @keyframes cinGlow{0%,100%{text-shadow:0 0 35px #d4a017,0 0 70px rgba(212,160,23,.6),0 5px 12px rgba(0,0,0,.9)}50%{text-shadow:0 0 60px #d4a017,0 0 130px rgba(212,160,23,.8),0 0 220px rgba(212,160,23,.4),0 5px 12px rgba(0,0,0,.9)}}
    @keyframes cinParallaxPrt{0%,100%{transform:translate(0,-50%) translateX(0px) scale(1)}50%{transform:translate(0,-50%) translateX(-32px) scale(1.018)}}
    @keyframes cinParallaxTxt{0%,100%{transform:translateX(0px)}50%{transform:translateX(18px)}}
  `;
  document.head.appendChild(st);
}

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function el(parent: HTMLElement, css: string, tag = 'div'): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = css;
  parent.appendChild(e);
  return e;
}

export function playBossIntro(o: BossIntroOptions): BossIntro {
  ensureStyle();
  const { stage, portrait, seed } = o;
  const bossName = o.bossName || 'BOSS';
  const calm = reducedMotion();
  const PRIMARY = '#d4a017', SECONDARY = '#ff9900', GLOW = 'rgba(212,160,23,0.6)', BGTINT = 'rgba(30,20,0,0.3)';

  // Mides de l'ESCENARI, no de la finestra: al DM el sidebar en treu un tros.
  const SW = stage.clientWidth || window.innerWidth, SH = stage.clientHeight || window.innerHeight;
  const lbH = Math.round(SH * 0.105);

  const timers: number[] = [];
  const later = (fn: () => void, ms: number) => { timers.push(window.setTimeout(fn, ms)); };
  const nodes: HTMLElement[] = [];
  const add = (css: string, tag?: string) => { const e = el(stage, css, tag); nodes.push(e); return e; };

  const cinCanvas = add('position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:58', 'canvas') as HTMLCanvasElement;
  const dim  = add('position:absolute;inset:0;background:#000;opacity:0;transition:opacity 0.65s ease;pointer-events:none;z-index:59');
  const vig  = add('position:absolute;inset:0;background:radial-gradient(ellipse at 30% 60%,transparent 15%,rgba(0,0,0,0.88) 100%);opacity:0;transition:opacity 0.75s ease;pointer-events:none;z-index:59');
  const tint = add(`position:absolute;inset:0;background:${BGTINT};opacity:0;transition:opacity 0.7s ease;pointer-events:none;z-index:59`);

  const ACC = `linear-gradient(90deg,transparent 0%,${PRIMARY} 30%,${SECONDARY} 70%,transparent 100%)`;
  const lbTop = add(`position:absolute;top:0;left:0;right:0;height:${lbH}px;background:#000;transform:translateY(-100%);transition:transform 0.5s cubic-bezier(.4,0,.2,1);pointer-events:none;z-index:61;overflow:hidden`);
  const accTop = el(lbTop, `position:absolute;bottom:0;left:0;right:0;height:2px;background:${ACC};opacity:0;transition:opacity 0.4s ease 0.5s`);
  const lbBot = add(`position:absolute;bottom:0;left:0;right:0;height:${lbH}px;background:#000;transform:translateY(100%);transition:transform 0.5s cubic-bezier(.4,0,.2,1);pointer-events:none;z-index:61;overflow:hidden`);
  const accBot = el(lbBot, `position:absolute;top:0;left:0;right:0;height:2px;background:${ACC};opacity:0;transition:opacity 0.4s ease 0.5s`);

  const prtH = Math.round(SH * 0.92), prtW = Math.min(Math.round(prtH * 0.72), Math.round(SW * 0.55));
  const prtWrap = add(`position:absolute;right:5%;top:50%;width:${prtW}px;height:${prtH}px;transform:translate(120%,-50%);transition:transform 0.6s cubic-bezier(.16,1,.3,1);pointer-events:none;z-index:60`);
  const prtGlow = el(prtWrap, `position:absolute;inset:-50px;background:radial-gradient(ellipse at 40% 55%,${GLOW} 0%,transparent 65%);filter:blur(30px);opacity:0;transition:opacity 1s ease`);
  const MASK = `-webkit-mask-image:linear-gradient(to left,rgba(0,0,0,1) 45%,rgba(0,0,0,.6) 72%,transparent 100%),linear-gradient(to bottom,rgba(0,0,0,1) 60%,transparent 100%);mask-image:linear-gradient(to left,rgba(0,0,0,1) 45%,rgba(0,0,0,.6) 72%,transparent 100%),linear-gradient(to bottom,rgba(0,0,0,1) 60%,transparent 100%);-webkit-mask-composite:intersect;mask-composite:intersect`;
  const IMG_CSS = `position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;${MASK}`;
  if (portrait instanceof HTMLCanvasElement) {
    const pc = el(prtWrap, IMG_CSS, 'canvas') as HTMLCanvasElement;
    pc.width = portrait.width; pc.height = portrait.height;
    pc.getContext('2d')!.drawImage(portrait, 0, 0);
  } else if (portrait) {
    (el(prtWrap, IMG_CSS, 'img') as HTMLImageElement).src = portrait.src;
  } else {
    const ph = el(prtWrap, `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-size:${Math.round(prtH * 0.42)}px;font-weight:900;color:${PRIMARY};text-shadow:0 0 80px ${GLOW};${MASK}`);
    ph.textContent = bossName.slice(0, 1).toUpperCase();
  }

  const txtWrap = add(`position:absolute;left:10%;bottom:${lbH + Math.round(SH * 0.07)}px;transform:translateX(-60px);opacity:0;transition:transform 0.42s cubic-bezier(.16,1,.3,1),opacity 0.42s ease;pointer-events:none;z-index:62`);
  const maxNameW = Math.round(SW * 0.52);
  let nmFS = Math.max(46, Math.min(110, Math.round(SW / 8)));
  const nmEl = el(txtWrap, `display:inline-block;white-space:nowrap;font-family:Georgia,serif;font-size:${nmFS}px;font-weight:900;text-transform:uppercase;letter-spacing:0.10em;color:#fff;text-shadow:0 0 35px ${PRIMARY},0 0 70px ${GLOW},0 5px 12px rgba(0,0,0,0.9);line-height:1.05`);
  nmEl.textContent = bossName;
  // Noms llargs: encongir la lletra perquè hi càpiga en una línia (abans feien dues
  // línies i la barra, calculada per nombre de caràcters, no hi quadrava).
  const measured = nmEl.offsetWidth;
  if (measured > maxNameW) {
    nmFS = Math.max(28, Math.floor(nmFS * maxNameW / measured));
    nmEl.style.fontSize = `${nmFS}px`;
    if (nmEl.offsetWidth > maxNameW) { nmEl.style.whiteSpace = 'normal'; nmEl.style.maxWidth = `${maxNameW}px`; }
  }
  const barW = Math.min(nmEl.offsetWidth || maxNameW, maxNameW);
  const nmBar = el(txtWrap, `height:3px;width:${barW}px;margin-top:${Math.round(SH * 0.008)}px;background:linear-gradient(90deg,${PRIMARY},${SECONDARY},transparent);transform:scaleX(0);transform-origin:left;transition:transform 0.5s cubic-bezier(.16,1,.3,1) 0.1s`);

  let done = false;
  let fading = 1;                 // alfa de les partícules (baixa en saltar)
  const t0 = performance.now() - (o.offsetMs ?? 0);
  let exited = false, skipped = false;

  const dispose = () => {
    if (done) return;
    done = true;
    timers.forEach(id => clearTimeout(id));
    timers.length = 0;
    nodes.forEach(n => n.remove());
    o.onDone?.();
  };

  const exit = (fast: boolean) => {
    if (exited && !fast) return;
    exited = true;
    const d = fast ? 0.42 : 1;
    prtWrap.style.animation = ''; prtWrap.style.transition = `transform ${0.65 * d}s cubic-bezier(.4,0,1,1),opacity ${0.65 * d}s ease`;
    prtWrap.style.transform = 'translate(120%,-50%)'; prtWrap.style.opacity = '0';
    txtWrap.style.animation = ''; txtWrap.style.transition = `transform ${0.55 * d}s cubic-bezier(.4,0,1,1),opacity ${0.55 * d}s ease`;
    txtWrap.style.transform = 'translateX(-60px)'; txtWrap.style.opacity = '0';
    [dim, vig, tint].forEach(e => { e.style.transition = `opacity ${fast ? 0.22 : 0.75}s ease`; e.style.opacity = '0'; });
    lbTop.style.transition = `transform ${0.6 * d}s cubic-bezier(.4,0,1,1)`; lbTop.style.transform = 'translateY(-100%)';
    lbBot.style.transition = `transform ${0.6 * d}s cubic-bezier(.4,0,1,1)`; lbBot.style.transform = 'translateY(100%)';
    o.onCamEnd?.();
  };

  const tl = new CinematicTimeline();
  tl
    .add(60, () => {
      dim.style.opacity = '0.52'; vig.style.opacity = '1'; tint.style.opacity = '1';
      lbTop.style.transform = 'translateY(0)'; lbBot.style.transform = 'translateY(0)';
      later(() => { accTop.style.opacity = '1'; accBot.style.opacity = '1'; }, 500);
    })
    .add(500, () => {
      prtWrap.style.transform = 'translate(0,-50%)';
      later(() => { prtGlow.style.opacity = '1'; }, 280);
      if (!calm) later(() => { prtWrap.style.animation = 'cinParallaxPrt 9s ease-in-out infinite'; }, 700);
    })
    .add(1100, () => {
      txtWrap.style.transform = 'translateX(0)'; txtWrap.style.opacity = '1';
      later(() => { nmBar.style.transform = 'scaleX(1)'; }, 120);
      if (!calm) later(() => { txtWrap.style.animation = 'cinParallaxTxt 9s ease-in-out infinite'; }, 650);
      // Flaix d'impacte. Amb «reduir moviment» és molt més suau (fotosensibilitat).
      const flash = add(`position:absolute;inset:0;background:#fff;opacity:${calm ? 0.18 : 0.88};transition:opacity 0.12s linear;pointer-events:none;z-index:63`);
      later(() => { flash.style.opacity = '0'; }, 16);
      const flash2 = add(`position:absolute;inset:0;background:${PRIMARY};opacity:0.28;transition:opacity 0.5s ease;pointer-events:none;z-index:63`);
      later(() => { flash2.style.opacity = '0'; }, 200);
      later(() => { nmEl.style.animation = calm ? 'cinGlow 2.5s ease 0.8s infinite' : 'cinGlitch 5s ease 2s infinite, cinGlow 2.5s ease 0.8s infinite'; }, 500);
    })
    .add(BOSS_INTRO_CAM_END, () => exit(false))
    .add(BOSS_INTRO_DUR, dispose)
    .play(o.offsetMs ?? 0);

  return {
    get done() { return done; },
    tick(now: number) {
      if (done) return;
      tl.tick();
      const W = cinCanvas.clientWidth, H = cinCanvas.clientHeight;
      if (!W || !H) return;
      if (cinCanvas.width !== W || cinCanvas.height !== H) { cinCanvas.width = W; cinCanvas.height = H; }
      const ctx = cinCanvas.getContext('2d'); if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      drawSparks(ctx, W, H, seed, now - t0, fading);
    },
    skip() {
      if (done || skipped) return;
      skipped = true;
      tl.skip();
      timers.forEach(id => clearTimeout(id));
      timers.length = 0;
      exit(true);
      // Les espurnes s'apaguen amb la resta en lloc de desaparèixer de cop.
      const from = performance.now();
      const fade = () => {
        if (done) return;
        fading = Math.max(0, 1 - (performance.now() - from) / 300);
        if (fading > 0) requestAnimationFrame(fade);
      };
      requestAnimationFrame(fade);
      later(dispose, 320);
    },
    dispose,
  };
}
