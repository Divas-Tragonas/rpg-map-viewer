'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useStoredString } from '@/hooks/useStoredFlag';
import { type MoveResult, type TrackerWorld, useTrackerSync } from '@/hooks/useTrackerSync';
import { boardCam } from '@/lib/board';
import type { CamRect, Point } from '@/types';
import { C, FS, RADIUS, FONT_SERIF } from '@/constants';
import { Button } from '@/components/ui/Button';
import {
  type BlobState, type ColorSlot, DEFAULT_SLOTS, StillTracker,
  detect, hsvToHex, looksLikeSkin, sampleHsv, slotFromSample,
} from '@/lib/tracker/detect';
import {
  CORNER_NAMES, SCREEN_CORNERS, type Homography, applyH, gridInfo, homography, mapToScreen,
  samePlace, screenToMap, tokenPosFor,
} from '@/lib/tracker/geometry';

/**
 * `/tracker` — figuretes físiques amb càmera.
 *
 * Obre una càmera, troba les bases de color i diu si cada figureta és quieta, es mou o
 * s'ha perdut (fase 0). Amb el tauler calibrat (les 4 cantonades del monitor clicades al
 * vídeo) i cada color assignat a un jugador, quan una figureta queda quieta en una altra
 * casella mou el seu token amb `TOKEN_MOVE`, com el drag de la pantalla de jugador (fase 1).
 * Veure «Figuretes físiques amb càmera» a `docs/tokens-i-combat.md`.
 */

const STORE_KEY = 'rpg_tracker_v1';
type ViewMode = 'camera' | 'mix' | 'mask';

interface Settings {
  slots: ColorSlot[];
  procW: number;
  minArea: number;
  view: ViewMode;
  deviceId: string;
  res: 720 | 1080;
  /** Cantonades de la imatge del monitor al vídeo (normalitzades 0..1), en l'ordre de `CORNER_NAMES`. */
  corners: Point[] | null;
  /** Mida (px CSS) de la pantalla de jugador del tauler, triada de les que envien `VIEWPORT`. 0 = cap. */
  screenW: number;
  screenH: number;
}

const DEFAULTS: Settings = {
  slots: DEFAULT_SLOTS, procW: 480, minArea: 40, view: 'camera', deviceId: '', res: 1080,
  corners: null, screenW: 0, screenH: 0,
};

function parseSettings(raw: string): Settings {
  try {
    if (!raw) return DEFAULTS;
    const s = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...s, slots: Array.isArray(s.slots) && s.slots.length ? s.slots : DEFAULTS.slots };
  } catch { return DEFAULTS; }
}

interface Status { state: BlobState; area: number; extra: number; cx: number; cy: number }
interface SlotMsg { text: string; color: string }

/**
 * Mida de la pantalla del tauler: la triada a mà; si no, la oberta amb `?tauler=1`; si no, la
 * única que hi hagi.
 */
function tableScreen(s: Settings, screens: { w: number; h: number; tauler: boolean }[]): { W: number; H: number } | null {
  if (s.screenW > 0 && s.screenH > 0) return { W: s.screenW, H: s.screenH };
  const t = screens.find(x => x.tauler) ?? (screens.length === 1 ? screens[0] : null);
  return t ? { W: t.w, H: t.h } : null;
}

/** Enquadrament que mostra la pantalla del tauler: el del mode tauler si està encès, si no el del DM. */
function tableCam(w: TrackerWorld, scr: { W: number; H: number } | null): CamRect | null {
  return (scr ? boardCam(w.board, scr.W, scr.H, w.gridSize) : null) ?? w.cam;
}

/** L'enquadrament del DM ha canviat (pan o zoom) des de l'última sincronització? */
function camMovedSince(a: CamRect | null, b: CamRect | null): boolean {
  if (!a || !b) return false;
  const tol = 0.005 * Math.max(a.w, 1);
  return Math.abs(a.cx - b.cx) > tol || Math.abs(a.cy - b.cy) > tol || Math.abs(a.w - b.w) > tol || Math.abs(a.h - b.h) > tol;
}

const noSubscribe = () => () => {};

/**
 * Rellotge del bucle de detecció. **No és `requestAnimationFrame`**: el navegador l'atura quan la
 * finestra del tracker queda darrere de la del DM o minimitzada, i a la partida és on serà. Els
 * temporitzadors normals d'una pestanya de fons també s'alenteixen (1 per segon o menys); els d'un
 * *web worker*, no. El worker només fa tic-tac i el bucle corre al fil principal.
 */
function startTicker(fn: () => void, fps: number): () => void {
  try {
    const src = `setInterval(() => postMessage(0), ${Math.round(1000 / fps)});`;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const w = new Worker(url);
    w.onmessage = () => fn();
    return () => { w.terminate(); URL.revokeObjectURL(url); };
  } catch {
    const iv = setInterval(fn, Math.round(1000 / fps));
    return () => clearInterval(iv);
  }
}

const STATE_LABEL: Record<BlobState, string> = { quieta: 'quieta', movent: 'es mou', perduda: 'no es veu' };
const STATE_COLOR: Record<BlobState, string> = { quieta: C.ok, movent: C.warn, perduda: C.dim };

export function TrackerView() {
  // Desat al navegador amb `useStoredString` (lectura al client, sense error d'hidratació).
  const [stored, setStored] = useStoredString(STORE_KEY, '');
  const settings = useMemo(() => parseSettings(stored), [stored]);
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  const setSettings = useCallback((fn: (p: Settings) => Settings) => {
    const next = fn(settingsRef.current);
    settingsRef.current = next;
    setStored(JSON.stringify(next));
  }, [setStored]);
  // La càmera només s'obre en una pàgina segura (https o localhost).
  const secure = useSyncExternalStore(noSubscribe, () => window.isSecureContext, () => true);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(0);
  const [status, setStatus] = useState<Status[]>([]);
  const [perf, setPerf] = useState({ fps: 0, ms: 0, vw: 0, vh: 0, pw: 0, ph: 0 });
  const [expo, setExpo] = useState<'cap' | 'auto' | 'fix'>('cap');

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const procRef = useRef<HTMLCanvasElement | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<ImageData | null>(null);
  const trackerRef = useRef(new StillTracker());
  /** Rellotge del bucle (`startTicker`): s'atura amb `stopTickRef.current()`. */
  const stopTickRef = useRef<() => void>(() => {});

  // ── Tauler i connexió amb el DM (fase 1) ──────────────────────────────────
  /** Índex de la cantonada que s'espera en calibrar (`null` = no s'està calibrant). */
  const [calibrating, setCalibratingState] = useState<number | null>(null);
  const calibratingRef = useRef<number | null>(null);
  const setCalibrating = useCallback((v: number | null) => { calibratingRef.current = v; setCalibratingState(v); }, []);
  /** Última detecció (per a «Posar els tokens on són les figuretes»). */
  const lastRef = useRef<{ best: (import('@/lib/tracker/detect').Blob | null)[]; states: BlobState[] } | null>(null);
  const [draftCorners, setDraftCorners] = useState<Point[]>([]);
  const draftRef = useRef<Point[]>([]);
  // Enviar moviments: no es desa (cada sessió comença apagat, per no moure res per sorpresa).
  const [sendOn, setSendOn] = useState(false);
  const sendOnRef = useRef(false);
  const [slotMsg, setSlotMsg] = useState<Record<number, SlotMsg>>({});
  const [camMoved, setCamMoved] = useState(false);
  const [boardOn, setBoardOn] = useState(false);
  /** On era cada figureta (càmera, 0..1) l'últim cop que es va donar per bona. `null` = encara no se sap. */
  const settledRef = useRef<(Point | null)[]>([]);
  /** Enquadrament del DM quan figuretes i tokens coincidien (per avisar si el DM fa pan o zoom). */
  const camAtSyncRef = useRef<CamRect | null>(null);

  const flashSlot = useCallback((i: number, msg: SlotMsg) => {
    setSlotMsg(p => ({ ...p, [i]: msg }));
    setTimeout(() => setSlotMsg(p => {
      if (p[i] !== msg) return p;
      const rest = { ...p };
      delete rest[i];
      return rest;
    }), 6000);
  }, []);

  const onResult = useCallback((id: string, result: MoveResult) => {
    const i = settingsRef.current.slots.findIndex(sl => sl.playerId != null && `pl_${sl.playerId}` === id);
    if (i < 0) return;
    flashSlot(i, result === 'ok' ? { text: 'token mogut', color: C.ok }
      : result === 'rebutjat' ? { text: 'el DM no ho permet: torna la figureta on era', color: C.enemy }
      : { text: 'el DM no respon', color: C.warn });
  }, [flashSlot]);

  const { world, connected, players, screens, available, moveToken, hideTokens, isPending } = useTrackerSync(onResult);
  /** Figuretes vistes almenys un cop des que es va engegar «Moure tokens» (una que no hi és mai no amaga res). */
  const seenRef = useRef<boolean[]>([]);
  const hideSentRef = useRef({ key: '', t: 0 });
  const screensRef = useRef(screens);
  useEffect(() => { screensRef.current = screens; }, [screens]);

  /** Homografia càmera → pantalla (i la inversa, per pintar el tauler sobre el vídeo). */
  const hom = useMemo(() => {
    const c = settings.corners;
    if (!c || c.length !== 4) return null;
    const fwd = homography(c, SCREEN_CORNERS), inv = homography(SCREEN_CORNERS, c);
    return fwd && inv ? { fwd, inv } : null;
  }, [settings.corners]);
  const homRef = useRef<{ fwd: Homography; inv: Homography } | null>(null);
  useEffect(() => { homRef.current = hom; }, [hom]);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const all = await navigator.mediaDevices.enumerateDevices();
    setDevices(all.filter(d => d.kind === 'videoinput'));
  }, []);

  const stop = useCallback(() => {
    stopTickRef.current();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
    // Sense càmera no es veu cap figureta: la pantalla de figures torna a ensenyar tots els tokens.
    hideTokens([]);
    hideSentRef.current = { key: '', t: 0 };
  }, [hideTokens]);

  useEffect(() => stop, [stop]);

  const loop = useCallback(() => {
    const video = videoRef.current, overlay = overlayRef.current;
    let frames = 0, acc = 0, t0 = performance.now(), lastUi = 0;
    const step = () => {
      if (!video || !overlay || video.readyState < 2 || !video.videoWidth) return;
      const s = settingsRef.current;
      const vw = video.videoWidth, vh = video.videoHeight;
      const pw = Math.min(s.procW, vw), ph = Math.round((pw * vh) / vw);
      const proc = (procRef.current ??= document.createElement('canvas'));
      if (proc.width !== pw || proc.height !== ph) { proc.width = pw; proc.height = ph; }
      const pctx = proc.getContext('2d', { willReadFrequently: true });
      if (!pctx) return;

      const tStart = performance.now();
      pctx.drawImage(video, 0, 0, pw, ph);
      const img = pctx.getImageData(0, 0, pw, ph);
      frameRef.current = img;
      const res = detect(img.data, pw, ph, s.slots, s.minArea);
      const states = trackerRef.current.update(res.best, tStart);
      lastRef.current = { best: res.best, states };
      const ms = performance.now() - tStart;

      // ── Càmera → mapa i enviament de moviments ──
      const w = world.current;
      const hm = homRef.current;
      const scr = tableScreen(s, screensRef.current);
      const cam = tableCam(w, scr);
      const g = gridInfo(w.gridSize, w.gridOriginX, w.gridOriginY, w.gridSnap);
      const toMap = hm && scr && cam
        ? (p: Point) => { const q = applyH(hm.fwd, p); return { map: screenToMap(q.x, q.y, scr.W, scr.H, cam), inside: q.x >= -0.02 && q.x <= 1.02 && q.y >= -0.02 && q.y <= 1.02 }; }
        : null;
      if (toMap && sendOnRef.current) {
        res.best.forEach((b, i) => {
          const sl = s.slots[i];
          if (!b || !sl?.enabled || sl.playerId == null || states[i] !== 'quieta') return;
          const id = `pl_${sl.playerId}`;
          if (!w.players.some(p => p.id === sl.playerId)) return;
          const cur = { x: b.cx, y: b.cy };
          const now = toMap(cur);
          if (!now.inside) return; // fora del tauler (a la vora de la taula, a la mà…)
          const R = w.tokenSize[id] ?? 22;
          const prev = settledRef.current[i];
          settledRef.current[i] = cur;
          // Primer cop que es veu quieta: només es pren com a referència. Es mou el token quan
          // la figureta canvia de casella respecte d'on era (no quan el DM mou el token a mà).
          if (!prev || samePlace(toMap(prev).map, now.map, g, R)) return;
          const target = tokenPosFor(now.map, R, g);
          // S'envia encara que el token ja hi sigui: si el DM l'havia rebutjat, la figureta que
          // torna al seu lloc li treu l'avís de moviment pendent.
          moveToken(id, target.x, target.y);
        });
      }

      // ── Pantalla de figures: amagar el token d'una figureta que es mou ──
      // Mentre la figureta es mou (o s'aixeca) i fins que el DM contesta, el seu token no es pinta
      // a la pantalla de figures: la càmera no el pot confondre amb la base. En confirmar-se, torna
      // a sortir ja a la casella nova (o a la vella, si el DM no ho permet).
      {
        const hide: string[] = [];
        if (sendOnRef.current) {
          res.best.forEach((b, i) => { if (b) seenRef.current[i] = true; });
          s.slots.forEach((sl, i) => {
            if (!sl.enabled || sl.playerId == null || !seenRef.current[i]) return;
            const id = `pl_${sl.playerId}`;
            if (states[i] !== 'quieta' || isPending(id)) hide.push(id);
          });
        }
        const key = hide.sort().join(',');
        const now = performance.now();
        if (key !== hideSentRef.current.key || (hide.length > 0 && now - hideSentRef.current.t > 1000)) {
          hideTokens(hide);
          hideSentRef.current = { key, t: now };
        }
      }

      // Capa de dibuix a 2× la imatge processada (prou nítida per a les etiquetes).
      const ow = pw * 2, oh = ph * 2;
      if (overlay.width !== ow || overlay.height !== oh) { overlay.width = ow; overlay.height = oh; }
      const octx = overlay.getContext('2d');
      if (!octx) return;
      octx.clearRect(0, 0, ow, oh);
      if (s.view !== 'camera') {
        const mask = (maskRef.current ??= document.createElement('canvas'));
        if (mask.width !== pw || mask.height !== ph) { mask.width = pw; mask.height = ph; }
        const mctx = mask.getContext('2d');
        if (mctx) {
          const out = mctx.createImageData(pw, ph);
          const rgb = s.slots.map(sl => [1, 3, 5].map(i => parseInt(sl.swatch.slice(i, i + 2), 16)));
          for (let p = 0, k = 0; p < res.labels.length; p++, k += 4) {
            const lab = res.labels[p];
            if (lab === 0) { out.data[k + 3] = s.view === 'mask' ? 255 : 0; continue; }
            const c = rgb[lab - 1];
            out.data[k] = c[0]; out.data[k + 1] = c[1]; out.data[k + 2] = c[2]; out.data[k + 3] = 255;
          }
          mctx.putImageData(out, 0, 0);
          octx.imageSmoothingEnabled = false;
          if (s.view === 'mix') { octx.fillStyle = 'rgba(0,0,0,0.55)'; octx.fillRect(0, 0, ow, oh); }
          octx.drawImage(mask, 0, 0, ow, oh);
        }
      }
      drawBoard(octx, ow, oh, {
        corners: calibratingRef.current !== null ? draftRef.current : s.corners,
        closed: calibratingRef.current === null,
        inv: hm?.inv ?? null, scr, cam, g,
        tokens: w.players.filter(p => p.visible !== false).map(p => {
          const id = `pl_${p.id}`, at = w.pos[id], R = w.tokenSize[id] ?? 22;
          return at ? { name: p.name, color: p.color, c: { x: at.x + R, y: at.y + R } } : null;
        }).filter(t => t !== null),
      });
      octx.lineWidth = 3;
      octx.lineJoin = 'round';
      octx.font = `bold ${FS.xl}px sans-serif`;
      res.best.forEach((b, i) => {
        if (!b) return;
        const sl = s.slots[i];
        const st = states[i];
        octx.strokeStyle = sl.swatch;
        octx.setLineDash(st === 'quieta' ? [] : [8, 6]);
        octx.strokeRect(b.minX * 2 - 4, b.minY * 2 - 4, (b.maxX - b.minX) * 2 + 8, (b.maxY - b.minY) * 2 + 8);
        octx.setLineDash([]);
        octx.beginPath(); octx.arc(b.x * 2, b.y * 2, 5, 0, Math.PI * 2);
        octx.fillStyle = '#fff'; octx.fill();
        octx.fillStyle = sl.swatch;
        octx.strokeStyle = '#000'; octx.lineWidth = 4;
        const who = sl.playerId != null ? w.players.find(p => p.id === sl.playerId)?.name : undefined;
        const label = `${who ?? sl.name}${res.extra[i] ? ` +${res.extra[i]}` : ''}`;
        octx.strokeText(label, b.maxX * 2 + 10, b.minY * 2 + FS.xl);
        octx.fillText(label, b.maxX * 2 + 10, b.minY * 2 + FS.xl);
        octx.lineWidth = 3;
      });

      frames++; acc += ms;
      const now = performance.now();
      if (now - lastUi > 200) {
        lastUi = now;
        setStatus(res.best.map((b, i) => ({ state: states[i], area: b?.area ?? 0, extra: res.extra[i], cx: b?.cx ?? 0, cy: b?.cy ?? 0 })));
        if (sendOnRef.current && !camAtSyncRef.current && cam && scr) camAtSyncRef.current = cam;
        setCamMoved(sendOnRef.current && camMovedSince(camAtSyncRef.current, cam));
        setBoardOn(!!w.board?.on);
      }
      if (now - t0 > 1000) {
        setPerf({ fps: Math.round((frames * 1000) / (now - t0)), ms: Math.round((acc / frames) * 10) / 10, vw, vh, pw, ph });
        frames = 0; acc = 0; t0 = now;
      }
    };
    stopTickRef.current();
    stopTickRef.current = startTicker(step, 30);
  }, [world, moveToken, hideTokens, isPending]);

  const start = useCallback(async () => {
    setError('');
    stop();
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Aquest navegador no deixa obrir la càmera aquí. Obre la pàgina per http://localhost:3001/tracker al PC on hi ha la càmera.');
      return;
    }
    const s = settingsRef.current;
    const size = s.res === 1080 ? { width: { ideal: 1920 }, height: { ideal: 1080 } } : { width: { ideal: 1280 }, height: { ideal: 720 } };
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { ...size, ...(s.deviceId ? { deviceId: { exact: s.deviceId } } : {}) },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setRunning(true);
      await refreshDevices();
      const track = stream.getVideoTracks()[0];
      const caps = (track.getCapabilities?.() ?? {}) as Record<string, unknown>;
      const modes = caps.exposureMode as string[] | undefined;
      setExpo(modes?.includes('single-shot') || modes?.includes('manual') ? 'auto' : 'cap');
      const id = track.getSettings().deviceId;
      if (id && id !== s.deviceId) setSettings(p => ({ ...p, deviceId: id }));
      trackerRef.current = new StillTracker();
      loop();
    } catch (e) {
      const name = (e as Error).name;
      setError(
        name === 'NotAllowedError' ? 'Permís de càmera denegat. Torna-l\'hi a donar a la icona de la barra d\'adreces.'
        : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'No es troba aquesta càmera. Tria\'n una altra a la llista.'
        : name === 'NotReadableError' ? 'La càmera la fa servir una altra aplicació.'
        : `No s'ha pogut obrir la càmera (${name}).`,
      );
    }
  }, [stop, loop, refreshDevices, setSettings]);

  /**
   * Exposició i balanç de blancs. Si la càmera ajusta sola, els colors de les bases canvien
   * quan entra una mà o canvia el mapa. `single-shot` = s'ajusta un cop i es queda fixa.
   */
  const setExposure = useCallback(async (fix: boolean) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const caps = (track.getCapabilities?.() ?? {}) as Record<string, string[] | undefined>;
    const pick = (list: string[] | undefined) =>
      !list ? undefined : fix ? (list.includes('single-shot') ? 'single-shot' : list.includes('manual') ? 'manual' : undefined)
        : (list.includes('continuous') ? 'continuous' : undefined);
    const c: Record<string, string> = {};
    const e = pick(caps.exposureMode); if (e) c.exposureMode = e;
    const wb = pick(caps.whiteBalanceMode); if (wb) c.whiteBalanceMode = wb;
    const f = pick(caps.focusMode); if (f) c.focusMode = f;
    try {
      await track.applyConstraints({ advanced: [c as MediaTrackConstraintSet] });
      setExpo(fix ? 'fix' : 'auto');
    } catch {
      setError('La càmera no ha acceptat fixar l\'exposició. Fixa-la des de l\'app de la càmera (Camo, DroidCam…).');
    }
  }, []);

  const onVideoClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const img = frameRef.current;
    if (!img) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (calibratingRef.current !== null) {
      const pt = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      const next = [...draftRef.current, pt];
      draftRef.current = next;
      setDraftCorners(next);
      if (next.length < 4) { setCalibrating(next.length); return; }
      setCalibrating(null);
      if (!homography(next, SCREEN_CORNERS)) {
        setError('Aquestes 4 cantonades no formen un rectangle vàlid (n\'hi ha tres en línia?). Torna a calibrar.');
        return;
      }
      setError('');
      setSettings(p => ({ ...p, corners: next }));
      settledRef.current = [];
      return;
    }
    const x = Math.round(((e.clientX - r.left) / r.width) * img.width);
    const y = Math.round(((e.clientY - r.top) / r.height) * img.height);
    const hsv = sampleHsv(img.data, img.width, img.height, x, y, 2);
    if (hsv[1] < 0.12) {
      setError('Aquest punt gairebé no té color (gris, blanc o negre). Clica just a sobre de la pintura de la base.');
      return;
    }
    setError('');
    const th = slotFromSample(hsv);
    setSettings(p => ({
      ...p,
      slots: p.slots.map((sl, i) => (i === selected ? { ...sl, ...th, enabled: true, swatch: hsvToHex(th.hue, Math.max(0.6, hsv[1]), Math.max(0.7, hsv[2])) } : sl)),
    }));
  }, [selected, setSettings, setCalibrating]);

  const startCalibration = useCallback(() => {
    draftRef.current = [];
    setDraftCorners([]);
    setCalibrating(0);
  }, [setCalibrating]);

  const toggleSend = useCallback((on: boolean) => {
    sendOnRef.current = on;
    setSendOn(on);
    // En engegar, la posició actual de cada figureta és la referència: no es mou res fins
    // que algú en mogui una.
    settledRef.current = [];
    seenRef.current = [];
    // La referència de l'enquadrament es pren al bucle, quan ja se sap la pantalla del tauler.
    camAtSyncRef.current = null;
  }, []);

  /** Mou cada token assignat a on hi ha ara la seva figureta (per començar o després d'un pan del DM). */
  const syncAll = useCallback(() => {
    const s = settingsRef.current, w = world.current, hm = homRef.current, last = lastRef.current;
    const scr = tableScreen(s, screensRef.current);
    const cam = tableCam(w, scr);
    if (!hm || !scr || !cam || !last) return;
    const g = gridInfo(w.gridSize, w.gridOriginX, w.gridOriginY, w.gridSnap);
    let n = 0;
    last.best.forEach((b, i) => {
      const sl = s.slots[i];
      if (!b || last.states[i] !== 'quieta' || !sl?.enabled || sl.playerId == null || !w.players.some(p => p.id === sl.playerId)) return;
      const q = applyH(hm.fwd, { x: b.cx, y: b.cy });
      if (q.x < 0 || q.x > 1 || q.y < 0 || q.y > 1) return;
      const id = `pl_${sl.playerId}`, R = w.tokenSize[id] ?? 22;
      const t = tokenPosFor(screenToMap(q.x, q.y, scr.W, scr.H, cam), R, g);
      settledRef.current[i] = { x: b.cx, y: b.cy };
      const at = w.pos[id];
      if (at && Math.hypot(at.x - t.x, at.y - t.y) < 1) return;
      moveToken(id, t.x, t.y);
      n++;
    });
    camAtSyncRef.current = cam;
    setCamMoved(false);
    setError(n === 0 ? 'Cap token per moure: o ja són al seu lloc, o no hi ha cap figureta assignada dins del tauler.' : '');
  }, [world, moveToken]);

  const patchSlot = (i: number, patch: Partial<ColorSlot>) =>
    setSettings(p => ({
      ...p,
      slots: p.slots.map((sl, j) => {
        if (j !== i) return sl;
        const next = { ...sl, ...patch };
        if (patch.hue !== undefined) next.swatch = hsvToHex(next.hue, 0.8, 0.95);
        return next;
      }),
    }));

  const aspect = perf.vw && perf.vh ? `${perf.vw} / ${perf.vh}` : '16 / 9';

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'flex', fontSize: FS.md, fontFamily: 'system-ui, sans-serif' }}>
      <main style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: FONT_SERIF, fontSize: 24, margin: 0, color: C.bright }}>Figuretes amb càmera</h1>
          <span style={{ color: sendOn ? C.ok : C.dim }}>
            {sendOn ? '● Les figuretes mouen els tokens dels jugadors' : 'Enviament aturat: les figuretes no mouen cap token'}
          </span>
        </header>

        {!secure && (
          <Notice color={C.warn}>
            Aquesta pàgina no és segura (<code>http</code> fora de <code>localhost</code>) i el navegador no hi deixarà obrir la càmera.
            Obre-la al PC on hi ha connectada la càmera: <code>http://localhost:3001/tracker</code>.
          </Notice>
        )}
        {error && <Notice color={C.enemy}>{error}</Notice>}
        {calibrating !== null && (
          <Notice color={C.accent}>
            Calibratge: clica al vídeo la cantonada <b>{calibrating + 1} de 4</b>, la de <b>{CORNER_NAMES[calibrating]}</b> de la
            imatge del monitor (tal com la veu el DM, no com la veu la càmera). Si el polaritzador fa negra la pantalla, gira&apos;l mentre calibres.
          </Notice>
        )}
        {camMoved && (
          <Notice color={C.warn}>
            El mapa del tauler s&apos;ha mogut (el DM ha fet pan o zoom, o ha centrat el tauler en un altre lloc): les figuretes ja
            no són a sobre dels seus tokens. Recol·loqueu-les, o premeu «Posar els tokens on són les figuretes».
            {!boardOn && <> Amb el «Tauler de figuretes» encès (menú Pantalles del DM), el pan i el zoom del DM no mouen el tauler.</>}
          </Notice>
        )}

        <div
          onClick={onVideoClick}
          title={calibrating !== null ? `Clica la cantonada ${calibrating + 1}` : "Clica la base d'una figureta per agafar-ne el color"}
          style={{ position: 'relative', width: '100%', maxHeight: 'calc(100vh - 140px)', aspectRatio: aspect, background: '#000', borderRadius: RADIUS.lg, overflow: 'hidden', cursor: running ? 'crosshair' : 'default', border: `1px solid ${C.border}`, alignSelf: 'center' }}
        >
          <video ref={videoRef} playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', visibility: settings.view === 'mask' ? 'hidden' : 'visible' }} />
          <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          {!running && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: C.dim, textAlign: 'center', padding: 24 }}>
              Tria la càmera a la dreta i prem «Engegar».
            </div>
          )}
        </div>

        <footer style={{ color: C.dim, fontSize: FS.sm, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>{running ? `${perf.fps} fps · ${perf.ms} ms per fotograma` : 'aturada'}</span>
          {running && <span>Càmera {perf.vw}×{perf.vh} · es processa a {perf.pw}×{perf.ph}</span>}
          <span>Clica una base al vídeo per donar el seu color al slot seleccionat. Les línies blanques són la graella del mapa i els cercles discontinus, on són ara els tokens.</span>
        </footer>
      </main>

      <aside style={{ width: 340, flexShrink: 0, background: C.panel, borderLeft: `1px solid ${C.border}`, padding: 14, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', maxHeight: '100vh' }}>
        <Section title="Càmera">
          <select
            value={settings.deviceId}
            onChange={e => setSettings(p => ({ ...p, deviceId: e.target.value }))}
            onFocus={refreshDevices}
            style={inputStyle}
          >
            <option value="">Per defecte</option>
            {devices.map((d, i) => <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Càmera ${i + 1}`}</option>)}
          </select>
          <Row label="Resolució">
            <Seg value={settings.res} options={[[720, '720p'], [1080, '1080p']]} onChange={v => setSettings(p => ({ ...p, res: v }))} />
          </Row>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="primary" onClick={start}>{running ? 'Reiniciar' : 'Engegar'}</Button>
            {running && <Button onClick={stop}>Aturar</Button>}
          </div>
          {running && (
            <Row label="Exposició">
              {expo === 'cap'
                ? <span style={{ color: C.dim, fontSize: FS.sm }}>no es pot fixar des d&apos;aquí</span>
                : <Seg value={expo} options={[['auto', 'Automàtica'], ['fix', 'Fixa']]} onChange={v => setExposure(v === 'fix')} />}
            </Row>
          )}
        </Section>

        <Section title="Tauler">
          <Row label={hom ? 'Calibrat' : 'Sense calibrar'}>
            <div style={{ display: 'flex', gap: 4 }}>
              <Button size="sm" variant={hom ? 'secondary' : 'primary'} disabled={!running} onClick={startCalibration}>
                {calibrating !== null ? `Cantonada ${calibrating + 1}/4…` : hom ? 'Tornar a calibrar' : 'Calibrar'}
              </Button>
              {calibrating !== null && <Button size="sm" variant="ghost" onClick={() => { setCalibrating(null); setDraftCorners([]); draftRef.current = []; }}>Cancel·lar</Button>}
            </div>
          </Row>
          {draftCorners.length > 0 && calibrating !== null && <span style={{ color: C.dim, fontSize: FS.xs }}>{draftCorners.length} de 4 cantonades</span>}
          <span style={{ fontSize: FS.sm }}>Pantalla de figures</span>
          <select
            value={settings.screenW > 0 ? `${settings.screenW}x${settings.screenH}` : ''}
            onChange={e => {
              const [W, H] = e.target.value.split('x').map(Number);
              setSettings(p => ({ ...p, screenW: W || 0, screenH: H || 0 }));
            }}
            style={inputStyle}
          >
            <option value="">{(() => { const t = screens.find(x => x.tauler) ?? (screens.length === 1 ? screens[0] : null); return t ? `Automàtica (${t.w}×${t.h}${t.tauler ? ', la de figures' : ''})` : 'Tria-la…'; })()}</option>
            {settings.screenW > 0 && !screens.some(x => x.w === settings.screenW && x.h === settings.screenH) && (
              <option value={`${settings.screenW}x${settings.screenH}`}>{settings.screenW}×{settings.screenH} (ara no es veu)</option>
            )}
            {screens.map(x => <option key={x.id} value={`${x.w}x${x.h}`}>Pantalla de {x.w}×{x.h}{x.tauler ? ' (figures)' : ''}</option>)}
          </select>
          {screens.length === 0 && (
            <span style={{ color: C.warn, fontSize: FS.xs }}>No es veu la pantalla de figures. Obre-la des del DM (Pantalles → «Obrir la pantalla de figures») i posa-la a pantalla completa al monitor del tauler, en aquest mateix PC.</span>
          )}
        </Section>

        <Section title="Dungeon Master">
          {!available ? (
            <span style={{ color: C.enemy, fontSize: FS.sm }}>Aquest navegador no pot parlar amb el DM (sense BroadcastChannel).</span>
          ) : (
            <span style={{ color: connected ? C.ok : C.warn, fontSize: FS.sm }}>
              ● {connected ? `Connectat · ${players.length} jugador${players.length === 1 ? '' : 's'}` : 'Esperant el DM (obre l\'app del DM en aquest PC)'}
            </span>
          )}
          {connected && (
            <span style={{ color: C.dim, fontSize: FS.xs }}>
              {boardOn ? 'Tauler de figuretes encès: escala fixa d\'1 casella = 1 polzada.' : 'Tauler de figuretes apagat: la pantalla de figures segueix el pan i el zoom del DM.'}
            </span>
          )}
          <Row label="Moure tokens">
            <Seg value={sendOn ? 'on' : 'off'} options={[['off', 'No'], ['on', 'Sí']]} onChange={v => toggleSend(v === 'on')} />
          </Row>
          {sendOn && (!hom || !tableScreen(settings, screens) || !connected) && (
            <span style={{ color: C.warn, fontSize: FS.xs }}>
              Encara no es pot moure res: {[!connected && 'falta el DM', !hom && 'falta calibrar el tauler', !tableScreen(settings, screens) && 'falta la pantalla de figures'].filter(Boolean).join(', ')}.
            </span>
          )}
          <Button size="sm" disabled={!hom || !connected || !running || !tableScreen(settings, screens)} onClick={syncAll} title="Mou cada token assignat a on hi ha ara la seva figureta">
            Posar els tokens on són les figuretes
          </Button>
          <span style={{ color: C.dim, fontSize: FS.xs }}>
            Quan una figureta queda quieta mig segon en una altra casella, el seu token s&apos;hi mou. El DM ho valida com si el jugador
            l&apos;hagués arrossegat: en combat, només el del torn i dins dels peus que li queden.
          </span>
        </Section>

        <Section title="Vista">
          <Seg value={settings.view} options={[['camera', 'Càmera'], ['mix', 'Barrejat'], ['mask', 'Màscara']]} onChange={v => setSettings(p => ({ ...p, view: v }))} />
          <Row label={`Processar a ${settings.procW} px`}>
            <Seg value={settings.procW} options={[[320, '320'], [480, '480'], [640, '640']]} onChange={v => setSettings(p => ({ ...p, procW: v }))} />
          </Row>
          <Slider label="Taca mínima" value={settings.minArea} min={5} max={400} step={5} unit=" px" onChange={v => setSettings(p => ({ ...p, minArea: v }))} />
        </Section>

        <Section title="Colors de les bases">
          {settings.slots.map((sl, i) => {
            const st = status[i];
            const isSel = i === selected;
            return (
              <div
                key={sl.id}
                onClick={() => setSelected(i)}
                style={{ border: `1px solid ${isSel ? C.accent : C.border}`, borderRadius: RADIUS.md, padding: 8, display: 'flex', flexDirection: 'column', gap: 6, background: isSel ? C.bg : 'transparent', cursor: 'pointer', opacity: sl.enabled ? 1 : 0.55 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={sl.enabled} onChange={e => patchSlot(i, { enabled: e.target.checked })} onClick={e => e.stopPropagation()} title="Buscar aquest color" />
                  <span style={{ width: 16, height: 16, borderRadius: RADIUS.pill, background: sl.swatch, flexShrink: 0, border: `1px solid ${C.border}` }} />
                  <input value={sl.name} onChange={e => patchSlot(i, { name: e.target.value })} style={{ ...inputStyle, flex: 1, padding: '2px 6px' }} />
                  {st && sl.enabled && (
                    <span style={{ color: STATE_COLOR[st.state], fontSize: FS.sm, whiteSpace: 'nowrap' }}>● {STATE_LABEL[st.state]}</span>
                  )}
                </div>
                <select
                  value={sl.playerId ?? ''}
                  onClick={e => e.stopPropagation()}
                  onChange={e => patchSlot(i, { playerId: e.target.value === '' ? null : Number(e.target.value) })}
                  style={{ ...inputStyle, padding: '2px 6px' }}
                  title="Quin token mou aquesta figureta"
                >
                  <option value="">No mou cap token</option>
                  {sl.playerId != null && !players.some(p => p.id === sl.playerId) && <option value={sl.playerId}>Jugador {sl.playerId} (no és a la partida)</option>}
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {slotMsg[i] && <span style={{ color: slotMsg[i].color, fontSize: FS.xs }}>{slotMsg[i].text}</span>}
                {isSel && (
                  <>
                    <Slider label="To" value={sl.hue} min={0} max={359} step={1} unit="°" onChange={v => patchSlot(i, { hue: v })} />
                    <Slider label="Marge de to" value={sl.hueTol} min={3} max={40} step={1} unit="°" onChange={v => patchSlot(i, { hueTol: v })} />
                    <Slider label="Saturació mín." value={sl.satMin} min={0.05} max={1} step={0.01} onChange={v => patchSlot(i, { satMin: v })} />
                    <Slider label="Brillantor mín." value={sl.valMin} min={0.02} max={1} step={0.01} onChange={v => patchSlot(i, { valMin: v })} />
                  </>
                )}
                {st && sl.enabled && st.area > 0 && (
                  <span style={{ color: C.dim, fontSize: FS.xs }}>
                    {st.area} px · ({Math.round(st.cx * 100)} %, {Math.round(st.cy * 100)} %)
                    {st.extra > 0 && <span style={{ color: C.warn }}> · {st.extra} taca{st.extra > 1 ? 'ques' : ''} més del mateix color</span>}
                  </span>
                )}
                {looksLikeSkin(sl) && sl.enabled && (
                  <span style={{ color: C.warn, fontSize: FS.xs }}>Aquest to s&apos;assembla al de la pell: les mans es poden confondre amb la base.</span>
                )}
              </div>
            );
          })}
          <Button size="sm" variant="ghost" onClick={() => setSettings(p => ({ ...p, slots: DEFAULT_SLOTS }))}>Tornar als colors per defecte</Button>
        </Section>

        <Section title="Què cal provar">
          <ul style={{ margin: 0, paddingLeft: 18, color: C.dim, fontSize: FS.sm, lineHeight: 1.5 }}>
            <li>Amb el polaritzador girat, el mapa del monitor ha de quedar gairebé negre a la vista «Màscara» (cap taca on no hi ha figuretes).</li>
            <li>Les 5 figuretes, cadascuna «quieta» i sense «+N» al costat del nom.</li>
            <li>Passar la mà per sobre: no ha de sortir cap taca nova.</li>
            <li>Moure una figureta: «es mou» i, en deixar-la, «quieta» en mig segon.</li>
          </ul>
        </Section>
      </aside>
    </div>
  );
}

interface BoardDraw {
  corners: Point[] | null;
  closed: boolean;
  inv: Homography | null;
  scr: { W: number; H: number } | null;
  cam: CamRect | null;
  g: ReturnType<typeof gridInfo>;
  tokens: { name: string; color: string; c: Point }[];
}

/**
 * Pinta damunt del vídeo el que el tracker creu que hi ha al tauler: el contorn calibrat,
 * la graella del mapa i on són ara els tokens de jugador. Si la graella pintada no cau
 * sobre la del monitor, el calibratge (o la pantalla triada) no és bo.
 */
function drawBoard(ctx: CanvasRenderingContext2D, ow: number, oh: number, d: BoardDraw) {
  const P = (p: Point) => ({ x: p.x * ow, y: p.y * oh });
  if (d.inv && d.scr && d.cam && d.g.gs > 0) {
    const { inv, scr, cam, g } = d;
    const a = screenToMap(0, 0, scr.W, scr.H, cam), b = screenToMap(1, 1, scr.W, scr.H, cam);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    let n = 0;
    for (let x = g.gox + Math.ceil((a.x - g.gox) / g.gs) * g.gs; x <= b.x && n < 300; x += g.gs, n++) {
      const u = mapToScreen({ x, y: 0 }, scr.W, scr.H, cam).x;
      const p0 = P(applyH(inv, { x: u, y: 0 })), p1 = P(applyH(inv, { x: u, y: 1 }));
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
    }
    for (let y = g.goy + Math.ceil((a.y - g.goy) / g.gs) * g.gs; y <= b.y && n < 600; y += g.gs, n++) {
      const v = mapToScreen({ x: 0, y }, scr.W, scr.H, cam).y;
      const p0 = P(applyH(inv, { x: 0, y: v })), p1 = P(applyH(inv, { x: 1, y: v }));
      ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
    }
    ctx.stroke();
  }
  if (d.inv && d.scr && d.cam) {
    ctx.font = `${FS.md}px sans-serif`;
    for (const t of d.tokens) {
      const q = mapToScreen(t.c, d.scr.W, d.scr.H, d.cam);
      if (q.x < 0 || q.x > 1 || q.y < 0 || q.y > 1) continue;
      const p = P(applyH(d.inv, q));
      ctx.strokeStyle = t.color; ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = t.color;
      ctx.fillText(t.name, p.x - 14, p.y + 30);
    }
  }
  const c = d.corners;
  if (c && c.length > 0) {
    ctx.strokeStyle = C.accent; ctx.lineWidth = 2;
    ctx.beginPath();
    c.forEach((p, i) => { const q = P(p); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
    if (d.closed && c.length === 4) ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = C.accent;
    ctx.font = `bold ${FS.lg}px sans-serif`;
    c.forEach((p, i) => {
      const q = P(p);
      ctx.beginPath(); ctx.arc(q.x, q.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillText(String(i + 1), q.x + 9, q.y - 9);
    });
  }
}

const inputStyle: React.CSSProperties = {
  background: C.dark, color: C.text, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, padding: '5px 8px', fontSize: FS.sm, width: '100%',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h2 style={{ margin: 0, fontSize: FS.sm, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.6 }}>{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: FS.sm }}>{label}</span>
      {children}
    </div>
  );
}

function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(([v, l]) => (
        <Button key={String(v)} size="sm" variant={v === value ? 'tint' : 'secondary'} active={v === value} color={C.accent} onClick={() => onChange(v)}>{l}</Button>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step, unit = '', onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: FS.sm }} onClick={e => e.stopPropagation()}>
      <span style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span style={{ color: C.bright }}>{value}{unit}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    </label>
  );
}

function Notice({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${color}`, borderRadius: RADIUS.md, padding: '8px 12px', color: C.text, background: C.panel, fontSize: FS.sm }}>
      {children}
    </div>
  );
}
