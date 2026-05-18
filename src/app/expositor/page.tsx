'use client';
import React, { useState, useRef, useCallback } from 'react';

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
          <div style={{ fontSize: 18, fontWeight: 600, color: '#e6edf3', marginBottom: 8 }}>Expositor de Campanya</div>
          <div style={{ fontSize: 13, marginBottom: 24 }}>Arrossega una imatge o vídeo aquí</div>
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
