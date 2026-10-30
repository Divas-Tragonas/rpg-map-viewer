import type { DialogSync, Point } from '@/types';
import { C, FONT_SERIF } from '@/constants';
import { layoutReveal, visibleCount, type RevealLayout } from './reveal';
import { initials } from './tokens';
import { PF_LINE, pfAdvance, pfDrawChar, pfDraw, pfMeasure, pfWrap } from '@/lib/sprites/font';
import { drawWindow, drawThoughtDot, type PixelWindow } from '@/lib/sprites/window';
import { creatureFrame, drawCreature, grayCreature, hasCreature, TILE } from '@/lib/sprites/draw';
import { packReady } from '@/lib/sprites/pack';

/**
 * Motor del diàleg a una pantalla (DM o jugador): barres de cinemàtica, caixa amb retrat,
 * nom i text que apareix lletra a lletra, o un globus sobre el token en combat.
 *
 * Com `bossIntro`, cada diàleg és PROPIETARI de tot el que crea (elements, temporitzadors)
 * i `dispose()` ho desfà tot. No toca la càmera: la càmera la mou cada pantalla amb el
 * `cam` del `DialogSync` (veure `useDialog` i `PlayerView`).
 *
 * - App Píxel: la caixa és un llenç en píxels de la lletra del paquet (finestra 9-slice,
 *   lletra de 7 px, figureta a 1:1) ampliat a un múltiple ENTER amb `pixelated`.
 * - App Clàssica: DOM amb EB Garamond (`FONT_SERIF`) i el retrat o les inicials.
 *
 * Només s'animen `transform` i `opacity` (res de `text-shadow` ni `filter` animats).
 */

export interface DialogLook {
  pixel: boolean;
  /** Qui parla (resolt a cada pantalla a partir del `tokenId`); `null` = veu sense retrat. */
  portrait: { sprite?: string; image?: string | HTMLCanvasElement; color: string; name: string; defeated: boolean } | null;
}

export interface DialogView {
  readonly id: string;
  readonly done: boolean;
  /** Línia nova, línia completada, opcions, retrat que canvia (derrotat)… */
  update(d: DialogSync, look: DialogLook): void;
  /** Cada frame. `anchor`: on és el cap del token a l'escenari (globus) o `null`. */
  tick(now: number, anchor: Point | null): void;
  /** Sortida animada (barres que se'n van i caixa que s'esvaeix). */
  end(): void;
  dispose(): void;
}

export const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Color del text i de la finestra segons l'estil. */
const INK: Record<string, string> = { normal: '#ececec', crit: '#ffb9a6', xiuxiueig: '#9fb2cc', pensament: '#cdbfff' };
const EMPH = '#ffd44a';
const NAME_INK = '#f2c14e';
const WIN: Record<string, PixelWindow> = { normal: 'navy', crit: 'navy', xiuxiueig: 'plum', pensament: 'plum' };

function ensureStyle() {
  if (document.getElementById('dlg-style')) return;
  const st = document.createElement('style');
  st.id = 'dlg-style';
  st.textContent = `
    @keyframes dlgShake{0%,100%{transform:translate(0,0)}15%{transform:translate(-6px,2px)}30%{transform:translate(5px,-3px)}45%{transform:translate(-4px,1px)}60%{transform:translate(3px,2px)}80%{transform:translate(-1px,-1px)}}
    @keyframes dlgJit{0%,100%{transform:translate(0,0)}25%{transform:translate(.06em,-.05em)}50%{transform:translate(-.05em,.04em)}75%{transform:translate(.04em,.06em)}}
    @keyframes dlgBlink{0%,100%{opacity:.2}50%{opacity:1}}
    .dlg-ch{opacity:0;transition:opacity .14s linear}
    .dlg-ch.on{opacity:1}
    .dlg-em{display:inline-block;color:${EMPH}}
    .dlg-em.jit{animation:dlgJit .32s steps(4) infinite}
  `;
  document.head.appendChild(st);
}

function el(parent: HTMLElement, css: string, tag = 'div'): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = css;
  parent.appendChild(e);
  return e;
}

// Imatges dels retrats (dataURL) ja carregades: es comparteixen entre diàlegs.
const _imgs = new Map<string, HTMLImageElement>();
function imgFor(url: string, onLoad: () => void): HTMLImageElement | null {
  const hit = _imgs.get(url);
  if (hit) return hit.complete && hit.naturalWidth ? hit : null;
  const im = new Image();
  im.onload = onLoad;
  im.src = url;
  _imgs.set(url, im);
  return null;
}

export function playDialog(o: { stage: HTMLElement; id: string; kind: 'scene' | 'bubble'; onDone?: () => void }): DialogView {
  ensureStyle();
  const { stage, kind } = o;
  const calm = reducedMotion();
  const timers: number[] = [];
  const later = (fn: () => void, ms: number) => { timers.push(window.setTimeout(fn, ms)); };
  let done = false, ending = false;

  const root = el(stage, 'position:absolute;inset:0;pointer-events:none;z-index:56;overflow:hidden');
  // ── Barres de cinemàtica (només a l'escena) ────────────────────────────────
  let lbTop: HTMLElement | null = null, lbBot: HTMLElement | null = null;
  let barH = 0;
  if (kind === 'scene') {
    const hidden = calm ? 'opacity:0' : 'transform:translateY(-100%)';
    const hiddenB = calm ? 'opacity:0' : 'transform:translateY(100%)';
    const tr = calm ? 'opacity .45s ease' : 'transform .5s cubic-bezier(.4,0,.2,1)';
    lbTop = el(root, `position:absolute;top:0;left:0;right:0;background:#000;${hidden};transition:${tr}`);
    lbBot = el(root, `position:absolute;bottom:0;left:0;right:0;background:#000;${hiddenB};transition:${tr}`);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (done || ending) return;
      if (calm) { lbTop!.style.opacity = '1'; lbBot!.style.opacity = '1'; }
      else { lbTop!.style.transform = 'translateY(0)'; lbBot!.style.transform = 'translateY(0)'; }
    }));
  }
  // Fos a negre suau per als canvis de càmera amb «reduir moviment» (la càmera hi salta).
  const veil = el(root, 'position:absolute;inset:0;background:#000;opacity:0;transition:opacity .22s ease');

  // Embolcall que es mou (globus) i que tremola (crit). Dins hi va la caixa.
  const wrap = el(root, `position:absolute;left:0;top:0;opacity:0;transition:opacity .25s ease`);
  const shaker = el(wrap, 'position:relative');
  // Píxel: llenç. Clàssica: DOM.
  const cvs = el(shaker, 'display:block;image-rendering:pixelated', 'canvas') as HTMLCanvasElement;
  const box = el(shaker, 'display:none');

  let d: DialogSync | null = null;
  let look: DialogLook = { pixel: false, portrait: null };
  let layout: RevealLayout = { glyphs: [], total: 0 };
  let lineStart = 0;
  let shown = -1;            // lletres que es veuen (per no repintar si no canvia res)
  let pixelKey = '';         // què s'ha pintat al llenç (per no repintar)
  let SW = 0, SH = 0;
  let chars: HTMLElement[] = [];
  let classicKey = '';
  let optsEl: HTMLElement | null = null, moreEl: HTMLElement | null = null;


  // ── Mides ──────────────────────────────────────────────────────────────────
  // Escala proporcional a l'escenari (com el `s(px)` del rètol de torn, però amb la mida
  // de l'escenari i no de la finestra: al DM el lateral en treu un tros).
  const unit = () => Math.max(0.5, Math.min(1.7, Math.min(SW / 1550, SH / 870)));
  const s = (px: number) => Math.round(px * unit());
  // Píxel: múltiple enter. Per a un escenari de 900 px d'alt, ×3; a 4K, ×8.
  const pk = () => Math.max(2, Math.min(10, Math.floor(SH / (kind === 'bubble' ? 330 : 250))));

  const relayout = () => {
    barH = Math.round(SH * 0.09);
    if (lbTop && lbBot) { lbTop.style.height = `${barH}px`; lbBot.style.height = `${barH}px`; }
    pixelKey = ''; classicKey = ''; shown = -1;
  };

  // ── App Píxel ─────────────────────────────────────────────────────────────
  const drawPixel = (now: number) => {
    if (!d) return;
    const k = pk();
    const ink = INK[d.style] ?? INK.normal;
    const n = d.done ? layout.glyphs.length : visibleCount(layout, now - lineStart);
    const complete = n >= layout.glyphs.length;
    const anyEmph = !calm && layout.glyphs.some((g, i) => g.emph && i < n);
    const portrait = look.portrait;
    const animated = portrait?.sprite && hasCreature(portrait.sprite) && !portrait.defeated;
    const frame = animated ? creatureFrame(now) : 0;
    const blink = complete && !d.options?.length ? Math.floor(now / 450) % 2 : 0;
    const jit = anyEmph ? Math.floor(now / 90) : 0;
    const key = `${n}|${frame}|${blink}|${jit}|${k}|${d.line}|${d.options?.join('/') ?? ''}|${portrait?.defeated}|${SW}x${SH}|${packReady()}`;
    if (key === pixelKey) return;
    pixelKey = key;

    const bubble = kind === 'bubble';
    const P = bubble || !portrait ? 0 : TILE;            // retrat a 1:1 (48 px)
    const pad = 8;
    const maxW = bubble ? 150 : Math.min(330, Math.floor((SW * 0.9) / k));
    const textX = pad + (P ? P + 6 : 0);
    const textW = maxW - textX - pad - 2;
    const plain = layout.glyphs.map(g => g.ch).join('');
    const lines = pfWrap(plain, textW);
    const opts = complete ? (d.options ?? []) : [];
    const textH = lines.length * PF_LINE + (opts.length ? 4 + opts.length * PF_LINE : 0);
    const boxW = bubble ? Math.min(maxW, Math.max(...lines.map(pfMeasure), 24) + pad * 2 + 2) : maxW;
    const boxH = Math.max(P ? P + 12 : 0, textH + 12);
    const nameW = d.name ? pfMeasure(d.name.toUpperCase()) + 14 : 0;
    const tabH = d.name && !bubble ? 16 : 0;
    const tailH = bubble ? 6 : 0;
    const dots = d.style === 'pensament' && !bubble && P ? 12 : 0;
    const W = boxW, H = boxH + tabH + tailH;
    if (cvs.width !== W || cvs.height !== H) { cvs.width = W; cvs.height = H; }
    cvs.style.width = `${W * k}px`; cvs.style.height = `${H * k}px`;
    const g = cvs.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, W, H);
    const win = WIN[d.style] ?? 'navy';
    if (tabH) {
      // Pestanya del nom: una finestra petita que queda mig amagada sota la caixa.
      const tx = P ? textX - 6 : 4;
      drawWindow(g, 'navy', tx, 0, Math.max(nameW, 24), 24);
      pfDraw(g, d.name.toUpperCase(), tx + 7, 3, NAME_INK);
    }
    drawWindow(g, win, 0, tabH, boxW, boxH);
    // Retrat.
    if (P && portrait) {
      const px = pad, py = tabH + 6;
      let ok = false;
      if (portrait.sprite && hasCreature(portrait.sprite) && packReady()) {
        if (portrait.defeated) { const gc = grayCreature(portrait.sprite); if (gc) { g.drawImage(gc, px, py, TILE, TILE); ok = true; } }
        else ok = drawCreature(g, portrait.sprite, frame, px, py, TILE);
      }
      if (!ok && portrait.image) {
        const im = typeof portrait.image === 'string' ? imgFor(portrait.image, () => { pixelKey = ''; }) : portrait.image;
        if (im) {
          const iw = (im as HTMLImageElement).naturalWidth || (im as HTMLCanvasElement).width;
          const ih = (im as HTMLImageElement).naturalHeight || (im as HTMLCanvasElement).height;
          const sc = Math.max(TILE / iw, TILE / ih);
          const sw = TILE / sc, sh = TILE / sc;
          g.drawImage(im, (iw - sw) / 2, 0, sw, sh, px, py, TILE, TILE);
          if (portrait.defeated) {
            const id = g.getImageData(px, py, TILE, TILE);
            for (let i = 0; i < id.data.length; i += 4) {
              const l = (id.data[i] * 0.3 + id.data[i + 1] * 0.59 + id.data[i + 2] * 0.11) * 0.8;
              id.data[i] = id.data[i + 1] = id.data[i + 2] = l;
            }
            g.putImageData(id, px, py);
          }
          ok = true;
        }
      }
      if (!ok) {
        g.fillStyle = portrait.defeated ? '#555' : portrait.color;
        g.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        const ini = initials(portrait.name);
        pfDraw(g, ini, px + Math.floor((TILE - pfMeasure(ini)) / 2), py + 15, '#fff');
      }
      if (dots) { drawThoughtDot(g, px + TILE - 2, py - 2); }
    }
    // Text: es parteix el text SENCER (les paraules no salten de línia mentre s'escriuen).
    let gi = 0;
    const y0 = tabH + 6;
    lines.forEach((ln, li) => {
      let x = textX;
      for (const ch of ln) {
        const gl = layout.glyphs[gi];
        if (gi < n && gl) {
          const dy = gl.emph && !calm ? ((jit + gi) % 3) - 1 : 0;
          pfDrawChar(g, ch, x, y0 + li * PF_LINE + dy, gl.emph ? EMPH : ink);
        }
        x += pfAdvance(ch);
        gi++;
      }
      const sep = layout.glyphs[gi]?.ch;
      if (sep === ' ' || sep === '\n') gi++;
    });
    // Opcions de resposta, numerades.
    opts.forEach((op, i) => pfDraw(g, `${i + 1}. ${op}`, textX, y0 + lines.length * PF_LINE + 4 + i * PF_LINE, NAME_INK));
    // Indicador de «continua».
    if (blink) { g.fillStyle = ink; const bx = boxW - 12, by = tabH + boxH - 11; g.fillRect(bx, by, 5, 1); g.fillRect(bx + 1, by + 1, 3, 1); g.fillRect(bx + 2, by + 2, 1, 1); }
    // Cua del globus.
    if (bubble) {
      g.fillStyle = '#262626';
      const cx = Math.floor(boxW / 2), ty = tabH + boxH - 1;
      for (let i = 0; i < tailH; i++) g.fillRect(cx - (tailH - i) + 1, ty + i, (tailH - i) * 2 - 1, 1);
      g.fillStyle = '#1b1c29';
      for (let i = 0; i < tailH - 2; i++) g.fillRect(cx - (tailH - 2 - i) + 1, ty + i, (tailH - 2 - i) * 2 - 1, 1);
    }
    shown = n;
  };

  // ── App Clàssica ───────────────────────────────────────────────────────────
  const buildClassic = () => {
    if (!d) return;
    const bubble = kind === 'bubble';
    const key = `${d.id}|${d.line}|${SW}x${SH}|${look.portrait?.defeated}|${look.portrait?.image ? 1 : 0}`;
    if (key === classicKey) return;
    classicKey = key;
    box.innerHTML = '';
    const st = d.style;
    const border = st === 'crit' ? '#c2412d' : st === 'pensament' ? '#7c6fb0' : st === 'xiuxiueig' ? '#3a4458' : '#3a3f4a';
    box.style.cssText = `display:flex;gap:${s(18)}px;align-items:flex-start;box-sizing:border-box;` +
      `width:${bubble ? 'auto' : `${Math.min(s(1080), Math.round(SW * 0.92))}px`};max-width:${bubble ? s(360) : Math.round(SW * 0.92)}px;` +
      `padding:${bubble ? `${s(10)}px ${s(14)}px` : `${s(18)}px ${s(24)}px`};` +
      `background:linear-gradient(180deg,rgba(14,17,24,.96),rgba(8,10,14,.96));border:${Math.max(1, s(2))}px ${st === 'pensament' ? 'dashed' : 'solid'} ${border};` +
      `border-radius:${bubble ? s(14) : s(10)}px;box-shadow:0 ${s(10)}px ${s(40)}px rgba(0,0,0,.6);color:${C.bright};` +
      `font-family:${FONT_SERIF};position:relative`;
    const p = look.portrait;
    if (p && !bubble) {
      const ps = s(104);
      const pf = el(box, `flex:0 0 ${ps}px;width:${ps}px;height:${ps}px;border-radius:${s(10)}px;overflow:hidden;border:${Math.max(1, s(2))}px solid ${p.color};` +
        `background:${p.color}33;display:flex;align-items:center;justify-content:center`);
      const gray = p.defeated ? 'filter:grayscale(1) brightness(.75);' : '';
      if (typeof p.image === 'string') {
        const im = el(pf, `width:100%;height:100%;object-fit:cover;${gray}${/^data:image\/png/.test(p.image) ? 'image-rendering:pixelated;' : ''}`, 'img') as HTMLImageElement;
        im.src = p.image;
      } else if (p.image) {
        const c2 = el(pf, `width:100%;height:100%;object-fit:cover;${gray}`, 'canvas') as HTMLCanvasElement;
        c2.width = p.image.width; c2.height = p.image.height;
        c2.getContext('2d')!.drawImage(p.image, 0, 0);
      } else {
        el(pf, `font-size:${s(46)}px;font-weight:700;color:${p.defeated ? '#777' : '#fff'}`).textContent = initials(p.name);
      }
    }
    const col = el(box, 'flex:1;min-width:0');
    if (d.name) el(col, `font-size:${s(bubble ? 15 : 22)}px;font-weight:700;letter-spacing:.04em;color:${NAME_INK};margin-bottom:${s(4)}px`).textContent = d.name;
    const size = bubble ? 19 : st === 'crit' ? 31 : st === 'xiuxiueig' ? 25 : 28;
    const txt = el(col, `font-size:${s(size)}px;line-height:1.32;white-space:pre-wrap;color:${INK[st] ?? INK.normal};` +
      `${st === 'xiuxiueig' || st === 'pensament' ? 'font-style:italic;' : ''}${st === 'crit' ? 'font-weight:700;letter-spacing:.01em;' : ''}${!d.name && !p ? 'text-align:center;' : ''}`);
    chars = layout.glyphs.map((gl, i) => {
      const sp = document.createElement('span');
      sp.textContent = gl.ch;
      sp.className = gl.emph ? `dlg-ch dlg-em${calm ? '' : ' jit'}` : 'dlg-ch';
      if (gl.emph && !calm) sp.style.animationDelay = `${-(i % 4) * 80}ms`;
      txt.appendChild(sp);
      return sp;
    });
    optsEl = el(col, `display:none;margin-top:${s(10)}px;font-size:${s(bubble ? 17 : 24)}px;color:${NAME_INK}`);
    moreEl = el(box, `position:absolute;right:${s(14)}px;bottom:${s(8)}px;font-size:${s(18)}px;color:${C.dim};opacity:0;${calm ? '' : 'animation:dlgBlink 1s ease infinite;'}display:none`);
    moreEl.textContent = '▼';
    if (bubble) {
      // Cua del globus (dos triangles: vora i fons).
      el(box, `position:absolute;left:50%;bottom:-${s(12)}px;margin-left:-${s(11)}px;width:0;height:0;border-left:${s(11)}px solid transparent;border-right:${s(11)}px solid transparent;border-top:${s(12)}px solid ${border}`);
    }
    shown = 0;
  };

  const drawClassic = (now: number) => {
    if (!d) return;
    buildClassic();
    const n = d.done ? chars.length : visibleCount(layout, now - lineStart);
    if (n !== shown) {
      for (let i = Math.max(0, Math.min(shown, n)); i < chars.length; i++) chars[i].classList.toggle('on', i < n);
      shown = n;
    }
    const complete = n >= chars.length;
    const opts = complete ? (d.options ?? []) : [];
    if (optsEl) {
      const want = opts.map((op, i) => `${i + 1}. ${op}`).join('\n');
      if (optsEl.textContent !== want) { optsEl.textContent = want; optsEl.style.whiteSpace = 'pre-line'; }
      optsEl.style.display = opts.length ? 'block' : 'none';
    }
    if (moreEl) { moreEl.style.display = complete && !opts.length ? 'block' : 'none'; }
  };

  // ── Posició de la caixa ────────────────────────────────────────────────────
  const place = (anchor: Point | null) => {
    const w = wrap.offsetWidth, h = wrap.offsetHeight;
    let x: number, y: number;
    if (kind === 'bubble' && anchor) {
      x = anchor.x - w / 2; y = anchor.y - h - 6;
    } else {
      x = (SW - w) / 2;
      y = SH - h - (kind === 'scene' ? Math.round(SH * 0.035) : Math.round(SH * 0.12));
    }
    x = Math.max(6, Math.min(SW - w - 6, x)); y = Math.max(6, Math.min(SH - h - 6, y));
    wrap.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
  };

  const dispose = () => {
    if (done) return;
    done = true;
    timers.forEach(t => clearTimeout(t)); timers.length = 0;
    root.remove();
    o.onDone?.();
  };

  return {
    id: o.id,
    get done() { return done; },
    update(next, nextLook) {
      if (done) return;
      const newLine = !d || d.line !== next.line || d.text !== next.text;
      const camMoved = !!d && JSON.stringify(d.cam) !== JSON.stringify(next.cam);
      d = next; look = nextLook;
      if (newLine) {
        layout = layoutReveal(next.text.normalize('NFC'), next.cps);
        lineStart = performance.now() - Math.max(0, next.age);
        pixelKey = ''; classicKey = ''; shown = -1;
        if (next.style === 'crit' && !calm) {
          shaker.style.animation = 'none';
          void shaker.offsetWidth;
          shaker.style.animation = 'dlgShake .38s linear';
        }
      } else { pixelKey = ''; }
      if (camMoved && calm && kind === 'scene') {
        veil.style.opacity = '0.75';
        later(() => { veil.style.opacity = '0'; }, 240);
      }
      const usePixel = look.pixel && packReady();
      cvs.style.display = usePixel ? 'block' : 'none';
      box.style.display = usePixel ? 'none' : 'flex';
    },
    tick(now, anchor) {
      if (done || !d) return;
      const w = stage.clientWidth, h = stage.clientHeight;
      if (w !== SW || h !== SH) { SW = w; SH = h; relayout(); }
      if (look.pixel && packReady()) drawPixel(now); else drawClassic(now);
      place(kind === 'bubble' ? anchor : null);
      if (!ending && wrap.style.opacity !== '1') wrap.style.opacity = '1';
    },
    end() {
      if (done || ending) return;
      ending = true;
      wrap.style.opacity = '0';
      if (lbTop && lbBot) {
        if (calm) { lbTop.style.opacity = '0'; lbBot.style.opacity = '0'; }
        else { lbTop.style.transform = 'translateY(-100%)'; lbBot.style.transform = 'translateY(100%)'; }
      }
      later(dispose, 520);
    },
    dispose,
  };
}

/** Temps de lectura d'un globus (ms): el que triga a escriure's més un marge per llegir-lo. */
export function bubbleLifetime(text: string, cps: number): number {
  return layoutReveal(text, cps).total + 1800 + text.length * 35;
}
