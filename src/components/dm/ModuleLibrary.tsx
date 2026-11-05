'use client';
import React, { useRef, useState } from 'react';
import { C, FS, RADIUS, tint } from '@/constants';
import { Button } from '@/components/ui/Button';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Upload, X } from '@/components/icons';
import type { StoryActions } from '@/hooks/useStory';
import {
  importModules, removeModule, setModuleStatus, sortedModules, STATUS_LABEL, STATUS_ORDER,
  type ModuleStatus, type ModulesData,
} from '@/lib/modules';


const field: React.CSSProperties = {
  background: C.dark, color: C.bright, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm,
  fontSize: FS.sm, padding: '5px 7px', minWidth: 0,
};

/** Un punt de color per estat: el daurat és només per al que s'està jugant. */
const statusColor = (s: ModuleStatus) => (s === 'en-joc' ? C.accent : s === 'jugat' ? C.ok : C.dim);

/** La biblioteca de mòduls: importar paquets (fitxer o text enganxat), triar-ne un i canviar-ne l'estat. */
export function ModuleLibrary({ lib, story, onOpened }: { lib: ModulesData; story: StoryActions; onOpened: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const run = (source: string) => {
    const r = importModules(source);
    const parts: string[] = [];
    if (r.added.length) parts.push(`Afegits: ${r.added.join(', ')}.`);
    if (r.updated.length) parts.push(`Actualitzats: ${r.updated.join(', ')}.`);
    if (r.errors.length) parts.push(r.errors.join(' '));
    setMsg({ ok: !r.errors.length || r.added.length + r.updated.length > 0, text: parts.join(' ') });
    return r.added.length + r.updated.length > 0;
  };
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const f of Array.from(files)) run(await f.text());
    if (fileRef.current) fileRef.current.value = '';
  };

  const mods = sortedModules(lib);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="md" onClick={() => fileRef.current?.click()}><Upload size={12} /> Importar fitxer…</Button>
          <Button size="md" active={paste} onClick={() => setPaste(v => !v)}>Enganxar JSON</Button>
          <input ref={fileRef} type="file" accept=".json,application/json" multiple hidden onChange={e => void onFiles(e.target.files)} />
        </div>
        {paste && (
          <>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={5} spellCheck={false}
              placeholder={'{ "format": "rpg-module", "title": "…", … }'}
              style={{ ...field, width: '100%', boxSizing: 'border-box', fontFamily: 'ui-monospace, monospace', resize: 'vertical' }} />
            <Button size="md" variant="primary" disabled={!text.trim()} onClick={() => { if (run(text)) { setText(''); setPaste(false); } }} style={{ alignSelf: 'flex-end' }}>
              Importar
            </Button>
          </>
        )}
        {msg && <span style={{ fontSize: FS.xs, lineHeight: 1.4, color: msg.ok ? C.dim : C.warn }}>{msg.text}</span>}
      </div>

      {mods.length === 0 ? (
        <div style={{ padding: 16, fontSize: FS.sm, color: C.dim, lineHeight: 1.5 }}
          title="Un paquet és un JSON amb el disparador, els textos per llegir, els enemics i les sortides d'una pàgina de la base MÒDULS de Notion. Demana a Claude que et generi el de la sessió.">
          Cap mòdul importat.
        </div>
      ) : (
        <ScrollArea style={{ flex: 1, minHeight: 0 }}>
          <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {mods.map(m => {
              const on = lib.active === m.pack.id;
              return (
                <div key={m.pack.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: RADIUS.md,
                  background: on ? tint(C.accent, 0.1) : 'transparent', border: `1px solid ${on ? tint(C.accent, 0.4) : 'transparent'}`,
                }}>
                  <span title={STATUS_LABEL[m.status]} style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: statusColor(m.status) }} />
                  <button onClick={() => { story.open(m.pack.id); onOpened(); }}
                    style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.text }}>
                    <span style={{ fontSize: FS.md, fontWeight: 700, color: on ? C.accent : C.bright, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.pack.title}</span>
                    <span style={{ fontSize: FS.xs, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[m.pack.kind, m.pack.level ? `Nv ${m.pack.level}` : null, m.pack.duration].filter(Boolean).join(' · ') || m.pack.id}
                    </span>
                  </button>
                  <select value={m.status} onChange={e => setModuleStatus(m.pack.id, e.target.value as ModuleStatus)} aria-label={`Estat de ${m.pack.title}`}
                    style={{ ...field, padding: '3px 4px' }}>
                    {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                  {confirmDel === m.pack.id ? (
                    <Button size="sm" variant="danger" onClick={() => { removeModule(m.pack.id); setConfirmDel(null); }} onBlur={() => setConfirmDel(null)} autoFocus>Eliminar</Button>
                  ) : (
                    <button onClick={() => setConfirmDel(m.pack.id)} aria-label={`Eliminar ${m.pack.title} de la biblioteca`} title="Eliminar de la biblioteca"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, display: 'flex', padding: 3 }}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
