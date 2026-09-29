'use client';
import React, { useState } from 'react';
import { Eye, EyeOff, Shield, Trash2 } from '@/components/icons';
import { C, FS, tint } from '@/constants';
import type { PSDLayer } from '@/types';

interface LayerRowProps {
  layer: PSDLayer;
  /** Ho veuen els jugadors? (l'ull respon sempre a aquesta pregunta, a tota l'app). */
  visible?: boolean;
  onToggle?: () => void;
  locked?: boolean;
  color: string;
  onDelete?: () => void;
}

export function LayerRow({ layer, visible, onToggle, locked, color, onDelete }: LayerRowProps) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: 20, paddingRight: 8, paddingTop: 4, paddingBottom: 4, background: hover ? 'rgba(255,255,255,.025)' : 'transparent', opacity: !locked && visible === false ? 0.45 : 1 }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {locked
        ? <Shield size={11} color={C.dim} />
        : <button onClick={onToggle}
            title={visible ? 'Els jugadors la veuen · clic per amagar-la' : 'Amagada als jugadors · clic per mostrar-la'}
            style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: visible ? color : C.dim, display: 'flex', flexShrink: 0 }}>
            {visible ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
      }
      <span style={{ flex: 1, fontSize: FS.md, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{layer.name}</span>
      {onDelete && hover && (
        <button onClick={e => { e.stopPropagation(); onDelete(); }} title="Eliminar capa" style={{ background: 'none', border: 'none', cursor: 'pointer', color: tint(C.enemy, 0.6), padding: 1, display: 'flex', flexShrink: 0 }}>
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
}
