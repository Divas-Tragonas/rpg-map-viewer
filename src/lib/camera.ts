import type { CamRect, Point } from '@/types';

/**
 * Càmera independent de la mida i el format de la finestra.
 *
 * PROBLEMA QUE RESOL: el DM sincronitzava la càmera com `{ zoom, panOffset }`, on
 * `panOffset` són PÍXELS DE PANTALLA del DM. Amb finestres de mida o format diferents
 * (monitor del DM 2560×1440, tele 1920×1080, tablet 4:3) el mateix `panOffset` desplaça
 * una quantitat de mapa diferent, i com que l'escala base és `min(W/mw, H/mh)` (contain),
 * el rectangle de mapa visible depèn del format: en fer zoom, cada pantalla retallava
 * per un costat diferent. Resultat: el DM tenia un enemic o una porta a la vora de la
 * seva pantalla i els jugadors no el veien — sense cap indici que allò passés.
 *
 * SOLUCIÓ: el que viatja és el rectangle de MAPA que el DM enquadra (`CamRect`, en
 * coordenades de mapa). Cada pantalla el fa encaixar dins la seva (regla "contain"),
 * de manera que **cap pantalla no veu mai menys que el DM**: si el format no coincideix,
 * la diferència apareix com a marge extra de mapa, mai com a retall.
 */

export const baseScale = (W: number, H: number, mw: number, mh: number) => Math.min(W / mw, H / mh);

/** Dimensions natives del mèdia de fons (mateix fallback 1920×1080 que el render loop). */
export function mediaSize(el: HTMLElement | null | undefined): { mw: number; mh: number } {
  if (el?.tagName === 'IMG' && (el as HTMLImageElement).naturalWidth) {
    return { mw: (el as HTMLImageElement).naturalWidth, mh: (el as HTMLImageElement).naturalHeight };
  }
  if (el?.tagName === 'VIDEO' && (el as HTMLVideoElement).videoWidth) {
    return { mw: (el as HTMLVideoElement).videoWidth, mh: (el as HTMLVideoElement).videoHeight };
  }
  return { mw: 1920, mh: 1080 };
}

/** Rectangle de mapa que ocupa una finestra W×H amb el zoom i el pan (en píxels) donats. */
export function viewRect(W: number, H: number, mw: number, mh: number, zoom: number, pan: Point): CamRect {
  const sc = baseScale(W, H, mw, mh) * zoom;
  const ox = (W - mw * sc) / 2 + pan.x;
  const oy = (H - mh * sc) / 2 + pan.y;
  return { cx: (W / 2 - ox) / sc, cy: (H / 2 - oy) / sc, w: W / sc, h: H / sc };
}

/**
 * Retalla l'enquadrament al mapa: no cal demanar a les altres pantalles que reservin
 * espai per als marges buits del DM (amb formats molt diferents això empetitia molt el
 * mapa a l'altra pantalla). La MIDA del rectangle es conserva i només es desplaça cap
 * endins, així que tot el contingut de mapa que veu el DM hi continua sent.
 */
export function clampCamToMap(cam: CamRect, mw: number, mh: number): CamRect {
  const w = Math.min(cam.w, mw), h = Math.min(cam.h, mh);
  const cx = Math.min(Math.max(cam.cx, w / 2), Math.max(w / 2, mw - w / 2));
  const cy = Math.min(Math.max(cam.cy, h / 2), Math.max(h / 2, mh - h / 2));
  return { cx, cy, w, h };
}

/**
 * Converteix un enquadrament de mapa al `{ zoom, pan }` local d'una finestra W×H.
 * Regla "contain": s'agafa l'escala que hi fa cabre TOT el rectangle del DM.
 */
export function camToView(cam: CamRect, W: number, H: number, mw: number, mh: number): { zoom: number; pan: Point } {
  const sc = Math.min(W / Math.max(cam.w, 1e-6), H / Math.max(cam.h, 1e-6));
  const base = baseScale(W, H, mw, mh) || 1e-6;
  return {
    zoom: sc / base,
    pan: { x: W / 2 - cam.cx * sc - (W - mw * sc) / 2, y: H / 2 - cam.cy * sc - (H - mh * sc) / 2 },
  };
}

/**
 * Quant de mapa VEU DE MÉS una pantalla de format `ar` (amplada/alçada) respecte de
 * l'enquadrament del DM. 0 = enquadrament idèntic. S'ensenya al DM per avisar-lo que
 * aquella pantalla arriba més enllà del seu marc (mai menys: la regla és "contain").
 */
export function extraSeen(cam: CamRect, ar: number): { axis: 'w' | 'h'; pct: number } {
  const camAr = cam.w / Math.max(cam.h, 1e-6);
  if (ar >= camAr) return { axis: 'w', pct: Math.round((ar / camAr - 1) * 100) };
  return { axis: 'h', pct: Math.round((camAr / ar - 1) * 100) };
}
