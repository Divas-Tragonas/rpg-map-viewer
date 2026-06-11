'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { C } from '@/constants';

const NAV_ITEMS = [
  { href: '/admin/enemics', label: 'Enemics', icon: '⚔️' },
  { href: '/admin/mapes',   label: 'Mapes',   icon: '🗺️', soon: true },
  { href: '/admin/zones',   label: 'Zones',   icon: '🔮', soon: true },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    document.cookie = 'admin_token=; path=/; max-age=0; samesite=strict';
    router.push('/admin/login');
  }

  return (
    <aside style={{
      width: 200,
      background: C.panel,
      borderRight: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{ padding: '20px 16px 12px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Back Office
        </div>
        <div style={{ fontSize: 13, color: C.bright, fontWeight: 600, marginTop: 3 }}>
          RPG Map Viewer
        </div>
      </div>

      <nav style={{ flex: 1, padding: '8px 0' }}>
        {NAV_ITEMS.map(item => {
          const active = pathname.startsWith(item.href);
          return (
            <div key={item.href} style={{ position: 'relative' }}>
              {item.soon ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  color: C.dim,
                  fontSize: 13,
                  cursor: 'default',
                  opacity: 0.5,
                }}>
                  <span style={{ fontSize: 15 }}>{item.icon}</span>
                  {item.label}
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: C.dim, background: C.dark, padding: '1px 5px', borderRadius: 4, border: `1px solid ${C.border}` }}>
                    aviat
                  </span>
                </div>
              ) : (
                <Link href={item.href} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  color: active ? C.bright : C.text,
                  fontSize: 13,
                  textDecoration: 'none',
                  background: active ? `${C.accent}18` : 'transparent',
                  borderRight: active ? `2px solid ${C.accent}` : '2px solid transparent',
                  transition: 'background 0.15s',
                }}>
                  <span style={{ fontSize: 15 }}>{item.icon}</span>
                  {item.label}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}` }}>
        <Link href="/" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: C.dim,
          fontSize: 11,
          textDecoration: 'none',
          marginBottom: 8,
        }}>
          ← Vista DM
        </Link>
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '7px 0',
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            background: 'transparent',
            color: C.dim,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Tancar sessió
        </button>
      </div>
    </aside>
  );
}
