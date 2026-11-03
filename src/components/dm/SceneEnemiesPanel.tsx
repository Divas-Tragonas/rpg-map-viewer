'use client';
import React, { useState } from 'react';
import { Eye, EyeOff, Trash2, SkullIcon, Shield } from '@/components/icons';
import { C, FS, RADIUS, tint } from '@/constants';
import { SidebarSection, SectionButton } from '@/components/ui/SidebarSection';
import { HpControl } from '@/components/ui/HpControl';
import type { DefeatedMap, LibEnemy } from '@/types';

interface Props {
  libEnemies: LibEnemy[];
  defeated: DefeatedMap;
  selectedToken: string | number | null;
  onSelect: (id: string | number) => void;
  /** Clic dret a la fila: el mateix menú que al mapa (vida, fitxa, estats…). */
  onMenu: (id: string | number, x: number, y: number) => void;
  onToggleLibVis: (id: number) => void;
  onAdjustLibHp: (id: number, delta: number) => void;
  onRemoveLib: (id: number) => void;
  /** Porta a la pestanya Biblioteca per afegir-ne més. */
  onOpenLibrary: () => void;
}

/**
 * Fila prima d'un enemic de l'escena: ull, color, nom i vida, en ~28 px d'alçada perquè se
 * n'hi puguin apilar molts. La vida és el mateix `HpControl` que la fila de jugador, en
 * mida `sm`. L'acció secundària (treure'l de l'escena) surt en passar-hi el cursor.
 */
function EnemyRow({ name, color, visible, defeated, selected, hp, hpMax, indent = 0, onSelect, onMenu, onToggleVis, onAdjustHp, onRemove, removeTitle }: {
  name: string; color: string; visible: boolean; defeated: boolean; selected: boolean;
  hp: number; hpMax: number; indent?: number;
  onSelect: () => void; onMenu: (x: number, y: number) => void; onToggleVis: () => void; onAdjustHp?: (d: number) => void;
  onRemove: () => void; removeTitle: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onSelect} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onContextMenu={e => { e.preventDefault(); onMenu(e.clientX, e.clientY); }}
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
          : <span title="Sense vida: clic dret a la fila i posa-li vida màxima"
              style={{ flex: 1, textAlign: 'center', fontSize: FS.xs, color: tint(C.dim, 0.6) }}>—</span>}
      </div>
    </div>
  );
}

/** Tots els enemics que hi ha a l'escena, en files primes. */
export function SceneEnemiesPanel({
  libEnemies, defeated, selectedToken, onSelect, onMenu,
  onToggleLibVis, onAdjustLibHp, onRemoveLib, onOpenLibrary,
}: Props) {
  const enemies = libEnemies.filter(e => !e.ally);
  const allies = libEnemies.filter(e => e.ally);
  const total = enemies.length;
  const rows = (list: LibEnemy[]) => list.map(en => (
    <EnemyRow key={en.id}
      name={en.name} color={en.color}
      visible={en.visible !== false} defeated={!!defeated[`lib_${en.id}`]} selected={selectedToken === `lib_${en.id}`}
      hp={en.hp ?? en.hpMax} hpMax={en.hpMax}
      onSelect={() => onSelect(`lib_${en.id}`)} onMenu={(x, y) => onMenu(`lib_${en.id}`, x, y)} onToggleVis={() => onToggleLibVis(en.id)}
      onAdjustHp={d => onAdjustLibHp(en.id, d)}
      onRemove={() => onRemoveLib(en.id)} removeTitle="Treure de l'escena" />
  ));

  return (
    <>
      <SidebarSection title="Enemics" icon={<SkullIcon size={13} />} count={total} bodyPadding="0 4px 8px"
        actions={<SectionButton onClick={onOpenLibrary} title="Afegir enemics des de la Biblioteca">＋</SectionButton>}>
        {total === 0 && (
          <div style={{ padding: '2px 8px 4px', fontSize: FS.sm, color: C.dim, lineHeight: 1.5 }}>
            Cap enemic
          </div>
        )}
        {rows(enemies)}
      </SidebarSection>
      {allies.length > 0 && (
        <SidebarSection title="Aliats" icon={<Shield size={13} />} count={allies.length} bodyPadding="0 4px 8px">
          {rows(allies)}
        </SidebarSection>
      )}
    </>
  );
}
