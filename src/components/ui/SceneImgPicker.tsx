'use client';
import React, { useState, useMemo } from 'react';
import { Upload } from '@/components/icons';

interface SceneImgPickerProps {
  defaultCanvas: HTMLCanvasElement | HTMLImageElement | null;
  onTrigger: (imgEl: HTMLCanvasElement | HTMLImageElement | null, isCustom?: boolean) => void;
  onCancel: () => void;
}

export function SceneImgPicker({ defaultCanvas, onTrigger, onCancel }: SceneImgPickerProps) {
  const [custom, setCustom] = useState<{ url: string; imgEl: HTMLImageElement } | null>(null);
  const defaultUrl = useMemo(() => {
    if (!defaultCanvas) return null;
    try { return (defaultCanvas as HTMLCanvasElement).toDataURL?.() || (defaultCanvas as HTMLImageElement).src || null; } catch { return null; }
  }, [defaultCanvas]);
  const previewUrl = custom?.url || defaultUrl;
  const imgEl: HTMLCanvasElement | HTMLImageElement | null = custom?.imgEl || defaultCanvas;

  const handleFile = (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setCustom({ url, imgEl: img });
    img.src = url;
    if (file.type === 'image/gif') {
      const reader = new FileReader();
      reader.onload = ev => { (img as HTMLImageElement & { _rawDataUrl?: string })._rawDataUrl = ev.target?.result as string; };
      reader.readAsDataURL(file);
    }
  };

  return (
    <>
      <label
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', border: '1px dashed rgba(168,85,247,.4)', borderRadius: 6, cursor: 'pointer', background: 'rgba(168,85,247,.06)' }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        {previewUrl
          ? <img src={previewUrl} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} alt="portrait" />
          : <Upload size={14} color="rgba(168,85,247,.7)" />}
        <span style={{ color: 'rgba(168,85,247,.85)', fontSize: 11, lineHeight: 1.3 }}>
          {custom ? 'Canviar imatge' : defaultCanvas ? 'Imatge del token (clic per canviar)' : 'Importar imatge'}
        </span>
      </label>
      <button
        onMouseDown={e => { e.stopPropagation(); onTrigger(imgEl, !!custom); }}
        style={{ width: '100%', padding: '8px', background: 'rgba(168,85,247,.18)', border: '1px solid rgba(168,85,247,.55)', borderRadius: 6, color: '#c084fc', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
        ⚡ Llançar cinematica
      </button>
    </>
  );
}
