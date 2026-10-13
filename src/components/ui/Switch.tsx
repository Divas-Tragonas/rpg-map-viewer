'use client';
import React from 'react';
import { C, RADIUS } from '@/constants';

/** Interruptor encès/apagat (un `<button role="switch">`, accessible amb el teclat). */
export function Switch({ on, onChange, label, title }: { on: boolean; onChange: () => void; label: string; title?: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} title={title} onClick={onChange}
      style={{ position: 'relative', width: 34, height: 20, flexShrink: 0, borderRadius: RADIUS.pill, border: 'none', background: on ? C.ok : C.border, cursor: 'pointer', transition: 'background .15s' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 17 : 3, width: 14, height: 14, borderRadius: '50%', background: C.bright, transition: 'left .15s' }} />
    </button>
  );
}
