'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { C, FS, RADIUS, SHADOW, FONT_SERIF, tint } from '@/constants';
import { Button } from '@/components/ui/Button';
import { StarIcon } from '@/components/icons';
import { splitXp } from '@/lib/characters';

/** Repartiment pendent en acabar un combat (el prepara `finishCombat` a `DMView`). */
export interface XpAward {
  /** Clau d'idempotència: la mateixa entrega no es compta dues vegades encara que es reintenti. */
  awardId: string;
  enemies: { name: string; xp: number }[];
  players: { key: string; name: string; characterId: string | null; characterName: string | null; defeated: boolean }[];
}

/**
 * «Experiència del combat»: la XP dels enemics derrotats (es pot retocar el total) repartida a
 * parts iguals entre els jugadors marcats. Per defecte, tots els del combat que tenen fitxa
 * (també els que han caigut: a D&D cobra tothom qui hi ha participat).
 */
export function XpAwardDialog({ award, busy, onConfirm, onClose }: {
  award: XpAward;
  busy: boolean;
  onConfirm: (awards: { id: string; amount: number }[], total: number) => void;
  onClose: () => void;
}) {
  const sum = award.enemies.reduce((a, e) => a + e.xp, 0);
  const [total, setTotal] = useState(String(sum));
  const [on, setOn] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(award.players.map(p => [p.key, !!p.characterId])));
  const picked = award.players.filter(p => p.characterId && on[p.key]);
  const t = Math.max(0, Math.round(Number(total) || 0));
  const shares = useMemo(() => splitXp(t, picked.length), [t, picked.length]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [busy, onClose]);

  const confirm = () => onConfirm(picked.map((p, i) => ({ id: p.characterId!, amount: shares[i] })), t);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: 16 }}
      onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-label="Experiència del combat"
        style={{ width: 380, maxWidth: '100%', maxHeight: '100%', overflowY: 'auto', background: C.panel, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.menu, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StarIcon size={16} color={C.magicBright} />
          <span style={{ fontFamily: FONT_SERIF, fontSize: 20, fontWeight: 600, color: C.bright }}>Experiència del combat</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: FS.sm }}>
          {award.enemies.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <span style={{ flex: 1, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
              <span style={{ color: C.dim, fontVariantNumeric: 'tabular-nums' }}>{e.xp} XP</span>
            </div>
          ))}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: FS.sm, color: C.text }}>
          <span style={{ flex: 1 }}>Total a repartir</span>
          <input type="number" min={0} value={total} onChange={e => setTotal(e.target.value)} aria-label="XP total"
            style={{ width: 90, height: 28, boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, color: C.bright, fontSize: FS.md, fontWeight: 700, textAlign: 'right', padding: '0 6px', outline: 'none' }} />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {award.players.map(p => {
            const idx = picked.indexOf(p);
            const has = !!p.characterId;
            return (
              <label key={p.key} title={has ? `Fitxa: ${p.characterName}` : 'Aquest jugador no té fitxa a la API'}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: RADIUS.md, background: idx >= 0 ? tint(C.magicBright, 0.08) : 'transparent', border: `1px solid ${C.border}`, opacity: has ? 1 : 0.5, cursor: has ? 'pointer' : 'default', fontSize: FS.sm }}>
                <input type="checkbox" disabled={!has} checked={has && !!on[p.key]} onChange={e => setOn(o => ({ ...o, [p.key]: e.target.checked }))} />
                <span style={{ flex: 1, minWidth: 0, color: C.bright, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}{p.defeated && <span style={{ color: C.dim }}> · ha caigut</span>}
                </span>
                <span style={{ color: idx >= 0 ? C.bright : C.dim, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                  {has ? (idx >= 0 ? `+${shares[idx]}` : '—') : 'sense fitxa'}
                </span>
              </label>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Button variant="secondary" disabled={busy} onClick={onClose}>Ara no</Button>
          <Button variant="primary" disabled={busy || picked.length === 0 || t <= 0} onClick={confirm}>
            {busy ? 'Desant…' : `Repartir ${t} XP`}
          </Button>
        </div>
      </div>
    </div>
  );
}
