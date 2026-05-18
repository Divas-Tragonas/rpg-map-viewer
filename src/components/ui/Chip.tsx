'use client';
import React from 'react';
import { C } from '@/constants';

export function Chip({ children, col }: { children: React.ReactNode; col?: string }) {
  const color = col || C.dim;
  return (
    <span style={{ fontSize: 11, color, background: `${color}18`, border: `1px solid ${color}33`, borderRadius: 4, padding: '2px 7px' }}>
      {children}
    </span>
  );
}
