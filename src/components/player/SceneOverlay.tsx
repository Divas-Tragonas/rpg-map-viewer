'use client';
import React, { useEffect, useRef, useState } from 'react';
import { RevealEngine } from '@/lib/textreveal';
import { wake } from '@/lib/render/wake';
import { SceneStage } from '@/components/scene/SceneStage';
import {
  DEFAULT_SCENE_OPTS, IDENTITY_VIEW, SentenceWindow, viewTransform,
  type SceneShow, type SceneSync, type SceneView,
} from '@/lib/scene';

/** El que PlayerView crida en rebre missatges (veure `lib/scene`). */
export interface SceneController {
  /** Camp `scene` del STATE: escena nova, canvis de l'actual o `null` (amagar). */
  apply(scene: SceneShow | null): void;
  /** Camp `sceneSync` del STATE (~30 fps): front del text i enquadrament. */
  sync(s: SceneSync): void;
  /** Imatge o vídeo de l'escena (pel BroadcastChannel o pel WS). */
  media(buffer: ArrayBuffer, mimeType: string, id: string): void;
  /** L'escena tapa del tot el mapa (opaca i ja sense fos): el mapa no cal pintar-lo. */
  covering(): boolean;
}

const FADE_SWAP_MS = 350;
/** Sense llista de diapositives (DM antic), quantes imatges es guarden. */
const KEEP_MEDIA = 3;

/**
 * Escena a la pantalla del jugador: imatge o vídeo de fons i el text en subtítols (o a
 * pantalla completa si no hi ha imatge). Capa `zIndex 52` (per sota dels diàlegs, 56) amb
 * fos d'entrada i sortida (1,4 s / 0,3 s). Té el seu propi bucle: segueix el `pos` que envia
 * el DM amb el rellotge d'aquesta pantalla (l'esvaïment continua suau durant les pauses).
 */
export function SceneOverlay({ controllerRef }: { controllerRef: React.RefObject<SceneController | null> }) {
  const [shown, setShown] = useState<SceneShow | null>(null);
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  const sceneRef = useRef<SceneShow | null>(null);
  const urlsRef = useRef(new Map<string, string>());
  const engRef = useRef<RevealEngine | null>(null);
  const winRef = useRef(new SentenceWindow());
  const tgtRef = useRef({ pos: 0, cps: 20, fadeMs: 500 });
  const lastSyncRef = useRef<SceneSync | null>(null);
  const viewTgt = useRef<SceneView>({ ...IDENTITY_VIEW });
  const viewCur = useRef<SceneView>({ ...IDENTITY_VIEW });
  const swapRef = useRef(0);
  // En canviar de diapositiva, el primer sync posa l'enquadrament de cop (no el suavitza
  // des de l'enquadrament de la imatge d'abans).
  const snapViewRef = useRef(false);
  const mediaInnerRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const coverRef = useRef(false);

  useEffect(() => {
    const urls = urlsRef.current;
    const eng = () => (engRef.current ??= new RevealEngine());

    const setText = (text: string, pos: number) => {
      const el = textRef.current; if (!el) return;
      eng().setText(text, el);
      winRef.current.invalidate();
      if (boxRef.current) boxRef.current.scrollTop = 0;
      if (pos > 0) eng().snapTo(pos);
    };

    const mediaFor = (s: SceneShow | null) => (s?.media ? urls.get(s.media.id) ?? null : null);

    /** Allibera les imatges que ja no són a l'escena (les diapositives es guarden totes). */
    const prune = (s: SceneShow) => {
      if (!s.slides) return;
      const keep = new Set(s.slides.map(m => m.id));
      if (s.media) keep.add(s.media.id);
      for (const [k, u] of [...urls]) if (!keep.has(k)) { URL.revokeObjectURL(u); urls.delete(k); }
    };

    const ctl: SceneController = {
      covering: () => coverRef.current,
      apply(next) {
        const cur = sceneRef.current;
        if (!next) {
          if (!cur) return;
          sceneRef.current = null;
          swapRef.current++;
          setVisible(false);
          return;
        }
        if (cur && cur.id === next.id) {
          // La mateixa escena: opcions, mèdia o text que el DM ha canviat en directe.
          if (cur.media?.id !== next.media?.id) snapViewRef.current = true;
          sceneRef.current = next;
          prune(next);
          if (eng().chars !== next.text) setText(next.text, tgtRef.current.pos);
          setShown(next);
          setMediaUrl(mediaFor(next));
          return;
        }
        // Escena nova: fos amb l'anterior (si n'hi havia) i començar on va el DM.
        sceneRef.current = next;
        prune(next);
        const token = ++swapRef.current;
        const doShow = () => {
          if (token !== swapRef.current) return;
          const ls = lastSyncRef.current;
          const pos = ls && ls.id === next.id ? ls.pos : 0;
          tgtRef.current = ls && ls.id === next.id ? { pos: ls.pos, cps: ls.cps, fadeMs: ls.fadeMs } : { ...tgtRef.current, pos: 0 };
          if (ls && ls.id === next.id) { viewTgt.current = { ...ls.view }; viewCur.current = { ...ls.view }; }
          else { viewTgt.current = { ...IDENTITY_VIEW }; viewCur.current = { ...IDENTITY_VIEW }; }
          setText(next.text, pos);
          setShown(next);
          setMediaUrl(mediaFor(next));
          setFading(false);
          setVisible(true);
        };
        if (cur) { setFading(true); setTimeout(doShow, FADE_SWAP_MS); }
        else doShow();
      },
      sync(s) {
        lastSyncRef.current = s;
        if (sceneRef.current?.id !== s.id) return;
        tgtRef.current = { pos: s.pos, cps: s.cps, fadeMs: s.fadeMs };
        viewTgt.current = s.view;
        if (snapViewRef.current) { snapViewRef.current = false; viewCur.current = { ...s.view }; }
      },
      media(buffer, mimeType, id) {
        // Arriba pel BroadcastChannel I pel WS a la mateixa màquina: el segon s'ignora.
        if (urls.has(id)) return;
        urls.set(id, URL.createObjectURL(new Blob([buffer], { type: mimeType })));
        // Amb diapositives, es guarden totes les de l'escena (`prune` treu les que sobren).
        // Sense (DM antic), només les últimes, i la de l'escena actual sempre.
        const keep = sceneRef.current?.media?.id;
        if (!sceneRef.current?.slides) {
          for (const k of [...urls.keys()]) {
            if (urls.size <= KEEP_MEDIA) break;
            if (k === id || k === keep) continue;
            URL.revokeObjectURL(urls.get(k)!); urls.delete(k);
          }
        }
        if (sceneRef.current?.media?.id === id) setMediaUrl(urls.get(id)!);
      },
    };
    controllerRef.current = ctl;
    return () => {
      controllerRef.current = null;
      for (const u of urls.values()) URL.revokeObjectURL(u);
      urls.clear();
    };
  }, [controllerRef]);

  // Bucle propi: segueix el front del DM i suavitza l'enquadrament de la imatge.
  useEffect(() => {
    let raf = 0;
    let last = 0;
    // Qualitat adaptativa del desenfocament dels caràcters (el més car del text): en pantalles
    // tàctils comença apagat; si el ritme real cau per sota de ~38 fps s'apaga, i es torna a
    // encendre quan va sobrat. Es mesura només mentre hi ha caràcters esvaint-se.
    let ema = 16, blurChangedAt = 0, lastTf = '';
    const coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
    if (coarse) (engRef.current ??= new RevealEngine()).blur = false;
    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      const sc = sceneRef.current;
      const eng = engRef.current;
      const rawDt = last ? ts - last : 16;
      const dt = Math.min(80, rawDt);
      last = ts;
      if (!sc || !eng) return;
      if (!coarse && eng.passed > eng.solid && rawDt < 100) {
        ema = ema * 0.9 + rawDt * 0.1;
        if (ts - blurChangedAt > 2000) {
          if (eng.blur && ema > 26) { eng.blur = false; blurChangedAt = ts; }
          else if (!eng.blur && ema < 18) { eng.blur = true; blurChangedAt = ts; }
        }
      }
      const t = tgtRef.current;
      eng.tick(dt);
      eng.follow(t.pos, t.cps);
      const hasMedia = !!sc.media;
      const box = boxRef.current;
      eng.render(t.fadeMs, hasMedia ? undefined : box);
      // Amb imatge, subtítols sempre frase a frase.
      if (hasMedia) winRef.current.apply(eng);
      else winRef.current.showAll(eng);
      const inner = mediaInnerRef.current;
      if (hasMedia && inner) {
        const tg = viewTgt.current, cur = viewCur.current;
        const EL = 0.028;
        cur.zoom += (tg.zoom - cur.zoom) * EL;
        cur.panXNorm += (tg.panXNorm - cur.panXNorm) * EL;
        cur.panYNorm += (tg.panYNorm - cur.panYNorm) * EL;
        cur.kbTxPct += (tg.kbTxPct - cur.kbTxPct) * EL;
        cur.kbTyPct += (tg.kbTyPct - cur.kbTyPct) * EL;
        // Només s'escriu si ha canviat (l'enquadrament convergeix i, un cop quiet, no cal tocar el DOM).
        const tf = viewTransform(cur, sizeRef.current.w, sizeRef.current.h);
        if (tf !== lastTf) { inner.style.transform = tf; lastTf = tf; }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // El mapa de sota no cal pintar-lo mentre l'escena el tapa del tot: es marca 1,5 s després que
  // l'escena quedi visible (fos d'entrada acabat) i es desmarca (i es desperta el bucle del
  // mapa) en començar a amagar-se.
  useEffect(() => {
    if (visible && !fading) {
      const t = setTimeout(() => { coverRef.current = true; }, 1500);
      return () => clearTimeout(t);
    }
    if (coverRef.current) { coverRef.current = false; wake(); }
  }, [visible, fading]);

  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 52,
        opacity: (visible && !fading) ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: fading ? 'opacity 0.3s ease-in-out' : 'opacity 1.4s ease-in-out',
      }}
    >
      <SceneStage
        mediaUrl={mediaUrl} mimeType={shown?.media?.mimeType ?? null} hasMedia={!!shown?.media}
        opts={shown?.opts ?? DEFAULT_SCENE_OPTS}
        mediaInnerRef={mediaInnerRef} boxRef={boxRef} textRef={textRef} sizeRef={sizeRef}
      />
    </div>
  );
}
