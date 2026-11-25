'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { X } from '@/components/icons';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { isUiIcon } from '@/lib/sprites/uiicon';
import { C, FS, RADIUS, CONDITIONS_BY_ID, SPELL_BY_TYPE } from '@/constants';
import { anchoredBox } from '@/components/dm/ContextMenuOverlay';
import { DAMAGE_TYPES, critDice, rollsText, type DamageType } from '@/lib/characters';
import { RollGuide } from '@/components/dm/RollGuide';
import { advLine, hitLine, saveNeed, saveNeedShort } from '@/lib/rules/roll-guide';
import { applyDefenses, type Defenses } from '@/lib/rules/damage';
import { SAVE_LABEL, cantripDice, effectFor, needsAttackRoll } from '@/lib/rules/spell-effects';
import { forcedImpactStore } from '@/lib/rules/forced-move';
import { useJsonStore } from '@/lib/localStore';

export interface SpellTarget {
  key: string; name: string; hp: number; hpMax: number; defenses?: Defenses; conditions: string[];
  /** CA i modificador de DES de la fitxa (jugadors): per ensenyar el benefici d'Escut o Armadura de mag. */
  ac?: number; dexMod?: number;
  /** Bonificació de la salvació que demana la màgia (fitxa o bloc del bestiari), per a la taula. */
  saveBonus?: number | null;
  /** Mida en caselles de costat (per a les empentes que només mouen criatures Grans o més petites). */
  span?: number;
}

/** Benefici d'una màgia de protecció per a un afectat (text curt). L'app no el desa enlloc. */
function buffText(buff: 'shield' | 'mage_armor' | 'bless', t: SpellTarget): string {
  if (buff === 'shield') return t.ac !== undefined
    ? `CA ${t.ac} → ${t.ac + 5} fins al principi del seu proper torn · cap dany de Projectil màgic`
    : '+5 a la CA fins al principi del seu proper torn · cap dany de Projectil màgic';
  if (buff === 'mage_armor') return t.dexMod !== undefined
    ? `CA ${13 + t.dexMod} (13 + DES) durant 8 hores, si no porta armadura`
    : 'CA 13 + DES durant 8 hores, si no porta armadura';
  return '+1d4 als atacs i a les salvacions durant 1 minut (concentració)';
}

/** Resultat confirmat per a un token: dany (negatiu = cura) i estats a afegir. */
export interface SpellOutcome {
  key: string; delta: number; addConditions: string[]; /** Benefici (Escut…) per avisar-ne. */ note?: string;
  /** Per a l'historial: si ha superat la salvació, el perquè del canvi de dany i el tipus. */
  saved?: boolean; reasons?: string[]; type?: DamageType;
  /** L'empeny o l'estira (`fx.push`). */
  push?: boolean;
}

interface Row { include: boolean; saved: boolean; conds: string[]; push: boolean }

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
 * amb les seves defenses. Es col·loca al costat dels afectats. S'obre ABANS de l'animació: Enter la
 * llança i aplica el dany i els estats quan l'efecte arriba; «Només l'efecte» la llança sense aplicar
 * res; Esc o Cancel·lar no llancen el conjur.
 */
/** El que cal per explicar la tirada: bonus d'atac i CD del llançador, daus i nivell (trucs). */
export interface SpellGuide {
  attack?: number | null; dc?: number | null; dice?: string; level?: number;
  /** Motius d'avantatge / desavantatge de l'atac de conjur. */
  adv?: string[]; dis?: string[];
}

export function SpellEffectPopup({ spellType, anchor, targets, onApply, onCastOnly, onClose, fxOverride, title, info, guide = {}, onPushPreview, endInvis }: {
  spellType: string;
  /** Poder d'una criatura: el seu efecte (en lloc del de la taula), el seu nom i la CD / daus. */
  fxOverride?: import('@/lib/rules/spell-effects').SpellEffect | null;
  title?: string;
  info?: string;
  guide?: SpellGuide;
  /** Empenta: el DM pinta on acabarà cadascú (claus dels empesos; `null` = res). */
  onPushPreview?: (keys: string[] | null) => void;
  /** El llançador és invisible: llançar un conjur acaba la Invisibilitat (no la superior ni la natural). */
  endInvis?: { name: string; defaultOn: boolean };
  anchor: { l: number; r: number; t: number; b: number };
  targets: SpellTarget[];
  onApply: (out: SpellOutcome[], opts?: { endInvis?: boolean }) => void;
  /** Llança l'animació sense aplicar res (el DM ho farà a mà). */
  onCastOnly: () => void;
  /** Cancel·la el conjur: no es llança res. */
  onClose: () => void;
}) {
  const fx = fxOverride !== undefined ? fxOverride : effectFor(spellType);
  const fits = (t: SpellTarget) => !fx?.push?.maxSpan || (t.span ?? 1) <= fx.push.maxSpan;
  const impact = useJsonStore(forcedImpactStore);
  const meta = SPELL_BY_TYPE.get(spellType);
  // Dany o cura. Les de protecció i les d'estats, no.
  const hasAmount = !!fx?.damageType || !!fx?.heal;
  // Una fila per tipus de dany: el principal i els extres (Cop de flama: foc + radiant).
  const [parts, setParts] = useState<{ raw: string; type: DamageType | '' }[]>(() =>
    [{ raw: '', type: (fx?.damageType ?? '') as DamageType | '' }, ...(fx?.extra ?? []).map(r => ({ raw: '', type: (r.type ?? '') as DamageType | '' }))]);
  const setPart = (i: number, patch: Partial<{ raw: string; type: DamageType | '' }>) => setParts(ps => ps.map((p, j) => j === i ? { ...p, ...patch } : p));
  const [crit, setCrit] = useState(false);
  const [endInv, setEndInv] = useState(!!endInvis?.defaultOn);
  const raw = parts[0]?.raw ?? '';
  const type = parts[0]?.type ?? '';
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(targets.map(t => [t.key, { include: true, saved: false, conds: [...(fx?.conditions ?? [])], push: !!fx?.push && fits(t) }])));
  const amount = Math.max(0, parseInt(raw) || 0);
  const num = (r: string) => Math.max(0, parseInt(r) || 0);
  const setRow = (k: string, patch: Partial<Row>) => setRows(r => ({ ...r, [k]: { ...r[k], ...patch } }));

  // Previsualització de l'empenta al mapa (fletxes i siluetes) mentre el pop-up és obert.
  const pushKeys = fx?.push ? targets.filter(t => rows[t.key]?.include && rows[t.key]?.push).map(t => t.key) : [];
  const pushSig = pushKeys.join(',');
  const previewRef = useRef(onPushPreview);
  useEffect(() => { previewRef.current = onPushPreview; });
  useEffect(() => {
    previewRef.current?.(pushSig ? pushSig.split(',') : null);
    return () => previewRef.current?.(null);
  }, [pushSig]);
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
    let delta = 0; const reasons: string[] = [];
    for (const p of parts) {
      if (p.raw.trim() === '') continue;
      const r = spellDamageFor(num(p.raw), p.type || undefined, row.saved, !!fx.half, t.defenses);
      delta += r.final;
      for (const x of r.reasons) if (!reasons.includes(x)) reasons.push(x);
    }
    return { delta, reasons };
  };
  // Sense número = només l'efecte i els estats (Enter sempre fa alguna cosa).
  const apply = () => {
    onApply(targets.filter(t => rows[t.key].include).map(t => ({
      key: t.key, delta: hasAmount ? outcomeOf(t).delta : 0,
      addConditions: rows[t.key].conds.filter(c => !t.conditions.includes(c) && !t.defenses?.conditionImmunities?.includes(c)),
      ...(fx.buff ? { note: `${t.name}: ${buffText(fx.buff, t)}` } : {}),
      saved: rows[t.key].saved, reasons: outcomeOf(t).reasons, type: type || undefined,
      push: !!fx.push && rows[t.key].push,
    })), { endInvis: !!endInvis && endInv });
  };
  const saveText = fx.save ? `Salvació ${SAVE_LABEL[fx.save]}${fx.damageType ? (fx.half ? ' · meitat si la supera' : ' · res si la supera') : ''}` : null;
  // ── Guia de tirada ──
  const attackRoll = needsAttackRoll(fx);
  const baseDice = guide.dice ?? fx.dice;
  const dice = baseDice && fx.cantrip ? cantripDice(baseDice, guide.level) : baseDice;
  const rolls = dice ? [{ dice, type: fx.damageType }, ...(fx.extra ?? [])] : [];
  const dmgText = rolls.length ? rollsText(rolls, crit) : '';
  const condNames = (fx.conditions ?? []).map(c => CONDITIONS_BY_ID.get(c)?.label ?? c).join(', ');
  const single = targets.length === 1 ? targets[0] : null;
  const steps: (string | null)[] = [];
  if (attackRoll) {
    steps.push(hitLine(guide.attack, single?.ac));
    steps.push(advLine(guide.adv ?? [], guide.dis ?? []));
  } else if (fx.autoHit) steps.push('Toca sempre: no cal tirar per tocar');
  if (fx.save) steps.push(single
    ? `${single.name} tira una salvació de ${SAVE_LABEL[fx.save]} (1d20)${guide.dc ? `: la supera amb ${saveNeed(single.saveBonus, guide.dc)}` : ''}`
    : `Cada afectat tira una salvació de ${SAVE_LABEL[fx.save]} (1d20)${guide.dc ? ` contra CD ${guide.dc}: a cada fila, el que ha de treure per superar-la` : ''}`);
  if (fx.heal) steps.push(dice ? `Tira la cura: ${dice}` : 'Tira la cura del conjur');
  else if (fx.damageType) steps.push(dmgText
    ? `${attackRoll ? 'Si toca, tira' : 'Tira'} el dany: ${dmgText}${fx.save ? (fx.half ? ' (qui la supera, la meitat)' : ' (qui la supera, res)') : ''}`
    : `${attackRoll ? 'Si toca, tira' : 'Tira'} el dany del conjur`);
  else if (dice) steps.push(`Tira ${dice}`);
  if (condNames && !fx.buff) steps.push(fx.save ? `Qui no la supera: ${condNames}` : `Queda: ${condNames}`);
  if (fx.push) steps.push(`${(fx.push.on ?? 'fail') === 'hit' ? 'Si toca' : fx.save ? 'Qui no la supera' : 'Els afectats'}: ${fx.push.ft > 0 ? `surt empès ${fx.push.ft} ft` : `és estirat ${-fx.push.ft} ft cap al llançador`}${fx.push.maxSpan ? ' (només Gran o més petit)' : ''} · al mapa es veu on acabarà`);
  const notes = [
    fx.tip ?? null,
    attackRoll && dmgText && !crit ? `Un 20 al dau = crític: ${rollsText(rolls, true)}` : null,
  ];

  return (
    <div data-ctxmenu="1" onMouseDown={e => e.stopPropagation()}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); apply(); } }}
      style={{ ...anchoredBox(anchor, 120 + targets.length * 58), padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {isUiIcon(spellType) && <PixelIcon name={spellType} size={32} />}
        <span style={{ flex: 1, minWidth: 0, fontSize: FS.md, color: C.bright, fontWeight: 700 }}>
          {isUiIcon(spellType) ? null : meta?.emoji} {title ?? meta?.title ?? spellType} <span style={{ color: C.dim, fontWeight: 400 }}>· {targets.length} {targets.length === 1 ? 'afectat' : 'afectats'}</span>
        </span>
        <Button size="sm" variant="ghost" title="Cancel·lar (Esc)" onClick={onClose}><X size={12} /></Button>
      </div>
      {(saveText || info) && <div style={{ fontSize: FS.sm, color: C.dim }}>{[info, saveText].filter(Boolean).join(' · ')}</div>}
      <RollGuide steps={steps} notes={notes} />
      {hasAmount && parts.slice(0, fx.heal ? 1 : parts.length).map((p, i) => {
        const pd = i === 0 ? dice : fx.extra?.[i - 1]?.dice;
        return (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input autoFocus={i === 0} inputMode="numeric" placeholder={pd ? (crit ? critDice(pd) : pd) : fx.heal ? 'Cura' : 'Dany'} value={p.raw}
              onChange={e => setPart(i, { raw: e.target.value.replace(/[^\d]/g, '') })}
              style={{ ...field, width: 80, fontWeight: 700, textAlign: 'center', color: fx.heal ? C.ok : C.bright }} />
            {!fx.heal && (
              <select value={p.type} onChange={e => setPart(i, { type: e.target.value as DamageType | '' })} style={{ ...field, flex: 1, fontSize: FS.md }}>
                <option value="">Sense tipus</option>
                {DAMAGE_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            )}
            {i === 0 && attackRoll && !fx.heal && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: FS.sm, color: crit ? C.bright : C.dim }} title="Crític: es doblen els daus">
                <input type="checkbox" checked={crit} onChange={e => setCrit(e.target.checked)} /> Crític
              </label>
            )}
          </div>
        );
      })}
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
                      onChange={e => setRow(t.key, { saved: e.target.checked, conds: e.target.checked ? [] : [...(fx.conditions ?? [])],
                        ...(fx.push && (fx.push.on ?? 'fail') === 'fail' ? { push: !e.target.checked && fits(t) } : {}) })} />
                    <span title={guide.dc ? `Supera la salvació si treu ${saveNeed(t.saveBonus, guide.dc)}` : undefined}>supera{guide.dc && saveNeedShort(t.saveBonus, guide.dc) ? ` amb ${saveNeedShort(t.saveBonus, guide.dc)}` : t.saveBonus !== undefined && t.saveBonus !== null ? ` (${t.saveBonus >= 0 ? '+' : ''}${t.saveBonus})` : ''}</span>
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
                    const immune = !!t.defenses?.conditionImmunities?.includes(cid);
                    const on = !immune && row.conds.includes(cid), already = t.conditions.includes(cid);
                    return (
                      <button key={cid} type="button" disabled={already || immune}
                        onClick={() => setRow(t.key, { conds: on ? row.conds.filter(x => x !== cid) : [...row.conds, cid] })}
                        title={immune ? 'Hi és immune: no se li posarà' : already ? 'Ja el té' : on ? 'Se li posarà en aplicar' : 'No se li posarà'}
                        style={{ fontSize: FS.xs, padding: '2px 7px', borderRadius: 10, cursor: already ? 'default' : 'pointer',
                          textDecoration: immune ? 'line-through' : undefined,
                          border: `1px solid ${on || already ? c?.color ?? C.accent : C.border}`,
                          background: on || already ? `${c?.color ?? C.accent}33` : 'transparent', color: on || already ? C.bright : C.dim }}>
                        {c?.label ?? cid}{already ? ' ✓' : immune ? ' · immune' : ''}
                      </button>
                    );
                  })}
                </div>
              )}
              {fx.push && row.include && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4, marginLeft: 20 }}>
                  <button type="button" disabled={!fits(t)}
                    onClick={() => setRow(t.key, { push: !row.push })}
                    title={!fits(t) ? 'Massa gran: no es mou' : row.push ? 'Es mourà en aplicar (al mapa, on acabarà)' : 'No es mourà'}
                    style={{ fontSize: FS.xs, padding: '2px 7px', borderRadius: 10, cursor: fits(t) ? 'pointer' : 'default',
                      border: `1px solid ${row.push ? C.bright : C.border}`, background: row.push ? `${C.bright}22` : 'transparent', color: row.push ? C.bright : C.dim }}>
                    {fx.push.ft > 0 ? `↗ Empès ${fx.push.ft} ft` : `↙ Estirat ${-fx.push.ft} ft`}{!fits(t) ? ' · massa gran' : ''}
                  </button>
                </div>
              )}
              {fx.buff && row.include && (
                <div style={{ marginLeft: 20, marginTop: 3, fontSize: FS.sm, color: C.ok }}>{buffText(fx.buff, t)}</div>
              )}
              {o.reasons.length > 0 && row.include && (
                <div style={{ marginLeft: 20, marginTop: 2, fontSize: FS.xs, color: C.warn }}>{o.reasons.join(' · ')}</div>
              )}
            </div>
          );
        })}
      </div>
      {endInvis && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: FS.sm, color: endInv ? C.text : C.dim }}
          title="L'encanteri Invisibilitat s'acaba quan ataca o llança un conjur. La Invisibilitat superior i la natural no">
          <input type="checkbox" checked={endInv} onChange={e => setEndInv(e.target.checked)} /> S&apos;acaba la invisibilitat de {endInvis.name}
        </label>
      )}
      {fx.push && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: FS.xs, color: C.dim }}
          title="Regla de la casa: estampar-se contra una paret o una criatura fa 1d6 contundent per cada 10 ft que no s'han pogut fer">
          <input type="checkbox" checked={impact} onChange={e => forcedImpactStore.set(e.target.checked)} /> Cops en estampar-se (regla de la casa)
        </label>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <Button variant="primary" onClick={apply} style={{ flex: 1 }}
>Aplicar ↵</Button>
        <Button variant="secondary" onClick={onCastOnly} title="Llança l'efecte sense tocar vida ni estats">Només l'efecte</Button>
        <Button variant="ghost" onClick={onClose} title="No es llança el conjur (Esc)">Cancel·lar</Button>
      </div>
    </div>
  );
}
