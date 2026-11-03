'use client';
import React from 'react';
import { PresentIcon, ScrollIcon } from '@/components/icons';
import { IconButton } from '@/components/ui/Button';
import { C, RADIUS, SHADOW } from '@/constants';
import { useCompactLayout } from '@/hooks/useCompact';

/** Amplada que ocupa la rail (botó + marges): els panells de la dreta (Història) hi deixen lloc. */
export const RAIL_W = 52;
/** Distància de dalt de l'escenari: sota el zoom i el selector de càmera de `CanvasHUD`. */
export const RAIL_TOP = 56;

/**
 * Rail d'icones a la dreta del mapa: «Mostrar als jugadors» i «Història». Abans eren dos botons
 * amples a la barra superior. Només icones (el nom és al tooltip); un punt verd a Mostrar diu que
 * s'hi està ensenyant alguna cosa. Al mòbil, en horitzontal.
 */
export function RightRail({ showOpen, showActive, onToggleShow, canShow, storyOpen, onToggleStory }: {
  showOpen: boolean; showActive: boolean; onToggleShow: () => void;
  /** «Mostrar» només surt jugant, o a Preparar si hi ha alguna cosa en pantalla (per poder-la amagar). */
  canShow: boolean;
  storyOpen: boolean; onToggleStory: () => void;
}) {
  const compact = useCompactLayout();
  const size = 36;
  return (
    <div role="toolbar" aria-label="Panells" style={{
      position: 'absolute', top: RAIL_TOP, right: 12, zIndex: 14, display: 'flex', flexDirection: compact ? 'row' : 'column', gap: 4, padding: 3,
      background: C.float, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.float,
    }}>
      {canShow && (
        <span style={{ position: 'relative', display: 'flex' }}>
          <IconButton variant="ghost" size={size} active={showOpen} onClick={onToggleShow} aria-pressed={showOpen}
            aria-label="Mostrar als jugadors"
            title="Mostrar als jugadors: imatge, vídeo, text, diàleg o fitxa a pantalla completa">
            <PresentIcon size={17} />
          </IconButton>
          {showActive && <span aria-hidden style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: C.ok, boxShadow: `0 0 6px ${C.ok}`, pointerEvents: 'none' }} />}
        </span>
      )}
      <IconButton variant="ghost" size={size} active={storyOpen} onClick={onToggleStory} aria-pressed={storyOpen}
        aria-label="Història" title="Història: mòdul que es juga, biblioteca de mòduls i diari de la sessió (N: nota ràpida)">
        <ScrollIcon size={17} />
      </IconButton>
    </div>
  );
}
