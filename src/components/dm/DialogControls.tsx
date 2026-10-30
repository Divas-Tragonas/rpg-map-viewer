'use client';
import React from 'react';
import { C, FS, RADIUS, SHADOW } from '@/constants';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, ChevronRight, SpeechIcon, X } from '@/components/icons';
import type { DialogUi } from '@/hooks/useDialog';

const ell: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

/**
 * Barra del DM mentre corre un diàleg (a dalt de l'escenari, damunt de la barra negra de
 * la cinemàtica): què es diu ara, què ve després i les opcions de resposta per clicar la
 * que han triat els jugadors. Les mateixes accions van amb Espai/→, ← i Esc.
 */
export function DialogControls({ ui, onAdvance, onBack, onChoose, onEnd }: {
  ui: DialogUi;
  onAdvance: () => void;
  onBack: () => void;
  onChoose: (i: number) => void;
  onEnd: () => void;
}) {
  const nextLabel = !ui.complete ? 'Completar' : ui.next ? 'Següent' : 'Acabar';
  return (
    <div style={{
      // A l'esquerra: a la dreta hi ha el selector de càmera i el zoom (`CanvasHUD`).
      position: 'absolute', top: 8, left: 12, zIndex: 70,
      width: 'min(720px, calc(100% - 430px))', minWidth: 380, display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 8px 7px 12px', background: C.float, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.float,
    }}>
      <SpeechIcon size={15} color={C.dim} />
      {ui.waiting ? (
        <div style={{ flex: 1, fontSize: FS.sm, color: C.text }}>Cinemàtica de boss… el diàleg començarà després.</div>
      ) : (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: FS.sm, minWidth: 0 }}>
            <span style={{ color: C.dim, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{ui.step}/{ui.total}</span>
            <span style={{ color: C.bright, fontWeight: 700, flexShrink: 0 }}>{ui.name}</span>
            <span style={{ color: C.text, ...ell }}>{ui.text}</span>
          </div>
          {ui.options.length > 0 ? (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {ui.options.map((op, i) => (
                <Button key={i} size="sm" variant="secondary" disabled={!ui.complete} onClick={() => onChoose(i)} title={`Han triat «${op}» (tecla ${i + 1})`}>
                  {i + 1}. {op}
                </Button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: FS.xs, color: C.dim, ...ell }}>
              {ui.next ? <>Després · <b style={{ color: C.text }}>{ui.next.name}</b>: {ui.next.text}</> : 'És l\'última línia.'}
            </div>
          )}
        </div>
      )}
      {!ui.waiting && (
        <>
          <Button size="md" variant="ghost" disabled={!ui.canBack} onClick={onBack} title="Línia anterior (←)" aria-label="Línia anterior"><ChevronLeft size={14} /></Button>
          <Button size="md" variant="primary" disabled={ui.complete && ui.options.length > 0} onClick={onAdvance} title="Espai o →" style={{ minWidth: 98, justifyContent: 'center' }}>
            {nextLabel} <ChevronRight size={13} />
          </Button>
        </>
      )}
      <Button size="md" variant="ghost" onClick={onEnd} title="Acabar el diàleg a totes les pantalles (Esc)" aria-label="Acabar el diàleg"><X size={14} /></Button>
    </div>
  );
}
