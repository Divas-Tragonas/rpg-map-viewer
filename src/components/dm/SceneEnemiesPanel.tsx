'use client';
import React, { useState } from 'react';
import { Eye, EyeOff, RotateCcw, Trash2, ChevronDown, ChevronRight } from '@/components/icons';
import { C, FS, RADIUS, tint } from '@/constants';
import { SidebarSection, SectionButton } from '@/components/ui/SidebarSection';
import { HpControl } from '@/components/ui/HpControl';
import type { MapStructure, VisMap, PSDLayer, PsdEnemyOverrides, DefeatedMap, LibEnemy } from '@/types';

interface Props {
  /** Estructura del PSD real (null si el mapa és només una imatge). */
  struct: MapStructure | null;
  vis: VisMap;
  psdEnemyOverrides: PsdEnemyOverrides;
  libEnemies: LibEnemy[];
  defeated: DefeatedMap;
  selectedToken: string | number | null;
  onSelect: (id: string | number) => void;
  onTogglePsdVis: (id: number) => void;
  onAdjustPsdHp: (id: number, delta: number) => void;
  onResetPsd: (en: PSDLayer) => void;
  onDeletePsd: (id: number) => void;
  onToggleLibVis: (id: number) => void;
  onAdjustLibHp: (id: number, delta: number) => void;
  onRemoveLib: (id: number) => void;
  /** Porta a la pestanya Biblioteca per afegir-ne més. */
  onOpenLibrary: () => void;
}

/**
 * Fila prima d'un enemic de l'escena: ull, color, nom i vida, en ~28 px d'alçada perquè se
 * n'hi puguin apilar molts. La vida és el mateix `HpControl` que la targeta de jugador, en
 * mida `sm`. Les accions secundàries (reposicionar, eliminar) surten en passar-hi el cursor.
 */
function EnemyRow({ name, color, visible, defeated, selected, hp, hpMax, indent = 0, onSelect, onToggleVis, onAdjustHp, onReset, onRemove, removeTitle }: {
  name: string; color: string; visible: boolean; defeated: boolean; selected: boolean;
  hp: number; hpMax: number; indent?: number;
  onSelect: () => void; onToggleVis: () => void; onAdjustHp?: (d: number) => void;
  onReset?: () => void; onRemove: () => void; removeTitle: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onSelect} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5, minHeight: 28, padding: `2px 6px 2px ${8 + indent}px`,
        cursor: 'pointer', borderRadius: RADIUS.sm,
        background: selected ? tint(C.room, 0.12) : hover ? 'rgba(255,255,255,0.03)' : 'transparent',
        opacity: !visible || defeated ? 0.5 : 1,
      }}>
      <button onClick={e => { e.stopPropagation(); onToggleVis(); }}
        title={visible ? 'Els jugadors el veuen · clic per amagar-lo' : 'Amagat als jugadors · clic per mostrar-lo'}
        style={{ background: 'none', border: 'none', padding: 1, cursor: 'pointer', color: visible ? C.text : C.dim, display: 'flex', flexShrink: 0 }}>
        {visible ? <Eye size={12} /> : <EyeOff size={12} />}
      </button>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span title={name} style={{
        flex: 1, minWidth: 0, fontSize: FS.sm, color: defeated ? C.dim : C.text,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textDecoration: defeated ? 'line-through' : 'none',
      }}>{name}</span>
      {hover && onReset && (
        <button onClick={e => { e.stopPropagation(); onReset(); }} title="Tornar-lo a la posició del PSD"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: 1, display: 'flex', flexShrink: 0 }}>
          <RotateCcw size={11} />
        </button>
      )}
      {hover && (
        <button onClick={e => { e.stopPropagation(); onRemove(); }} title={removeTitle}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: tint(C.enemy, 0.75), padding: 1, display: 'flex', flexShrink: 0 }}>
          <Trash2 size={11} />
        </button>
      )}
      {/* Amplada fixa: les vides queden alineades en columna encara que els noms variïn. */}
      <div onClick={e => e.stopPropagation()} style={{ width: 104, flexShrink: 0, display: 'flex' }}>
        {hpMax > 0 && onAdjustHp
          ? <HpControl hp={hp} hpMax={hpMax} onAdjust={onAdjustHp} size="sm" />
          : <span title="Sense vida: posa-li vida màxima amb el clic dret sobre el token"
              style={{ flex: 1, textAlign: 'center', fontSize: FS.xs, color: tint(C.dim, 0.6) }}>—</span>}
      </div>
    </div>
  );
}

function GroupHeader({ name, count, total, open, onToggle, indent = 0 }: {
  name: string; count: number; total: number; open: boolean; onToggle: () => void; indent?: number;
}) {
  return (
    <button onClick={onToggle}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 5, padding: `4px 8px 4px ${6 + indent}px`, background: 'transparent', border: 'none', cursor: 'pointer' }}>
      {open ? <ChevronDown size={11} color={C.dim} /> : <ChevronRight size={11} color={C.dim} />}
      <span style={{ flex: 1, textAlign: 'left', fontSize: FS.xs, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
      <span style={{ fontSize: FS.xs, color: C.dim }}>{count}/{total}</span>
    </button>
  );
}

/**
 * Tots els enemics que hi ha a l'escena, vinguin del PSD o de la biblioteca. Abans vivien
 * en dues pestanyes diferents segons d'on sortien (els del PSD a «Mapa», dins de l'arbre de
 * capes; els de la biblioteca a «Enemics»), i per seguir un combat calia saltar entre totes dues.
 */
export function SceneEnemiesPanel({
  struct, vis, psdEnemyOverrides, libEnemies, defeated, selectedToken, onSelect,
  onTogglePsdVis, onAdjustPsdHp, onResetPsd, onDeletePsd,
  onToggleLibVis, onAdjustLibHp, onRemoveLib, onOpenLibrary,
}: Props) {
  // Grups plegats (per id de grup del PSD; la clau 'lib' és el grup de la biblioteca).
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setClosed(c => ({ ...c, [k]: !c[k] }));

  const rooms = struct?.enemyRooms ?? [];
  const psdTotal = rooms.reduce((n, r) => n + r.enemies.length, 0);
  const total = psdTotal + libEnemies.length;

  const psdRow = (en: PSDLayer, indent: number) => {
    const ov = psdEnemyOverrides[en.id];
    const hpMax = ov?.hpMax || 0;
    return (
      <EnemyRow key={en.id} indent={indent}
        name={ov?.name ?? en.name} color={C.enemy}
        visible={!!vis[en.id]} defeated={!!defeated[String(en.id)]} selected={selectedToken === en.id}
        hp={hpMax > 0 ? Math.max(0, ov?.hp ?? hpMax) : 0} hpMax={hpMax}
        onSelect={() => onSelect(en.id)} onToggleVis={() => onTogglePsdVis(en.id)}
        onAdjustHp={d => onAdjustPsdHp(en.id, d)}
        onReset={() => onResetPsd(en)} onRemove={() => onDeletePsd(en.id)} removeTitle="Eliminar la capa" />
    );
  };

  return (
    <SidebarSection title="Enemics" icon="⚔" count={total} countColor={C.enemy} bodyPadding="0 4px 8px"
      actions={<SectionButton onClick={onOpenLibrary} title="Afegir enemics des de la Biblioteca">＋</SectionButton>}>
      {total === 0 && (
        <div style={{ padding: '2px 8px 4px', fontSize: FS.sm, color: C.dim, lineHeight: 1.5 }}>
          Cap enemic a l&apos;escena. Afegeix-ne des de la <b style={{ color: C.text, cursor: 'pointer' }} onClick={onOpenLibrary}>Biblioteca</b>.
        </div>
      )}

      {rooms.map(room => {
        const k = `r${room.id}`;
        return (
          <div key={k}>
            <GroupHeader name={room.name} count={room.enemies.filter(en => vis[en.id]).length} total={room.enemies.length}
              open={!closed[k]} onToggle={() => toggle(k)} />
            {!closed[k] && (
              <>
                {(room.directEnemies || room.enemies).map(en => psdRow(en, 8))}
                {(room.subGroups || []).map(sg => {
                  const sk = `s${sg.id}`;
                  return (
                    <div key={sk}>
                      <GroupHeader name={sg.name} count={sg.enemies.filter(en => vis[en.id]).length} total={sg.enemies.length}
                        open={!closed[sk]} onToggle={() => toggle(sk)} indent={10} />
                      {!closed[sk] && sg.enemies.map(en => psdRow(en, 18))}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        );
      })}

      {libEnemies.length > 0 && (
        <div>
          {rooms.length > 0 && (
            <GroupHeader name="Afegits" count={libEnemies.filter(en => en.visible !== false).length} total={libEnemies.length}
              open={!closed.lib} onToggle={() => toggle('lib')} />
          )}
          {(!closed.lib || rooms.length === 0) && libEnemies.map(en => (
            <EnemyRow key={en.id} indent={rooms.length > 0 ? 8 : 0}
              name={en.name} color={en.color}
              visible={en.visible !== false} defeated={!!defeated[`lib_${en.id}`]} selected={selectedToken === `lib_${en.id}`}
              hp={en.hp ?? en.hpMax} hpMax={en.hpMax}
              onSelect={() => onSelect(`lib_${en.id}`)} onToggleVis={() => onToggleLibVis(en.id)}
              onAdjustHp={d => onAdjustLibHp(en.id, d)}
              onRemove={() => onRemoveLib(en.id)} removeTitle="Treure de l'escena" />
          ))}
        </div>
      )}
    </SidebarSection>
  );
}
