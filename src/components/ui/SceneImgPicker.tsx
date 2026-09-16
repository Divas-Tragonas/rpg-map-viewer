'use client';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Upload } from '@/components/icons';
import { C } from '@/constants';

interface SceneImgPickerProps {
  defaultCanvas: HTMLCanvasElement | HTMLImageElement | null;
  onTrigger: (imgEl: HTMLCanvasElement | HTMLImageElement | null, isCustom?: boolean) => void;
  onCancel: () => void;
}

export function SceneImgPicker({ defaultCanvas, onTrigger, onCancel }: SceneImgPickerProps) {
  const [custom, setCustom] = useState<{ url: string; imgEl: HTMLImageElement } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // L'URL de la imatge triada abans s'ha de revocar a mà: tria'n tres i queden tres imatges
  // senceres a memòria.
  const customUrlRef = useRef<string | null>(null);
  useEffect(() => () => { if (customUrlRef.current) URL.revokeObjectURL(customUrlRef.current); }, []);
  const defaultUrl = useMemo(() => {
    if (!defaultCanvas) return null;
    try { return (defaultCanvas as HTMLCanvasElement).toDataURL?.() || (defaultCanvas as HTMLImageElement).src || null; } catch { return null; }
  }, [defaultCanvas]);
  const previewUrl = custom?.url || defaultUrl;
  const imgEl: HTMLCanvasElement | HTMLImageElement | null = custom?.imgEl || defaultCanvas;

  const handleFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError(`«${file.name}» no és una imatge.`); return; }
    setError(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (customUrlRef.current) URL.revokeObjectURL(customUrlRef.current);
      customUrlRef.current = url;
      setCustom({ url, imgEl: img });
    };
    // Sense això, una imatge malmesa deixava el quadre igual que abans i semblava que el
    // clic no hagués fet res.
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError(`No s'ha pogut obrir «${file.name}».`);
    };
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
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', border: `1px dashed ${C.magic}66`, borderRadius: 6, cursor: 'pointer', background: `${C.magic}0f` }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        {previewUrl
          ? <img src={previewUrl} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} alt="portrait" />
          : <Upload size={14} color={`${C.magic}b3`} />}
        <span style={{ color: error ? C.enemy : `${C.magic}d9`, fontSize: 11, lineHeight: 1.3 }}>
          {error || (custom ? 'Canviar imatge' : defaultCanvas ? 'Imatge del token (clic per canviar)' : 'Importar imatge')}
        </span>
      </label>
      <button
        onMouseDown={e => { e.stopPropagation(); onTrigger(imgEl, !!custom); }}
        style={{ width: '100%', padding: '8px', background: `${C.magic}2e`, border: `1px solid ${C.magic}8c`, borderRadius: 6, color: C.magicBright, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
        ⚡ Llançar cinematica
      </button>
    </>
  );
}
