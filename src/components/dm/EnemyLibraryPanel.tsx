'use client';
import React, { useEffect, useState } from 'react';
import { ENEMY_TEMPLATES, C, FS, RADIUS } from '@/constants';
import { SidebarSection } from '@/components/ui/SidebarSection';
import { api, isApiConfigured } from '@/lib/api';
import type { ApiEnemy } from '@/lib/api';
import type { LibEnemy } from '@/types';

interface Props {
  /** Enemics ja afegits a l'escena: només per mostrar quants n'hi ha de cada plantilla. */
  libEnemies: LibEnemy[];
  onAddEnemy: (tmpl: typeof ENEMY_TEMPLATES[number]) => void;
  onAddDbEnemy: (enemy: ApiEnemy) => void;
}

function TemplateButton({ name, color, hpMax, inScene, onClick }: { name: string; color: string; hpMax: number; inScene: number; onClick: () => void }) {
  return (
    <button onClick={onClick} title={`Afegir ${name} a l'escena (${hpMax} de vida)`}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '5px 7px',
        background: 'rgba(255,255,255,.04)', border: `1px solid ${C.border}`,
        borderRadius: RADIUS.sm, cursor: 'pointer', color: C.text, fontSize: FS.sm, textAlign: 'left',
      }}>
      <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      {inScene > 0
        ? <span title={`${inScene} a l'escena`} style={{ color: C.enemy, fontSize: FS.xs, fontWeight: 700 }}>×{inScene}</span>
        : <span style={{ color: C.dim, fontSize: FS.xs }}>{hpMax}</span>}
    </button>
  );
}

/**
 * Pestanya Biblioteca: plantilles per AFEGIR enemics. Els que ja són a l'escena es gestionen
 * (vida, visibilitat, eliminar) a la pestanya Escena, junt amb els del PSD i els jugadors.
 */
export function EnemyLibraryPanel({ libEnemies, onAddEnemy, onAddDbEnemy }: Props) {
  const [dbEnemies, setDbEnemies] = useState<ApiEnemy[]>([]);
  const [dbLoading, setDbLoading] = useState(false);

  useEffect(() => {
    if (!isApiConfigured()) return;
    setDbLoading(true);
    api.enemies.list()
      .then(setDbEnemies)
      .catch(() => {})
      .finally(() => setDbLoading(false));
  }, []);

  const countOf = (templateId: string) => libEnemies.filter(e => e.templateId === templateId).length;

  return (
    <>
      <div style={{ padding: '8px 12px 2px', fontSize: FS.sm, color: C.dim, lineHeight: 1.45 }}>
        Clica una plantilla per afegir-la al centre de la vista. Després la trobaràs a <b style={{ color: C.text }}>Escena</b>.
      </div>
      <SidebarSection title="Plantilles" icon="📖" defaultOpen bodyPadding="0 8px 8px">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          {ENEMY_TEMPLATES.map(tmpl => (
            <TemplateButton key={tmpl.id} name={tmpl.name} color={tmpl.color} hpMax={tmpl.hpMax}
              inScene={countOf(tmpl.id)} onClick={() => onAddEnemy(tmpl)} />
          ))}
        </div>
      </SidebarSection>

      {isApiConfigured() && (
        <SidebarSection title="Base de dades" icon="☁" count={dbEnemies.length} defaultOpen bodyPadding="0 8px 8px">
          {dbLoading && <div style={{ fontSize: FS.xs, color: C.dim }}>carregant…</div>}
          {!dbLoading && dbEnemies.length === 0 && (
            <div style={{ fontSize: FS.xs, color: C.dim }}>Cap enemic a la BD</div>
          )}
          {dbEnemies.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
              {dbEnemies.map(en => (
                <TemplateButton key={en.id} name={en.name} color={en.color} hpMax={en.hpMax}
                  inScene={countOf(en.id)} onClick={() => onAddDbEnemy(en)} />
              ))}
            </div>
          )}
        </SidebarSection>
      )}
    </>
  );
}
