'use client';
import React from 'react';
import { C, FS, RADIUS, SHADOW } from '@/constants';
import { Button } from '@/components/ui/Button';
import type { Player } from '@/types';
import type { PhysPending } from '@/lib/board';

/**
 * Moviments de figuretes físiques que el DM ha rebutjat (`/tracker`, veure «Figuretes
 * físiques amb càmera» a `docs/tokens-i-combat.md`). La figureta ja és a la casella nova i no
 * pot rebotar com el token d'una tablet: el DM veu una silueta al mapa i decideix aquí.
 * «Acceptar» hi porta el token igualment; «Ignorar» el deixa on era (el jugador ha de tornar
 * la figureta). Si la figureta torna sola a la seva casella, l'avís desapareix.
 */
export function PhysPendingPanel({ pending, players, onAccept, onIgnore }: {
  pending: Record<string, PhysPending>;
  players: Player[];
  onAccept: (sid: string) => void;
  onIgnore: (sid: string) => void;
}) {
  const ids = Object.keys(pending).sort((a, b) => pending[a].t - pending[b].t);
  if (ids.length === 0) return null;
  return (
    <div style={{
      position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 30,
      background: C.float, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.float,
      padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 320, maxWidth: 480,
    }}>
      <div style={{ fontSize: FS.xs, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Figuretes fora de lloc</div>
      {ids.map(sid => {
        const pl = players.find(p => `pl_${p.id}` === sid);
        const p = pending[sid];
        return (
          <div key={sid} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: FS.sm }}>
            <span style={{ width: 10, height: 10, borderRadius: RADIUS.pill, background: pl?.color ?? C.dim, flexShrink: 0 }} />
            <span style={{ flex: 1, color: C.text }}>
              <b style={{ color: C.bright }}>{pl?.name ?? sid}</b> ha mogut la figureta, però {p.reason}.
            </span>
            <Button size="sm" variant="primary" onClick={() => onAccept(sid)} title="El token va on és la figureta (sense gastar peus)">Acceptar</Button>
            <Button size="sm" onClick={() => onIgnore(sid)} title="El token es queda on era: el jugador ha de tornar la figureta">Ignorar</Button>
          </div>
        );
      })}
    </div>
  );
}
