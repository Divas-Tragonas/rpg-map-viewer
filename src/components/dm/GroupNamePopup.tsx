'use client';
import React, { useEffect, useRef, useState } from 'react';
import { C, FS, RADIUS, SHADOW } from '@/constants';
import { Button } from '@/components/ui/Button';
import { LinkIcon } from '@/components/icons';

const W = 240;

/**
 * Finestreta flotant que surt just després de crear un grup, allà on s'ha clicat, per posar-li nom.
 * El nom per defecte ja hi és (és el del grup): Enter l'accepta, Esc el deixa tal qual i clicar
 * fora també. Mai no queda un grup sense nom.
 */
export function GroupNamePopup({ x, y, initial, onDone }: {
  x: number; y: number; initial: string; onDone: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const nameRef = useRef(name);
  nameRef.current = name;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const closed = useRef(false);
  const finish = (n: string) => { if (closed.current) return; closed.current = true; doneRef.current(n); };

  // Enfocar i seleccionar el text un instant després (el clic que l'ha obert encara s'està acabant).
  useEffect(() => {
    const t = window.setTimeout(() => { input.current?.focus(); input.current?.select(); }, 30);
    return () => window.clearTimeout(t);
  }, []);

  // Clicar fora accepta el nom que hi hagi.
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!(e.target instanceof Node) || !ref.current?.contains(e.target)) finish(nameRef.current); };
    window.addEventListener('pointerdown', down, true);
    return () => window.removeEventListener('pointerdown', down, true);
  }, []);

  const left = Math.max(8, Math.min(x, window.innerWidth - W - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - 110));
  return (
    <div ref={ref} role="dialog" aria-label="Nom del grup" onMouseDown={e => e.stopPropagation()}
      style={{ position: 'fixed', left, top, width: W, zIndex: 40, background: C.panel, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.menu, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FS.sm, color: C.dim, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        <LinkIcon size={12} /> Nom del grup
      </span>
      <input ref={input} value={name} maxLength={40} aria-label="Nom del grup"
        onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          e.stopPropagation();
          if (e.key === 'Enter') { e.preventDefault(); finish(name); }
          else if (e.key === 'Escape') { e.preventDefault(); finish(name); }
        }}
        style={{ background: C.dark, color: C.bright, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, fontSize: FS.md, padding: '6px 8px', minWidth: 0, boxSizing: 'border-box' }} />
      <Button size="md" variant="primary" onClick={() => finish(name)}>Acceptar (Enter)</Button>
    </div>
  );
}
