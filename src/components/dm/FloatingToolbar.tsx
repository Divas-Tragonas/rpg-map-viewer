'use client';
import React from 'react';
import { PenLine, Eraser, Trash2, CrosshairIcon, TriangleIcon, PointerIcon, GridIcon, WallIcon, SunIcon, SparklesIcon, TilesIcon } from '@/components/icons';
import { C, PALETTE, FS, RADIUS, tint } from '@/constants';
import { useCompactLayout } from '@/hooks/useCompact';
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
  paintedZones: PaintedZone[];
  onSetDrawTool: (fn: (t: DrawTool) => DrawTool) => void;
  onClearDraw: () => void;
  onClearPaintedZones: () => void;
  bcRef: React.MutableRefObject<BroadcastChannel | null>;
  wsRef: React.MutableRefObject<SyncSocket | null>;
  lightRadiusFt: number;
  lightSelected: boolean;
  onSetLightRadius: (ft: number) => void;
  /** Selecció múltiple: no és una eina de dibuix però canvia què fa el ratolí. */
  areaSelectMode: boolean; onToggleAreaSelect: () => void;
  grid: GridProps;
  /** Sense mapa carregat les eines no fan res: la barra es mostra apagada. */
  disabled?: boolean;
  /** Estil Píxel: hi ha l'eina Caselles (amb mapa de caselles) i el seu panell (paleta). */
  pixel?: boolean;
  tilesAvailable?: boolean;
  tilePanel?: React.ReactNode;
}

interface ToolDef {
  tool: DrawTool;
  /** Altres eines que encenen el mateix botó (Dibuix = ploma o goma). */
  also?: DrawTool[];
  label: string;
  hint?: string;
  icon: React.ReactNode;
  /** Una sola línia: què fa. El detall (gestos, tecles) és a la finestra de dreceres (?). */
  desc: string;
}

// ⚠️ Les descripcions són d'UNA línia (≤ ~48 caràcters): la finestreta és un recordatori,
// no un manual. Abans eren paràgrafs que tapaven mig mapa. El que no hi cap (els gestos de
// les màgies, les tecles de les parets…) va a `ShortcutsHelp`.
const SELECT_TOOL: ToolDef = {
  tool: 'none', label: 'Selecció', hint: 'V', icon: <PointerIcon size={15} />,
  desc: 'Selecciona i mou tokens; en buit, mou el mapa.',
};

/** Eines del mode Jugar (el que es fa a la taula). */
const PLAY_TOOLS: ToolDef[] = [
  SELECT_TOOL,
  { tool: 'pointer', label: 'Senyal i regla', hint: '4', icon: <CrosshairIcon size={15} />, desc: 'Assenyala als jugadors i mesura en peus.' },
  { tool: 'pen', also: ['eraser'], label: 'Dibuix', hint: '1 · 2', icon: <PenLine size={15} />, desc: 'A mà alçada; als jugadors surt animat.' },
  { tool: 'shape', label: 'Màgies', hint: '3', icon: <TriangleIcon size={15} />, desc: 'Traça un gest i tria la màgia a la roda.' },
];

/** Eines del mode Preparar (construir el mapa). La Graella és un botó a part (obre un panell). */
const PREP_TOOLS: ToolDef[] = [
  SELECT_TOOL,
  { tool: 'wall', label: 'Parets i portes', hint: '5', icon: <WallIcon size={15} />, desc: 'Dibuixa parets; tancar-les crea una sala.' },
  { tool: 'light', label: 'Llums', hint: '6', icon: <SunIcon size={15} />, desc: "Torxes que s'encenen quan hi entra un jugador." },
];

/** Estil Píxel: l'editor de caselles (només amb un mapa de caselles obert). */
const TILES_TOOL: ToolDef = {
  tool: 'tiles', label: 'Caselles', hint: '7', icon: <TilesIcon size={15} />,
  desc: 'Pinta sales, terra, parets, portes i objectes.',
};

// La selecció múltiple és l'únic mode de ratolí que queda a la barra. Els de càmera (vista
// compartida i privada) viuen al selector de càmera del mapa (`CanvasHUD`).
const AREA_MODE = {
  label: 'Selecció múltiple', hint: 'A',
  desc: 'Arrossega un rectangle per triar-ne diversos.',
};

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
function ToolButton({ id, hover, setHover, onClick, active, disabled, style, tip, noTip, children }: {
  id: string;
  noTip?: boolean;
  hover: string | null;
  setHover: (fn: (h: string | null) => string | null) => void;
  onClick: () => void;
  active?: boolean; disabled?: boolean;
  style?: React.CSSProperties;
  tip: { title: string; hint?: string; desc: string };
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: 'relative', display: 'flex' }}
      onMouseEnter={() => setHover(() => id)}
      onMouseLeave={() => setHover(h => (h === id ? null : h))}>
      <button onClick={onClick} disabled={disabled}
        style={{
          ...btnBase,
          // Una sola manera de dir «actiu» per a totes les eines: el daurat. Abans cada eina
          // tenia el seu color (blau, lila, groc, el color de la ploma…) i no es llegia cap patró.
          border: `1px solid ${active ? C.accent : C.border}`,
          background: active ? tint(C.accent, 0.13) : 'transparent',
          color: disabled ? 'rgba(139,148,158,0.25)' : active ? C.accent : C.dim,
          cursor: disabled ? 'default' : 'pointer',
          ...style,
        }}>
        {children}
      </button>
      {/* Al mòbil no hi ha cursor: un toc dispararia el «hover» i la finestreta s'hi quedaria. */}
      {!noTip && <HoverTip show={hover === id} title={tip.title} hint={tip.hint}>{tip.desc}</HoverTip>}
    </div>
  );
}

export function FloatingToolbar({
  mode, drawTool, drawColor, setDrawColor, drawSize, setDrawSize, paintedZones,
  onSetDrawTool, onClearDraw, onClearPaintedZones, bcRef, wsRef,
  lightRadiusFt, lightSelected, onSetLightRadius,
  areaSelectMode, onToggleAreaSelect, grid, disabled, pixel, tilesAvailable, tilePanel,
}: Props) {
  const [gridOpen, setGridOpen] = React.useState(false);
  // Botó sobre el qual hi ha el cursor: en surt la finestreta d'explicació enganxada a la dreta.
  const [hover, setHover] = React.useState<string | null>(null);
  // Mòbil: barra horitzontal a dalt (sota els controls del mapa), que ocupa menys pantalla i
  // deixa la de baix per a la barra de torns. Els panells s'obren a sota.
  const compact = useCompactLayout();
  // Al flyout hi queden només els controls que cal manipular (color/gruix, radi de llum);
  // les explicacions ja no hi viuen, ara surten al passar el cursor pel botó.
  const drawing = drawTool === 'pen' || drawTool === 'eraser';
  const showDrawFlyout = drawing || drawTool === 'light';
  const prep = mode === 'preparar';
  const tools = prep ? (pixel && tilesAvailable ? [SELECT_TOOL, TILES_TOOL, ...PREP_TOOLS.slice(1)] : PREP_TOOLS) : PLAY_TOOLS;
  const showTiles = drawTool === 'tiles' && !!tilePanel;
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

  const hoverProps = { hover, setHover, noTip: compact };
  const sep = compact ? { width: 1, alignSelf: 'stretch' as const, background: C.border, margin: '2px 2px' } : { height: 1, background: C.border, margin: '2px 2px' };

  // pointerEvents 'none' al contenidor perquè el seu box (columna + gap + espai buit
  // sobre el flyout) no capturi els clics/traços del canvas de sota; només els dos
  // panells visibles reactiven pointerEvents. Sense això la goma/pinzell no dibuixen
  // a tota la cantonada inferior esquerra (hitbox invisible enorme).
  return (
    // zIndex per sobre de la barra de torns (12): les finestretes i els panells de la barra
    // d'eines s'obren cap a la dreta, a la mateixa alçada, i quedaven tapats per la barra de torns.
    <div style={compact
      ? { position: 'absolute', top: 56, left: 'max(12px, env(safe-area-inset-left))', zIndex: 13, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, pointerEvents: 'none', maxWidth: 'calc(100% - 24px)' }
      : { position: 'absolute', bottom: 12, left: 12, zIndex: 13, display: 'flex', alignItems: 'flex-end', gap: 8, pointerEvents: 'none' }}>
      <div
        title={disabled ? 'Carrega un mapa per fer servir les eines' : undefined}
        style={{ display: 'flex', flexDirection: compact ? 'row' : 'column', gap: 3, padding: 4, borderRadius: RADIUS.lg, background: C.float, border: `1px solid ${C.border}`, boxShadow: '0 4px 16px rgba(0,0,0,0.5)', pointerEvents: 'auto', opacity: disabled ? 0.35 : 1, filter: disabled ? 'grayscale(1)' : 'none' }}>
        {/* Sense mapa: la barra es veu (se sap que existeix) però no reacciona ni mostra ajuda. */}
        <fieldset disabled={disabled} style={{ border: 'none', margin: 0, padding: 0, minWidth: 0, display: 'flex', flexDirection: compact ? 'row' : 'column', gap: 3, pointerEvents: disabled ? 'none' : 'auto' }}>
        {tools.map(t => (
          <ToolButton key={t.tool} id={`tool_${t.tool}`} {...hoverProps}
            onClick={() => selectTool(t)}
            active={drawTool === t.tool || (t.also?.includes(drawTool) ?? false)}
            tip={{ title: t.label, hint: t.hint, desc: t.desc }}>
            {t.icon}
          </ToolButton>
        ))}

        {prep && (
          <ToolButton id="grid" {...hoverProps} onClick={() => setGridOpen(o => !o)}
            active={gridOpen}
            tip={{ title: 'Graella', desc: 'Mida, calibratge i imant de les caselles.' }}>
            <GridIcon size={15} />
          </ToolButton>
        )}

        <div style={sep} />

        <ToolButton id="mode_area" {...hoverProps}
          onClick={onToggleAreaSelect} active={areaSelectMode}
          style={{ fontSize: 15, fontWeight: 800 }}
          tip={{ title: AREA_MODE.label, hint: AREA_MODE.hint, desc: AREA_MODE.desc }}>
          ▣
        </ToolButton>

        {!prep && paintedZones.length > 0 && <div style={sep} />}

        {!prep && paintedZones.length > 0 && (
          <ToolButton id="clearzones" {...hoverProps} onClick={onClearPaintedZones}
            style={{ fontSize: FS.xs, fontWeight: 700, gap: 2, color: C.magicBright }}
            tip={{ title: `Esborrar les zones màgiques (${paintedZones.length})`, desc: 'Per treure-ne només una, clic dret a sobre.' }}>
            <SparklesIcon size={12} />{paintedZones.length}
          </ToolButton>
        )}
        </fieldset>
      </div>

      {!disabled && (showDrawFlyout || showGrid || showTiles) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...(compact ? { maxWidth: '100%', maxHeight: 'calc(100dvh - 260px)', overflowY: 'auto', pointerEvents: 'auto' } : {}) }}>
          {showTiles && tilePanel}
          {showGrid && <GridPanel {...grid} />}
          {showDrawFlyout && (
            <div style={{ padding: '8px 10px', borderRadius: RADIUS.lg, background: C.float, border: `1px solid ${C.border}`, boxShadow: '0 4px 16px rgba(0,0,0,0.5)', minWidth: 150, pointerEvents: 'auto' }}>
              {drawing && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: compact ? 'min(236px, calc(100vw - 48px))' : 236 }}>
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
                  {/* El desfer del traç és el «Desfer» de la barra superior (i Ctrl+Z). */}
                  <Button size="sm" variant="danger" onClick={onClearDraw} title="Esborra tot el dibuix, també a la pantalla dels jugadors" style={{ gap: 5, height: 26 }}>
                    <Trash2 size={11} /> Esborrar tot el dibuix
                  </Button>
                </div>
              )}
              {drawTool === 'light' && (
                <div style={{ minWidth: 190 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: C.dim, fontSize: FS.xs, flexShrink: 0 }}>Radi</span>
                    <input type="range" min={5} max={60} step={5} value={lightRadiusFt}
                      onChange={e => onSetLightRadius(parseInt(e.target.value))}
                      style={{ flex: 1, minWidth: 80, accentColor: C.accent }} />
                    <span style={{ color: C.bright, fontSize: FS.xs, minWidth: 30, flexShrink: 0, fontWeight: 700 }}>{lightRadiusFt} ft</span>
                  </div>
                  <div style={{ fontSize: FS.xs, color: C.dim, lineHeight: 1.5, marginTop: 5 }}>
                    {lightSelected
                      ? <b style={{ color: C.text }}>El radi edita la llum seleccionada.</b>
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
