'use client';
import React, { useEffect, useState } from 'react';
import { C, FS, RADIUS, SHADOW, tint } from '@/constants';
import { ChevronDown, DoorIcon, MapIcon, BackIcon, CheckIcon } from '@/components/icons';
import type { Mission } from '@/lib/missions';
import { VILLAGE, placeOf } from '@/lib/missions';

interface Props {
  mission: Mission;
  current: string;
  busy: boolean;
  onGo: (scene: string) => void;
  /** Lloc que el menú ressalta al mapa (el cercle de la seva porta). */
  onHover: (scene: string | null) => void;
}

const chip: React.CSSProperties = {
  height: 34, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderRadius: RADIUS.lg,
  background: C.float, border: `1px solid ${C.border}`, boxShadow: SHADOW.float, color: C.text,
  fontSize: FS.sm, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
};

/**
 * Llocs de la missió, a dalt a l'esquerra del mapa: on és la colla, i entrar a un altre lloc o
 * tornar al poble (fos a negre a totes les pantalles). Al mapa, les portes tenen una marca:
 * doble clic també hi entra.
 */
export function PlacesMenu({ mission, current, busy, onGo, onHover }: Props) {
  const [open, setOpen] = useState(false);
  const here = placeOf(mission, current);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setOpen(false); onHover(null); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onHover]);
  const go = (id: string) => { setOpen(false); onHover(null); onGo(id); };
  const rows = [{ id: VILLAGE, name: mission.name, text: 'El mapa del poble.', kind: 'poble' as const }, ...(mission.places ?? [])];
  return (
    <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <div style={{ position: 'relative' }}>
        <button style={{ ...chip, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => setOpen(v => !v)}
          title="On és la colla: entrar a un lloc o tornar al poble">
          {here ? <DoorIcon size={14} /> : <MapIcon size={14} />}
          {here ? here.name : mission.name}
          <ChevronDown size={12} style={{ color: C.dim }} />
        </button>
        {open && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 1 }} onClick={() => { setOpen(false); onHover(null); }} />
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 2, width: 330,
              background: C.panel, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.menu,
              padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <div style={{ padding: '6px 8px 4px', fontSize: FS.xs, color: C.dim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Llocs · {mission.name}
              </div>
              {rows.map(p => {
                const on = p.id === current;
                return (
                  <button key={p.id} className="dm-menu-item" disabled={on}
                    onClick={() => go(p.id)}
                    onMouseEnter={() => onHover(p.id === VILLAGE ? null : p.id)} onMouseLeave={() => onHover(null)}
                    style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', padding: '7px 8px', border: 'none',
                      borderRadius: RADIUS.md, background: on ? tint(C.accent, 0.12) : 'transparent', color: C.text, cursor: on ? 'default' : 'pointer',
                    }}>
                    <span style={{ marginTop: 2, color: on ? C.accent : C.dim, display: 'flex' }}>
                      {p.kind === 'poble' ? <MapIcon size={14} /> : <DoorIcon size={14} />}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: FS.md, fontWeight: 700, color: on ? C.accent : C.bright }}>
                        {p.name}
                        {p.kind === 'exterior' && <span style={{ fontSize: FS.xs, fontWeight: 600, color: C.dim }}>· de prop</span>}
                        {on && <CheckIcon size={12} />}
                      </span>
                      <span style={{ fontSize: FS.xs, color: C.dim, lineHeight: 1.35 }}>{p.text}</span>
                    </span>
                  </button>
                );
              })}
              <div style={{ padding: '6px 8px 4px', fontSize: FS.xs, color: C.dim, lineHeight: 1.35 }}>
                Al mapa, doble clic a la marca d&apos;una porta també hi entra. La colla hi va sencera i el combat s&apos;acaba.
              </div>
            </div>
          </>
        )}
      </div>
      {here && (
        <button style={{ ...chip, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => go(VILLAGE)}
          title={`Tornar a ${mission.name}: la colla surt davant de la porta`}>
          <BackIcon size={14} /> Sortir a {mission.name}
        </button>
      )}
    </div>
  );
}
