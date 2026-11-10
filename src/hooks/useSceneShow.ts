'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RevealEngine, cpsFromSlider, fadeMsFromSlider } from '@/lib/textreveal';
import {
  DEFAULT_SCENE_OPTS, KB_VARIANT_COUNT, SentenceWindow, kbAt, kbPhase, newSceneId, viewTransform,
  type SceneOpts, type SceneShow, type SceneView,
} from '@/lib/scene';
import { logJournal } from '@/lib/journal';
import type { SyncSocket } from '@/lib/ws';
import type { CapsuleScene } from '@/lib/capsules';

export interface SceneMedia { id: string; url: string; mimeType: string; file: File; buffer: ArrayBuffer | null }

/**
 * Pestanya «Escena» del panell «Mostrar als jugadors»: imatge o vídeo de fons + text en
 * subtítols (veure `lib/scene`). Viu a `DMView` (l'estat i el bucle duren encara que el
 * panell es tanqui) i el panell (`ScenePanel`) només en pinta els controls.
 *
 * Com el Revelador, el DM és la font de veritat del text: integra el front `pos` i
 * l'envia (~30 fps) dins del `STATE` (`sceneSync`), amb l'enquadrament de la imatge.
 */
export function useSceneShow(io: {
  bcRef: React.RefObject<BroadcastChannel | null>;
  wsRef: React.RefObject<SyncSocket | null>;
  /** Acaba el diàleg en curs (mostrar l'escena el substitueix). */
  hideOthers: () => void;
}) {
  const { bcRef, wsRef } = io;
  const hideOthersRef = useRef(io.hideOthers);
  useEffect(() => { hideOthersRef.current = io.hideOthers; });

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(false);
  const [text, setText] = useState('');
  const [opts, setOptsState] = useState<SceneOpts>(DEFAULT_SCENE_OPTS);
  // Diapositives: totes les imatges o vídeos carregats, en ordre, i quina es veu ara.
  const [slides, setSlidesState] = useState<SceneMedia[]>([]);
  const [cur, setCurState] = useState(0);
  // Després de l'última diapositiva, tornar a la primera (només el DM: no viatja).
  const [loop, setLoopState] = useState(false);
  const loopRef = useRef(false);
  const setLoop = useCallback((v: boolean) => { loopRef.current = v; setLoopState(v); }, []);
  const media = slides[cur] ?? null;
  const [dramatic, setDramaticState] = useState(true);
  const [manual, setManualState] = useState(false);
  const [speed, setSpeedState] = useState(50);
  const [smooth, setSmoothState] = useState(55);

  // Miralls per al bucle (no es torna a crear a cada canvi).
  const activeRef = useRef(false);
  const optsRef = useRef(opts);
  const mediaRef = useRef<SceneMedia | null>(null);      // la d'ara (slides[cur])
  const slidesRef = useRef<SceneMedia[]>([]);
  const curRef = useRef(0);
  /** Mèdia ja enviat als jugadors des de l'últim «Mostrar» / reenviament. */
  const sentRef = useRef(new Set<string>());
  const textValRef = useRef('');
  const dramaticRef = useRef(true);
  const manualRef = useRef(false);
  const speedRef = useRef(50);
  const smoothRef = useRef(55);
  const idRef = useRef(newSceneId());

  // Motor de text i elements de l'escenari de la previsualització.
  const engRef = useRef<RevealEngine | null>(null);
  const winRef = useRef(new SentenceWindow());
  const mediaInnerRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const runningRef = useRef(false);
  const pausedRef = useRef(true);
  // Estat (frase/percentatge, barra, botó) escrit pel bucle, sense renders.
  const counterRef = useRef<HTMLSpanElement | null>(null);
  const progRef = useRef<HTMLDivElement | null>(null);
  const playBtnRef = useRef<HTMLButtonElement | null>(null);

  // Enquadrament: zoom/pan del DM + Ken Burns.
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const kbRef = useRef({ variant: 0, start: 0, phase: 0, paused: false });

  const cps = () => cpsFromSlider(speedRef.current);
  const fadeMs = () => fadeMsFromSlider(smoothRef.current);

  // ── Enviament ────────────────────────────────────────────────────────────────
  const post = useCallback((msg: Record<string, unknown>) => {
    bcRef.current?.postMessage(msg);
    wsRef.current?.send(JSON.stringify(msg));
  }, [bcRef, wsRef]);

  const buildScene = useCallback((): SceneShow => {
    const m = mediaRef.current;
    const ref = (x: SceneMedia) => ({ id: x.id, mimeType: x.mimeType });
    return {
      id: idRef.current, text: textValRef.current, media: m ? ref(m) : null,
      slides: slidesRef.current.map(ref), opts: optsRef.current,
    };
  }, []);

  const sendScene = useCallback(() => {
    // Dins del STATE (el servidor el reenvia opac; un tipus nou no el deixaria passar).
    post({ type: 'STATE', scene: activeRef.current ? buildScene() : null });
  }, [post, buildScene]);

  /** Envia una imatge als jugadors (si encara no l'han rebuda des de l'últim «Mostrar»). */
  const sendOne = useCallback(async (m: SceneMedia) => {
    if (sentRef.current.has(m.id)) return;
    sentRef.current.add(m.id);
    if (!m.buffer) m.buffer = await m.file.arrayBuffer();
    if (!activeRef.current || !slidesRef.current.includes(m)) { sentRef.current.delete(m.id); return; }
    bcRef.current?.postMessage({ type: 'SCENE_MEDIA', id: m.id, buffer: m.buffer, mimeType: m.mimeType });
    // Pel WS, com l'Expositor: capçalera + frame binari (`target` el distingeix).
    wsRef.current?.send(JSON.stringify({ type: 'EXPOSITOR_SHOW_META', mimeType: m.mimeType, target: 'scene', id: m.id }));
    wsRef.current?.sendBinary(m.buffer);
  }, [bcRef, wsRef]);

  /** Totes les diapositives: primer la d'ara, després les següents i les d'abans. */
  const sendAllMedia = useCallback(async () => {
    const list = slidesRef.current, c = curRef.current;
    const order = [...list.slice(c), ...list.slice(0, c)];
    for (const m of order) await sendOne(m);
  }, [sendOne]);

  // ── Text ─────────────────────────────────────────────────────────────────────
  const updateStatus = useCallback(() => {
    const eng = engRef.current;
    const n = eng?.n ?? 0;
    if (progRef.current) progRef.current.style.width = (n ? (eng!.pos / n * 100) : 0) + '%';
    if (counterRef.current) {
      counterRef.current.textContent = !n ? '—'
        : manualRef.current ? `Frase ${eng!.sentenceIndex()} / ${eng!.bounds.length}`
          : `${Math.round(eng!.pos / n * 100)}% revelat`;
    }
    if (playBtnRef.current) {
      playBtnRef.current.textContent = manualRef.current ? 'Revela frase'
        : (runningRef.current && !pausedRef.current ? 'Pausa'
          : (eng && eng.pos > 0 && eng.pos < eng.n ? 'Continua' : 'Comença'));
    }
  }, []);

  /** Torna a construir els spans del text (conserva fins on s'havia revelat). */
  const rebuild = useCallback(() => {
    const el = textRef.current; if (!el) return;
    const eng = (engRef.current ??= new RevealEngine());
    const keep = eng.pos;
    eng.setText(textValRef.current, el);
    winRef.current.invalidate();
    if (keep > 0 && eng.n) eng.snapTo(Math.min(keep, eng.n));
    updateStatus();
  }, [updateStatus]);

  // Construir en muntar-se l'escenari i a cada canvi del text. Si s'està mostrant,
  // el text nou arriba als jugadors (amb una mica de retard: no a cada tecla).
  useEffect(() => {
    textValRef.current = text;
    rebuild();
    if (!activeRef.current) return;
    const t = setTimeout(sendScene, 300);
    return () => clearTimeout(t);
  }, [text, rebuild, sendScene]);

  const play = useCallback(() => {
    const eng = engRef.current; if (!eng || !eng.n) return;
    if (eng.pos >= eng.n) eng.reset();
    pausedRef.current = false; runningRef.current = true;
    updateStatus();
  }, [updateStatus]);
  const pause = useCallback(() => { pausedRef.current = true; updateStatus(); }, [updateStatus]);
  const nextSentence = useCallback(() => {
    const eng = engRef.current; if (!eng || !eng.n) return;
    const nb = eng.nextBoundary(Math.max(eng.pos, eng.target));
    if (nb < 0) return;
    eng.target = nb; pausedRef.current = false; runningRef.current = true;
    updateStatus();
  }, [updateStatus]);
  const prevSentence = useCallback(() => {
    const eng = engRef.current; if (!eng || !eng.n) return;
    eng.snapTo(eng.prevBoundary(Math.round(eng.pos)));
    updateStatus();
  }, [updateStatus]);
  const reset = useCallback(() => {
    const eng = engRef.current; if (!eng) return;
    eng.reset(); pausedRef.current = true; runningRef.current = false;
    if (boxRef.current) boxRef.current.scrollTop = 0;
    updateStatus();
  }, [updateStatus]);
  /** Botó principal / Espai: revela frase (manual) o comença/pausa. */
  const primary = useCallback(() => {
    if (manualRef.current) nextSentence();
    else if (pausedRef.current) play();
    else pause();
  }, [nextSentence, play, pause]);

  const setDramatic = useCallback((v: boolean) => { dramaticRef.current = v; setDramaticState(v); }, []);
  const setManual = useCallback((v: boolean) => {
    manualRef.current = v; setManualState(v);
    const eng = engRef.current; if (eng) eng.target = eng.pos;
    runningRef.current = v; pausedRef.current = !v;
    updateStatus();
  }, [updateStatus]);
  const setSpeed = useCallback((v: number) => { speedRef.current = v; setSpeedState(v); }, []);
  const setSmooth = useCallback((v: number) => {
    smoothRef.current = v; setSmoothState(v);
    if (!runningRef.current || pausedRef.current) engRef.current?.recompute();
  }, []);

  // ── Opcions i mèdia ─────────────────────────────────────────────────────────
  const setOpts = useCallback((patch: Partial<SceneOpts>) => {
    setOptsState(prev => {
      const next = { ...prev, ...patch };
      optsRef.current = next;
      return next;
    });
  }, []);
  // Les opcions i el mèdia arriben als jugadors en directe si s'està mostrant.
  useEffect(() => { if (activeRef.current) sendScene(); }, [opts, media, slides, sendScene]);

  const restartMotion = useCallback(() => {
    zoomRef.current = 1; panRef.current = { x: 0, y: 0 };
    kbRef.current = { ...kbRef.current, start: performance.now(), phase: 0 };
  }, []);

  /** Desa la llista i quina es veu (refs per al bucle + estat per a la UI). */
  const commitSlides = useCallback((list: SceneMedia[], idx: number) => {
    const c = list.length ? Math.max(0, Math.min(list.length - 1, idx)) : 0;
    const changed = list[c] !== mediaRef.current;
    slidesRef.current = list; curRef.current = c; mediaRef.current = list[c] ?? null;
    setSlidesState(list); setCurState(c);
    if (changed) {
      // Imatge nova: moviment nou i sense el zoom/pan de l'anterior.
      kbRef.current = { variant: Math.floor(Math.random() * KB_VARIANT_COUNT), start: performance.now(), phase: 0, paused: false };
      zoomRef.current = 1; panRef.current = { x: 0, y: 0 };
    }
  }, []);

  /** Afegeix imatges o vídeos al final. Si no n'hi havia cap, es veu la primera. */
  const addFiles = useCallback((files: File[] | FileList) => {
    const ok = [...files].filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (!ok.length) return;
    const added = ok.map(file => ({ id: newSceneId(), url: URL.createObjectURL(file), mimeType: file.type, file, buffer: null }));
    commitSlides([...slidesRef.current, ...added], slidesRef.current.length ? curRef.current : 0);
    if (activeRef.current) void (async () => { for (const m of added) await sendOne(m); })();
  }, [commitSlides, sendOne]);

  const goTo = useCallback((i: number) => {
    const list = slidesRef.current;
    if (i < 0 || i >= list.length || i === curRef.current) return;
    commitSlides(list, i);
    if (activeRef.current) void sendOne(list[i]);
  }, [commitSlides, sendOne]);
  const nextSlide = useCallback(() => {
    const c = curRef.current, n = slidesRef.current.length;
    if (c < n - 1) goTo(c + 1);
    else if (loopRef.current && n > 1) goTo(0);
  }, [goTo]);
  const prevSlide = useCallback(() => goTo(curRef.current - 1), [goTo]);

  const removeSlide = useCallback((i: number) => {
    const list = slidesRef.current; const m = list[i]; if (!m) return;
    const next = list.filter((_, k) => k !== i);
    const c = curRef.current;
    commitSlides(next, i < c ? c - 1 : c);
    URL.revokeObjectURL(m.url);
    sentRef.current.delete(m.id);
  }, [commitSlides]);

  /** Mou una diapositiva de `from` a `to` (la que es veu continua sent la mateixa). */
  const moveSlide = useCallback((from: number, to: number) => {
    const list = [...slidesRef.current];
    if (from === to || !list[from] || to < 0 || to >= list.length) return;
    const showing = mediaRef.current;
    const [m] = list.splice(from, 1);
    list.splice(to, 0, m);
    commitSlides(list, showing ? list.indexOf(showing) : 0);
  }, [commitSlides]);

  const clearSlides = useCallback(() => {
    for (const m of slidesRef.current) URL.revokeObjectURL(m.url);
    sentRef.current.clear();
    commitSlides([], 0);
  }, [commitSlides]);
  useEffect(() => () => { for (const m of slidesRef.current) URL.revokeObjectURL(m.url); }, []);

  const panBy = useCallback((dx: number, dy: number) => {
    panRef.current = { x: panRef.current.x + dx, y: panRef.current.y + dy };
  }, []);
  const zoomBy = useCallback((f: number) => {
    zoomRef.current = Math.max(0.3, Math.min(6, zoomRef.current * f));
  }, []);

  // ── Mostrar / amagar ─────────────────────────────────────────────────────────
  const show = useCallback(() => {
    if (!textValRef.current.trim() && !mediaRef.current) return;
    hideOthersRef.current();
    idRef.current = newSceneId();
    activeRef.current = true;
    setActive(true);
    sentRef.current.clear();
    sendScene();
    void sendAllMedia();
    const shown = textValRef.current.replace(/\s+/g, ' ').trim();
    const what = shown ? `«${shown.length > 70 ? `${shown.slice(0, 70).trimEnd()}…` : shown}»` : 'imatge sense text';
    const n = slidesRef.current.length;
    logJournal('text', `Escena als jugadors${n ? ` (${n === 1 ? 'amb imatge' : `${n} imatges`})` : ''}: ${what}`);
  }, [sendAllMedia, sendScene]);

  const hide = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    setActive(false);
    post({ type: 'STATE', scene: null });
  }, [post]);

  /** Una pantalla s'ha (re)connectat: si s'està mostrant, li torna a enviar tot. */
  const resend = useCallback(() => {
    if (!activeRef.current) return;
    sentRef.current.clear();
    sendScene();
    void sendAllMedia();
  }, [sendAllMedia, sendScene]);

  // ── Bucle: avança el text, mou la imatge i envia el sync ─────────────────────
  useEffect(() => {
    if (!open && !active) return;
    let raf = 0;
    let last = 0;
    let lastSync = 0;
    let lastPayload = '';
    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(80, ts - last) : 16;
      last = ts;
      const o = optsRef.current;
      const m = mediaRef.current;
      const eng = engRef.current;
      const c = cps(), f = fadeMs();
      if (eng) {
        eng.tick(dt);
        if (eng.n && runningRef.current && !pausedRef.current) {
          eng.advance(dt, c, dramaticRef.current, manualRef.current);
          const moving = manualRef.current ? (eng.pos < eng.target - 1e-6) : (eng.pos < eng.n || eng.dwell > 0);
          if (!moving && eng.solid >= eng.passed) {
            runningRef.current = false;
            if (!manualRef.current && eng.pos >= eng.n) pausedRef.current = true;
          }
        }
        const box = boxRef.current;
        eng.render(f, m ? undefined : box);
        // Amb imatge, subtítols sempre frase a frase.
        if (m) winRef.current.apply(eng);
        else winRef.current.showAll(eng);
        updateStatus();
      }

      // Enquadrament de la imatge.
      const { w, h } = sizeRef.current;
      const kb = kbRef.current;
      if (m && o.kenBurns && !kb.paused) kb.phase = kbPhase(ts - kb.start);
      const k = m && o.kenBurns ? kbAt(kb.variant, kb.phase) : { scale: 1, tx: 0, ty: 0 };
      const view: SceneView = {
        zoom: zoomRef.current * k.scale,
        panXNorm: w ? panRef.current.x / w : 0, panYNorm: h ? panRef.current.y / h : 0,
        kbTxPct: k.tx, kbTyPct: k.ty,
      };
      if (mediaInnerRef.current) mediaInnerRef.current.style.transform = viewTransform(view, w, h);

      // Sync als jugadors (~30 fps; si no canvia res, un batec cada segon).
      if (activeRef.current && ts - lastSync >= 33) {
        const sceneSync = { id: idRef.current, pos: eng?.pos ?? 0, cps: c, fadeMs: f, view };
        const s = JSON.stringify(sceneSync);
        if (s !== lastPayload || ts - lastSync >= 1000) {
          lastSync = ts; lastPayload = s;
          post({ type: 'STATE', sceneSync });
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, active, post, updateStatus]);

  // ── Càpsules de la Història (`lib/capsules`) ───────────────────────────────
  /** El que hi ha ara a l'Escena, per desar-ho en una càpsula. */
  const snapshot = useCallback((): CapsuleScene => ({
    text: textValRef.current, opts: optsRef.current,
    slides: slidesRef.current.map(m => ({ blob: m.file, mimeType: m.mimeType, name: m.file.name })),
    manual: manualRef.current, speed: speedRef.current, smooth: smoothRef.current, dramatic: dramaticRef.current, loop: loopRef.current,
  }), []);

  /** Substitueix l'Escena pel contingut d'una càpsula (no la mostra: d'això se n'encarrega `show`). */
  const loadPreset = useCallback((p: CapsuleScene) => {
    for (const m of slidesRef.current) URL.revokeObjectURL(m.url);
    sentRef.current.clear();
    const list: SceneMedia[] = p.slides.map(sl => {
      const file = sl.blob instanceof File ? sl.blob : new File([sl.blob], sl.name || 'escena', { type: sl.mimeType });
      return { id: newSceneId(), url: URL.createObjectURL(file), mimeType: sl.mimeType, file, buffer: null };
    });
    commitSlides(list, 0);
    textValRef.current = p.text; setText(p.text);
    optsRef.current = p.opts; setOptsState(p.opts);
    setLoop(p.loop); setDramatic(p.dramatic); setSpeed(p.speed); setSmooth(p.smooth);
    reset(); setManual(p.manual);
  }, [commitSlides, setLoop, setDramatic, setSpeed, setSmooth, setManual, reset]);

  // ── Teclat (només amb la pestanya oberta) ────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) return;
      switch (e.key) {
        case ' ': e.preventDefault(); primary(); break;
        case 'ArrowRight': e.preventDefault(); if (manualRef.current) nextSentence(); else play(); break;
        case 'ArrowLeft': e.preventDefault(); if (manualRef.current) prevSentence(); else reset(); break;
        case 'r': case 'R': reset(); break;
        case 'ArrowDown': case 'PageDown': e.preventDefault(); nextSlide(); break;
        case 'ArrowUp': case 'PageUp': e.preventDefault(); prevSlide(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, primary, nextSentence, play, prevSentence, reset, nextSlide, prevSlide]);

  return {
    open, setOpen, active, activeRef, show, hide, resend,
    text, setText, opts, setOpts, media, slides, cur, loop, setLoop, addFiles, goTo, nextSlide, prevSlide, removeSlide, moveSlide, clearSlides,
    restartMotion, panBy, zoomBy,
    dramatic, setDramatic, manual, setManual, speed, setSpeed, smooth, setSmooth,
    primary, reset, nextSentence, snapshot, loadPreset,
    refs: { mediaInnerRef, boxRef, textRef, sizeRef, counterRef, progRef, playBtnRef },
  };
}

export type SceneShowApi = ReturnType<typeof useSceneShow>;
