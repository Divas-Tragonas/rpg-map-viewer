'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { C, FS, RADIUS, SHADOW, FONT_SERIF, tint } from '@/constants';
import { Button } from '@/components/ui/Button';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { X, DieIcon } from '@/components/icons';
import { useSpritePack } from '@/hooks/useSpritePack';
import { creatureNames, creatureThumb, drawFace, FACE_COUNT, parseSprite } from '@/lib/sprites/draw';
import { PORTRAIT_CATEGORIES, partLabel, randomPortrait, drawPortrait, portraitDataUrl, type PortraitChoice } from '@/lib/sprites/portrait';
import { drawPortraitPart } from '@/lib/sprites/draw';

/**
 * Finestra modal dins del menú del clic dret d'un token. Porta `data-ctxmenu` perquè el
 * clic a dins no tanqui el menú, i l'Esc es captura abans que el del menú (només tanca
 * aquesta finestra).
 */
function Modal({ title, width, onClose, children }: { title: string; width: number; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  // Al `body` (portal): dins del menú del clic dret, que fa scroll, Safari d'iOS retallava la
  // finestra a la mida del menú en lloc de la pantalla.
  return createPortal(
    <div data-ctxmenu style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width, maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100dvh - 48px)', display: 'flex', flexDirection: 'column', background: C.panel, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.menu }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px 8px 14px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ flex: 1, fontFamily: FONT_SERIF, fontSize: 18, fontWeight: 600, color: C.bright }}>{title}</span>
          <button onClick={onClose} aria-label="Tancar" style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

const nice = (n: string) => n.replace(/_/g, ' ');

/** Tria de figureta (criatura del paquet Oryx) per a un token. */
export function SpritePicker({ value, onPick, onClose }: { value?: string; onPick: (s: string | undefined) => void; onClose: () => void }) {
  useSpritePack();
  const [q, setQ] = useState('');
  const all = useMemo(() => creatureNames(), []);
  const list = all.filter(n => nice(n).includes(q.trim().toLowerCase()));
  // Tornar a triar la mateixa criatura en conserva la variant de color.
  const base = value ? parseSprite(value).name : undefined;
  return (
    <Modal title="Figureta del token" width={520} onClose={onClose}>
      <div style={{ padding: 10, display: 'flex', gap: 8, borderBottom: `1px solid ${C.border}` }}>
        {/* Al mòbil, el focus automàtic obriria el teclat i desplaçaria la pàgina (el menú semblava moure's). */}
        <input autoFocus={!matchMedia('(pointer: coarse)').matches} value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca (goblin, wizard, dragon…)"
          style={{ flex: 1, height: 28, padding: '0 8px', borderRadius: RADIUS.sm, border: `1px solid ${C.border}`, background: C.dark, color: C.bright, fontSize: FS.md, outline: 'none' }} />
        <Button size="sm" variant="ghost" onClick={() => { onPick(undefined); onClose(); }}>Sense figureta</Button>
      </div>
      <ScrollArea style={{ flex: 1, minHeight: 0, maxHeight: 460 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 4, padding: 10 }}>
          {list.map(n => {
            const on = n === base;
            const th = creatureThumb(n);
            return (
              <button key={n} onClick={() => { onPick(on ? value : n); onClose(); }} title={nice(n)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: 4, borderRadius: RADIUS.sm, cursor: 'pointer', border: `1px solid ${on ? C.accent : C.border}`, background: on ? tint(C.accent, 0.12) : C.dark }}>
                {th ? <img src={th} alt="" style={{ width: 48, height: 48, imageRendering: 'pixelated' }} /> : <div style={{ width: 48, height: 48 }} />}
                <span style={{ fontSize: FS.xs, color: on ? C.accent : C.dim, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nice(n)}</span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </Modal>
  );
}

/** Miniatura d'una peça de retrat sobre el cap triat (per veure com queda). */
function PartThumb({ part, base }: { part: string | null; base: PortraitChoice }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d')!; ctx.clearRect(0, 0, 48, 48);
    if (part) {
      if (base.head && !part.startsWith('head_') && part !== 'ghostly_female') drawPortraitPart(ctx, base.head, 0, 0, 48);
      drawPortraitPart(ctx, part, 0, 0, 48);
    }
  }, [part, base.head]);
  return <canvas ref={ref} width={48} height={48} style={{ width: 40, height: 40, imageRendering: 'pixelated', display: 'block' }} />;
}

/** Generador de retrats d'un jugador: un dels 36 fets o compost per peces. */
export function PortraitBuilder({ onPick, onClose }: { onPick: (url: string | undefined) => void; onClose: () => void }) {
  useSpritePack();
  const [tab, setTab] = useState<'fets' | 'compondre'>('fets');
  const [choice, setChoice] = useState<PortraitChoice>(() => randomPortrait());
  const [cat, setCat] = useState(PORTRAIT_CATEGORIES[1].id);
  const preview = useRef<HTMLCanvasElement>(null);
  const faces = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = preview.current; if (!c) return;
    const ctx = c.getContext('2d')!; ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, c.width, c.height);
    drawPortrait(ctx, choice, 0, 0, c.width);
  }, [choice, tab]);
  useEffect(() => {
    const c = faces.current; if (!c) return;
    const ctx = c.getContext('2d')!; ctx.clearRect(0, 0, c.width, c.height);
    for (let i = 0; i < FACE_COUNT; i++) drawFace(ctx, i, (i % 6) * 52, Math.floor(i / 6) * 52, 48);
  }, [tab]);
  const current = PORTRAIT_CATEGORIES.find(c => c.id === cat)!;
  return (
    <Modal title="Retrat" width={560} onClose={onClose}>
      <div style={{ display: 'flex', gap: 4, padding: '8px 10px', borderBottom: `1px solid ${C.border}` }}>
        <Button size="sm" active={tab === 'fets'} variant="ghost" onClick={() => setTab('fets')}>36 retrats fets</Button>
        <Button size="sm" active={tab === 'compondre'} variant="ghost" onClick={() => setTab('compondre')}>Compondre&apos;n un</Button>
        <div style={{ flex: 1 }} />
        <Button size="sm" variant="ghost" onClick={() => { onPick(undefined); onClose(); }}>Sense retrat</Button>
      </div>
      {tab === 'fets' ? (
        <div style={{ padding: 12, display: 'flex', justifyContent: 'center' }}>
          <canvas ref={faces} width={6 * 52} height={6 * 52} style={{ width: 6 * 52 * 1.5, height: 6 * 52 * 1.5, imageRendering: 'pixelated', cursor: 'pointer' }}
            onClick={e => {
              const r = e.currentTarget.getBoundingClientRect();
              const k = 52 * 1.5;
              const i = Math.floor((e.clientY - r.top) / k) * 6 + Math.floor((e.clientX - r.left) / k);
              if (i >= 0 && i < FACE_COUNT) { onPick(portraitDataUrl({ face: i })); onClose(); }
            }} />
        </div>
      ) : (
        <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
          <div style={{ width: 170, padding: 12, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <canvas ref={preview} width={144} height={144} style={{ width: 144, height: 144, imageRendering: 'pixelated', background: C.dark, borderRadius: RADIUS.sm }} />
            <Button size="sm" variant="secondary" onClick={() => setChoice(randomPortrait())} style={{ gap: 5, width: '100%' }}><DieIcon size={12} /> A l&apos;atzar</Button>
            <Button size="sm" variant="primary" onClick={() => { onPick(portraitDataUrl(choice)); onClose(); }} style={{ width: '100%' }}>Fer servir</Button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', marginTop: 4 }}>
              {PORTRAIT_CATEGORIES.map(c => (
                <Button key={c.id} size="sm" variant="ghost" active={cat === c.id} onClick={() => setCat(c.id)} style={{ justifyContent: 'space-between', height: 24 }}>
                  {c.label}<span style={{ color: C.dim, fontWeight: 500 }}>{choice[c.id] ? '●' : ''}</span>
                </Button>
              ))}
            </div>
          </div>
          <ScrollArea style={{ flex: 1, minHeight: 0, maxHeight: 440 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 10 }}>
              {!current.required && (
                <button onClick={() => setChoice(ch => ({ ...ch, [cat]: null }))} title="Cap"
                  style={{ width: 48, height: 48, borderRadius: RADIUS.sm, cursor: 'pointer', border: `1px solid ${!choice[cat] ? C.accent : C.border}`, background: C.dark, color: C.dim, fontSize: FS.xs }}>cap</button>
              )}
              {current.parts.map(p => (
                <button key={p} onClick={() => setChoice(ch => ({ ...ch, [cat]: p }))} title={partLabel(p)}
                  style={{ padding: 3, borderRadius: RADIUS.sm, cursor: 'pointer', border: `1px solid ${choice[cat] === p ? C.accent : C.border}`, background: choice[cat] === p ? tint(C.accent, 0.12) : C.dark }}>
                  <PartThumb part={p} base={choice} />
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </Modal>
  );
}
