'use client';
import React, { useState } from 'react';
import { C, FS, RADIUS, FONT_SERIF, tint } from '@/constants';
import { Button } from '@/components/ui/Button';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { BookIcon, CheckIcon, ChevronDown, ChevronRight, PlayIcon, SpeechIcon, SwordsIcon } from '@/components/icons';
import type { StoryActions } from '@/hooks/useStory';
import { templateForFoe } from '@/hooks/useStory';
import { STATUS_LABEL, type ModulesData, type StoredModule } from '@/lib/modules';

const label: React.CSSProperties = { fontSize: FS.xs, color: C.dim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' };
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: RADIUS.md,
  background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={label}>{title}</span>
      {children}
    </div>
  );
}

/** Comprimeix un text llarg per a la fila (el sencer es veu al Revelador). */
const preview = (t: string, n = 110) => { const s = t.replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n).trimEnd()}…` : s; };

/** El mòdul actiu: tot el que cal tenir a mà mentre es juga. */
export function ModuleView({ mod, lib, story, onGoLibrary }: {
  mod: StoredModule | undefined; lib: ModulesData; story: StoryActions; onGoLibrary: () => void;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  if (!mod) {
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ color: C.text, fontSize: FS.md, lineHeight: 1.45 }}>
          {lib.order.length ? 'Cap mòdul triat. Obre\'n un de la biblioteca per tenir-ne el disparador, els textos i els enemics a mà.'
            : 'Encara no hi ha cap mòdul. Importa un paquet (JSON) de la pestanya Mòduls: es genera des de la pàgina de Notion.'}
        </span>
        <Button size="md" onClick={onGoLibrary}><BookIcon size={13} /> Anar a Mòduls</Button>
      </div>
    );
  }
  const p = mod.pack;
  const meta = [p.kind, p.level ? `Nivell ${p.level}` : null, p.duration].filter(Boolean).join(' · ');
  return (
    <ScrollArea style={{ flex: 1, minHeight: 0 }}>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontFamily: FONT_SERIF, fontSize: 19, fontWeight: 600, color: C.bright, lineHeight: 1.2 }}>{p.title}</span>
          <span style={{ fontSize: FS.xs, color: C.dim }}>
            {STATUS_LABEL[mod.status]}{meta ? ` · ${meta}` : ''}{p.quests.length ? ` · ${p.quests.join(', ')}` : ''}
          </span>
        </div>

        {p.trigger && <Section title="Disparador"><span style={{ fontSize: FS.md, color: C.text, lineHeight: 1.45 }}>{p.trigger}</span></Section>}

        {p.scene.length > 0 && (
          <Section title="Escena">
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3, color: C.text, fontSize: FS.md, lineHeight: 1.4 }}>
              {p.scene.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </Section>
        )}

        {p.readAloud.length > 0 && (
          <Section title="Per llegir als jugadors">
            {p.readAloud.map(r => (
              <div key={r.id} style={{ ...row, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: FS.sm, fontWeight: 700, color: C.bright }}>{r.label}</span>
                  <span style={{ fontSize: FS.sm, color: C.dim, fontFamily: FONT_SERIF, lineHeight: 1.4 }}>{preview(r.text)}</span>
                </div>
                <Button size="sm" onClick={() => story.readAloud(r.text)} title="Deixa el text al Revelador; allà el mostres als jugadors">
                  <PlayIcon size={11} /> Llegir
                </Button>
              </div>
            ))}
          </Section>
        )}

        {p.foes.length > 0 && (
          <Section title="Enemics">
            {p.foes.map((f, i) => (
              <div key={i} style={row}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontSize: FS.md, fontWeight: 700, color: C.bright }}>{f.count}× {f.name ?? templateForFoe(f).name}</span>
                  {f.note && <span style={{ fontSize: FS.xs, color: C.dim, lineHeight: 1.35 }}>{f.note}</span>}
                </div>
                <Button size="sm" onClick={() => story.placeFoes([f], p.title)} title="Els posa al centre de la vista, a la biblioteca de l'escena">
                  <SwordsIcon size={11} /> Col·locar
                </Button>
              </div>
            ))}
            {p.foes.length > 1 && (
              <Button size="sm" variant="ghost" onClick={() => story.placeFoes(p.foes, p.title)} style={{ alignSelf: 'flex-end' }}>Col·locar-ho tot</Button>
            )}
          </Section>
        )}

        {p.npcs.length > 0 && (
          <Section title="PNJ i llocs">
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3, color: C.text, fontSize: FS.md, lineHeight: 1.4 }}>
              {p.npcs.map((n, i) => <li key={i}><b style={{ color: C.bright }}>{n.name}</b>{n.note ? ` — ${n.note}` : ''}</li>)}
            </ul>
          </Section>
        )}

        {p.dialogs.length > 0 && (
          <Section title="Diàlegs">
            {p.dialogs.map(d => (
              <div key={d.id} style={row}>
                <span style={{ flex: 1, minWidth: 0, fontSize: FS.md, fontWeight: 700, color: C.bright, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                <Button size="sm" onClick={() => story.playDialog(d)} title="Comença el diàleg amb els tokens de l'escena que es diuen igual">
                  <SpeechIcon size={11} /> Parlar
                </Button>
              </div>
            ))}
          </Section>
        )}

        {p.exits.length > 0 && (
          <Section title="Sortides">
            {p.exits.map(ex => {
              const target = ex.to ? lib.library[ex.to] : undefined;
              const missing = !!ex.to && !target;
              return (
                <div key={ex.id} style={row}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: FS.md, fontWeight: 700, color: C.bright }}>{ex.label}</span>
                    <span style={{ fontSize: FS.xs, color: missing ? C.warn : C.dim, lineHeight: 1.35 }}>
                      {target ? `→ ${target.pack.title}` : missing ? `→ ${ex.to} (no està importat)` : ex.text ?? ''}
                    </span>
                  </div>
                  <Button size="sm" onClick={() => story.takeExit(p.id, ex)} title="Acaba aquest mòdul i passa al següent">
                    Anar-hi <ChevronRight size={11} />
                  </Button>
                </div>
              );
            })}
          </Section>
        )}

        {p.dmNotes && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => setNotesOpen(v => !v)} aria-expanded={notesOpen}
              style={{ ...label, display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
              {notesOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />} Notes del DM
            </button>
            {notesOpen && (
              <div style={{ fontSize: FS.md, color: C.text, lineHeight: 1.45, whiteSpace: 'pre-wrap', padding: '8px 10px', borderRadius: RADIUS.md, background: tint(C.accent, 0.05), border: `1px solid ${C.border}` }}>
                {p.dmNotes}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: `1px solid ${C.border}` }}>
          {p.notionUrl ? <a href={p.notionUrl} target="_blank" rel="noreferrer" style={{ fontSize: FS.xs, color: C.dim }}>Obrir a Notion</a> : <span />}
          <Button size="sm" variant={mod.status === 'jugat' ? 'ghost' : 'secondary'} disabled={mod.status === 'jugat'} onClick={() => story.finish(p.id)}>
            <CheckIcon size={11} /> {mod.status === 'jugat' ? 'Jugat' : 'Marcar com a jugat'}
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}
