'use client';
import React from 'react';
import { C, FS, RADIUS } from '@/constants';

/**
 * Guia de tirada (v5.43): els passos que cal tirar a la taula, numerats i curts, a dalt dels pop-ups
 * de dany i de conjurs. Les línies buides no surten. `note` = línies petites sense número (crític…).
 */
export function RollGuide({ steps, notes = [] }: { steps: (string | null | undefined | false)[]; notes?: (string | null | undefined | false)[] }) {
  const s = steps.filter((x): x is string => !!x);
  const n = notes.filter((x): x is string => !!x);
  if (!s.length && !n.length) return null;
  return (
    <div style={{ background: C.dark, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {s.map((t, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, fontSize: FS.sm, color: C.text, lineHeight: 1.3 }}>
          <span style={{ flexShrink: 0, width: 14, height: 14, borderRadius: 7, background: C.border, color: C.bright, fontSize: FS.xs, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{i + 1}</span>
          <span>{t}</span>
        </div>
      ))}
      {n.map((t, i) => <div key={`n${i}`} style={{ fontSize: FS.xs, color: C.dim, marginLeft: 20 }}>{t}</div>)}
    </div>
  );
}
