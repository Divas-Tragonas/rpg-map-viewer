'use client';
import React, { useState } from 'react';
import { C, FS, RADIUS } from '@/constants';
import { Button } from '@/components/ui/Button';
import { BookIcon, StarIcon } from '@/components/icons';
import type { ApiCharacter } from '@/lib/api';
import type { CharactersStatus } from '@/hooks/useCharacters';
import type { Player } from '@/types';
import { characterFor, levelUpTo, xpProgress } from '@/lib/characters';

/** Fitxes i accions que el menú del token necessita (venen de `useCharacters` a `DMView`). */
export interface CharacterMenuProps {
  characters: ApiCharacter[];
  status: CharactersStatus;
  /** Canvis fets sense connexió que encara s'han de pujar a la API. */
  pending: number;
  /** Tria la fitxa del jugador (undefined = la del mateix nom). */
  onLink: (playerId: number, characterId: string | undefined) => void;
  onAward: (characterId: string, amount: number, reason: string) => void;
  onLevelUp: (characterId: string, level: number) => void;
  onShowSheet: (characterId: string, playerKey: string) => void;
  /** Suma o resta peces a una pila de munició de la fitxa (recollir o perdre fletxes). */
  onAdjustAmmo: (characterId: string, name: string, delta: number) => void;
}

const label: React.CSSProperties = { fontSize: FS.xs, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em' };
const field: React.CSSProperties = {
  height: 26, boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm,
  color: C.text, fontSize: FS.sm, outline: 'none', padding: '0 6px', minWidth: 0,
};

/** Barra d'experiència cap al nivell següent (la comparteixen el menú i el panell de la fitxa). */
export function XpBar({ xp, level, height = 6 }: { xp: number; level: number; height?: number }) {
  const { next, frac } = xpProgress(xp, level);
  return (
    <div title={next === null ? `${xp} XP · nivell màxim` : `${xp} / ${next} XP`}
      style={{ height, borderRadius: height, background: C.dark, overflow: 'hidden', border: `1px solid ${C.border}` }}>
      <div style={{ width: `${frac * 100}%`, height: '100%', background: C.magicBright, transition: 'width 0.4s' }} />
    </div>
  );
}

/**
 * Fitxa d'un jugador dins del seu menú del clic dret: amb quina fitxa de la API va lligat,
 * nivell i experiència, donar-ne a mà (rol, fites; amb un número negatiu es corregeix), confirmar
 * una pujada de nivell i ensenyar la fitxa a les pantalles de jugador.
 */
export function CharacterSection({ player, p }: { player: Player; p: CharacterMenuProps }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const c = characterFor(player, p.characters);
  const up = c ? levelUpTo(c) : null;
  const give = () => {
    const n = Math.round(parseFloat(amount.replace(',', '.')));
    if (!c || !Number.isFinite(n) || n === 0) return;
    p.onAward(c.id, n, reason.trim());
    setAmount(''); setReason('');
  };
  const { next } = c ? xpProgress(c.xp, c.level) : { next: null };
  return (
    <div style={{ borderTop: `1px solid ${C.border}`, padding: '7px 8px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ ...label, display: 'flex', alignItems: 'center', gap: 5 }}><BookIcon size={11} /> Fitxa</span>
        <select value={player.characterId ?? ''} aria-label="Fitxa del personatge"
          onChange={e => p.onLink(player.id, e.target.value || undefined)}
          style={{ ...field, flex: 1 }}>
          <option value="">{player.characterId ? 'Automàtica (pel nom)' : c ? `${c.name} (pel nom)` : 'Cap'}</option>
          {p.characters.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
        </select>
      </div>
      {p.status === 'loading' && <span style={{ fontSize: FS.xs, color: C.dim }}>Carregant les fitxes…</span>}
      {p.status === 'offline' && <OfflineNote pending={p.pending} />}
      {c && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: FS.sm }}>
            <span style={{ color: C.bright, fontWeight: 700 }}>Nivell {c.level}</span>
            <span style={{ color: C.dim, fontSize: FS.xs }}>{c.className}</span>
            <span style={{ flex: 1 }} />
            <span style={{ color: C.text, fontVariantNumeric: 'tabular-nums' }}>{c.xp}{next !== null && <span style={{ color: C.dim }}> / {next}</span>} XP</span>
          </div>
          <XpBar xp={c.xp} level={c.level} />
          {up && (
            <Button size="sm" variant="tint" color={C.magicBright} onMouseDown={e => { e.stopPropagation(); p.onLevelUp(c.id, up); }}
              title="Ja té prou experiència: desa el nivell nou a la fitxa">
              <StarIcon size={11} /> Pujar a nivell {up}
            </Button>
          )}
          <div style={{ display: 'flex', gap: 4 }}>
            <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="numeric" placeholder="+XP" aria-label="Experiència a donar"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); give(); } if (e.key === 'Escape') { e.stopPropagation(); setAmount(''); } }}
              style={{ ...field, width: 58, textAlign: 'center' }} />
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Per què (opcional)" aria-label="Motiu"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); give(); } }}
              style={{ ...field, flex: 1 }} />
            <Button size="sm" variant="secondary" disabled={!amount.trim()} onMouseDown={e => { e.stopPropagation(); give(); }}
              title="Suma l'experiència a la fitxa (un número negatiu la treu)">Donar</Button>
          </div>
          <Button size="sm" variant="secondary" onMouseDown={e => { e.stopPropagation(); p.onShowSheet(c.id, `pl_${player.id}`); }}
            title="Obre la pestanya «Fitxa» del panell Mostrar als jugadors">
            <BookIcon size={11} /> Mostrar la fitxa als jugadors…
          </Button>
        </>
      )}
      {!c && p.status !== 'loading' && (
        <span style={{ fontSize: FS.xs, color: C.dim }}>Cap fitxa amb aquest nom. Tria-la a la llista o crea-la al back office.</span>
      )}
    </div>
  );
}

/**
 * Sense connexió amb el back office: les fitxes són la còpia d'aquest ordinador i els canvis
 * esperen a la cua (`lib/characters-store.ts`). Ho diu en una línia, amb un punt d'avís.
 */
export function OfflineNote({ pending }: { pending: number }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FS.xs, color: C.dim, lineHeight: 1.35 }}
      title="Les fitxes es desen en aquest ordinador i es pujaran soles al back office quan et connectis">
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.warn, flexShrink: 0 }} />
      Sense connexió · {pending ? `${pending} ${pending === 1 ? 'canvi' : 'canvis'} per pujar` : 'còpia d\'aquest ordinador'}
    </span>
  );
}
