'use client';
import React from 'react';
import { C, FS, RADIUS, tint } from '@/constants';
import { Button } from '@/components/ui/Button';
import type { ApiCharacter } from '@/lib/api';
import type { CharactersStatus } from '@/hooks/useCharacters';
import { STATS_PART, sheetOf } from '@/lib/characters';
import { XpBar, OfflineNote } from '@/components/dm/CharacterSection';

/**
 * Pestanya «Fitxa» del panell «Mostrar als jugadors»: tria un personatge i quines parts de la
 * seva fitxa es veuen a les pantalles (una targeta al costat del mapa, no a pantalla completa:
 * el mapa i el combat continuen). Mentre es mostra, canviar les parts o el personatge les
 * refresca a les pantalles a l'instant.
 */
export function SheetPanel({ characters, status, pending, selected, onSelect, parts, onParts, showingId, onShow, onHide }: {
  characters: ApiCharacter[];
  status: CharactersStatus;
  pending: number;
  selected: string | null;
  onSelect: (id: string) => void;
  parts: string[];
  onParts: (p: string[]) => void;
  /** Fitxa que es veu ara a les pantalles (null = cap). */
  showingId: string | null;
  onShow: () => void;
  onHide: () => void;
}) {
  const c = characters.find(ch => ch.id === selected) ?? null;
  const all = c ? [STATS_PART, ...(sheetOf(c).sections ?? []).filter(s => s.text.trim()).map(s => s.title)] : [];
  const toggle = (part: string) => onParts(parts.includes(part) ? parts.filter(p => p !== part) : [...parts, part]);
  const showing = !!showingId;
  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
      {status === 'offline' && <OfflineNote pending={pending} />}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {characters.length === 0 && <span style={{ color: C.dim, fontSize: FS.sm }}>{status === 'loading' ? 'Carregant…' : 'Encara no hi ha cap fitxa: crea-les al back office.'}</span>}
        {characters.map(ch => {
          const on = ch.id === selected;
          return (
            <button key={ch.id} onClick={() => onSelect(ch.id)} aria-pressed={on}
              style={{ padding: '6px 10px', borderRadius: RADIUS.md, cursor: 'pointer', fontSize: FS.sm, fontWeight: 700, background: on ? tint(C.accent, 0.12) : C.dark, color: on ? C.accent : C.text, border: `1px solid ${on ? C.accent : C.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
              {ch.name.split(' ')[0]}
              {ch.id === showingId && <span title="Es veu a les pantalles" style={{ width: 6, height: 6, borderRadius: '50%', background: C.ok }} />}
            </button>
          );
        })}
      </div>

      {c && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ color: C.bright, fontWeight: 700, fontSize: FS.lg }}>{c.name}</span>
              <span style={{ color: C.dim, fontSize: FS.sm }}>{[c.className, c.race].filter(Boolean).join(' · ')}</span>
              <span style={{ flex: 1 }} />
              <span style={{ color: C.text, fontSize: FS.sm }}>Nivell {c.level} · {c.xp} XP</span>
            </div>
            <XpBar xp={c.xp} level={c.level} />
          </div>

          <div>
            <div style={{ fontSize: FS.xs, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Què veuen els jugadors</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {all.map(part => {
                const on = parts.includes(part);
                return (
                  <button key={part} onClick={() => toggle(part)} aria-pressed={on}
                    style={{ padding: '4px 9px', borderRadius: 999, cursor: 'pointer', fontSize: FS.xs, fontWeight: 700, background: on ? tint(C.accent, 0.12) : 'transparent', color: on ? C.accent : C.dim, border: `1px solid ${on ? C.accent : C.border}` }}>
                    {part}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: FS.xs, color: C.dim, marginTop: 6 }}>Nom, nivell, experiència, CA, vida, velocitat i percepció passiva surten sempre.</div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <Button variant="secondary" disabled={!showing} onClick={onHide}>Amagar</Button>
        <Button variant="primary" disabled={!c || showingId === c.id} onClick={onShow}>
          {showing && c && showingId !== c.id ? 'Mostrar aquesta' : 'Mostrar als jugadors'}
        </Button>
      </div>
    </div>
  );
}
