'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useStoredString } from '@/hooks/useStoredFlag';
import { C, FS, RADIUS, FONT_SERIF } from '@/constants';
import { Button } from '@/components/ui/Button';
import {
  type BlobState, type ColorSlot, DEFAULT_SLOTS, StillTracker,
  detect, hsvToHex, looksLikeSkin, sampleHsv, slotFromSample,
} from '@/lib/tracker/detect';

/**
 * `/tracker` — fase 0 del seguiment de figuretes físiques amb càmera.
 *
 * Només detecta: obre una càmera, troba les bases de color i diu si cada figureta és quieta,
 * es mou o s'ha perdut. Encara no envia res al DM. Serveix per provar el muntatge real
 * (càmera a sobre del monitor-tauler, polaritzador, llum, pintura de les bases) i ajustar
 * els colors abans de fer el tracker de debò. Veure «Figuretes físiques amb càmera» a
 * `docs/tokens-i-combat.md`.
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
}

const DEFAULTS: Settings = { slots: DEFAULT_SLOTS, procW: 480, minArea: 40, view: 'camera', deviceId: '', res: 1080 };

function parseSettings(raw: string): Settings {
  try {
    if (!raw) return DEFAULTS;
    const s = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...s, slots: Array.isArray(s.slots) && s.slots.length ? s.slots : DEFAULTS.slots };
  } catch { return DEFAULTS; }
}

interface Status { state: BlobState; area: number; extra: number; cx: number; cy: number }

const noSubscribe = () => () => {};

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
  const rafRef = useRef(0);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const all = await navigator.mediaDevices.enumerateDevices();
    setDevices(all.filter(d => d.kind === 'videoinput'));
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
  }, []);

  useEffect(() => stop, [stop]);

  const loop = useCallback(() => {
    const video = videoRef.current, overlay = overlayRef.current;
    let frames = 0, acc = 0, t0 = performance.now(), lastUi = 0;
    const step = () => {
      rafRef.current = requestAnimationFrame(step);
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
      const ms = performance.now() - tStart;

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
        const label = `${sl.name}${res.extra[i] ? ` +${res.extra[i]}` : ''}`;
        octx.strokeText(label, b.maxX * 2 + 10, b.minY * 2 + FS.xl);
        octx.fillText(label, b.maxX * 2 + 10, b.minY * 2 + FS.xl);
        octx.lineWidth = 3;
      });

      frames++; acc += ms;
      const now = performance.now();
      if (now - lastUi > 200) {
        lastUi = now;
        setStatus(res.best.map((b, i) => ({ state: states[i], area: b?.area ?? 0, extra: res.extra[i], cx: b?.cx ?? 0, cy: b?.cy ?? 0 })));
      }
      if (now - t0 > 1000) {
        setPerf({ fps: Math.round((frames * 1000) / (now - t0)), ms: Math.round((acc / frames) * 10) / 10, vw, vh, pw, ph });
        frames = 0; acc = 0; t0 = now;
      }
    };
    step();
  }, []);

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
  }, [selected, setSettings]);

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
          <span style={{ color: C.dim }}>Fase 0 · prova de detecció (encara no mou cap token)</span>
        </header>

        {!secure && (
          <Notice color={C.warn}>
            Aquesta pàgina no és segura (<code>http</code> fora de <code>localhost</code>) i el navegador no hi deixarà obrir la càmera.
            Obre-la al PC on hi ha connectada la càmera: <code>http://localhost:3001/tracker</code>.
          </Notice>
        )}
        {error && <Notice color={C.enemy}>{error}</Notice>}

        <div
          onClick={onVideoClick}
          title="Clica la base d'una figureta per agafar-ne el color"
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
          <span>Clica una base al vídeo per donar el seu color al slot seleccionat.</span>
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
