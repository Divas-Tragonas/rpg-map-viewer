'use client';
import React from 'react';
import { PenLine, Eraser, RotateCcw, Trash2, CrosshairIcon, TriangleIcon, PointerIcon, GridIcon, WallIcon, SunIcon } from '@/components/icons';
import { C, PALETTE } from '@/constants';
import { GridPanel } from '@/components/dm/GridPanel';
import { HoverTip } from '@/components/ui/HoverTip';
import type { DrawTool, PaintedZone, TokenSizeMap } from '@/types';
import type { SyncSocket } from '@/lib/ws';

interface GridProps {
  gridVisible: boolean; gridSize: number; gridSnap: boolean;
  gridAutoSize: boolean; gridLineWidth: number; gridCalibrating: boolean;
  rGridVisible: React.MutableRefObject<boolean>;
  rGridSize: React.MutableRefObject<number>;
  rGridSnap: React.MutableRefObject<boolean>;
  rGridAutoSize: React.MutableRefObject<boolean>;
  rGridLineWidth: React.MutableRefObject<number>;
  rGridCalibrating: React.MutableRefObject<boolean>;
  rTokenSizeOverride: React.MutableRefObject<TokenSizeMap>;
  setGridVisible: (v: boolean) => void;
  setGridSize: (v: number) => void;
  setGridSnap: (v: boolean) => void;
  setGridAutoSize: (v: boolean) => void;
  setGridLineWidth: (v: number) => void;
  setGridCalibrating: (v: boolean) => void;
  setTokenSizeOverride: (v: TokenSizeMap) => void;
  onSnapAll: () => void;
  onSizeAll: () => void;
  onBroadcast: () => void;
  gridCalibRef: React.MutableRefObject<{ sx: number; sy: number } | null>;
  gridCalibCurrRef: React.MutableRefObject<{ cx: number; cy: number } | null>;
}

interface Props {
  drawTool: DrawTool;
  drawColor: string; setDrawColor: (c: string) => void;
  drawSize: number; setDrawSize: (n: number) => void;
  canUndo: boolean; paintedZones: PaintedZone[];
  onSetDrawTool: (fn: (t: DrawTool) => DrawTool) => void;
  onUndo: () => void;
  onClearDraw: () => void;
  onClearPaintedZones: () => void;
  bcRef: React.MutableRefObject<BroadcastChannel | null>;
  wsRef: React.MutableRefObject<SyncSocket | null>;
  lightRadiusFt: number;
  lightSelected: boolean;
  onSetLightRadius: (ft: number) => void;
  /** Modes que no són eines de dibuix però sí que canvien què fa el ratolí. */
  ctrlPanActive: boolean; onToggleCtrlPan: () => void;
  shiftPanActive: boolean; onToggleShiftPan: () => void;
  areaSelectMode: boolean; onToggleAreaSelect: () => void;
  grid: GridProps;
}

interface ToolDef {
  tool: DrawTool;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  color?: string;
  desc: React.ReactNode;
}

const TOOLS: ToolDef[] = [
  {
    tool: 'none', label: 'Selecció', icon: <PointerIcon size={15} />, color: C.accent,
    desc: <>El cursor de sempre: <b style={{ color: C.text }}>clica un token</b> per seleccionar-lo i arrossega&apos;l per moure&apos;l (doble clic si és d&apos;un grup, per moure&apos;ls tots). <b style={{ color: C.text }}>Clic dret</b> obre el menú del token, de la sala o de la zona màgica. Sobre una <b style={{ color: C.text }}>porta</b>, el clic l&apos;obre o la tanca.</>,
  },
  {
    tool: 'pen', label: 'Ploma', hint: '1', icon: <PenLine size={15} />,
    desc: <>Dibuixa a mà alçada sobre el mapa; als jugadors el traç es reprodueix <b style={{ color: C.text }}>animat</b>, com si l&apos;anessis fent davant seu. Tria el color i el gruix al panell del costat.</>,
  },
  {
    tool: 'eraser', label: 'Goma', hint: '2', icon: <Eraser size={15} />,
    desc: <>Esborra el que has dibuixat amb la ploma passant-hi el cursor per sobre. El gruix del pinzell mana quanta superfície neteja.</>,
  },
  {
    tool: 'shape', label: 'Màgies', hint: '3', icon: <TriangleIcon size={15} />, color: C.magic,
    desc: <>Pinta <b style={{ color: C.text }}>zones màgiques</b>: clica per marcar els vèrtexs del polígon i escull l&apos;element (foc, gel, aigua, llamps, verí o màgia). Als jugadors es veuen amb textura animada.</>,
  },
  {
    tool: 'pointer', label: 'Senyal i regla', hint: '4', icon: <CrosshairIcon size={15} />, color: '#58a6ff',
    desc: <>El teu cursor es veu a la pantalla dels jugadors, per assenyalar-los coses. A més fa de <b style={{ color: C.text }}>regla</b>: clica per marcar l&apos;inici, torna a clicar per fixar el final (la distància surt en peus) i un tercer clic l&apos;esborra.</>,
  },
  {
    tool: 'wall', label: 'Parets', hint: '5', icon: <WallIcon size={15} />, color: C.accent,
    desc: <>Clica per anar posant parets <b style={{ color: C.text }}>on vulguis</b>; a prop d&apos;una paret o vèrtex existent l&apos;extrem s&apos;hi <b style={{ color: C.text }}>auto-enganxa</b>. En tancar un recinte es crea una <b style={{ color: C.text }}>sala fosca</b> i et demana on va la porta (dos clics: inici i final).
      <div style={{ marginTop: 4 }}>Backspace desfà l&apos;última paret · Esc cancel·la la cadena · clic dret sobre una porta l&apos;elimina.</div></>,
  },
  {
    tool: 'light', label: 'Llums', hint: '6', icon: <SunIcon size={15} />, color: '#ffcc33',
    desc: <>Col·loca <b style={{ color: C.text }}>torxes i llànties</b> dins d&apos;una sala. Arrossega-les per moure-les i clic dret per treure-les. Només s&apos;encenen quan un token de jugador és dins de la mateixa sala.</>,
  },
];

interface ModeDef {
  key: 'ctrl' | 'shift' | 'area';
  label: string;
  hint: string;
  badge: string;
  badgeSize: number;
  color: string;
  desc: React.ReactNode;
}

// Modes que no són eines de dibuix però canvien què fa el ratolí. Fins ara només
// s'activaven per teclat i no hi havia manera de saber que existien.
const MODES: ModeDef[] = [
  {
    key: 'ctrl', label: 'Vista compartida', hint: 'CTRL', badge: 'CTRL', badgeSize: 8, color: '#4ade80',
    desc: <>Mou el mapa i fes zoom <b style={{ color: C.text }}>arrossegant</b>: els jugadors et segueixen en directe. En desactivar-lo, la vista torna a l&apos;enquadrament que hi havia abans d&apos;entrar-hi.</>,
  },
  {
    key: 'shift', label: 'Vista privada', hint: 'MAJ', badge: 'MAJ', badgeSize: 9, color: '#58a6ff',
    desc: <>Mou-te i fes zoom <b style={{ color: C.text }}>sense que els jugadors ho vegin</b> (la seva pantalla es queda on era). També cal tenir-lo actiu per <b style={{ color: C.text }}>amagar</b> una sala ja revelada. En sortir, la teva vista torna sola on estava.</>,
  },
  {
    key: 'area', label: 'Selecció múltiple', hint: 'A', badge: '▣', badgeSize: 15, color: '#58a6ff',
    desc: <>Arrossega un rectangle i queden seleccionats tots els tokens que hi hagi dins (jugadors i enemics alhora). Després els pots moure junts, <b style={{ color: C.text }}>agrupar-los</b> amb el clic dret o esborrar-los amb Supr.</>,
  },
];

const btnBase: React.CSSProperties = {
  width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer',
};

/**
 * Botó de la barra + la seva finestreta d'explicació. Definit a nivell de mòdul (no dins
 * de `FloatingToolbar`): si es declarés a dins, cada canvi de `hover` en crearia un tipus
 * nou i React desmuntaria i tornaria a muntar tots els botons — el `mouseleave` es perdria
 * i la finestreta quedaria enganxada.
 */
function ToolButton({ id, hover, setHover, onClick, active, color, disabled, style, tip, children }: {
  id: string;
  hover: string | null;
  setHover: (fn: (h: string | null) => string | null) => void;
  onClick: () => void;
  active?: boolean; color?: string; disabled?: boolean;
  style?: React.CSSProperties;
  tip: { title: string; hint?: string; desc: React.ReactNode };
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: 'relative', display: 'flex' }}
      onMouseEnter={() => setHover(() => id)}
      onMouseLeave={() => setHover(h => (h === id ? null : h))}>
      <button onClick={onClick} disabled={disabled}
        style={{
          ...btnBase,
          border: `1px solid ${active && color ? color : C.border}`,
          background: active && color ? `${color}22` : 'transparent',
          color: disabled ? 'rgba(139,148,158,0.25)' : active && color ? color : C.dim,
          cursor: disabled ? 'default' : 'pointer',
          ...style,
        }}>
        {children}
      </button>
      <HoverTip show={hover === id} title={tip.title} hint={tip.hint}>{tip.desc}</HoverTip>
    </div>
  );
}

export function FloatingToolbar({
  drawTool, drawColor, setDrawColor, drawSize, setDrawSize, canUndo, paintedZones,
  onSetDrawTool, onUndo, onClearDraw, onClearPaintedZones, bcRef, wsRef,
  lightRadiusFt, lightSelected, onSetLightRadius,
  ctrlPanActive, onToggleCtrlPan, shiftPanActive, onToggleShiftPan,
  areaSelectMode, onToggleAreaSelect, grid,
}: Props) {
  const [gridOpen, setGridOpen] = React.useState(false);
  // Botó sobre el qual hi ha el cursor: en surt la finestreta d'explicació enganxada a la dreta.
  const [hover, setHover] = React.useState<string | null>(null);
  // Al flyout hi queden només els controls que cal manipular (color/gruix, radi de llum);
  // les explicacions ja no hi viuen, ara surten al passar el cursor pel botó.
  const showDrawFlyout = drawTool === 'pen' || drawTool === 'eraser' || drawTool === 'light';

  const selectTool = (t: DrawTool) => onSetDrawTool(dt => {
    const nt = dt === t ? 'none' : t;
    if (nt === 'none' && dt === 'pointer') {
      bcRef.current?.postMessage({ type: 'POINTER', pos: null });
      bcRef.current?.postMessage({ type: 'MEASURE', a: null, b: null });
      wsRef.current?.send(JSON.stringify({ type: 'POINTER', pos: null }));
      wsRef.current?.send(JSON.stringify({ type: 'MEASURE', a: null, b: null }));
    }
    return nt;
  });

  const modeState: Record<ModeDef['key'], { on: boolean; toggle: () => void }> = {
    ctrl: { on: ctrlPanActive, toggle: onToggleCtrlPan },
    shift: { on: shiftPanActive, toggle: onToggleShiftPan },
    area: { on: areaSelectMode, toggle: onToggleAreaSelect },
  };

  const hoverProps = { hover, setHover };

  // pointerEvents 'none' al contenidor perquè el seu box (columna + gap + espai buit
  // sobre el flyout) no capturi els clics/traços del canvas de sota; només els dos
  // panells visibles reactiven pointerEvents. Sense això la goma/pinzell no dibuixen
  // a tota la cantonada inferior esquerra (hitbox invisible enorme).
  return (
    <div style={{ position: 'absolute', bottom: 12, left: 12, zIndex: 10, display: 'flex', alignItems: 'flex-end', gap: 8, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: 4, borderRadius: 9, background: 'rgba(10,13,18,.92)', border: `1px solid ${C.border}`, boxShadow: '0 4px 16px rgba(0,0,0,0.5)', pointerEvents: 'auto' }}>
        {TOOLS.map(t => (
          <ToolButton key={t.tool} id={`tool_${t.tool}`} {...hoverProps}
            onClick={() => selectTool(t.tool)}
            active={drawTool === t.tool} color={t.color ?? drawColor}
            tip={{ title: t.label, hint: t.hint, desc: t.desc }}>
            {t.icon}
          </ToolButton>
        ))}

        <div style={{ height: 1, background: C.border, margin: '2px 2px' }} />

        {MODES.map(m => (
          <ToolButton key={m.key} id={`mode_${m.key}`} {...hoverProps}
            onClick={modeState[m.key].toggle}
            active={modeState[m.key].on} color={m.color}
            style={{ fontSize: m.badgeSize, fontWeight: 800, letterSpacing: '0.02em' }}
            tip={{ title: m.label, hint: m.hint, desc: m.desc }}>
            {m.badge}
          </ToolButton>
        ))}

        <div style={{ height: 1, background: C.border, margin: '2px 2px' }} />

        <ToolButton id="undo" {...hoverProps} onClick={onUndo} disabled={!canUndo}
          tip={{
            title: 'Desfer', hint: 'CTRL+Z',
            desc: <>Treu l&apos;últim traç que has dibuixat. Amb l&apos;eina de selecció, el Ctrl+Z desfà l&apos;últim <b style={{ color: C.text }}>moviment de token</b> del torn en curs i li torna els peus gastats.</>,
          }}>
          <RotateCcw size={15} />
        </ToolButton>

        <ToolButton id="clear" {...hoverProps} onClick={onClearDraw}
          tip={{
            title: 'Esborrar el dibuix',
            desc: <>Neteja de cop tot el dibuix a ploma del mapa, a la teva pantalla i a la dels jugadors.</>,
          }}>
          <Trash2 size={15} />
        </ToolButton>

        {paintedZones.length > 0 && (
          <ToolButton id="clearzones" {...hoverProps} onClick={onClearPaintedZones} active color={C.magic}
            style={{ fontSize: 10, fontWeight: 700 }}
            tip={{
              title: 'Esborrar zones màgiques',
              desc: <>Treu totes les zones màgiques pintades al mapa ({paintedZones.length} ara mateix). Per esborrar-ne només una, clic dret a sobre.</>,
            }}>
            ✨{paintedZones.length}
          </ToolButton>
        )}

        <div style={{ height: 1, background: C.border, margin: '2px 2px' }} />

        <ToolButton id="grid" {...hoverProps} onClick={() => setGridOpen(o => !o)}
          active={gridOpen || grid.gridVisible} color={C.accent}
          tip={{
            title: 'Graella',
            desc: <>Obre la configuració del grid: mida de casella, <b style={{ color: C.text }}>calibratge</b> arrossegant sobre una casella del mapa, gruix de línia, imantar els tokens a les caselles i ajustar-los la mida sols.</>,
          }}>
          <GridIcon size={15} />
        </ToolButton>
      </div>

      {(showDrawFlyout || gridOpen) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {gridOpen && <GridPanel {...grid} />}
          {showDrawFlyout && (
            <div style={{ padding: '8px 10px', borderRadius: 9, background: 'rgba(10,13,18,.92)', border: `1px solid ${C.border}`, boxShadow: '0 4px 16px rgba(0,0,0,0.5)', minWidth: 150, pointerEvents: 'auto' }}>
              {(drawTool === 'pen' || drawTool === 'eraser') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {PALETTE.map(c => (
                    <div key={c} onClick={() => setDrawColor(c)} title={c}
                      style={{ width: 15, height: 15, borderRadius: '50%', background: c, cursor: 'pointer', border: `2px solid ${drawColor === c ? '#e6edf3' : 'transparent'}`, boxSizing: 'border-box', flexShrink: 0 }} />
                  ))}
                  <input type="range" min={2} max={30} value={drawSize} onChange={e => setDrawSize(parseInt(e.target.value))}
                    style={{ flex: 1, minWidth: 60, accentColor: drawColor }} />
                  <span style={{ color: C.dim, fontSize: 10, minWidth: 22, flexShrink: 0 }}>{drawSize}px</span>
                </div>
              )}
              {drawTool === 'light' && (
                <div style={{ minWidth: 190 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: C.dim, fontSize: 10, flexShrink: 0 }}>Radi</span>
                    <input type="range" min={5} max={60} step={5} value={lightRadiusFt}
                      onChange={e => onSetLightRadius(parseInt(e.target.value))}
                      style={{ flex: 1, minWidth: 80, accentColor: '#ffcc33' }} />
                    <span style={{ color: '#ffcc33', fontSize: 10, minWidth: 30, flexShrink: 0, fontWeight: 700 }}>{lightRadiusFt}ft</span>
                  </div>
                  <div style={{ fontSize: 9.5, color: C.dim, lineHeight: 1.5, marginTop: 5 }}>
                    {lightSelected
                      ? <b style={{ color: '#ffcc33' }}>El radi edita la llum seleccionada.</b>
                      : "Selecciona una llum per canviar-ne el radi; si no, és el radi de les llums noves."}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
