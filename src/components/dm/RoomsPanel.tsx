'use client';
import React, { useState } from 'react';
import { Eye, EyeOff, Trash2 } from '@/components/icons';
import { C } from '@/constants';
import type { Room, LightSource } from '@/types';

interface Props {
  rooms: Room[];
  lights: LightSource[];
  wallsCount: number;
  wallToolActive: boolean;
  selectedLightId: string | null;
  /** Ref del hover de sala: pintar-hi l'id ressalta la sala al canvas (renderRooms). */
  hoveredRoomRef: React.MutableRefObject<string | null>;
  onActivateWallTool: () => void;
  onActivateLightTool: () => void;
  onSetRoomDark: (id: string, dark: boolean) => void;
  onToggleRoomReveal: (id: string) => void;
  onRenameRoom: (id: string, name: string) => void;
  onDeleteRoom: (id: string) => void;
  onAddDoor: (id: string) => void;
  onResetExplored: (id: string) => void;
  onSelectLight: (id: string | null) => void;
  onRemoveLight: (id: string) => void;
}

/**
 * Arbre de "capes" d'un mapa dibuixat a l'app (sense PSD): les sales detectades a partir
 * de les parets i els punts de llum. Fa per a les sales el que el LayerTree fa per a les
 * capes del PSD — llistar-les, veure'n l'estat i controlar-les sense haver de buscar-les
 * al canvas amb el clic dret.
 */
export function RoomsPanel({
  rooms, lights, wallsCount, wallToolActive, selectedLightId, hoveredRoomRef,
  onActivateWallTool, onActivateLightTool, onSetRoomDark, onToggleRoomReveal,
  onRenameRoom, onDeleteRoom, onAddDoor, onResetExplored, onSelectLight, onRemoveLight,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Es desa l'id pendent de confirmar (no un booleà) perquè obrir una altra sala no
  // arribi ja confirmada — mateix criteri que el menú contextual de sala.
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);

  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <div style={{ padding: '7px 12px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Sales {rooms.length > 0 && <span style={{ color: C.room }}>· {rooms.length}</span>}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onActivateWallTool} title="Eina Parets (5): dibuixa parets i les sales es detecten soles"
            style={{ background: wallToolActive ? `${C.accent}22` : 'transparent', border: `1px solid ${wallToolActive ? C.accent : C.border}`, borderRadius: 5, padding: '2px 7px', cursor: 'pointer', color: wallToolActive ? C.accent : C.dim, fontSize: 10, fontWeight: 700 }}>
            🧱 Parets
          </button>
          <button onClick={onActivateLightTool} title="Eina Llums (6): col·loca torxes dins de les sales"
            style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 5, padding: '2px 7px', cursor: 'pointer', color: C.dim, fontSize: 10, fontWeight: 700 }}>
            🔆 Llums
          </button>
        </div>
      </div>

      {rooms.length === 0 && (
        <div style={{ padding: '0 12px 8px', color: C.dim, fontSize: 11, lineHeight: 1.5 }}>
          {wallsCount > 0
            ? 'Hi ha parets dibuixades però cap recinte tancat encara. Tanca el perímetre perquè es detecti una sala.'
            : 'Dibuixa parets amb l’eina 🧱 i les sales apareixeran aquí. No cal cap arxiu de Photoshop.'}
        </div>
      )}

      {rooms.map(room => {
        const open = openId === room.id;
        return (
          <div key={room.id}
            onMouseEnter={() => { hoveredRoomRef.current = room.id; }}
            onMouseLeave={() => { if (hoveredRoomRef.current === room.id) hoveredRoomRef.current = null; }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px 4px 14px', background: open ? 'rgba(100,210,255,.08)' : 'transparent' }}>
              <button onClick={() => onSetRoomDark(room.id, !room.dark)}
                title={room.dark ? 'Sala fosca (clic per treure)' : 'Marcar com a sala fosca'}
                style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', fontSize: 12, lineHeight: 1, opacity: room.dark ? 1 : 0.35, flexShrink: 0 }}>
                🌑
              </button>
              {room.dark ? (
                <button onClick={() => onToggleRoomReveal(room.id)}
                  title={room.revealed ? 'Revelada: amagar als jugadors' : 'Amagada: revelar als jugadors'}
                  style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: room.revealed ? C.room : C.dim, display: 'flex', flexShrink: 0 }}>
                  {room.revealed ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
              ) : <span style={{ width: 16, flexShrink: 0 }} />}
              <input
                defaultValue={room.name}
                title="Clic per reanomenar la sala"
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                onFocus={e => { e.target.style.background = '#0d1117'; e.target.style.borderColor = C.border; }}
                onBlur={e => {
                  e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent';
                  if (e.target.value !== room.name) onRenameRoom(room.id, e.target.value);
                }}
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: '1px solid transparent', borderRadius: 4, padding: '2px 4px', color: C.text, fontSize: 12, outline: 'none' }}
              />
              <button onClick={() => { setOpenId(open ? null : room.id); setConfirmDelId(null); }}
                title="Més accions"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, fontSize: 11, padding: '0 2px', flexShrink: 0 }}>
                {open ? '▾' : '▸'}
              </button>
            </div>

            {/* Desplegable d'accions (mateixes que el menú contextual de la sala) */}
            <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows .18s ease' }}>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ padding: '4px 10px 8px 34px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button onClick={() => onAddDoor(room.id)}
                    style={{ padding: '5px 7px', borderRadius: 5, border: '1px solid rgba(63,185,80,.45)', background: 'rgba(63,185,80,.12)', color: '#3fb950', cursor: 'pointer', fontSize: 11, fontWeight: 600, textAlign: 'left' }}>
                    🚪 Afegir porta
                  </button>
                  {room.dark && (
                    <button onClick={() => onResetExplored(room.id)}
                      style={{ padding: '5px 7px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.04)', color: C.text, cursor: 'pointer', fontSize: 11, fontWeight: 600, textAlign: 'left' }}>
                      🌑 Resetejar explorat
                    </button>
                  )}
                  {confirmDelId === room.id ? (
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button onClick={() => { onDeleteRoom(room.id); setConfirmDelId(null); setOpenId(null); }}
                        style={{ flex: 1, padding: '5px 7px', borderRadius: 5, border: '1px solid rgba(248,81,73,.5)', background: 'rgba(248,81,73,.18)', color: '#f85149', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                        Sí, eliminar
                      </button>
                      <button onClick={() => setConfirmDelId(null)}
                        style={{ flex: 1, padding: '5px 7px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: 11 }}>
                        No
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelId(room.id)}
                      style={{ padding: '5px 7px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: '#f85149', cursor: 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Trash2 size={10} /> Eliminar sala
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {lights.length > 0 && (
        <>
          <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Punts de llum <span style={{ color: C.warn }}>· {lights.length}</span>
          </div>
          {lights.map((l, i) => (
            <div key={l.id} onClick={() => onSelectLight(l.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px 4px 14px', cursor: 'pointer', background: selectedLightId === l.id ? 'rgba(210,153,34,.12)' : 'transparent' }}>
              <span style={{ fontSize: 12, flexShrink: 0 }}>🔆</span>
              <span style={{ flex: 1, fontSize: 12, color: C.text }}>Llum {i + 1}</span>
              <span style={{ fontSize: 10, color: C.dim }}>{l.radiusFt} ft</span>
              <button onClick={e => { e.stopPropagation(); onRemoveLight(l.id); }} title="Eliminar llum"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: 1, display: 'flex', flexShrink: 0 }}>
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
