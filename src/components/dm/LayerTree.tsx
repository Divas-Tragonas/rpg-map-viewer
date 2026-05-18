'use client';
import React from 'react';
import { ChevronDown, ChevronRight, Shield, MapPin, Skull } from '@/components/icons';
import { TreeGroup } from '@/components/ui/TreeGroup';
import { LayerRow } from '@/components/ui/LayerRow';
import { C } from '@/constants';
import type { MapStructure, VisMap, PSDLayer } from '@/types';

interface Props {
  struct: MapStructure;
  vis: VisMap;
  expanded: Record<number, boolean>;
  activeDrag: string | number | null;
  selectedToken: string | number | null;
  setExpanded: (fn: (e: Record<number, boolean>) => Record<number, boolean>) => void;
  setSelectedToken: (id: string | number | null) => void;
  rSelectedToken: React.MutableRefObject<string | number | null>;
  onToggleVis: (id: number) => void;
  onDeleteLayer: (id: number, kind: string) => void;
  onResetToken: (en: PSDLayer) => void;
}

export function LayerTree({ struct, vis, expanded, activeDrag, selectedToken, setExpanded, setSelectedToken, rSelectedToken, onToggleVis, onDeleteLayer, onResetToken }: Props) {
  return (
    <>
      {struct.extras.children.length > 0 && (
        <TreeGroup label="EXTRAS" color={C.extras} icon={<Shield size={11} />} note="Fijo">
          {struct.extras.children.map(l => (
            <LayerRow key={l.id} layer={l} locked color={C.extras} onDelete={() => onDeleteLayer(l.id, 'extra')} />
          ))}
        </TreeGroup>
      )}
      {struct.zonasLayers.length > 0 && (
        <TreeGroup label="ZONAS" color={C.zone} icon={<MapPin size={11} />} note="Overlays" defaultOpen={false}>
          {struct.zonasLayers.map(l => (
            <LayerRow key={l.id} layer={l} visible={!!vis[l.id]} onToggle={() => onToggleVis(l.id)} color={C.zone} onDelete={() => onDeleteLayer(l.id, 'zone')} />
          ))}
        </TreeGroup>
      )}
      {struct.enemyZones.map(zone => (
        <div key={zone.id}>
          <button onClick={() => setExpanded(e => ({ ...e, [zone.id]: !e[zone.id] }))}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(248,81,73,.06)', border: 'none', cursor: 'pointer', color: C.text }}>
            {expanded[zone.id] ? <ChevronDown size={12} color={C.dim} /> : <ChevronRight size={12} color={C.dim} />}
            <Skull size={11} color={C.enemy} />
            <span style={{ flex: 1, fontWeight: 600, color: C.enemy, fontSize: 13, textAlign: 'left' }}>{zone.name}</span>
            <span style={{ fontSize: 11, color: C.dim }}>{zone.enemies.filter(en => vis[en.id]).length}/{zone.enemies.length}</span>
          </button>
          {expanded[zone.id] && (
            <>
              {(zone.directEnemies || zone.enemies).map(en => (
                <LayerRow key={en.id} layer={en} visible={!!vis[en.id]} onToggle={() => onToggleVis(en.id)}
                  color={C.enemy} indent draggable active={activeDrag === en.id}
                  onReset={() => onResetToken(en)} onDelete={() => onDeleteLayer(en.id, 'enemy')}
                  selected={selectedToken === en.id}
                  onSelect={() => { setSelectedToken(en.id); rSelectedToken.current = en.id; }} />
              ))}
              {(zone.subGroups || []).map(sg => (
                <div key={sg.id}>
                  <button onClick={() => setExpanded(ex => ({ ...ex, [sg.id]: !ex[sg.id] }))}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px 5px 28px', background: 'rgba(248,81,73,.03)', border: 'none', cursor: 'pointer', color: C.dim }}>
                    {expanded[sg.id] ? <ChevronDown size={10} color={C.dim} /> : <ChevronRight size={10} color={C.dim} />}
                    <span style={{ fontSize: 11, color: C.dim, flex: 1, textAlign: 'left' }}>📁 {sg.name}</span>
                    <span style={{ fontSize: 10, color: C.dim }}>{sg.enemies.filter(en => vis[en.id]).length}/{sg.enemies.length}</span>
                  </button>
                  {expanded[sg.id] && sg.enemies.map(en => (
                    <LayerRow key={en.id} layer={en} visible={!!vis[en.id]} onToggle={() => onToggleVis(en.id)}
                      color={C.enemy} indent2 draggable active={activeDrag === en.id}
                      onReset={() => onResetToken(en)} onDelete={() => onDeleteLayer(en.id, 'enemy')}
                      selected={selectedToken === en.id}
                      onSelect={() => { setSelectedToken(en.id); rSelectedToken.current = en.id; }} />
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      ))}
    </>
  );
}
