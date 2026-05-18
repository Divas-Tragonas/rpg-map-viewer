'use client';
import React from 'react';
import { Upload } from '@/components/icons';
import { C } from '@/constants';

interface DropZoneProps {
  accept: string;
  label: string;
  sub: string;
  active: boolean;
  color: string;
  onFile: (file: File) => void;
  onDrop: (e: React.DragEvent) => void;
  disabled?: boolean;
}

export function DropZone({ accept, label, sub, active, color, onFile, onDrop, disabled }: DropZoneProps) {
  return (
    <label
      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', borderRadius: 5, cursor: disabled ? 'wait' : 'pointer', border: `1px dashed ${active ? color : C.border}`, background: active ? `${color}10` : 'transparent', width: '100%', boxSizing: 'border-box' }}
      onDrop={onDrop} onDragOver={e => e.preventDefault()}>
      <input type="file" accept={accept} style={{ display: 'none' }} disabled={disabled} onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
      <Upload size={12} color={active ? color : C.dim} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ color: active ? color : C.dim, fontWeight: 500, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ color: C.dim, fontSize: 9, marginTop: 1 }}>{sub}</div>
      </div>
    </label>
  );
}
