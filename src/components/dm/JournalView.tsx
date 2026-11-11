'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { C, FS, RADIUS, tint } from '@/constants';
import { Button } from '@/components/ui/Button';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { ChevronDown, ChevronRight, Copy, Download, X } from '@/components/icons';
import type { StoryActions } from '@/hooks/useStory';
import {
  closeSession, durationLabel, groupCombats, journalToMarkdown, KIND_LABEL, KIND_TONE, removeArchived, removeEntries, removeEntry,
  renameSession, sessionName, type JournalData, type JournalEntry, type JournalItem,
} from '@/lib/journal';
import { LOG_TONE } from '@/components/dm/TurnTracker';
import type { ModulesData } from '@/lib/modules';

const field: React.CSSProperties = {
  background: C.dark, color: C.bright, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm,
  fontSize: FS.sm, padding: '5px 7px', minWidth: 0, boxSizing: 'border-box',
};
const hhmm = (t: number) => new Date(t).toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });

/** Baixa un text com a fitxer (el fitxer es crea i es revoca a l'acte). */
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fileName = (name: string) => `${name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'sessio'}.md`;

function Row({ e }: { e: JournalEntry }) {
  const tone = KIND_TONE[e.kind];
  return (
    <div className="journal-row" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 8px', background: tint(tone, 0.07), border: `1px solid ${C.border}`, borderLeft: `3px solid ${tone}`, borderRadius: RADIUS.sm }}>
      <span style={{ fontSize: FS.xs, color: C.dim, fontVariantNumeric: 'tabular-nums', paddingTop: 2, flexShrink: 0 }}>{hhmm(e.t)}</span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: FS.xs, color: tone, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{KIND_LABEL[e.kind]}</span>
        <span style={{ fontSize: FS.md, color: C.text, lineHeight: 1.4, wordBreak: 'break-word' }}>{e.text}</span>
      </div>
      <button onClick={() => removeEntry(e.id)} aria-label="Esborrar l'anotació" title="Esborrar"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, display: 'flex', color: C.dim }}>
        <X size={12} />
      </button>
    </div>
  );
}

const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 3, display: 'flex', color: C.dim };

/**
 * Un combat sencer en una sola fila: el resum de com ha acabat i, desplegat, el detall (l'historial
 * del combat per rondes, cada missatge en el seu requadre). L'esborrar va pel combat sencer.
 */
function CombatRow({ g }: { g: Extract<JournalItem, { type: 'combat' }> }) {
  const [open, setOpen] = useState(false);
  const { start, end, inner, log } = g;
  const tone = KIND_TONE.combat;
  const span = hhmm(start.t) === hhmm(end.t) ? hhmm(end.t) : `${hhmm(start.t)}–${hhmm(end.t)}`;
  // Sense historial desat (combat d'abans): el que el diari va anotar pel mig.
  const fallback = [start, ...inner].map(e => e.text);
  return (
    <div className="journal-row" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 8px', background: tint(tone, 0.07), border: `1px solid ${C.border}`, borderLeft: `3px solid ${tone}`, borderRadius: RADIUS.sm }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ fontSize: FS.xs, color: C.dim, fontVariantNumeric: 'tabular-nums', paddingTop: 2, flexShrink: 0 }}>{span}</span>
        <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} title={open ? 'Plegar el detall del combat' : 'Desplegar el detall del combat'}
          style={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: FS.xs, color: tone, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />} {KIND_LABEL.combat}
          </span>
          <span style={{ fontSize: FS.md, color: C.text, lineHeight: 1.4, wordBreak: 'break-word' }}>{end.text}</span>
        </button>
        <button onClick={() => removeEntries([start.id, end.id, ...inner.map(e => e.id)])} aria-label="Esborrar el combat" title="Esborrar el combat" style={iconBtn}>
          <X size={12} />
        </button>
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 8 }}>
          {log.length > 0 ? log.map((l, i) => (
            <React.Fragment key={i}>
              {(i === 0 || log[i - 1].round !== l.round) && (
                <div style={{ fontSize: FS.xs, color: C.dim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: i ? 6 : 0 }}>Ronda {l.round}</div>
              )}
              <div style={{ fontSize: FS.sm, color: C.text, lineHeight: 1.4, padding: '5px 8px', background: C.dark, border: `1px solid ${C.border}`, borderLeft: `3px solid ${LOG_TONE[l.tone]}`, borderRadius: RADIUS.sm, wordBreak: 'break-word' }}>{l.text}</div>
            </React.Fragment>
          )) : fallback.map((t, i) => (
            <div key={i} style={{ fontSize: FS.sm, color: C.text, lineHeight: 1.4, padding: '5px 8px', background: C.dark, border: `1px solid ${C.border}`, borderLeft: `3px solid ${LOG_TONE.info}`, borderRadius: RADIUS.sm }}>{t}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/** El diari de la sessió: el que va passant, notes ràpides i el resum final per a Notion. */
export function JournalView({ journal, lib, story, notify, noteFocus }: {
  journal: JournalData; lib: ModulesData; story: StoryActions;
  notify: (text: string, kind?: 'error' | 'warn' | 'info') => void; noteFocus: number;
}) {
  const s = journal.current;
  const [note, setNote] = useState('');
  const [name, setName] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [oldOpen, setOldOpen] = useState(false);
  const noteRef = useRef<HTMLInputElement>(null);
  // La tecla N porta aquí i deixa el camp de nota llest. El focus va després del keydown
  // (si no, la «n» s'escriuria dins el camp).
  useEffect(() => {
    if (!noteFocus) return;
    const t = window.setTimeout(() => noteRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [noteFocus]);

  const items = useMemo(() => groupCombats(s.entries).reverse(), [s.entries]);
  const last = s.entries[s.entries.length - 1];
  const copy = (md: string) => {
    void navigator.clipboard?.writeText(md).then(
      () => notify('Resum copiat. Enganxa\'l a Claude per passar-lo a Notion.', 'info'),
      () => notify('El navegador no ha deixat copiar el resum. Descarrega\'l com a fitxer.', 'warn'));
  };
  const addNote = () => { const t = note.trim(); if (!t) return; story.note(t); setNote(''); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input value={name ?? s.name} placeholder={sessionName(s)} aria-label="Nom de la sessió"
            onChange={e => setName(e.target.value)}
            onBlur={() => { if (name !== null) { renameSession(name.trim()); setName(null); } }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setName(null); (e.target as HTMLInputElement).blur(); } }}
            style={{ ...field, flex: 1, fontWeight: 700 }} />
          <span style={{ fontSize: FS.xs, color: C.dim, whiteSpace: 'nowrap' }}>
            {last ? `${s.entries.length} · ${durationLabel(last.t - s.startedAt)}` : 'en blanc'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input ref={noteRef} value={note} onChange={e => setNote(e.target.value)} placeholder="Nota ràpida (tecla N)…"
            onKeyDown={e => { if (e.key === 'Enter') addNote(); e.stopPropagation(); }}
            style={{ ...field, flex: 1 }} />
          <Button size="md" disabled={!note.trim()} onClick={addNote}>Anotar</Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: 16, fontSize: FS.sm, color: C.dim, lineHeight: 1.5 }}
          title="El diari anota sol les escenes, els combats, l'XP, els diàlegs, les cinemàtiques i les sales que reveles. Quan la sessió acabi, en surt el resum per a Notion.">
          El diari s&apos;omple sol mentre jugues.
        </div>
      ) : (
        <ScrollArea style={{ flex: 1, minHeight: 120 }}>
          <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {items.map(it => it.type === 'combat' ? <CombatRow key={it.end.id} g={it} /> : <Row key={it.e.id} e={it.e} />)}
          </div>
        </ScrollArea>
      )}

      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Button size="sm" disabled={!s.entries.length} onClick={() => copy(journalToMarkdown(s, lib))} title="Copia el resum (markdown amb un bloc JSON per a Claude)">
            <Copy size={11} /> Copiar resum
          </Button>
          <Button size="sm" disabled={!s.entries.length} onClick={() => download(fileName(sessionName(s)), journalToMarkdown(s, lib))}>
            <Download size={11} /> Descarregar
          </Button>
          <span style={{ flex: 1 }} />
          {closing ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setClosing(false)}>Cancel·lar</Button>
              <Button size="sm" variant="danger" onClick={() => { copy(closeSession()); setClosing(false); }}>Arxivar i començar-ne una</Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" disabled={!s.entries.length} onClick={() => setClosing(true)} title="Desa el resum a l'arxiu, el copia i comença una sessió en blanc">Tancar la sessió</Button>
          )}
        </div>

        {journal.archive.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button onClick={() => setOldOpen(v => !v)} aria-expanded={oldOpen}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.dim, fontSize: FS.xs, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {oldOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />} Sessions anteriors · {journal.archive.length}
            </button>
            {oldOpen && journal.archive.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: FS.sm, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.name} <span style={{ color: C.dim }}>· {a.count}</span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => copy(a.markdown)} title="Copiar el resum"><Copy size={11} /></Button>
                <Button size="sm" variant="ghost" onClick={() => download(fileName(a.name), a.markdown)} title="Descarregar"><Download size={11} /></Button>
                <Button size="sm" variant="ghost" onClick={() => removeArchived(a.id)} title="Esborrar de l'arxiu"><X size={11} /></Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
