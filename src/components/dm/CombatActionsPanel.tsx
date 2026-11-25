'use client';
import React, { useEffect, useState } from 'react';
import { SwordsIcon, X } from '@/components/icons';
import { HpControl } from '@/components/ui/HpControl';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { C, FS, RADIUS, SHADOW, tint, CONDITIONS_BY_ID } from '@/constants';
import { resolveToken, type TokenEditProps } from '@/components/dm/TokenFields';
import { TokenActions, type TokenActionsProps } from '@/components/dm/TokenActions';
import { characterFor, monsterFromCharacter } from '@/lib/characters';
import { monsterForEnemy } from '@/lib/db-enemies';
import { RAIL_TOP, RAIL_W } from '@/components/dm/RightRail';
import { useCompactLayout } from '@/hooks/useCompact';
import type { ConditionsMap } from '@/types';

/** Amplada del panell d'accions. */
export const ACTIONS_W = 300;

interface Props {
  /** Token que es mostra (`pl_*`/`lib_*`), o `null` si no n'hi ha cap de triat. */
  tokenKey: string | null;
  /** Tokens que es poden triar al selector de la capçalera (en combat, els de la cua; fora, tots). */
  choices: { key: string; name: string }[];
  onPick: (key: string) => void;
  onClose: () => void;
  /** Combat actiu: la capçalera diu «Torn de…» si el token té el torn. */
  isTurn: boolean;
  /** Peus que li queden aquest torn (només jugadors en combat). */
  remainingFt?: number;
  /** Espai que cal deixar a baix (la barra de torns). */
  bottom: number;
  edit: TokenEditProps;
  conditions: ConditionsMap;
  /** Llegeix quina acció espera el clic de destí (refs del DM): es consulta sovint, no és estat. */
  getArmed: () => string | null;
  actions: Omit<TokenActionsProps, 'tokenKey' | 'player' | 'lib' | 'armed'>;
}

/**
 * Panell d'accions de la dreta (v5.42). En combat mostra sol el token que té el torn: vida, CA,
 * peus, estats i els seus atacs, poders i conjurs com a botons. Clic a un atac i clic a la criatura
 * = pop-up de dany (el flux de sempre). Fora de combat s'obre amb el botó ⚔ de la rail o amb
 * «Accions» del menú d'un token. Abans tot això era dins del menú del clic dret.
 */
export function CombatActionsPanel({ tokenKey, choices, onPick, onClose, isTurn, remainingFt, bottom, edit, conditions, getArmed, actions }: Props) {
  const compact = useCompactLayout();
  // L'acció armada viu en refs (la desarma el clic al mapa o l'Esc): es mira cada 150 ms per ressaltar-la.
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => {
    const iv = window.setInterval(() => setArmed(a => { const n = getArmed(); return n === a ? a : n; }), 150);
    return () => window.clearInterval(iv);
  }, [getArmed]);

  const t = tokenKey ? resolveToken(tokenKey, edit) : null;
  const ch = t?.player ? characterFor(t.player, actions.characters) : null;
  const mo = t?.lib ? monsterForEnemy(t.lib) : ch ? monsterFromCharacter(ch) : null;
  const conds = t ? (conditions[t.key] ?? []) : [];

  const box: React.CSSProperties = compact
    ? { position: 'absolute', top: 104, right: 8, left: 8, maxHeight: `calc(100% - 104px - ${bottom}px)` }
    : { position: 'absolute', top: RAIL_TOP, right: 12 + RAIL_W, width: ACTIONS_W, maxHeight: `calc(100% - ${RAIL_TOP}px - ${bottom}px)` };

  return (
    <div data-actions-panel="1" style={{
      ...box, zIndex: 13, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: C.float, border: `1px solid ${isTurn ? tint(C.accent, 0.5) : C.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.float,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px', borderBottom: `1px solid ${C.border}` }}>
        <SwordsIcon size={14} />
        <span style={{ color: C.dim, fontSize: FS.xs, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>{isTurn ? 'Torn de' : 'Accions'}</span>
        <select value={tokenKey ?? ''} onChange={e => onPick(e.target.value)} aria-label="Token"
          style={{ flex: 1, minWidth: 0, background: 'transparent', color: C.bright, border: 'none', fontWeight: 700, fontSize: FS.lg, cursor: 'pointer', outline: 'none' }}>
          {!tokenKey && <option value="">Tria un token…</option>}
          {choices.map(c => <option key={c.key} value={c.key} style={{ background: C.panel }}>{c.name}</option>)}
        </select>
        <button onClick={onClose} title="Amagar el panell" aria-label="Amagar el panell"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: 2, display: 'flex' }}>
          <X size={13} />
        </button>
      </div>

      {!t ? (
        <div style={{ padding: 12, color: C.dim, fontSize: FS.sm }}>Selecciona un token al mapa o tria&apos;l a la llista.</div>
      ) : (
        <ScrollArea style={{ flex: 1, minHeight: 0 }}>
          <div style={{ padding: '7px 8px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {t.hpMax > 0 && <HpControl hp={t.hp} hpMax={t.hpMax} onAdjust={t.adjustHp} size="md" />}
            {mo?.ac ? <span title="Classe d'armadura" style={{ color: C.text, fontSize: FS.sm, fontWeight: 700 }}>CA {mo.ac}</span> : null}
            {remainingFt !== undefined && <span title="Peus que li queden aquest torn" style={{ color: C.dim, fontSize: FS.sm }}>{remainingFt} ft</span>}
          </div>
          {conds.length > 0 && (
            <div style={{ padding: '0 8px 7px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {conds.map(id => {
                const c = CONDITIONS_BY_ID.get(id);
                return <span key={id} style={{ fontSize: FS.xs, padding: '1px 6px', borderRadius: RADIUS.sm, color: c?.color ?? C.text, background: tint(c?.color ?? C.text, 0.12), border: `1px solid ${tint(c?.color ?? C.text, 0.35)}` }}>{c?.label ?? id}</span>;
              })}
            </div>
          )}
          <TokenActions tokenKey={t.key} player={t.player} lib={t.lib} armed={armed} {...actions} />
          <div style={{ padding: '6px 8px 8px', color: C.dim, fontSize: FS.xs, borderTop: `1px solid ${C.border}` }}>
            Clic a l&apos;acció i després a la criatura · Esc cancel·la
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
