'use client';
import React from 'react';
import { PenLine, Eraser, RotateCcw, Trash2, CrosshairIcon, TriangleIcon, PointerIcon, GridIcon, WallIcon, SunIcon } from '@/components/icons';
import { C, PALETTE, FS, RADIUS, SPELL_MODES } from '@/constants';
import { GridPanel } from '@/components/dm/GridPanel';
import { Button } from '@/components/ui/Button';
import { HoverTip } from '@/components/ui/HoverTip';
import type { DrawTool, PaintedZone, TokenSizeMap } from '@/types';
import type { SyncSocket } from '@/lib/ws';
import type { DMMode } from '@/lib/dm-mode';

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
  /** Preparar o Jugar: cada mode només ensenya les seves eines. */
  mode: DMMode;
  drawTool: DrawTool;
  drawColor: string; setDrawColor: (c: string) => void;
  drawSize: number; setDrawSize: (n: number) => void;
  canUndo: boolean; paintedZones: PaintedZone[];
  onSetDrawTool: (fn: (t: DrawTool) => DrawTool) => void;
  /** Desfà l'últim traç (al panell de Dibuix). */
  onUndo: () => void;
  onClearDraw: () => void;
  /** Desfà l'últim canvi del mapa (mode Preparar); `mapUndo` n'és l'etiqueta, null si no n'hi ha. */
  onUndoMap: () => void;
  mapUndo: string | null;
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
  /** Sense mapa carregat les eines no fan res: la barra es mostra apagada. */
  disabled?: boolean;
}

interface ToolDef {
  tool: DrawTool;
  /** Altres eines que encenen el mateix botó (Dibuix = ploma o goma). */
  also?: DrawTool[];
  label: string;
  hint?: string;
  icon: React.ReactNode;
  color?: string;
  desc: React.ReactNode;
}

const SELECT_TOOL: ToolDef = {
  tool: 'none', label: 'Selecció', hint: 'V', icon: <PointerIcon size={15} />, color: C.accent,
  desc: <>El cursor de sempre: <b style={{ color: C.text }}>clica un token</b> per seleccionar-lo i arrossega&apos;l per moure&apos;l (doble clic si és d&apos;un grup, per moure&apos;ls tots). <b style={{ color: C.text }}>Arrossega en buit</b> per moure el mapa. <b style={{ color: C.text }}>Clic dret</b> obre el menú del token, de la sala o de la zona màgica. Sobre una <b style={{ color: C.text }}>porta</b>, el clic l&apos;obre o la tanca.
    <div style={{ marginTop: 4 }}>Amb qualsevol eina: Espai+arrossegar mou el mapa · Esc torna aquí.</div></>,
};

/** Eines del mode Jugar (el que es fa a la taula). */
const PLAY_TOOLS: ToolDef[] = [
  SELECT_TOOL,
  {
    tool: 'pointer', label: 'Senyal i regla', hint: '4', icon: <CrosshairIcon size={15} />, color: C.room,
    desc: <>El teu cursor es veu a la pantalla dels jugadors, per assenyalar-los coses. A més fa de <b style={{ color: C.text }}>regla</b>: clica per marcar l&apos;inici, torna a clicar per fixar el final (la distància surt en peus) i un tercer clic l&apos;esborra.</>,
  },
  {
    tool: 'pen', also: ['eraser'], label: 'Dibuix', hint: '1 · 2', icon: <PenLine size={15} />,
    desc: <>Dibuixa a mà alçada sobre el mapa; als jugadors el traç es reprodueix <b style={{ color: C.text }}>animat</b>, com si l&apos;anessis fent davant seu. Al panell del costat: <b style={{ color: C.text }}>ploma o goma</b> (tecles 1 i 2), color, gruix, desfer l&apos;últim traç i esborrar-ho tot.</>,
  },
  {
    tool: 'shape', label: 'Màgies', hint: '3', icon: <TriangleIcon size={15} />, color: C.magic,
    desc: <>Arrossega per traçar i tria a la roda que surt. El gest decideix quines opcions hi ha:
      {([
        [SPELL_MODES.path, 'bola de foc, raig elèctric, raig màgic'],
        [SPELL_MODES.zone, 'foc, gel, aigua, verí, llamps, màgia'],
        [SPELL_MODES.line, 'projectil, riure, mans ardents, raig de gebre'],
        [SPELL_MODES.area, 'dormir, greix, flama sagrada, beneir…'],
      ] as const).map(([m, opts]) => (
        <div key={m.title} style={{ marginTop: 4 }}>
          <b style={{ color: C.text }}>{m.gesture}</b> → {m.title}
          <div>{opts}</div>
        </div>
      ))}
      <div style={{ marginTop: 4 }}>Ctrl+arrossegar mou tokens, zones i àrees · clic dret sobre una zona per esborrar-la.</div>
      <div style={{ marginTop: 4 }}><b style={{ color: C.text }}>Clic dret a un jugador</b> → ✨ Conjurs del seu grimori, llançats des del token amb l&apos;abast en peus.</div></>,
  },
];

/** Eines del mode Preparar (construir el mapa). La Graella és un botó a part (obre un panell). */
const PREP_TOOLS: ToolDef[] = [
  SELECT_TOOL,
  {
    tool: 'wall', label: 'Parets i portes', hint: '5', icon: <WallIcon size={15} />, color: C.accent,
    desc: <>Clica per anar posant parets <b style={{ color: C.text }}>on vulguis</b>; a prop d&apos;una paret o vèrtex existent l&apos;extrem s&apos;hi <b style={{ color: C.text }}>auto-enganxa</b>. En tancar un recinte es crea una <b style={{ color: C.text }}>sala fosca</b> i et demana on va la porta (dos clics: inici i final). Arrossega un vèrtex per moure&apos;l.
      <div style={{ marginTop: 4 }}>Backspace desfà l&apos;última paret · Esc cancel·la la cadena · clic dret sobre una paret o una porta l&apos;elimina.</div></>,
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
    key: 'ctrl', label: 'Vista compartida', hint: 'toc CTRL', badge: 'CTRL', badgeSize: 8, color: '#4ade80',
    desc: <>Mou el mapa i fes zoom: els jugadors et segueixen en directe. En desactivar-lo, la vista <b style={{ color: C.text }}>torna a l&apos;enquadrament</b> que hi havia abans d&apos;entrar-hi. S&apos;activa amb un toc de Ctrl sol (Ctrl+Z i les altres combinacions no el toquen).</>,
  },
  {
    key: 'shift', label: 'Vista privada', hint: 'toc MAJ', badge: 'MAJ', badgeSize: 9, color: C.room,
    desc: <>Mou-te i fes zoom <b style={{ color: C.text }}>sense que els jugadors ho vegin</b> (la seva pantalla es queda on era). També cal tenir-lo actiu per <b style={{ color: C.text }}>amagar</b> una sala ja revelada. En sortir, la teva vista torna sola on estava. S&apos;activa amb un toc de Maj sol (Maj+clic no el toca).</>,
  },
  {
    key: 'area', label: 'Selecció múltiple', hint: 'A', badge: '▣', badgeSize: 15, color: C.room,
    desc: <>Arrossega un rectangle i queden seleccionats tots els tokens que hi hagi dins (jugadors i enemics alhora). Després els pots moure junts, <b style={{ color: C.text }}>agrupar-los</b> amb el clic dret o esborrar-los amb Supr.</>,
  },
];

const btnBase: React.CSSProperties = {
  width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: RADIUS.md, border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer',
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
  mode, drawTool, drawColor, setDrawColor, drawSize, setDrawSize, canUndo, paintedZones,
  onSetDrawTool, onUndo, onClearDraw, onUndoMap, mapUndo, onClearPaintedZones, bcRef, wsRef,
  lightRadiusFt, lightSelected, onSetLightRadius,
  ctrlPanActive, onToggleCtrlPan, shiftPanActive, onToggleShiftPan,
  areaSelectMode, onToggleAreaSelect, grid, disabled,
}: Props) {
  const [gridOpen, setGridOpen] = React.useState(false);
  // Botó sobre el qual hi ha el cursor: en surt la finestreta d'explicació enganxada a la dreta.
  const [hover, setHover] = React.useState<string | null>(null);
  // Al flyout hi queden només els controls que cal manipular (color/gruix, radi de llum);
  // les explicacions ja no hi viuen, ara surten al passar el cursor pel botó.
  const drawing = drawTool === 'pen' || drawTool === 'eraser';
  const showDrawFlyout = drawing || drawTool === 'light';
  const prep = mode === 'preparar';
  const tools = prep ? PREP_TOOLS : PLAY_TOOLS;
  // El panell de la graella només existeix a Preparar (la visibilitat, al menú Vista).
  const showGrid = prep && gridOpen;

  // Tornar a clicar l'eina activa la deixa (torna a la selecció). Dibuix compta com a activa
  // amb la ploma o amb la goma: el seu botó encén la ploma.
  const selectTool = (def: ToolDef) => onSetDrawTool(dt => {
    const t = def.tool;
    const isOn = dt === t || (def.also?.includes(dt) ?? false);
    const nt = isOn ? 'none' : t;
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
      <div
        title={disabled ? 'Carrega un mapa per fer servir les eines' : undefined}
        style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: 4, borderRadius: RADIUS.lg, background: C.float, border: `1px solid ${C.border}`, boxShadow: '0 4px 16px rgba(0,0,0,0.5)', pointerEvents: 'auto', opacity: disabled ? 0.35 : 1, filter: disabled ? 'grayscale(1)' : 'none' }}>
        {/* Sense mapa: la barra es veu (se sap que existeix) però no reacciona ni mostra ajuda. */}
        <fieldset disabled={disabled} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, pointerEvents: disabled ? 'none' : 'auto' }}>
        {tools.map(t => (
          <ToolButton key={t.tool} id={`tool_${t.tool}`} {...hoverProps}
            onClick={() => selectTool(t)}
            active={drawTool === t.tool || (t.also?.includes(drawTool) ?? false)} color={t.color ?? drawColor}
            tip={{ title: t.label, hint: t.hint, desc: t.desc }}>
            {t.icon}
          </ToolButton>
        ))}

        {prep && (
          <ToolButton id="grid" {...hoverProps} onClick={() => setGridOpen(o => !o)}
            active={gridOpen} color={C.accent}
            tip={{
              title: 'Graella',
              desc: <>Mida de casella, <b style={{ color: C.text }}>calibratge</b> arrossegant sobre una casella del mapa, gruix de línia, imantar els tokens a les caselles i ajustar-los la mida sols. Per ensenyar-la o amagar-la mentre jugues, menú <b style={{ color: C.text }}>Vista</b>.</>,
            }}>
            <GridIcon size={15} />
          </ToolButton>
        )}

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

        {(prep || paintedZones.length > 0) && <div style={{ height: 1, background: C.border, margin: '2px 2px' }} />}

        {prep ? (
          // Un sol desfer per als canvis del mapa (parets, sales, portes, llums): el mateix que
          // el Ctrl+Z amb aquestes eines. El del dibuix viu al panell de Dibuix.
          <ToolButton id="undomap" {...hoverProps} onClick={onUndoMap} disabled={!mapUndo}
            tip={{
              title: 'Desfer al mapa', hint: 'CTRL+Z',
              desc: mapUndo
                ? <>Desfà l&apos;últim canvi del mapa: <b style={{ color: C.text }}>{mapUndo}</b>.</>
                : <>Desfà l&apos;últim canvi del mapa (paret, sala, porta o llum). Ara no n&apos;hi ha cap.</>,
            }}>
            <RotateCcw size={15} />
          </ToolButton>
        ) : paintedZones.length > 0 && (
          <ToolButton id="clearzones" {...hoverProps} onClick={onClearPaintedZones} active color={C.magic}
            style={{ fontSize: FS.xs, fontWeight: 700 }}
            tip={{
              title: 'Esborrar zones màgiques',
              desc: <>Treu totes les zones màgiques pintades al mapa ({paintedZones.length} ara mateix). Per esborrar-ne només una, clic dret a sobre.</>,
            }}>
            ✨{paintedZones.length}
          </ToolButton>
        )}
        </fieldset>
      </div>

      {!disabled && (showDrawFlyout || showGrid) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {showGrid && <GridPanel {...grid} />}
          {showDrawFlyout && (
            <div style={{ padding: '8px 10px', borderRadius: RADIUS.lg, background: C.float, border: `1px solid ${C.border}`, boxShadow: '0 4px 16px rgba(0,0,0,0.5)', minWidth: 150, pointerEvents: 'auto' }}>
              {drawing && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 236 }}>
                  <div role="radiogroup" aria-label="Ploma o goma" style={{ display: 'flex', gap: 4 }}>
                    {([['pen', 'Ploma', '1', <PenLine key="p" size={13} />], ['eraser', 'Goma', '2', <Eraser key="e" size={13} />]] as const).map(([t, label, key, icon]) => (
                      <Button key={t} size="sm" role="radio" aria-checked={drawTool === t} active={drawTool === t}
                        color={t === 'pen' ? drawColor : C.text} title={`${label} (${key})`}
                        onClick={() => onSetDrawTool(() => t)} style={{ flex: 1, gap: 5, height: 26 }}>
                        {icon} {label}
                      </Button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {drawTool === 'pen' && PALETTE.map(c => (
                      <button key={c} onClick={() => setDrawColor(c)} title={c} aria-label={`Color ${c}`}
                        style={{ width: 15, height: 15, padding: 0, borderRadius: '50%', background: c, cursor: 'pointer', border: `2px solid ${drawColor === c ? C.bright : 'transparent'}`, boxSizing: 'border-box', flexShrink: 0 }} />
                    ))}
                    <input type="range" min={2} max={30} value={drawSize} onChange={e => setDrawSize(parseInt(e.target.value))}
                      aria-label="Gruix" style={{ flex: 1, minWidth: 60, accentColor: drawTool === 'pen' ? drawColor : C.dim }} />
                    <span style={{ color: C.dim, fontSize: FS.xs, minWidth: 22, flexShrink: 0 }}>{drawSize}px</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button size="sm" onClick={onUndo} disabled={!canUndo} title="Desfer l'últim traç (Ctrl+Z)" style={{ flex: 1, gap: 5, height: 26 }}>
                      <RotateCcw size={11} /> Desfer traç
                    </Button>
                    <Button size="sm" variant="danger" onClick={onClearDraw} title="Esborra tot el dibuix, també a la pantalla dels jugadors" style={{ flex: 1, gap: 5, height: 26 }}>
                      <Trash2 size={11} /> Esborrar tot
                    </Button>
                  </div>
                </div>
              )}
              {drawTool === 'light' && (
                <div style={{ minWidth: 190 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: C.dim, fontSize: FS.xs, flexShrink: 0 }}>Radi</span>
                    <input type="range" min={5} max={60} step={5} value={lightRadiusFt}
                      onChange={e => onSetLightRadius(parseInt(e.target.value))}
                      style={{ flex: 1, minWidth: 80, accentColor: '#ffcc33' }} />
                    <span style={{ color: '#ffcc33', fontSize: FS.xs, minWidth: 30, flexShrink: 0, fontWeight: 700 }}>{lightRadiusFt}ft</span>
                  </div>
                  <div style={{ fontSize: FS.xs, color: C.dim, lineHeight: 1.5, marginTop: 5 }}>
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
