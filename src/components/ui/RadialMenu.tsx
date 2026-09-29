'use client';
import React, { useEffect, useState } from 'react';
import { C, FS, tint } from '@/constants';

export interface RadialItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  /** Línia de detall que surt al centre en passar-hi el cursor (p. ex. radi i abast). */
  detail?: string;
}

interface Props {
  /** Centre de la roda en coordenades de pantalla (es recol·loca perquè no surti de la finestra). */
  x: number;
  y: number;
  /** Què s'està triant (surt al centre mentre no hi ha cap opció sota el cursor). */
  title: string;
  subtitle?: string;
  items: RadialItem[];
  onPick: (id: string) => void;
  onClose: () => void;
}

const SIZE = 264;
const C0 = SIZE / 2;
const OUTER_R = 116;
const OUTER_R_HOV = 122;
const INNER_R = 50;
const HUB_R = 45;
const GAP_DEG = 2.5;

function sectorPath(outerR: number, innerR: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => `${C0 + r * Math.cos(a)} ${C0 + r * Math.sin(a)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p(outerR, a0)} A${outerR} ${outerR} 0 ${large} 1 ${p(outerR, a1)} L${p(innerR, a1)} A${innerR} ${innerR} 0 ${large} 0 ${p(innerR, a0)}Z`;
}

/**
 * Roda de selecció (pie menu) única de l'app: la fan servir les màgies (trajectòria,
 * direccional i àrea) i les zones màgiques. Abans eren dos menús diferents —un anell
 * transparent amb només emojis i el nom a 8 px, i uns botons rodons amb degradat on el ✕
 * tapava el títol— i, segons el gest, la mateixa eina obria l'un o l'altre.
 *
 * - Fons opac: el mapa no es veu a través de les opcions.
 * - Cada sector porta icona **i nom**; el centre diu què s'està triant i, en passar el
 *   cursor per una opció, el seu nom complet i el detall.
 * - Teclat: 1…N trien, Esc tanca. Mentre la roda és oberta, les xifres NO canvien d'eina.
 * - Clic fora o al centre: tanca.
 */
export function RadialMenu({ x, y, title, subtitle, items, onPick, onClose }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const N = items.length;

  // Teclat en fase de captura: que l'1…9 i l'Esc de la roda no arribin a les dreceres
  // globals (canviarien d'eina o tornarien a l'eina de selecció).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); onClose(); return; }
      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault(); e.stopImmediatePropagation();
        const i = parseInt(e.key, 10) - 1;
        if (i < N) onPick(items[i].id);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [N, items, onPick, onClose]);

  if (N === 0) return null;

  // Que la roda sencera quedi dins de la finestra encara que el gest acabi a la vora.
  const m = C0 + 4;
  const cx = Math.max(m, Math.min(x, window.innerWidth - m));
  const cy = Math.max(m, Math.min(y, window.innerHeight - m));

  const gap = (GAP_DEG * Math.PI) / 180;
  const step = (Math.PI * 2) / N;
  const hov = hovered !== null ? items[hovered] : null;
  // Detall de l'opció sota el cursor; si no en té, la tecla que la tria (així es descobreix el teclat).
  const hovDetail = hov ? (hov.detail ?? `Tecla ${(hovered ?? 0) + 1}`) : null;

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      onClick={onClose}
      onContextMenu={e => { e.preventDefault(); onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9998 }}>
      <svg width={SIZE} height={SIZE}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', left: cx - C0, top: cy - C0, overflow: 'visible',
          pointerEvents: 'none', animation: 'radialIn .14s ease-out',
          filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.6))',
          fontFamily: 'system-ui, sans-serif',
        }}>
        {/* Fons de l'anell (opac) */}
        <circle cx={C0} cy={C0} r={(OUTER_R + INNER_R) / 2} fill="none"
          stroke={C.panel} strokeWidth={OUTER_R - INNER_R} opacity={0.97} />

        {items.map((it, i) => {
          // El primer sector queda centrat a dalt; la resta en sentit horari.
          const a0 = -Math.PI / 2 - step / 2 + i * step + gap / 2;
          const a1 = a0 + step - gap;
          const mid = (a0 + a1) / 2;
          const isHov = hovered === i;
          const oR = isHov ? OUTER_R_HOV : OUTER_R;
          const r = (OUTER_R + INNER_R) / 2 + 2;
          const tx = C0 + r * Math.cos(mid), ty = C0 + r * Math.sin(mid);
          return (
            <g key={it.id}
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(h => (h === i ? null : h))}
              onClick={e => { e.stopPropagation(); onPick(it.id); }}>
              <path d={sectorPath(oR, INNER_R, a0, a1)}
                fill={tint(it.color, isHov ? 0.3 : 0.1)}
                stroke={isHov ? it.color : tint(it.color, 0.5)} strokeWidth={isHov ? 2 : 1.25}
                style={{ transition: 'fill .12s, stroke .12s', filter: isHov ? `drop-shadow(0 0 8px ${tint(it.color, 0.6)})` : 'none' }} />
              <text x={tx} y={ty - 7} textAnchor="middle" dominantBaseline="middle" fontSize={isHov ? 25 : 22}
                style={{ pointerEvents: 'none', userSelect: 'none', transition: 'font-size .12s' }}>
                {it.icon}
              </text>
              <text x={tx} y={ty + 16} textAnchor="middle" dominantBaseline="middle"
                fontSize={FS.xs} fontWeight={isHov ? 700 : 600} fill={isHov ? C.bright : C.text}
                style={{ pointerEvents: 'none', userSelect: 'none' }}>
                {it.label}
              </text>
            </g>
          );
        })}

        {/* Centre: què es tria / opció sota el cursor. Clic = tancar. */}
        <g style={{ pointerEvents: 'auto', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); onClose(); }}>
          <title>Tancar (Esc)</title>
          <circle cx={C0} cy={C0} r={HUB_R} fill={C.bg} stroke={hov ? hov.color : C.border} strokeWidth={1.5} />
          {hov ? (
            <>
              {/* El detall es parteix per « · » perquè una línia llarga no surti del cercle. */}
              {(() => {
                const lines = (hovDetail ?? '').split(' · ');
                const top = C0 - 7 - (lines.length - 1) * 6;
                return (
                  <>
                    <text x={C0} y={top} textAnchor="middle" dominantBaseline="middle"
                      fontSize={FS.sm} fontWeight={700} fill={hov.color}>
                      {hov.label}
                    </text>
                    {lines.map((ln, k) => (
                      <text key={k} x={C0} y={top + 16 + k * 12} textAnchor="middle" dominantBaseline="middle" fontSize={FS.xs} fill={C.dim}>
                        {ln}
                      </text>
                    ))}
                  </>
                );
              })()}
            </>
          ) : (
            <>
              <text x={C0} y={C0 - 12} textAnchor="middle" dominantBaseline="middle"
                fontSize={FS.sm} fontWeight={700} fill={C.bright} letterSpacing="0.02em">
                {title}
              </text>
              {subtitle && (
                <text x={C0} y={C0 + 3} textAnchor="middle" dominantBaseline="middle" fontSize={FS.xs} fill={C.dim}>
                  {subtitle}
                </text>
              )}
              <text x={C0} y={C0 + 21} textAnchor="middle" dominantBaseline="middle" fontSize={FS.xs} fill={tint(C.dim, 0.75)}>
                {N > 1 ? `1–${N}` : '1'} · Esc
              </text>
            </>
          )}
        </g>
      </svg>
      <style>{'@keyframes radialIn{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}'}</style>
    </div>
  );
}
