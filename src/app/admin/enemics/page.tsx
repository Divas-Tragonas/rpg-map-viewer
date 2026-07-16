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
                {['', 'Color', 'Nom', 'HP màx', 'Radi (R)', 'Escala (sm)', 'Accions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enemies.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '32px 14px', textAlign: 'center', color: C.dim, fontSize: 13 }}>
                    {apiOk ? 'Sense enemics. Crea el primer!' : '—'}
                  </td>
                </tr>
              )}
              {enemies.map((enemy, i) => (
                <tr key={enemy.id} style={{ borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
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
