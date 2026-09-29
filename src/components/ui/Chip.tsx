'use client';
import React from 'react';
import { C, FS, RADIUS } from '@/constants';

export function Chip({ children, col }: { children: React.ReactNode; col?: string }) {
  const color = col || C.dim;
  return (
    <span style={{ fontSize: FS.sm, color, background: `${color}18`, border: `1px solid ${color}33`, borderRadius: RADIUS.sm, padding: '2px 7px' }}>
      {children}
    </span>
  );
}
