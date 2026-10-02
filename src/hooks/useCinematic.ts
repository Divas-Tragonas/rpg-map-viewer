'use client';
import { useCallback } from 'react';
import { playBossIntro, bossCamRect, encodePortrait, seedFor } from '@/lib/cinematic';
import { clampCamToMap, mediaSize, viewRect } from '@/lib/camera';
import type { CamRect, Point } from '@/types';
import type { DMRefs } from './useDMRefs';

export interface BossIntroRequest {
  tokenId: number | string;
  bossName: string;
  portrait: HTMLCanvasElement | HTMLImageElement | null;
  tokenPos: Point | null;
}

/**
 * Cinemàtica de boss al DM. `launchBossIntro` és l'ÚNIC punt de llançament: la
 * reprodueix aquí i l'envia a les pantalles de jugador (BC + WS). Retorna el retrat
 * codificat (o `null`) perquè qui la llança el pugui desar al token.
 */
export function useCinematic(R: DMRefs) {
  const { stageRef, canvasRef, mediaRef, rZoom, rPanOffset, dmLocalPan, dmLocalZoom, cinematicActiveRef, cinematicRef, cinematicCamRef, bcRef, wsRef } = R;

  const _play = useCallback((bossName: string, tokenId: number | string, portrait: BossIntroRequest['portrait'], cam: CamRect | null) => {
    const stage = stageRef.current; if (!stage) return;
    cinematicActiveRef.current = true;
    const cc = cinematicCamRef.current;
    if (cam) {
      // Arrenca des del que el DM veu ara (vista privada inclosa) i hi torna en acabar.
      cc.active = true; cc.rect = cam;
      cc.curZoom = rZoom.current * dmLocalZoom.current;
      cc.curPan = { x: rPanOffset.current.x + dmLocalPan.current.x, y: rPanOffset.current.y + dmLocalPan.current.y };
    }
    const intro = playBossIntro({
      stage, bossName, portrait, seed: seedFor(tokenId),
      onCamEnd: () => { cinematicCamRef.current.rect = null; },
      onDone: () => {
        if (cinematicRef.current !== intro) return;
        cinematicRef.current = null;
        cinematicActiveRef.current = false;
        cinematicCamRef.current.rect = null;
      },
    });
    cinematicRef.current = intro;
  }, []);

  const launchBossIntro = useCallback(async (req: BossIntroRequest): Promise<string | null> => {
    if (cinematicActiveRef.current) return null;
    const { portrait } = req;
    // Les imatges de la biblioteca arriben com a `new Image()` sense carregar.
    if (portrait instanceof HTMLImageElement && !portrait.complete) {
      try { await portrait.decode(); } catch { /* sense retrat */ }
    }
    if (cinematicActiveRef.current) return null;

    let cam: CamRect | null = null;
    if (req.tokenPos) {
      const c = canvasRef.current;
      const W = c?.clientWidth ?? 0, H = c?.clientHeight ?? 0;
      if (W && H) {
        const { mw, mh } = mediaSize(mediaRef.current);
        const cur = clampCamToMap(viewRect(W, H, mw, mh, rZoom.current, rPanOffset.current), mw, mh);
        cam = bossCamRect(req.tokenPos, cur, mw, mh);
      }
    }
    const portraitDataUrl = encodePortrait(portrait);
    _play(req.bossName, req.tokenId, portrait, cam);
    const msg = { type: 'BOSS_INTRO' as const, tokenId: req.tokenId, bossName: req.bossName, tokenPos: req.tokenPos, cam, portraitDataUrl };
    bcRef.current?.postMessage(msg);
    wsRef.current?.send(JSON.stringify(msg));
    return portraitDataUrl;
  }, [_play]);

  const skipBossIntro = useCallback(() => {
    if (!cinematicActiveRef.current) return;
    cinematicRef.current?.skip();
    cinematicCamRef.current.rect = null;
  }, []);

  return { launchBossIntro, skipBossIntro };
}
