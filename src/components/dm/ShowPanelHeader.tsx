'use client';
import React from 'react';
import { C, FS } from '@/constants';

export type ShowTab = 'imatge' | 'text';

const TABS: [ShowTab, string][] = [['imatge', 'Imatge o vídeo'], ['text', 'Text']];

/**
 * Capçalera del panell «Mostrar als jugadors». L'Expositor i el Revelador de text eren dos
 * botons i dos panells que ja s'excloïen l'un a l'altre (mostrar-ne un amaga l'altre als
 * jugadors); ara són dues pestanyes del mateix panell. Un punt verd a la pestanya diu què
 * s'està mostrant ara mateix, així es veu també des de l'altra.
 */
export function ShowPanelHeader({ tab, onTab, imageActive, textActive, hint, onClose }: {
  tab: ShowTab;
  onTab: (t: ShowTab) => void;
  imageActive: boolean;
  textActive: boolean;
  /** Dreceres de teclat de la pestanya oberta. */
  hint: string;
  onClose: () => void;
}) {
  const active: Record<ShowTab, boolean> = { imatge: imageActive, text: textActive };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 6px 0 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
      <span style={{ color: C.bright, fontWeight: 700, fontSize: FS.md, marginRight: 10, whiteSpace: 'nowrap' }}>Mostrar als jugadors</span>
      <div role="tablist" style={{ display: 'flex' }}>
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => onTab(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 10px 8px', border: 'none', background: 'transparent',
              borderBottom: `2px solid ${tab === id ? C.accent : 'transparent'}`, color: tab === id ? C.accent : C.dim,
              fontSize: FS.sm, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
            {label}
            {active[id] && <span title="S'està mostrant als jugadors" style={{ width: 6, height: 6, borderRadius: '50%', background: C.ok, boxShadow: `0 0 6px ${C.ok}` }} />}
          </button>
        ))}
      </div>
      <span style={{ flex: 1, minWidth: 8 }} />
      <span style={{ color: C.dim, fontSize: FS.xs, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hint}</span>
      <button onClick={onClose} aria-label="Tancar el panell" title="Tancar"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, fontSize: FS.xl, lineHeight: 1, padding: '0 6px', marginLeft: 4 }}>×</button>
    </div>
  );
}
