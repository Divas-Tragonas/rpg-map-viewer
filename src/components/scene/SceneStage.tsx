'use client';
import React, { useEffect, useRef, useState } from 'react';
import { FONT_SERIF } from '@/constants';
import { sceneFontPx, type SceneOpts } from '@/lib/scene';

/** Fons del text a pantalla completa (sense imatge): el mateix del Revelador de text. */
const FULL_BG = 'radial-gradient(130% 90% at 50% 0%, #1a1611 0%, #0a0806 62%)';

const BAND: Record<SceneOpts['place'], React.CSSProperties> = {
  bottom: { left: 0, right: 0, bottom: 0, height: '44%', background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0) 100%)' },
  top: { left: 0, right: 0, top: 0, height: '44%', background: 'linear-gradient(to bottom, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0) 100%)' },
  center: { left: 0, right: 0, top: '28%', height: '44%', background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.62) 28%, rgba(0,0,0,0.62) 72%, rgba(0,0,0,0) 100%)' },
};

/**
 * Escenari de l'Escena: imatge o vídeo de fons + text. És el MATEIX per a la
 * previsualització del DM i per a la pantalla del jugador (així el DM veu el que veuran),
 * i totes les mides són proporcionals a l'escenari.
 *
 * Qui el fa servir porta el moviment: el text el pinta `RevealEngine` dins de `textRef`
 * (sense fills de React: el motor hi escriu els spans) i el transform del mèdia l'escriu
 * el bucle de cada pantalla a `mediaInnerRef`. Els dos elements de text existeixen
 * sempre (amb imatge o sense), així el motor no perd els seus spans en canviar de format.
 */
export function SceneStage({ mediaUrl, mimeType, hasMedia, opts, mediaInnerRef, boxRef, textRef, sizeRef, children }: {
  mediaUrl: string | null;
  mimeType: string | null;
  /** Hi ha mèdia a l'escena (encara que no hagi arribat): format subtítol. */
  hasMedia: boolean;
  opts: SceneOpts;
  mediaInnerRef: React.RefObject<HTMLDivElement | null>;
  boxRef: React.RefObject<HTMLDivElement | null>;
  textRef: React.RefObject<HTMLDivElement | null>;
  /** Mida actual de l'escenari, per als bucles (normalitzar el pan). */
  sizeRef?: React.RefObject<{ w: number; h: number }>;
  children?: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = rootRef.current; if (!el) return;
    const upd = () => {
      const s = { w: el.clientWidth, h: el.clientHeight };
      // Amagat (panell tancat) fa 0×0: es guarda l'última mida bona, perquè el pan que
      // s'envia als jugadors no es perdi mentre el panell no es veu.
      if (!(s.w > 0 && s.h > 0)) return;
      if (sizeRef) sizeRef.current = s;
      setSize(p => (p.w === s.w && p.h === s.h ? p : s));
    };
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sizeRef]);

  const { w, h } = size;
  const video = !!mimeType && mimeType.startsWith('video/');
  const cover = opts.fit === 'cover';
  const fontPx = sceneFontPx(w, opts, hasMedia);
  const mediaStyle: React.CSSProperties = cover
    ? { width: w, height: h, objectFit: 'cover', display: 'block', userSelect: 'none' }
    : { maxWidth: w, maxHeight: h, objectFit: 'contain', display: 'block', userSelect: 'none' };

  // Caixa del text: a pantalla completa, com el Revelador (escenari que llisca); amb
  // imatge, una caixa de subtítols amb alçada màxima.
  const box: React.CSSProperties = hasMedia
    ? {
      position: 'absolute', left: '7%', right: '7%', maxHeight: '36%', overflow: 'hidden', textAlign: 'center',
      ...(opts.place === 'bottom' ? { bottom: '7%' } : opts.place === 'top' ? { top: '7%' } : { top: '50%', transform: 'translateY(-50%)' }),
    }
    : { position: 'absolute', inset: 0, overflowY: 'auto', scrollBehavior: 'smooth', padding: `${Math.round(h * 0.15)}px 9% ${Math.round(h * 0.32)}px` };
  const text: React.CSSProperties = hasMedia
    ? {
      fontFamily: FONT_SERIF, fontSize: fontPx, lineHeight: 1.42, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      color: '#f6efe0', letterSpacing: '0.01em',
      textShadow: '0 2px 4px rgba(0,0,0,0.95), 0 0 16px rgba(0,0,0,0.85)',
    }
    : {
      fontFamily: FONT_SERIF, fontSize: fontPx, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      maxWidth: '24em', margin: '0 auto', letterSpacing: '0.005em', color: '#ece3d0', textShadow: '0 2px 24px rgba(0,0,0,0.6)',
    };

  return (
    <div ref={rootRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: hasMedia ? '#080604' : FULL_BG }}>
      {hasMedia && mediaUrl && !video && !cover && (
        <div style={{ position: 'absolute', inset: -60, backgroundImage: `url(${mediaUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(36px) brightness(0.22) saturate(0.45)', transform: 'scale(1.12)', pointerEvents: 'none' }} />
      )}
      {hasMedia && (
        <div ref={mediaInnerRef} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', transformOrigin: 'center center', pointerEvents: 'none' }}>
          {mediaUrl && !video && <img src={mediaUrl} alt="" draggable={false} style={mediaStyle} />}
          {mediaUrl && video && <video src={mediaUrl} autoPlay loop muted playsInline draggable={false} style={mediaStyle} />}
        </div>
      )}
      {hasMedia && opts.band && <div style={{ position: 'absolute', pointerEvents: 'none', ...BAND[opts.place] }} />}
      <div ref={boxRef} style={box}>
        <div ref={textRef} style={text} />
      </div>
      {children}
    </div>
  );
}
