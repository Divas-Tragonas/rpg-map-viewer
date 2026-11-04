'use client';
/**
 * Forja de figuretes (`lib/sprites/kit.ts`): vestir el maniquí amb armadura, casc, arma i escut.
 * - `ForgeControls`: els selectors (Biblioteca i menú del clic dret d'un token de la Forja).
 * - `ForgePreview`: la figureta animada.
 * - `ForgeSection`: secció de la Biblioteca per crear-ne, afegir-les a l'escena i desar-les.
 */
import React, { useEffect, useRef, useState } from 'react';
import { C, FS, RADIUS } from '@/constants';
import { Button } from '@/components/ui/Button';
import { SidebarSection } from '@/components/ui/SidebarSection';
import { HammerIcon, X } from '@/components/icons';
import { DEFAULT_KIT, KIT_OPTIONS, kitLabel, kitSprite, parseKit, type KitRecipe } from '@/lib/sprites/kit';
import { creatureFrame, drawCreature, TILE } from '@/lib/sprites/draw';
import { ensurePack } from '@/lib/sprites/pack';
import { useSpritePack } from '@/hooks/useSpritePack';
import { useJsonStore } from '@/lib/localStore';
import { forgeStore, forgedTemplate, removeForged, saveForged } from '@/lib/forge-store';
import type { EnemyTemplate } from '@/lib/bestiary';

const field: React.CSSProperties = {
  height: 24, minWidth: 0, width: '100%', boxSizing: 'border-box', padding: '0 4px', borderRadius: RADIUS.sm,
  border: `1px solid ${C.border}`, background: C.dark, color: C.bright, fontSize: FS.sm, outline: 'none',
};
const label: React.CSSProperties = { fontSize: FS.xs, color: C.dim, alignSelf: 'center' };

const ROWS: { key: keyof KitRecipe; label: string; when?: (r: KitRecipe) => boolean }[] = [
  { key: 'base', label: 'Cos' },
  { key: 'armor', label: 'Armadura' },
  { key: 'helm', label: 'Casc' },
  { key: 'weapon', label: 'Arma' },
  { key: 'metal', label: 'Metall', when: r => r.weapon !== 'none' },
  { key: 'shield', label: 'Escut' },
  { key: 'shieldMat', label: 'Material', when: r => r.shield !== 'none' },
];

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

/** Recepta a l'atzar, coherent: el casc del mateix joc que l'armadura quasi sempre. */
export function randomKit(): KitRecipe {
  const armor = pick(KIT_OPTIONS.armor.filter(o => o.id !== 'none')).id;
  const helms = KIT_OPTIONS.helm.map(o => o.id);
  return {
    base: pick(KIT_OPTIONS.base).id, armor,
    helm: Math.random() < 0.75 && helms.includes(armor) ? armor : pick(helms),
    weapon: pick(KIT_OPTIONS.weapon.filter(o => o.id !== 'none')).id,
    metal: Math.random() < 0.7 ? 'steel' : pick(KIT_OPTIONS.metal).id,
    shield: pick(KIT_OPTIONS.shield).id, shieldMat: pick(KIT_OPTIONS.shieldMat).id,
  };
}

export function ForgeControls({ recipe, onChange }: { recipe: KitRecipe; onChange: (r: KitRecipe) => void }) {
  const set = (key: keyof KitRecipe, value: string) => {
    const next = { ...recipe, [key]: value };
    // Canviar l'armadura arrossega el casc si anava a joc (el cas habitual: «tot d'or»).
    if (key === 'armor' && recipe.helm === recipe.armor && KIT_OPTIONS.helm.some(o => o.id === value)) next.helm = value;
    onChange(next);
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '4px 8px' }}>
      {ROWS.filter(r => !r.when || r.when(recipe)).map(r => (
        <React.Fragment key={r.key}>
          <label htmlFor={`forja-${r.key}`} style={label}>{r.label}</label>
          <select id={`forja-${r.key}`} value={recipe[r.key]} onChange={e => set(r.key, e.target.value)} style={field}
            onMouseDown={e => e.stopPropagation()}>
            {KIT_OPTIONS[r.key].map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </React.Fragment>
      ))}
    </div>
  );
}

/** Figureta animada (animació d'espera), a escala entera. */
export function ForgePreview({ sprite, scale = 2 }: { sprite: string; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pack = useSpritePack();
  useEffect(() => { ensurePack().catch(() => {}); }, []);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const c = ref.current; const g = c?.getContext('2d');
      if (c && g) {
        g.clearRect(0, 0, c.width, c.height);
        drawCreature(g, sprite, creatureFrame(performance.now()), 0, 0, c.width);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sprite, pack]);
  const size = TILE * scale;
  return <canvas ref={ref} width={size} height={size} aria-label="Previsualització de la figureta"
    style={{ width: size, height: size, imageRendering: 'pixelated', background: C.dark, borderRadius: RADIUS.sm, border: `1px solid ${C.border}`, flexShrink: 0 }} />;
}

function NumInput({ value, onChange, label: l, min }: { value: number; onChange: (n: number) => void; label: string; min: number }) {
  // Aplica en confirmar (Enter o perdre el focus), com `NumField`: esborrar per reescriure no ha de deixar 0.
  const [draft, setDraft] = useState(String(value));
  const commit = () => { const n = Math.max(min, Math.round(Number(draft) || min)); onChange(n); setDraft(String(n)); };
  return (
    <input aria-label={l} title={l} inputMode="numeric" value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); }} style={{ ...field, textAlign: 'right' }} />
  );
}

export function ForgeSection({ onAdd }: { onAdd: (tmpl: EnemyTemplate) => void }) {
  const [recipe, setRecipe] = useState<KitRecipe>(DEFAULT_KIT);
  const [name, setName] = useState('');
  const [hp, setHp] = useState(11);
  const [xp, setXp] = useState(25);
  const [ally, setAlly] = useState(false);
  const saved = useJsonStore(forgeStore);
  const sprite = kitSprite(recipe);
  const figure = () => ({ name: name.trim() || kitLabel(recipe), sprite, hpMax: hp, xp: ally ? 0 : xp, ally });

  return (
    <SidebarSection title="Forja" icon={<HammerIcon size={13} />} count={saved.length} defaultOpen={false} bodyPadding="0 8px 8px">
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 2 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
          <ForgePreview sprite={sprite} />
          <Button size="sm" variant="ghost" onClick={() => setRecipe(randomKit())} title="Una combinació a l'atzar">A l&apos;atzar</Button>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}><ForgeControls recipe={recipe} onChange={setRecipe} /></div>
      </div>
      <input value={name} onChange={e => setName(e.target.value)} placeholder={kitLabel(recipe)} aria-label="Nom" maxLength={60}
        style={{ ...field, marginTop: 8 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 48px auto 48px minmax(0, 1fr)', gap: '4px 6px', marginTop: 6, alignItems: 'center' }}>
        <span style={label}>Vida</span>
        <NumInput key={`hp${hp}`} label="Vida" value={hp} onChange={setHp} min={1} />
        <span style={label}>XP</span>
        <NumInput key={`xp${ally ? 0 : xp}`} label="XP" value={ally ? 0 : xp} onChange={setXp} min={0} />
        <label style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end', fontSize: FS.sm, color: C.text }}>
          <input type="checkbox" checked={ally} onChange={e => setAlly(e.target.checked)} /> Aliat
        </label>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
        <Button size="sm" variant="secondary" onClick={() => saveForged(figure())} title="Desar-la al bestiari (grup Forja)">Desar</Button>
        <Button size="sm" variant="primary" onClick={() => onAdd(forgedTemplate(figure()))}>Afegir a l&apos;escena</Button>
      </div>
      {saved.length > 0 && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>
          <div style={{ fontSize: FS.xs, color: C.dim, marginBottom: 4 }}>Desades (surten al bestiari, al grup Forja)</div>
          {saved.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: FS.sm, color: C.text, padding: '2px 0' }}>
              <button onClick={() => { const r = parseKit(f.sprite); if (r) { setRecipe(r); setName(f.name); setHp(f.hpMax); setXp(f.xp); setAlly(f.ally); } }}
                title="Tornar-la a obrir a la Forja"
                style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', color: C.text, cursor: 'pointer', padding: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: FS.sm }}>
                {f.name}
              </button>
              <button onClick={() => removeForged(f.id)} title={`Eliminar ${f.name}`} aria-label={`Eliminar ${f.name}`}
                style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', padding: 2, display: 'flex' }}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </SidebarSection>
  );
}
