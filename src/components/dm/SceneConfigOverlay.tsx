'use client';
import React from 'react';
import { X } from '@/components/icons';
import { SceneImgPicker } from '@/components/ui/SceneImgPicker';
import { C, FS, RADIUS } from '@/constants';
import type { SceneConfigMenuState, LibEnemy, PsdEnemyOverrides } from '@/types';

interface Props {
  sceneConfigMenu: SceneConfigMenuState | null;
  rLayerImages: React.MutableRefObject<Record<number, HTMLCanvasElement>>;
  rPsdEnemyImgCache: React.MutableRefObject<Record<number, HTMLCanvasElement>>;
  libEnemies: LibEnemy[];
  psdEnemyOverrides: PsdEnemyOverrides;
  onClose: () => void;
  onLaunchBossIntro: (req: import('@/hooks/useCinematic').BossIntroRequest) => Promise<string | null>;
  setPsdEnemyProps?: (id: number, props: import('@/types').PsdEnemyOverride) => void;
  setLibEnemyProps?: (id: number, props: Partial<LibEnemy>) => void;
}

export function SceneConfigOverlay({
  sceneConfigMenu, rLayerImages, rPsdEnemyImgCache, libEnemies, psdEnemyOverrides,
  onClose, onLaunchBossIntro, setPsdEnemyProps, setLibEnemyProps,
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
    <div data-ctxmenu="1" style={{ position: 'fixed', left: Math.min(sceneConfigMenu.menuX, window.innerWidth - 250), top: Math.min(sceneConfigMenu.menuY, window.innerHeight - 220), background: C.panel, border: `1px solid ${C.magic}72`, borderRadius: RADIUS.lg, zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.7)', width: 240, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px 6px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: C.magicBright, fontWeight: 700, fontSize: FS.md }}>⚡ {_scName}</span>
        <button onMouseDown={e => { e.stopPropagation(); onClose(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: '2px', display: 'flex', alignItems: 'center' }}>
          <X size={12} />
        </button>
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SceneImgPicker
          defaultCanvas={defaultImg}
          onTrigger={(imgEl, isCustom) => {
            onClose();
            void onLaunchBossIntro({ tokenId: sceneConfigMenu.id, bossName: _scName, portrait: imgEl, tokenPos: sceneConfigMenu.tokenPos }).then(url => {
              // Una imatge triada aquí es queda al token per a la propera vegada.
              if (!isCustom || !url) return;
              if (_scIsPsd && setPsdEnemyProps) setPsdEnemyProps(sceneConfigMenu.id as number, { imageData: url });
              if (_scIsLib && _scLibId !== null && setLibEnemyProps) setLibEnemyProps(_scLibId, { imageData: url });
            });
          }}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
