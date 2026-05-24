'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { C } from '@/constants';
import { api, isApiConfigured } from '@/lib/api';
import type { ApiEnemy } from '@/lib/api';

const EMPTY_FORM: Omit<ApiEnemy, 'id'> = {
  name: '',
  color: '#e05555',
  hpMax: 15,
  R: 30,
  sm: 1.0,
  imageData: '',
};

export default function EnemicsPage() {
  const [enemies, setEnemies] = useState<ApiEnemy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; data: Omit<ApiEnemy, 'id'>; id?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const apiOk = isApiConfigured();

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

  async function handleSave() {
    if (!modal) return;
    setSaving(true);
    try {
      if (modal.mode === 'create') {
        const created = await api.enemies.create(modal.data);
        setEnemies(prev => [...prev, created]);
      } else {
        const updated = await api.enemies.update(modal.id!, modal.data);
        setEnemies(prev => prev.map(e => e.id === modal.id ? updated : e));
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

      {/* Table */}
      {loading ? (
        <div style={{ color: C.dim, fontSize: 13, padding: 20 }}>Carregant...</div>
      ) : (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Color', 'Nom', 'HP màx', 'Radi (R)', 'Escala (sm)', 'Accions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enemies.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 14px', textAlign: 'center', color: C.dim, fontSize: 13 }}>
                    {apiOk ? 'Sense enemics. Crea el primer!' : '—'}
                  </td>
                </tr>
              )}
              {enemies.map((enemy, i) => (
                <tr key={enemy.id} style={{ borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: enemy.color, border: `1px solid ${C.border}`, flexShrink: 0 }} />
                  </td>
                  <td style={{ padding: '10px 14px', color: C.bright, fontWeight: 600 }}>
                    {enemy.name}
                  </td>
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
              ))}
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
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: modal.data.R * 0.4, height: modal.data.R * 0.4, maxWidth: 60, maxHeight: 60, borderRadius: '50%', background: modal.data.color, border: `1px solid ${C.border}` }} />
                    <span style={{ fontSize: 10, color: C.dim }}>previsualització</span>
                  </div>
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

              <Field label="Imatge (base64, opcional)">
                <textarea
                  value={modal.data.imageData ?? ''}
                  onChange={e => updateField('imageData', e.target.value)}
                  placeholder="data:image/png;base64,..."
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 10 }}
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
