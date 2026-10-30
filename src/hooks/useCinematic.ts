'use client';
import { useCallback } from 'react';
import { playBossIntro, playPixelIntro, isPixelIntro, bossCamRect, encodePortrait, seedFor, type BossIntroStyle } from '@/lib/cinematic';
import { clampCamToMap, mediaSize, viewRect } from '@/lib/camera';
import type { CamRect, Point } from '@/types';
import type { DMRefs } from './useDMRefs';
import { packReady } from '@/lib/sprites/pack';
import { drawCreature, hasCreature } from '@/lib/sprites/draw';

export interface BossIntroRequest {
  tokenId: number | string;
  bossName: string;
  portrait: HTMLCanvasElement | HTMLImageElement | null;
  tokenPos: Point | null;
  /** Quina cinemàtica (absent = la clàssica). Les de pixel art necessiten el paquet de sprites. */
  style?: BossIntroStyle;
  /** Només al DM, per veure-la abans de llançar-la (no s'envia als jugadors). */
  preview?: boolean;
}

/**
 * Cinemàtica de boss al DM. `launchBossIntro` és l'ÚNIC punt de llançament: la
 * reprodueix aquí i l'envia a les pantalles de jugador (BC + WS). Retorna el retrat
 * codificat (o `null`) perquè qui la llança el pugui desar al token.
 */
/**
 * App Píxel: la figureta del token en un llenç petit amb la proporció del retrat de la
 * cinemàtica (0,72). `playBossIntro` l'amplia sense suavitzar (veure `PIXEL_MAX`).
 */
/** Figureta del token (nom de criatura del paquet), si en té. */
function tokenSprite(R: DMRefs, id: number | string): string | null {
  const k = String(id);
  const sprite = k.startsWith('pl_') ? R.rPlayers.current.find(p => `pl_${p.id}` === k)?.sprite
    : k.startsWith('lib_') ? R.rLibEnemies.current.find(e => `lib_${e.id}` === k)?.sprite
    : R.rPsdEnemyOverrides.current[Number(id)]?.sprite;
  return hasCreature(sprite) ? sprite : null;
}

function spritePortrait(R: DMRefs, id: number | string): HTMLCanvasElement | null {
  if (R.rAppStyle.current !== 'pixel' || !packReady()) return null;
  const sprite = tokenSprite(R, id);
  if (!sprite) return null;
  const c = document.createElement('canvas'); c.width = 48; c.height = 66;
  drawCreature(c.getContext('2d')!, sprite, 1, 0, 66 - 48 - 2, 48);
  return c;
}

export function useCinematic(R: DMRefs) {
  const { stageRef, canvasRef, mediaRef, rZoom, rPanOffset, dmLocalPan, dmLocalZoom, cinematicActiveRef, cinematicRef, cinematicCamRef, bcRef, wsRef } = R;

  const _play = useCallback((bossName: string, tokenId: number | string, portrait: BossIntroRequest['portrait'], cam: CamRect | null,
    pixel: { style: BossIntroStyle; sprite: string | null; party: { name: string; sprite?: string }[] } | null) => {
    const stage = stageRef.current; if (!stage) return;
    cinematicActiveRef.current = true;
    const cc = cinematicCamRef.current;
    if (cam) {
      // Arrenca des del que el DM veu ara (vista privada inclosa) i hi torna en acabar.
      cc.active = true; cc.rect = cam;
      cc.curZoom = rZoom.current * dmLocalZoom.current;
      cc.curPan = { x: rPanOffset.current.x + dmLocalPan.current.x, y: rPanOffset.current.y + dmLocalPan.current.y };
    }
    const common = {
      stage, bossName, portrait, seed: seedFor(tokenId),
      onCamEnd: () => { cinematicCamRef.current.rect = null; },
      onDone: () => {
        if (cinematicRef.current !== intro) return;
        cinematicRef.current = null;
        cinematicActiveRef.current = false;
        cinematicCamRef.current.rect = null;
      },
    };
    const intro = pixel && isPixelIntro(pixel.style)
      ? playPixelIntro({ ...common, style: pixel.style, sprite: pixel.sprite, party: pixel.party })
      : playBossIntro(common);
    cinematicRef.current = intro;
  }, []);

  const launchBossIntro = useCallback(async (req: BossIntroRequest): Promise<string | null> => {
    if (cinematicActiveRef.current) return null;
    // Les de pixel art es pinten amb el paquet: sense paquet, la clàssica.
    const style: BossIntroStyle = isPixelIntro(req.style) && packReady() ? req.style : 'classic';
    const pixel = style !== 'classic';
    // App Píxel: el retrat de la clàssica és la figureta del token (pixel art ampliat).
    const sprite = pixel ? null : spritePortrait(R, req.tokenId);
    const portrait = sprite ?? req.portrait;
    // Les imatges de la biblioteca arriben com a `new Image()` sense carregar.
    if (portrait instanceof HTMLImageElement && !portrait.complete) {
      try { await portrait.decode(); } catch { /* sense retrat */ }
    }
    if (cinematicActiveRef.current) return null;

    // Les de pixel art tapen tot l'escenari: no cal acostar la càmera al boss.
    let cam: CamRect | null = null;
    if (req.tokenPos && !pixel) {
      const c = canvasRef.current;
      const W = c?.clientWidth ?? 0, H = c?.clientHeight ?? 0;
      if (W && H) {
        const { mw, mh } = mediaSize(mediaRef.current);
        const cur = clampCamToMap(viewRect(W, H, mw, mh, rZoom.current, rPanOffset.current), mw, mh);
        cam = bossCamRect(req.tokenPos, cur, mw, mh);
      }
    }
    const portraitDataUrl = encodePortrait(portrait);
    const extra = pixel ? {
      style, sprite: tokenSprite(R, req.tokenId),
      party: R.rPlayers.current.filter(p => p.visible !== false).slice(0, 5).map(p => ({ name: p.name, sprite: p.sprite })),
    } : null;
    _play(req.bossName, req.tokenId, portrait, cam, extra);
    if (req.preview) return null;
    const msg = {
      type: 'BOSS_INTRO' as const, tokenId: req.tokenId, bossName: req.bossName,
      tokenPos: pixel ? null : req.tokenPos, cam, portraitDataUrl, ...(extra ?? {}),
    };
    bcRef.current?.postMessage(msg);
    wsRef.current?.send(JSON.stringify(msg));
    // La figureta no s'ha de desar com a imatge del token (qui la llança desa el que es retorna).
    return sprite ? null : portraitDataUrl;
  }, [_play]);

  const skipBossIntro = useCallback(() => {
    if (!cinematicActiveRef.current) return;
    cinematicRef.current?.skip();
    cinematicCamRef.current.rect = null;
  }, []);

  return { launchBossIntro, skipBossIntro };
}
