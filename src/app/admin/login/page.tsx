'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { C } from '@/constants';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      setError('API no configurada');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Contrasenya incorrecta');
      } else {
        const { token } = await res.json();
        document.cookie = `admin_token=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=strict`;
        router.push('/admin/enemics');
      }
    } catch {
      setError('Error de connexió');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: C.bg,
      fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace',
    }}>
      <form onSubmit={handleSubmit} style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: '32px 36px',
        width: 320,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🗡️</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.bright }}>Back Office</div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>RPG Map Viewer</div>
        </div>

        <label style={{ display: 'block', marginBottom: 6, fontSize: 11, color: C.dim }}>
          Contrasenya
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoFocus
          style={{
            width: '100%',
            padding: '9px 11px',
            background: C.dark,
            border: `1px solid ${error ? '#f85149' : C.border}`,
            borderRadius: 6,
            color: C.bright,
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        {error && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#f85149' }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '10px 0',
            background: loading || !password ? C.border : C.accent,
            border: 'none',
            borderRadius: 6,
            color: loading || !password ? C.dim : '#000',
            fontSize: 13,
            fontWeight: 700,
            cursor: loading || !password ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Entrant...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
