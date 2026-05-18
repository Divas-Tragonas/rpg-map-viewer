'use client';
import React, { useState } from 'react';
import { Eye, EyeOff, Shield, Move, RotateCcw, Trash2 } from '@/components/icons';
import { C } from '@/constants';
import type { PSDLayer } from '@/types';

interface LayerRowProps {
  layer: PSDLayer;
  visible?: boolean;
  onToggle?: () => void;
  locked?: boolean;
  color: string;
  indent?: boolean;
  indent2?: boolean;
  draggable?: boolean;
  active?: boolean;
  onReset?: () => void;
  onDelete?: () => void;
  onSelect?: () => void;
  selected?: boolean;
  defeated?: boolean;
}

export function LayerRow({ layer, visible, onToggle, locked, color, indent, indent2, draggable: isDrag, active, onReset, onDelete, onSelect, selected, defeated }: LayerRowProps) {
  const [hover, setHover] = useState(false);
  const pl = indent2 ? 44 : indent ? 28 : 20;
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 5, paddingLeft: pl, paddingRight: 8, paddingTop: 4, paddingBottom: 4, background: selected ? 'rgba(100,210,255,.10)' : active ? 'rgba(248,81,73,.07)' : hover ? 'rgba(255,255,255,.025)' : 'transparent', opacity: !locked && visible === false ? 0.4 : 1, cursor: onSelect ? 'pointer' : 'default' }}
      onClick={onSelect} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {locked
        ? <Shield size={11} color={C.dim} />
        : <button onClick={onToggle} style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: visible ? color : C.dim, display: 'flex', flexShrink: 0 }}>{visible ? <Eye size={12} /> : <EyeOff size={12} />}</button>
      }
      {isDrag && <Move size={10} color={active ? C.enemy : C.dim} style={{ flexShrink: 0 }} />}
      <span style={{ flex: 1, fontSize: 13, color: defeated ? C.dim : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: defeated ? 'line-through' : 'none' }}>{layer.name}</span>
      {onReset && hover && (
        <button onClick={onReset} title="Reset posición" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: 1, display: 'flex', flexShrink: 0 }}>
          <RotateCcw size={10} />
        </button>
      )}
      {onDelete && hover && (
        <button onClick={e => { e.stopPropagation(); onDelete!(); }} title="Eliminar capa" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(248,81,73,0.6)', padding: 1, display: 'flex', flexShrink: 0 }}>
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
}
