'use client';
import React, { useEffect, useState } from 'react';
import type { SheetShow } from '@/types';
import { abilityMod, boldParts, signed } from '@/lib/characters';
import { creatureThumb } from '@/lib/sprites/draw';
import { useSpritePack } from '@/hooks/useSpritePack';
import { FONT_SERIF } from '@/constants';

/** Mateixa escala que el rètol de torn: `px` és la mida a 1550 px d'amplada de finestra. */
const DESIGN_W = 1550;
const s = (px: number, min = 0.5, max = 1.15) =>
  `clamp(${(px * min).toFixed(1)}px, ${((px / DESIGN_W) * 100).toFixed(3)}vw, ${(px * max).toFixed(1)}px)`;

const FADE_MS = 350;

/**
 * Fitxa d'un personatge a la pantalla de jugador (TV o tablet): una targeta a la dreta, per
 * sobre del mapa però sense tapar-lo sencer, amb les parts que ha triat el DM. Mides
 * proporcionals a la finestra (com el rètol de torn) i animació només d'opacitat i posició.
 */
export function SheetCard({ sheet }: { sheet: SheetShow | null }) {
  useSpritePack();
  // L'última fitxa es queda muntada mentre s'esvaeix.
  const [last, setLast] = useState<SheetShow | null>(sheet);
  const [shown, setShown] = useState(false);
  if (sheet && sheet !== last) setLast(sheet);
  useEffect(() => {
    if (sheet) { const r = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(r); }
    const t = setTimeout(() => { setShown(false); setLast(null); }, FADE_MS);
    return () => clearTimeout(t);
  }, [sheet]);
  const d = sheet ?? last;
  if (!d) return null;
  const visible = !!sheet && shown;
  const thumb = d.sprite ? creatureThumb(d.sprite) : null;
  const frac = d.xpNext === null ? 1 : Math.max(0, Math.min(1, (d.xp - d.xpFrom) / (d.xpNext - d.xpFrom)));
  const muted = '#9aa4b0';
  return (
    <div aria-live="polite"
      style={{
        position: 'absolute', top: s(84), right: s(18), bottom: s(18), zIndex: 21, pointerEvents: 'none',
        width: s(430), maxWidth: '46vw', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
        opacity: visible ? 1 : 0, transform: `translateX(${visible ? 0 : 24}px)`,
        transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
      }}>
      <div style={{
        maxHeight: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: s(12),
        padding: s(20), borderRadius: s(16), background: 'rgba(8,10,14,0.92)',
        border: `1px solid rgba(255,255,255,0.1)`, borderTop: `${s(4, 0.6, 1)} solid ${d.color}`,
        boxShadow: '0 10px 40px rgba(0,0,0,0.6)', color: '#e6edf3', fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        {/* Capçalera: retrat, nom, classe i nivell */}
        <div style={{ display: 'flex', alignItems: 'center', gap: s(14) }}>
          <div style={{
            width: s(64), height: s(64), borderRadius: s(12), flexShrink: 0, overflow: 'hidden',
            background: d.color, border: `${s(2, 0.6, 1)} solid ${d.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: s(26), fontWeight: 800,
          }}>
            {thumb ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', imageRendering: 'pixelated', background: '#14171c' }} />
              : d.portrait ? <img src={d.portrait} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated' }} />
              : d.name.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: FONT_SERIF, fontSize: s(30), fontWeight: 600, lineHeight: 1.05 }}>{d.name}</div>
            {d.subtitle && <div style={{ fontSize: s(14), color: muted, marginTop: s(3) }}>{d.subtitle}</div>}
          </div>
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: s(11), letterSpacing: '0.16em', color: muted, fontWeight: 700 }}>NIVELL</div>
            <div style={{ fontSize: s(34), fontWeight: 800, lineHeight: 1 }}>{d.level}</div>
          </div>
        </div>

        {/* Experiència */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: s(13), color: muted, marginBottom: s(5) }}>
            <span style={{ letterSpacing: '0.12em', fontWeight: 700 }}>EXPERIÈNCIA</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: '#e6edf3' }}>{d.xp}{d.xpNext !== null && <span style={{ color: muted }}> / {d.xpNext}</span>} XP</span>
          </div>
          <div style={{ height: s(8), borderRadius: s(8), background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div style={{ width: `${frac * 100}%`, height: '100%', background: '#b48cff', transition: 'width 0.6s ease' }} />
          </div>
        </div>

        {/* Estadístiques */}
        <div style={{ display: 'flex', gap: s(8) }}>
          {d.stats.map(st => (
            <div key={st.label} style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: `${s(7)} ${s(4)}`, borderRadius: s(10), background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: s(10), letterSpacing: '0.1em', color: muted, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.label}</div>
              <div style={{ fontSize: s(20), fontWeight: 800, whiteSpace: 'nowrap' }}>{st.value}</div>
            </div>
          ))}
        </div>

        {/* Característiques */}
        {d.abilities.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: s(6) }}>
            {d.abilities.map(a => (
              <div key={a.label} title={a.save ? 'Competència en la tirada de salvació' : undefined}
                style={{ textAlign: 'center', padding: `${s(6)} 0`, borderRadius: s(10), background: 'rgba(255,255,255,0.06)', border: `1px solid ${a.save ? d.color : 'transparent'}` }}>
                <div style={{ fontSize: s(11), letterSpacing: '0.1em', color: muted, fontWeight: 700 }}>{a.label}</div>
                <div style={{ fontSize: s(22), fontWeight: 800, lineHeight: 1.1 }}>{signed(abilityMod(a.score))}</div>
                <div style={{ fontSize: s(12), color: muted }}>{a.score}</div>
              </div>
            ))}
          </div>
        )}

        {/* Seccions de text */}
        {d.sections.map(sec => (
          <div key={sec.title} style={{ minHeight: 0 }}>
            <div style={{ fontSize: s(12), letterSpacing: '0.14em', color: d.color, fontWeight: 800, marginBottom: s(4), textTransform: 'uppercase' }}>{sec.title}</div>
            <div style={{ fontSize: s(15), lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: s(3) }}>
              {sec.text.split('\n').filter(l => l.trim()).map((line, i) => {
                const bullet = line.startsWith('- ');
                return (
                  <div key={i} style={{ display: 'flex', gap: s(6) }}>
                    {bullet && <span style={{ color: d.color }}>•</span>}
                    <span>{boldParts(bullet ? line.slice(2) : line).map((p, j) => p.bold ? <b key={j}>{p.text}</b> : <React.Fragment key={j}>{p.text}</React.Fragment>)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
