'use client';
import React from 'react';
import { SPELL_TYPES } from '@/constants';
import type { SpellMenuState } from '@/types';

interface Props {
  spellMenu: SpellMenuState | null;
  onClose: () => void;
  onAddSpell: (type: string) => void;
}

const MODE_LABEL: Record<string, string> = {
  path: 'Elige hechizo',
  line: 'Hechizo direccional',
  area: 'Hechizo de área',
};

export function SpellMenuOverlay({ spellMenu, onClose, onAddSpell }: Props) {
  if (!spellMenu) return null;
  const modeFilter = spellMenu.mode ?? 'path';
  const filtered = SPELL_TYPES.filter(s => (s.mode ?? 'path') === modeFilter);
  return (
    <div onMouseDown={e => e.stopPropagation()} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={onClose}>
      <div style={{ position: 'fixed', left: spellMenu.cx, top: spellMenu.cy, transform: 'translate(-50%,-50%)', background: 'rgba(10,13,18,0.92)', border: '1px solid rgba(255,210,0,0.5)', borderRadius: 20, padding: '4px 10px', color: '#ffd200', fontSize: 10, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 2 }}>{MODE_LABEL[modeFilter] ?? 'Elige hechizo'}</div>
      {filtered.map(({ type, emoji, color, title }, i, arr) => {
        const angle = (i / arr.length) * Math.PI * 2 - Math.PI / 2;
        const R = arr.length <= 3 ? 68 : 80;
        return (
          <div key={type} title={title}
            onMouseDown={e => { e.stopPropagation(); onAddSpell(type); }}
            style={{ position: 'fixed', left: spellMenu.cx + Math.cos(angle) * R - 18, top: spellMenu.cy + Math.sin(angle) * R - 18, width: 36, height: 36, borderRadius: '50%', border: `2px solid ${color}`, background: `${color}22`, cursor: 'pointer', boxShadow: `0 0 8px ${color}88`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, userSelect: 'none', pointerEvents: 'auto' }}>
            {emoji}
          </div>
        );
      })}
    </div>
  );
}
