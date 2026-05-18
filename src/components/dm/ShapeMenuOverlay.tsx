'use client';
import React from 'react';
import { ELEMENTS } from '@/constants';
import type { ShapeMenuState } from '@/types';

interface Props {
  shapeMenu: ShapeMenuState | null;
  onClose: () => void;
  onAddZone: (elementId: string) => void;
}

export function ShapeMenuOverlay({ shapeMenu, onClose, onAddZone }: Props) {
  if (!shapeMenu) return null;
  return (
    <div onMouseDown={e => e.stopPropagation()} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={onClose}>
      <div style={{ position: 'absolute', left: shapeMenu.cx, top: shapeMenu.cy, transform: 'translate(-50%,-50%)' }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(10,13,18,0.92)', border: '1px solid #21262d', borderRadius: 20, padding: '4px 10px', color: '#8b949e', fontSize: 10, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 2 }}>
          Elige elemento
        </div>
        {ELEMENTS.map((el, i) => {
          const angle = (i / ELEMENTS.length) * Math.PI * 2 - Math.PI / 2;
          const R = 68;
          return (
            <button key={el.id}
              onClick={e => { e.stopPropagation(); onAddZone(el.id); }}
              style={{ position: 'absolute', left: Math.cos(angle) * R, top: Math.sin(angle) * R, transform: 'translate(-50%,-50%)', width: 50, height: 50, borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, ${el.color}ee, ${el.glow}99)`, border: `2px solid ${el.color}`, boxShadow: `0 0 14px ${el.color}88, 0 2px 8px rgba(0,0,0,0.6)`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translate(-50%,-50%) scale(1.2)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${el.color}, 0 4px 12px rgba(0,0,0,0.7)`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translate(-50%,-50%) scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 14px ${el.color}88, 0 2px 8px rgba(0,0,0,0.6)`; }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{el.emoji}</span>
              <span style={{ fontSize: 8, color: '#fff', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{el.label}</span>
            </button>
          );
        })}
        <button onClick={e => { e.stopPropagation(); onClose(); }}
          style={{ position: 'absolute', left: 0, top: 0, transform: 'translate(-50%,-50%)', width: 32, height: 32, borderRadius: '50%', background: 'rgba(30,30,30,0.9)', border: '1px solid #21262d', cursor: 'pointer', color: '#8b949e', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
          ✕
        </button>
      </div>
    </div>
  );
}
