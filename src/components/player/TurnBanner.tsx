'use client';
import React from 'react';
import type { TurnBanner as BannerData } from '@/lib/turn-banner';
import { creatureThumb } from '@/lib/sprites/draw';
import { useSpritePack } from '@/hooks/useSpritePack';

/** Amplada de finestra a la qual el rètol té exactament la mida de disseny. */
const DESIGN_W = 1550;

/**
 * Mida proporcional a l'amplada de la finestra: `px` és la mida a `DESIGN_W`.
 *
 * El rètol es mira des d'una TV gran i des d'una tablet, i amb píxels fixos el que es
 * llegia bé al televisor es menjava mitja pantalla petita. Amb `clamp` creix i s'encongeix
 * amb la finestra, però amb terra i sostre: ni desapareix en un mòbil ni es fa gegant en
 * un monitor 4K.
 */
const s = (px: number, min = 0.42, max = 1.12) =>
  `clamp(${(px * min).toFixed(1)}px, ${((px / DESIGN_W) * 100).toFixed(3)}vw, ${(px * max).toFixed(1)}px)`;

/**
 * Rètol de torn de les pantalles de jugador: de qui és el torn i quants peus li queden.
 *
 * Està dimensionat per llegir-se **des del sofà**, no des del teclat: aquesta pantalla es
 * mira des d'una TV a uns metres i des d'una tablet. Per això el número de peus és
 * l'element més gran de tot i la barra de sota permet veure d'una ullada quant en queda
 * sense haver de llegir cap xifra.
 */
export function TurnBanner({ data, pixel }: { data: BannerData; pixel?: boolean }) {
  // Es re-renderitza quan arriba el paquet de sprites (la figureta del rètol en surt).
  useSpritePack();
  if (!data.active) return null;
  if (pixel) return <PixelTurnBanner data={data} />;
  const hasFeet = data.remainingFt >= 0 && data.totalFt > 0;
  const pct = hasFeet ? Math.max(0, Math.min(1, data.remainingFt / data.totalFt)) : 0;
  const low = hasFeet && data.remainingFt <= 5;
  const feetColor = data.blockedBy ? '#f85149' : low ? '#e3b341' : '#fff';
  const label: React.CSSProperties = {
    fontSize: s(11, 0.64, 1.1), letterSpacing: '0.16em', color: '#8b949e', fontWeight: 700, whiteSpace: 'nowrap',
  };
  const divider = <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.14)' }} />;

  return (
    <div
      style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        zIndex: 20, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', gap: s(22),
        padding: `${s(14)} ${s(30)} ${s(16)}`,
        borderRadius: `0 0 ${s(18)} ${s(18)}`,
        background: 'linear-gradient(180deg, rgba(8,10,14,0.95) 0%, rgba(8,10,14,0.82) 100%)',
        borderBottom: `${s(3, 0.66, 1)} solid ${data.color}`,
        boxShadow: '0 8px 34px rgba(0,0,0,0.6)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '96vw',
      }}
    >
      {/* Ronda */}
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={label}>RONDA</div>
        <div style={{ fontSize: s(30), lineHeight: 1, color: '#e6edf3', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          {data.round}
        </div>
      </div>

      {divider}

      {/* Qui té el torn */}
      <div style={{ display: 'flex', alignItems: 'center', gap: s(14), minWidth: 0 }}>
        <div style={{
          width: s(58), height: s(58), borderRadius: '50%', flexShrink: 0,
          background: data.img ? `#000 center/cover url(${data.img})` : data.color,
          border: `${s(3, 0.66, 1)} solid ${data.color}`,
          boxShadow: `0 0 20px ${data.color}88`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: s(22), fontWeight: 800,
        }}>
          {!data.img && data.name.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={label}>ÉS EL TORN DE</div>
          <div style={{
            fontSize: s(34), lineHeight: 1.1, color: '#fff', fontWeight: 800, letterSpacing: '-0.01em',
            maxWidth: '34vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {data.name}
          </div>
        </div>
      </div>

      {/* Peus restants — l'element més gran del rètol */}
      {(hasFeet || data.blockedBy) && (
        <>
          {divider}
          <div style={{ flexShrink: 0, minWidth: s(168) }}>
            {data.blockedBy ? (
              <>
                <div style={{ ...label, color: '#f85149' }}>NO ES POT MOURE</div>
                <div style={{ fontSize: s(30), lineHeight: 1.15, color: '#f85149', fontWeight: 800, whiteSpace: 'nowrap' }}>
                  {data.blockedBy}
                </div>
              </>
            ) : (
              <>
                <div style={label}>MOVIMENT</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: s(7) }}>
                  <span style={{ fontSize: s(52), lineHeight: 1, color: feetColor, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                    {data.remainingFt}
                  </span>
                  <span style={{ fontSize: s(18), color: '#8b949e', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    / {data.totalFt} ft
                  </span>
                </div>
                <div style={{ marginTop: s(7), height: s(7, 0.6, 1.1), borderRadius: 4, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
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

// ── App Píxel ───────────────────────────────────────────────────────────────
// Mateix contingut i mateixes mides proporcionals (`s()`), amb l'estètica dels jocs de
// pixel art: vores esglaonades (ombres sense desenfocar), lletra monoespaiada, el retrat o
// la figureta del token sense suavitzar i els peus com a blocs de 5 ft.
const PX_BG = '#1b1712', PX_EDGE = '#5a4630', PX_LIGHT = '#8a6c45', PX_TEXT = '#f3e7c9', PX_DIM = '#b49b72';
const pxBorder = (c: string) => `0 0 0 ${s(3, 0.66, 1)} ${c}, 0 0 0 ${s(6, 0.66, 1)} #000`;
const PX_FONT = "'Courier New', ui-monospace, monospace";

function PixelTurnBanner({ data }: { data: BannerData }) {
  const hasFeet = data.remainingFt >= 0 && data.totalFt > 0;
  const blocks = hasFeet ? Math.min(24, Math.round(data.totalFt / 5)) : 0;
  const full = hasFeet ? Math.round(data.remainingFt / 5) : 0;
  const thumb = !data.img && data.sprite ? creatureThumb(data.sprite) : null;
  const avatar = data.img ?? thumb;
  const label: React.CSSProperties = { fontSize: s(12, 0.64, 1.1), letterSpacing: '0.12em', color: PX_DIM, fontWeight: 700, whiteSpace: 'nowrap' };
  return (
    <div style={{
      position: 'absolute', top: s(14), left: '50%', transform: 'translateX(-50%)', zIndex: 20, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: s(20), padding: `${s(12)} ${s(24)}`,
      background: PX_BG, boxShadow: pxBorder(PX_EDGE), fontFamily: PX_FONT, maxWidth: '94vw',
      outline: `${s(2, 0.66, 1)} solid ${PX_LIGHT}`, outlineOffset: `-${s(5, 0.66, 1)}`,
    }}>
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={label}>RONDA</div>
        <div style={{ fontSize: s(32), lineHeight: 1, color: PX_TEXT, fontWeight: 800 }}>{data.round}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: s(14), minWidth: 0 }}>
        <div style={{
          width: s(64), height: s(64), flexShrink: 0, background: '#000', boxShadow: pxBorder(data.color),
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: PX_TEXT, fontSize: s(22), fontWeight: 800,
        }}>
          {avatar
            ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }} />
            : data.name.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={label}>ÉS EL TORN DE</div>
          <div style={{ fontSize: s(32), lineHeight: 1.1, color: PX_TEXT, fontWeight: 800, maxWidth: '34vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: `${s(2, 0.6, 1)} ${s(2, 0.6, 1)} 0 #000` }}>
            {data.name.toUpperCase()}
          </div>
        </div>
      </div>
      {(hasFeet || data.blockedBy) && (
        <div style={{ flexShrink: 0, minWidth: s(170) }}>
          {data.blockedBy ? (
            <>
              <div style={{ ...label, color: '#ff6b5e' }}>NO ES POT MOURE</div>
              <div style={{ fontSize: s(28), color: '#ff6b5e', fontWeight: 800, whiteSpace: 'nowrap' }}>{data.blockedBy.toUpperCase()}</div>
            </>
          ) : (
            <>
              <div style={label}>MOVIMENT</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: s(6) }}>
                <span style={{ fontSize: s(48), lineHeight: 1, color: data.remainingFt <= 5 ? '#ffd257' : PX_TEXT, fontWeight: 800 }}>{data.remainingFt}</span>
                <span style={{ fontSize: s(18), color: PX_DIM, fontWeight: 700 }}>/ {data.totalFt} FT</span>
              </div>
              <div style={{ display: 'flex', gap: s(3, 0.6, 1), marginTop: s(6) }}>
                {Array.from({ length: blocks }, (_, i) => (
                  <div key={i} style={{ width: s(9, 0.6, 1.1), height: s(12, 0.6, 1.1), background: i < full ? data.color : '#3a3026', boxShadow: `inset 0 -${s(3, 0.6, 1)} 0 rgba(0,0,0,.35)` }} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
