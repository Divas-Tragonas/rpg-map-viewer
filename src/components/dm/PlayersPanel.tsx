'use client';
import React, { useState } from 'react';
import { UserPlus, X, GearIcon } from '@/components/icons';
import { C, FS, RADIUS, PALETTE, DEFAULT_SPEED_FT, DEFAULT_VISION_FT } from '@/constants';
import { SidebarSection, SectionButton } from '@/components/ui/SidebarSection';
import { HpControl } from '@/components/ui/HpControl';
import { Button, IconButton } from '@/components/ui/Button';
import type { Player } from '@/types';

interface Props {
  players: Player[];
  newPName: string; setNewPName: (v: string) => void;
  newPColor: string; setNewPColor: (v: string) => void;
  newPHpMax: number; setNewPHpMax: (v: number) => void;
  onAdd: () => void;
  onRemove: (id: number) => void;
  onAdjustHp: (id: number, delta: number) => void;
  onSetHpMax: (id: number, hpMax: number) => void;
  onSetSpeed: (id: number, speed: number) => void;
  onSetVision: (id: number, visionFt: number) => void;
  onSetCanMove: (id: number, canMove: boolean) => void;
  onRename: (id: number, name: string) => void;
  onLoadParty: () => void;
}

function Toggle({ on, onClick, title }: { on: boolean; onClick: () => void; title?: string }) {
  return (
    <div onClick={onClick} title={title}
      style={{ width: 36, height: 20, borderRadius: RADIUS.lg, background: on ? C.hpHigh : 'rgba(255,255,255,0.15)', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
    </div>
  );
}

const cfgInputStyle: React.CSSProperties = {
  width: 56, height: 26, background: C.bg, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm,
  color: C.text, fontSize: FS.md, fontWeight: 700, textAlign: 'center', outline: 'none', padding: '0 2px',
};

function CfgRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ flex: 1, fontSize: FS.sm, color: C.dim, minWidth: 0 }}>{label}</span>
      {children}
    </div>
  );
}

function PlayerCard({ pl, openConfig, onToggleConfig, onRemove, onAdjustHp, onSetHpMax, onSetSpeed, onSetVision, onSetCanMove, onRename }: {
  pl: Player;
  openConfig: boolean;
  onToggleConfig: () => void;
  onRemove: (id: number) => void;
  onAdjustHp: (id: number, delta: number) => void;
  onSetHpMax: (id: number, hpMax: number) => void;
  onSetSpeed: (id: number, speed: number) => void;
  onSetVision: (id: number, visionFt: number) => void;
  onSetCanMove: (id: number, canMove: boolean) => void;
  onRename: (id: number, name: string) => void;
}) {
  const hp = pl.hp ?? pl.hpMax;
  const speed = pl.speed ?? DEFAULT_SPEED_FT;
  const vision = pl.visionFt ?? DEFAULT_VISION_FT;
  const canMove = pl.canMove !== false;
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: RADIUS.md, border: '1px solid rgba(255,255,255,0.07)' }}>
      {/* minHeight fix perquè la confirmació d'esborrat no faci créixer la targeta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px 0 8px', minHeight: 22, boxSizing: 'border-box' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: pl.color, flexShrink: 0 }} />
        <input value={pl.name} title="Editar nom"
          onChange={e => onRename(pl.id, e.target.value)}
          onBlur={e => { const t = e.target.value.trim(); onRename(pl.id, t || 'Jugador'); }}
          style={{ flex: 1, minWidth: 0, fontSize: FS.md, color: C.text, fontWeight: 700, background: 'transparent', border: 'none', outline: 'none', padding: 0 }} />
        {!canMove && <span title="Moviment desactivat des de la pantalla de jugador" style={{ fontSize: FS.sm, flexShrink: 0 }}>🔒</span>}
        {confirmDelete ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: FS.xs, color: C.enemy, fontWeight: 700 }}>Eliminar?</span>
            <Button size="sm" variant="danger" onClick={() => onRemove(pl.id)} title="Confirmar eliminació">Sí</Button>
            <Button size="sm" onClick={() => setConfirmDelete(false)} title="Cancel·lar">No</Button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} title="Eliminar jugador"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: 0, display: 'flex', flexShrink: 0 }}><X size={11} /></button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px 4px 8px' }}>
        <HpControl hp={hp} hpMax={pl.hpMax} onAdjust={delta => onAdjustHp(pl.id, delta)} size="lg" />
        <IconButton size={36} onClick={onToggleConfig} active={openConfig} title="Configuració del jugador"
          style={{ color: openConfig ? C.accent : C.dim }}>
          <GearIcon size={16} style={{ transition: 'transform 0.28s ease', transform: openConfig ? 'rotate(90deg)' : 'none' }} />
        </IconButton>
      </div>
      {/* Desplegable de configuració: el truc 0fr→1fr anima l'alçada sense mesurar-la */}
      <div style={{ display: 'grid', gridTemplateRows: openConfig ? '1fr' : '0fr', transition: 'grid-template-rows 0.28s ease' }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <CfgRow label="Vida màxima">
              <input type="number" min={1} max={999} value={pl.hpMax}
                onChange={e => onSetHpMax(pl.id, parseInt(e.target.value) || 1)}
                style={{ ...cfgInputStyle, color: C.hpHigh }} />
            </CfgRow>
            <CfgRow label={`Velocitat (peus) · ${Math.floor(speed / 5)} caselles`}>
              <input type="number" min={0} max={995} step={5} value={speed}
                onChange={e => onSetSpeed(pl.id, parseInt(e.target.value) || 0)}
                style={{ ...cfgInputStyle, color: '#d4ae38' }} />
            </CfgRow>
            <CfgRow label={`Visió a les fosques (peus)${vision <= 0 ? ' · sense llum' : ''}`}>
              <input type="number" min={0} max={995} step={5} value={vision}
                title="Radi de llum que emet el token dins de sales fosques (0 = sense llum)"
                onChange={e => onSetVision(pl.id, parseInt(e.target.value) || 0)}
                style={{ ...cfgInputStyle, color: '#e8c86a' }} />
            </CfgRow>
            <CfgRow label="Moviment des de la pantalla de jugador">
              <Toggle on={canMove} onClick={() => onSetCanMove(pl.id, !canMove)}
                title={canMove ? 'Desactivar moviment del jugador' : 'Activar moviment del jugador'} />
            </CfgRow>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlayersPanel({ players, newPName, setNewPName, newPColor, setNewPColor, newPHpMax, setNewPHpMax, onAdd, onRemove, onAdjustHp, onSetHpMax, onSetSpeed, onSetVision, onSetCanMove, onRename, onLoadParty }: Props) {
  const [openConfigId, setOpenConfigId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  return (
    <SidebarSection title="Jugadors" icon="🧙" count={players.length} countColor={C.hpHigh} bodyPadding="0 10px 8px"
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {players.map(pl => (
          <PlayerCard key={pl.id} pl={pl}
            openConfig={openConfigId === pl.id}
            onToggleConfig={() => setOpenConfigId(openConfigId === pl.id ? null : pl.id)}
            onRemove={onRemove} onAdjustHp={onAdjustHp} onSetHpMax={onSetHpMax}
            onSetSpeed={onSetSpeed} onSetVision={onSetVision} onSetCanMove={onSetCanMove} onRename={onRename} />
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
