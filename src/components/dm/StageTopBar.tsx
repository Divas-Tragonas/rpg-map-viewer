'use client';
import React from 'react';
import { C } from '@/constants';
import { HoverTip } from '@/components/ui/HoverTip';

interface Props {
  expositorOpen: boolean; expositorActive: boolean; onToggleExpositor: () => void;
  textOpen: boolean; textActive: boolean; onToggleText: () => void;
}

const btnBase: React.CSSProperties = {
  position: 'relative', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, background: 'transparent', cursor: 'pointer', fontSize: 16, lineHeight: 1,
};

/**
 * Barra superior esquerra del canvas: Expositor i Revelador de text. Són botons iguals als
 * de la barra d'eines (mateixa mida, mateix contenidor) i la seva explicació surt en una
 * finestreta flotant en passar-hi el cursor, aquí desplegada cap avall.
 *
 * El punt de l'antic "◉ Expositor" passa a ser un indicador petit a la cantonada del botó:
 * verd viu = ara mateix s'està mostrant als jugadors.
 */
export function StageTopBar({ expositorOpen, expositorActive, onToggleExpositor, textOpen, textActive, onToggleText }: Props) {
  const [hover, setHover] = React.useState<string | null>(null);

  const item = (
    id: string, emoji: string, open: boolean, active: boolean, onClick: () => void,
    title: string, desc: React.ReactNode,
  ) => (
    <div style={{ position: 'relative', display: 'flex' }}
      onMouseEnter={() => setHover(id)}
      onMouseLeave={() => setHover(h => (h === id ? null : h))}>
      <button onClick={onClick}
        style={{
          ...btnBase,
          border: `1px solid ${open ? C.accent : active ? `${C.accent}88` : C.border}`,
          background: open ? `${C.accent}22` : 'transparent',
        }}>
        <span style={{ opacity: open || active ? 1 : 0.75 }}>{emoji}</span>
        {active && (
          <span title="S'està mostrant als jugadors"
            style={{ position: 'absolute', top: 3, right: 3, width: 6, height: 6, borderRadius: '50%', background: C.ok, boxShadow: `0 0 6px ${C.ok}` }} />
        )}
      </button>
      <HoverTip show={hover === id} side="bottom" title={title}>{desc}</HoverTip>
    </div>
  );

  return (
    <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 3, padding: 4, borderRadius: 9, background: 'rgba(10,13,18,.92)', border: `1px solid ${C.border}`, boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
      {item('expositor', '🖼', expositorOpen, expositorActive, onToggleExpositor, 'Expositor',
        <>Ensenya una <b style={{ color: C.text }}>imatge o un vídeo</b> a pantalla completa als jugadors (un retrat, un document, una escena). Al teu panell la pots enquadrar amb zoom i pan i té moviment Ken Burns; el que veus és el que veuen ells.</>)}
      {item('text', '📜', textOpen, textActive, onToggleText, 'Revelador de text',
        <>Va revelant un text als jugadors <b style={{ color: C.text }}>lletra a lletra</b>, amb pauses dramàtiques al final de cada frase. Pots deixar-lo córrer sol o anar-lo passant frase a frase. Amaga l&apos;expositor mentre està actiu (i a l&apos;inrevés).</>)}
    </div>
  );
}
