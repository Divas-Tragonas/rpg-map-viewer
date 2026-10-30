'use client';
import React, { useMemo } from 'react';
import type { DialogCamMode, DialogStyle, SavedDialog } from '@/types';
import { C, FS, RADIUS, tint } from '@/constants';
import { Button } from '@/components/ui/Button';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { PlayIcon, SaveIcon, X } from '@/components/icons';
import { CAM_MODES, STYLES, isAnonymous, isNarrator, matchCast, parseScript, setLineOpts, type ScriptSay } from '@/lib/dialog/script';
import { DIALOG_CPS } from '@/hooks/useDialog';

/** El que s'està escrivint a la pestanya (viu a `DMView`: la pestanya es desmunta). */
export interface DialogDraft {
  /** Diàleg desat que s'està editant (o `null` = nou). */
  id: string | null;
  title: string;
  script: string;
  cast: Record<string, string | null>;
  /** Token on es desa (i de qui és la cinemàtica de boss si `afterBoss`). */
  owner: string | null;
  cps: number;
  afterBoss: boolean;
}

export const EMPTY_DRAFT: DialogDraft = {
  id: null, title: '', cps: DIALOG_CPS, afterBoss: false, owner: null, cast: {},
  script: 'Klarg: Qui gosa entrar a la meva *cova*?\nNarrador: Les torxes tremolen.\n???: No el miris als ulls...',
};

const field: React.CSSProperties = {
  background: C.dark, color: C.bright, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm,
  fontSize: FS.sm, padding: '5px 7px', minWidth: 0,
};
const label: React.CSSProperties = { fontSize: FS.xs, color: C.dim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' };

export function DialogPanel({ draft, onDraft, tokens, saved, running, onStart, onEnd, onSave, onDelete }: {
  draft: DialogDraft;
  onDraft: (d: DialogDraft) => void;
  /** Tokens de l'escena (per relacionar-hi els noms i per desar-hi el diàleg). */
  tokens: { key: string; name: string }[];
  saved: Record<string, SavedDialog[]>;
  running: boolean;
  onStart: (d: DialogDraft) => void;
  onEnd: () => void;
  onSave: (d: DialogDraft) => void;
  onDelete: (owner: string, id: string) => void;
}) {
  const parsed = useMemo(() => parseScript(draft.script), [draft.script]);
  // Repartiment: cada nom amb el token que es diu igual, si no s'ha canviat a mà.
  const cast = useMemo(() => matchCast(parsed.speakers, tokens, draft.cast), [parsed.speakers, tokens, draft.cast]);
  const says = parsed.steps.filter((s): s is ScriptSay => s.kind === 'say');
  const set = (p: Partial<DialogDraft>) => onDraft({ ...draft, cast, ...p });
  const ownerList = draft.owner ? saved[draft.owner] ?? [] : [];
  const nameOf = (k: string | null) => tokens.find(t => t.key === k)?.name ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <ScrollArea style={{ flex: 1, minHeight: 0 }}>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Títol i on es desa */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input value={draft.title} onChange={e => set({ title: e.target.value })} placeholder="Títol del diàleg"
              style={{ ...field, flex: 1 }} aria-label="Títol del diàleg" />
            <select value={draft.owner ?? ''} onChange={e => set({ owner: e.target.value || null, id: null })} style={{ ...field, width: 150 }}
              aria-label="Token on es desa" title="Token on es desa (surt al seu menú del clic dret)">
              <option value="">Desar al token…</option>
              {tokens.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
            <Button size="md" variant="secondary" disabled={!draft.owner || !says.length} onClick={() => onSave({ ...draft, cast })}
              title={draft.id ? 'Desa els canvis' : 'Desa el diàleg al token'}>
              <SaveIcon size={12} /> {draft.id ? 'Desar' : 'Desar nou'}
            </Button>
          </div>
          {ownerList.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {ownerList.map(dl => (
                <span key={dl.id} style={{ display: 'inline-flex', alignItems: 'center', borderRadius: RADIUS.sm, border: `1px solid ${dl.id === draft.id ? C.accent : C.border}`, background: dl.id === draft.id ? tint(C.accent, 0.1) : 'transparent' }}>
                  <button onClick={() => onDraft({ id: dl.id, title: dl.title, script: dl.script, cast: dl.cast, owner: draft.owner, cps: draft.cps, afterBoss: !!dl.afterBoss })}
                    style={{ background: 'none', border: 'none', color: dl.id === draft.id ? C.accent : C.text, fontSize: FS.sm, padding: '3px 4px 3px 8px', cursor: 'pointer' }}
                    title="Obrir per editar-lo">{dl.title || 'Sense títol'}</button>
                  <button onClick={() => onDelete(draft.owner!, dl.id)} aria-label={`Esborrar ${dl.title}`} title="Esborrar"
                    style={{ background: 'none', border: 'none', color: C.dim, padding: '3px 6px 3px 2px', cursor: 'pointer', display: 'flex' }}><X size={11} /></button>
                </span>
              ))}
            </div>
          )}

          {/* Guió */}
          <textarea value={draft.script} onChange={e => set({ script: e.target.value })} rows={7} spellCheck={false}
            aria-label="Guió del diàleg"
            style={{ ...field, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: FS.md, lineHeight: 1.5, resize: 'vertical' }} />
          <div style={{ fontSize: FS.xs, color: C.dim, lineHeight: 1.6 }}>
            <b style={{ color: C.text }}>Nom: text</b> per línia · <b style={{ color: C.text }}>*paraula*</b> èmfasi · <b style={{ color: C.text }}>...</b> pausa ·
            {' '}<b style={{ color: C.text }}>&gt; opció -&gt; etiqueta</b> · <b style={{ color: C.text }}># etiqueta</b> · <b style={{ color: C.text }}>-&gt; fi</b>
          </div>
          {parsed.warnings.map(w => <div key={w} style={{ fontSize: FS.sm, color: C.warn }}>{w}</div>)}

          {/* Repartiment */}
          {parsed.speakers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={label}>Qui parla</div>
              {parsed.speakers.map(sp => (
                <div key={sp} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ flex: '0 0 130px', fontSize: FS.sm, color: C.bright, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sp}</span>
                  <select value={cast[sp] ?? ''} onChange={e => set({ cast: { ...cast, [sp]: e.target.value || null } })} style={{ ...field, flex: 1 }}
                    aria-label={`Token de ${sp}`}>
                    <option value="">Veu sense token</option>
                    {tokens.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Línies: estil i càmera de cadascuna (s'escriuen al guió entre parèntesis). */}
          {says.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={label}>Línies</div>
              {says.map((st, i) => {
                const voice = isNarrator(st.name) || isAnonymous(st.name) || !cast[st.name];
                return (
                  <div key={`${st.src}-${i}`} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ flex: '0 0 18px', fontSize: FS.xs, color: C.dim, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: FS.sm, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={`${st.name}: ${st.text}`}>
                      <b style={{ color: C.bright }}>{st.name}</b> {st.text}
                    </span>
                    <select value={st.style} onChange={e => set({ script: setLineOpts(draft.script, st.src, e.target.value as DialogStyle, st.cam) })}
                      style={{ ...field, width: 96, padding: '3px 4px', fontSize: FS.xs }} aria-label={`Estil de la línia ${i + 1}`}>
                      {STYLES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                    <select value={st.cam} disabled={voice} onChange={e => set({ script: setLineOpts(draft.script, st.src, st.style, e.target.value as DialogCamMode) })}
                      style={{ ...field, width: 122, padding: '3px 4px', fontSize: FS.xs, opacity: voice ? 0.45 : 1 }} aria-label={`Càmera de la línia ${i + 1}`}
                      title={voice ? 'Una veu sense token no mou la càmera' : 'Què fa la càmera'}>
                      {CAM_MODES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          {/* Opcions */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: FS.sm, color: C.text }}>
              Velocitat
              <input type="range" min={12} max={70} value={draft.cps} onChange={e => set({ cps: +e.target.value })} style={{ width: 110 }} aria-label="Lletres per segon" />
              <span style={{ color: C.dim, fontVariantNumeric: 'tabular-nums', fontSize: FS.xs }}>{draft.cps} l/s</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FS.sm, color: draft.owner ? C.text : C.dim }}
              title={draft.owner ? '' : 'Tria primer el token on es desa'}>
              <input type="checkbox" checked={draft.afterBoss} disabled={!draft.owner} onChange={e => set({ afterBoss: e.target.checked })} />
              Després de la cinemàtica de boss{draft.owner ? ` de ${nameOf(draft.owner)}` : ''}
            </label>
          </div>
        </div>
      </ScrollArea>

      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: `1px solid ${C.border}`, alignItems: 'center' }}>
        <Button size="lg" variant="primary" disabled={!says.length} onClick={() => onStart({ ...draft, cast })} style={{ flex: 1, justifyContent: 'center' }}>
          <PlayIcon size={12} /> {running ? 'Tornar a començar' : 'Començar el diàleg'}
        </Button>
        <Button size="lg" variant="secondary" disabled={!running} onClick={onEnd}>
          <X size={12} /> Acabar
        </Button>
      </div>
    </div>
  );
}
