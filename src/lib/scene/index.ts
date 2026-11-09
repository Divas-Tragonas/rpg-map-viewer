// ─────────────────────────────────────────────────────────────────────────────
// Escena — imatges o vídeos de fons (diapositives) + text en subtítols (pestanya «Escena»
// del panell «Mostrar als jugadors»). Va fusionar l'Expositor i el Revelador de text, que
// la v5 va treure: en fa servir el motor de text (`RevealEngine`) i el Ken Burns.
//
// Sincronització SENSE canvis a la API: el servidor WS només reenvia una llista tancada
// de tipus de missatge, així que l'escena viatja dins del `STATE` (que es reenvia opac):
//  - `scene` (SceneShow | null): text, opcions i quin mèdia. Només quan canvia.
//  - `sceneSync` (SceneSync): front del text i enquadrament de la imatge, ~30 fps.
// El mèdia (binari) va pel WS amb la capçalera de l'antic Expositor: `EXPOSITOR_SHOW_META` amb
// `target: 'scene'` + el frame binari; pel BroadcastChannel, `SCENE_MEDIA`.
// ─────────────────────────────────────────────────────────────────────────────

import type { RevealEngine } from '@/lib/textreveal';

export type ScenePlace = 'bottom' | 'center' | 'top';
export type SceneSize = 's' | 'm' | 'l';
export type SceneFit = 'contain' | 'cover';

export interface SceneOpts {
  /**
   * Amb imatge, on van els subtítols (dalt, centre, baix). Sense imatge (text a pantalla
   * completa), com s'alinea el text: dalt = esquerra, centre = centre, baix = dreta.
   */
  place: ScenePlace;
  size: SceneSize;
  /** Franja fosca darrere dels subtítols, per llegir-los sobre imatges clares. */
  band: boolean;
  /** `contain` = la imatge sencera (fons difuminat al voltant); `cover` = omple la pantalla. */
  fit: SceneFit;
  /** Moviment lent de càmera (Ken Burns) sobre la imatge. */
  kenBurns: boolean;
}

export const DEFAULT_SCENE_OPTS: SceneOpts = {
  place: 'bottom', size: 'm', band: true, fit: 'contain', kenBurns: true,
};

export interface SceneMediaRef { id: string; mimeType: string }

export interface SceneShow {
  /** Canvia a cada «Mostrar»: la pantalla fa el fos entre l'escena d'abans i la nova. */
  id: string;
  text: string;
  /** Imatge o vídeo que es veu ara (una de `slides`). */
  media: SceneMediaRef | null;
  /**
   * Totes les imatges de l'escena, en ordre (diapositives). Les pantalles les reben totes en
   * mostrar-se, així passar a la següent és immediat; només es guarden les d'aquesta llista.
   * Absent = només `media` (DM d'abans de les diapositives).
   */
  slides?: SceneMediaRef[];
  opts: SceneOpts;
}

/** Enquadrament de la imatge (zoom/pan del DM + Ken Burns), normalitzat a la mida de l'escenari. */
export interface SceneView { zoom: number; panXNorm: number; panYNorm: number; kbTxPct: number; kbTyPct: number }

export interface SceneSync { id: string; pos: number; cps: number; fadeMs: number; view: SceneView }

export const IDENTITY_VIEW: SceneView = { zoom: 1, panXNorm: 0, panYNorm: 0, kbTxPct: 0, kbTyPct: 0 };

export function mediaKind(mimeType: string): 'image' | 'video' {
  return mimeType.startsWith('video/') ? 'video' : 'image';
}

export function newSceneId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// ── Mides del text ─────────────────────────────────────────────────────────────
// En % de l'amplada de l'escenari: així la previsualització del DM i la pantalla del
// jugador es veuen igual, sigui quina sigui la mida de cadascuna.
const SUB_SIZE: Record<SceneSize, number> = { s: 2.2, m: 2.9, l: 3.8 };
const FULL_SIZE = 4.2;
/** Sense imatge, la mida (S/M/L) també compta: escala la del text a pantalla completa. */
const FULL_SCALE: Record<SceneSize, number> = { s: 0.8, m: 1, l: 1.22 };

/** Mida de la lletra en px per a un escenari de `w` px d'ample. */
export function sceneFontPx(w: number, opts: SceneOpts, hasMedia: boolean): number {
  const pct = hasMedia ? SUB_SIZE[opts.size] : FULL_SIZE * FULL_SCALE[opts.size];
  const px = pct * w / 100;
  // Mínims perquè un mòbil vertical o la previsualització siguin llegibles.
  return hasMedia ? Math.max(13, px) : Math.max(14, Math.min(78, px));
}

// ── Ken Burns (els quatre moviments de l'antic Expositor, el doble de lents) ──
// Mig cicle del moviment (anada o tornada). 76 s: el doble de lent que el de l'antic Expositor (v5 snapshot 19).
export const KB_HALF_MS = 76000;
const KB_VARIANTS = [
  (p: number) => ({ scale: 1 + p * 0.12, tx: 0, ty: 0 }),   // zoom
  (p: number) => ({ scale: 1.07, tx: p * 6, ty: 0 }),        // pan dreta
  (p: number) => ({ scale: 1.07, tx: -p * 6, ty: 0 }),       // pan esquerra
  (p: number) => ({ scale: 1.07, tx: 0, ty: -p * 6 }),       // pan amunt
];
export const KB_VARIANT_COUNT = KB_VARIANTS.length;

/** Fase 0..1..0 suau del Ken Burns per a un temps transcorregut. */
export function kbPhase(elapsedMs: number): number {
  const cycle = elapsedMs % (KB_HALF_MS * 2);
  const raw = cycle < KB_HALF_MS ? cycle / KB_HALF_MS : 2 - cycle / KB_HALF_MS;
  return (1 - Math.cos(raw * Math.PI)) / 2;
}

export function kbAt(variant: number, phase: number): { scale: number; tx: number; ty: number } {
  return KB_VARIANTS[variant]?.(phase) ?? { scale: 1, tx: 0, ty: 0 };
}

/** Transform CSS del contenidor del mèdia (centrat a l'escenari). */
export function viewTransform(v: SceneView, w: number, h: number): string {
  return `translate(calc(-50% + ${v.panXNorm * w}px), calc(-50% + ${v.panYNorm * h}px)) scale(${v.zoom}) translate(${v.kbTxPct}%, ${v.kbTyPct}%)`;
}

// ── Zones de clic de la previsualització del DM ───────────────────────────────
// L'escenari té dos blocs: el de la imatge (clic = diapositiva següent) i el del text
// (clic = avançar el text). El del text és la franja on van els subtítols.
export type SceneZone = 'image' | 'text';

/** Franja vertical (0..1) dels subtítols segons on van. */
export function textZoneBand(place: ScenePlace): [number, number] {
  return place === 'bottom' ? [0.62, 1] : place === 'top' ? [0, 0.38] : [0.3, 0.7];
}

/** Sense imatge, la posició dels subtítols és l'alineació del text a pantalla completa. */
export const PLACE_ALIGN: Record<ScenePlace, 'left' | 'center' | 'right'> = { top: 'left', center: 'center', bottom: 'right' };

export function zoneAt(yNorm: number, place: ScenePlace, hasMedia: boolean): SceneZone {
  if (!hasMedia) return 'text';
  const [a, b] = textZoneBand(place);
  return yNorm >= a && yNorm <= b ? 'text' : 'image';
}

// ── Subtítol frase a frase ─────────────────────────────────────────────────────
// El motor té un span per caràcter de TOT el text. En mode subtítol només es veu la
// frase on és el front: la resta es treu amb `display: none` (només quan canvia de
// frase, no a cada frame). Mentre dura la pausa del final d'una frase, encara es veu
// aquella; la següent apareix quan el front hi entra.
export class SentenceWindow {
  private a = -1;
  private b = -1;
  private all = true;

  /** Torna a ensenyar tot el text (mode continu o pantalla completa). */
  showAll(eng: RevealEngine): void {
    if (this.all) return;
    for (const u of eng.units) u.style.display = '';
    this.all = true; this.a = -1; this.b = -1;
  }

  /** Després de `setText` els spans són nous: oblida la finestra d'abans. */
  invalidate(): void { this.all = true; this.a = -1; this.b = -1; }

  apply(eng: RevealEngine): void {
    if (!eng.n) return;
    const k = Math.max(0, Math.min(eng.n - 1, Math.ceil(eng.pos - 1e-6) - 1));
    let a = 0;
    let b = eng.n;
    for (const v of eng.bounds) {
      if (v <= k) a = v;
      else { b = v; break; }
    }
    // Sense els salts de línia ni els espais del final (empenyerien el subtítol amunt).
    while (b > a && /\s/.test(eng.chars[b - 1])) b--;
    while (a < b && /\s/.test(eng.chars[a])) a++;
    if (!this.all && a === this.a && b === this.b) return;
    for (let i = 0; i < eng.n; i++) eng.units[i].style.display = (i >= a && i < b) ? '' : 'none';
    this.all = false; this.a = a; this.b = b;
  }
}
