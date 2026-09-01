'use client';
import React from 'react';
import type { TurnBanner as BannerData } from '@/lib/turn-banner';

/**
 * Rètol de torn de les pantalles de jugador: de qui és el torn i quants peus li queden.
 *
 * Està dimensionat per llegir-se **des del sofà**, no des del teclat: aquesta pantalla es
 * mira des d'una TV a uns metres i des d'una tablet. Per això el número de peus és el
 * element més gran de tot i la barra de sota permet veure d'una ullada quant en queda
 * sense haver de llegir cap xifra.
 */
export function TurnBanner({ data }: { data: BannerData }) {
  if (!data.active) return null;
  const hasFeet = data.remainingFt >= 0 && data.totalFt > 0;
  const pct = hasFeet ? Math.max(0, Math.min(1, data.remainingFt / data.totalFt)) : 0;
  const low = hasFeet && data.remainingFt <= 5;
  const feetColor = data.blockedBy ? '#f85149' : low ? '#e3b341' : '#fff';

  return (
    <div
      style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        zIndex: 20, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', gap: 22,
        padding: '14px 30px 16px',
        borderRadius: '0 0 18px 18px',
        background: 'linear-gradient(180deg, rgba(8,10,14,0.95) 0%, rgba(8,10,14,0.82) 100%)',
        borderBottom: `3px solid ${data.color}`,
        boxShadow: '0 8px 34px rgba(0,0,0,0.6)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '92vw',
      }}
    >
      {/* Ronda */}
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.18em', color: '#8b949e', fontWeight: 700 }}>RONDA</div>
        <div style={{ fontSize: 30, lineHeight: 1, color: '#e6edf3', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          {data.round}
        </div>
      </div>

      <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.14)' }} />

      {/* Qui té el torn */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div style={{
          width: 58, height: 58, borderRadius: '50%', flexShrink: 0,
          background: data.img ? `#000 center/cover url(${data.img})` : data.color,
          border: `3px solid ${data.color}`,
          boxShadow: `0 0 20px ${data.color}88`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 22, fontWeight: 800,
        }}>
          {!data.img && data.name.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.16em', color: '#8b949e', fontWeight: 700 }}>ÉS EL TORN DE</div>
          <div style={{
            fontSize: 34, lineHeight: 1.1, color: '#fff', fontWeight: 800, letterSpacing: '-0.01em',
            maxWidth: '38vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {data.name}
          </div>
        </div>
      </div>

      {/* Peus restants — l'element més gran del rètol */}
      {(hasFeet || data.blockedBy) && (
        <>
          <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.14)' }} />
          <div style={{ flexShrink: 0, minWidth: 168 }}>
            {data.blockedBy ? (
              <>
                <div style={{ fontSize: 11, letterSpacing: '0.16em', color: '#f85149', fontWeight: 700 }}>NO ES POT MOURE</div>
                <div style={{ fontSize: 30, lineHeight: 1.15, color: '#f85149', fontWeight: 800 }}>{data.blockedBy}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, letterSpacing: '0.16em', color: '#8b949e', fontWeight: 700 }}>MOVIMENT</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <span style={{ fontSize: 52, lineHeight: 1, color: feetColor, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                    {data.remainingFt}
                  </span>
                  <span style={{ fontSize: 18, color: '#8b949e', fontWeight: 700 }}>/ {data.totalFt} ft</span>
                </div>
                <div style={{ marginTop: 7, height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct * 100}%`, height: '100%', borderRadius: 4,
                    background: low ? '#e3b341' : data.color,
                    transition: 'width 0.35s ease',
                  }} />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
