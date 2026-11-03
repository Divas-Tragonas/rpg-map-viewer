'use client';
import { ENEMY_TEMPLATES, creatureTemplate, extraCreatures, type EnemyTemplate } from '@/lib/bestiary';
import React, { useEffect, useMemo, useState } from 'react';
import { BookIcon, DatabaseIcon, Shield } from '@/components/icons';
import { C, FS, RADIUS } from '@/constants';
import { SidebarSection } from '@/components/ui/SidebarSection';
import { api, isApiConfigured } from '@/lib/api';
import { creatureThumb, creatureNames } from '@/lib/sprites/draw';
import { useSpritePack } from '@/hooks/useSpritePack';
import type { ApiEnemy } from '@/lib/api';
import { groupKey } from '@/lib/enemy-groups';
import type { LibEnemy } from '@/types';

interface Props {
  /** Enemics ja afegits a l'escena: només per mostrar quants n'hi ha de cada plantilla. */
  libEnemies: LibEnemy[];
  onAddEnemy: (tmpl: EnemyTemplate) => void;
  onAddDbEnemy: (enemy: ApiEnemy) => void;
  /** App Píxel: figureta a les plantilles i el bestiari sencer del paquet Oryx. */
  pixel?: boolean;
}

function TemplateButton({ name, color, hpMax, inScene, onClick, thumb, detail, fromDb }: { name: string; color: string; hpMax: number; inScene: number; onClick: () => void; thumb?: string | null; detail?: string; fromDb?: boolean }) {
  return (
    <button onClick={onClick} title={`Afegir ${name} a l'escena (${hpMax} de vida${detail ? ` · ${detail}` : ''}${fromDb ? ' · de la base de dades' : ''})`}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '5px 7px', minWidth: 0,
        // Els noms llargs (sobretot els de la BD) ocupen la fila sencera en lloc de quedar tallats.
        gridColumn: name.length > 13 ? 'span 2' : undefined,
        background: 'rgba(255,255,255,.04)', border: `1px solid ${C.border}`,
        borderRadius: RADIUS.sm, cursor: 'pointer', color: C.text, fontSize: FS.sm, textAlign: 'left',
      }}>
      {thumb
        ? <img src={thumb} alt="" style={{ width: 20, height: 20, margin: -4, imageRendering: 'pixelated', flexShrink: 0, objectFit: 'cover', borderRadius: fromDb ? '50%' : 0 }} />
        : <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0 }} />}
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      {fromDb && <span style={{ color: C.dim, display: 'flex', flexShrink: 0 }}><DatabaseIcon size={11} /></span>}
      {inScene > 0
        ? <span title={`${inScene} a l'escena`} style={{ color: C.enemy, fontSize: FS.xs, fontWeight: 700 }}>×{inScene}</span>
        : <span style={{ color: C.dim, fontSize: FS.xs }}>{hpMax}</span>}
    </button>
  );
}

// `minmax(0, 1fr)`: amb `1fr` a pèl la columna no baixa de la mida del nom més llarg i la graella
// sortia del lateral.
const GRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 3 };

const CASTLE = 'Castell de la Fumarola';
const BESTIARY = 'Bestiari';

/** Una entrada del bestiari únic: plantilla del codi o enemic de la BD (`db`, només amb connexió). */
interface Entry { t: EnemyTemplate; db?: ApiEnemy; group: string }

/** Enemic de la BD com a plantilla (per a la cerca i el botó). El grup és el seu projecte. */
function dbEntry(en: ApiEnemy): Entry {
  const detail = [en.project, en.category].map(v => v?.trim()).filter(Boolean).join(' · ') || undefined;
  return {
    t: { id: en.id, name: en.name, color: en.color, hpMax: en.hpMax, R: en.R, sm: en.sm, xp: en.xp ?? 0, group: BESTIARY, detail },
    db: en,
    group: en.project?.trim() || BESTIARY,
  };
}

/**
 * Pestanya Biblioteca: plantilles per AFEGIR enemics. Els que ja són a l'escena es gestionen
 * (vida, visibilitat, eliminar) a la pestanya Escena, junt amb els jugadors.
 *
 * Un sol bestiari: les plantilles del codi i, si hi ha connexió amb la API, els enemics de la BD
 * barrejats per projecte (amb la icona de la BD). Sense connexió, els de la BD simplement no hi són.
 * Els aliats van a part.
 */
export function EnemyLibraryPanel({ libEnemies, onAddEnemy, onAddDbEnemy, pixel }: Props) {
  useSpritePack();
  const [beastQ, setBeastQ] = useState('');
  const [dbEnemies, setDbEnemies] = useState<ApiEnemy[]>([]);
  // `isApiConfigured` és una variable d'entorn pública: dona el mateix al servidor i al client.
  const [dbLoading, setDbLoading] = useState(isApiConfigured);

  useEffect(() => {
    if (!isApiConfigured()) return;
    api.enemies.list()
      .then(setDbEnemies)
      .catch(() => {})   // sense connexió: el bestiari queda només amb les plantilles del codi
      .finally(() => setDbLoading(false));
  }, []);

  const countOf = (templateId: string) => libEnemies.filter(e => e.templateId === templateId).length;
  const entries = useMemo<Entry[]>(() => [
    ...ENEMY_TEMPLATES.map(t => ({ t, group: t.group })),
    ...(pixel ? extraCreatures(creatureNames()).map(creatureTemplate).map(t => ({ t, group: t.group })) : []),
    ...dbEnemies.map(dbEntry),
  ], [pixel, dbEnemies]);
  const q = beastQ.trim().toLowerCase().replace(/_/g, ' ');
  const shown = entries.filter(({ t, group }) => !q
    || `${t.name} ${t.detail ?? ''} ${t.sprite ?? ''} ${group}`.toLowerCase().replace(/_/g, ' ').includes(q));
  const allyList = shown.filter(e => e.t.ally);
  const foes = shown.filter(e => !e.t.ally);

  // Grups: el Castell primer, els projectes de la BD per ordre alfabètic i el Bestiari l'últim.
  // Mateixa clau que el back office (`groupKey`): «Cripta» i «cripta » van junts.
  const groups = new Map<string, { label: string; items: Entry[] }>();
  for (const e of foes) {
    const k = groupKey(e.group);
    const g = groups.get(k) ?? { label: e.group, items: [] };
    g.items.push(e); groups.set(k, g);
  }
  const rank = (label: string) => label === CASTLE ? 0 : label === BESTIARY ? 2 : 1;
  const ordered = [...groups.values()].sort((a, b) => rank(a.label) - rank(b.label) || a.label.localeCompare(b.label, 'ca'));
  for (const g of ordered) {
    if (g.label !== CASTLE) g.items.sort((x, y) => x.t.name.localeCompare(y.t.name, 'ca'));
  }

  const button = ({ t, db }: Entry) => (
    <TemplateButton key={db ? `db:${t.id}` : t.id} name={t.name} color={t.color} hpMax={t.hpMax} detail={t.detail}
      inScene={countOf(t.id)} fromDb={!!db}
      onClick={() => (db ? onAddDbEnemy(db) : onAddEnemy(t))}
      thumb={db ? (db.imageData || null) : (pixel && t.sprite ? creatureThumb(t.sprite) : null)} />
  );
  const templateGroup = (label: string, items: Entry[]) => (
    <div key={label} style={{ marginTop: 6 }}>
      <div style={{ fontSize: FS.xs, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, margin: '2px 0 4px' }}>{label} · {items.length}</div>
      <div style={GRID}>{items.map(button)}</div>
    </div>
  );

  return (
    <>
      <SidebarSection title="Enemics" icon={<BookIcon size={13} />} count={foes.length} defaultOpen maxBodyHeight={420} bodyPadding="0 8px 8px">
        <input value={beastQ} onChange={e => setBeastQ(e.target.value)} placeholder="Cerca (goblin, Jalil, dragon…)"
          style={{ width: '100%', boxSizing: 'border-box', height: 26, margin: '2px 0 6px', padding: '0 8px', borderRadius: RADIUS.sm, border: `1px solid ${C.border}`, background: C.dark, color: C.bright, fontSize: FS.sm, outline: 'none' }} />
        {dbLoading && <div style={{ fontSize: FS.xs, color: C.dim }}>carregant la base de dades…</div>}
        {foes.length === 0 && <div style={{ fontSize: FS.xs, color: C.dim }}>Cap resultat</div>}
        {ordered.map(g => templateGroup(g.label, g.items))}
      </SidebarSection>
      {allyList.length > 0 && (
        <SidebarSection title="Aliats" icon={<Shield size={13} />} count={allyList.length} defaultOpen bodyPadding="0 8px 8px">
          <div style={GRID}>{allyList.map(button)}</div>
        </SidebarSection>
      )}
    </>
  );
}
