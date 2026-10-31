'use client';
import React, { useEffect, useRef } from 'react';
import { FONT_SERIF } from '@/constants';
import { PF_LINE, pfDraw, pfMeasure } from '@/lib/sprites/font';
import { sheet } from '@/lib/sprites/pack';

/** Durada del fos a negre (tancar) i de l'obertura. El DM espera `CURTAIN_CLOSE_MS` abans de canviar el mapa. */
export const CURTAIN_CLOSE_MS = 650;
const OPEN_MS = 900;

interface Props {
  closed: boolean;
  title: string;
  /** App Píxel: el nom del lloc amb la lletra del paquet (si el full ja és a punt). */
  pixel: boolean;
  zIndex?: number;
}

/**
 * Cortina del canvi d'escena (entrar o sortir d'un lloc d'una missió): fos a negre amb el nom
 * del lloc al mig. Només s'anima l'opacitat. La comparteixen el DM i les pantalles de jugador.
 */
export function SceneCurtain({ closed, title, pixel, zIndex = 60 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const usePixel = pixel && !!sheet('interface');
  useEffect(() => {
    const cv = ref.current; if (!cv || !usePixel || !title) return;
    const text = title.toUpperCase();
    const w = pfMeasure(text) + 2, h = PF_LINE + 1;
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    pfDraw(ctx, text, 1, 1, '#2a2418');          // ombra d'un píxel
    pfDraw(ctx, text, 0, 0, '#e8dfc6');
    // Escala entera: el nom fa ~1/18 de l'alçada de la pantalla.
    const k = Math.max(2, Math.round(window.innerHeight / 18 / PF_LINE));
    cv.style.width = `${w * k}px`; cv.style.height = `${h * k}px`;
  }, [usePixel, title]);
  return (
    <div aria-hidden={!closed} style={{
      position: 'absolute', inset: 0, zIndex, background: '#000', pointerEvents: closed ? 'auto' : 'none',
      opacity: closed ? 1 : 0, transition: `opacity ${closed ? CURTAIN_CLOSE_MS : OPEN_MS}ms ${closed ? 'ease-in' : 'ease-out'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {title && (
        <div style={{ opacity: closed ? 1 : 0, transition: `opacity ${closed ? 500 : 300}ms ease ${closed ? 350 : 0}ms` }}>
          {usePixel
            ? <canvas ref={ref} style={{ imageRendering: 'pixelated', display: 'block' }} />
            : <div style={{ fontFamily: FONT_SERIF, color: '#e8dfc6', fontSize: 'clamp(1.6rem, 4vw, 3.2rem)', letterSpacing: '0.04em' }}>{title}</div>}
        </div>
      )}
    </div>
  );
}
