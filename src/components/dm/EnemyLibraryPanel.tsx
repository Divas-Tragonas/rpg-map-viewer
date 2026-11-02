'use client';
import { ENEMY_TEMPLATES, creatureTemplate, extraCreatures, type EnemyTemplate } from '@/lib/bestiary';
import React, { useEffect, useMemo, useState } from 'react';
import { BookIcon, Cloud } from '@/components/icons';
import { C, FS, RADIUS } from '@/constants';
import { SidebarSection } from '@/components/ui/SidebarSection';
import { EnemyGroupToolbar, GroupBody, GroupHeader } from '@/components/ui/EnemyGroups';
import { useEnemyGrouping } from '@/hooks/useEnemyGrouping';
import { api, isApiConfigured } from '@/lib/api';
import { creatureThumb, creatureNames } from '@/lib/sprites/draw';
import { useSpritePack } from '@/hooks/useSpritePack';
import type { ApiEnemy } from '@/lib/api';
import { groupEnemies } from '@/lib/enemy-groups';
import type { LibEnemy } from '@/types';

interface Props {
  /** Enemics ja afegits a l'escena: només per mostrar quants n'hi ha de cada plantilla. */
  libEnemies: LibEnemy[];
  onAddEnemy: (tmpl: EnemyTemplate) => void;
  onAddDbEnemy: (enemy: ApiEnemy) => void;
  /** App Píxel: figureta a les plantilles i el bestiari sencer del paquet Oryx. */
  pixel?: boolean;
}

function TemplateButton({ name, color, hpMax, inScene, onClick, thumb, detail }: { name: string; color: string; hpMax: number; inScene: number; onClick: () => void; thumb?: string | null; detail?: string }) {
  return (
    <button onClick={onClick} title={`Afegir ${name} a l'escena (${hpMax} de vida${detail ? ` · ${detail}` : ''})`}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '5px 7px',
        background: 'rgba(255,255,255,.04)', border: `1px solid ${C.border}`,
        borderRadius: RADIUS.sm, cursor: 'pointer', color: C.text, fontSize: FS.sm, textAlign: 'left',
      }}>
      {thumb
        ? <img src={thumb} alt="" style={{ width: 20, height: 20, margin: -4, imageRendering: 'pixelated', flexShrink: 0 }} />
        : <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0 }} />}
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      {inScene > 0
        ? <span title={`${inScene} a l'escena`} style={{ color: C.enemy, fontSize: FS.xs, fontWeight: 700 }}>×{inScene}</span>
        : <span style={{ color: C.dim, fontSize: FS.xs }}>{hpMax}</span>}
    </button>
  );
}

const GRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 };
// Una sola columna: els noms de la BD són llargs ("Guàrdia de la Meridiana") i a dues quedaven tallats.
const DB_GRID: React.CSSProperties = { ...GRID, gridTemplateColumns: '1fr' };

/**
 * Pestanya Biblioteca: plantilles per AFEGIR enemics. Els que ja són a l'escena es gestionen
 * (vida, visibilitat, eliminar) a la pestanya Escena, junt amb els jugadors.
 * Els de la BD es poden agrupar per projecte o per categoria (grups plegables).
 */
export function EnemyLibraryPanel({ libEnemies, onAddEnemy, onAddDbEnemy, pixel }: Props) {
  useSpritePack();
  const [beastQ, setBeastQ] = useState('');
  const [dbEnemies, setDbEnemies] = useState<ApiEnemy[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const grouping = useEnemyGrouping('dm');

  useEffect(() => {
    if (!isApiConfigured()) return;
    setDbLoading(true);
    api.enemies.list()
      .then(setDbEnemies)
      .catch(() => {})
      .finally(() => setDbLoading(false));
  }, []);

  const countOf = (templateId: string) => libEnemies.filter(e => e.templateId === templateId).length;
  const entries = useMemo<EnemyTemplate[]>(
    () => [...ENEMY_TEMPLATES, ...(pixel ? extraCreatures(creatureNames()).map(creatureTemplate) : [])],
    [pixel]);
  const q = beastQ.trim().toLowerCase().replace(/_/g, ' ');
  const shown = entries.filter(t => !q || `${t.name} ${t.detail ?? ''} ${t.sprite ?? ''}`.toLowerCase().replace(/_/g, ' ').includes(q));
  const allyList = shown.filter(t => t.ally);
  const foes = shown.filter(t => !t.ally);
  const castle = foes.filter(t => t.group === 'Castell de la Fumarola');
  const bestiary = foes.filter(t => t.group !== 'Castell de la Fumarola')
    .sort((x, y) => x.name.localeCompare(y.name, 'ca'));
  const templateGroup = (label: string, items: EnemyTemplate[]) => (
    <div key={label} style={{ marginTop: 6 }}>
      <div style={{ fontSize: FS.xs, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, margin: '2px 0 4px' }}>{label} · {items.length}</div>
      <div style={GRID}>
        {items.map(t => (
          <TemplateButton key={t.id} name={t.name} color={t.color} hpMax={t.hpMax} detail={t.detail}
            inScene={countOf(t.id)} onClick={() => onAddEnemy(t)}
            thumb={pixel && t.sprite ? creatureThumb(t.sprite) : null} />
        ))}
      </div>
    </div>
  );
  const groups = grouping.by === 'none' ? [] : groupEnemies(dbEnemies, grouping.by);
  const dbButton = (en: ApiEnemy) => (
    <TemplateButton key={en.id} name={en.name} color={en.color} hpMax={en.hpMax}
      inScene={countOf(en.id)} onClick={() => onAddDbEnemy(en)} />
  );

  return (
    <>
      <div style={{ padding: '8px 12px 2px', fontSize: FS.sm, color: C.dim, lineHeight: 1.45 }}>
        Clica una plantilla per afegir-la al centre de la vista. Després la trobaràs a <b style={{ color: C.text }}>Escena</b>.
      </div>
      {/* Catàleg únic: plantilles + bestiari Oryx (app Píxel) en un sol bloc; els aliats a part. */}
      <SidebarSection title="Enemics" icon={<BookIcon size={13} />} count={foes.length} defaultOpen maxBodyHeight={420} bodyPadding="0 8px 8px">
        <input value={beastQ} onChange={e => setBeastQ(e.target.value)} placeholder="Cerca (goblin, Jalil, dragon…)"
          style={{ width: '100%', boxSizing: 'border-box', height: 26, margin: '2px 0 6px', padding: '0 8px', borderRadius: RADIUS.sm, border: `1px solid ${C.border}`, background: C.dark, color: C.bright, fontSize: FS.sm, outline: 'none' }} />
        {foes.length === 0 && <div style={{ fontSize: FS.xs, color: C.dim }}>Cap resultat</div>}
        {castle.length > 0 && templateGroup('Castell de la Fumarola', castle)}
        {bestiary.length > 0 && templateGroup('Bestiari', bestiary)}
      </SidebarSection>
      {allyList.length > 0 && (
        <SidebarSection title="Aliats" icon={<BookIcon size={13} />} count={allyList.length} defaultOpen bodyPadding="0 8px 8px">
          <div style={GRID}>
            {allyList.map(t => (
              <TemplateButton key={t.id} name={t.name} color={t.color} hpMax={t.hpMax} detail={t.detail}
                inScene={countOf(t.id)} onClick={() => onAddEnemy(t)}
                thumb={pixel && t.sprite ? creatureThumb(t.sprite) : null} />
            ))}
          </div>
        </SidebarSection>
      )}

      {isApiConfigured() && (
        <SidebarSection title="Base de dades" icon={<Cloud size={13} />} count={dbEnemies.length} defaultOpen bodyPadding="0 8px 8px">
          {dbLoading && <div style={{ fontSize: FS.xs, color: C.dim }}>carregant…</div>}
          {!dbLoading && dbEnemies.length === 0 && (
            <div style={{ fontSize: FS.xs, color: C.dim }}>Cap enemic a la BD</div>
          )}
          {dbEnemies.length > 0 && (
            <EnemyGroupToolbar by={grouping.by} onBy={grouping.setBy}
              allFolded={groups.length > 0 && groups.every(g => grouping.isCollapsed(g.key))}
              onFoldAll={fold => grouping.foldAll(groups.map(g => g.key), fold)} />
          )}
          {dbEnemies.length > 0 && grouping.by === 'none' && (
            <div style={{ ...DB_GRID, marginTop: 6 }}>{dbEnemies.map(dbButton)}</div>
          )}
          {groups.map(g => {
            const open = !grouping.isCollapsed(g.key);
            return (
              <div key={`g:${g.key}`} style={{ marginTop: 4, borderTop: `1px solid ${C.border}` }}>
                <GroupHeader label={g.label} count={g.items.length} open={open} unnamed={!g.key}
                  onToggle={() => grouping.toggle(g.key)} />
                <GroupBody open={open}>
                  <div style={{ ...DB_GRID, paddingBottom: 2 }}>{g.items.map(dbButton)}</div>
                </GroupBody>
              </div>
            );
          })}
        </SidebarSection>
      )}
    </>
  );
}
