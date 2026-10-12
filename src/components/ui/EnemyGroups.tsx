'use client';
import React from 'react';
import { C, FS } from '@/constants';
import { Button } from '@/components/ui/Button';
import { GROUP_BY_OPTIONS } from '@/lib/enemy-groups';
import type { EnemyGroupBy } from '@/lib/enemy-groups';

/**
 * Controls comuns per agrupar els enemics de la BD: els fan servir el back office
 * (`/admin/enemics`) i la Biblioteca del DM, perquè es vegin i es facin servir igual.
 */

/** «Agrupar per: Projecte · Categoria · Cap» + plegar/desplegar tots els grups. */
export function EnemyGroupToolbar({ by, onBy, allFolded, onFoldAll, size = 'sm' }: {
  by: EnemyGroupBy;
  onBy: (by: EnemyGroupBy) => void;
  /** Tots els grups plegats: el botó passa a desplegar-los. */
  allFolded: boolean;
  onFoldAll: (fold: boolean) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      <span style={{ fontSize: size === 'sm' ? FS.xs : FS.sm, color: C.dim, marginRight: 2 }}>Agrupar per</span>
      {GROUP_BY_OPTIONS.map(o => (
        <Button key={o.by} size={size} active={by === o.by} onClick={() => onBy(o.by)}
          title={o.by === 'none' ? 'Llista sense grups' : `Agrupar els enemics per ${o.label.toLowerCase()}`}>
          {o.label}
        </Button>
      ))}
      {by !== 'none' && (
        <Button variant="ghost" size={size} onClick={() => onFoldAll(!allFolded)} style={{ marginLeft: 'auto' }}>
          {allFolded ? 'Desplegar tot' : 'Plegar tot'}
        </Button>
      )}
    </div>
  );
}

/** Capçalera clicable d'un grup: fletxa, nom i nombre d'enemics. */
export function GroupHeader({ label, count, open, onToggle, unnamed, padding = '5px 4px', fontSize = FS.sm }: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  /** Grup dels que no tenen valor («Sense projecte»): en cursiva perquè no sembli un nom. */
  unnamed?: boolean;
  padding?: string;
  fontSize?: number;
}) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open}
      title={open ? 'Plegar el grup (amaga els seus enemics)' : 'Desplegar el grup'}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding,
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        color: open ? C.text : C.dim, fontSize, fontWeight: 700,
      }}>
      <span style={{ fontSize: FS.xs, color: C.dim, width: 9, flexShrink: 0, display: 'inline-block', transition: 'transform .18s ease', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: unnamed ? 'italic' : undefined }}>
        {label}
      </span>
      <span style={{ fontSize: FS.xs, color: C.accent, flexShrink: 0 }}>{count}</span>
    </button>
  );
}

/** Cos plegable d'un grup (mateix truc `grid-template-rows: 0fr → 1fr` que `SidebarSection`). */
export function GroupBody({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows .2s ease' }}>
      <div style={{ overflow: 'hidden', minHeight: 0 }} inert={!open}>
        {children}
      </div>
    </div>
  );
}
