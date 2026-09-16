'use client';
import React, { useEffect } from 'react';
import { C } from '@/constants';
import type { Notice } from '@/types';

const STYLE: Record<Notice['kind'], { bg: string; border: string; fg: string; icon: string }> = {
  error: { bg: '#2a1215', border: C.enemy, fg: '#ffd7d5', icon: '⛔' },
  warn:  { bg: '#2a2213', border: C.warn,  fg: '#f8e3a1', icon: '⚠️' },
  info:  { bg: '#12202a', border: C.room,  fg: '#cfe6ff', icon: 'ℹ️' },
};

/** Quant dura un avís a la pantalla. Un error no marxa sol: si no, es perd justament el
 *  missatge que explica per què no s'ha carregat res. */
const AUTO_HIDE_MS: Record<Notice['kind'], number | null> = { error: null, warn: 9000, info: 5000 };

function NoticeRow({ notice, onClose }: { notice: Notice; onClose: (id: number) => void }) {
  const st = STYLE[notice.kind];
  useEffect(() => {
    const ms = AUTO_HIDE_MS[notice.kind];
    if (ms === null) return;
    const t = setTimeout(() => onClose(notice.id), ms);
    return () => clearTimeout(t);
  }, [notice.id, notice.kind, onClose]);

  return (
    <div
      role={notice.kind === 'error' ? 'alert' : 'status'}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: st.bg, border: `1px solid ${st.border}`, borderRadius: 8,
        padding: '10px 12px', color: st.fg, fontSize: 12.5, lineHeight: 1.45,
        boxShadow: '0 6px 20px rgba(0,0,0,.45)', pointerEvents: 'auto',
        maxWidth: 520, animation: 'noticeIn .18s ease-out',
      }}
    >
      <span aria-hidden style={{ fontSize: 14, lineHeight: 1.2 }}>{st.icon}</span>
      <span style={{ flex: 1 }}>{notice.text}</span>
      <button
        onClick={() => onClose(notice.id)}
        aria-label="Tancar l'avís"
        title="Tancar"
        style={{
          background: 'none', border: 'none', color: st.fg, opacity: .65,
          cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0, marginLeft: 2,
        }}
      >×</button>
    </div>
  );
}

/**
 * Pila d'avisos del DM, a dalt al centre del canvas. Fins ara els fracassos de càrrega
 * (fons il·legible, partida corrupta, desat automàtic sense espai) només deixaven rastre
 * a la consola i des de fora es veien com "no passa res".
 */
export function NoticeStack({ notices, onClose }: { notices: Notice[]; onClose: (id: number) => void }) {
  if (notices.length === 0) return null;
  return (
    <div
      aria-live="polite"
      style={{
        position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
        zIndex: 60, display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none', width: 'max-content', maxWidth: 'min(90%, 520px)',
      }}
    >
      <style>{'@keyframes noticeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}'}</style>
      {notices.map(n => <NoticeRow key={n.id} notice={n} onClose={onClose} />)}
    </div>
  );
}
