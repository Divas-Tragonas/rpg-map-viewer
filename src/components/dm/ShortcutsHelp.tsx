'use client';
import React, { useEffect } from 'react';
import { X } from '@/components/icons';
import { C, FS, RADIUS, SHADOW } from '@/constants';

interface Props { onClose: () => void }

const GROUPS: { title: string; rows: [string, string][] }[] = [
  {
    // Una tecla d'una eina de l'altre mode hi canvia sol (la 5 jugant passa a Preparar…).
    title: 'Eines (la tecla canvia de mode si cal)',
    rows: [
      ['V · Esc', 'Selecció (tornar-hi des de qualsevol eina)'],
      ['1 · 2', 'Dibuix: ploma · goma (Jugar)'], ['3', 'Màgies (Jugar)'], ['4', 'Senyal i regla (Jugar)'],
      ['5', 'Parets i portes (Preparar)'], ['6', 'Llums (Preparar)'],
      ['A', 'Selecció múltiple (rectangle)'],
    ],
  },
  {
    title: 'Mapa i vista',
    rows: [
      ['Espai + arrossegar', 'Moure el mapa amb qualsevol eina'],
      ['Arrossegar en buit', 'Moure el mapa (eina de selecció)'],
      ['Botó central', 'Moure el mapa'],
      ['Roda · pinça', 'Zoom'],
      ['Dos dits (trackpad)', 'Moure el mapa'],
      ['Maj (toc)', 'Vista privada (com el selector de càmera del mapa)'],
      ['Ctrl (toc)', 'Vista compartida temporal: en sortir-ne, tothom torna on era'],
    ],
  },
  {
    title: 'Combat i edició',
    rows: [
      ['Enter', 'Passar el torn'],
      ['Ctrl+Z', 'Desfer l\'última acció (el botó Desfer de dalt diu quina)'],
      ['Supr', 'Treure de l\'escena els enemics seleccionats'],
      ['Backspace', 'Desfer l\'última paret (eina Parets)'],
      ['Clic dret', 'Menú del token, la sala o la zona'],
      ['Doble clic', 'Seleccionar tot el grup d\'un token'],
      ['?', 'Aquesta finestra'],
    ],
  },
];

const kbd: React.CSSProperties = {
  display: 'inline-block', padding: '1px 6px', borderRadius: RADIUS.sm, border: `1px solid ${C.border}`,
  background: 'rgba(255,255,255,0.05)', color: C.bright, fontSize: FS.xs, fontWeight: 700, whiteSpace: 'nowrap',
};

/**
 * Finestra de dreceres de teclat (tecla ? o menú ⋯ de la barra superior). Una drecera que només existeix
 * al teclat no la descobreix ningú: aquí es poden consultar totes.
 */
export function ShortcutsHelp({ onClose }: Props) {
  useEffect(() => {
    // Captura: que l'Esc tanqui aquesta finestra i no arribi a canviar l'eina activa.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') { e.stopImmediatePropagation(); e.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: 'min(760px, 100%)', maxHeight: '86vh', overflowY: 'auto', background: C.panel, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.menu }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ flex: 1, color: C.bright, fontWeight: 700, fontSize: FS.lg }}>Dreceres de teclat</span>
          <button onClick={onClose} title="Tancar (Esc)" style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', display: 'flex', padding: 2 }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, padding: 16 }}>
          {GROUPS.map(g => (
            <div key={g.title}>
              <div style={{ fontSize: FS.xs, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{g.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {g.rows.map(([k, d]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ minWidth: 88, flexShrink: 0 }}><span style={kbd}>{k}</span></span>
                    <span style={{ fontSize: FS.sm, color: C.text, lineHeight: 1.35 }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
