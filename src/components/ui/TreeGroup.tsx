'use client';
import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from '@/components/icons';
import { C } from '@/constants';

interface TreeGroupProps {
  label: string;
  color: string;
  icon: React.ReactNode;
  note?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function TreeGroup({ label, color, icon, note, children, defaultOpen = true }: TreeGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: `${color}0e`, border: 'none', cursor: 'pointer', color: C.text }}>
        {open ? <ChevronDown size={12} color={C.dim} /> : <ChevronRight size={12} color={C.dim} />}
        {icon}
        <span style={{ flex: 1, fontWeight: 700, color, fontSize: 12, textAlign: 'left' }}>{label}</span>
        {note && <span style={{ fontSize: 10, color: C.dim }}>{note}</span>}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}
