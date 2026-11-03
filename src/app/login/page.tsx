'use client';
import React, { useState } from 'react';
import { C, FS, RADIUS, FONT_SERIF } from '@/constants';
import { Button } from '@/components/ui/Button';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** On anar després d'entrar (només camins interns; mateix criteri que `safeNext`). */
function nextPath(): string {
  const n = new URLSearchParams(window.location.search).get('next');
  return n && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') ? n : '/';
}

/** Porta de la web: tot menys `/player` demana aquesta contrasenya (veure `src/proxy.ts`). */
export default function SiteLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/site-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = `${BASE}${nextPath()}`;
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Contrasenya incorrecta');
    } catch {
      setError('Error de connexió');
    }
    setLoading(false);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <form onSubmit={handleSubmit} style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg,
        padding: '28px 32px', width: 300, maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: FONT_SERIF, fontSize: 22, color: C.bright }}>RPG Map Viewer</div>
          <div style={{ fontSize: FS.sm, color: C.dim, marginTop: 4 }}>Només el DM. Els jugadors entren per /player.</div>
        </div>
        <label htmlFor="site-pw" style={{ display: 'block', marginBottom: 6, fontSize: FS.sm, color: C.dim }}>Contrasenya</label>
        <input id="site-pw" type="password" value={password} autoFocus autoComplete="current-password"
          onChange={e => setPassword(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '9px 11px', background: C.dark,
            border: `1px solid ${error ? C.enemy : C.border}`, borderRadius: RADIUS.md,
            color: C.bright, fontSize: FS.lg, outline: 'none',
          }} />
        {error && <div role="alert" style={{ marginTop: 8, fontSize: FS.sm, color: C.enemy }}>{error}</div>}
        <div style={{ marginTop: 16 }}>
          <Button type="submit" variant="primary" size="lg" block disabled={loading || !password}>
            {loading ? 'Entrant…' : 'Entrar'}
          </Button>
        </div>
      </form>
    </div>
  );
}
