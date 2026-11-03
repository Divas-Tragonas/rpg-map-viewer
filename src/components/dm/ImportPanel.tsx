'use client';
import React from 'react';
import { ImageIcon } from '@/components/icons';
import { DropZone } from '@/components/ui/DropZone';
import { SidebarSection, SectionButton } from '@/components/ui/SidebarSection';
import { C } from '@/constants';

interface Props {
  bgLoaded: boolean; bgName: string;
  onLoadBg: (f: File) => void;
  onLoadDemo: () => void;
}

export function ImportPanel({ bgLoaded, bgName, onLoadBg, onLoadDemo }: Props) {
  return (
    // Un cop hi ha mapa carregat la secció es plega sola: no cal tenir sempre a la vista
    // la caixa d'importació, que és espai que treu a les sales i als jugadors.
    // (el `key` fa que en carregar el primer mapa la secció es torni a muntar ja plegada)
    <SidebarSection key={bgLoaded ? 'loaded' : 'empty'} title="Importar" icon={<ImageIcon size={13} />} defaultOpen={!bgLoaded} bodyPadding="0 12px 7px"
      actions={
        <SectionButton onClick={onLoadDemo} title="Carregar el mapa de demostració">Demo</SectionButton>
      }>
      <DropZone accept="image/*,video/*"
        label={bgLoaded ? bgName : 'Imatge o vídeo'} sub={bgLoaded ? 'Carregat' : ''}
        active={bgLoaded} color={bgLoaded ? C.ok : C.dim}
        onFile={onLoadBg} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onLoadBg(f); }} />
    </SidebarSection>
  );
}
