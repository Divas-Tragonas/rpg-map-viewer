'use client';
import React, { useState } from 'react';
import { UserPlus, LockIcon } from '@/components/icons';
import { C, FS, RADIUS, PALETTE, tint } from '@/constants';
import { SidebarSection, SectionButton } from '@/components/ui/SidebarSection';
import { HpControl } from '@/components/ui/HpControl';
import { IconButton } from '@/components/ui/Button';
import type { DefeatedMap, Player } from '@/types';

interface Props {
  players: Player[];
  newPName: string; setNewPName: (v: string) => void;
  newPColor: string; setNewPColor: (v: string) => void;
  newPHpMax: number; setNewPHpMax: (v: number) => void;
  onAdd: () => void;
  onAdjustHp: (id: number, delta: number) => void;
  onLoadParty: () => void;
  /** Token seleccionat i com seleccionar-ne un. */
  selectedToken: string | number | null;
  onSelect: (id: string) => void;
  /** Clic dret a la fila: el mateix menú que al mapa (vida, fitxa, estats…). */
  onMenu: (id: string, x: number, y: number) => void;
  defeated: DefeatedMap;
}

/**
 * Fila d'un jugador: inicials amb el seu color, nom, 🔒 si no es pot moure des de la seva
 * pantalla i la vida. Fa la mateixa alçada que les files d'enemics (abans era una targeta
 * de 68 px amb un engranatge i, amb cinc jugadors, els enemics quedaven fora de la vista).
 * Clic selecciona el token; clic dret obre el seu menú, amb la fitxa (vida màxima, velocitat,
 * visió…), com fer clic dret al token al mapa.
 */
function PlayerRow({ pl, selected, defeated, onSelect, onMenu, onAdjustHp }: {
  pl: Player; selected: boolean; defeated: boolean;
  onSelect: () => void; onMenu: (x: number, y: number) => void; onAdjustHp: (delta: number) => void;
}) {
  const [hover, setHover] = useState(false);
  const hp = pl.hp ?? pl.hpMax;
  return (
    <div onClick={onSelect} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onContextMenu={e => { e.preventDefault(); onMenu(e.clientX, e.clientY); }}
      title="Clic per seleccionar-lo · clic dret per editar-lo"
      style={{
        display: 'flex', alignItems: 'center', gap: 7, minHeight: 32, padding: '2px 6px 2px 4px', cursor: 'pointer',
        borderRadius: RADIUS.sm, background: selected ? tint(C.room, 0.12) : hover ? 'rgba(255,255,255,0.03)' : 'transparent',
        opacity: defeated ? 0.55 : 1,
      }}>
      <span aria-hidden style={{ width: 22, height: 22, borderRadius: '50%', background: pl.color, color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {pl.name.trim().slice(0, 2).toUpperCase()}
      </span>
      <span title={pl.name} style={{
        flex: 1, minWidth: 0, fontSize: FS.sm, fontWeight: 700, color: defeated ? C.dim : C.text,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: defeated ? 'line-through' : 'none',
      }}>{pl.name}</span>
      {pl.canMove === false && <span title="No es pot moure des de la pantalla de jugador" style={{ display: 'flex', color: C.dim, flexShrink: 0 }}><LockIcon size={11} /></span>}
      {/* Mateixa amplada que la vida de les files d'enemics: totes les vides queden en columna. */}
      <div onClick={e => e.stopPropagation()} style={{ width: 104, flexShrink: 0, display: 'flex' }}>
        <HpControl hp={hp} hpMax={pl.hpMax} onAdjust={onAdjustHp} size="sm" />
      </div>
    </div>
  );
}

export function PlayersPanel({ players, newPName, setNewPName, newPColor, setNewPColor, newPHpMax, setNewPHpMax, onAdd, onAdjustHp, onLoadParty, selectedToken, onSelect, onMenu, defeated }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  return (
    <SidebarSection title="Jugadors" icon="🧙" count={players.length} countColor={C.hpHigh} bodyPadding="0 6px 8px"
      actions={
        <>
          <SectionButton onClick={() => setAddOpen(o => !o)} active={addOpen} title="Afegir un jugador nou">＋</SectionButton>
          <SectionButton onClick={onLoadParty} title="Carrega els 5 jugadors per defecte">Party</SectionButton>
        </>
      }>
      {/* El formulari d'alta només ocupa espai quan el vols: la majoria del temps el que
          importa d'aquest panell són les targetes de vida. */}
      <div style={{ display: 'grid', gridTemplateRows: addOpen ? '1fr' : '0fr', transition: 'grid-template-rows .2s ease' }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 4, paddingTop: 2 }}>
            <input value={newPName} onChange={e => setNewPName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onAdd()} placeholder="Nom"
              style={{ flex: 1, minWidth: 0, background: C.bg, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, padding: '3px 6px', color: C.text, fontSize: FS.sm, outline: 'none' }} />
            <input type="number" min={1} max={999} value={newPHpMax} onChange={e => setNewPHpMax(parseInt(e.target.value) || 20)}
              title="Vida màxima"
              style={{ width: 40, background: C.bg, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, padding: '3px 3px', color: C.hpHigh, fontSize: FS.sm, outline: 'none', textAlign: 'center' }} />
            <IconButton size={22} variant="primary" onClick={onAdd} title="Afegir jugador">
              <UserPlus size={11} />
            </IconButton>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
            {PALETTE.map(c => (
              <div key={c} onClick={() => setNewPColor(c)}
                style={{ width: 14, height: 14, borderRadius: '50%', background: c, cursor: 'pointer', border: `2px solid ${newPColor === c ? C.bright : 'transparent'}`, flexShrink: 0 }} />
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {players.map(pl => (
          <PlayerRow key={pl.id} pl={pl}
            selected={selectedToken === `pl_${pl.id}`} defeated={!!defeated[`pl_${pl.id}`]}
            onSelect={() => onSelect(`pl_${pl.id}`)} onMenu={(x, y) => onMenu(`pl_${pl.id}`, x, y)} onAdjustHp={d => onAdjustHp(pl.id, d)} />
        ))}
      </div>
      {players.length === 0 && !addOpen && (
        <div style={{ padding: '4px 0 2px', fontSize: FS.sm, color: C.dim, lineHeight: 1.5 }}>
          Encara no hi ha cap jugador. Prem <b style={{ color: C.text }}>Party</b> per carregar el grup de la campanya o <b style={{ color: C.text }}>＋</b> per afegir-ne un.
        </div>
      )}
    </SidebarSection>
  );
}
