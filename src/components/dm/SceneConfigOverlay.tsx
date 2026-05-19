'use client';
import React from 'react';
import { X } from '@/components/icons';
import { SceneImgPicker } from '@/components/ui/SceneImgPicker';
import { C } from '@/constants';
import type { SceneConfigMenuState, LibEnemy, PsdEnemyOverrides } from '@/types';

interface Props {
  sceneConfigMenu: SceneConfigMenuState | null;
  rLayerImages: React.MutableRefObject<Record<number, HTMLCanvasElement>>;
  rPsdEnemyImgCache: React.MutableRefObject<Record<number, HTMLCanvasElement>>;
  libEnemies: LibEnemy[];
  psdEnemyOverrides: PsdEnemyOverrides;
  bcRef: React.MutableRefObject<BroadcastChannel | null>;
  onClose: () => void;
  onTriggerBossIntro: (data: Record<string, unknown>) => void;
  setPsdEnemyProps?: (id: number, props: import('@/types').PsdEnemyOverride) => void;
  setLibEnemyProps?: (id: number, props: Partial<LibEnemy>) => void;
}

export function SceneConfigOverlay({
  sceneConfigMenu, rLayerImages, rPsdEnemyImgCache, libEnemies, psdEnemyOverrides,
  bcRef, onClose, onTriggerBossIntro, setPsdEnemyProps, setLibEnemyProps,
}: Props) {
  if (!sceneConfigMenu) return null;

  const _scIsPsd = typeof sceneConfigMenu.id === 'number';
  const _scIsLib = typeof sceneConfigMenu.id === 'string' && sceneConfigMenu.id.startsWith('lib_');
  const _scLibId = _scIsLib ? parseInt((sceneConfigMenu.id as string).replace('lib_', '')) : null;
  const _scLibEn = _scIsLib ? libEnemies.find(e => e.id === _scLibId) : null;
  const _scPov = _scIsPsd ? (psdEnemyOverrides[sceneConfigMenu.id as number] || {}) : {};
  const _scName = _scPov.name || _scLibEn?.name || sceneConfigMenu.name;

  // Resolve default canvas/image
  let defaultImg: HTMLCanvasElement | HTMLImageElement | null = null;
  if (_scIsPsd) {
    defaultImg = rPsdEnemyImgCache.current[sceneConfigMenu.id as number] || rLayerImages.current[sceneConfigMenu.id as number] || null;
  } else if (_scIsLib && _scLibEn?.imageData) {
    const img = new Image(); img.src = _scLibEn.imageData;
    defaultImg = img;
  } else if (!_scIsLib) {
    defaultImg = rLayerImages.current[sceneConfigMenu.id as number] || null;
  }

  return (
    <div data-ctxmenu="1" style={{ position: 'fixed', left: Math.min(sceneConfigMenu.menuX, window.innerWidth - 250), top: Math.min(sceneConfigMenu.menuY, window.innerHeight - 220), background: C.panel, border: '1px solid rgba(168,85,247,.45)', borderRadius: 10, zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.7)', width: 240, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px 6px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#c084fc', fontWeight: 700, fontSize: 12 }}>⚡ {_scName}</span>
        <button onMouseDown={e => { e.stopPropagation(); onClose(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: '2px', display: 'flex', alignItems: 'center' }}>
          <X size={12} />
        </button>
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SceneImgPicker
          defaultCanvas={defaultImg}
          onTrigger={(imgEl, isCustom) => {
            const tp = sceneConfigMenu.tokenPos;
            onTriggerBossIntro({ tokenId: sceneConfigMenu.id, bossName: _scName, portrait: imgEl, tokenPos: tp });
            let portraitDataUrl: string | null = null;
            if (imgEl) {
              const _img = imgEl as HTMLImageElement & { _rawDataUrl?: string };
              const rawGif = _img._rawDataUrl || (_img.src?.startsWith('data:image/gif') ? _img.src : null);
              if (rawGif) {
                portraitDataUrl = rawGif;
                if (isCustom) {
                  if (_scIsPsd && setPsdEnemyProps) setPsdEnemyProps(sceneConfigMenu.id as number, { imageData: rawGif });
                  if (_scIsLib && _scLibId !== null && setLibEnemyProps) setLibEnemyProps(_scLibId, { imageData: rawGif });
                }
              } else {
                try {
                  const tmp = document.createElement('canvas');
                  const maxW = 600;
                  const srcW = (imgEl as HTMLCanvasElement).width || (imgEl as HTMLImageElement).naturalWidth || maxW;
                  const srcH = (imgEl as HTMLCanvasElement).height || (imgEl as HTMLImageElement).naturalHeight || maxW;
                  const sc = Math.min(1, maxW / Math.max(srcW, 1));
                  tmp.width = Math.round(srcW * sc); tmp.height = Math.round(srcH * sc);
                  tmp.getContext('2d')!.drawImage(imgEl, 0, 0, tmp.width, tmp.height);
                  portraitDataUrl = tmp.toDataURL('image/jpeg', 0.88);
                  if (isCustom) {
                    if (_scIsPsd && setPsdEnemyProps) setPsdEnemyProps(sceneConfigMenu.id as number, { imageData: portraitDataUrl });
                    if (_scIsLib && _scLibId !== null && setLibEnemyProps) setLibEnemyProps(_scLibId, { imageData: portraitDataUrl });
                  }
                } catch { /* empty */ }
              }
            }
            bcRef.current?.postMessage({ type: 'BOSS_INTRO', tokenId: sceneConfigMenu.id, bossName: _scName, tokenPos: tp, portraitDataUrl });
            onClose();
          }}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
