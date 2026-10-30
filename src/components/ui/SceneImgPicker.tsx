'use client';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Upload, ZapIcon, Eye } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { C, FS, RADIUS } from '@/constants';

interface SceneImgPickerProps {
  defaultCanvas: HTMLCanvasElement | HTMLImageElement | null;
  onTrigger: (imgEl: HTMLCanvasElement | HTMLImageElement | null, isCustom?: boolean) => void;
  onCancel: () => void;
  /** Veure-la només a la pantalla del DM abans de llançar-la. */
  onPreview?: (imgEl: HTMLCanvasElement | HTMLImageElement | null) => void;
}

export function SceneImgPicker({ defaultCanvas, onTrigger, onPreview }: SceneImgPickerProps) {
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
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', border: `1px dashed ${C.magic}66`, borderRadius: RADIUS.md, cursor: 'pointer', background: `${C.magic}0f` }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        {previewUrl
          ? <img src={previewUrl} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: RADIUS.sm, flexShrink: 0 }} alt="portrait" />
          : <Upload size={14} color={`${C.magic}b3`} />}
        <span style={{ color: error ? C.enemy : `${C.magic}d9`, fontSize: FS.sm, lineHeight: 1.3 }}>
          {error || (custom ? 'Canviar imatge' : defaultCanvas ? 'Imatge del token (clic per canviar)' : 'Importar imatge')}
        </span>
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
      {onPreview && (
        <Button variant="secondary" size="md" title="Només a la teva pantalla: els jugadors no la veuen"
          onMouseDown={e => { e.stopPropagation(); onPreview(imgEl); }}>
          <Eye size={13} /> Veure-la
        </Button>
      )}
      <button
        onMouseDown={e => { e.stopPropagation(); onTrigger(imgEl, !!custom); }}
        style={{ flex: 1, padding: '8px', background: `${C.magic}2e`, border: `1px solid ${C.magic}8c`, borderRadius: RADIUS.md, color: C.magicBright, cursor: 'pointer', fontSize: FS.md, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <ZapIcon size={13} /> Llançar la cinemàtica
      </button>
      </div>
    </>
  );
}
