'use client';
import React from 'react';
import { Shield, MapPin } from '@/components/icons';
import { TreeGroup } from '@/components/ui/TreeGroup';
import { LayerRow } from '@/components/ui/LayerRow';
import { C, FS } from '@/constants';
import type { MapStructure, VisMap } from '@/types';

interface Props {
  struct: MapStructure;
  vis: VisMap;
  onToggleVis: (id: number) => void;
  onDeleteLayer: (id: number, kind: string) => void;
}

/**
 * Capes de MAPA del PSD (extras i zones). Els enemics del PSD ja no hi són: viuen a la
 * pestanya Escena, al costat dels de la biblioteca, amb la vida i la visibilitat.
 *
 * ⚠️ A les zones, `vis[id]` vol dir «la COBERTA es veu», o sigui que la zona està AMAGADA
 * als jugadors. L'ull de la fila respon a la pregunta de tota l'app —ho veuen els
 * jugadors?—, per això se li passa `!vis[id]`.
 */
export function LayerTree({ struct, vis, onToggleVis, onDeleteLayer }: Props) {
  return (
    <>
      {struct.extras.children.length > 0 && (
        <TreeGroup label="Extres" color={C.extras} icon={<Shield size={11} />} note="Fix">
          {struct.extras.children.map(l => (
            <LayerRow key={l.id} layer={l} locked color={C.extras} onDelete={() => onDeleteLayer(l.id, 'extra')} />
          ))}
        </TreeGroup>
      )}
      {struct.roomLayers.length > 0 && (
        <TreeGroup label="Zones" color={C.room} icon={<MapPin size={11} />} note="Cobertes" defaultOpen={false}>
          {struct.roomLayers.map(l => (
            <LayerRow key={l.id} layer={l} visible={!vis[l.id]} onToggle={() => onToggleVis(l.id)} color={C.room} onDelete={() => onDeleteLayer(l.id, 'room')} />
          ))}
        </TreeGroup>
      )}
      {struct.extras.children.length === 0 && struct.roomLayers.length === 0 && (
        <div style={{ padding: '4px 12px 8px', fontSize: FS.sm, color: C.dim }}>Aquest PSD no té capes de mapa (extres ni zones).</div>
      )}
    </>
  );
}
