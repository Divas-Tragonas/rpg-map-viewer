'use client';
import React from 'react';
import { RotateCcw, TargetIcon, LockIcon, UnlockIcon, Monitor, Keyboard, Copy, Maximize2 } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { C, FS, RADIUS, SHADOW, tint } from '@/constants';
import { extraSeen } from '@/lib/camera';
import { agoLabel } from '@/lib/autosave';
import type { MapStructure, VisMap } from '@/types';

interface Props {
  ctrlPanActive: boolean;
  shiftPanActive: boolean;
  areaSelectMode: boolean;
  struct: MapStructure | null; vis: VisMap;
  enemyHighlight: boolean; highlightLocked: boolean;
  gridCalibrating: boolean;
  onResetView: () => void;
  onResetPrivate: () => void;
  onToggleEnemyHighlight: () => void;
  onToggleHighlightLocked: () => void;
  /** Pantalles de jugador connectades (id → mida en píxels CSS del seu canvas). */
  playerScreens: Record<string, { w: number; h: number; ts: number }>;
  /** Format (amplada/alçada) de l'enquadrament actual del DM; null si encara no n'hi ha. */
  camAr: number | null;
  /** Desat automàtic: estat de l'interruptor i marca de temps de l'últim desat correcte. */
  hasMap: boolean;
  autosaveEnabled: boolean;
  autosaveAt: number | null;
  onToggleAutosave: () => void;
  onSaveNow: () => void;
  /** Obre la pantalla de jugador en una finestra nova (la mateixa acció que «Modo Jugador»). */
  onOpenPlayer: () => void;
  /** Obre la finestra de dreceres de teclat. */
  onShowShortcuts: () => void;
}

const chip: React.CSSProperties = {
  background: C.float, border: `1px solid ${C.border}`, borderRadius: RADIUS.md, padding: '5px 9px',
  fontSize: FS.xs, fontWeight: 700, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 5,
};

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

function CopyRow({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);
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

/**
 * Pantalles de jugador connectades. Amb l'enquadrament sincronitzat en coordenades de MAPA
 * cap pantalla no veu menys que el DM, però una de format diferent veu MÉS mapa als costats:
 * el panell diu quantes n'hi ha i quant en veuen de més. Si no n'hi ha cap, el xip surt en
 * color d'avís i el panell ofereix obrir-ne una o l'adreça per a la tablet.
 */
function ScreensChip({ playerScreens, camAr, onOpenPlayer }: { playerScreens: Props['playerScreens']; camAr: Props['camAr']; onOpenPlayer: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [urls, setUrls] = React.useState<string[]>([]);
  const ids = Object.keys(playerScreens);
  const rows = ids.map(id => {
    const s = playerScreens[id];
    const ar = s.w / Math.max(s.h, 1);
    const ex = camAr ? extraSeen({ cx: 0, cy: 0, w: camAr, h: 1 }, ar) : null;
    return { id, s, ar, ex };
  });
  const worst = rows.reduce((m, r) => Math.max(m, r.ex ? r.ex.pct : 0), 0);
  const none = ids.length === 0;
  const col = none ? C.warn : worst >= 15 ? C.hpMid : C.hpHigh;
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => { setUrls(playerUrls()); setOpen(o => !o); }}
        title={none ? 'Cap pantalla de jugador connectada · clic per obrir-ne una' : `${ids.length} pantalla${ids.length === 1 ? '' : 'es'} de jugador · clic per veure-les`}
        style={{ ...chip, border: `1px solid ${tint(col, 0.35)}`, color: col, cursor: 'pointer' }}>
        <Monitor size={11} />
        {none ? 'Cap pantalla' : ids.length}
        {!none && worst > 0 && <span style={{ opacity: .8, fontWeight: 600 }}>+{worst}%</span>}
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 1 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8, zIndex: 2,
            width: 320, background: C.panel, border: `1px solid ${C.border}`, borderRadius: RADIUS.lg, boxShadow: SHADOW.menu,
            padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ fontSize: FS.md, fontWeight: 700, color: C.bright }}>Pantalles de jugador</div>
            {none ? (
              <div style={{ fontSize: FS.sm, color: C.dim, lineHeight: 1.45 }}>
                No n&apos;hi ha cap de connectada. Una pantalla apareix aquí uns segons després d&apos;obrir-se.
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
                <div style={{ fontSize: FS.xs, color: C.dim, marginTop: 2 }}>Tots veuen com a mínim tot el teu enquadrament.</div>
              </div>
            )}
            <Button variant="primary" block onClick={() => { onOpenPlayer(); setOpen(false); }} style={{ gap: 6 }}>
              <Maximize2 size={12} /> Obrir pantalla de jugador en aquest PC
            </Button>
            {urls.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ fontSize: FS.xs, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>A la tablet o al mòbil (mateixa wifi)</div>
                {urls.map(u => <CopyRow key={u} url={u} />)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Estat del desat automàtic. Sense això, l'autodesat seria màgia opaca: aquí es veu quan
 * s'ha desat per últim cop, es força un desat amb un clic i s'apaga amb el clic dret.
 */
function AutosaveChip({ enabled, savedAt, onToggle, onSaveNow }: {
  enabled: boolean; savedAt: number | null; onToggle: () => void; onSaveNow: () => void;
}) {
  // Es refresca sol perquè l'etiqueta («fa 2 min») no es quedi congelada entre desats.
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const iv = setInterval(() => tick(n => n + 1), 15_000);
    return () => clearInterval(iv);
  }, []);
  const col = !enabled ? C.dim : savedAt ? C.hpHigh : C.dim;
  const title = enabled
    ? `Desat automàtic actiu (cada 30 s i en amagar la pestanya).\n${savedAt ? `Últim desat: ${agoLabel(savedAt)}.` : 'Encara no s\'ha desat res.'}\n\nClic per desar ara · clic dret per apagar-lo.`
    : 'Desat automàtic apagat: si tanques o refresques, perdràs la partida.\n\nClic per encendre\'l.';
  return (
    <button
      onClick={() => (enabled ? onSaveNow() : onToggle())}
      onContextMenu={e => { e.preventDefault(); if (enabled) onToggle(); }}
      title={title}
      style={{ ...chip, border: `1px solid ${tint(col, 0.35)}`, color: col, cursor: 'pointer' }}>
      {enabled ? '⟳' : '⊘'}
      <span style={{ opacity: .85, fontWeight: 600 }}>
        {!enabled ? 'sense desar' : savedAt ? agoLabel(savedAt) : 'desant…'}
      </span>
    </button>
  );
}

function ModeBadge({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
  return (
    <div title={title}
      style={{ ...chip, background: tint(color, 0.15), border: `1px solid ${color}`, color, animation: 'pulse 1.5s infinite', pointerEvents: 'none', letterSpacing: '0.05em' }}>
      {children}
    </div>
  );
}

export function CanvasHUD({ ctrlPanActive, shiftPanActive, areaSelectMode, struct, enemyHighlight, highlightLocked, gridCalibrating, onResetView, onToggleEnemyHighlight, onToggleHighlightLocked, playerScreens, camAr, hasMap, autosaveEnabled, autosaveAt, onToggleAutosave, onSaveNow, onOpenPlayer, onShowShortcuts }: Props) {
  const iconBtn: React.CSSProperties = { ...chip, padding: '5px 7px', color: C.dim, cursor: 'pointer' };
  return (
    <>
      {gridCalibrating && (
        <div style={{ position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)', zIndex: 20, pointerEvents: 'none', background: C.float, border: `1px solid ${C.accent}`, borderRadius: RADIUS.md, padding: '6px 14px', fontSize: FS.sm, color: C.accent, fontWeight: 600, letterSpacing: '0.04em', whiteSpace: 'nowrap', boxShadow: `0 0 12px ${tint(C.accent, 0.27)}` }}>
          🎯 Arrossega sobre el mapa per definir una casella de la graella
        </div>
      )}
      <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, alignItems: 'center', pointerEvents: 'auto', zIndex: 10 }}>
        {ctrlPanActive && <ModeBadge color="#4ade80" title="Vista compartida temporal activa · toca CTRL per sortir (la vista torna on era)">CTRL</ModeBadge>}
        {shiftPanActive && <ModeBadge color={C.room} title="Vista privada activa: els jugadors no veuen el que mous · toca MAJ per sortir">MAJ</ModeBadge>}
        {areaSelectMode && <ModeBadge color={C.room} title="Selecció per àrea activa — arrossega per seleccionar tokens · prem A o Esc per sortir">▣ SELECCIÓ</ModeBadge>}
        <ScreensChip playerScreens={playerScreens} camAr={camAr} onOpenPlayer={onOpenPlayer} />
        {/* Sense mapa carregat no hi ha res a desar: el xip no apareix fins que n'hi ha un. */}
        {hasMap && <AutosaveChip enabled={autosaveEnabled} savedAt={autosaveAt} onToggle={onToggleAutosave} onSaveNow={onSaveNow} />}
        {hasMap && (
          <button onClick={onResetView} title="Restablir el zoom i la posició de la vista" style={iconBtn}>
            <RotateCcw size={11} />
          </button>
        )}
        {struct && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button onClick={onToggleEnemyHighlight}
              title={`Resaltar enemigos${highlightLocked ? ' (bloqueado ∞)' : ' (3.5s)'}`}
              style={{ ...chip, background: enemyHighlight ? tint(C.enemyHL, 0.18) : C.float, border: `1px solid ${enemyHighlight ? C.enemyHL : C.border}`, borderRadius: `${RADIUS.md}px 0 0 ${RADIUS.md}px`, padding: '5px 8px', cursor: 'pointer', color: enemyHighlight ? C.enemyHL : C.dim, gap: 4, boxShadow: enemyHighlight ? `0 0 10px ${tint(C.enemyHL, 0.25)}` : 'none', transition: 'all 0.2s', fontWeight: 600 }}>
              <TargetIcon size={11} />
              <span>Resaltar</span>
            </button>
            <button onClick={onToggleHighlightLocked}
              title={highlightLocked ? 'Bloqueado permanente' : 'Timer 3.5s'}
              style={{ ...chip, background: highlightLocked ? tint(C.enemyHL, 0.18) : C.float, border: `1px solid ${highlightLocked ? C.enemyHL : C.border}`, borderLeft: 'none', borderRadius: `0 ${RADIUS.md}px ${RADIUS.md}px 0`, padding: '5px 6px', cursor: 'pointer', color: highlightLocked ? C.enemyHL : C.dim, transition: 'all 0.2s' }}>
              {highlightLocked ? <LockIcon size={10} /> : <UnlockIcon size={10} />}
            </button>
          </div>
        )}
        <button onClick={onShowShortcuts} title="Dreceres de teclat (?)" style={iconBtn}>
          <Keyboard size={12} />
        </button>
      </div>
    </>
  );
}
