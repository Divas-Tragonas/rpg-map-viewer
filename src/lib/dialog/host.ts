import type { CamRect, DialogSync, Point } from '@/types';
import { playDialog, reducedMotion, type DialogLook, type DialogView } from './scene';
import { dialogToken, type DialogWorld } from './tokens';

/**
 * El que fa una pantalla (DM o jugador) amb el camp `dialog`: un sol lloc per a les dues,
 * perquè no divergeixin com havien divergit les dues còpies de la cinemàtica de boss.
 *
 * - `apply(d)`: el `DialogSync` que acaba d'arribar (o `null` = s'ha acabat).
 * - `tick(now, toScreen)`: cada frame, després de calcular la càmera. Retrat i globus es
 *   resolen aquí a partir del token (`tokenId`): si cau derrotat, el retrat passa a grisos;
 *   si s'elimina, es queda la veu.
 * - `cam`: on ha d'anar la càmera ara (coords de mapa) o `null` = vista normal. Amb «reduir
 *   moviment» el canvi espera que la caixa hagi fos a negre i llavors la càmera hi salta.
 */
export class DialogHost {
  private view: DialogView | null = null;
  private d: DialogSync | null = null;
  private lookKey = '';
  private camNow: CamRect | null = null;
  private camTimer = 0;
  readonly calm = reducedMotion();

  constructor(
    private stage: () => HTMLElement | null,
    private world: DialogWorld,
    private pixel: () => boolean,
  ) {}

  get cam(): CamRect | null { return this.camNow; }
  get active(): boolean { return !!this.d; }

  private look(): DialogLook {
    const d = this.d!;
    const tok = d.voice ? null : dialogToken(this.world, d.tokenId);
    return {
      pixel: this.pixel(),
      portrait: tok ? { sprite: tok.sprite, image: tok.image, color: tok.color, name: d.name || tok.name, defeated: tok.defeated } : null,
    };
  }

  private setCam(cam: CamRect | null) {
    clearTimeout(this.camTimer);
    if (!this.calm || !this.camNow || !cam) { this.camNow = cam; return; }
    this.camTimer = window.setTimeout(() => { this.camNow = cam; }, 220);
  }

  apply(d: DialogSync | null) {
    if (!d) {
      this.d = null; this.lookKey = '';
      this.view?.end(); this.view = null;
      this.setCam(null);
      return;
    }
    const stage = this.stage(); if (!stage) return;
    if (!this.view || this.view.id !== d.id || this.view.done) {
      // Un diàleg nou mentre en corre un altre el reemplaça a l'instant.
      this.view?.dispose();
      this.view = playDialog({ stage, id: d.id, kind: d.kind });
    }
    this.d = d;
    const look = this.look();
    this.lookKey = JSON.stringify([look.pixel, look.portrait?.defeated, look.portrait?.sprite, !!look.portrait]);
    this.view.update(d, look);
    this.setCam(d.kind === 'scene' ? d.cam : null);
  }

  tick(now: number, toScreen: (p: Point) => Point) {
    const v = this.view, d = this.d;
    if (!v || !d) return;
    // El token ha caigut, ha canviat de figureta o s'ha canviat d'app: es repinta el retrat.
    const look = this.look();
    const key = JSON.stringify([look.pixel, look.portrait?.defeated, look.portrait?.sprite, !!look.portrait]);
    if (key !== this.lookKey) { this.lookKey = key; v.update(d, look); }
    let anchor: Point | null = null;
    if (d.kind === 'bubble' && !d.voice) {
      const tok = dialogToken(this.world, d.tokenId, true);
      if (tok) anchor = toScreen({ x: tok.center.x, y: tok.center.y - tok.R });
    }
    v.tick(now, anchor);
  }

  dispose() {
    clearTimeout(this.camTimer);
    this.view?.dispose(); this.view = null; this.d = null; this.camNow = null;
  }
}
