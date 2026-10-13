'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ImageIcon, Monitor, Maximize2, Copy, SaveIcon, ChevronDown, SlidersIcon, MoreHorizontal, Keyboard,
  ExternalLink, Download, FolderOpen, Cloud, CheckIcon, TargetIcon, LockIcon, UnlockIcon, DieIcon, Shield,
  WallIcon, SwordsIcon, GridIcon, RotateCcw, PanelLeftIcon,
} from '@/components/icons';
import { Button, IconButton } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { C, FS, RADIUS, SHADOW, APP_VERSION, FONT_SERIF, tint } from '@/constants';
import { extraSeen } from '@/lib/camera';
import { agoLabel } from '@/lib/autosave';
import type { DMMode } from '@/lib/dm-mode';

/** Alçada de la barra superior (el lateral i l'escenari comencen just a sota). */
export const TOP_BAR_H = 48;
/** Amplada del bloc del nom del mapa: la mateixa que el lateral, perquè la resta s'alineï amb l'escenari. */
const IDENTITY_W = 250;

type MenuId = 'screens' | 'game' | 'view' | 'more';

interface Props {
  /** Nom del fitxer del mapa; null = encara no n'hi ha cap de carregat. */
  mapName: string | null;
  hasPsd: boolean;
  /** Lateral desplegat o plegat (el botó viu al bloc del nom, alineat amb el lateral). */
  sidebarOpen: boolean; onToggleSidebar: () => void;
  /** Preparar (construir el mapa) o Jugar (a la taula). */
  mode: DMMode; onModeChange: (m: DMMode) => void;
  /** «Mostrar als jugadors» (expositor + revelador): panell obert i si ara mateix s'hi mostra res. */
  showOpen: boolean; showActive: boolean; onToggleShow: () => void;
  /** Què desfaria el «Desfer» (null = res) i l'acció; la mateixa que Ctrl+Z. */
  undoLabel: string | null; onUndo: () => void;
  /** Pantalles de jugador connectades (id → mida en píxels CSS del seu canvas). */
  playerScreens: Record<string, { w: number; h: number; ts: number }>;
  /** Format (amplada/alçada) de l'enquadrament actual del DM; null si encara no n'hi ha. */
  camAr: number | null;
  onOpenPlayer: () => void;
  autosaveEnabled: boolean; autosaveAt: number | null;
  onToggleAutosave: () => void; onSaveNow: () => void;
  onExport: () => void; onImport: (file: File) => void;
  /** Partides al servidor (només si hi ha API configurada). */
  onOpenServer?: () => void;
  bgOpacity: number; onBgOpacityChange: (v: number) => void;
  /** Ensenyar o amagar la graella (també als jugadors). La configuració és a Preparar. */
  gridVisible: boolean; onToggleGrid: () => void;
  enemyHighlight: boolean; highlightLocked: boolean;
  onToggleEnemyHighlight: () => void; onToggleHighlightLocked: () => void;
  onShowShortcuts: () => void;
}

/** «demo_bg.png» → «demo bg»: el nom del fitxer sense extensió ni guions baixos. */
function prettyName(file: string) {
  return file.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim() || file;
}
const isVideoName = (file: string) => /\.(mp4|webm|mov|m4v|ogv)$/i.test(file);

/**
 * Adreces on s'obre la pantalla de jugador. Si el DM ha obert l'app per `localhost`, aquesta
 * adreça no serveix a la tablet: es proposen les IPs LAN del PC (les llegeix next.config en
 * arrencar el servidor). Només es crida al client (depèn de `window.location`).
 */
function playerUrls(): string[] {
  const { protocol, hostname, port } = window.location;
  const p = port ? `:${port}` : '';
  const local = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  if (!local) return [`${protocol}//${hostname}${p}/player`];
  const hosts = (process.env.LAN_HOSTS || '').split(',').filter(Boolean);
  return hosts.map(h => `${protocol}//${h}${p}/player`);
}

// ── Peces comunes dels menús ─────────────────────────────────────────────────

/**
 * Menú desplegable sota un botó de la barra. Un clic fora o Esc el tanquen; l'Esc es
 * captura abans que `useKeyboardHandlers`, si no també tornaria a l'eina de selecció.
 */
function Popover({ onClose, width, padding = 6, children }: {
  onClose: () => void; width: number; padding?: number; children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation(); onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 1 }} onClick={onClose} />
      <div style={{
        position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 2, width,
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.menu,
        padding, display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        {children}
      </div>
    </>
  );
}

function MenuItem({ icon, label, hint, onClick, disabled, title }: {
  icon: React.ReactNode; label: string; hint?: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string;
}) {
  return (
    <button className="dm-menu-item" onClick={onClick} disabled={disabled} title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', border: 'none',
        borderRadius: RADIUS.md, background: 'transparent', textAlign: 'left', fontSize: FS.md, fontWeight: 600,
        color: disabled ? tint(C.dim, 0.5) : C.text, cursor: disabled ? 'default' : 'pointer',
      }}>
      <span style={{ display: 'flex', color: disabled ? tint(C.dim, 0.5) : C.dim, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {hint && <span style={{ fontSize: FS.xs, color: C.dim, fontWeight: 500 }}>{hint}</span>}
    </button>
  );
}

const MenuDivider = () => <div style={{ height: 1, background: C.border, margin: '4px 4px' }} />;

const Dot = ({ color }: { color: string }) => (
  <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
);

/** Botó de la barra. `color` pinta el text i el contorn (estat de pantalles, de desat…). */
/** Botó de la barra. Sempre neutre: els estats (avís, desat) els diu un punt o la icona,
 *  no el color de tot el botó (el daurat queda per a l'acció principal i el que és actiu). */
function BarButton({ active, onClick, title, ariaLabel, children }: {
  active?: boolean; onClick: () => void; title?: string; ariaLabel?: string; children: React.ReactNode;
}) {
  return (
    <Button size="md" active={active} onClick={onClick} title={title} aria-label={ariaLabel} aria-expanded={active} style={{ height: 32, gap: 7 }}>
      {children}
    </Button>
  );
}

function CopyRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1400);
    }).catch(() => {});
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <code style={{ flex: 1, minWidth: 0, fontSize: FS.sm, color: C.bright, background: C.bg, border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, padding: '4px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'all' }}>{url}</code>
      <Button size="sm" onClick={copy} title="Copiar l'adreça" style={{ gap: 4 }}>
        <Copy size={11} /> {copied ? 'Copiat' : 'Copiar'}
      </Button>
    </div>
  );
}

// ── Els quatre menús ─────────────────────────────────────────────────────────

/**
 * Pantalles de jugador. Substitueix el botó «Modo Jugador» del lateral i el xip 🖥 del HUD,
 * que feien el mateix. Amb l'enquadrament sincronitzat en coordenades de MAPA cap pantalla
 * no veu menys que el DM, però una de format diferent en veu MÉS als costats: el menú diu
 * quantes n'hi ha i quant en veuen de més. Sense cap, el botó surt en color d'avís.
 */
function ScreensMenu({ open, onToggle, onClose, playerScreens, camAr, onOpenPlayer }: {
  open: boolean; onToggle: () => void; onClose: () => void;
  playerScreens: Props['playerScreens']; camAr: Props['camAr']; onOpenPlayer: () => void;
}) {
  const [urls, setUrls] = useState<string[]>([]);
  const ids = Object.keys(playerScreens);
  const rows = ids.map(id => {
    const s = playerScreens[id];
    const ar = s.w / Math.max(s.h, 1);
    const ex = camAr ? extraSeen({ cx: 0, cy: 0, w: camAr, h: 1 }, ar) : null;
    return { id, s, ex };
  });
  const worst = rows.reduce((m, r) => Math.max(m, r.ex ? r.ex.pct : 0), 0);
  const none = ids.length === 0;
  // Botó neutre: l'estat el diu el punt (avís si no n'hi ha cap). Abans tot el botó anava
  // del color d'avís, que és gairebé el mateix daurat que l'acció principal i hi competia.
  return (
    <div style={{ position: 'relative' }}>
      <BarButton active={open} onClick={() => { setUrls(playerUrls()); onToggle(); }}
        title={none ? 'Cap pantalla de jugador connectada · clic per obrir-ne una' : `${ids.length} pantalla${ids.length === 1 ? '' : 'es'} de jugador · clic per veure-les`}>
        <Monitor size={14} />
        {none ? 'Cap pantalla de jugador' : `${ids.length} pantall${ids.length === 1 ? 'a' : 'es'}`}
        {!none && worst > 0 && <span style={{ color: worst >= 15 ? C.hpMid : C.dim, fontWeight: 600 }}>+{worst}%</span>}
        <Dot color={none ? C.warn : C.ok} />
      </BarButton>
      {open && (
        <Popover onClose={onClose} width={330} padding={12}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: FS.md, fontWeight: 700, color: C.bright }}>Pantalles de jugador</div>
            {none ? (
              <div style={{ fontSize: FS.sm, color: C.dim, lineHeight: 1.45 }}>
                No n&apos;hi ha cap de connectada. Una pantalla surt aquí uns segons després d&apos;obrir-se.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {rows.map(r => (
                  <div key={r.id} style={{ fontSize: FS.sm, color: C.text, display: 'flex', gap: 6 }}>
                    <span style={{ color: C.bright, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.s.w}×{r.s.h}</span>
                    <span style={{ color: C.dim }}>
                      {r.ex && r.ex.pct > 0 ? `veu un ${r.ex.pct}% més d'${r.ex.axis === 'w' ? 'amplada' : 'alçada'}` : 'veu el mateix que tu'}
                    </span>
                  </div>
                ))}
                <div style={{ fontSize: FS.xs, color: C.dim, marginTop: 2 }}>Totes veuen com a mínim tot el teu enquadrament.</div>
              </div>
            )}
            <Button variant="primary" block onClick={() => { onOpenPlayer(); onClose(); }} style={{ gap: 6 }}>
              <Maximize2 size={12} /> Obrir-ne una en aquest PC
            </Button>
            {urls.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ fontSize: FS.xs, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>A la tablet o al mòbil (mateixa wifi)</div>
                {urls.map(u => <CopyRow key={u} url={u} />)}
              </div>
            )}
          </div>
        </Popover>
      )}
    </div>
  );
}

/**
 * Partida: desat automàtic, fitxer .json i servidor en un sol lloc. Abans eren quatre
 * controls repartits (Guardar i Cargar al peu del lateral, ☁ a sota i el xip ⟳ a dalt).
 * L'etiqueta del botó és l'estat del desat, que es refresca sola perquè «fa 2 min» no es
 * quedi congelat entre desats.
 */
function GameMenu({ open, onToggle, onClose, hasMap, autosaveEnabled, autosaveAt, onToggleAutosave, onSaveNow, onExport, onImport, onOpenServer }: {
  open: boolean; onToggle: () => void; onClose: () => void; hasMap: boolean;
} & Pick<Props, 'autosaveEnabled' | 'autosaveAt' | 'onToggleAutosave' | 'onSaveNow' | 'onExport' | 'onImport' | 'onOpenServer'>) {
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tick(n => n + 1), 15_000);
    return () => clearInterval(iv);
  }, []);
  const fileRef = useRef<HTMLInputElement>(null);

  const label = !hasMap ? 'Partida' : !autosaveEnabled ? 'Sense desar' : autosaveAt ? `Desat ${agoLabel(autosaveAt)}` : 'Desant…';
  const title = !hasMap ? 'Obrir o importar una partida'
    : autosaveEnabled ? 'Desat automàtic actiu (cada 30 s i en amagar la pestanya)'
      : 'Desat automàtic apagat: si tanques o refresques, perdràs la partida';
  return (
    <div style={{ position: 'relative' }}>
      <BarButton active={open} onClick={onToggle} title={title}>
        {hasMap && autosaveEnabled && autosaveAt ? <CheckIcon size={14} color={C.hpHigh} /> : <SaveIcon size={14} />}
        {label}
        {hasMap && !autosaveEnabled && <Dot color={C.warn} />}
        <ChevronDown size={12} color={C.dim} />
      </BarButton>
      <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; onClose(); }} />
      {open && (
        <Popover onClose={onClose} width={300}>
          {hasMap && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 10px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: FS.md, fontWeight: 700, color: C.bright }}>Desat automàtic</span>
                  <span style={{ fontSize: FS.xs, color: C.dim, lineHeight: 1.45 }}>
                    {autosaveEnabled
                      ? `Cada 30 s i en amagar la pestanya. ${autosaveAt ? `Últim: ${agoLabel(autosaveAt)}.` : 'Encara no s\'ha desat res.'}`
                      : 'Apagat: si refresques o tanques, perds la partida.'}
                  </span>
                </div>
                <Switch on={autosaveEnabled} onChange={onToggleAutosave} label="Desat automàtic" />
              </div>
              {autosaveEnabled && (
                <MenuItem icon={<CheckIcon size={14} />} label="Desar ara" onClick={() => { onSaveNow(); onClose(); }} />
              )}
              <MenuDivider />
            </>
          )}
          <MenuItem icon={<Download size={14} />} label="Exportar a un fitxer" hint=".json" disabled={!hasMap}
            title={hasMap ? 'Descarrega la partida per guardar-la fora del navegador' : 'Carrega un mapa per poder exportar la partida'}
            onClick={() => { onExport(); onClose(); }} />
          <MenuItem icon={<FolderOpen size={14} />} label="Obrir un fitxer de partida…" hint=".json"
            onClick={() => fileRef.current?.click()} />
          {onOpenServer && (
            <>
              <MenuDivider />
              <MenuItem icon={<Cloud size={14} />} label="Partides al servidor…" onClick={() => { onOpenServer(); onClose(); }} />
            </>
          )}
        </Popover>
      )}
    </div>
  );
}

/**
 * Vista (només a la pantalla del DM): opacitat del mapa i ressaltar enemics. Abans eren un
 * lliscador al peu del lateral i dos xips a dalt al centre.
 */
function ViewMenu({ open, onToggle, onClose, hasPsd, bgOpacity, onBgOpacityChange, gridVisible, onToggleGrid, enemyHighlight, highlightLocked, onToggleEnemyHighlight, onToggleHighlightLocked }: {
  open: boolean; onToggle: () => void; onClose: () => void; hasPsd: boolean;
} & Pick<Props, 'bgOpacity' | 'onBgOpacityChange' | 'gridVisible' | 'onToggleGrid' | 'enemyHighlight' | 'highlightLocked' | 'onToggleEnemyHighlight' | 'onToggleHighlightLocked'>) {
  return (
    <div style={{ position: 'relative' }}>
      <BarButton active={open} onClick={onToggle} title="Opcions de vista de la teva pantalla">
        <SlidersIcon size={14} /> Vista
        {enemyHighlight && <Dot color={C.enemyHL} />}
      </BarButton>
      {open && (
        <Popover onClose={onClose} width={280} padding={14}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GridIcon size={14} color={C.dim} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: FS.md, fontWeight: 700, color: C.bright }}>Graella</span>
              <span style={{ fontSize: FS.xs, color: C.dim, lineHeight: 1.4 }}>A les pantalles dels jugadors. Tu la veus quan mous tokens o mesures.</span>
            </div>
            <Switch on={gridVisible} onChange={onToggleGrid} label="Graella visible" />
          </div>
          <div style={{ height: 1, background: C.border, margin: '12px 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="dm-bg-opacity" style={{ display: 'flex', justifyContent: 'space-between', fontSize: FS.md, fontWeight: 700, color: C.bright }}>
              Opacitat del mapa
              <span style={{ color: C.text, fontVariantNumeric: 'tabular-nums' }}>{Math.round(bgOpacity * 100)}%</span>
            </label>
            <input id="dm-bg-opacity" type="range" min={0.1} max={1} step={0.05} value={bgOpacity}
              onChange={e => onBgOpacityChange(parseFloat(e.target.value))} style={{ width: '100%' }} />
            <span style={{ fontSize: FS.xs, color: C.dim, lineHeight: 1.45 }}>
              Només a la teva pantalla: els jugadors veuen el mapa sempre opac.
            </span>
          </div>
          {hasPsd && (
            <>
              <div style={{ height: 1, background: C.border, margin: '12px 0' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: FS.md, fontWeight: 700, color: C.bright }}>Ressaltar enemics</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button active={enemyHighlight} color={C.enemyHL} onClick={onToggleEnemyHighlight} style={{ flex: 1, gap: 6, height: 32 }}>
                    <TargetIcon size={12} /> {enemyHighlight ? 'Ressaltant' : 'Ressaltar'}
                  </Button>
                  <Button active={highlightLocked} color={C.enemyHL} onClick={onToggleHighlightLocked}
                    aria-label="Fixar el ressaltat" title={highlightLocked ? 'Fixat: no s\'apaga sol' : 'Dura 3,5 s'} style={{ width: 40, height: 32, padding: 0 }}>
                    {highlightLocked ? <LockIcon size={12} /> : <UnlockIcon size={12} />}
                  </Button>
                </div>
                <span style={{ fontSize: FS.xs, color: C.dim, lineHeight: 1.45 }}>
                  {highlightLocked ? 'Fixat: es queda encès fins que el tornis a prémer.' : 'Dura 3,5 s. Amb el cadenat es queda fix.'}
                </span>
              </div>
            </>
          )}
        </Popover>
      )}
    </div>
  );
}

function MoreMenu({ open, onToggle, onClose, onShowShortcuts }: {
  open: boolean; onToggle: () => void; onClose: () => void; onShowShortcuts: () => void;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <BarButton active={open} onClick={onToggle} ariaLabel="Més opcions" title="Més opcions">
        <MoreHorizontal size={16} />
      </BarButton>
      {open && (
        <Popover onClose={onClose} width={240}>
          <MenuItem icon={<Keyboard size={14} />} label="Dreceres de teclat"
            hint={<kbd style={{ fontFamily: 'inherit', border: `1px solid ${C.border}`, borderRadius: RADIUS.sm, padding: '1px 5px' }}>?</kbd>}
            onClick={() => { onShowShortcuts(); onClose(); }} />
          <Link href="/admin" target="_blank" className="dm-menu-item" onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: RADIUS.md, fontSize: FS.md, fontWeight: 600, color: C.text, textDecoration: 'none' }}>
            <span style={{ display: 'flex', color: C.dim }}><Shield size={14} /></span>
            <span style={{ flex: 1 }}>Back office</span>
            <ExternalLink size={12} color={C.dim} />
          </Link>
          <MenuDivider />
          <span style={{ padding: '4px 10px 6px', fontSize: FS.xs, color: C.dim }}>RPG Map Viewer · {APP_VERSION}</span>
        </Popover>
      )}
    </div>
  );
}

/**
 * Preparar · Jugar. Cada mode només ensenya les seves eines i pestanyes (veure `lib/dm-mode`).
 * No canvia res del que veuen els jugadors.
 */
function ModeSwitch({ mode, onChange }: { mode: DMMode; onChange: (m: DMMode) => void }) {
  const opts: [DMMode, string, React.ReactNode, string][] = [
    ['preparar', 'Preparar', <WallIcon key="p" size={13} />, 'Construir el mapa: parets, portes, llums, graella i capes'],
    ['jugar', 'Jugar', <SwordsIcon key="j" size={13} />, 'A la taula: regla, dibuix, màgies i torns'],
  ];
  return (
    <div role="radiogroup" aria-label="Mode" style={{ display: 'flex', gap: 2, padding: 2, borderRadius: RADIUS.md + 2, background: C.bg, border: `1px solid ${C.border}`, flexShrink: 0 }}>
      {opts.map(([m, label, icon, title]) => {
        const on = mode === m;
        return (
          <button key={m} role="radio" aria-checked={on} onClick={() => onChange(m)} title={title}
            style={{
              height: 26, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', border: 'none', borderRadius: RADIUS.md,
              background: on ? tint(C.accent, 0.16) : 'transparent', color: on ? C.accent : C.dim,
              fontSize: FS.sm, fontWeight: 700, cursor: 'pointer', transition: 'background .15s, color .15s',
            }}>
            {icon} {label}
          </button>
        );
      })}
    </div>
  );
}

// ── La barra ─────────────────────────────────────────────────────────────────

/**
 * Barra superior del DM: l'únic lloc amb controls fora del mapa i del lateral. Porta
 * l'interruptor Preparar · Jugar (veure `lib/dm-mode`). Hi han anat a
 * parar la barreta de l'Expositor i el Revelador (ara «Mostrar als jugadors»), els xips de
 * dalt al centre (pantalles, desat, ressaltar, dreceres) i tot el peu del lateral (Modo
 * Jugador, Guardar/Cargar, servidor, Back Office, zoom i opacitat). El zoom ara és a la
 * cantonada del mapa (`CanvasHUD`).
 */
export function TopBar(p: Props) {
  const [menu, setMenu] = useState<MenuId | null>(null);
  const close = useCallback(() => setMenu(null), []);
  const toggle = (id: MenuId) => () => setMenu(m => (m === id ? null : id));
  const hasMap = p.mapName !== null;

  return (
    <header style={{
      position: 'relative', zIndex: 1, height: TOP_BAR_H, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
      padding: '0 12px', background: C.panel, borderBottom: `1px solid ${C.border}`,
    }}>
      <div style={{ width: IDENTITY_W, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        <DieIcon size={20} color={C.accent} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          {/* El nom del mapa és un títol: tipografia de títols (EB Garamond, `FONT_SERIF`). */}
          <span title={p.mapName ?? undefined}
            style={{ fontFamily: FONT_SERIF, fontSize: 17, fontWeight: 600, color: C.bright, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.mapName ? prettyName(p.mapName) : 'RPG Map Viewer'}
          </span>
          <span style={{ fontSize: FS.xs, color: C.dim }}>
            {!p.mapName ? 'Cap mapa obert' : p.hasPsd ? 'Mapa amb capes del PSD' : isVideoName(p.mapName) ? 'Mapa de vídeo' : 'Mapa d\'imatge'}
          </span>
        </div>
        <IconButton variant="ghost" size={28} onClick={p.onToggleSidebar} aria-pressed={p.sidebarOpen}
          aria-label={p.sidebarOpen ? 'Amagar el panell lateral' : 'Mostrar el panell lateral'}
          title={p.sidebarOpen ? 'Amagar el panell lateral (més espai per al mapa)' : 'Mostrar el panell lateral'}
          style={{ color: p.sidebarOpen ? C.dim : C.text }}>
          <PanelLeftIcon size={15} />
        </IconButton>
      </div>

      <ModeSwitch mode={p.mode} onChange={p.onModeChange} />

      {/* És cosa de la partida: a Preparar només surt si hi ha alguna cosa en pantalla
          (perquè es pugui amagar). */}
      {(p.mode === 'jugar' || p.showActive || p.showOpen) && (
        <BarButton active={p.showOpen} onClick={p.onToggleShow}
          title="Ensenya una imatge, un vídeo o un text a pantalla completa als jugadors">
          <ImageIcon size={14} /> Mostrar als jugadors
          {p.showActive && <Dot color={C.ok} />}
        </BarButton>
      )}

      <div style={{ flex: 1, minWidth: 0 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {/* Un sol desfer per a tot (traços, canvis del mapa, moviments de combat), i diu què
            desfarà: abans n'hi havia tres i el Ctrl+Z en triava un segons l'eina. */}
        <Button size="md" onClick={p.onUndo} disabled={!p.undoLabel}
          title={p.undoLabel ? `Desfer: ${p.undoLabel} (Ctrl+Z)` : 'No hi ha res a desfer'}
          style={{ height: 32, gap: 7, maxWidth: 230 }}>
          <RotateCcw size={14} />
          Desfer
          {p.undoLabel && (
            <span style={{ color: C.dim, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>· {p.undoLabel}</span>
          )}
        </Button>
        <ScreensMenu open={menu === 'screens'} onToggle={toggle('screens')} onClose={close}
          playerScreens={p.playerScreens} camAr={p.camAr} onOpenPlayer={p.onOpenPlayer} />
        <GameMenu open={menu === 'game'} onToggle={toggle('game')} onClose={close} hasMap={hasMap}
          autosaveEnabled={p.autosaveEnabled} autosaveAt={p.autosaveAt}
          onToggleAutosave={p.onToggleAutosave} onSaveNow={p.onSaveNow}
          onExport={p.onExport} onImport={p.onImport} onOpenServer={p.onOpenServer} />
        {hasMap && (
          <ViewMenu open={menu === 'view'} onToggle={toggle('view')} onClose={close} hasPsd={p.hasPsd}
            bgOpacity={p.bgOpacity} onBgOpacityChange={p.onBgOpacityChange}
            gridVisible={p.gridVisible} onToggleGrid={p.onToggleGrid}
            enemyHighlight={p.enemyHighlight} highlightLocked={p.highlightLocked}
            onToggleEnemyHighlight={p.onToggleEnemyHighlight} onToggleHighlightLocked={p.onToggleHighlightLocked} />
        )}
        <MoreMenu open={menu === 'more'} onToggle={toggle('more')} onClose={close} onShowShortcuts={p.onShowShortcuts} />
      </div>
    </header>
  );
}
