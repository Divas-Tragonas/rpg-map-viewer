'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { X } from '@/components/icons';
import { C, FS, RADIUS, CONDITIONS_BY_ID, SPELL_BY_TYPE } from '@/constants';
import { anchoredBox } from '@/components/dm/ContextMenuOverlay';
import { DAMAGE_TYPES, type DamageType } from '@/lib/characters';
import { applyDefenses, type Defenses } from '@/lib/rules/damage';
import { SAVE_LABEL, SPELL_EFFECTS } from '@/lib/rules/spell-effects';

export interface SpellTarget { key: string; name: string; hp: number; hpMax: number; defenses?: Defenses; conditions: string[] }

/** Resultat confirmat per a un token: dany (negatiu = cura) i estats a afegir. */
export interface SpellOutcome { key: string; delta: number; addConditions: string[] }

interface Row { include: boolean; saved: boolean; conds: string[] }

const field: React.CSSProperties = {
  height: 30, boxSizing: 'border-box', background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: RADIUS.sm, padding: '0 8px', color: C.bright, fontSize: FS.lg, outline: 'none',
};

/** Dany final d'un afectat: primer la salvació (meitat o res), després les defenses (és màgia). */
export function spellDamageFor(amount: number, type: DamageType | undefined, saved: boolean, half: boolean, d?: Defenses) {
  const reasons: string[] = [];
  let base = Math.max(0, Math.floor(amount));
  if (saved) { base = half ? Math.floor(base / 2) : 0; reasons.push(half ? 'Supera la salvació: la meitat' : 'Supera la salvació: cap dany'); }
  const r = applyDefenses(base, type, d, true);
  return { final: r.final, reasons: [...reasons, ...r.reasons] };
}

/**
 * Pop-up d'un conjur llançat en combat (v5): els tokens afectats amb el dany (o la cura) i els
 * estats proposats. Un sol número de dany per a tothom (el que han tret els daus); per a cada
 * afectat, «supera» la salvació (meitat o res, i li treu els estats proposats) i el resultat
 * amb les seves defenses. Enter aplica, Esc cancel·la. Es col·loca al costat dels afectats.
 */
export function SpellEffectPopup({ spellType, anchor, targets, onApply, onClose }: {
  spellType: string;
  anchor: { l: number; r: number; t: number; b: number };
  targets: SpellTarget[];
  onApply: (out: SpellOutcome[]) => void;
  onClose: () => void;
}) {
  const fx = SPELL_EFFECTS[spellType];
  const meta = SPELL_BY_TYPE.get(spellType);
  const hasAmount = !!fx?.damageType || !!fx?.heal;
  const [raw, setRaw] = useState('');
  const [type, setType] = useState<DamageType | ''>(fx?.damageType ?? '');
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(targets.map(t => [t.key, { include: true, saved: false, conds: [...(fx?.conditions ?? [])] }])));
  const amount = Math.max(0, parseInt(raw) || 0);
  const setRow = (k: string, patch: Partial<Row>) => setRows(r => ({ ...r, [k]: { ...r[k], ...patch } }));

  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  if (!fx) return null;
  const outcomeOf = (t: SpellTarget) => {
    const row = rows[t.key];
    if (fx.heal) return { delta: -amount, reasons: [] as string[] };
    if (!fx.damageType) return { delta: 0, reasons: [] as string[] };
    const r = spellDamageFor(amount, type || undefined, row.saved, !!fx.half, t.defenses);
    return { delta: r.final, reasons: r.reasons };
  };
  const apply = () => {
    if (hasAmount && raw.trim() === '' && !fx.conditions?.length) return;
    onApply(targets.filter(t => rows[t.key].include).map(t => ({
      key: t.key, delta: hasAmount ? outcomeOf(t).delta : 0,
      addConditions: rows[t.key].conds.filter(c => !t.conditions.includes(c)),
    })));
  };
  const saveText = fx.save ? `Salvació ${SAVE_LABEL[fx.save]}${fx.damageType ? (fx.half ? ' · meitat si la supera' : ' · res si la supera') : ''}` : null;

  return (
    <div data-ctxmenu="1" onMouseDown={e => e.stopPropagation()}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); apply(); } }}
      style={{ ...anchoredBox(anchor, 120 + targets.length * 58), padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: FS.md, color: C.bright, fontWeight: 700 }}>
          {meta?.emoji} {meta?.title ?? spellType} <span style={{ color: C.dim, fontWeight: 400 }}>· {targets.length} {targets.length === 1 ? 'afectat' : 'afectats'}</span>
        </span>
        <Button size="sm" variant="ghost" title="Cancel·lar (Esc)" onClick={onClose}><X size={12} /></Button>
      </div>
      {saveText && <div style={{ fontSize: FS.sm, color: C.dim }}>{saveText}</div>}
      {hasAmount && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input autoFocus inputMode="numeric" placeholder={fx.heal ? 'Cura' : 'Dany'} value={raw}
            onChange={e => setRaw(e.target.value.replace(/[^\d]/g, ''))}
            style={{ ...field, width: 80, fontWeight: 700, textAlign: 'center', color: fx.heal ? C.ok : C.bright }} />
          {!fx.heal && (
            <select value={type} onChange={e => setType(e.target.value as DamageType | '')} style={{ ...field, flex: 1, fontSize: FS.md }}>
              <option value="">Sense tipus</option>
              {DAMAGE_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          )}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {targets.map((t, i) => {
          const row = rows[t.key];
          const o = outcomeOf(t);
          const hpAfter = Math.max(0, Math.min(t.hpMax, t.hp - o.delta));
          return (
            <div key={t.key} style={{ borderTop: `1px solid ${C.border}`, paddingTop: 6, opacity: row.include ? 1 : 0.45 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FS.md }}>
                <input type="checkbox" checked={row.include} title="Afectat" autoFocus={!hasAmount && i === 0}
                  onChange={e => setRow(t.key, { include: e.target.checked })} />
                <span style={{ flex: 1, minWidth: 0, color: C.bright, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                {fx.save && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: FS.sm, color: row.saved ? C.ok : C.dim }}>
                    <input type="checkbox" checked={row.saved}
                      onChange={e => setRow(t.key, { saved: e.target.checked, conds: e.target.checked ? [] : [...(fx.conditions ?? [])] })} />
                    supera
                  </label>
                )}
                {hasAmount && t.hpMax > 0 && (
                  <span style={{ fontSize: FS.sm, color: C.dim, whiteSpace: 'nowrap' }}>
                    {fx.heal ? '+' : '−'}<b style={{ color: o.reasons.length > (row.saved ? 1 : 0) ? C.warn : C.bright }}>{Math.abs(o.delta)}</b> · {t.hp}→<b style={{ color: hpAfter === 0 ? C.enemy : C.text }}>{hpAfter}</b>
                  </span>
                )}
              </div>
              {(fx.conditions?.length ?? 0) > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4, marginLeft: 20, flexWrap: 'wrap' }}>
                  {fx.conditions!.map(cid => {
                    const c = CONDITIONS_BY_ID.get(cid);
                    const on = row.conds.includes(cid), already = t.conditions.includes(cid);
                    return (
                      <button key={cid} type="button" disabled={already}
                        onClick={() => setRow(t.key, { conds: on ? row.conds.filter(x => x !== cid) : [...row.conds, cid] })}
                        title={already ? 'Ja el té' : on ? 'Se li posarà en aplicar' : 'No se li posarà'}
                        style={{ fontSize: FS.xs, padding: '2px 7px', borderRadius: 10, cursor: already ? 'default' : 'pointer',
                          border: `1px solid ${on || already ? c?.color ?? C.accent : C.border}`,
                          background: on || already ? `${c?.color ?? C.accent}33` : 'transparent', color: on || already ? C.bright : C.dim }}>
                        {c?.label ?? cid}{already ? ' ✓' : ''}
                      </button>
                    );
                  })}
                </div>
              )}
              {o.reasons.length > 0 && row.include && (
                <div style={{ marginLeft: 20, marginTop: 2, fontSize: FS.xs, color: C.warn }}>{o.reasons.join(' · ')}</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <Button variant="primary" onClick={apply} style={{ flex: 1 }}
          disabled={hasAmount && raw.trim() === '' && !fx.conditions?.length}>Aplicar ↵</Button>
        <Button variant="secondary" onClick={onClose}>Cancel·lar</Button>
      </div>
    </div>
  );
}
