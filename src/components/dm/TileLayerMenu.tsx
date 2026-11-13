'use client';
import React, { useEffect } from 'react';
import { C, FS, RADIUS, SHADOW, tint } from '@/constants';
import { Move, RedoIcon, Trash2 } from '@/components/icons';
import type { TileMenuState, TileMenuAction } from '@/hooks/useTileMap';
import type { LayerOp } from '@/lib/tilemap/layers';

interface Props {
  menu: TileMenuState | null;
  onAction: (a: TileMenuAction) => void;
  onClose: () => void;
}

const MENU_W = 196;

/**
 * Ordre de les capes, amb els noms dels programes d'oficina en català (LibreOffice i Office:
 * «Organitza» → porta al davant / porta endavant / envia enrere / envia al fons).
 */
const LAYER_ITEMS: { op: LayerOp; label: string; hint: string }[] = [
  { op: 'front', label: 'Porta al davant', hint: 'Per sobre de tots els que té a sobre' },
  { op: 'forward', label: 'Porta endavant', hint: 'Una capa amunt' },
  { op: 'backward', label: 'Envia enrere', hint: 'Una capa avall' },
  { op: 'back', label: 'Envia al fons', hint: 'Per sota de tots els que té a sota' },
];

function Item({ label, title, disabled, danger, icon, onClick }: {
  label: string; title?: string; disabled?: boolean; danger?: boolean; icon?: React.ReactNode; onClick: () => void;
}) {
  const [hover, setHover] = React.useState(false);
  const color = disabled ? C.dim : danger ? C.enemy : C.text;
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 10px', border: 'none',
        borderRadius: RADIUS.sm, background: hover && !disabled ? tint(danger ? C.enemy : C.accent, 0.12) : 'transparent',
        color, opacity: disabled ? 0.5 : 1, fontSize: FS.md, textAlign: 'left', cursor: disabled ? 'default' : 'pointer',
      }}>
      <span style={{ width: 14, display: 'inline-flex', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  );
}

/**
 * Menú del clic dret sobre un objecte o un decorat del mapa de caselles (eina Caselles): ordre de les
 * capes, moure, girar i esborrar. Un objecte s'ordena entre els objectes que se li encavalquen i, si
 * toca una paret, també respecte de la paret (pot quedar-hi darrere); un decorat, entre els decorats de
 * la seva casella (els objectes van sempre per sobre dels decorats).
 */
export function TileLayerMenu({ menu, onAction, onClose }: Props) {
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => { if (!(e.target as Element).closest?.('[data-tilemenu]')) onClose(); };
    // Qualsevol tecla el tanca (una drecera pot canviar d'eina); Esc, sense fer res més.
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') e.stopPropagation(); onClose(); };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', esc, true);
    return () => { window.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', esc, true); };
  }, [menu, onClose]);
  if (!menu) return null;
  const what = menu.item.kind === 'object' ? 'Objecte' : 'Decorat';
  const alone = !Object.values(menu.ops).some(Boolean);
  const H = 4 * 31 + 3 * 31 + 80;
  const behind = menu.item.kind === 'object' && !!menu.item.obj.under;
  /** Text de l'ordre quan el pas següent és travessar la paret. */
  const wallHint = (op: LayerOp): string | null => {
    if (op === 'forward' && menu.wall.above) return 'Passa per davant de la paret';
    if (op === 'backward' && menu.wall.below) return 'Passa per darrere de la paret';
    if (op === 'back' && menu.wall.inStack && !behind) return 'Per sota de tots, també de la paret';
    if (op === 'front' && behind) return 'Per sobre de tots, també de la paret';
    return null;
  };
  const wallLabel = (op: LayerOp): string | null =>
    op === 'forward' && menu.wall.above ? 'Porta davant de la paret'
      : op === 'backward' && menu.wall.below ? 'Envia darrere de la paret' : null;
  return (
    <div data-tilemenu onContextMenu={e => e.preventDefault()}
      style={{
        position: 'fixed', zIndex: 9999, width: MENU_W, padding: 4,
        left: Math.max(8, Math.min(menu.x + 2, window.innerWidth - MENU_W - 8)),
        top: Math.max(8, Math.min(menu.y + 2, window.innerHeight - H - 8)),
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.menu,
      }}>
      <div style={{ padding: '4px 10px 6px', fontSize: FS.xs, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.06em' }}
        title={menu.item.kind === 'object'
          ? 'S\'ordena entre els objectes que se li encavalquen (sempre per sobre dels decorats) i, si toca una paret, també respecte de la paret'
          : 'S\'ordena entre els decorats de la mateixa casella (els objectes van sempre per sobre)'}>
        {what} · ordre{behind ? ' · darrere de la paret' : ''}
      </div>
      {LAYER_ITEMS.map(it => (
        <Item key={it.op} label={wallLabel(it.op) ?? it.label} disabled={!menu.ops[it.op]}
          title={menu.ops[it.op] ? wallHint(it.op) ?? it.hint : alone ? `No té cap altre ${menu.item.kind === 'object' ? 'objecte' : 'decorat'} a sobre ni a sota` : it.op === 'front' || it.op === 'forward' ? 'Ja és al davant de tot' : 'Ja és al fons de tot'}
          onClick={() => onAction(it.op)} />
      ))}
      <div style={{ height: 1, background: C.border, margin: '4px 6px' }} />
      <Item label="Moure" icon={<Move size={13} />} title="Queda enganxat al cursor: un clic el deixa (Maj l'enganxa a la casella; Esc o clic dret ho cancel·len)" onClick={() => onAction('move')} />
      <Item label="Girar 90°" icon={<RedoIcon size={13} />} onClick={() => onAction('rotate')} />
      <Item label="Esborrar" danger icon={<Trash2 size={13} />} onClick={() => onAction('delete')} />
    </div>
  );
}
