'use client';
import React, { useState } from 'react';
import { C, FS, RADIUS, tint } from '@/constants';
import { Button } from '@/components/ui/Button';
import { PenLine, PlayIcon, X } from '@/components/icons';
import type { CaptureInfo, StoryActions } from '@/hooks/useStory';
import { deleteCapsule, renameCapsule, useCapsules, type CapsuleMeta } from '@/lib/capsules';

const label: React.CSSProperties = { fontSize: FS.xs, color: C.dim, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' };
const row: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: RADIUS.md,
  background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`,
};
const field: React.CSSProperties = {
  background: C.dark, color: C.bright, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm,
  fontSize: FS.sm, padding: '5px 7px', minWidth: 0, boxSizing: 'border-box', width: '100%',
};
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: C.dim, display: 'flex', padding: 3 };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function describe(m: CapsuleMeta): string {
  const parts: string[] = [];
  if (m.enemyCount) parts.push(plural(m.enemyCount, 'enemic', 'enemics'));
  if (m.slideCount) parts.push(plural(m.slideCount, 'imatge', 'imatges'));
  if (m.hasText) parts.push('text');
  return parts.join(' · ') || 'buida';
}

function Check({ checked, onChange, disabled, children }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: FS.sm, color: disabled ? C.dim : C.text, cursor: disabled ? 'default' : 'pointer' }}>
      <input type="checkbox" checked={checked && !disabled} disabled={disabled} onChange={e => onChange(e.target.checked)} style={{ accentColor: C.accent }} />
      {children}
    </label>
  );
}

/** Formulari de «Capturar»: què es desa del moment actual. */
function CaptureForm({ info, defaultName, onCancel, onSave }: {
  info: CaptureInfo; defaultName: string; onCancel: () => void;
  onSave: (o: { name: string; enemies: boolean; scene: boolean; removeAfter: boolean; autoShow: boolean }) => void;
}) {
  const hasScene = info.slides > 0 || info.hasText;
  const [name, setName] = useState(defaultName);
  const [enemies, setEnemies] = useState(info.enemies > 0);
  const [scene, setScene] = useState(hasScene);
  const [removeAfter, setRemoveAfter] = useState(true);
  const [autoShow, setAutoShow] = useState(true);
  const sceneDesc = [info.slides ? plural(info.slides, 'imatge', 'imatges') : '', info.hasText ? 'text' : ''].filter(Boolean).join(' + ');
  const can = (enemies && info.enemies > 0) || (scene && hasScene);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: 10, borderRadius: RADIUS.md, border: `1px solid ${tint(C.accent, 0.4)}`, background: tint(C.accent, 0.05) }}>
      <input style={field} value={name} autoFocus onChange={e => setName(e.target.value)} placeholder="Nom de la càpsula"
        onKeyDown={e => { if (e.key === 'Enter' && can) onSave({ name, enemies, scene, removeAfter, autoShow }); if (e.key === 'Escape') onCancel(); }} />
      <Check checked={enemies} onChange={setEnemies} disabled={!info.enemies}>
        Enemics de l&apos;escena ({info.enemies}{info.hidden ? `, ${info.hidden} amagats` : ''}) amb la seva posició
      </Check>
      {enemies && info.enemies > 0 && (
        <div style={{ paddingLeft: 22 }}>
          <Check checked={removeAfter} onChange={setRemoveAfter}>Treure&apos;ls del mapa després de capturar</Check>
        </div>
      )}
      <Check checked={scene} onChange={setScene} disabled={!hasScene}>
        Escena {hasScene ? `(${sceneDesc})` : '(buida: prepara-la a «Mostrar als jugadors»)'}
      </Check>
      {scene && hasScene && (
        <div style={{ paddingLeft: 22 }}>
          <Check checked={autoShow} onChange={setAutoShow}>Mostrar-la als jugadors en disparar</Check>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <Button size="sm" onClick={onCancel}>Cancel·lar</Button>
        <Button size="sm" variant="primary" disabled={!can} onClick={() => onSave({ name, enemies, scene, removeAfter, autoShow })}>Capturar</Button>
      </div>
    </div>
  );
}

/**
 * Càpsules del mòdul: «fotos» del moment (enemics col·locats, Escena preparada) que es disparen
 * amb un clic. Veure `lib/capsules.ts`.
 */
export function ModuleCapsules({ moduleId, story }: { moduleId: string; story: StoryActions }) {
  const all = useCapsules();
  const mine = all.filter(c => c.moduleId === moduleId);
  const [info, setInfo] = useState<CaptureInfo | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...label, flex: 1 }}>Càpsules</span>
        {!info && (
          <Button size="sm" onClick={() => setInfo(story.captureInfo())}
            title="Desa el que hi ha ara (enemics col·locats al mapa i/o l'Escena preparada) per disparar-ho després amb un clic">
            + Capturar el moment
          </Button>
        )}
      </div>
      {info && (
        <CaptureForm info={info} defaultName={`Càpsula ${mine.length + 1}`} onCancel={() => setInfo(null)}
          onSave={o => { void story.capture(moduleId, o).then(id => { if (id) setInfo(null); }); }} />
      )}
      {!info && mine.length === 0 && (
        <span style={{ fontSize: FS.xs, color: C.dim, lineHeight: 1.45 }}>
          Col·loca enemics al mapa o prepara l&apos;Escena (imatges i text) i prem «Capturar el moment». Després, un clic a «Disparar» ho torna a posar tal qual.
        </span>
      )}
      {mine.map(m => (
        <div key={m.id} style={row}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {renaming?.id === m.id ? (
              <input style={field} value={renaming.name} autoFocus onChange={e => setRenaming({ id: m.id, name: e.target.value })}
                onBlur={() => { void renameCapsule(m.id, renaming.name); setRenaming(null); }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenaming(null); }} />
            ) : (
              <span style={{ fontSize: FS.md, fontWeight: 700, color: C.bright, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
            )}
            <span style={{ fontSize: FS.xs, color: C.dim }}>{describe(m)}{m.mapName && m.enemyCount ? ` · ${m.mapName}` : ''}</span>
          </div>
          <button onClick={() => setRenaming({ id: m.id, name: m.name })} aria-label={`Canviar el nom de ${m.name}`} title="Canviar el nom" style={iconBtn}>
            <PenLine size={12} />
          </button>
          {confirmDel === m.id ? (
            <Button size="sm" variant="danger" onClick={() => { void deleteCapsule(m.id); setConfirmDel(null); }} onBlur={() => setConfirmDel(null)} autoFocus>Eliminar</Button>
          ) : (
            <button onClick={() => setConfirmDel(m.id)} aria-label={`Eliminar ${m.name}`} title="Eliminar la càpsula" style={iconBtn}>
              <X size={12} />
            </button>
          )}
          <Button size="sm" variant="primary" onClick={() => void story.fireCapsule(m.id)} title="Torna a posar els enemics on eren i carrega (o mostra) l'Escena">
            <PlayIcon size={11} /> Disparar
          </Button>
        </div>
      ))}
    </div>
  );
}
