'use client';
import React from 'react';
import { Button } from '@/components/ui/Button';
import { DieIcon, FolderOpen, MapIcon, RotateCcw, TilesIcon } from '@/components/icons';
import { C, FS, FONT_SERIF, APP_VERSION } from '@/constants';
import { agoLabel, type AutosaveMeta } from '@/lib/autosave';

const welcomeLink: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, color: C.dim, fontSize: FS.sm,
  textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer',
};

interface Props {
  pixel: boolean;
  compact: boolean;
  /** Estat de la càrrega dels sprites (l'app Píxel no pot crear mapes de caselles sense ells). */
  spritesStatus: string;
  autosaveMeta: AutosaveMeta | null;
  recovering: boolean;
  onOpenMap: (f: File) => void;
  onOpenSession: (f: File) => void;
  onOpenTmx: (f: File) => void;
  onOpenDemo: () => void;
  onCreateTileMap: () => void;
  onRecover: () => void;
  onDiscardAutosave: () => void;
  onTogglePixel: () => void;
}

/**
 * Pantalla de benvinguda (sense mapa): tres accions grans i una guia de 3 passos. Tot el
 * canvas accepta fitxers (veure `onStageDrop` a `DMView`). `margin: auto` centra quan hi cap
 * i fa scroll quan no (mòbil ajagut).
 */
export function WelcomeScreen(p: Props) {
  const { pixel } = p;
  const bgInputRef = React.useRef<HTMLInputElement>(null);
  const sessionInputRef = React.useRef<HTMLInputElement>(null);
  const tmxInputRef = React.useRef<HTMLInputElement>(null);
  const spritesReady = p.spritesStatus === 'ready';
  const pick = (cb: (f: File) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) cb(f); e.target.value = '';
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 3, overflowY: 'auto', padding: p.compact ? '16px 14px' : 24 }}>
      <div style={{ textAlign: 'center', color: C.dim, maxWidth: 440, width: '100%', margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: C.dim, opacity: 0.5 }}><MapIcon size={34} /></div>
        <div style={{ fontFamily: FONT_SERIF, fontSize: 30, fontWeight: 600, lineHeight: 1.1, color: C.bright }}>{pixel ? 'Comença una partida en píxel' : 'Comença una partida'}</div>
        <div style={{ fontSize: FS.md, marginTop: 6, lineHeight: 1.5 }}>
          Obre el mapa (una imatge o un vídeo) o arrossega&apos;l a qualsevol lloc d&apos;aquesta pantalla.
        </div>
        {/* Guia per a qui arriba de nou: el mateix recorregut que explica el README. */}

        {/* App Píxel: el mapa es pinta a casella (o s'importa de Tiled). */}
        {pixel && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 18 }}>
            <Button variant="primary" size="lg" disabled={!spritesReady} onClick={p.onCreateTileMap} style={{ gap: 8, width: '100%', maxWidth: 348 }}>
              <TilesIcon size={15} /> {spritesReady ? 'Crear un mapa de caselles' : p.spritesStatus === 'error' ? 'No s\'han pogut carregar els sprites' : 'Carregant els sprites…'}
            </Button>
            <button onClick={() => tmxInputRef.current?.click()} disabled={!spritesReady} style={welcomeLink}>Importar un mapa de Tiled (.tmx)</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: pixel ? 12 : 18, flexWrap: 'wrap' }}>
          <Button variant={pixel ? 'secondary' : 'primary'} size="lg" onClick={() => bgInputRef.current?.click()} style={{ gap: 8, flex: '1 1 150px', maxWidth: 170 }}>
            <FolderOpen size={15} /> Obrir mapa
          </Button>
          <Button variant="secondary" size="lg" onClick={p.onOpenDemo} style={{ gap: 8, flex: '1 1 150px', maxWidth: 170 }}>
            <DieIcon size={15} /> Provar la demo
          </Button>
        </div>

        {/* Recuperació del desat automàtic: l'única sortida després d'un F5 accidental. */}
        {p.autosaveMeta && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <Button variant="secondary" size="lg" onClick={p.onRecover} disabled={p.recovering}
              title={`Desada automàticament el ${new Date(p.autosaveMeta.savedAt).toLocaleString('ca-ES')}`}
              style={{ gap: 8, width: '100%', maxWidth: 348 }}>
              {!p.recovering && <RotateCcw size={14} />}
              {p.recovering ? 'Recuperant…' : `Recuperar l'última partida · ${agoLabel(p.autosaveMeta.savedAt)}`}
            </Button>
            <div style={{ fontSize: FS.xs, opacity: 0.8 }}>
              {p.autosaveMeta.mapName || 'Sense nom'}
              {' · '}
              <button onClick={p.onDiscardAutosave}
                style={{ background: 'none', border: 'none', padding: 0, color: C.dim, fontSize: FS.xs, textDecoration: 'underline', cursor: 'pointer' }}>
                descartar
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: FS.sm, display: 'flex', gap: '6px 14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => sessionInputRef.current?.click()} style={welcomeLink}>Carregar una partida (.json)</button>
          <button onClick={p.onTogglePixel} style={welcomeLink}>{pixel ? 'Passar a l\'app Clàssica' : 'Passar a l\'app Píxel'}</button>
        </div>

        <div style={{ fontSize: FS.lg, marginTop: 16, color: '#fff', fontWeight: 700, letterSpacing: '0.06em' }}>{APP_VERSION}</div>
      </div>
      <input ref={bgInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={pick(p.onOpenMap)} />
      <input ref={sessionInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={pick(p.onOpenSession)} />
      <input ref={tmxInputRef} type="file" accept=".tmx" style={{ display: 'none' }} onChange={pick(p.onOpenTmx)} />
    </div>
  );
}
