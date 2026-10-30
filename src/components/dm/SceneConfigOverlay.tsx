'use client';
import React from 'react';
import { X, ZapIcon } from '@/components/icons';
import { SceneImgPicker } from '@/components/ui/SceneImgPicker';
import { C, FS, RADIUS, tint } from '@/constants';
import { useStoredString } from '@/hooks/useStoredFlag';
import { useSpritePack } from '@/hooks/useSpritePack';
import { PIXEL_INTROS, isPixelIntro, type BossIntroStyle } from '@/lib/cinematic';
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
  const [stored, setStored] = useStoredString('rpg_boss_intro', 'classic');
  const packOk = useSpritePack().status === 'ready';
  if (!sceneConfigMenu) return null;
  // Les de pixel art es pinten amb els sprites: mentre es carreguen, la de sempre.
  const style: BossIntroStyle = isPixelIntro(stored) && packOk ? stored : 'classic';
  const hint = style === 'classic' ? 'Retrat, nom i espurnes'
    : PIXEL_INTROS.find(p => p.id === style)?.hint ?? '';
  const options: { id: BossIntroStyle; label: string; hint: string }[] = [
    { id: 'classic', label: 'La de sempre', hint: 'Retrat, nom i espurnes' }, ...PIXEL_INTROS,
  ];

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
    <div data-ctxmenu="1" style={{ position: 'fixed', left: Math.min(sceneConfigMenu.menuX, window.innerWidth - 330), top: Math.max(8, Math.min(sceneConfigMenu.menuY, window.innerHeight - 470)), background: C.panel, border: `1px solid ${C.magic}72`, borderRadius: RADIUS.lg, zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.7)', width: 320, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px 6px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: C.magicBright, fontWeight: 700, fontSize: FS.md, display: 'flex', alignItems: 'center', gap: 6 }}><ZapIcon size={13} /> {_scName}</span>
        <button onMouseDown={e => { e.stopPropagation(); onClose(); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: '2px', display: 'flex', alignItems: 'center' }}>
          <X size={12} />
        </button>
      </div>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div role="radiogroup" aria-label="Cinemàtica" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {options.map(o => {
            const on = o.id === style, off = o.id !== 'classic' && !packOk;
            return (
              <button key={o.id} role="radio" aria-checked={on} disabled={off}
                title={off ? 'Els sprites encara s\'estan carregant' : o.hint}
                onMouseDown={e => { e.stopPropagation(); if (!off) setStored(o.id); }}
                style={{
                  padding: '5px 7px', textAlign: 'left', fontSize: FS.sm, fontWeight: on ? 700 : 500,
                  borderRadius: RADIUS.sm, cursor: off ? 'default' : 'pointer',
                  border: `1px solid ${on ? C.accent : C.border}`,
                  background: on ? tint(C.accent, 0.14) : 'rgba(255,255,255,0.03)',
                  color: off ? tint(C.dim, 0.5) : on ? C.accent : C.text,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                {o.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: FS.xs, color: C.dim, lineHeight: 1.35, minHeight: 14 }}>
          {hint}{!packOk && ' · Carregant els sprites…'}
        </div>
        <SceneImgPicker
          defaultCanvas={defaultImg}
          onPreview={imgEl => {
            void onLaunchBossIntro({ tokenId: sceneConfigMenu.id, bossName: _scName, portrait: imgEl, tokenPos: sceneConfigMenu.tokenPos, style, preview: true });
          }}
          onTrigger={(imgEl, isCustom) => {
            onClose();
            void onLaunchBossIntro({ tokenId: sceneConfigMenu.id, bossName: _scName, portrait: imgEl, tokenPos: sceneConfigMenu.tokenPos, style }).then(url => {
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
