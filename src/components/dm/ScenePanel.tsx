'use client';
import React, { useEffect, useRef } from 'react';
import { C, FS, RADIUS, FONT_SERIF } from '@/constants';
import { ImageIcon, CheckIcon, PlayIcon } from '@/components/icons';
import { SceneStage } from '@/components/scene/SceneStage';
import { speedLabel, smoothLabel } from '@/lib/textreveal';
import type { SceneShowApi } from '@/hooks/useSceneShow';
import type { SceneOpts } from '@/lib/scene';

// ── Peces petites de la barra d'opcions ──────────────────────────────────────
function Seg<T extends string>({ value, onChange, items, title }: {
  value: T; onChange: (v: T) => void; items: [T, string][]; title?: string;
}) {
  return (
    <div title={title} style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: RADIUS.md, overflow: 'hidden', flexShrink: 0 }}>
      {items.map(([v, label], i) => (
        <button key={v} onClick={() => onChange(v)} aria-pressed={value === v}
          style={{
            padding: '3px 7px', border: 'none', borderLeft: i ? `1px solid ${C.border}` : 'none', cursor: 'pointer',
            background: value === v ? `${C.accent}22` : 'transparent', color: value === v ? C.accent : C.dim,
            fontSize: FS.xs, fontWeight: 700, whiteSpace: 'nowrap',
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
        padding: '3px 8px', borderRadius: RADIUS.md, border: `1px solid ${on ? C.accent : C.border}`, flexShrink: 0,
        background: on ? `${C.accent}18` : 'transparent', color: on ? C.accent : C.dim,
        cursor: 'pointer', fontSize: FS.xs, fontWeight: 700, whiteSpace: 'nowrap',
      }}>
      {children}
    </button>
  );
}

function MiniBtn({ onClick, children, title, disabled }: { onClick: () => void; children: React.ReactNode; title?: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      style={{
        padding: '3px 8px', borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: 'transparent', flexShrink: 0,
        color: disabled ? 'rgba(255,255,255,0.18)' : C.dim, cursor: disabled ? 'default' : 'pointer', fontSize: FS.xs, fontWeight: 600, whiteSpace: 'nowrap',
      }}>
      {children}
    </button>
  );
}

function Slider({ label, value, valueLabel, onChange }: { label: string; value: number; valueLabel: string; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, fontSize: FS.xs, color: C.dim }} title={`${label}: ${valueLabel}`}>
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
      <input type="range" min={1} max={100} value={value} onChange={e => onChange(+e.target.value)}
        style={{ flex: 1, minWidth: 40, accentColor: C.accent }} />
      <b style={{ color: C.text, fontWeight: 600, whiteSpace: 'nowrap', minWidth: 52 }}>{valueLabel}</b>
    </label>
  );
}

const ROW: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const ROW_LABEL: React.CSSProperties = { fontSize: FS.xs, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', width: 62, flexShrink: 0 };

/**
 * Pestanya «Escena» del panell «Mostrar als jugadors»: imatge o vídeo de fons + text en
 * subtítols. De dalt a baix: opcions compactes, l'escenari (la previsualització, tal com
 * ho veuran els jugadors: la imatge l'omple sencer i el text hi va a sobre), l'estat, el
 * text i els botons. Sense imatge, el text surt a pantalla completa (com el Revelador).
 *
 * Està sempre muntada (amagada quan no és la pestanya oberta): el motor de text hi té els
 * seus spans i l'escena continua als jugadors encara que es tanqui el panell.
 */
export function ScenePanel({ sc, header, width, onFileDropped }: {
  sc: SceneShowApi;
  header: React.ReactNode;
  width: number;
  /** El fitxer s'ha deixat a l'escenari (DMView neteja el seu indicador de «deixa'l aquí»). */
  onFileDropped: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // Els refs de l'escenari a part: si no, la regla `react-hooks/refs` pren tot `sc` per un ref.
  const { mediaInnerRef, boxRef, textRef, sizeRef, counterRef, progRef, playBtnRef } = sc.refs;
  const hasMedia = !!sc.media;
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

  const canShow = hasMedia || sc.text.trim().length > 0;

  return (
    <div style={{
      position: 'absolute', top: 12, left: 12, zIndex: 20, width, maxWidth: 'calc(100% - 24px)', maxHeight: 'calc(100% - 24px)',
      display: sc.open ? 'flex' : 'none', flexDirection: 'column', background: 'rgba(13,17,23,0.97)', border: `1px solid ${C.border}`,
      borderRadius: RADIUS.lg, boxShadow: '0 8px 32px rgba(0,0,0,0.7)', overflow: 'hidden',
    }}>
      {header}

      <div style={{ overflowY: 'auto', minHeight: 0 }}>
        {/* Opcions compactes */}
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 7, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Slider label="Velocitat" value={sc.speed} valueLabel={speedLabel(sc.speed)} onChange={sc.setSpeed} />
            <Toggle on={sc.dramatic} onClick={() => sc.setDramatic(!sc.dramatic)} title="Pausa en acabar cada frase i cada paràgraf">Pauses</Toggle>
            <span style={{ width: 1, alignSelf: 'stretch', background: C.border, margin: '0 2px' }} />
            <Slider label="Suavitat" value={sc.smooth} valueLabel={smoothLabel(sc.smooth)} onChange={sc.setSmooth} />
            <Toggle on={sc.manual} onClick={() => sc.setManual(!sc.manual)} title="Revelar frase a frase (Espai o clic a l'escenari)">Manual</Toggle>
          </div>
          <div style={ROW}>
            <span style={ROW_LABEL}>Subtítols</span>
            <Seg value={o.place} onChange={v => setO({ place: v })} title="On surten els subtítols"
              items={[['bottom', 'Baix'], ['center', 'Centre'], ['top', 'Dalt']]} />
            <Seg value={o.size} onChange={v => setO({ size: v })} title="Mida de la lletra"
              items={[['s', 'S'], ['m', 'M'], ['l', 'L']]} />
            <Toggle on={o.band} onClick={() => setO({ band: !o.band })} title="Franja fosca darrere el text (per llegir-lo sobre imatges clares)">Franja</Toggle>
            <Seg value={o.flow} onChange={v => setO({ flow: v })} title="Frase a frase: només es veu la frase d'ara. Continu: el text s'acumula"
              items={[['sentence', 'Frase a frase'], ['flow', 'Continu']]} />
          </div>
          <div style={ROW}>
            <span style={ROW_LABEL}>Imatge</span>
            <Seg value={o.fit} onChange={v => setO({ fit: v })} title="Encaixar: la imatge sencera. Omplir: cobreix tota la pantalla (en retalla les vores)"
              items={[['contain', 'Encaixar'], ['cover', 'Omplir']]} />
            <Toggle on={o.kenBurns} onClick={() => setO({ kenBurns: !o.kenBurns })} title="Moviment lent de càmera (Ken Burns)">Moviment</Toggle>
            <MiniBtn onClick={sc.restartMotion} disabled={!hasMedia} title="Treu el zoom i el desplaçament i torna a començar el moviment">↺ Recentra</MiniBtn>
            <span style={{ flex: 1 }} />
            <MiniBtn onClick={() => inputRef.current?.click()} title="Triar una imatge o un vídeo">{hasMedia ? 'Canvia…' : 'Imatge…'}</MiniBtn>
            <MiniBtn onClick={sc.clearMedia} disabled={!hasMedia} title="Treure la imatge: el text passa a pantalla completa">Treu</MiniBtn>
          </div>
        </div>

        {/* Escenari: previsualització 16:9 (blocs 1 i 2: imatge sencera + subtítols) */}
        <div
          ref={stageRef}
          style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#000', cursor: hasMedia ? 'grab' : (sc.manual ? 'pointer' : 'default'), userSelect: 'none' }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault(); e.stopPropagation(); onFileDropped();
            const f = e.dataTransfer.files[0]; if (f) sc.loadFile(f);
          }}
          onMouseDown={e => {
            if (e.button !== 0) return;
            e.preventDefault();
            dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
          }}
          onMouseMove={e => {
            const d = dragRef.current; if (!d) return;
            const dx = e.clientX - d.x, dy = e.clientY - d.y;
            if (!d.moved && Math.hypot(dx, dy) < 4) return;
            d.moved = true;
            if (hasMedia) sc.panBy(dx, dy);
            d.x = e.clientX; d.y = e.clientY;
          }}
          onMouseUp={() => {
            const d = dragRef.current; dragRef.current = null;
            if (d && !d.moved && sc.manual) sc.nextSentence();
          }}
          onMouseLeave={() => { dragRef.current = null; }}
        >
          <SceneStage mediaUrl={sc.media?.url ?? null} mimeType={sc.media?.mimeType ?? null} hasMedia={hasMedia} opts={o}
            mediaInnerRef={mediaInnerRef} boxRef={boxRef} textRef={textRef} sizeRef={sizeRef}>
            {!hasMedia && (
              <button onClick={() => inputRef.current?.click()} onMouseDown={e => e.stopPropagation()}
                title="Arrossega o tria una imatge o un vídeo de fons"
                style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: RADIUS.md, border: `1px dashed ${C.border}`, background: 'rgba(0,0,0,0.45)', color: C.dim, fontSize: FS.xs, fontWeight: 600, cursor: 'pointer' }}>
                <ImageIcon size={13} color={C.dim} /> Imatge o vídeo
              </button>
            )}
            {!hasMedia && !sc.text.trim() && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'rgba(255,255,255,0.32)', fontSize: FS.sm, lineHeight: 1.6, pointerEvents: 'none', padding: 20 }}>
                Arrossega aquí una imatge o un vídeo de fons<br />i escriu el text a sota.<br />Sense imatge, el text surt a pantalla completa.
              </div>
            )}
            {hasMedia && (
              <div style={{ position: 'absolute', top: 6, right: 8, color: 'rgba(255,255,255,0.35)', fontSize: FS.xs, pointerEvents: 'none', letterSpacing: '0.06em', textShadow: '0 1px 3px #000' }}>
                roda: zoom · arrossega: mou
              </div>
            )}
          </SceneStage>
        </div>
        <input ref={inputRef} type="file" accept="image/*,video/*" aria-label="Imatge o vídeo de l'escena" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) sc.loadFile(f); e.target.value = ''; }} />

        {/* Estat */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, fontSize: FS.sm, color: C.dim }}>
          <span ref={counterRef} style={{ minWidth: 80 }}>—</span>
          <div style={{ flex: 1, height: 3, background: C.border, borderRadius: RADIUS.sm, overflow: 'hidden' }}>
            <div ref={progRef} style={{ height: '100%', width: '0%', background: C.text }} />
          </div>
        </div>

        {/* Text (a sota de tot) */}
        <textarea
          value={sc.text}
          onChange={e => sc.setText(e.target.value)}
          placeholder={'Text dels subtítols…\n\nCada frase és un subtítol (en mode «Frase a frase»).'}
          style={{ width: '100%', height: 96, resize: 'vertical', border: 'none', outline: 'none', background: 'rgba(255,255,255,0.02)', color: C.text, fontFamily: FONT_SERIF, fontSize: FS.lg, lineHeight: 1.5, padding: '10px 12px', display: 'block' }}
        />
      </div>

      {/* Botons */}
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
