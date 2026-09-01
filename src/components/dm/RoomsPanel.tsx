'use client';
import React, { useState } from 'react';
import { Eye, EyeOff, Trash2 } from '@/components/icons';
import { C } from '@/constants';
import { SidebarSection, SectionButton } from '@/components/ui/SidebarSection';
import type { Room, LightSource } from '@/types';

interface Props {
  rooms: Room[];
  lights: LightSource[];
  wallsCount: number;
  wallToolActive: boolean;
  lightToolActive: boolean;
  selectedLightId: string | null;
  /** Ref del hover de sala: pintar-hi l'id ressalta la sala al canvas (renderRooms). */
  hoveredRoomRef: React.MutableRefObject<string | null>;
  onActivateWallTool: () => void;
  onActivateLightTool: () => void;
  /** Desfà l'últim canvi al mapa; `mapUndo` és la seva etiqueta (null = res a desfer). */
  onUndoMapEdit: () => void;
  mapUndo: string | null;
  onSetRoomDark: (id: string, dark: boolean) => void;
  onToggleRoomReveal: (id: string) => void;
  onRenameRoom: (id: string, name: string) => void;
  onDeleteRoom: (id: string) => void;
  onAddDoor: (id: string) => void;
  onResetExplored: (id: string) => void;
  onSelectLight: (id: string | null) => void;
  onRemoveLight: (id: string) => void;
}

function RoomRow({
  room, open, onToggleOpen, confirmDel, setConfirmDel, hoveredRoomRef,
  onSetRoomDark, onToggleRoomReveal, onRenameRoom, onDeleteRoom, onAddDoor, onResetExplored,
}: {
  room: Room; open: boolean; onToggleOpen: () => void;
  confirmDel: boolean; setConfirmDel: (v: string | null) => void;
  hoveredRoomRef: React.MutableRefObject<string | null>;
  onSetRoomDark: (id: string, dark: boolean) => void;
  onToggleRoomReveal: (id: string) => void;
  onRenameRoom: (id: string, name: string) => void;
  onDeleteRoom: (id: string) => void;
  onAddDoor: (id: string) => void;
  onResetExplored: (id: string) => void;
}) {
  return (
    <div
      onMouseEnter={() => { hoveredRoomRef.current = room.id; }}
      onMouseLeave={() => { if (hoveredRoomRef.current === room.id) hoveredRoomRef.current = null; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px 2px 10px', background: open ? 'rgba(100,210,255,.08)' : 'transparent' }}>
        <button onClick={() => onSetRoomDark(room.id, !room.dark)}
          title={room.dark ? 'Sala fosca (clic per treure)' : 'Marcar com a sala fosca'}
          style={{ background: 'none', border: 'none', padding: 1, cursor: 'pointer', fontSize: 11, lineHeight: 1, opacity: room.dark ? 1 : 0.3, flexShrink: 0 }}>
          🌑
        </button>
        {room.dark ? (
          <button onClick={() => onToggleRoomReveal(room.id)}
            title={room.revealed ? 'Revelada: amagar als jugadors' : 'Amagada: revelar als jugadors'}
            style={{ background: 'none', border: 'none', padding: 1, cursor: 'pointer', color: room.revealed ? C.room : C.dim, display: 'flex', flexShrink: 0 }}>
            {room.revealed ? <Eye size={11} /> : <EyeOff size={11} />}
          </button>
        ) : <span style={{ width: 13, flexShrink: 0 }} />}
        <input
          defaultValue={room.name}
          title="Clic per reanomenar la sala"
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          onFocus={e => { e.target.style.background = '#0d1117'; e.target.style.borderColor = C.border; }}
          onBlur={e => {
            e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent';
            if (e.target.value !== room.name) onRenameRoom(room.id, e.target.value);
          }}
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: '1px solid transparent', borderRadius: 4, padding: '1px 3px', color: C.text, fontSize: 11, outline: 'none' }}
        />
        <button onClick={onToggleOpen} title="Més accions"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, fontSize: 10, padding: '0 2px', flexShrink: 0 }}>
          {open ? '▾' : '▸'}
        </button>
      </div>

      {/* Desplegable d'accions (mateixes que el menú contextual de la sala) */}
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows .18s ease' }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ padding: '3px 8px 6px 28px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <button onClick={() => onAddDoor(room.id)}
              style={{ padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(63,185,80,.45)', background: 'rgba(63,185,80,.12)', color: '#3fb950', cursor: 'pointer', fontSize: 10.5, fontWeight: 600, textAlign: 'left' }}>
              🚪 Afegir porta
            </button>
            {room.dark && (
              <button onClick={() => onResetExplored(room.id)}
                style={{ padding: '4px 7px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.04)', color: C.text, cursor: 'pointer', fontSize: 10.5, fontWeight: 600, textAlign: 'left' }}>
                🌑 Resetejar explorat
              </button>
            )}
            {confirmDel ? (
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={() => { onDeleteRoom(room.id); setConfirmDel(null); onToggleOpen(); }}
                  style={{ flex: 1, padding: '4px 7px', borderRadius: 5, border: '1px solid rgba(248,81,73,.5)', background: 'rgba(248,81,73,.18)', color: '#f85149', cursor: 'pointer', fontSize: 10.5, fontWeight: 700 }}>
                  Sí, eliminar
                </button>
                <button onClick={() => setConfirmDel(null)}
                  style={{ flex: 1, padding: '4px 7px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: 10.5 }}>
                  No
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(room.id)}
                style={{ padding: '4px 7px', borderRadius: 5, border: `1px solid ${C.border}`, background: 'transparent', color: '#f85149', cursor: 'pointer', fontSize: 10.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Trash2 size={10} /> Eliminar sala
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Arbre de "capes" d'un mapa dibuixat a l'app (sense PSD): les sales detectades a partir
 * de les parets i els punts de llum. Fa per a les sales el que el LayerTree fa per a les
 * capes del PSD — llistar-les, veure'n l'estat i controlar-les sense haver de buscar-les
 * al canvas amb el clic dret.
 *
 * Les sales i les llums van cadascuna dins d'una secció plegable amb el seu comptador:
 * en un mapa amb moltes sales la llista sencera empenyia els jugadors fora de la pantalla.
 */
export function RoomsPanel({
  rooms, lights, wallsCount, wallToolActive, lightToolActive, selectedLightId, hoveredRoomRef,
  onActivateWallTool, onActivateLightTool, onUndoMapEdit, mapUndo, onSetRoomDark, onToggleRoomReveal,
  onRenameRoom, onDeleteRoom, onAddDoor, onResetExplored, onSelectLight, onRemoveLight,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Es desa l'id pendent de confirmar (no un booleà) perquè obrir una altra sala no
  // arribi ja confirmada — mateix criteri que el menú contextual de sala.
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  const darkCount = rooms.filter(r => r.dark).length;
  const revealedCount = rooms.filter(r => r.dark && r.revealed).length;

  return (
    <>
      <SidebarSection
        title="Sales" icon="🏛" count={rooms.length} countColor={C.room}
        defaultOpen={false} maxBodyHeight={230}
        actions={
          <>
            <SectionButton onClick={onActivateWallTool} active={wallToolActive}
              title="Eina Parets (5): dibuixa parets i les sales es detecten soles">🧱</SectionButton>
            <SectionButton onClick={onActivateLightTool} active={lightToolActive} color="#ffcc33"
              title="Eina Llums (6): col·loca torxes dins de les sales">🔆</SectionButton>
            {/* Un mode que només existeix al teclat no el descobreix ningú: el botó i el
                Ctrl+Z criden exactament la mateixa funció. */}
            <SectionButton onClick={onUndoMapEdit} disabled={!mapUndo}
              title={mapUndo ? `Desfer: ${mapUndo} (Ctrl+Z)` : 'Res a desfer al mapa'}>↶</SectionButton>
          </>
        }>
        {rooms.length === 0 ? (
          <div style={{ padding: '2px 12px 8px', color: C.dim, fontSize: 10.5, lineHeight: 1.5 }}>
            {wallsCount > 0
              ? 'Hi ha parets dibuixades però cap recinte tancat encara. Tanca el perímetre perquè es detecti una sala.'
              : 'Dibuixa parets amb l’eina 🧱 i les sales apareixeran aquí. No cal cap arxiu de Photoshop.'}
          </div>
        ) : (
          <>
            {darkCount > 0 && (
              <div style={{ padding: '0 10px 4px', fontSize: 9.5, color: C.dim }}>
                {darkCount} {darkCount === 1 ? 'fosca' : 'fosques'} · {revealedCount} {revealedCount === 1 ? 'revelada' : 'revelades'}
              </div>
            )}
            {rooms.map(room => (
              <RoomRow key={room.id} room={room}
                open={openId === room.id}
                onToggleOpen={() => { setOpenId(o => (o === room.id ? null : room.id)); setConfirmDelId(null); }}
                confirmDel={confirmDelId === room.id} setConfirmDel={setConfirmDelId}
                hoveredRoomRef={hoveredRoomRef}
                onSetRoomDark={onSetRoomDark} onToggleRoomReveal={onToggleRoomReveal}
                onRenameRoom={onRenameRoom} onDeleteRoom={onDeleteRoom}
                onAddDoor={onAddDoor} onResetExplored={onResetExplored} />
            ))}
          </>
        )}
      </SidebarSection>

      {lights.length > 0 && (
        <SidebarSection title="Punts de llum" icon="🔆" count={lights.length} countColor={C.warn}
          defaultOpen={false} maxBodyHeight={160}>
          {lights.map((l, i) => (
            <div key={l.id} onClick={() => onSelectLight(l.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px 3px 12px', cursor: 'pointer', background: selectedLightId === l.id ? 'rgba(210,153,34,.12)' : 'transparent' }}>
              <span style={{ fontSize: 11, flexShrink: 0 }}>🔆</span>
              <span style={{ flex: 1, fontSize: 11, color: C.text }}>Llum {i + 1}</span>
              <span style={{ fontSize: 10, color: C.dim }}>{l.radiusFt} ft</span>
              <button onClick={e => { e.stopPropagation(); onRemoveLight(l.id); }} title="Eliminar llum"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: 1, display: 'flex', flexShrink: 0 }}>
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </SidebarSection>
      )}
    </>
  );
}
