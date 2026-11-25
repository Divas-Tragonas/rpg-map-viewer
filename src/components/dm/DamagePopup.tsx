'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { X } from '@/components/icons';
import { C, FS, RADIUS } from '@/constants';
import { anchoredBox } from '@/components/dm/ContextMenuOverlay';
import { RollGuide } from '@/components/dm/RollGuide';
import { DAMAGE_TYPES, critDice, rollsText, type DamageRoll, type DamageType } from '@/lib/characters';
import { applyDefenses, damageLabel, type Defenses } from '@/lib/rules/damage';
import { advLine, hitLine } from '@/lib/rules/roll-guide';
import type { DamagePrompt } from '@/types';

/** Alçada aproximada del pop-up, per centrar-lo respecte del token (com el menú del token). */
const POPUP_H = 280;

const field: React.CSSProperties = {
  height: 28, boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: RADIUS.sm, padding: '0 6px', color: C.bright, fontSize: FS.lg, outline: 'none',
};

/** Una fila de dany del pop-up: el que ha tret el DM d'una tirada, amb el seu tipus. */
interface Part { raw: string; type: DamageType | ''; dice: string; label?: string; optional: boolean; on: boolean }

/** Un tros del dany aplicat (per a l'historial): tirat, final, tipus i el perquè del canvi. */
export interface DamagePart { rolled: number; final: number; type?: DamageType; label?: string; reasons: string[] }

function partsFrom(prompt: DamagePrompt): Part[] {
  const main: DamageRoll[] = prompt.rolls?.length ? prompt.rolls : [{ dice: '', type: prompt.damageType }];
  return [
    ...main.map(r => ({ raw: '', type: (r.type ?? '') as DamageType | '', dice: r.dice, label: r.label, optional: false, on: true })),
    ...(prompt.riders ?? []).map(r => ({ raw: '', type: (r.type ?? main[0]?.type ?? '') as DamageType | '', dice: r.dice, label: r.label, optional: true, on: false })),
  ];
}

/** Text curt dels trossos per a l'historial: «14 perforant + 4 verí (resistent a verí: la meitat)». */
export function partsText(parts: readonly DamagePart[]): string {
  return parts.map(p => {
    const t = p.type ? ` ${damageLabel(p.type)}` : '';
    const lbl = p.label ? ` (${p.label})` : '';
    const why = p.reasons.length ? ` (${p.rolled} tirat · ${p.reasons.join(', ').toLowerCase()})` : '';
    return `${p.final}${t}${lbl}${why}`;
  }).join(' + ');
}

/**
 * Pop-up de dany d'un atac: s'obre al costat del token objectiu en clicar-lo mentre s'apunta un atac.
 * A dalt, la guia de tirada (què cal treure al d20 contra la CA, quins daus de dany i el crític).
 * Una fila per tipus de dany (principal, extres i opcionals que el DM marca): cada fila amb el que han
 * tret els daus i el resultat segons les defenses de l'objectiu. Enter aplica la suma (un sol pas de
 * desfer), Esc cancel·la. Els atacs del menú compten com a armes NO màgiques.
 */
export function DamagePopup({ prompt, target, adv = [], dis = [], onApply, onClose }: {
  prompt: DamagePrompt;
  target: { name: string; hp: number; hpMax: number; defenses?: Defenses; ac?: number };
  /** Motius d'avantatge i de desavantatge de l'atac (per a la guia). */
  adv?: string[]; dis?: string[];
  /** Dany final total i els trossos (per a l'historial). */
  onApply: (amount: number, info: { rolled: number; reasons: string[]; type?: DamageType; parts: DamagePart[] }) => void;
  onClose: () => void;
}) {
  const [parts, setParts] = useState<Part[]>(() => partsFrom(prompt));
  const [crit, setCrit] = useState(false);
  const setPart = (i: number, patch: Partial<Part>) => setParts(ps => ps.map((p, j) => j === i ? { ...p, ...patch } : p));
  const live = parts.filter(p => p.on && p.raw.trim() !== '');
  const results: DamagePart[] = live.map(p => {
    const rolled = Math.max(0, parseInt(p.raw) || 0);
    const r = applyDefenses(rolled, p.type || undefined, target.defenses, false);
    return { rolled, final: r.final, type: p.type || undefined, label: p.optional ? p.label : undefined, reasons: r.reasons };
  });
  const total = results.reduce((s, r) => s + r.final, 0);
  const rolledTotal = results.reduce((s, r) => s + r.rolled, 0);
  const hpAfter = Math.max(0, target.hp - total);
  const apply = () => {
    if (!live.length) return;
    onApply(total, { rolled: rolledTotal, reasons: results.flatMap(r => r.reasons), type: results[0]?.type, parts: results });
  };
  // Esc tanca també si el focus ja no és al pop-up (el DM ha clicat el mapa).
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const fixed = parts.filter(p => !p.optional);
  const dmgRolls = fixed.filter(p => p.dice).map(p => ({ dice: p.dice, type: p.type || undefined }));
  const dmgText = rollsText(dmgRolls);
  const opt = parts.filter(p => p.optional);
  const disAll = [...dis, ...(prompt.longRange ? ['abast llarg'] : [])];
  const firstFixed = parts.findIndex(p => !p.optional);
  return (
    <div data-ctxmenu="1"
      onMouseDown={e => e.stopPropagation()}
      onKeyDown={e => {
        // Abans que les dreceres globals (Enter = passar torn, Esc = cancel·lar altres coses).
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); apply(); }
      }}
      style={{ ...anchoredBox(prompt.anchor, POPUP_H), padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: FS.md, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          ⚔ {prompt.label} → <b style={{ color: C.bright }}>{target.name}</b>
        </span>
        <Button size="sm" variant="ghost" title="Cancel·lar (Esc)" onClick={onClose}><X size={12} /></Button>
      </div>
      <RollGuide
        steps={[
          hitLine(prompt.bonus, target.ac),
          advLine(adv, disAll),
          dmgText ? `Si toca, tira el dany: ${crit ? rollsText(dmgRolls, true) : dmgText}${crit ? ' (crític)' : ''}` : 'Si toca, tira el dany de l\'arma',
          opt.length ? `Si escau, afegeix-hi: ${rollsText(opt.map(p => ({ dice: p.dice, label: p.label })), crit)}` : null,
        ]}
        notes={[
          dmgText && !crit ? `Un 20 al dau = crític: dobla els daus (${rollsText(dmgRolls, true)})` : null,
          'Un 1 al dau falla sempre',
        ]} />
      {parts.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: p.on ? 1 : 0.55 }}>
          {p.optional
            ? <input type="checkbox" checked={p.on} title="Afegir aquest dany" onChange={e => setPart(i, { on: e.target.checked })} />
            : null}
          <input autoFocus={i === firstFixed} inputMode="numeric" placeholder={p.dice ? (crit ? critDice(p.dice) : p.dice) : 'Dany'} value={p.raw}
            onFocus={() => { if (p.optional && !p.on) setPart(i, { on: true }); }}
            onChange={e => setPart(i, { raw: e.target.value.replace(/[^\d]/g, ''), ...(p.optional ? { on: true } : {}) })}
            style={{ ...field, width: 70, fontWeight: 700, textAlign: 'center' }} />
          <select value={p.type} onChange={e => setPart(i, { type: e.target.value as DamageType | '' })}
            style={{ ...field, flex: 1, minWidth: 0, fontSize: FS.md }}>
            <option value="">Sense tipus</option>
            {DAMAGE_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          {p.label && <span style={{ fontSize: FS.xs, color: C.dim, maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.label}>{p.label}</span>}
        </div>
      ))}
      {results.filter(r => r.reasons.length).map((r, i) => (
        <div key={i} style={{ fontSize: FS.sm, color: C.warn }}>• {r.type ? `${damageLabel(r.type)}: ` : ''}{r.reasons.join(' · ')} → {r.final}</div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: FS.md, color: C.dim }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: FS.sm, color: crit ? C.bright : C.dim }} title="Crític: els daus que cal tirar es doblen (els números els escrius tu)">
          <input type="checkbox" checked={crit} onChange={e => setCrit(e.target.checked)} /> Crític
        </label>
        <span>Total <b style={{ fontSize: FS.xl, color: total !== rolledTotal ? C.warn : C.bright }}>{total}</b>
          {total !== rolledTotal && <span> (de {rolledTotal})</span>}</span>
        {target.hpMax > 0 && <span style={{ marginLeft: 'auto' }}>PV {target.hp} → <b style={{ color: hpAfter === 0 ? C.enemy : C.text }}>{hpAfter}</b></span>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <Button variant="primary" disabled={!live.length} onClick={apply} style={{ flex: 1 }}>Aplicar ↵</Button>
        <Button variant="secondary" onClick={onClose}>Cancel·lar</Button>
      </div>
    </div>
  );
}
