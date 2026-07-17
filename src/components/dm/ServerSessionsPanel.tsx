'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { C } from '@/constants';
import { api, isAdminLoggedIn, type ApiSessionMeta } from '@/lib/api';

interface Props {
  onClose: () => void;
  // Desa la partida actual com a NOVA entrada al servidor.
  onSaveNew: (name: string) => Promise<unknown>;
  // Sobreescriu una entrada existent amb la partida actual.
  onOverwrite: (id: string, name: string) => Promise<unknown>;
  // Carrega una partida del servidor a l'estat viu del DM.
  onLoad: (id: string) => Promise<void>;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('ca-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtSize(bytes: number): string {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ServerSessionsPanel({ onClose, onSaveNew, onOverwrite, onLoad }: Props) {
  const loggedIn = isAdminLoggedIn();
  const [list, setList] = useState<ApiSessionMeta[]>([]);
  const [loading, setLoading] = useState(loggedIn);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState('');

  // Cap setState abans del primer await: així es pot cridar des de l'effect
  // sense disparar renders en cascada (react-hooks/set-state-in-effect).
  const refresh = useCallback(async () => {
    if (!loggedIn) return;
    try {
      const items = await api.sessions.list();
      items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      setList(items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut');
    } finally {
      setLoading(false);
    }
  }, [loggedIn]);

  useEffect(() => { void refresh(); }, [refresh]);

  const withBusy = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Error desconegut'); throw err; }
    finally { setBusy(false); }
  }, []);

  const handleSaveNew = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await withBusy(() => onSaveNew(name));
      setNewName('');
      await refresh();
    } catch { /* error ja mostrat */ }
  }, [newName, onSaveNew, refresh, withBusy]);

  const handleOverwrite = useCallback(async (s: ApiSessionMeta) => {
    if (!confirm(`Sobreescriure «${s.name}» amb la partida actual?`)) return;
    try { await withBusy(() => onOverwrite(s.id, s.name)); await refresh(); }
    catch { /* error ja mostrat */ }
  }, [onOverwrite, refresh, withBusy]);

  const handleLoad = useCallback(async (s: ApiSessionMeta) => {
    if (!confirm(`Carregar «${s.name}»? Es substituirà la partida actual.`)) return;
    try { await withBusy(() => onLoad(s.id)); onClose(); }
    catch { /* error ja mostrat */ }
  }, [onLoad, onClose, withBusy]);

  const handleDelete = useCallback(async (s: ApiSessionMeta) => {
    if (!confirm(`Eliminar «${s.name}» del servidor? No es pot desfer.`)) return;
    try { await withBusy(() => api.sessions.delete(s.id)); await refresh(); }
    catch { /* error ja mostrat */ }
  }, [refresh, withBusy]);

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: 'min(560px, 92vw)', maxHeight: '82vh', display: 'flex', flexDirection: 'column', background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', overflow: 'hidden' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>☁ Partides al servidor</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        {!loggedIn ? (
          <div style={{ padding: 24, color: C.dim, fontSize: 13, lineHeight: 1.6 }}>
            Per desar i carregar partides al servidor has d&apos;iniciar sessió al Back Office.
            <div style={{ marginTop: 14 }}>
              <Link href="/admin/login" target="_blank"
                style={{ display: 'inline-block', padding: '8px 14px', borderRadius: 7, background: C.accent, color: '#0d1117', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>
                Iniciar sessió al Back Office
              </Link>
            </div>
            <div style={{ marginTop: 14, fontSize: 11, color: C.dim }}>
              Mentrestant pots seguir usant «Guardar» / «Cargar» amb fitxer .json.
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleSaveNew(); }}
                placeholder="Nom de la partida nova…"
                disabled={busy}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13 }}
              />
              <button onClick={() => void handleSaveNew()} disabled={busy || !newName.trim()}
                style={{ padding: '8px 14px', borderRadius: 7, border: 'none', cursor: busy || !newName.trim() ? 'default' : 'pointer', background: busy || !newName.trim() ? C.border : C.accent, color: '#0d1117', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>
                Desar nova
              </button>
            </div>

            {error && (
              <div style={{ padding: '10px 16px', background: 'rgba(220,60,60,0.12)', color: '#ff8a8a', fontSize: 12 }}>
                {error}
              </div>
            )}

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loading ? (
                <div style={{ padding: 24, color: C.dim, fontSize: 13, textAlign: 'center' }}>Carregant…</div>
              ) : list.length === 0 ? (
                <div style={{ padding: 24, color: C.dim, fontSize: 13, textAlign: 'center' }}>
                  Encara no hi ha cap partida desada al servidor.
                </div>
              ) : (
                list.map(s => (
                  <div key={s.id}
                    style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: C.text, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      <div style={{ color: C.dim, fontSize: 10, marginTop: 2 }}>
                        {fmtDate(s.updatedAt)}{s.sizeBytes ? ` · ${fmtSize(s.sizeBytes)}` : ''}
                      </div>
                    </div>
                    <button onClick={() => void handleLoad(s)} disabled={busy} title="Carregar aquesta partida"
                      style={{ padding: '6px 10px', borderRadius: 6, border: 'none', cursor: busy ? 'default' : 'pointer', background: C.accent, color: '#0d1117', fontWeight: 700, fontSize: 11 }}>
                      Carregar
                    </button>
                    <button onClick={() => void handleOverwrite(s)} disabled={busy} title="Sobreescriure amb la partida actual"
                      style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', cursor: busy ? 'default' : 'pointer', color: C.dim, fontSize: 11 }}>
                      Sobreescriure
                    </button>
                    <button onClick={() => void handleDelete(s)} disabled={busy} title="Eliminar del servidor"
                      style={{ padding: '6px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', cursor: busy ? 'default' : 'pointer', color: '#ff8a8a', fontSize: 11 }}>
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
