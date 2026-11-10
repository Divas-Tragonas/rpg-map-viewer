'use client';
import React, { useMemo, useState } from 'react';
import { C, FS, RADIUS } from '@/constants';
import { Button } from '@/components/ui/Button';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Trash2 } from '@/components/icons';
import { ENEMY_TEMPLATES } from '@/lib/bestiary';
import { CREATURES } from '@/lib/sprites/manifest';
import {
  blankModule, saveModule, sortedModules, STATUS_LABEL, STATUS_ORDER,
  type ModuleStatus, type ModulePack, type ModulesData,
} from '@/lib/modules';

const field: React.CSSProperties = {
  background: C.dark, color: C.bright, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm,
  fontSize: FS.sm, padding: '5px 7px', minWidth: 0, boxSizing: 'border-box', width: '100%',
};
const mono: React.CSSProperties = { fontFamily: 'ui-monospace, monospace' };

/** Les dades del formulari: tot text, perquè es pugui escriure a mitges; `saveModule` ho normalitza. */
interface Draft {
  title: string; kind: string; level: string; duration: string; status: ModuleStatus; trigger: string;
  scene: string; quests: string; notionUrl: string; dmNotes: string;
  readAloud: { id: string; label: string; text: string }[];
  foes: { creature: string; count: string; name: string; hp: string; xp: string; sprite?: string; note?: string }[];
  npcs: { name: string; note: string }[];
  dialogs: { id: string; title: string; script: string }[];
  exits: { id: string; label: string; text: string; to: string }[];
}

const toDraft = (m: ModulePack): Draft => ({
  title: m.title, kind: m.kind ?? '', level: m.level != null ? String(m.level) : '', duration: m.duration ?? '',
  status: m.status, trigger: m.trigger ?? '', scene: m.scene.join('\n'), quests: m.quests.join('\n'),
  notionUrl: m.notionUrl ?? '', dmNotes: m.dmNotes ?? '',
  readAloud: m.readAloud.map(r => ({ ...r })),
  foes: m.foes.map(f => ({ creature: f.creature, count: String(f.count), name: f.name ?? '', hp: f.hp != null ? String(f.hp) : '', xp: f.xp != null ? String(f.xp) : '', sprite: f.sprite, note: f.note })),
  npcs: m.npcs.map(n => ({ name: n.name, note: n.note ?? '' })),
  dialogs: m.dialogs.map(d => ({ ...d })),
  exits: m.exits.map(e => ({ id: e.id, label: e.label, text: e.text ?? '', to: e.to ?? '' })),
});

const n = (s: string) => (s.trim() && Number.isFinite(Number(s)) ? Number(s) : undefined);
const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean);

function toRaw(d: Draft) {
  return {
    title: d.title, kind: d.kind, level: n(d.level), duration: d.duration, status: d.status, trigger: d.trigger,
    scene: lines(d.scene), quests: lines(d.quests), notionUrl: d.notionUrl, dmNotes: d.dmNotes,
    readAloud: d.readAloud, npcs: d.npcs, dialogs: d.dialogs, exits: d.exits.map(e => ({ ...e, to: e.to || undefined })),
    foes: d.foes.map(f => ({ ...f, count: n(f.count) ?? 1, hp: n(f.hp), xp: n(f.xp), name: f.name || undefined })),
  };
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontSize: FS.xs, color: C.dim, fontWeight: 600 }}>{children}</span>
);
const Section = ({ title, hint, onAdd, addLabel, children }: {
  title: string; hint?: string; onAdd?: () => void; addLabel?: string; children?: React.ReactNode;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ flex: 1, fontSize: FS.sm, fontWeight: 700, color: C.bright }}>{title}</span>
      {onAdd && <Button size="sm" onClick={onAdd}>+ {addLabel ?? 'Afegir'}</Button>}
    </div>
    {hint && <span style={{ fontSize: FS.xs, color: C.dim, lineHeight: 1.4 }}>{hint}</span>}
    {children}
  </div>
);
const Row = ({ children, onRemove, label }: { children: React.ReactNode; onRemove: () => void; label: string }) => (
  <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: 8, border: `1px solid ${C.border}`, borderRadius: RADIUS.md }}>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>{children}</div>
    <button onClick={onRemove} aria-label={label} title={label}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, display: 'flex', padding: 3 }}>
      <Trash2 size={13} />
    </button>
  </div>
);

/**
 * Formulari per crear o editar un mòdul de la Història sense escriure JSON: títol, text per llegir,
 * enemics (amb suggeriments del bestiari), diàlegs en format teatre, sortides cap a altres mòduls i notes.
 * Desa a la biblioteca (`saveModule`) igual que una importació.
 */
export function ModuleEditor({ initial, lib, onDone }: { initial?: ModulePack; lib: ModulesData; onDone: (savedId?: string) => void }) {
  const [d, setD] = useState<Draft>(() => toDraft(initial ?? blankModule()));
  const [err, setErr] = useState('');
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(x => ({ ...x, [k]: v }));
  const upd = <K extends 'readAloud' | 'foes' | 'npcs' | 'dialogs' | 'exits'>(k: K, i: number, patch: Partial<Draft[K][number]>) =>
    setD(x => ({ ...x, [k]: (x[k] as Draft[K]).map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const del = (k: 'readAloud' | 'foes' | 'npcs' | 'dialogs' | 'exits', i: number) =>
    setD(x => ({ ...x, [k]: (x[k] as unknown[]).filter((_, j) => j !== i) }) as Draft);
  const add = <K extends 'readAloud' | 'foes' | 'npcs' | 'dialogs' | 'exits'>(k: K, item: Draft[K][number]) =>
    setD(x => ({ ...x, [k]: [...(x[k] as unknown[]), item] }) as Draft);

  const creatures = useMemo(() => [...new Set([...ENEMY_TEMPLATES.map(t => t.id), ...Object.keys(CREATURES)])].sort(), []);
  const others = sortedModules(lib).filter(m => m.pack.id !== initial?.id);

  const save = () => {
    const r = saveModule(toRaw(d), initial?.id);
    if (r.errors.length) { setErr(r.errors.join(' ')); return; }
    onDone(r.id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <ScrollArea style={{ flex: 1, minHeight: 0 }}>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <Label>Títol</Label>
            <input style={field} value={d.title} autoFocus onChange={e => set('title', e.target.value)} placeholder="Emboscada de goblins" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 1fr', gap: 6 }}>
              <div><Label>Tipus</Label><input style={field} value={d.kind} onChange={e => set('kind', e.target.value)} placeholder="Encontre" /></div>
              <div><Label>Nivell</Label><input style={field} inputMode="numeric" value={d.level} onChange={e => set('level', e.target.value)} /></div>
              <div><Label>Durada</Label><input style={field} value={d.duration} onChange={e => set('duration', e.target.value)} placeholder="30 min" /></div>
            </div>
            <Label>Estat</Label>
            <select style={field} value={d.status} onChange={e => set('status', e.target.value as ModuleStatus)}>
              {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <Label>Disparador (quan comença)</Label>
            <textarea style={{ ...field, resize: 'vertical' }} rows={2} value={d.trigger} onChange={e => set('trigger', e.target.value)} />
            <Label>Escena (una frase per línia)</Label>
            <textarea style={{ ...field, resize: 'vertical' }} rows={3} value={d.scene} onChange={e => set('scene', e.target.value)} />
          </div>

          <Section title="Text per llegir" addLabel="Text" hint="El que es llegeix en veu alta. «Llegir» el deixa a l'Escena i tu el mostres als jugadors."
            onAdd={() => add('readAloud', { id: '', label: `Text ${d.readAloud.length + 1}`, text: '' })}>
            {d.readAloud.map((r, i) => (
              <Row key={i} label="Treure el text" onRemove={() => del('readAloud', i)}>
                <input style={field} value={r.label} onChange={e => upd('readAloud', i, { label: e.target.value })} placeholder="Etiqueta" />
                <textarea style={{ ...field, resize: 'vertical' }} rows={4} value={r.text} onChange={e => upd('readAloud', i, { text: e.target.value })} />
              </Row>
            ))}
          </Section>

          <Section title="Enemics" addLabel="Enemic" hint="«Col·locar» els deixa al centre de la vista. Tria una criatura de la llista o escriu-ne el nom (llavors, posa-hi PV i XP)."
            onAdd={() => add('foes', { creature: '', count: '1', name: '', hp: '', xp: '' })}>
            <datalist id="module-creatures">{creatures.map(c => <option key={c} value={c} />)}</datalist>
            {d.foes.map((f, i) => (
              <Row key={i} label="Treure l'enemic" onRemove={() => del('foes', i)}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 56px', gap: 6 }}>
                  <input style={field} list="module-creatures" value={f.creature} onChange={e => upd('foes', i, { creature: e.target.value })} placeholder="goblin" />
                  <input style={field} inputMode="numeric" value={f.count} onChange={e => upd('foes', i, { count: e.target.value })} aria-label="Quantitat" title="Quantitat (1–30)" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px', gap: 6 }}>
                  <input style={field} value={f.name} onChange={e => upd('foes', i, { name: e.target.value })} placeholder="Nom (opcional)" />
                  <input style={field} inputMode="numeric" value={f.hp} onChange={e => upd('foes', i, { hp: e.target.value })} placeholder="PV" />
                  <input style={field} inputMode="numeric" value={f.xp} onChange={e => upd('foes', i, { xp: e.target.value })} placeholder="XP" />
                </div>
              </Row>
            ))}
          </Section>

          <Section title="Diàlegs" addLabel="Diàleg" hint="Format teatre, una rèplica per línia: «Nom: text». El nom ha de coincidir amb un token de l'escena."
            onAdd={() => add('dialogs', { id: '', title: `Diàleg ${d.dialogs.length + 1}`, script: '' })}>
            {d.dialogs.map((g, i) => (
              <Row key={i} label="Treure el diàleg" onRemove={() => del('dialogs', i)}>
                <input style={field} value={g.title} onChange={e => upd('dialogs', i, { title: e.target.value })} />
                <textarea style={{ ...field, ...mono, resize: 'vertical' }} rows={5} spellCheck={false} value={g.script}
                  onChange={e => upd('dialogs', i, { script: e.target.value })} placeholder={'Narrador: Una cosa es mou entre els arbres…\nGrix: Ei, vosaltres!'} />
              </Row>
            ))}
          </Section>

          <Section title="Sortides" addLabel="Sortida" hint="Cap a on pot anar la història. «Anar-hi» marca aquest mòdul com a jugat i obre el de destí."
            onAdd={() => add('exits', { id: '', label: '', text: '', to: '' })}>
            {d.exits.map((x, i) => (
              <Row key={i} label="Treure la sortida" onRemove={() => del('exits', i)}>
                <input style={field} value={x.label} onChange={e => upd('exits', i, { label: e.target.value })} placeholder="Si els jugadors fugen…" />
                <select style={field} value={x.to} onChange={e => upd('exits', i, { to: e.target.value })} aria-label="Mòdul de destí">
                  <option value="">(sense mòdul de destí)</option>
                  {others.map(m => <option key={m.pack.id} value={m.pack.id}>{m.pack.title}</option>)}
                  {x.to && !others.some(m => m.pack.id === x.to) && <option value={x.to}>{x.to} (no existeix)</option>}
                </select>
                <input style={field} value={x.text} onChange={e => upd('exits', i, { text: e.target.value })} placeholder="Nota (opcional)" />
              </Row>
            ))}
          </Section>

          <Section title="NPCs" addLabel="NPC" onAdd={() => add('npcs', { name: '', note: '' })}>
            {d.npcs.map((p, i) => (
              <Row key={i} label="Treure el NPC" onRemove={() => del('npcs', i)}>
                <input style={field} value={p.name} onChange={e => upd('npcs', i, { name: e.target.value })} placeholder="Nom" />
                <input style={field} value={p.note} onChange={e => upd('npcs', i, { note: e.target.value })} placeholder="Nota" />
              </Row>
            ))}
          </Section>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <Label>Notes del DM</Label>
            <textarea style={{ ...field, resize: 'vertical' }} rows={4} value={d.dmNotes} onChange={e => set('dmNotes', e.target.value)} />
            <Label>Missions (una per línia)</Label>
            <textarea style={{ ...field, resize: 'vertical' }} rows={2} value={d.quests} onChange={e => set('quests', e.target.value)} />
            <Label>Enllaç a Notion (opcional)</Label>
            <input style={field} value={d.notionUrl} onChange={e => set('notionUrl', e.target.value)} />
          </div>
        </div>
      </ScrollArea>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderTop: `1px solid ${C.border}` }}>
        <span style={{ flex: 1, fontSize: FS.xs, color: C.warn, lineHeight: 1.3 }}>{err}</span>
        <Button size="md" onClick={() => onDone()}>Cancel·lar</Button>
        <Button size="md" variant="primary" disabled={!d.title.trim()} onClick={save}>Desar</Button>
      </div>
    </div>
  );
}
