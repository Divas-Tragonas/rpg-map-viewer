'use client';
import React, { useEffect } from 'react';
import { C, FS, RADIUS, SHADOW, tint } from '@/constants';
import { AlertTriangle, BanIcon, InfoIcon, X } from '@/components/icons';
import type { Notice } from '@/types';

// Icones vectorials, no emojis (a Windows surten com a glifs negres sobre el fons fosc).
const STYLE: Record<Notice['kind'], { color: string; Icon: typeof X }> = {
  error: { color: C.enemy, Icon: BanIcon },
  warn:  { color: C.warn,  Icon: AlertTriangle },
  info:  { color: C.room,  Icon: InfoIcon },
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
        background: C.panel, border: `1px solid ${tint(st.color, 0.6)}`, borderRadius: RADIUS.md,
        padding: '10px 12px', color: C.bright, fontSize: FS.md, lineHeight: 1.45,
        boxShadow: SHADOW.menu, pointerEvents: 'auto',
        maxWidth: 520, animation: 'noticeIn .18s ease-out',
      }}
    >
      <st.Icon size={15} color={st.color} style={{ flexShrink: 0, marginTop: 1 }} />
      <span style={{ flex: 1 }}>{notice.text}</span>
      <button
        onClick={() => onClose(notice.id)}
        aria-label="Tancar l'avís"
        title="Tancar"
        style={{
          background: 'none', border: 'none', color: C.dim, display: 'flex',
          cursor: 'pointer', padding: 0, marginLeft: 2,
        }}
      ><X size={14} /></button>
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
