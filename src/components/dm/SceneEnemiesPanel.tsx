'use client';
import React, { useState } from 'react';
import { Eye, EyeOff, Trash2, SkullIcon, Shield } from '@/components/icons';
import { C, FS, RADIUS, tint } from '@/constants';
import { SidebarSection, SectionButton } from '@/components/ui/SidebarSection';
import { HpControl } from '@/components/ui/HpControl';
import type { DefeatedMap, LibEnemy } from '@/types';
import { creatureThumb } from '@/lib/sprites/draw';
import { useSpritePack } from '@/hooks/useSpritePack';

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
  /** App Píxel: la figureta com a miniatura (com les DIVAS). */
  pixel?: boolean;
}

/**
 * Fila d'un enemic o aliat de l'escena, amb el mateix format que la de les DIVAS: miniatura
 * (figureta a l'app Píxel, imatge o inicials a la Clàssica) amb la vora del seu color, l'ull
 * just al costat, el nom i la vida. L'acció secundària (treure'l de l'escena) surt en passar-hi
 * el cursor.
 */
function EnemyRow({ en, pixel, visible, defeated, selected, hp, hpMax, onSelect, onMenu, onToggleVis, onAdjustHp, onRemove, removeTitle }: {
  en: LibEnemy; pixel?: boolean; visible: boolean; defeated: boolean; selected: boolean;
  hp: number; hpMax: number;
  onSelect: () => void; onMenu: (x: number, y: number) => void; onToggleVis: () => void; onAdjustHp?: (d: number) => void;
  onRemove: () => void; removeTitle: string;
}) {
  const [hover, setHover] = useState(false);
  const thumb = pixel && en.sprite ? creatureThumb(en.sprite) : null;
  const img = thumb ?? en.imageData;
  return (
    <div onClick={onSelect} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onContextMenu={e => { e.preventDefault(); onMenu(e.clientX, e.clientY); }}
      title="Clic per seleccionar-lo · clic dret per editar-lo"
      style={{
        display: 'flex', alignItems: 'center', gap: 7, minHeight: 32, padding: '2px 6px 2px 4px',
        cursor: 'pointer', borderRadius: RADIUS.sm,
        background: selected ? tint(C.room, 0.12) : hover ? 'rgba(255,255,255,0.03)' : 'transparent',
      }}>
      <span aria-hidden style={{
        width: 22, height: 22, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: thumb ? RADIUS.sm : '50%', background: img ? C.dark : en.color, boxShadow: `0 0 0 1.5px ${en.color}`,
        color: '#fff', fontSize: 9, fontWeight: 800, opacity: !visible || defeated ? 0.5 : 1,
      }}>
        {img
          ? <img src={img} alt="" style={{ width: 22, height: 22, imageRendering: thumb ? 'pixelated' : 'auto', objectFit: 'cover', display: 'block' }} />
          : en.name.trim().slice(0, 2).toUpperCase()}
      </span>
      <button onClick={e => { e.stopPropagation(); onToggleVis(); }}
        title={visible ? 'Els jugadors el veuen · clic per amagar-lo' : 'Amagat als jugadors · clic per mostrar-lo'}
        style={{ background: 'none', border: 'none', padding: 1, margin: '0 -3px', cursor: 'pointer', color: visible ? C.text : C.dim, display: 'flex', flexShrink: 0 }}>
        {visible ? <Eye size={12} /> : <EyeOff size={12} />}
      </button>
      <span title={en.name} style={{
        flex: 1, minWidth: 0, fontSize: FS.sm, fontWeight: 700, color: defeated || !visible ? C.dim : C.text,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textDecoration: defeated ? 'line-through' : 'none',
      }}>{en.name}</span>
      {hover && (
        <button onClick={e => { e.stopPropagation(); onRemove(); }} title={removeTitle}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: tint(C.enemy, 0.75), padding: 1, display: 'flex', flexShrink: 0 }}>
          <Trash2 size={11} />
        </button>
      )}
      {/* Amplada fixa: les vides queden alineades en columna encara que els noms variïn. */}
      <div onClick={e => e.stopPropagation()} style={{ width: 104, flexShrink: 0, display: 'flex', opacity: !visible || defeated ? 0.6 : 1 }}>
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
  onToggleLibVis, onAdjustLibHp, onRemoveLib, onOpenLibrary, pixel,
}: Props) {
  useSpritePack();
  const enemies = libEnemies.filter(e => !e.ally);
  const allies = libEnemies.filter(e => e.ally);
  const total = enemies.length;
  const rows = (list: LibEnemy[]) => list.map(en => (
    <EnemyRow key={en.id} en={en} pixel={pixel}
      visible={en.visible !== false} defeated={!!defeated[`lib_${en.id}`]} selected={selectedToken === `lib_${en.id}`}
      hp={en.hp ?? en.hpMax} hpMax={en.hpMax}
      onSelect={() => onSelect(`lib_${en.id}`)} onMenu={(x, y) => onMenu(`lib_${en.id}`, x, y)} onToggleVis={() => onToggleLibVis(en.id)}
      onAdjustHp={d => onAdjustLibHp(en.id, d)}
      onRemove={() => onRemoveLib(en.id)} removeTitle="Treure de l'escena" />
  ));

  return (
    <>
      <SidebarSection title="Enemics" icon={<SkullIcon size={13} />} count={total} bodyPadding="0 6px 8px"
        actions={<SectionButton onClick={onOpenLibrary} title="Afegir enemics des de la Biblioteca">＋</SectionButton>}>
        {total === 0 && (
          <div style={{ padding: '2px 8px 4px', fontSize: FS.sm, color: C.dim, lineHeight: 1.5 }}>
            Cap enemic
          </div>
        )}
        {rows(enemies)}
      </SidebarSection>
      {allies.length > 0 && (
        <SidebarSection title="Aliats" icon={<Shield size={13} />} count={allies.length} bodyPadding="0 6px 8px">
          {rows(allies)}
        </SidebarSection>
      )}
    </>
  );
}
