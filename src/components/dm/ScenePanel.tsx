'use client';
import React, { useEffect, useRef, useState } from 'react';
import { C, FS, RADIUS, FONT_SERIF } from '@/constants';
import { ImageIcon, CheckIcon, PlayIcon, SlidersIcon } from '@/components/icons';
import { SceneStage } from '@/components/scene/SceneStage';
import { speedLabel, smoothLabel } from '@/lib/textreveal';
import type { SceneShowApi, SceneMedia } from '@/hooks/useSceneShow';
import { textZoneBand, zoneAt, type SceneOpts, type SceneZone } from '@/lib/scene';

// ── Controls petits de la configuració ───────────────────────────────────────
function Seg<T extends string>({ value, onChange, items, title }: {
  value: T; onChange: (v: T) => void; items: [T, string][]; title?: string;
}) {
  return (
    <div title={title} style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: 'hidden', flex: 1, minWidth: 0 }}>
      {items.map(([v, label], i) => (
        <button key={v} onClick={() => onChange(v)} aria-pressed={value === v}
          style={{
            flex: 1, padding: '4px 4px', border: 'none', borderLeft: i ? `1px solid ${C.border}` : 'none', cursor: 'pointer',
            background: value === v ? `${C.accent}22` : 'transparent', color: value === v ? C.accent : C.dim,
            fontSize: FS.xs, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button onClick={onClick} aria-pressed={on} title={title}
      style={{
        flex: 1, padding: '4px 6px', borderRadius: RADIUS.md, border: `1px solid ${on ? C.accent : C.border}`,
        background: on ? `${C.accent}18` : 'transparent', color: on ? C.accent : C.dim,
        cursor: 'pointer', fontSize: FS.xs, fontWeight: 700, whiteSpace: 'nowrap',
      }}>
      {children}
    </button>
  );
}

function SmallBtn({ onClick, children, title, disabled }: { onClick: () => void; children: React.ReactNode; title?: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      style={{
        flex: 1, padding: '4px 6px', borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: 'transparent',
        color: disabled ? 'rgba(255,255,255,0.18)' : C.dim, cursor: disabled ? 'default' : 'pointer', fontSize: FS.xs, fontWeight: 600, whiteSpace: 'nowrap',
      }}>
      {children}
    </button>
  );
}

/** Un ajust: nom petit a dalt (i el valor a la dreta, si en té) i el control a sota. */
function Field({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: FS.xs, color: C.dim }}>
        <span>{label}</span>{value && <b style={{ color: C.text, fontWeight: 600 }}>{value}</b>}
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 0 }}>{children}</div>
    </div>
  );
}

/** Un grup de la configuració (Text · Subtítols · Imatge). */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '7px 8px 8px', border: `1px solid ${C.border}`, borderRadius: RADIUS.md, background: 'rgba(255,255,255,0.015)', minWidth: 0 }}>
      <div style={{ fontSize: FS.xs, color: C.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</div>
      {children}
    </div>
  );
}

const PLACE_LABEL: Record<SceneOpts['place'], string> = { bottom: 'baix', center: 'centre', top: 'dalt' };

// ── Carrusel de diapositives ─────────────────────────────────────────────────
const THUMB_W = 88;
const THUMB_H = 50;
const SLIDE_MIME = 'application/x-scene-slide';

function Thumb({ m, i, cur, onGo, onRemove, onMove }: {
  m: SceneMedia; i: number; cur: number;
  onGo: (i: number) => void; onRemove: (i: number) => void; onMove: (from: number, to: number) => void;
}) {
  const [hover, setHover] = useState(false);
  const isCur = i === cur;
  const badge = isCur ? 'ARA' : i === cur + 1 ? 'SEGÜENT' : null;
  return (
    <div
      data-slide={i}
      draggable
      onDragStart={e => { e.dataTransfer.setData(SLIDE_MIME, String(i)); e.dataTransfer.effectAllowed = 'move'; }}
      onDragOver={e => { if (e.dataTransfer.types.includes(SLIDE_MIME)) e.preventDefault(); }}
      onDrop={e => {
        const from = e.dataTransfer.getData(SLIDE_MIME);
        if (from === '') return;
        e.preventDefault(); e.stopPropagation();
        onMove(+from, i);
      }}
      onClick={() => onGo(i)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      title={isCur ? 'Es veu ara' : `Passar a la imatge ${i + 1} (arrossega per canviar l'ordre)`}
      style={{
        position: 'relative', width: THUMB_W, height: THUMB_H, flexShrink: 0, borderRadius: RADIUS.sm, overflow: 'hidden', cursor: 'pointer',
        outline: `2px solid ${isCur ? C.accent : 'transparent'}`, outlineOffset: -2, background: '#000',
        opacity: i < cur ? 0.45 : 1, boxShadow: isCur ? `0 0 10px ${C.accent}55` : 'none',
      }}>
      {m.mimeType.startsWith('video/')
        ? <video src={`${m.url}#t=0.1`} muted preload="metadata" playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={m.url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />}
      <span style={{ position: 'absolute', left: 3, bottom: 2, fontSize: 9, fontWeight: 700, color: '#fff', textShadow: '0 1px 2px #000' }}>{i + 1}</span>
      {badge && (
        <span style={{ position: 'absolute', left: 3, top: 3, fontSize: 8, fontWeight: 800, letterSpacing: '0.06em', padding: '1px 4px', borderRadius: 3, background: isCur ? C.accent : 'rgba(0,0,0,0.65)', color: isCur ? C.onAccent : C.text }}>{badge}</span>
      )}
      {hover && (
        <button onClick={e => { e.stopPropagation(); onRemove(i); }} aria-label={`Treure la imatge ${i + 1}`} title="Treure"
          style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, lineHeight: '14px', padding: 0, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>×</button>
      )}
    </div>
  );
}

/**
 * Pestanya «Escena» del panell «Mostrar als jugadors»: imatges o vídeos de fons (en
 * diapositives) + text en subtítols. De dalt a baix: la configuració (Text · Subtítols ·
 * Imatge, plegable), l'escenari (la previsualització, tal com ho veuran els jugadors), el
 * carrusel de les imatges carregades, el text i els botons.
 *
 * L'escenari té dos blocs, com l'esquema del DM: el **de la imatge** (clic = la següent)
 * i el **del text** (la franja dels subtítols; clic = avançar el text). Arrossegar mou la
 * imatge i la roda hi fa zoom. Sense imatge, el text surt a pantalla completa.
 *
 * Està sempre muntada (amagada quan no és la pestanya oberta): el motor de text hi té els
 * seus spans i l'escena continua als jugadors encara que es tanqui el panell.
 */
export function ScenePanel({ sc, header, width, onFileDropped }: {
  sc: SceneShowApi;
  header: React.ReactNode;
  width: number;
  /** S'ha deixat un fitxer al panell (DMView neteja el seu indicador de «deixa'l aquí»). */
  onFileDropped: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [hoverZone, setHoverZone] = useState<SceneZone | null>(null);
  const [showCfg, setShowCfg] = useState(true);
  // Els refs de l'escenari a part: si no, la regla `react-hooks/refs` pren tot `sc` per un ref.
  const { mediaInnerRef, boxRef, textRef, sizeRef, counterRef, progRef, playBtnRef } = sc.refs;
  const hasMedia = !!sc.media;
  const n = sc.slides.length;
  const o = sc.opts;
  const setO = (p: Partial<SceneOpts>) => sc.setOpts(p);

  // Roda = zoom de la imatge (listener natiu: el de React és passiu i no pot aturar el scroll).
  const { zoomBy } = sc;
  useEffect(() => {
    const el = stageRef.current; if (!el || !hasMedia) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.1 : 0.9); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [hasMedia, zoomBy]);

  // Carrusel: la imatge d'ara a l'esquerra (amb un tros de l'anterior), les següents a la dreta.
  useEffect(() => {
    const strip = stripRef.current; if (!strip) return;
    const el = strip.querySelector<HTMLElement>(`[data-slide="${sc.cur}"]`); if (!el) return;
    strip.scrollTo({ left: Math.max(0, el.offsetLeft - strip.offsetLeft - THUMB_W * 0.45), behavior: 'smooth' });
  }, [sc.cur, n]);

  const zoneOf = (e: React.MouseEvent): SceneZone => {
    const r = stageRef.current?.getBoundingClientRect();
    return zoneAt(r ? (e.clientY - r.top) / r.height : 1, o.place, hasMedia);
  };
  const clickImage = () => {
    if (!n) inputRef.current?.click();
    else sc.nextSlide();
  };
  const dropFiles = (e: React.DragEvent) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault(); e.stopPropagation(); onFileDropped();
    sc.addFiles(e.dataTransfer.files);
  };

  const canShow = hasMedia || sc.text.trim().length > 0;
  const [bandA, bandB] = textZoneBand(o.place);
  const imageHint = !n ? 'Clic: afegir imatges' : sc.cur < n - 1 ? `Clic: imatge següent · ${sc.cur + 1}/${n}` : sc.loop ? `Clic: tornar a la primera · ${n}/${n}` : `Última imatge · ${n}/${n}`;
  const summary = `${speedLabel(sc.speed)} · ${o.flow === 'sentence' ? 'frase a frase' : 'continu'} · ${PLACE_LABEL[o.place]} · ${o.size.toUpperCase()} · ${o.fit === 'cover' ? 'omplir' : 'encaixar'}`;

  return (
    <div style={{
      position: 'absolute', top: 12, left: 12, zIndex: 20, width, maxWidth: 'calc(100% - 24px)', maxHeight: 'calc(100% - 24px)',
      display: sc.open ? 'flex' : 'none', flexDirection: 'column', background: 'rgba(13,17,23,0.97)', border: `1px solid ${C.border}`,
      borderRadius: RADIUS.lg, boxShadow: '0 8px 32px rgba(0,0,0,0.7)', overflow: 'hidden',
    }}>
      {header}

      <div style={{ overflowY: 'auto', minHeight: 0 }}>
        {/* ── Configuració (plegable) ── */}
        <div style={{ borderBottom: `1px solid ${C.border}` }}>
          <button onClick={() => setShowCfg(v => !v)} aria-expanded={showCfg}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', border: 'none', background: 'transparent', cursor: 'pointer', color: C.dim, fontSize: FS.xs, fontWeight: 700, textAlign: 'left' }}>
            <SlidersIcon size={13} color={C.dim} />
            <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>Configuració</span>
            {!showCfg && <span style={{ flex: 1, minWidth: 0, color: C.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</span>}
            <span style={{ marginLeft: 'auto', fontSize: FS.sm }}>{showCfg ? '▾' : '▸'}</span>
          </button>
          {showCfg && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, padding: '0 12px 10px' }}>
              <Group title="Text">
                <Field label="Velocitat" value={speedLabel(sc.speed)}>
                  <input type="range" min={1} max={100} value={sc.speed} onChange={e => sc.setSpeed(+e.target.value)} aria-label="Velocitat" style={{ width: '100%', accentColor: C.accent }} />
                </Field>
                <Field label="Suavitat" value={smoothLabel(sc.smooth)}>
                  <input type="range" min={1} max={100} value={sc.smooth} onChange={e => sc.setSmooth(+e.target.value)} aria-label="Suavitat" style={{ width: '100%', accentColor: C.accent }} />
                </Field>
                <Field label="Ritme">
                  <Toggle on={sc.dramatic} onClick={() => sc.setDramatic(!sc.dramatic)} title="Pausa en acabar cada frase i cada paràgraf">Pauses</Toggle>
                  <Toggle on={sc.manual} onClick={() => sc.setManual(!sc.manual)} title="Revelar frase a frase (Espai o clic al bloc del text)">Manual</Toggle>
                </Field>
              </Group>
              <Group title="Subtítols">
                <Field label="Posició">
                  <Seg value={o.place} onChange={v => setO({ place: v })} items={[['bottom', 'Baix'], ['center', 'Centre'], ['top', 'Dalt']]} />
                </Field>
                <Field label="Mida i fons">
                  <Seg value={o.size} onChange={v => setO({ size: v })} title="Mida de la lletra" items={[['s', 'S'], ['m', 'M'], ['l', 'L']]} />
                  <Toggle on={o.band} onClick={() => setO({ band: !o.band })} title="Franja fosca darrere el text (per llegir-lo sobre imatges clares)">Franja</Toggle>
                </Field>
                <Field label="Es veu">
                  <Seg value={o.flow} onChange={v => setO({ flow: v })} title="Frase a frase: només la frase d'ara. Continu: el text s'acumula"
                    items={[['sentence', 'Frase'], ['flow', 'Continu']]} />
                </Field>
              </Group>
              <Group title="Imatge">
                <Field label="Ajust">
                  <Seg value={o.fit} onChange={v => setO({ fit: v })} title="Encaixar: la imatge sencera. Omplir: cobreix tota la pantalla (en retalla les vores)"
                    items={[['contain', 'Encaixar'], ['cover', 'Omplir']]} />
                </Field>
                <Field label="Càmera">
                  <Toggle on={o.kenBurns} onClick={() => setO({ kenBurns: !o.kenBurns })} title="Moviment lent de càmera (Ken Burns)">Moviment</Toggle>
                  <SmallBtn onClick={sc.restartMotion} disabled={!hasMedia} title="Treu el zoom i el desplaçament i torna a començar el moviment">↺</SmallBtn>
                </Field>
                <Field label="Diapositives">
                  <Toggle on={sc.loop} onClick={() => sc.setLoop(!sc.loop)} title="Després de l'última, tornar a la primera">Bucle</Toggle>
                </Field>
              </Group>
            </div>
          )}
        </div>

        {/* ── Escenari: bloc de la imatge + bloc del text ── */}
        <div
          ref={stageRef}
          style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#000', cursor: 'pointer', userSelect: 'none' }}
          onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
          onDrop={dropFiles}
          onMouseDown={e => {
            if (e.button !== 0) return;
            e.preventDefault();
            dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
          }}
          onMouseMove={e => {
            const z = zoneOf(e);
            if (z !== hoverZone) setHoverZone(z);
            const d = dragRef.current; if (!d) return;
            const dx = e.clientX - d.x, dy = e.clientY - d.y;
            if (!d.moved && Math.hypot(dx, dy) < 4) return;
            d.moved = true;
            if (hasMedia) sc.panBy(dx, dy);
            d.x = e.clientX; d.y = e.clientY;
          }}
          onMouseUp={e => {
            const d = dragRef.current; dragRef.current = null;
            if (!d || d.moved) return;
            if (zoneOf(e) === 'image') clickImage(); else sc.primary();
          }}
          onMouseLeave={() => { dragRef.current = null; setHoverZone(null); }}
        >
          <SceneStage mediaUrl={sc.media?.url ?? null} mimeType={sc.media?.mimeType ?? null} hasMedia={hasMedia} opts={o}
            mediaInnerRef={mediaInnerRef} boxRef={boxRef} textRef={textRef} sizeRef={sizeRef}>
            {hasMedia && (
              <>
                {/* Línies del bloc del text (on van els subtítols) */}
                <div style={{
                  position: 'absolute', left: 0, right: 0, top: `${bandA * 100}%`, height: `${(bandB - bandA) * 100}%`, pointerEvents: 'none',
                  borderTop: bandA > 0 ? `1px dashed rgba(255,255,255,${hoverZone ? 0.4 : 0.16})` : 'none',
                  borderBottom: bandB < 1 ? `1px dashed rgba(255,255,255,${hoverZone ? 0.4 : 0.16})` : 'none',
                  background: hoverZone === 'text' ? 'rgba(255,255,255,0.05)' : 'transparent', transition: 'background 0.15s',
                }} />
                <ZoneHint visible={hoverZone === 'image'} style={o.place === 'top' ? { bottom: 8, left: 8 } : { top: 8, left: 8 }}>▶ {imageHint}</ZoneHint>
                <ZoneHint visible={hoverZone === 'text'} style={{ top: `calc(${bandA * 100}% + 6px)`, right: 8 }}>▶ Clic: avança el text</ZoneHint>
                <div style={{ position: 'absolute', top: 8, right: 8, color: 'rgba(255,255,255,0.35)', fontSize: FS.xs, pointerEvents: 'none', letterSpacing: '0.04em', textShadow: '0 1px 3px #000', display: hoverZone === 'text' ? 'none' : 'block' }}>
                  roda: zoom · arrossega: mou
                </div>
              </>
            )}
            {!hasMedia && (
              <button onClick={() => inputRef.current?.click()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()}
                title="Arrossega o tria imatges o vídeos de fons"
                style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: RADIUS.md, border: `1px dashed ${C.border}`, background: 'rgba(0,0,0,0.45)', color: C.dim, fontSize: FS.xs, fontWeight: 600, cursor: 'pointer' }}>
                <ImageIcon size={13} color={C.dim} /> Imatges o vídeos
              </button>
            )}
            {!hasMedia && !sc.text.trim() && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'rgba(255,255,255,0.32)', fontSize: FS.sm, lineHeight: 1.6, pointerEvents: 'none', padding: 20 }}>
                Arrossega aquí una o més imatges o vídeos de fons<br />i escriu el text a sota.<br />Sense imatge, el text surt a pantalla completa.
              </div>
            )}
          </SceneStage>
        </div>
        <input ref={inputRef} type="file" accept="image/*,video/*" multiple aria-label="Imatges o vídeos de l'escena" style={{ display: 'none' }}
          onChange={e => { if (e.target.files) sc.addFiles(e.target.files); e.target.value = ''; }} />

        {/* ── Carrusel de les imatges carregades ── */}
        <div onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }} onDrop={dropFiles}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px 7px 12px', borderTop: `1px solid ${C.border}`, background: 'rgba(0,0,0,0.25)' }}>
          <div ref={stripRef} style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1, minWidth: 0, scrollbarWidth: 'thin', paddingBottom: 1 }}>
            {sc.slides.map((m, i) => (
              <Thumb key={m.id} m={m} i={i} cur={sc.cur} onGo={sc.goTo} onRemove={sc.removeSlide} onMove={sc.moveSlide} />
            ))}
            <button onClick={() => inputRef.current?.click()} title="Afegir imatges o vídeos (també es poden arrossegar aquí)"
              style={{ width: n ? 50 : THUMB_W * 2.4, height: THUMB_H, flexShrink: 0, borderRadius: RADIUS.sm, border: `1px dashed ${C.border}`, background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: n ? FS.xl : FS.xs, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {n ? '+' : <><ImageIcon size={13} color={C.dim} /> Afegeix imatges</>}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: FS.xs, color: C.dim, whiteSpace: 'nowrap' }}>{n ? <><b style={{ color: C.text }}>{sc.cur + 1}</b> / {n}</> : 'Cap imatge'}</span>
            <button onClick={sc.clearSlides} disabled={!n} title="Treure totes les imatges: el text passa a pantalla completa"
              style={{ padding: '2px 7px', borderRadius: RADIUS.sm, border: `1px solid ${C.border}`, background: 'transparent', color: n ? C.dim : 'rgba(255,255,255,0.18)', cursor: n ? 'pointer' : 'default', fontSize: FS.xs }}>
              Buida
            </button>
          </div>
        </div>

        {/* ── Text: estat + editor ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, fontSize: FS.sm, color: C.dim }}>
          <span ref={counterRef} style={{ minWidth: 80 }}>—</span>
          <div style={{ flex: 1, height: 3, background: C.border, borderRadius: RADIUS.sm, overflow: 'hidden' }}>
            <div ref={progRef} style={{ height: '100%', width: '0%', background: C.text }} />
          </div>
        </div>
        <textarea
          value={sc.text}
          onChange={e => sc.setText(e.target.value)}
          placeholder={'Text dels subtítols…\n\nCada frase és un subtítol (en mode «Frase»).'}
          style={{ width: '100%', height: 92, resize: 'vertical', border: 'none', outline: 'none', background: 'rgba(255,255,255,0.02)', color: C.text, fontFamily: FONT_SERIF, fontSize: FS.lg, lineHeight: 1.5, padding: '10px 12px', display: 'block' }}
        />
      </div>

      {/* ── Botons ── */}
      <div style={{ padding: '8px 10px', display: 'flex', gap: 6, flexShrink: 0, borderTop: `1px solid ${C.border}` }}>
        <button ref={playBtnRef} onClick={sc.primary}
          style={{ padding: '8px 12px', borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', color: C.text, cursor: 'pointer', fontWeight: 700, fontSize: FS.sm }}>
          Comença
        </button>
        <button onClick={sc.reset}
          style={{ padding: '8px 12px', borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: FS.sm }}>
          Reinicia
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={sc.show} disabled={!canShow}
          style={{ padding: '8px 12px', borderRadius: RADIUS.md, border: 'none', background: canShow ? C.accent : 'rgba(255,255,255,0.05)', color: canShow ? C.onAccent : C.dim, cursor: canShow ? 'pointer' : 'default', fontWeight: 700, fontSize: FS.sm, display: 'flex', alignItems: 'center', gap: 6 }}>
          {sc.active ? <><CheckIcon size={13} /> Mostrant als jugadors</> : <><PlayIcon size={12} /> Mostrar als jugadors</>}
        </button>
        <button onClick={sc.hide} disabled={!sc.active}
          style={{ padding: '8px 12px', borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: 'transparent', cursor: sc.active ? 'pointer' : 'default', color: sc.active ? C.dim : 'rgba(255,255,255,0.15)', fontSize: FS.sm }}>
          Ocultar
        </button>
      </div>
    </div>
  );
}

function ZoneHint({ visible, style, children }: { visible: boolean; style: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute', ...style, pointerEvents: 'none', padding: '3px 8px', borderRadius: RADIUS.pill,
      background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: FS.xs, fontWeight: 700, letterSpacing: '0.02em',
      opacity: visible ? 1 : 0, transition: 'opacity 0.15s', whiteSpace: 'nowrap',
    }}>
      {children}
    </div>
  );
}
