'use client';
import React from 'react';
import { UserPlus, X } from '@/components/icons';
import { C, PALETTE, DEFAULT_SPEED_FT } from '@/constants';
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
  onRename: (id: number, name: string) => void;
  onLoadParty: () => void;
}

export function PlayersPanel({ players, newPName, setNewPName, newPColor, setNewPColor, newPHpMax, setNewPHpMax, onAdd, onRemove, onAdjustHp, onSetHpMax, onSetSpeed, onRename, onLoadParty }: Props) {
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, padding: '8px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.1em', flex: 1 }}>Jugadors</span>
        <button onClick={onLoadParty} title="Carrega els 5 jugadors per defecte"
          style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, border: `1px solid ${C.accent}`, background: `${C.accent}15`, cursor: 'pointer', color: C.accent, fontWeight: 700 }}>
          Party
        </button>
      </div>
      <div style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 4 }}>
        <input value={newPName} onChange={e => setNewPName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onAdd()} placeholder="Nom"
          style={{ flex: 1, minWidth: 0, background: '#0d1117', border: `1px solid ${C.border}`, borderRadius: 4, padding: '3px 6px', color: C.text, fontSize: 11, outline: 'none' }} />
        <input type="number" min={1} max={999} value={newPHpMax} onChange={e => setNewPHpMax(parseInt(e.target.value) || 20)}
          title="HP màxims"
          style={{ width: 36, background: '#0d1117', border: `1px solid ${C.border}`, borderRadius: 4, padding: '3px 3px', color: C.hpHigh, fontSize: 11, outline: 'none', textAlign: 'center' }} />
        <button onClick={onAdd}
          style={{ padding: '3px 5px', borderRadius: 4, border: 'none', background: C.accent, cursor: 'pointer', color: '#0d1117', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <UserPlus size={10} />
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
        {PALETTE.map(c => (
          <div key={c} onClick={() => setNewPColor(c)}
            style={{ width: 14, height: 14, borderRadius: '50%', background: c, cursor: 'pointer', border: `2px solid ${newPColor === c ? '#e6edf3' : 'transparent'}`, flexShrink: 0 }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {players.map(pl => {
          const hp = pl.hp ?? pl.hpMax;
          const ratio = pl.hpMax > 0 ? Math.max(0, hp / pl.hpMax) : 1;
          const hpCol = ratio > 0.5 ? C.hpHigh : ratio > 0.25 ? C.hpMid : C.enemy;
          return (
            <div key={pl.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 5, padding: '5px 6px', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: pl.color, flexShrink: 0 }} />
                <input value={pl.name} title="Editar nom" onChange={e => onRename(pl.id, e.target.value)}
                  style={{ flex: 1, minWidth: 0, fontSize: 11, color: C.text, fontWeight: 600, background: 'transparent', border: 'none', outline: 'none', padding: 0 }} />
                <button onClick={() => onRemove(pl.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: 0, display: 'flex', flexShrink: 0 }}><X size={9} /></button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <button onClick={() => onAdjustHp(pl.id, -1)} onContextMenu={e => { e.preventDefault(); onAdjustHp(pl.id, -10); }}
                  title="-1 HP (clic dret -10)"
                  style={{ width: 18, height: 18, borderRadius: 3, border: '1px solid rgba(248,81,73,0.4)', background: 'rgba(248,81,73,0.1)', cursor: 'pointer', color: '#f85149', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>−</button>
                <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, fontSize: 10, color: hpCol, fontWeight: 700 }}>
                  {hp}/
                  <input type="number" min={1} max={999} value={pl.hpMax} title="Editar vida màxima"
                    onChange={e => onSetHpMax(pl.id, parseInt(e.target.value) || 1)}
                    style={{ width: 26, background: 'transparent', border: 'none', borderBottom: `1px dashed ${hpCol}66`, color: hpCol, fontSize: 10, fontWeight: 700, textAlign: 'center', padding: 0, outline: 'none' }} />
                </span>
                <button onClick={() => onAdjustHp(pl.id, 1)} onContextMenu={e => { e.preventDefault(); onAdjustHp(pl.id, 10); }}
                  title="+1 HP (clic dret +10)"
                  style={{ width: 18, height: 18, borderRadius: 3, border: `1px solid ${C.hpHigh}66`, background: `${C.hpHigh}1a`, cursor: 'pointer', color: C.hpHigh, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }} title="Velocitat de moviment en peus (limita el drag des de la pantalla de jugador; 1 casella = 5 peus)">
                <span style={{ fontSize: 10, flexShrink: 0 }}>🏃</span>
                <input type="number" min={0} max={995} step={5} value={pl.speed ?? DEFAULT_SPEED_FT}
                  onChange={e => onSetSpeed(pl.id, parseInt(e.target.value) || 0)}
                  style={{ width: 30, background: 'transparent', border: 'none', borderBottom: `1px dashed ${C.dim}66`, color: '#d4ae38', fontSize: 10, fontWeight: 700, textAlign: 'center', padding: 0, outline: 'none' }} />
                <span style={{ fontSize: 9, color: C.dim }}>peus · {Math.floor((pl.speed ?? DEFAULT_SPEED_FT) / 5)}⬚</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
