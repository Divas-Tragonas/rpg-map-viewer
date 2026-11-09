'use client';
import React, { useEffect, useRef, useState } from 'react';
import { C, FS, RADIUS, FONT_SERIF } from '@/constants';
import { ImageIcon, CheckIcon, PlayIcon } from '@/components/icons';
import { SceneStage } from '@/components/scene/SceneStage';
import { speedLabel, smoothLabel } from '@/lib/textreveal';
import type { SceneShowApi, SceneMedia } from '@/hooks/useSceneShow';
import { textZoneBand, zoneAt, type SceneOpts, type SceneZone } from '@/lib/scene';

// ── Controls de la configuració ──────────────────────────────────────────────
// Tots omplen l'amplada de la seva cel·la (la graella té tres columnes iguals): així els
// botons tenen sempre la mateixa mida, també quan canvia el que hi diu (Dalt/Baix ↔ L/R).
const CTRL_H = 20;

function Seg<T extends string>({ value, onChange, items, title }: {
  value: T; onChange: (v: T) => void; items: [T, string][]; title?: string;
}) {
  return (
    <div title={title} style={{ display: 'flex', flex: 1, minWidth: 0, height: CTRL_H, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: 'hidden' }}>
      {items.map(([v, label], i) => (
        <button key={v} onClick={() => onChange(v)} aria-pressed={value === v}
          style={{
            flex: '1 1 0', minWidth: 0, padding: 0, border: 'none', borderLeft: i ? `1px solid ${C.border}` : 'none', cursor: 'pointer',
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
        flex: '1 1 0', minWidth: 0, height: CTRL_H, padding: 0, borderRadius: RADIUS.md, border: `1px solid ${on ? C.accent : C.border}`,
        background: on ? `${C.accent}18` : 'transparent', color: on ? C.accent : C.dim,
        cursor: 'pointer', fontSize: FS.xs, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
      {children}
    </button>
  );
}

function Btn({ onClick, children, title, disabled }: { onClick: () => void; children: React.ReactNode; title?: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      style={{
        flex: '1 1 0', minWidth: 0, height: CTRL_H, padding: 0, borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: 'transparent',
        color: disabled ? 'rgba(255,255,255,0.18)' : C.dim, cursor: disabled ? 'default' : 'pointer', fontSize: FS.xs, fontWeight: 600, whiteSpace: 'nowrap',
      }}>
      {children}
    </button>
  );
}

/** Una cel·la de la graella: el nom (i el valor, a la dreta) a dalt i el control a sota. */
function Cell({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: FS.xs, lineHeight: '12px', color: C.dim, whiteSpace: 'nowrap' }}>
        <span>{label}</span>{value && <b style={{ color: C.text, fontWeight: 600 }}>{value}</b>}
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: CTRL_H, minWidth: 0 }}>{children}</div>
    </div>
  );
}

/** Un grup (Text · Imatge): títol en vertical a l'esquerra i les cel·les en tres columnes. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <div style={{
        writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', flexShrink: 0, width: 16,
        fontSize: 9, color: C.accent, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
        borderRight: `2px solid ${C.accent}55`, paddingRight: 2,
      }}>
        {title}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', columnGap: 12, rowGap: 6 }}>
        {children}
      </div>
    </div>
  );
}

// ── Carrusel de diapositives ─────────────────────────────────────────────────
const THUMB_W = 56;
const THUMB_H = 32;
const THUMB_GAP = 5;
const SLIDE_MIME = 'application/x-scene-slide';

function Thumb({ m, i, cur, onGo, onRemove, onMove }: {
  m: SceneMedia; i: number; cur: number;
  onGo: (i: number) => void; onRemove: (i: number) => void; onMove: (from: number, to: number) => void;
}) {
  const [hover, setHover] = useState(false);
  const isCur = i === cur;
  const isNext = i === cur + 1;
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
      title={isCur ? 'Es veu ara' : `${isNext ? 'La següent. ' : ''}Clic per passar-hi, arrossega per canviar l'ordre`}
      style={{
        position: 'relative', width: THUMB_W, height: THUMB_H, flexShrink: 0, borderRadius: 3, overflow: 'hidden', cursor: 'pointer', background: '#000',
        outline: isCur ? `2px solid ${C.accent}` : isNext ? '1px solid rgba(255,255,255,0.45)' : 'none', outlineOffset: isCur ? -2 : -1,
        opacity: i < cur ? 0.4 : isCur ? 1 : 0.8, boxShadow: isCur ? `0 0 8px ${C.accent}66` : 'none',
        transform: isCur ? 'scale(1.08)' : 'none', transition: 'transform 0.15s, opacity 0.15s',
      }}>
      {m.mimeType.startsWith('video/')
        ? <video src={`${m.url}#t=0.1`} muted preload="metadata" playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={m.url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />}
      {hover && (
        <button onClick={e => { e.stopPropagation(); onRemove(i); }} aria-label="Treure aquesta imatge" title="Treure"
          style={{ position: 'absolute', top: 1, right: 1, width: 13, height: 13, lineHeight: '11px', padding: 0, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 11, cursor: 'pointer' }}>×</button>
      )}
    </div>
  );
}

/**
 * Pestanya «Escena» del panell «Mostrar als jugadors»: imatges o vídeos de fons (en
 * diapositives) + text en subtítols, sempre frase a frase. De dalt a baix: la configuració
 * (Text · Imatge, en files compactes), l'escenari (la previsualització, tal com ho veuran
 * els jugadors), el carrusel de les imatges, el text i els botons. Tot ha de cabre sense
 * scroll en una pantalla de 1920×1080 a escala 125 % (uns 720 px d'alçada útil).
 *
 * L'escenari té dos blocs, com l'esquema del DM: el **de la imatge** (clic = la següent)
 * i el **del text** (la franja dels subtítols; clic = avançar el text). Arrossegar mou la
 * imatge i la roda hi fa zoom. Sense imatge, el text surt a pantalla completa i la
 * «posició» dels subtítols passa a ser l'alineació (dalt = L, baix = R).
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

  // Carrusel: la imatge d'ara sempre al centre de la finestra (el carrusel n'ocupa tota
  // l'amplada i els separadors del 50 % ho permeten també per a la primera i l'última);
  // les anteriors a l'esquerra, les següents i el «+» a la dreta.
  useEffect(() => {
    const strip = stripRef.current; if (!strip) return;
    const el = strip.querySelector<HTMLElement>(`[data-slide="${sc.cur}"]`); if (!el) return;
    strip.scrollTo({ left: el.offsetLeft - strip.offsetLeft - (strip.clientWidth - THUMB_W) / 2, behavior: 'smooth' });
    // (Sense imatges, el «+» és el que queda al centre.)
  }, [sc.cur, n, sc.open]);

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
  // Amb imatge, la posició dels subtítols; sense, l'alineació del text (dalt = L, baix = R).
  // Els botons no es mouen ni canvien de mida: només canvia el que hi diu.
  const placeItems: [SceneOpts['place'], string][] = hasMedia
    ? [['top', 'Dalt'], ['center', 'Centre'], ['bottom', 'Baix']]
    : [['top', 'L'], ['center', 'Centre'], ['bottom', 'R']];

  return (
    <div style={{
      position: 'absolute', top: 12, left: 12, zIndex: 20, width, maxWidth: 'calc(100% - 24px)', maxHeight: 'calc(100% - 24px)',
      display: sc.open ? 'flex' : 'none', flexDirection: 'column', background: 'rgba(13,17,23,0.97)', border: `1px solid ${C.border}`,
      borderRadius: RADIUS.lg, boxShadow: '0 8px 32px rgba(0,0,0,0.7)', overflow: 'hidden',
    }}>
      {header}

      {/* Columna central: si falta alçada, s'encongeix la caixa de text (no surt scroll). */}
      <div style={{ overflowY: 'auto', minHeight: 0, flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>
        {/* ── Configuració: dos grups (Text · Imatge) en una graella de tres columnes ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '7px 12px 8px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <Group title="Text">
            <Cell label="Velocitat" value={speedLabel(sc.speed)}>
              <input type="range" min={1} max={100} value={sc.speed} onChange={e => sc.setSpeed(+e.target.value)} aria-label="Velocitat" style={{ width: '100%', margin: 0, accentColor: C.accent }} />
            </Cell>
            <Cell label="Suavitat" value={smoothLabel(sc.smooth)}>
              <input type="range" min={1} max={100} value={sc.smooth} onChange={e => sc.setSmooth(+e.target.value)} aria-label="Suavitat" style={{ width: '100%', margin: 0, accentColor: C.accent }} />
            </Cell>
            <Cell label="Ritme">
              <Toggle on={sc.dramatic} onClick={() => sc.setDramatic(!sc.dramatic)} title="Pausa en acabar cada frase i cada paràgraf">Pauses</Toggle>
              <Toggle on={sc.manual} onClick={() => sc.setManual(!sc.manual)} title="Revelar frase a frase (Espai o clic al bloc del text)">Manual</Toggle>
            </Cell>
            <Cell label="Posició">
              <Seg value={o.place} onChange={v => setO({ place: v })} items={placeItems}
                title={hasMedia ? 'On surten els subtítols sobre la imatge' : 'Sense imatge: alineació del text a pantalla completa (L = esquerra, R = dreta)'} />
            </Cell>
            <Cell label="Mida">
              <Seg value={o.size} onChange={v => setO({ size: v })} title="Mida de la lletra" items={[['s', 'S'], ['m', 'M'], ['l', 'L']]} />
            </Cell>
            <Cell label="Fons">
              <Toggle on={o.band} onClick={() => setO({ band: !o.band })} title="Franja fosca darrere els subtítols (per llegir-los sobre imatges clares)">Franja</Toggle>
            </Cell>
          </Group>
          <div style={{ height: 1, background: C.border, marginLeft: 26 }} />
          <Group title="Imatge">
            <Cell label="Ajust">
              <Seg value={o.fit} onChange={v => setO({ fit: v })} title="Encaixar: la imatge sencera. Omplir: cobreix tota la pantalla (en retalla les vores)"
                items={[['contain', 'Encaixar'], ['cover', 'Omplir']]} />
            </Cell>
            <Cell label="Càmera">
              <Toggle on={o.kenBurns} onClick={() => setO({ kenBurns: !o.kenBurns })} title="Moviment lent de càmera (Ken Burns)">Moviment</Toggle>
              <Btn onClick={sc.restartMotion} disabled={!hasMedia} title="Recentrar: treu el zoom i el desplaçament i torna a començar el moviment">Recentra</Btn>
            </Cell>
            <Cell label="Diapositives">
              <Toggle on={sc.loop} onClick={() => sc.setLoop(!sc.loop)} title="Després de l'última imatge, tornar a la primera">Bucle</Toggle>
              <Btn onClick={sc.clearSlides} disabled={!n} title="Treure totes les imatges: el text passa a pantalla completa">Buida</Btn>
            </Cell>
          </Group>
        </div>

        {/* ── Escenari: bloc de la imatge + bloc del text ── */}
        <div
          ref={stageRef}
          style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', flexShrink: 0, background: '#000', cursor: 'pointer', userSelect: 'none' }}
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
            {/* Progrés del text: una línia a la vora de baix de l'escenari */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }}>
              <div ref={progRef} style={{ height: '100%', width: '0%', background: C.accent, opacity: 0.8 }} />
            </div>
          </SceneStage>
        </div>
        <input ref={inputRef} type="file" accept="image/*,video/*" multiple aria-label="Imatges o vídeos de l'escena" style={{ display: 'none' }}
          onChange={e => { if (e.target.files) sc.addFiles(e.target.files); e.target.value = ''; }} />

        {/* ── Carrusel: la imatge d'ara al centre de la finestra; «+» és la diapositiva que encara no hi és ── */}
        <div onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }} onDrop={dropFiles}
          style={{ padding: '4px 0', flexShrink: 0, borderTop: `1px solid ${C.border}`, background: 'rgba(0,0,0,0.25)' }}>
          <div ref={stripRef} style={{ display: 'flex', alignItems: 'center', gap: THUMB_GAP, overflowX: 'auto', height: THUMB_H + 6, scrollbarWidth: 'none' }}>
            <span style={{ flex: `0 0 calc(50% - ${THUMB_W / 2 + THUMB_GAP}px)` }} />
            {sc.slides.map((m, i) => (
              <Thumb key={m.id} m={m} i={i} cur={sc.cur} onGo={sc.goTo} onRemove={sc.removeSlide} onMove={sc.moveSlide} />
            ))}
            <button data-slide={n} onClick={() => inputRef.current?.click()}
              title="Afegir imatges o vídeos (també es poden arrossegar aquí o a l'escenari)"
              style={{ width: THUMB_W, height: THUMB_H, flexShrink: 0, borderRadius: 3, border: `1px dashed ${n ? C.border : C.dim}`, background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: FS.lg, lineHeight: 1, padding: 0 }}>+</button>
            <span style={{ flex: `0 0 calc(50% - ${THUMB_W / 2 + THUMB_GAP}px)` }} />
          </div>
        </div>

        {/* ── Text ── */}
        <textarea
          value={sc.text}
          onChange={e => sc.setText(e.target.value)}
          placeholder={'Text dels subtítols… Cada frase és un subtítol.'}
          style={{ width: '100%', flex: '1 1 84px', minHeight: 50, resize: 'none', border: 'none', borderTop: `1px solid ${C.border}`, outline: 'none', background: 'rgba(255,255,255,0.02)', color: C.text, fontFamily: FONT_SERIF, fontSize: FS.lg, lineHeight: 1.45, padding: '7px 12px', display: 'block' }}
        />
      </div>

      {/* ── Botons (amb l'estat del text) ── */}
      <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, borderTop: `1px solid ${C.border}` }}>
        <button ref={playBtnRef} onClick={sc.primary}
          style={{ padding: '7px 12px', borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', color: C.text, cursor: 'pointer', fontWeight: 700, fontSize: FS.sm }}>
          Comença
        </button>
        <button onClick={sc.reset}
          style={{ padding: '7px 10px', borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: FS.sm }}>
          Reinicia
        </button>
        <span ref={counterRef} style={{ flex: 1, minWidth: 0, fontSize: FS.xs, color: C.dim, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>—</span>
        <button onClick={sc.show} disabled={!canShow}
          style={{ padding: '7px 12px', borderRadius: RADIUS.md, border: 'none', background: canShow ? C.accent : 'rgba(255,255,255,0.05)', color: canShow ? C.onAccent : C.dim, cursor: canShow ? 'pointer' : 'default', fontWeight: 700, fontSize: FS.sm, display: 'flex', alignItems: 'center', gap: 6 }}>
          {sc.active ? <><CheckIcon size={13} /> Mostrant als jugadors</> : <><PlayIcon size={12} /> Mostrar als jugadors</>}
        </button>
        <button onClick={sc.hide} disabled={!sc.active}
          style={{ padding: '7px 10px', borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: 'transparent', cursor: sc.active ? 'pointer' : 'default', color: sc.active ? C.dim : 'rgba(255,255,255,0.15)', fontSize: FS.sm }}>
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
