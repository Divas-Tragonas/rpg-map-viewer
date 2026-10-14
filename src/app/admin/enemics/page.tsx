'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { C, FS, tint } from '@/constants';
import { api, isApiConfigured } from '@/lib/api';
import type { ApiEnemy } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { EnemyGroupToolbar, GroupHeader } from '@/components/ui/EnemyGroups';
import { useEnemyGrouping } from '@/hooks/useEnemyGrouping';
import { apiSupportsGroups, distinctValues, groupEnemies, groupKey } from '@/lib/enemy-groups';
import type { EnemyGroupField } from '@/lib/enemy-groups';

const EMPTY_FORM: Omit<ApiEnemy, 'id'> = {
  name: '',
  color: '#e05555',
  hpMax: 15,
  R: 30,
  sm: 1.0,
  imageData: '',
  project: '',
  category: '',
};

const FIELD_LABEL: Record<EnemyGroupField, string> = { project: 'Projecte', category: 'Categoria' };
const FIELD_HINT: Record<EnemyGroupField, string> = { project: 'p.ex. La cripta', category: 'p.ex. Morts vivents' };

// Columnes de la taula. La del camp pel qual s'agrupa s'amaga: ja és la capçalera del grup.
const COLUMNS: { key: string; label: string; field?: EnemyGroupField }[] = [
  { key: 'sel', label: '' }, { key: 'img', label: '' }, { key: 'color', label: 'Color' }, { key: 'name', label: 'Nom' },
  { key: 'project', label: 'Projecte', field: 'project' }, { key: 'category', label: 'Categoria', field: 'category' },
  { key: 'hp', label: 'HP màx' }, { key: 'R', label: 'Radi (R)' }, { key: 'sm', label: 'Escala (sm)' }, { key: 'actions', label: 'Accions' },
];

// Edició en bloc: quants PUT van alhora (la API no té cap endpoint de lots).
const BULK_CHUNK = 6;

export default function EnemicsPage() {
  const [enemies, setEnemies] = useState<ApiEnemy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; data: Omit<ApiEnemy, 'id'>; id?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const apiOk = isApiConfigured();
  const grouping = useEnemyGrouping('admin');
  const groupsOk = apiSupportsGroups(enemies);
  const groups = grouping.by === 'none' ? null : groupEnemies(enemies, grouping.by);
  const columns = COLUMNS.filter(c => !c.field || c.field !== grouping.by);

  // Selecció per a l'edició en bloc. Es deriva de la llista: un id que ja no hi és no compta.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [lastPick, setLastPick] = useState<string | null>(null);
  const [bulk, setBulk] = useState<Record<EnemyGroupField, string>>({ project: '', category: '' });
  const [bulkBusy, setBulkBusy] = useState<EnemyGroupField | null>(null);
  const [bulkMsg, setBulkMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const picked = enemies.filter(e => selected.has(e.id));
  // Files que es veuen, en ordre: Maj+clic marca el tram entre dues (els grups plegats no compten).
  const visibleRows = groups ? groups.filter(g => !grouping.isCollapsed(g.key)).flatMap(g => g.items) : enemies;

  const loadEnemies = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setEnemies(await api.enemies.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconegut');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (apiOk) loadEnemies(); else setLoading(false); }, [apiOk, loadEnemies]);

  function setPicked(ids: string[], on: boolean) {
    setSelected(prev => {
      const next = new Set(prev);
      for (const id of ids) { if (on) next.add(id); else next.delete(id); }
      return next;
    });
    setBulkMsg(null);
  }

  function pickRow(id: string, shift: boolean) {
    const on = !selected.has(id);
    const from = shift && lastPick ? visibleRows.findIndex(e => e.id === lastPick) : -1;
    const to = visibleRows.findIndex(e => e.id === id);
    if (from >= 0 && to >= 0) {
      const [a, b] = from < to ? [from, to] : [to, from];
      setPicked(visibleRows.slice(a, b + 1).map(e => e.id), on);
    } else {
      setPicked([id], on);
    }
    setLastPick(id);
  }

  /** Posa el mateix projecte o categoria a tots els seleccionats (buit = els el treu). */
  async function applyBulk(field: EnemyGroupField) {
    if (bulkBusy || !picked.length) return;
    const value = bulk[field].trim();
    const label = FIELD_LABEL[field].toLowerCase();
    // Els que ja el tenen escrit igual no cal tornar-los a desar.
    const targets = picked.filter(e => (e[field] ?? '').trim() !== value);
    if (!targets.length) {
      setBulkMsg({ ok: true, text: value ? `Ja eren tots a «${value}»` : `Cap no tenia ${label}` });
      return;
    }
    setBulkBusy(field);
    setBulkMsg(null);
    const saved = new Map<string, ApiEnemy>();
    let lastError = '';
    for (let i = 0; i < targets.length; i += BULK_CHUNK) {
      const batch = targets.slice(i, i + BULK_CHUNK);
      const results = await Promise.allSettled(batch.map(e => api.enemies.update(e.id, field === 'project' ? { project: value } : { category: value })));
      results.forEach((r, j) => {
        if (r.status === 'fulfilled') saved.set(batch[j].id, r.value);
        else lastError = r.reason instanceof Error ? r.reason.message : String(r.reason);
      });
    }
    setEnemies(prev => prev.map(e => saved.get(e.id) ?? e));
    // Com en desar-ne un: si van a parar a un grup plegat, es desplega.
    if (saved.size && grouping.by === field && grouping.isCollapsed(groupKey(value))) grouping.toggle(groupKey(value));
    const failed = targets.length - saved.size;
    const n = saved.size === 1 ? '1 enemic' : `${saved.size} enemics`;
    setBulkMsg(failed
      ? { ok: false, text: `No se n'han pogut desar ${failed} de ${targets.length}: ${lastError}` }
      : { ok: true, text: value ? `${n} a «${value}»` : `${n} sense ${label}` });
    setBulkBusy(null);
  }

  async function handleSave() {
    if (!modal) return;
    setSaving(true);
    try {
      const saved = modal.mode === 'create'
        ? await api.enemies.create(modal.data)
        : await api.enemies.update(modal.id!, modal.data);
      setEnemies(prev => modal.mode === 'create' ? [...prev, saved] : prev.map(e => e.id === modal.id ? saved : e));
      // Si va a parar a un grup plegat, es desplega: si no, semblaria que no s'ha desat.
      if (grouping.by !== 'none') {
        const key = groupKey(saved[grouping.by]);
        if (grouping.isCollapsed(key)) grouping.toggle(key);
      }
      setModal(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error en desar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.enemies.delete(id);
      setEnemies(prev => prev.filter(e => e.id !== id));
      setDeleteConfirm(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error en eliminar');
    }
  }

  function openCreate() {
    setModal({ mode: 'create', data: { ...EMPTY_FORM } });
  }

  function openEdit(enemy: ApiEnemy) {
    const { id, ...data } = enemy;
    setModal({ mode: 'edit', data: { ...data }, id });
  }

  function updateField<K extends keyof Omit<ApiEnemy, 'id'>>(k: K, v: Omit<ApiEnemy, 'id'>[K]) {
    setModal(m => m ? { ...m, data: { ...m.data, [k]: v } } : m);
  }

  function renderRow(enemy: ApiEnemy, first: boolean) {
    return (
      <tr key={enemy.id} style={{ borderTop: first ? 'none' : `1px solid ${C.border}`, background: selected.has(enemy.id) ? tint(C.accent, 0.06) : undefined }}>
        <td style={{ padding: '10px 4px 10px 14px', width: 1 }}>
          <Checkbox checked={selected.has(enemy.id)} onPick={shift => pickRow(enemy.id, shift)}
            label={`Seleccionar ${enemy.name} (Maj+clic: tot el tram fins a l'últim marcat)`} />
        </td>
        <td style={{ padding: '10px 14px', width: 48 }}>
          {enemy.imageData
            ? <img src={enemy.imageData} alt="" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 5, background: '#080c12', border: `1px solid ${C.border}` }} />
            : <div style={{ width: 36, height: 36, borderRadius: 5, background: C.dark, border: `1px dashed ${C.border}` }} />
          }
        </td>
        <td style={{ padding: '10px 14px' }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: enemy.color, border: `1px solid ${C.border}`, flexShrink: 0 }} />
        </td>
        <td style={{ padding: '10px 14px', color: C.bright, fontWeight: 600 }}>
          {enemy.name}
        </td>
        {grouping.by !== 'project' && <td style={{ padding: '10px 14px' }}><GroupTag value={enemy.project} /></td>}
        {grouping.by !== 'category' && <td style={{ padding: '10px 14px' }}><GroupTag value={enemy.category} /></td>}
        <td style={{ padding: '10px 14px', color: C.hpHigh }}>{enemy.hpMax}</td>
        <td style={{ padding: '10px 14px', color: C.text }}>{enemy.R}px</td>
        <td style={{ padding: '10px 14px', color: C.text }}>{enemy.sm}×</td>
        <td style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => openEdit(enemy)}
              style={{ padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 5, background: 'transparent', color: C.text, fontSize: 11, cursor: 'pointer' }}
            >
              Editar
            </button>
            {deleteConfirm === enemy.id ? (
              <>
                <button onClick={() => handleDelete(enemy.id)} style={{ padding: '4px 10px', border: '1px solid #f85149', borderRadius: 5, background: '#f8514922', color: '#f85149', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                  Confirmar
                </button>
                <button onClick={() => setDeleteConfirm(null)} style={{ padding: '4px 10px', border: `1px solid ${C.border}`, borderRadius: 5, background: 'transparent', color: C.dim, fontSize: 11, cursor: 'pointer' }}>
                  Cancel·lar
                </button>
              </>
            ) : (
              <button onClick={() => setDeleteConfirm(enemy.id)} style={{ padding: '4px 10px', border: '1px solid #f8514940', borderRadius: 5, background: 'transparent', color: '#f85149', fontSize: 11, cursor: 'pointer' }}>
                Eliminar
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.bright, margin: 0 }}>⚔️ Enemics</h1>
          <p style={{ fontSize: 11, color: C.dim, margin: '3px 0 0' }}>
            {apiOk ? `${process.env.NEXT_PUBLIC_API_URL}/enemies` : 'API no configurada'}
          </p>
        </div>
        <button
          onClick={openCreate}
          disabled={!apiOk}
          style={{
            marginLeft: 'auto',
            padding: '8px 16px',
            background: apiOk ? C.accent : C.border,
            border: 'none',
            borderRadius: 7,
            color: apiOk ? '#000' : C.dim,
            fontSize: 12,
            fontWeight: 700,
            cursor: apiOk ? 'pointer' : 'default',
          }}
        >
          + Nou enemic
        </button>
      </div>

      {/* API not configured */}
      {!apiOk && (
        <div style={{
          background: '#78350f22',
          border: '1px solid #78350f',
          borderRadius: 8,
          padding: '16px 20px',
          fontSize: 13,
          color: C.warn,
          marginBottom: 20,
        }}>
          <strong>Configura l&apos;API</strong> per activar el CRUD.
          Afegeix <code style={{ background: C.dark, padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>NEXT_PUBLIC_API_URL=https://la-teva-api.com</code> al fitxer <code style={{ background: C.dark, padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>.env.local</code> i reinicia el servidor.
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: '#f8514922',
          border: '1px solid #f85149',
          borderRadius: 8,
          padding: '12px 16px',
          fontSize: 12,
          color: '#f85149',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span>⚠️ {error}</span>
          <button onClick={loadEnemies} style={{ marginLeft: 'auto', padding: '4px 10px', border: `1px solid #f85149`, borderRadius: 5, background: 'transparent', color: '#f85149', fontSize: 11, cursor: 'pointer' }}>Reintentar</button>
        </div>
      )}

      {/* Agrupació */}
      {!loading && enemies.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <EnemyGroupToolbar size="md" by={grouping.by} onBy={grouping.setBy}
            allFolded={!!groups && groups.every(g => grouping.isCollapsed(g.key))}
            onFoldAll={fold => grouping.foldAll(groups?.map(g => g.key) ?? [], fold)} />
        </div>
      )}
      {!groupsOk && (
        <div style={{ background: tint(C.warn, 0.12), border: `1px solid ${tint(C.warn, 0.5)}`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: C.warn, marginBottom: 12 }}>
          ⚠️ La API no retorna el projecte ni la categoria dels enemics: el servidor encara no executa la versió nova.
          Reinicia-la. Fins llavors no es poden desar aquests camps i tots els enemics surten sense grup.
        </div>
      )}

      {/* Valors ja fets servir: els suggereixen el formulari i l'edició en bloc */}
      {(['project', 'category'] as const).map(field => (
        <datalist key={field} id={`enemy-${field}-options`}>
          {distinctValues(enemies, field).map(v => <option key={v} value={v} />)}
        </datalist>
      ))}

      {/* Edició en bloc. Sempre hi és (apagada sense selecció): si aparegués en marcar el
          primer enemic, la taula baixaria i la casella següent ja no seria sota el cursor. */}
      {!loading && enemies.length > 0 && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 5, marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: '8px 16px', flexWrap: 'wrap',
          padding: '9px 14px', background: C.panel, borderRadius: 8,
          border: `1px solid ${picked.length ? tint(C.accent, 0.55) : C.border}`,
        }}>
          <span style={{ fontSize: FS.md, fontWeight: 700, color: picked.length ? C.bright : C.dim, minWidth: 180 }}>
            {picked.length ? `${picked.length} de ${enemies.length} seleccionats` : 'Cap seleccionat'}
          </span>
          {(['category', 'project'] as const).map(field => {
            const off = !picked.length || !groupsOk || !!bulkBusy;
            const value = bulk[field].trim();
            return (
              <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label htmlFor={`bulk-${field}`} style={{ fontSize: FS.sm, color: C.dim }}>{FIELD_LABEL[field]}</label>
                <input id={`bulk-${field}`} type="text" list={`enemy-${field}-options`} maxLength={60}
                  value={bulk[field]} disabled={off} placeholder={FIELD_HINT[field]}
                  onChange={e => setBulk(b => ({ ...b, [field]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') applyBulk(field); }}
                  style={{ ...inputStyle, width: 170, padding: '6px 9px', fontSize: FS.md, opacity: off ? 0.5 : 1 }} />
                <Button variant={field === 'category' && value ? 'primary' : 'secondary'} disabled={off} onClick={() => applyBulk(field)}
                  title={value
                    ? `Posar «${value}» a tots els seleccionats`
                    : `Deixar els seleccionats sense ${FIELD_LABEL[field].toLowerCase()}`}>
                  {bulkBusy === field ? 'Desant…' : value ? 'Aplicar' : 'Treure'}
                </Button>
              </div>
            );
          })}
          {/* Una sola línia (el text llarg s'escurça): si la barra creixés, la taula es mouria */}
          <span title={bulkMsg?.text} style={{
            flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontSize: FS.sm, color: bulkMsg ? (bulkMsg.ok ? C.hpHigh : C.enemy) : C.dim,
          }}>
            {bulkMsg?.text ?? (picked.length ? '' : 'Marca enemics (o un grup sencer) per canviar-los la categoria o el projecte de cop. Maj+clic marca un tram.')}
          </span>
          {picked.length > 0 && (
            <Button variant="ghost" onClick={() => setPicked(enemies.map(e => e.id), false)} disabled={!!bulkBusy}>
              Deseleccionar
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ color: C.dim, fontSize: 13, padding: 20 }}>Carregant...</div>
      ) : (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {columns.map(({ key, label: h }) => key === 'sel' ? (
                  <th key={key} style={{ padding: '10px 4px 10px 14px', width: 1 }}>
                    {enemies.length > 0 && (
                      <Checkbox checked={picked.length === enemies.length} indeterminate={picked.length > 0 && picked.length < enemies.length}
                        onPick={() => setPicked(enemies.map(e => e.id), picked.length < enemies.length)}
                        label={picked.length < enemies.length ? 'Seleccionar tots els enemics' : 'Deseleccionar-los tots'} />
                    )}
                  </th>
                ) : (
                  <th key={key} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enemies.length === 0 && (
                <tr>
                  <td colSpan={columns.length} style={{ padding: '32px 14px', textAlign: 'center', color: C.dim, fontSize: 13 }}>
                    {apiOk ? 'Sense enemics. Crea el primer!' : '—'}
                  </td>
                </tr>
              )}
              {groups
                ? groups.map((g, gi) => {
                  const open = !grouping.isCollapsed(g.key);
                  const inGroup = g.items.filter(e => selected.has(e.id)).length;
                  return (
                    <React.Fragment key={`g:${g.key}`}>
                      <tr style={{ borderTop: gi === 0 ? 'none' : `1px solid ${C.border}`, background: 'rgba(255,255,255,0.025)' }}>
                        <td style={{ padding: '0 4px 0 14px', width: 1 }}>
                          <Checkbox checked={inGroup === g.items.length} indeterminate={inGroup > 0 && inGroup < g.items.length}
                            onPick={() => setPicked(g.items.map(e => e.id), inGroup < g.items.length)}
                            label={inGroup < g.items.length ? `Seleccionar tot el grup «${g.label}»` : `Deseleccionar el grup «${g.label}»`} />
                        </td>
                        <td colSpan={columns.length - 1} style={{ padding: 0 }}>
                          <GroupHeader label={g.label} count={g.items.length} open={open} unnamed={!g.key}
                            onToggle={() => grouping.toggle(g.key)} padding="9px 14px" fontSize={13} />
                        </td>
                      </tr>
                      {open && g.items.map(en => renderRow(en, false))}
                    </React.Fragment>
                  );
                })
                : enemies.map((en, i) => renderRow(en, i === 0))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div style={{
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: '24px 28px',
            width: 420,
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: C.bright }}>
              {modal.mode === 'create' ? '+ Nou enemic' : 'Editar enemic'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Nom">
                <input
                  type="text"
                  value={modal.data.name}
                  onChange={e => updateField('name', e.target.value)}
                  placeholder="p.ex. Goblin"
                  style={inputStyle}
                />
              </Field>

              <div style={{ display: 'flex', gap: 12 }}>
                {(['project', 'category'] as const).map(field => (
                  <Field key={field} label={FIELD_LABEL[field]} style={{ flex: 1 }}>
                    <input
                      type="text"
                      list={`enemy-${field}-options`}
                      value={modal.data[field] ?? ''}
                      maxLength={60}
                      disabled={!groupsOk}
                      title={groupsOk ? 'Escriu-ne un de nou o tria un dels que ja existeixen' : 'La API encara no desa aquest camp'}
                      onChange={e => updateField(field, e.target.value)}
                      placeholder={FIELD_HINT[field]}
                      style={{ ...inputStyle, opacity: groupsOk ? 1 : 0.5 }}
                    />
                  </Field>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <Field label="Color" style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={modal.data.color}
                      onChange={e => updateField('color', e.target.value)}
                      style={{ width: 36, height: 30, border: `1px solid ${C.border}`, borderRadius: 5, background: 'none', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={modal.data.color}
                      onChange={e => updateField('color', e.target.value)}
                      style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }}
                    />
                  </div>
                </Field>
                <Field label="HP màx" style={{ width: 100 }}>
                  <input
                    type="number"
                    value={modal.data.hpMax}
                    min={1}
                    onChange={e => updateField('hpMax', parseInt(e.target.value) || 1)}
                    style={inputStyle}
                  />
                </Field>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <Field label="Radi (R) — px" style={{ flex: 1 }}>
                  <input
                    type="number"
                    value={modal.data.R}
                    min={8}
                    max={200}
                    onChange={e => updateField('R', parseInt(e.target.value) || 8)}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Escala (sm) — multiplicador" style={{ flex: 1 }}>
                  <input
                    type="number"
                    value={modal.data.sm}
                    min={0.1}
                    max={5}
                    step={0.05}
                    onChange={e => updateField('sm', parseFloat(e.target.value) || 0.1)}
                    style={inputStyle}
                  />
                </Field>
              </div>

              <Field label="Previsualització al grid">
                <GridTokenPreview
                  color={modal.data.color}
                  sm={modal.data.sm}
                  imageData={modal.data.imageData ?? ''}
                  name={modal.data.name}
                />
              </Field>

              <Field label="Imatge (opcional)">
                <ImageUpload
                  value={modal.data.imageData ?? ''}
                  onChange={v => updateField('imageData', v)}
                />
              </Field>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 22, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '8px 16px', border: `1px solid ${C.border}`, borderRadius: 6, background: 'transparent', color: C.text, fontSize: 12, cursor: 'pointer' }}>
                Cancel·lar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !modal.data.name.trim()}
                style={{
                  padding: '8px 20px',
                  border: 'none',
                  borderRadius: 6,
                  background: saving || !modal.data.name.trim() ? C.border : C.accent,
                  color: saving || !modal.data.name.trim() ? C.dim : '#000',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: saving || !modal.data.name.trim() ? 'default' : 'pointer',
                }}
              >
                {saving ? 'Desant...' : 'Desar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: '#080c12',
  border: `1px solid #21262d`,
  borderRadius: 6,
  color: '#c9d1d9',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

function ImageUpload({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange((ev.target?.result as string) ?? '');
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={value} alt="" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 6, border: `1px solid #21262d`, background: '#080c12' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              style={{ padding: '5px 12px', border: `1px solid #21262d`, borderRadius: 5, background: 'transparent', color: '#c9d1d9', fontSize: 11, cursor: 'pointer' }}
            >
              Canviar
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              style={{ padding: '5px 12px', border: '1px solid #f8514940', borderRadius: 5, background: 'transparent', color: '#f85149', fontSize: 11, cursor: 'pointer' }}
            >
              Treure
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            width: '100%',
            padding: '10px',
            border: `1px dashed #21262d`,
            borderRadius: 6,
            background: 'transparent',
            color: '#8b949e',
            fontSize: 12,
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          Seleccionar imatge…
        </button>
      )}
    </div>
  );
}

/**
 * Casella de selecció de la taula. `indeterminate` (grup o capçalera amb només una part
 * marcada) no és un atribut d'HTML: s'ha d'escriure a la propietat de l'element.
 */
function Checkbox({ checked, indeterminate = false, onPick, label }: {
  checked: boolean;
  indeterminate?: boolean;
  /** `shift`: Maj premuda (al clic, React dispara el `change` des del `click`). */
  onPick: (shift: boolean) => void;
  label: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return (
    <input ref={ref} type="checkbox" checked={checked} aria-label={label} title={label}
      onChange={e => onPick((e.nativeEvent as MouseEvent).shiftKey === true)}
      style={{ width: 15, height: 15, margin: 0, display: 'block', cursor: 'pointer', accentColor: C.accent }} />
  );
}

/** Valor de projecte o categoria a la taula; un guió si no en té. */
function GroupTag({ value }: { value?: string }) {
  const v = value?.trim();
  return v
    ? <span style={{ padding: '2px 8px', borderRadius: 999, background: tint(C.room, 0.12), border: `1px solid ${tint(C.room, 0.35)}`, color: C.room, fontSize: 11, whiteSpace: 'nowrap' }}>{v}</span>
    : <span style={{ color: C.dim }}>—</span>;
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label style={{ display: 'block', marginBottom: 5, fontSize: 10, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// Color de referència del token de jugador (Jugador 1 de DEFAULT_PARTY).
const PLAYER_REF_COLOR = '#4f8fd6';

/**
 * Previsualitzador del token dins una graella groga de 5 peus. Mostra el token de
 * l'enemic (color + imatge + inicials) a la seva mida real relativa al grid — el camp
 * `sm` és el diàmetre del token en caselles (sm=1 → creatura mitjana de 5 peus) — al
 * costat d'un token de Jugador estàndard (1 casella = 5 peus) per comparar-ne la mida.
 */
function GridTokenPreview({ color, sm, imageData, name }: { color: string; sm: number; imageData: string; name: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const [imgTick, setImgTick] = React.useState(0);

  // Carrega la imatge del token (data URL) i força un redibuix quan estigui llesta.
  // El redibuix quan `imageData` es buida o canvia el cobreix l'efecte de dibuix (que
  // en depèn); aquí només bumpegem l'estat des dels callbacks async de la imatge.
  React.useEffect(() => {
    imgRef.current = null;
    if (!imageData) return;
    const img = new Image();
    let alive = true;
    img.onload = () => { if (alive) { imgRef.current = img; setImgTick(t => t + 1); } };
    img.onerror = () => { if (alive) { imgRef.current = null; setImgTick(t => t + 1); } };
    img.src = imageData;
    return () => { alive = false; };
  }, [imageData]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cssW = canvas.clientWidth || 360;
    const cssH = canvas.clientHeight || 176;
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGridPreview(ctx, cssW, cssH, { color, sm, name, img: imgRef.current });
  }, [color, sm, name, imageData, imgTick]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: 176, display: 'block', borderRadius: 8, border: `1px solid ${C.border}`, background: '#0a0e14' }}
    />
  );
}

function drawGridPreview(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  { color, sm, name, img }: { color: string; sm: number; name: string; img: HTMLImageElement | null },
) {
  const TAU = Math.PI * 2;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(0, 0, W, H);

  const pad = 16;
  const labelH = 26;               // franja inferior per a les etiquetes
  const smC = Math.max(0.25, Math.min(5, sm || 1));
  const gapCells = 0.7;            // separació (en caselles) entre enemic i jugador
  const unitsW = smC + gapCells + 1;
  const availW = W - pad * 2;
  const availH = H - pad * 2 - labelH;
  // Mida de casella que fa cabre l'enemic (smC caselles) i el jugador (1 casella).
  let cell = Math.min(availW / unitsW, availH / Math.max(smC, 1));
  cell = Math.max(14, Math.min(56, cell));

  const enemyD = smC * cell;
  const playerD = cell;
  const contentW = enemyD + gapCells * cell + playerD;
  const startX = (W - contentW) / 2;
  const centerY = pad + availH / 2;
  const enemyCx = startX + enemyD / 2;
  const playerCx = startX + enemyD + gapCells * cell + playerD / 2;

  // Graella groga de 5 peus, alineada perquè el jugador ocupi una casella neta.
  const offX = (((playerCx - cell / 2) % cell) + cell) % cell;
  const offY = (((centerY - cell / 2) % cell) + cell) % cell;
  ctx.strokeStyle = 'rgba(255,214,64,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = offX; x <= W + 0.5; x += cell) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = offY; y <= H + 0.5; y += cell) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  // Casella de referència del jugador ressaltada suaument.
  ctx.fillStyle = 'rgba(255,214,64,0.07)';
  ctx.fillRect(playerCx - cell / 2, centerY - cell / 2, cell, cell);
  ctx.strokeStyle = 'rgba(255,214,64,0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(playerCx - cell / 2, centerY - cell / 2, cell, cell);

  drawPreviewToken(ctx, TAU, enemyCx, centerY, enemyD / 2, color, img, (name || 'En').slice(0, 2).toUpperCase());
  drawPreviewToken(ctx, TAU, playerCx, centerY, playerD / 2, PLAYER_REF_COLOR, null, 'PJ');

  // Etiquetes sota cada token.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const labelY = H - 9;
  const enemyFt = Math.round(smC * 5);
  const enemyName = (name || 'Enemic').length > 12 ? (name || 'Enemic').slice(0, 11) + '…' : (name || 'Enemic');
  ctx.font = 'bold 11px system-ui';
  ctx.fillStyle = '#e6a0a0';
  ctx.fillText(enemyName, enemyCx, labelY - 12);
  ctx.font = '10px system-ui';
  ctx.fillStyle = '#8b949e';
  ctx.fillText(`~${enemyFt} peus`, enemyCx, labelY);
  ctx.font = 'bold 11px system-ui';
  ctx.fillStyle = '#8fbdf0';
  ctx.fillText('Jugador', playerCx, labelY - 12);
  ctx.font = '10px system-ui';
  ctx.fillStyle = '#8b949e';
  ctx.fillText('5 peus', playerCx, labelY);
}

function drawPreviewToken(
  ctx: CanvasRenderingContext2D,
  TAU: number,
  cx: number,
  cy: number,
  r: number,
  fill: string,
  img: HTMLImageElement | null,
  initials: string,
) {
  ctx.save();
  // ombra
  ctx.beginPath(); ctx.arc(cx + 1.5, cy + 2.5, r, 0, TAU);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
  // base de color
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
  ctx.fillStyle = fill; ctx.fill();
  // imatge (retallada al cercle) o inicials
  if (img && img.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(9, r * 0.72)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(initials, cx, cy);
    ctx.textBaseline = 'alphabetic';
  }
  // contorn blanc
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.stroke();
  ctx.restore();
}
