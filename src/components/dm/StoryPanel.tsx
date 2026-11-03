'use client';
import React from 'react';
import { C, FS, RADIUS, SHADOW } from '@/constants';
import { X } from '@/components/icons';
import { useCompactLayout } from '@/hooks/useCompact';
import type { StoryActions } from '@/hooks/useStory';
import { useJsonStore } from '@/lib/localStore';
import { journalStore } from '@/lib/journal';
import { modulesStore } from '@/lib/modules';
import { ModuleView } from './ModuleView';
import { ModuleLibrary } from './ModuleLibrary';
import { JournalView } from './JournalView';
import { RAIL_W } from '@/components/dm/RightRail';

export type StoryTab = 'modul' | 'moduls' | 'diari';

const TABS: [StoryTab, string][] = [['modul', 'Mòdul'], ['moduls', 'Mòduls'], ['diari', 'Diari']];

/** Alçada de la barra superior més el marge: el panell queda sota el zoom i la càmera del mapa. */
const TOP = 56;
export const STORY_PANEL_W = 380;
/* zIndex 11: per sota de la barra de torns (12), perquè els seus globus («Finalitzar el combat?») es vegin sobre el panell. */
/** Espai que ocupa la barra de torns a baix de l'escenari (les files de xips + el marge). */
const TURN_BAR_GAP = 104;

/**
 * «Història»: el mòdul que s'està jugant (disparador, textos per llegir, enemics, sortides…),
 * la biblioteca de mòduls importats i el diari de la sessió. Va a la dreta del mapa, sota el
 * zoom, i és DM-only (no es sincronitza res).
 */
export function StoryPanel({ tab, onTab, onClose, story, notify, noteFocus, onGoLibrary, avoidTurnBar }: {
  tab: StoryTab;
  onTab: (t: StoryTab) => void;
  onClose: () => void;
  story: StoryActions;
  notify: (text: string, kind?: 'error' | 'warn' | 'info') => void;
  /** Canvia cada cop que el DM prem N: el camp de nota del diari agafa el focus. */
  noteFocus: number;
  onGoLibrary: () => void;
  /** Hi ha combat a la vista: el panell s'acaba on comença la barra de torns (si no, en tapa els botons). */
  avoidTurnBar: boolean;
}) {
  const compact = useCompactLayout();
  // Al mòbil la barra d'eines és horitzontal a dalt (`top: 56`): el panell hi va a sota.
  const top = compact ? 112 : TOP;
  const lib = useJsonStore(modulesStore);
  const journal = useJsonStore(journalStore);
  const active = lib.active ? lib.library[lib.active] : undefined;
  return (
    <div role="dialog" aria-label="Història"
      style={{
        position: 'absolute', top, right: compact ? 12 : 12 + RAIL_W, zIndex: 11, width: STORY_PANEL_W, maxWidth: 'calc(100% - 24px)',
        ...(compact ? { left: 12, width: 'auto' } : {}),
        maxHeight: `calc(100% - ${top + 12 + (avoidTurnBar ? TURN_BAR_GAP : 0)}px)`, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        background: C.float, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.float,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 6px 0 12px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <span style={{ color: C.bright, fontWeight: 700, fontSize: FS.md, marginRight: 8, whiteSpace: 'nowrap' }}>Història</span>
        <div role="tablist" style={{ display: 'flex' }}>
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => onTab(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 9px 8px', border: 'none', background: 'transparent',
                borderBottom: `2px solid ${tab === id ? C.accent : 'transparent'}`, color: tab === id ? C.accent : C.dim,
                fontSize: FS.sm, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
              {label}
              {id === 'diari' && journal.current.entries.length > 0 && <span style={{ color: C.dim, fontWeight: 500 }}>{journal.current.entries.length}</span>}
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <button onClick={onClose} aria-label="Tancar el panell" title="Tancar"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: '6px', display: 'flex' }}>
          <X size={14} />
        </button>
      </div>
      {tab === 'modul' && <ModuleView mod={active} lib={lib} story={story} onGoLibrary={onGoLibrary} />}
      {tab === 'moduls' && <ModuleLibrary lib={lib} story={story} onOpened={() => onTab('modul')} />}
      {tab === 'diari' && <JournalView journal={journal} lib={lib} story={story} notify={notify} noteFocus={noteFocus} />}
    </div>
  );
}
