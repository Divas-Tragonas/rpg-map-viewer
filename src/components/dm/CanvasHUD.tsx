'use client';
import React from 'react';
import { Eye, RotateCcw, LockIcon, UnlockIcon, TargetIcon } from '@/components/icons';
import { C } from '@/constants';
import type { MapStructure, VisMap } from '@/types';

interface Props {
  dmPrivateActive: boolean;
  struct: MapStructure | null; vis: VisMap;
  roomsLocked: boolean; enemyHighlight: boolean; highlightLocked: boolean;
  gridCalibrating: boolean;
  onResetView: () => void;
  onResetPrivate: () => void;
  onToggleRoomsLocked: () => void;
  onToggleEnemyHighlight: () => void;
  onToggleHighlightLocked: () => void;
}

export function CanvasHUD({ dmPrivateActive, struct, vis, roomsLocked, enemyHighlight, highlightLocked, gridCalibrating, onResetView, onResetPrivate, onToggleRoomsLocked, onToggleEnemyHighlight, onToggleHighlightLocked }: Props) {
  return (
    <>
      {gridCalibrating && (
        <div style={{ position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)', zIndex: 20, pointerEvents: 'none', background: 'rgba(10,13,18,0.90)', border: `1px solid ${C.accent}`, borderRadius: 7, padding: '6px 14px', fontSize: 11, color: C.accent, fontWeight: 600, letterSpacing: '0.04em', whiteSpace: 'nowrap', boxShadow: `0 0 12px ${C.accent}44` }}>
          🎯 Arrastra sobre el mapa para definir una celda del grid
        </div>
      )}
      <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, alignItems: 'center', pointerEvents: 'auto', zIndex: 10 }}>
        {dmPrivateActive && (
          <button onClick={onResetPrivate} title="Vista privada DM activa — pulsa para volver a la vista compartida"
            style={{ background: 'rgba(88,166,255,.18)', border: '1px solid #58a6ff', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: '#58a6ff', display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, animation: 'pulse 1.5s infinite' }}>
            <Eye size={11} /> Vista DM
          </button>
        )}
        {struct && struct.roomLayers.some(l => !vis[l.id]) && (
          <button onClick={onToggleRoomsLocked} title={roomsLocked ? 'Zonas bloqueadas' : 'Modo desbloqueado'}
            style={{ background: roomsLocked ? 'rgba(10,13,18,.92)' : `rgba(212,160,23,.18)`, border: `1px solid ${roomsLocked ? C.border : C.accent}`, borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: roomsLocked ? C.dim : C.accent, display: 'flex', alignItems: 'center', gap: 5, boxShadow: roomsLocked ? 'none' : `0 0 8px ${C.accent}55`, transition: 'all 0.2s' }}>
            {roomsLocked ? <LockIcon size={11} /> : <UnlockIcon size={11} />}
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.05em' }}>{roomsLocked ? 'Zonas' : 'Desbloqueo'}</span>
          </button>
        )}
        <div style={{ background: 'rgba(10,13,18,.92)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 11px', fontSize: 11, color: C.dim }}>
          <span style={{ color: C.accent, fontWeight: 700 }}>DM</span>
        </div>
        <button onClick={onResetView} title="Reset zoom y posición"
          style={{ background: 'rgba(10,13,18,.92)', border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 7px', cursor: 'pointer', color: C.dim, display: 'flex' }}>
          <RotateCcw size={11} />
        </button>
        {struct && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button onClick={onToggleEnemyHighlight}
              title={`Resaltar enemigos${highlightLocked ? ' (bloqueado ∞)' : ' (3.5s)'}`}
              style={{ background: enemyHighlight ? `${C.enemyHL}2e` : 'rgba(10,13,18,.92)', border: enemyHighlight ? `1px solid ${C.enemyHL}` : `1px solid ${C.border}`, borderRadius: '6px 0 0 6px', padding: '5px 8px', cursor: 'pointer', color: enemyHighlight ? C.enemyHL : C.dim, display: 'flex', alignItems: 'center', gap: 4, boxShadow: enemyHighlight ? `0 0 10px ${C.enemyHL}40` : 'none', transition: 'all 0.2s' }}>
              <TargetIcon size={11} />
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}>Resaltar</span>
            </button>
            <button onClick={onToggleHighlightLocked}
              title={highlightLocked ? 'Bloqueado permanente' : 'Timer 3.5s'}
              style={{ background: highlightLocked ? `${C.enemyHL}2e` : 'rgba(10,13,18,.92)', border: highlightLocked ? `1px solid ${C.enemyHL}` : `1px solid ${C.border}`, borderLeft: 'none', borderRadius: '0 6px 6px 0', padding: '5px 6px', cursor: 'pointer', color: highlightLocked ? C.enemyHL : C.dim, display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}>
              {highlightLocked ? <LockIcon size={10} /> : <UnlockIcon size={10} />}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
