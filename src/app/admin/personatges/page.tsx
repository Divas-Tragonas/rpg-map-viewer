'use client';
import React, { useEffect, useState } from 'react';
import { C, tint } from '@/constants';
import { api, isApiConfigured, type ApiCharacter, type ApiCharacterInput } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { ABILITIES, DEFAULT_SECTIONS, abilityMod, levelUpTo, sameCharacter, sheetOf, signed, xpProgress, type AbilityId, type CharacterSheet } from '@/lib/characters';
import { CHARACTER_SEED } from '@/lib/characters-seed';

type Form = ApiCharacterInput & { sheet: CharacterSheet };

const EMPTY: Form = {
  name: '', player: '', race: '', className: '', level: 1, hpMax: 10, ac: 10, speed: 30, passivePerception: 10,
  portrait: '', notionUrl: '',
  sheet: { abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, saves: [], sections: DEFAULT_SECTIONS.map(title => ({ title, text: '' })) },
};

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: '#080c12', border: '1px solid #21262d',
  borderRadius: 6, color: '#c9d1d9', fontSize: 13, outline: 'none', fontFamily: 'inherit',
};

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: 'block', ...style }}>
      <span style={{ display: 'block', marginBottom: 5, fontSize: 10, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
      {children}
    </label>
  );
}

/**
 * Back office · Personatges: les fitxes de la colla a la API (`/characters`). Crear, editar,
 * donar o treure experiència amb el motiu, veure'n l'historial i importar les fitxes de Notion
 * que encara no hi són. El visor del DM en llegeix el nivell i l'experiència, hi suma la del
 * combat i en pot ensenyar parts a les pantalles de jugador.
 */
const apiOk_ = () => isApiConfigured();

export default function PersonatgesPage() {
  const [list, setList] = useState<ApiCharacter[]>([]);
  const [loading, setLoading] = useState(apiOk_());
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [modal, setModal] = useState<{ id: string | null; data: Form } | null>(null);
  const [saving, setSaving] = useState(false);
  const [xpFor, setXpFor] = useState<string | null>(null);
  const [xpAmount, setXpAmount] = useState('');
  const [xpReason, setXpReason] = useState('');
  const [history, setHistory] = useState<ApiCharacter | null>(null);
  const [delConfirm, setDelConfirm] = useState<string | null>(null);
  const apiOk = isApiConfigured();

  useEffect(() => {
    if (!apiOk) return;
    let alive = true;
    api.characters.list()
      .then(l => { if (alive) setList(l); })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Error desconegut'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [apiOk]);

  const replace = (c: ApiCharacter) => setList(prev => prev.some(x => x.id === c.id) ? prev.map(x => x.id === c.id ? c : x) : [...prev, c]);

  const missingSeeds = CHARACTER_SEED.filter(sd => !list.some(c => sameCharacter(c.name, sd.name)));
  async function importSeeds() {
    setSaving(true); setMsg('');
    let ok = 0, fail = 0;
    for (const sd of missingSeeds) {
      try { replace(await api.characters.create(sd)); ok++; } catch { fail++; }
    }
    setSaving(false);
    setMsg(fail ? `S'han importat ${ok} fitxes; ${fail} han fallat.` : `S'han importat ${ok} fitxes de Notion.`);
  }

  async function save() {
    if (!modal || !modal.data.name.trim()) return;
    setSaving(true);
    try {
      const body = { ...modal.data, name: modal.data.name.trim() };
      replace(modal.id ? await api.characters.update(modal.id, body) : await api.characters.create(body));
      setModal(null);
    } catch (e) { alert(e instanceof Error ? e.message : 'Error en desar'); }
    finally { setSaving(false); }
  }

  async function giveXp(id: string) {
    const n = Math.round(Number(xpAmount));
    if (!Number.isFinite(n) || n === 0) return;
    try {
      replace(await api.characters.awardXp(id, n, { reason: xpReason.trim(), source: 'backoffice', awardId: `bo-${Date.now().toString(36)}` }));
      setXpFor(null); setXpAmount(''); setXpReason('');
    } catch (e) { alert(e instanceof Error ? e.message : 'Error en desar'); }
  }

  async function levelUp(c: ApiCharacter, level: number) {
    try { replace(await api.characters.update(c.id, { level })); } catch (e) { alert(e instanceof Error ? e.message : 'Error en desar'); }
  }

  async function openHistory(id: string) {
    try { setHistory(await api.characters.get(id)); } catch (e) { alert(e instanceof Error ? e.message : 'Error'); }
  }

  async function remove(id: string) {
    try { await api.characters.delete(id); setList(prev => prev.filter(c => c.id !== id)); setDelConfirm(null); }
    catch (e) { alert(e instanceof Error ? e.message : 'Error en eliminar'); }
  }

  const edit = (c: ApiCharacter) => setModal({ id: c.id, data: {
    name: c.name, player: c.player, race: c.race, className: c.className, level: c.level, hpMax: c.hpMax, ac: c.ac,
    speed: c.speed, passivePerception: c.passivePerception, portrait: c.portrait, notionUrl: c.notionUrl,
    sheet: { ...EMPTY.sheet, ...sheetOf(c) },
  } });

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, color: C.bright }}>Personatges</h1>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>Fitxes de les DIVAS. L&apos;experiència del combat s&apos;hi suma sola des del visor del DM.</div>
        </div>
        {missingSeeds.length > 0 && !loading && !error && (
          <Button variant="secondary" disabled={saving} onClick={() => void importSeeds()}
            title={missingSeeds.map(s => s.name).join(', ')}>
            Importar les fitxes de Notion ({missingSeeds.length})
          </Button>
        )}
        <Button variant="primary" disabled={!apiOk} onClick={() => setModal({ id: null, data: structuredClone(EMPTY) })}>Nou personatge</Button>
      </div>

      {!apiOk && <div style={{ color: C.warn, fontSize: 13 }}>NEXT_PUBLIC_API_URL no configurat.</div>}
      {error && <div style={{ color: C.enemy, fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {msg && <div style={{ color: C.ok, fontSize: 13, marginBottom: 12 }}>{msg}</div>}
      {loading && <div style={{ color: C.dim, fontSize: 13 }}>Carregant…</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {list.map(c => {
          const { next, frac } = xpProgress(c.xp, c.level);
          const up = levelUpTo(c);
          const sh = sheetOf(c);
          return (
            <div key={c.id} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ color: C.bright, fontWeight: 700, fontSize: 15, flex: 1 }}>{c.name}</span>
                <span style={{ color: C.text, fontSize: 13 }}>Nivell {c.level}</span>
              </div>
              <div style={{ fontSize: 12, color: C.dim }}>{[c.className, c.race, c.player && `jugador: ${c.player}`].filter(Boolean).join(' · ')}</div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.dim, marginBottom: 4 }}>
                  <span>Experiència</span><span style={{ color: C.text }}>{c.xp}{next !== null ? ` / ${next}` : ''} XP</span>
                </div>
                <div style={{ height: 6, borderRadius: 6, background: C.dark, overflow: 'hidden' }}>
                  <div style={{ width: `${frac * 100}%`, height: '100%', background: C.magicBright }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 12, color: C.text, flexWrap: 'wrap' }}>
                <span>CA {c.ac}</span><span>PV {c.hpMax}</span><span>{c.speed} ft</span><span>PP {c.passivePerception}</span>
                {sh.abilities && ABILITIES.map(a => typeof sh.abilities?.[a.id] === 'number' && (
                  <span key={a.id} style={{ color: C.dim }}>{a.label} {signed(abilityMod(sh.abilities[a.id]!))}</span>
                ))}
              </div>
              {up && <Button variant="tint" color={C.magicBright} onClick={() => void levelUp(c, up)}>Pujar a nivell {up}</Button>}
              {xpFor === c.id ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input autoFocus value={xpAmount} onChange={e => setXpAmount(e.target.value)} placeholder="+XP" inputMode="numeric"
                    onKeyDown={e => { if (e.key === 'Enter') void giveXp(c.id); if (e.key === 'Escape') setXpFor(null); }}
                    style={{ ...inputStyle, width: 80 }} />
                  <input value={xpReason} onChange={e => setXpReason(e.target.value)} placeholder="Motiu" maxLength={120}
                    onKeyDown={e => { if (e.key === 'Enter') void giveXp(c.id); }} style={inputStyle} />
                  <Button variant="primary" onClick={() => void giveXp(c.id)}>Desar</Button>
                </div>
              ) : delConfirm === c.id ? (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ flex: 1, color: C.enemy, fontSize: 12, fontWeight: 700 }}>Eliminar {c.name}? Es perd l&apos;historial.</span>
                  <Button variant="danger" onClick={() => void remove(c.id)}>Sí</Button>
                  <Button onClick={() => setDelConfirm(null)}>No</Button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Button variant="secondary" onClick={() => edit(c)}>Editar la fitxa</Button>
                  <Button variant="secondary" onClick={() => { setXpFor(c.id); setXpAmount(''); setXpReason(''); }}>Experiència</Button>
                  <Button variant="ghost" onClick={() => void openHistory(c.id)}>Historial</Button>
                  <span style={{ flex: 1 }} />
                  {c.notionUrl && <a href={c.notionUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.dim, alignSelf: 'center' }}>Notion</a>}
                  <Button variant="danger" onClick={() => setDelConfirm(c.id)}>Eliminar</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {history && (
        <div onMouseDown={e => { if (e.target === e.currentTarget) setHistory(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ width: 520, maxWidth: '100%', maxHeight: '80vh', overflowY: 'auto', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ flex: 1, color: C.bright, fontWeight: 700 }}>Experiència de {history.name} · {history.xp} XP</span>
              <Button variant="ghost" onClick={() => setHistory(null)}>Tancar</Button>
            </div>
            {(history.xpLog ?? []).length === 0 && <div style={{ color: C.dim, fontSize: 13 }}>Encara no ha guanyat experiència.</div>}
            {[...(history.xpLog ?? [])].reverse().map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderTop: i ? `1px solid ${C.border}` : 'none', fontSize: 13 }}>
                <span style={{ width: 70, color: e.amount >= 0 ? C.ok : C.enemy, fontWeight: 700, textAlign: 'right' }}>{e.amount > 0 ? '+' : ''}{e.amount}</span>
                <span style={{ flex: 1, color: C.text }}>{e.reason || <span style={{ color: C.dim }}>Sense motiu</span>}</span>
                <span style={{ color: C.dim, whiteSpace: 'nowrap' }}>{new Date(e.at).toLocaleDateString('ca')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {modal && <CharacterForm modal={modal} saving={saving} onChange={data => setModal(m => m && { ...m, data })} onSave={() => void save()} onClose={() => setModal(null)} />}
    </div>
  );
}

function CharacterForm({ modal, saving, onChange, onSave, onClose }: {
  modal: { id: string | null; data: Form }; saving: boolean;
  onChange: (d: Form) => void; onSave: () => void; onClose: () => void;
}) {
  const d = modal.data;
  const sh = d.sheet;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => onChange({ ...d, [k]: v });
  const setSheet = (patch: Partial<CharacterSheet>) => onChange({ ...d, sheet: { ...sh, ...patch } });
  const num = (v: string, min: number) => Math.max(min, parseInt(v) || min);
  const sections = sh.sections ?? [];
  const setSection = (i: number, patch: Partial<{ title: string; text: string }>) =>
    setSheet({ sections: sections.map((s, j) => j === i ? { ...s, ...patch } : s) });
  const toggleSave = (id: AbilityId) => {
    const cur = sh.saves ?? [];
    setSheet({ saves: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] });
  };
  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 50, padding: 20, overflowY: 'auto' }}>
      <div style={{ width: 760, maxWidth: '100%', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ color: C.bright, fontWeight: 700, fontSize: 16 }}>{modal.id ? `Editar ${d.name}` : 'Nou personatge'}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Field label="Nom"><input value={d.name} maxLength={80} onChange={e => set('name', e.target.value)} style={inputStyle} /></Field>
          <Field label="Jugador"><input value={d.player} maxLength={60} onChange={e => set('player', e.target.value)} style={inputStyle} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <Field label="Classe"><input value={d.className} maxLength={60} onChange={e => set('className', e.target.value)} placeholder="Mag 1" style={inputStyle} /></Field>
          <Field label="Raça"><input value={d.race} maxLength={60} onChange={e => set('race', e.target.value)} style={inputStyle} /></Field>
          <Field label="Trasfons"><input value={sh.background ?? ''} onChange={e => setSheet({ background: e.target.value })} style={inputStyle} /></Field>
          <Field label="Alineament"><input value={sh.alignment ?? ''} onChange={e => setSheet({ alignment: e.target.value })} style={inputStyle} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 10 }}>
          <Field label="Nivell"><input type="number" min={1} max={20} value={d.level} onChange={e => set('level', Math.min(20, num(e.target.value, 1)))} style={inputStyle} /></Field>
          <Field label="PV màx"><input type="number" min={1} value={d.hpMax} onChange={e => set('hpMax', num(e.target.value, 1))} style={inputStyle} /></Field>
          <Field label="CA"><input type="number" min={0} value={d.ac} onChange={e => set('ac', num(e.target.value, 0))} style={inputStyle} /></Field>
          <Field label="Vel. ft"><input type="number" min={0} step={5} value={d.speed} onChange={e => set('speed', num(e.target.value, 0))} style={inputStyle} /></Field>
          <Field label="Perc. pass."><input type="number" min={0} value={d.passivePerception} onChange={e => set('passivePerception', num(e.target.value, 0))} style={inputStyle} /></Field>
          <Field label="Iniciativa"><input value={sh.initiative ?? ''} onChange={e => setSheet({ initiative: e.target.value })} style={inputStyle} /></Field>
          <Field label="Competència"><input value={sh.profBonus ?? ''} onChange={e => setSheet({ profBonus: e.target.value })} style={inputStyle} /></Field>
          <Field label="Dau de vida"><input value={sh.hitDie ?? ''} onChange={e => setSheet({ hitDie: e.target.value })} style={inputStyle} /></Field>
        </div>

        <div>
          <span style={{ display: 'block', marginBottom: 5, fontSize: 10, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Característiques (marca les salvacions amb competència)</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
            {ABILITIES.map(a => {
              const v = sh.abilities?.[a.id] ?? 10;
              return (
                <div key={a.id} style={{ background: C.dark, border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: C.dim, fontWeight: 700 }}>{a.label} <span style={{ color: C.text }}>{signed(abilityMod(v))}</span></div>
                  <input type="number" min={1} max={30} value={v} onChange={e => setSheet({ abilities: { ...sh.abilities, [a.id]: Math.min(30, num(e.target.value, 1)) } })}
                    style={{ ...inputStyle, textAlign: 'center', marginTop: 4 }} />
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, color: C.dim, marginTop: 4 }}>
                    <input type="checkbox" checked={!!sh.saves?.includes(a.id)} onChange={() => toggleSave(a.id)} /> salvació
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Seccions · una línia amb «- » és una llista i **text** va en negreta
          </span>
          {sections.map((sec, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, background: tint(C.border, 0.25), borderRadius: 8, padding: 8 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={sec.title} onChange={e => setSection(i, { title: e.target.value })} style={{ ...inputStyle, fontWeight: 700 }} />
                <Button variant="ghost" onClick={() => setSheet({ sections: sections.filter((_, j) => j !== i) })} title="Treure la secció">Treure</Button>
              </div>
              <textarea value={sec.text} rows={Math.min(8, Math.max(2, sec.text.split('\n').length))} onChange={e => setSection(i, { text: e.target.value })}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.45 }} />
            </div>
          ))}
          <div><Button variant="secondary" onClick={() => setSheet({ sections: [...sections, { title: 'Secció nova', text: '' }] })}>Afegir una secció</Button></div>
        </div>

        <Field label="Enllaç a Notion"><input value={d.notionUrl} onChange={e => set('notionUrl', e.target.value)} style={inputStyle} /></Field>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>Cancel·la</Button>
          <Button variant="primary" disabled={saving || !d.name.trim()} onClick={onSave}>{saving ? 'Desant…' : 'Desar'}</Button>
        </div>
        <div style={{ fontSize: 11, color: C.dim }}>L&apos;experiència no es canvia aquí: es dona amb el botó «Experiència» (queda a l&apos;historial).</div>
      </div>
    </div>
  );
}
