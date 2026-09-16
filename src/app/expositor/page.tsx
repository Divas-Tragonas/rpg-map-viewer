'use client';
import React, { useState, useRef, useCallback } from 'react';

/**
 * Visor local per a una pantalla solta. **No és l'Expositor del DM**: no rep res del
 * BroadcastChannel ni del WebSocket i el DM no el controla. Serveix per posar una imatge
 * o un vídeo a pantalla completa en un monitor de recanvi obrint-hi el fitxer a mà.
 *
 * L'Expositor sincronitzat (el que el DM ensenya als jugadors) viu al botó 🖼 de la barra
 * superior de la vista del DM i es veu a `/player`, no aquí. Tenir-ne dos que es deien
 * igual era la confusió de sempre.
 */
export default function ExpositorPage() {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback((file: File) => {
    const prev = mediaUrl;
    const url = URL.createObjectURL(file);
    setMediaUrl(url);
    setFileName(file.name);
    setMediaType(file.type.startsWith('video/') ? 'video' : 'image');
    if (prev) URL.revokeObjectURL(prev);
  }, [mediaUrl]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  return (
    <div
      style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}
      onDrop={onDrop}
      onDragOver={e => e.preventDefault()}
    >
      {mediaUrl && mediaType === 'image' && (
        <img src={mediaUrl} alt={fileName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      )}
      {mediaUrl && mediaType === 'video' && (
        <video src={mediaUrl} autoPlay loop muted playsInline style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      )}
      {!mediaUrl && (
        <div style={{ textAlign: 'center', color: '#8b949e' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🖼</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#e6edf3', marginBottom: 8 }}>Visor local</div>
          <div style={{ fontSize: 13, marginBottom: 10 }}>Arrossega una imatge o vídeo aquí</div>
          <div style={{ fontSize: 11.5, marginBottom: 22, maxWidth: 380, lineHeight: 1.5, opacity: .8 }}>
            Pantalla completa per a un monitor de recanvi, amb el fitxer que hi obris tu.
            No està connectada amb el Dungeon Master: per ensenyar alguna cosa als jugadors,
            fes servir l&apos;Expositor 🖼 de la vista del DM, que es veu a <code>/player</code>.
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            style={{ padding: '10px 24px', background: 'rgba(212,160,23,.15)', border: '1px solid rgba(212,160,23,.5)', borderRadius: 8, color: '#d4a017', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
          >
            Seleccionar arxiu
          </button>
        </div>
      )}
      {mediaUrl && (
        <button
          onClick={() => inputRef.current?.click()}
          style={{ position: 'absolute', bottom: 20, right: 20, padding: '8px 16px', background: 'rgba(10,13,18,0.85)', border: '1px solid #21262d', borderRadius: 6, color: '#8b949e', cursor: 'pointer', fontSize: 12 }}
        >
          Canviar arxiu
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); }}
      />
    </div>
  );
}
