'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layers } from '@/components/icons';
import { TurnBanner } from '@/components/player/TurnBanner';
import { SheetCard } from '@/components/player/SheetCard';
import { SceneOverlay, type SceneController } from '@/components/player/SceneOverlay';
import { buildTurnBanner, sameBanner, EMPTY_BANNER, type TurnBanner as TurnBannerData } from '@/lib/turn-banner';
import { BC_CHANNEL, APP_VERSION } from '@/constants';
import {
  renderPaintedZones, renderShapePreview,
} from '@/lib/render/zones';
import { renderRooms, clearExploredAt } from '@/lib/render/darkrooms';
import { advanceStrokeAnim as _advStroke, replayStroke as _replayStroke } from '@/lib/render/drawing';
import { renderSpells, spellShake, followSpellPreview, spellsSettled } from '@/lib/render/spells';
import { renderTokenScene, blitLayer, renderDragGhost, nameScaleFor } from '@/lib/render/tokens';
import { renderGrid, renderDifficult, renderDMPointer, renderMeasureRuler, renderMoveRange } from '@/lib/render/grid';
import { playBossIntro, playPixelIntro, isPixelIntro, bossCamRect, seedFor, newCinematicCam, type BossIntro, type CinematicCam } from '@/lib/cinematic';
import { createSyncSocket, syncUrl, syncBlockedByMixedContent, hasSyncKey, probeApiReachable } from '@/lib/ws';
import { relayToParent } from '@/lib/relay';
import { usePlayerTokenDrag } from '@/hooks/usePlayerTokenDrag';
import { advanceTokenSpread } from '@/lib/render/token-geom';
import { buildMovePath, cellOf } from '@/lib/rooms/pathing';
import { effectiveWalls } from '@/lib/rooms/doors';
import { camToView, mapSizeFor, viewRect } from '@/lib/camera';
import type { MapSize, PosMap, Player, PaintedZone, Spell, ConditionsMap, DefeatedMap, TokenSizeMap, LibEnemy, Room, Wall, Door, TurnState, CamRect, Point, SpellPreview } from '@/types';
import type { SyncSocket, SyncState } from '@/lib/ws';
import type { AppStyle, SheetShow } from '@/types';
import { ensurePack, packReady, subscribePack } from '@/lib/sprites/pack';
import { FramePacer, wake, installWakeListeners, anyKey } from '@/lib/render/wake';
import { DialogHost } from '@/lib/dialog/host';
import { drawTileLive, drawTileDoorsOver, drawTileDoorEdgesOver, clipTileDoors, doorOpenById, tileBlocker, type TileLive } from '@/lib/tilemap/render';
import { PhosphorScreen, scanlinePx } from '@/lib/phosphor/screen';

// Diagnòstic de connexió de la pantalla d'espera. Sense això, un mòbil que no pot
// arribar al DM ensenyava exactament el mateix que un mòbil ben connectat esperant que
// el DM carregui un mapa: "Esperant al Dungeon Master...", per sempre i sense cap pista.
//
// Els dos fracassos que des de fora es veuen IGUAL i que aquí se separen:
//   · el servidor rebutja la clau (codi 4401, veure api-spec.txt) → el host respon;
//   · no s'arriba al host (codi 1006) → Mac apagat, funnel tancat, sense xarxa.
// Per això, quan el socket es tanca, es prova el host per HTTP (`probeApiReachable`).
// Component a nivell de mòdul (no dins de PlayerView) com la resta de l'app.
export interface ConnInfo { url: string; mixed: boolean; hasKey: boolean }

// És una adreça de xarxa local? Decideix quins consells tenen sentit: els de la wifi i
// el port 3000 no ajuden gens si la API va per un host públic (Tailscale Funnel).
function isLanHost(host: string): boolean {
  const h = host.replace(/:\d+$/, '');
  return h === 'localhost' || h === '127.0.0.1' || /^192\.168\./.test(h) || /^10\./.test(h)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h.endsWith('.local');
}

function ConnDiag({ conn, info, reachable }: { conn: SyncState; info: ConnInfo | null; reachable: boolean | null }) {
  if (!info) return null;
  const host = (() => { try { return new URL(info.url).host; } catch { return info.url; } })();
  // Els consells de wifi i port 3000 només valen si la API és a la xarxa local; amb un
  // host públic (Tailscale Funnel) el que cal comprovar és una altra cosa.
  const lan = isLanHost(host);
  const box: React.CSSProperties = {
    marginTop: 10, maxWidth: 460, width: '100%', textAlign: 'center', fontSize: 12, lineHeight: 1.5,
    padding: '8px 12px', borderRadius: 8, border: '1px solid #21262d', background: 'rgba(255,255,255,0.03)',
  };
  const bad: React.CSSProperties = { ...box, borderColor: '#7d3a2e', color: '#ffb4a2' };

  if (info.mixed) return (
    <div style={bad}>
      Aquesta pàgina va per <b>https</b> i la API per <b>http</b>: el navegador bloqueja la connexió
      (contingut mixt). Obre l&apos;app amb la mateixa adreça que la API, o dóna-li https.
    </div>
  );
  if (conn.status === 'open') return (
    <div style={{ ...box, color: '#7ee787' }}>● Connectat a {host} — esperant que el DM comparteixi el mapa.</div>
  );
  if (conn.status === 'connecting') return (
    <div style={{ ...box, color: '#8b949e' }}>○ Connectant amb {host}…</div>
  );

  // Tancat: el codi diu de què es tracta.
  if (conn.code === 4401 || /key/i.test(conn.reason ?? '')) return (
    <div style={bad}>
      <b>{host}</b> ha rebutjat la connexió: <b>clau de sincronització incorrecta</b> (codi 4401
      {info.hasKey ? '' : ', i aquest build no en porta cap'}).{' '}
      La <code>NEXT_PUBLIC_SYNC_KEY</code> del frontend ha de ser la mateixa que la{' '}
      <code>SYNC_KEY</code> de la API, i cal tornar a desplegar després de canviar-la.
    </div>
  );
  if (reachable === false) return (
    <div style={bad}>
      ✕ No s&apos;arriba a <b>{host}</b>{conn.code ? ` (codi ${conn.code})` : ''}.{' '}
      {lan
        ? 'Comprova que ets a la mateixa wifi que el PC del DM i que la API (port 3000) està engegada.'
        : 'Comprova que l\u2019ordinador de la API està encès i despert, que la API està engegada i que el túnel públic (Tailscale Funnel) segueix actiu.'}
    </div>
  );
  return (
    <div style={bad}>
      ✕ Sense connexió amb <b>{host}</b>{conn.code ? ` (codi ${conn.code}${conn.reason ? `: ${conn.reason}` : ''})` : ''}{' '}— s&apos;està reintentant.{' '}
      {reachable === true
        ? 'El host respon per HTTP, així que el problema és el WebSocket: clau de sincronització o alguna cosa entremig que el bloqueja.'
        : (lan
          ? 'Comprova que ets a la mateixa wifi que el PC del DM i que la API (port 3000) està engegada.'
          : 'Comprova que la API està engegada i accessible des d\u2019aquest dispositiu.')}
    </div>
  );
}

export function PlayerView() {
  const [bgLoaded,   setBgLoaded]   = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  // Estat de la connexió amb la API i adreça a la qual truca (per ensenyar-los a la
  // pantalla d'espera). Els omple el socket (veure el seu efecte).
  const [conn, setConn] = useState<SyncState>({ status: 'connecting' });
  const [syncInfo, setSyncInfo] = useState<ConnInfo | null>(null);
  // El host respon per HTTP? (null = encara no s'ha comprovat). Veure ConnDiag.
  const [apiReachable, setApiReachable] = useState<boolean | null>(null);
  const probingRef = useRef(false);

  const stageRef  = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRef  = useRef<HTMLElement | null>(null);
  const bgTransitionRef = useRef<HTMLDivElement>(null);
  // Fitxa d'un personatge que ensenya el DM (pestanya «Fitxa» de Mostrar als jugadors).
  const [sheet, setSheet] = useState<SheetShow | null>(null);

  // Mida del mapa que ha comunicat el DM; `null` = encara no hi ha mapa (no es pinta res).
  const rMapSize     = useRef<MapSize | null>(null);
  /** Mida real del fons del DM (coordenades de mapa); `null` = la de la imatge rebuda. */
  const rBgSize      = useRef<MapSize | null>(null);
  const rPos         = useRef<PosMap>({});
  const rZoom        = useRef(1);
  const rPlayers     = useRef<Player[]>([]);
  const rLibEnemies  = useRef<LibEnemy[]>([]);
  const rConditions  = useRef<ConditionsMap>({});
  const rDefeated    = useRef<DefeatedMap>({});
  const rPaintedZones = useRef<PaintedZone[]>([]);
  const rRooms        = useRef<Room[]>([]);
  // Parets: no es dibuixen al jugador, però calen per a la línia de visió de la llum
  // dels tokens (sales fosques) i per a la col·lisió de moviment del drag local.
  const rWalls        = useRef<Wall[]>([]);
  // Portes: forats a les parets per on passen la llum i el moviment.
  const rDoors        = useRef<Door[]>([]);
  // Punts de llum (torxes): il·luminen la seva sala quan hi ha un token de jugador dins.
  const rLights       = useRef<import('@/types').LightSource[]>([]);
  const rDifficult    = useRef<readonly string[]>([]);
  const roomRevealAnimRef = useRef<Record<string, number>>({});
  const rActiveSpells = useRef<Spell[]>([]);
  const rGridVisible  = useRef(false);
  const rGridSize     = useRef(70);
  const rGridSnap     = useRef(false);
  const rGridLineWidth = useRef(1.5);
  const rGridOriginX  = useRef(0);
  const rGridOriginY  = useRef(0);
  const rEnemyHighlight = useRef(false);
  const rTokenSizeOverride = useRef<TokenSizeMap>({});
  const rPointerPos   = useRef<{ x: number; y: number } | null>(null);
  const rMeasure      = useRef<{ a: { x: number; y: number } | null; b: { x: number; y: number } | null }>({ a: null, b: null });
  // Màgia que el DM està apuntant: l'última rebuda i la que es pinta (s'hi acosta amb LERP).
  const rSpellPreviewTarget = useRef<SpellPreview | null>(null);
  const rSpellPreview       = useRef<SpellPreview | null>(null);
  const rSelectedToken = useRef<number | string | null>(null);
  const rMultiSelected = useRef<Set<number | string>>(new Set());
  // Previsualització del destí durant el drag d'un token de jugador (ghost).
  const rDragPreview   = useRef<{ id: string; x: number; y: number } | null>(null);
  // Camí de moviment pendent per token (vorejant parets, forma d'L; ease-out per arc).
  const rMovePath      = useRef<Record<string, { pts: { x: number; y: number }[]; t: number }>>({});
  const rTurn          = useRef<TurnState>({ active: false, order: [], turnIndex: 0, round: 1, activeRemainingFt: 0 });
  // App Píxel: estil que mana el DM i parts vives del mapa de caselles (aigua, torxes, portes).
  const rAppStyle      = useRef<AppStyle>('pixel');
  const rTileLive      = useRef<TileLive | null>(null);
  const [pixel, setPixel] = useState(false);
  // Mode Fòsfor (TV de tub antiga, veure `lib/phosphor/screen.ts`). `phosphorRef` = el que es
  // pinta ara; `phosphorTargetRef` = el que demana el DM (durant l'animació d'apagar i encendre
  // poden ser diferents). `tubeRef` embolcalla tota la pantalla per a l'animació.
  const phosphorRef       = useRef(false);
  const phosphorTargetRef = useRef(false);
  const phosphorBusyRef   = useRef(false);
  const phosphorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const phosphorScreenRef = useRef<PhosphorScreen | null>(null);
  const phosphorGlassRef  = useRef<HTMLDivElement | null>(null);
  const tubeRef           = useRef<HTMLDivElement | null>(null);
  const flashRef          = useRef<HTMLDivElement | null>(null);
  const [phosphor, setPhosphorUi] = useState(false);

  const rPanOffset    = useRef({ x: 0, y: 0 });
  // Enquadrament del DM en coordenades de MAPA. És l'autoritat de la càmera: cada frame
  // es tradueix al zoom/pan d'AQUESTA finestra (regla "contain" a `camToView`), així el
  // format i la mida de pantalla deixen de canviar què es veu. `rZoom`/`rPanOffset`
  // (píxels del DM) només s'usen si el DM és una versió antiga que no envia `cam`.
  const rCam          = useRef<CamRect | null>(null);
  const visualZoomRef = useRef(1);
  const visualPanRef  = useRef({ x: 0, y: 0 });
  const visualPosRef  = useRef<PosMap>({});
  // Pantalla incrustada (`/player?embed=1`): el tauler de missions de la wiki la posa dins d'un
  // iframe i hi fa l'onada que transforma el mapa pintat en el de píxel. `fit` = ensenyar el
  // mapa sencer (com la imatge de l'onada) en lloc de la càmera del DM; `glide` = anar d'un a
  // l'altre lent. Veure l'efecte de sota i el tick.
  const embedRef      = useRef({ on: false, fit: false, glide: false });
  const zoneAppearRef = useRef<Record<string, number>>({});

  const drawCanvasRef    = useRef<HTMLCanvasElement | null>(null);
  const strokeQueueRef   = useRef<import('@/types').StrokeAnimState[]>([]);
  const activeStrokeAnim = useRef<import('@/types').StrokeAnimState | null>(null);

  const defeatedAnimRef  = useRef<Record<string, number>>({});
  const invisAlphaRef    = useRef<Record<string, number>>({});
  const rHighlightAlpha  = useRef(0);
  const rHighlightLocked = useRef(false);
  const highlightStartRef = useRef<number | null>(null);
  const rGridCalibrating  = useRef(false);
  const rGridDmAlpha      = useRef(0);
  const gridCalibRef      = useRef(null);
  const gridCalibCurrRef  = useRef(null);
  const gridCalibHoverRef = useRef(null);
  const rContextMenu      = useRef(null);
  const rDMPreviewActive = useRef(false);
  const rDMPreviewZoom   = useRef(1);
  const rDMPreviewPan    = useRef({ x: 0, y: 0 });

  const cinematicRef         = useRef<BossIntro | null>(null);
  // Només es fa servir `rect`: el LERP de càmera del jugador ja suavitza l'anada i la tornada.
  const cinematicCamRef      = useRef<CinematicCam>(newCinematicCam());
  // Diàleg en curs (camp `dialog` del STATE/STRUCT): caixa, globus i objectiu de la càmera.
  const dialogHostRef        = useRef<DialogHost | null>(null);

  const bcRef = useRef<BroadcastChannel | null>(null);
  // Handler únic dels missatges del DM: el criden tant el BroadcastChannel (finestres
  // del mateix PC) com el WebSocket (tablet i mòbil). Va en una ref perquè el WS NO
  // depengui que el BroadcastChannel existeixi — veure la guarda del seu efecte.
  const bcHandlerRef = useRef<((ev: MessageEvent) => Promise<void> | void) | null>(null);
  const wsRef = useRef<SyncSocket | null>(null);
  // Identificador d'aquesta pantalla (efímer, per sessió de pestanya): permet al DM
  // distingir-la de la resta al llistat de pantalles connectades del DM (menú de pantalles de la barra superior).
  // (Es genera al primer report, no al render: el render ha de ser pur.)
  const screenIdRef = useRef('');
  const _reportViewport = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    if (!screenIdRef.current) screenIdRef.current = Math.random().toString(36).slice(2, 8);
    const msg = { type: 'VIEWPORT', id: screenIdRef.current, w, h };
    bcRef.current?.postMessage(msg);
    wsRef.current?.send(JSON.stringify(msg));
  }, []);
  const pendingBgMetaRef = useRef<{ mimeType: string; withFade?: boolean } | null>(null);
  // Escena (imatge + subtítols): el mèdia arriba pel WS amb la capçalera `EXPOSITOR_SHOW_META`
  // (de l'antic Expositor) marcada `target: 'scene'`: el servidor només reenvia tipus coneguts.
  const pendingSceneMetaRef = useRef<{ mimeType: string; id: string } | null>(null);
  const sceneCtlRef = useRef<SceneController | null>(null);
  const rafRef = useRef<number>(0);
  const _ctx2dRef = useRef<CanvasRenderingContext2D | null>(null);
  const isShapeDrawingRef = useRef(false);
  const shapePointsRef    = useRef<{ x: number; y: number }[]>([]);

  const [activeSpells, setActiveSpells] = useState<Spell[]>([]);

  // Rètol de torn (TV i tablet): projecció del combat al que es veu, per no re-renderitzar
  // aquesta pantalla a cada STATE (n'arriben ~20/s mentre el DM fa pan o zoom).
  const [turnBanner, setTurnBanner] = useState<TurnBannerData>(EMPTY_BANNER);
  const refreshTurnBanner = useCallback(() => {
    const next = buildTurnBanner({
      turn: rTurn.current, players: rPlayers.current, libEnemies: rLibEnemies.current,
      conditions: rConditions.current,
    });
    setTurnBanner(prev => sameBanner(prev, next) ? prev : next);
  }, []);

  // Dedupe del fons: el DM reenvia el BG sencer a cada PLAYER_READY (reconnexions del
  // WS cada pocs segons si la xarxa falla) i, en un mateix ordinador, el jugador el rep
  // duplicat (BC + relay del WS). Recrear l'<img> per un fons idèntic provoca un flaix
  // de "refresc" visible; amb una firma barata (mida + hash mostrejat) es descarta.
  const bgSigRef = useRef('');
  const bgObjectUrlRef = useRef<string | null>(null);
  // Guarda de reentrada + firma del mapa per al handler asíncron de STRUCT: el DM
  // reenvia un STRUCT complet cada cop que es connecta una pantalla nova, i sense
  // aquestes guardes dos STRUCT concurrents (o un de reenviat idèntic) reconstruïen
  // les imatges i reiniciaven el suavitzat a TOTES les pantalles alhora → tot
  // desapareixia i els tokens saltaven. Veure el handler de STRUCT.

  // ── Dibuix a ploma: base + historial ───────────────────────────────────────
  // El DM només conserva com a objectes els últims traços; els més antics li arriben ja
  // rasteritzats dins de `strokeBaseline`. La imatge es guarda aquí perquè un `UNDO_DRAW`
  // que no en porti (la base no ha canviat) pugui reconstruir el dibuix igualment.
  const strokeBaseImgRef = useRef<HTMLImageElement | null>(null);
  /** Seqüència de reconstruccions: la descàrrega de la base és asíncrona i una de vella
   *  no ha de trepitjar una de nova. */
  const drawSeqRef = useRef(0);

  const _rebuildDrawing = useCallback(async (hist: import('@/types').StrokeData[], baseline?: string | null) => {
    const mySeq = ++drawSeqRef.current;
    if (baseline !== undefined) {
      if (!baseline) {
        strokeBaseImgRef.current = null;
      } else {
        const img = await new Promise<HTMLImageElement | null>(res => {
          const im = new Image();
          im.onload = () => res(im);
          im.onerror = () => res(null);
          im.src = baseline;
        });
        if (drawSeqRef.current !== mySeq) return;
        strokeBaseImgRef.current = img;
      }
    }
    const oc = drawCanvasRef.current; if (!oc) return;
    const ctx2 = oc.getContext('2d'); if (!ctx2) return;
    ctx2.clearRect(0, 0, oc.width, oc.height);
    const base = strokeBaseImgRef.current;
    if (base) ctx2.drawImage(base, 0, 0, oc.width, oc.height);
    for (const stroke of hist) _replayStroke(ctx2, stroke);
    wake();  // la base arriba de manera asíncrona: repintar
  }, []);
  const _bgChanged = useCallback((buf: ArrayBuffer, mime: string) => {
    const u8 = new Uint8Array(buf);
    let h = 0;
    const step = Math.max(1, u8.length >> 8);
    for (let i = 0; i < u8.length; i += step) h = (h * 31 + u8[i]) >>> 0;
    const sig = `${mime}:${u8.length}:${h}`;
    if (sig === bgSigRef.current && mediaRef.current) return false;
    bgSigRef.current = sig;
    return true;
  }, []);

  const _loadBgFromUrl = useCallback((url: string, mimeType: string, withFade: boolean) => {
    const stage = stageRef.current; if (!stage) return;
    const overlay = bgTransitionRef.current;
    const doLoad = () => {
      if (mediaRef.current) { mediaRef.current.remove(); mediaRef.current = null; }
      if (bgObjectUrlRef.current && bgObjectUrlRef.current !== url) URL.revokeObjectURL(bgObjectUrlRef.current);
      bgObjectUrlRef.current = url;
      const isVid = mimeType && mimeType.startsWith('video/');
      const el = document.createElement(isVid ? 'video' : 'img') as HTMLVideoElement & HTMLImageElement;
      el.style.cssText = 'position:absolute;pointer-events:none;display:block;top:0;left:0;';
      if (isVid) { el.autoplay = true; el.loop = true; el.muted = true; el.playsInline = true; }
      el.src = url;
      stage.appendChild(el);
      mediaRef.current = el;
      setBgLoaded(true);
      if (overlay) setTimeout(() => { overlay.style.opacity = '0'; }, 80);
    };
    if (withFade && overlay) { overlay.style.opacity = '1'; setTimeout(doLoad, 520); }
    else doLoad();
  }, []);

  // Cortina del canvi d'escena: es tanca de seguida i s'obre quan el fons nou s'ha carregat
  // (màx. 5 s). En obrir-se en una escena nova, s'oblida la boira explorada de l'anterior i
  // els tokens hi apareixen directament (sense lliscar des d'on eren).
  // Mode Fòsfor: la TV s'apaga (la imatge s'aplana en una ratlla blanca), canvia de mode i
  // s'encén. Si el DM el torna a tocar mentre dura, en acabar d'apagar-se s'aplica l'últim.
  const _setPhosphor = useCallback((on: boolean) => {
    if (phosphorTargetRef.current === on) return;
    phosphorTargetRef.current = on;
    if (phosphorBusyRef.current) return;
    const apply = () => { phosphorRef.current = phosphorTargetRef.current; setPhosphorUi(phosphorTargetRef.current); };
    const tube = tubeRef.current, flash = flashRef.current;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!tube || !flash || calm || typeof tube.animate !== 'function') { apply(); return; }
    const cycle = () => {
      phosphorBusyRef.current = true;
      const off = tube.animate([
        { transform: 'scale(1, 1)' }, { transform: 'scale(1, 0.006)', offset: 0.6 }, { transform: 'scale(0, 0.006)' },
      ], { duration: 340, easing: 'ease-in' });
      flash.animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.6 }, { opacity: 1 }], { duration: 340, easing: 'ease-in' });
      off.onfinish = () => {
        apply();
        const up = tube.animate([
          { transform: 'scale(0, 0.006)' }, { transform: 'scale(1, 0.006)', offset: 0.3 }, { transform: 'scale(1, 1)' },
        ], { duration: 520, easing: 'ease-out' });
        flash.animate([{ opacity: 1 }, { opacity: 0.8, offset: 0.3 }, { opacity: 0 }], { duration: 520, easing: 'ease-out' });
        up.onfinish = () => {
          phosphorBusyRef.current = false;
          // El DM l'ha tornat a canviar mentre s'encenia: una altra volta.
          if (phosphorTargetRef.current !== phosphorRef.current) cycle();
        };
      };
    };
    cycle();
  }, []);

  // Reconcilia la llista de spells d'àrea amb la font de veritat del DM (STATE/STRUCT).
  // Conserva el startTime dels spells ja presents (perquè no reiniciïn l'animació) i
  // afegeix/treu la resta. Així un SPELL o DELETE_SPELL perdut per la xarxa s'acaba
  // corregint: els d'àrea (dormir/grasa) desapareixen quan el DM els esborra encara
  // que el missatge puntual no hagi arribat.
  const _reconcileSpells = useCallback((incoming: Spell[]) => {
    const now = performance.now();
    const cur = new Map(rActiveSpells.current.map(s => [s.id, s]));
    const next = incoming.map(sp => cur.get(sp.id) ?? { ...sp, startTime: now });
    rActiveSpells.current = next;
    setActiveSpells(next);
  }, []);

  // Calcula i desa el camí (vorejant parets, forma d'L) que ha de recórrer un token de
  // jugador de `from` a `to`, perquè la seva llum no talli per sales fosques que no
  // travessa. Sense grid/parets o si són adjacents, no desa camí (moviment recte).
  const _setMovePath = useCallback((id: string, from: { x: number; y: number } | undefined, to: { x: number; y: number }) => {
    if (!from) return;
    const gs = rGridSize.current;
    if (gs <= 0) { delete rMovePath.current[id]; return; }
    const walls = effectiveWalls(rWalls.current, rDoors.current);
    const blocked = tileBlocker(rTileLive.current, rDoors.current);
    if (walls.length === 0 && !blocked) { delete rMovePath.current[id]; return; }
    const grid = {
      gs,
      gox: ((rGridOriginX.current % gs) + gs) % gs,
      goy: ((rGridOriginY.current % gs) + gs) % gs,
    };
    const R = rTokenSizeOverride.current[id] ?? 22;
    const [sCol, sRow] = cellOf(from, R, grid);
    const [dCol, dRow] = cellOf(to, R, grid);
    // Mateixa casella (p. ex. l'eco del relay del propi token que ja s'ha mogut): no-op,
    // no esborrar un camí ja fixat en deixar anar.
    if (sCol === dCol && sRow === dRow) return;
    const pts = buildMovePath(from, to, { walls, grid, R, blocked });
    if (!pts) { delete rMovePath.current[id]; return; }
    rMovePath.current[id] = { pts, t: 0 };
  }, []);

  const triggerBossIntro = useCallback((d: {
    tokenId: number | string; bossName: string; tokenPos: Point | null; cam?: CamRect | null;
    portrait: HTMLCanvasElement | HTMLImageElement | null; offsetMs: number;
    style?: string; sprite?: string | null; party?: { name: string; sprite?: string }[];
    extras?: { name: string; sprite?: string | null; img?: string | null }[]; message?: string | null;
  }) => {
    const stage = stageRef.current; if (!stage) return;
    // El DM no en llança cap altra fins que s'acaba la que corre: si n'arriba una,
    // aquesta pantalla anava endarrerida. Es reemplaça.
    cinematicRef.current?.dispose();
    // Les de pixel art necessiten el paquet: una pantalla sense els fulls fa la clàssica.
    const pixel = isPixelIntro(d.style) && packReady();
    let cam = d.cam ?? null;
    if (!cam && d.tokenPos && !pixel) {
      // DM antic (sense `cam`): es calcula aquí a partir de l'enquadrament compartit.
      const { mw, mh } = mapSizeFor(mediaRef.current, rBgSize.current);
      const cvs = canvasRef.current;
      const cur = rCam.current ?? (cvs?.clientWidth ? viewRect(cvs.clientWidth, cvs.clientHeight, mw, mh, rZoom.current, rPanOffset.current) : null);
      if (cur) cam = bossCamRect(d.tokenPos, cur, mw, mh);
    }
    cinematicCamRef.current.rect = cam;
    const common = {
      stage, bossName: d.bossName, portrait: d.portrait, seed: seedFor(d.tokenId), offsetMs: d.offsetMs,
      onCamEnd: () => { cinematicCamRef.current.rect = null; },
      onDone: () => {
        if (cinematicRef.current !== intro) return;
        cinematicRef.current = null;
        cinematicCamRef.current.rect = null;
      },
    };
    const intro = pixel && isPixelIntro(d.style)
      ? playPixelIntro({
        ...common, style: d.style, sprite: d.sprite ?? null, party: d.party ?? [], message: d.message,
        // La imatge d'un enemic sense figureta arriba en dataURL: es pinta quan s'ha carregat.
        extras: (d.extras ?? []).map(f => {
          let img: HTMLImageElement | null = null;
          if (f.img) { img = new Image(); img.src = f.img; }
          return { name: f.name, sprite: f.sprite ?? null, img };
        }),
      })
      : playBossIntro(common);
    cinematicRef.current = intro;
  }, []);

  const skipBossIntro = useCallback(() => {
    cinematicRef.current?.skip();
    cinematicCamRef.current.rect = null;
  }, []);

  const triggerBossIntroRef = useRef(triggerBossIntro);
  const skipBossIntroRef    = useRef(skipBossIntro);

  useEffect(() => {
    const oc = document.createElement('canvas');
    oc.width = 1; oc.height = 1;
    drawCanvasRef.current = oc;
    const host = new DialogHost(() => stageRef.current, {
      rPos, rPlayers, rLibEnemies, rTokenSizeOverride, rDefeated, rConditions, rRooms, visualPosRef,
    }, () => rAppStyle.current === 'pixel');
    dialogHostRef.current = host;
    return () => { host.dispose(); dialogHostRef.current = null; };
  }, []);

  // Drag de tokens de jugador (només pl_*) amb ratolí o tacte (mòbil/tablet)
  const tokenDrag = usePlayerTokenDrag(
    canvasRef,
    mediaRef as React.MutableRefObject<HTMLElement | null>,
    rPos, rZoom, rPanOffset,
    rPlayers, rTokenSizeOverride,
    rGridSnap, rGridSize, rGridOriginX, rGridOriginY,
    rSelectedToken,
    wsRef,
    bcRef,
    rTurn,
    rWalls,
    rDoors,
    rDragPreview,
    rMovePath,
    rConditions,
    rTileLive,
    rAppStyle,
    rDifficult,
    rBgSize,
  );
  const tokenDragRef = tokenDrag.dragRef;

  /**
   * El STATE no repeteix la imatge (base64) dels enemics que aquesta pantalla ja té: un enemic
   * que arriba sense el camp `imageData` conserva la que tenia (`null` vol dir «sense imatge»).
   */
  const _keepEnemyImages = (list: LibEnemy[], prev: LibEnemy[]): LibEnemy[] => {
    if (!list.some(e => e.imageData === undefined)) return list;
    const had = new Map(prev.map(e => [e.id, e.imageData]));
    return list.map(e => e.imageData === undefined ? { ...e, imageData: had.get(e.id) ?? null } : e);
  };

  useEffect(() => {
    let packAsked = false;
    const handleMsg = async (ev: MessageEvent) => {
      const msg = ev.data;
      wake();  // tot missatge pot canviar el que es pinta (veure `lib/render/wake.ts`)
      // Paquet de sprites (`public/sprites/`, ~720 KB en 15 fulls): només quan cal. Una partida
      // en estil Clàssic no en pinta cap; el demanen l'estil Píxel, una fitxa, un diàleg o una
      // cinemàtica. `ensurePack` és idempotent (un sol intent de càrrega).
      if (!packAsked && (msg.appStyle === 'pixel' || msg.sheet || msg.dialog || msg.type === 'BOSS_INTRO')) {
        packAsked = true;
        void ensurePack().then(() => { if (!packReady()) packAsked = false; refreshTurnBanner(); });
      }

      if (msg.type === 'BG') {
        if (!_bgChanged(msg.buffer, msg.mimeType)) return;
        const blob = new Blob([msg.buffer], { type: msg.mimeType });
        const url  = URL.createObjectURL(blob);
        _loadBgFromUrl(url, msg.mimeType, !!msg.withFade);
      } else if (msg.type === 'STRUCT') {
        rMapSize.current = msg.mapSize ?? null;
        if (msg.bgSize !== undefined) rBgSize.current = msg.bgSize;
        rPos.current    = msg.pos   || {};
        rZoom.current   = msg.zoom  ?? 1;
        rPlayers.current = msg.players || [];
        if (msg.conditions)    rConditions.current    = msg.conditions;
        if (msg.defeated)      rDefeated.current      = msg.defeated;
        if (msg.paintedZones)  rPaintedZones.current  = msg.paintedZones;
        if (msg.rooms) {
          rRooms.current = msg.rooms;
          // Inicialitzar l'anim de revelat perquè no hi hagi flaix en connectar.
          const anim: Record<string, number> = {};
          for (const rm of msg.rooms as Room[]) anim[rm.id] = rm.dark && !rm.revealed ? 1 : 0;
          roomRevealAnimRef.current = anim;
        }
        if (msg.walls) rWalls.current = msg.walls;
        if (msg.doors) rDoors.current = msg.doors;
        if (msg.lights) rLights.current = msg.lights;
        if (msg.difficult) rDifficult.current = msg.difficult;
        if (msg.panOffset)     rPanOffset.current     = msg.panOffset;
        if (msg.cam)           rCam.current           = msg.cam;
        if (msg.gridVisible   !== undefined) rGridVisible.current   = msg.gridVisible;
        if (msg.gridSize      !== undefined) rGridSize.current      = msg.gridSize;
        if (msg.gridSnap      !== undefined) rGridSnap.current      = msg.gridSnap;
        if (msg.gridOriginX   !== undefined) rGridOriginX.current   = msg.gridOriginX;
        if (msg.gridOriginY   !== undefined) rGridOriginY.current   = msg.gridOriginY;
        if (msg.gridLineWidth !== undefined) rGridLineWidth.current = msg.gridLineWidth;
        if (msg.enemyHighlight !== undefined) {
          rEnemyHighlight.current = msg.enemyHighlight;
          if (msg.enemyHighlight) highlightStartRef.current = performance.now();
          else highlightStartRef.current = null;
        }
        if (msg.highlightLocked !== undefined) rHighlightLocked.current = msg.highlightLocked;
        if (msg.tokenSizeOverride !== undefined) rTokenSizeOverride.current = msg.tokenSizeOverride;
        if (msg.libEnemies) rLibEnemies.current = msg.libEnemies;
        if (msg.appStyle) { rAppStyle.current = msg.appStyle; setPixel(msg.appStyle === 'pixel'); }
        // Mode Fòsfor (lleuger, sempre). Absent → DM antic: no tocar res.
        if (msg.phosphor !== undefined) _setPhosphor(!!msg.phosphor);
        if (msg.tileLive !== undefined) rTileLive.current = msg.tileLive;
        // Diàleg: també al STRUCT, perquè una tablet que es connecta a mitja conversa la vegi.
        if (msg.dialog !== undefined) dialogHostRef.current?.apply(msg.dialog);
        // Fitxa d'un personatge (pesat: només arriba quan canvia; null = amagada).
        if (msg.sheet !== undefined) setSheet(msg.sheet);
        if (msg.measure) rMeasure.current = { a: msg.measure.a ?? null, b: msg.measure.b ?? null };
        if (msg.pointerPos !== undefined) rPointerPos.current = msg.pointerPos;
        if (msg.spellPreview !== undefined) rSpellPreviewTarget.current = msg.spellPreview;
        if (msg.turn) rTurn.current = msg.turn;
        refreshTurnBanner();
        if (msg.activeSpells) _reconcileSpells(msg.activeSpells);

        // Cada STRUCT reinicia el suavitzat dels tokens: les posicions visuals partirien
        // de les d'abans i, en canviar de mapa o d'escena, els tokens hi lliscarien.
        visualPosRef.current = {};
        strokeQueueRef.current  = [];
        activeStrokeAnim.current = null;
        Object.entries(msg.pos || {}).forEach(([id, p]) => {
          visualPosRef.current[id] = { ...(p as { x: number; y: number }) };
        });

        if (msg.mapSize) {
          const oc = drawCanvasRef.current;
          if (oc && (oc.width !== msg.mapSize.width || oc.height !== msg.mapSize.height)) {
            oc.width = msg.mapSize.width; oc.height = msg.mapSize.height;
          }
        }
        // Reconstruir el dibuix a ploma des de l'historial (late join / càrrega de partida):
        // els STROKE són incrementals, així que sense això una pantalla que no hi era quan
        // es van dibuixar els traços (o després de carregar una partida) no els veu.
        // ⚠️ Comprovació explícita d'`undefined`: un historial BUIT (`[]`) és falsy però
        // vol dir «no hi ha dibuix», i s'ha de netejar el canvas igualment (si no, qui es
        // connecta després d'un «esborrar-ho tot» es quedaria amb els traços vells).
        if (msg.strokeHistory !== undefined || msg.strokeBaseline !== undefined) {
          strokeQueueRef.current = []; activeStrokeAnim.current = null;
          void _rebuildDrawing(msg.strokeHistory || [], msg.strokeBaseline);
        }
        setPlayerReady(true);
        setBgLoaded(true);
      } else if (msg.type === 'STATE') {
        if (msg.pos) {
          // Si el jugador està arrossegant un token, no deixar que un STATE del DM
          // el faci saltar enrere a mig drag: conservar la posició local d'aquest token.
          const drag = tokenDragRef.current;
          if (drag && rPos.current[drag.id]) rPos.current = { ...msg.pos, [drag.id]: rPos.current[drag.id] };
          else rPos.current = msg.pos;
        }
        if (msg.zoom  !== undefined) rZoom.current = msg.zoom;
        if (msg.panOffset) rPanOffset.current = msg.panOffset;
        if (msg.cam) rCam.current = msg.cam;
        if (msg.players)   rPlayers.current = msg.players;
        if (msg.conditions)  rConditions.current = msg.conditions;
        if (msg.defeated) {
          const prev = rDefeated.current || {};
          Object.keys(msg.defeated).forEach(id => { if (!prev[id]) defeatedAnimRef.current[id] = 0; });
          Object.keys(prev).forEach(id => { if (!msg.defeated[id]) delete defeatedAnimRef.current[id]; });
          rDefeated.current = msg.defeated;
        }
        if (msg.paintedZones) {
          const existingIds = new Set(rPaintedZones.current.map((z: PaintedZone) => z.id));
          msg.paintedZones.forEach((z: PaintedZone) => { if (!existingIds.has(z.id)) zoneAppearRef.current[z.id] = performance.now(); });
          rPaintedZones.current = msg.paintedZones;
        }
        if (msg.rooms) rRooms.current = msg.rooms;
        if (msg.walls) rWalls.current = msg.walls;
        if (msg.doors) rDoors.current = msg.doors;
        if (msg.lights) rLights.current = msg.lights;
        if (msg.difficult) rDifficult.current = msg.difficult;
        if (msg.turn) rTurn.current = msg.turn;
        refreshTurnBanner();
        if (msg.spellPreview !== undefined) rSpellPreviewTarget.current = msg.spellPreview;
        if (msg.activeSpells) _reconcileSpells(msg.activeSpells);
        if (msg.measure) rMeasure.current = { a: msg.measure.a ?? null, b: msg.measure.b ?? null };
        if (msg.gridVisible   !== undefined) rGridVisible.current   = msg.gridVisible;
        if (msg.gridSize      !== undefined) rGridSize.current      = msg.gridSize;
        if (msg.gridSnap      !== undefined) rGridSnap.current      = msg.gridSnap;
        if (msg.gridOriginX   !== undefined) rGridOriginX.current   = msg.gridOriginX;
        if (msg.gridOriginY   !== undefined) rGridOriginY.current   = msg.gridOriginY;
        if (msg.gridLineWidth !== undefined) rGridLineWidth.current = msg.gridLineWidth;
        if (msg.enemyHighlight !== undefined) {
          const prev = rEnemyHighlight.current;
          rEnemyHighlight.current = msg.enemyHighlight;
          if (msg.enemyHighlight && !prev) highlightStartRef.current = performance.now();
          else if (!msg.enemyHighlight) highlightStartRef.current = null;
        }
        if (msg.highlightLocked !== undefined) rHighlightLocked.current = msg.highlightLocked;
        if (msg.tokenSizeOverride !== undefined) rTokenSizeOverride.current = msg.tokenSizeOverride;
        if (msg.libEnemies) rLibEnemies.current = _keepEnemyImages(msg.libEnemies, rLibEnemies.current);
        if (msg.appStyle) { rAppStyle.current = msg.appStyle; setPixel(msg.appStyle === 'pixel'); }
        // Mode Fòsfor (lleuger, sempre). Absent → DM antic: no tocar res.
        if (msg.phosphor !== undefined) _setPhosphor(!!msg.phosphor);
        if (msg.tileLive !== undefined) rTileLive.current = msg.tileLive;
        // Diàleg: també al STRUCT, perquè una tablet que es connecta a mitja conversa la vegi.
        if (msg.dialog !== undefined) dialogHostRef.current?.apply(msg.dialog);
        // Fitxa d'un personatge (pesat: només arriba quan canvia; null = amagada).
        if (msg.sheet !== undefined) setSheet(msg.sheet);
        // Escena (imatge + subtítols): `scene` quan canvia (null = amagar), `sceneSync` ~30 fps.
        if (msg.scene !== undefined) sceneCtlRef.current?.apply(msg.scene);
        if (msg.sceneSync) sceneCtlRef.current?.sync(msg.sceneSync);
        if (msg.dmPreviewActive !== undefined) {
          rDMPreviewActive.current = msg.dmPreviewActive;
          if (msg.dmPreviewZoom != null) rDMPreviewZoom.current = msg.dmPreviewZoom;
          if (msg.dmPreviewPan  != null) rDMPreviewPan.current  = msg.dmPreviewPan;
        }
      } else if (msg.type === 'TOKEN_RELAY') {
        // Relay del DM d'un token mogut des d'una altra pantalla de jugador (p. ex.
        // una tablet). Es FUSIONA només aquest token dins rPos: no reemplaça tot
        // l'estat de posicions (així no desapareixen enemics) ni toca la càmera
        // (així no es reseteja el zoom). Si aquesta pantalla està arrossegant el
        // mateix token, es conserva la posició local perquè no salti a mig drag.
        const drag = tokenDragRef.current;
        if (!(drag && String(drag.id) === String(msg.id))) {
          const idStr = String(msg.id);
          // Token de jugador mogut per una altra pantalla: anima'l vorejant les parets
          // (forma d'L) des de la posició actual fins a la nova, no en línia recta.
          if (idStr.startsWith('pl_')) _setMovePath(idStr, rPos.current[msg.id], { x: msg.x, y: msg.y });
          rPos.current = { ...rPos.current, [msg.id]: { x: msg.x, y: msg.y } };
        }
      } else if (msg.type === 'RESET_EXPLORED') {
        // El DM ha resetejat l'explorat d'una sala: torna a ser negra del tot.
        clearExploredAt(msg.points);
      } else if (msg.type === 'STROKE') {
        const pts = msg.points;
        if (pts && pts.length > 1) {
          const ANIM_FRAMES = 60;
          strokeQueueRef.current.push({
            points: pts, color: msg.color, size: msg.size, tool: msg.tool,
            idx: 1, ptsPerFrame: Math.max(1, Math.ceil(pts.length / ANIM_FRAMES)),
          });
        }
      } else if (msg.type === 'CLEAR_DRAW') {
        strokeQueueRef.current = []; activeStrokeAnim.current = null;
        strokeBaseImgRef.current = null;
        const oc = drawCanvasRef.current;
        if (oc) oc.getContext('2d')!.clearRect(0, 0, oc.width, oc.height);
      } else if (msg.type === 'UNDO_DRAW') {
        strokeQueueRef.current = []; activeStrokeAnim.current = null;
        // `strokeBaseline` només arriba quan la base ha canviat; si no ve, es reaprofita
        // la que ja teníem (durant una tanda de Ctrl+Z no es toca).
        void _rebuildDrawing(msg.strokeHistory || [], msg.strokeBaseline);
      } else if (msg.type === 'POINTER') {
        rPointerPos.current = msg.pos;
      } else if (msg.type === 'MEASURE') {
        rMeasure.current = { a: msg.a, b: msg.b };
      } else if (msg.type === 'SPELL') {
        // El SPELL arriba pel BroadcastChannel I pel WebSocket (la API el reenvia): a la
        // mateixa màquina, dues vegades. Sense descartar l'eco la màgia es pintava doble.
        if (rActiveSpells.current.some(s => s.id === msg.spell.id)) return;
        const sp = { ...msg.spell, startTime: performance.now() };
        rActiveSpells.current = [...rActiveSpells.current, sp];
        setActiveSpells([...rActiveSpells.current]);
      } else if (msg.type === 'DELETE_SPELL') {
        rActiveSpells.current = rActiveSpells.current.filter(s => s.id !== msg.id);
        setActiveSpells([...rActiveSpells.current]);
      } else if (msg.type === 'BOSS_INTRO') {
        // El que es trigui a descodificar el retrat s'avança a la línia de temps, perquè
        // aquesta pantalla no vagi endarrerida respecte del DM.
        const receivedAt = performance.now();
        const _run = (portrait: HTMLCanvasElement | HTMLImageElement | null) => triggerBossIntroRef.current({
          tokenId: msg.tokenId, bossName: msg.bossName, tokenPos: msg.tokenPos, cam: msg.cam, portrait,
          offsetMs: Math.min(600, performance.now() - receivedAt),
          style: msg.style, sprite: msg.sprite, party: msg.party, extras: msg.extras, message: msg.message,
        });
        const fallback = () => _run(null);
        if (msg.portraitDataUrl) {
          const img = new Image();
          img.onload  = () => _run(img);
          img.onerror = fallback;
          img.src = msg.portraitDataUrl;
        } else fallback();
      } else if (msg.type === 'BOSS_INTRO_SKIP') {
        skipBossIntroRef.current();
      } else if (msg.type === 'SCENE_MEDIA') {
        sceneCtlRef.current?.media(msg.buffer, msg.mimeType, msg.id);
      }
    };

    bcHandlerRef.current = handleMsg;

    // `new BroadcastChannel` NO existeix a iOS Safari < 15.4 ni a navegadors antics
    // d'Android i, sense guarda, llançava aquí dins: l'efecte petava, React desmuntava
    // l'arbre i el mòbil es quedava amb la pantalla en negre. Al mòbil no fa cap falta
    // (la sincronització hi va per WebSocket), així que si no hi és, s'ignora.
    let bc: BroadcastChannel | null = null;
    try { bc = new BroadcastChannel(BC_CHANNEL); } catch { bc = null; }
    if (bc) {
      bc.onmessage = handleMsg;
      bcRef.current = bc;
      bc.postMessage({ type: 'PLAYER_READY' });
    }
    _reportViewport();
    return () => { bc?.close(); bcRef.current = null; bcHandlerRef.current = null; };
  }, [_loadBgFromUrl, _bgChanged, _reconcileSpells]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── WebSocket setup (receives same messages as BC, for cross-device iPad) ──
  useEffect(() => {
    const ws = createSyncSocket('client', async (ev: MessageEvent) => {
      // Binary frame = BG image or the Scene's media
      if (ev.data instanceof ArrayBuffer) {
        const bgMeta = pendingBgMetaRef.current;
        const sceneMeta = pendingSceneMetaRef.current;
        if (sceneMeta) {
          pendingSceneMetaRef.current = null;
          sceneCtlRef.current?.media(ev.data, sceneMeta.mimeType, sceneMeta.id);
        } else if (bgMeta) {
          pendingBgMetaRef.current = null;
          if (!_bgChanged(ev.data, bgMeta.mimeType)) return;
          const blob = new Blob([ev.data], { type: bgMeta.mimeType });
          const url = URL.createObjectURL(blob);
          _loadBgFromUrl(url, bgMeta.mimeType, !!bgMeta.withFade);
        }
        return;
      }
      // JSON frame — reuse BC message handler by synthesizing a fake BC event
      if (typeof ev.data === 'string') {
        let parsed: unknown;
        try { parsed = JSON.parse(ev.data); } catch { return; }
        const msg = parsed as { type: string };
        if (msg.type === 'BG_META') {
          pendingBgMetaRef.current = parsed as { mimeType: string; withFade?: boolean };
          return;
        }
        if (msg.type === 'EXPOSITOR_SHOW_META') {
          const meta = parsed as { mimeType: string; target?: string; id?: string };
          // Només el de l'Escena (l'Expositor ja no existeix).
          if (meta.target === 'scene' && meta.id) pendingSceneMetaRef.current = { mimeType: meta.mimeType, id: meta.id };
          return;
        }
        // Synthesize a fake BroadcastChannel MessageEvent so the existing handler processes it
        const fakeEv = { data: parsed } as MessageEvent;
        await bcHandlerRef.current?.(fakeEv);
      }
    }, () => {
      // onOpen: s'executa a cada connexió I a cada reconnexió. Enviar-lo aquí
      // (i no just després de crear el socket, quan encara està CONNECTING i
      // send() el descartaria) garanteix que el DM rep PLAYER_READY i respon
      // amb l'estat complet (BG + STRUCT).
      ws.send(JSON.stringify({ type: 'PLAYER_READY' }));
      _reportViewport();
    }, (st) => {
      setConn(st);
      // L'adreça del WS i la comprovació de contingut mixt depenen de `window.location`:
      // es calculen aquí (ja al client) i no al render, on el servidor donaria un valor
      // diferent i provocaria un error d'hidratació.
      setSyncInfo(prev => prev ?? {
        url: syncUrl('client'), mixed: syncBlockedByMixedContent(), hasKey: hasSyncKey(),
      });
      // Si el socket s'ha tancat, mirar si el host respon per HTTP: és el que separa
      // "no s'hi arriba" de "s'hi arriba però el WebSocket es tanca". Una sola prova
      // (el socket reintenta cada 2s i no cal repetir-la a cada intent).
      if (st.status === 'closed' && !probingRef.current) {
        probingRef.current = true;
        probeApiReachable().then(setApiReachable).catch(() => setApiReachable(false));
      }
    });
    wsRef.current = ws;
    return () => { ws.close(); wsRef.current = null; };
  }, [_loadBgFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Format de pantalla → DM ───────────────────────────────────────────────
  // El DM no pot saber com és de gran ni de quin format és cada pantalla connectada.
  // Amb `cam` (enquadrament de mapa) ningú no veu MENYS que ell, però una pantalla més
  // ampla sí que veu MÉS: aquest report permet que el DM ho vegi al menú de pantalles i no es pensi
  // que el marc que composa és exactament el que hi ha a l'altra banda.
  useEffect(() => {
    _reportViewport();
    const onResize = () => _reportViewport();
    window.addEventListener('resize', onResize);
    // Heartbeat: el DM oblida les pantalles que fa massa que no diuen res (tancades).
    const iv = setInterval(_reportViewport, 15000);
    return () => { window.removeEventListener('resize', onResize); clearInterval(iv); };
  }, [_reportViewport]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let alive = true;
    let prevBgStyle = '';
    let prevBgEl: HTMLElement | null = null;
    let prevPixelated: boolean | null = null;

    // Mode Fòsfor: es fa després de pintar l'escena (passi el que passi dins de `frame`).
    let glassLine = 0;
    const phosphorPass = (fresh: boolean) => {
      const scr = phosphorScreenRef.current;
      if (!scr) return;
      if (!phosphorRef.current) { scr.hide(); glassLine = 0; return; }
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (!W || !H) return;
      scr.draw(mediaRef.current as HTMLImageElement | HTMLVideoElement | null, canvas, W, H, performance.now(), fresh);
      // Les línies fines de damunt de tot, a la mateixa alçada que les del tub.
      const g = phosphorGlassRef.current, lp = scanlinePx(H);
      if (g && glassLine !== lp) { g.style.backgroundSize = `100% ${lp}px`; glassLine = lp; }
    };

    const pacer = new FramePacer();
    const unWake = installWakeListeners();
    const unPack = subscribePack(wake);
    let paceSig = '';
    let phosAt = 0;
    // Ritme del bucle (veure `lib/render/wake.ts`): ple mentre hi ha canvis o una animació
    // «calenta», ~30 fps amb només animacions perpètues i lentes, i res si tot és quiet.
    const framePace = (now: number): boolean => {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      const md = mediaRef.current as (HTMLImageElement & HTMLVideoElement) | null;
      const sig = `${W}x${H}|${md ? (md.naturalWidth || md.videoWidth || 0) : -1}`;
      if (sig !== paceSig) { paceSig = sig; wake(); }
      const spells = rActiveSpells.current;
      const hot = !!cinematicRef.current || !!cinematicCamRef.current.rect || !!dialogHostRef.current?.active
        || !!activeStrokeAnim.current || strokeQueueRef.current.length > 0
        || anyKey(rMovePath.current) || !!tokenDragRef.current || embedRef.current.glide
        || !!rEnemyHighlight.current || rHighlightAlpha.current > 0
        || !!rSpellPreview.current || !!rSpellPreviewTarget.current || !!rPointerPos.current
        || (spells.length > 0 && !spellsSettled(spells, now));
      const ambient = hot || !!rTurn.current?.active || anyKey(rConditions.current)
        || rPaintedZones.current.length > 0 || spells.length > 0
        || (rTileLive.current?.anims.length ?? 0) > 0
        // Vídeo de fons amb sales fosques: el terreny memoritzat es pinta al canvas a partir del vídeo.
        || (md?.tagName === 'VIDEO' && rRooms.current.some(r => r.dark && !r.revealed))
        || (rAppStyle.current === 'pixel' && (rPlayers.current.length > 0 || rLibEnemies.current.length > 0));
      return pacer.due(now, hot, ambient);
    };

    const tick = () => {
      if (!alive) return;
      rafRef.current = requestAnimationFrame(tick);
      // Escena a pantalla (opaca, fos acabat): el mapa de sota no es veu, no el pintem.
      if (sceneCtlRef.current?.covering()) return;
      const now = performance.now();
      const painted = framePace(now);
      if (painted) frame();
      // El Fòsfor té el seu parpelleig: segueix viu encara que el mapa no s'hagi repintat,
      // però sense tornar a pujar el canvas a la GPU (`fresh`) i mai a més de ~60 fps.
      if (painted || now - phosAt >= 15) { phosAt = now; phosphorPass(painted); }
    };

    const frame = () => {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      if (!W || !H) return;
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; _ctx2dRef.current = null; }
      if (!_ctx2dRef.current) _ctx2dRef.current = canvas.getContext('2d');
      const ctx = _ctx2dRef.current!;
      ctx.clearRect(0, 0, W, H);
      const hasMap = !!rMapSize.current;
      const pp = rPos.current;
      const media = mediaRef.current as HTMLImageElement & HTMLVideoElement | null;

      // Mida del mapa en coordenades de mapa: la del fons ORIGINAL del DM (`bgSize` del STRUCT),
      // que pot no ser la de la imatge rebuda (còpia reduïda, veure `mapSizeFor`).
      const { mw, mh } = mapSizeFor(media, rBgSize.current);

      // Càmera: l'autoritat és l'enquadrament de MAPA del DM (`rCam`), que es tradueix al
      // zoom/pan d'aquesta finestra amb la seva mida REAL d'ara. Es recalcula cada frame,
      // així un canvi de mida (rotar la tablet, pantalla completa, barra del navegador)
      // reenquadra tot sol sense esperar cap missatge del DM. Es desa a `rZoom`/`rPanOffset`
      // perquè la resta del codi (LERP i hit-test del drag) el llegeixi com sempre.
      if (rCam.current) {
        const t = camToView(rCam.current, W, H, mw, mh);
        rZoom.current = t.zoom; rPanOffset.current = t.pan;
      }

      // La cinemàtica de boss té prioritat sobre la càmera d'un diàleg.
      const cinRect = cinematicCamRef.current.rect ?? dialogHostRef.current?.cam ?? null;
      const cinView = cinRect ? camToView(cinRect, W, H, mw, mh) : null;
      // Incrustada a la wiki: mentre la wiki hi fa l'onada, el mapa sencer (zoom 1, sense pan),
      // tal com és la imatge de l'onada. Entrar-hi i sortir-ne llisca lent (`glide`).
      const em = embedRef.current;
      const fitMap = em.fit && !cinView;
      const _tgtZ   = fitMap ? 1 : cinView ? cinView.zoom : rZoom.current;
      const _tgtPan = fitMap ? { x: 0, y: 0 } : cinView ? cinView.pan  : rPanOffset.current;
      const dzP = _tgtZ - visualZoomRef.current;
      const dxP = _tgtPan.x - visualPanRef.current.x;
      const dyP = _tgtPan.y - visualPanRef.current.y;
      if (em.glide && !cinView) {
        if (Math.abs(dzP) < 0.002 && Math.abs(dxP) < 0.5 && Math.abs(dyP) < 0.5) {
          visualZoomRef.current = _tgtZ; visualPanRef.current.x = _tgtPan.x; visualPanRef.current.y = _tgtPan.y; em.glide = false;
        } else { visualZoomRef.current += dzP * 0.04; visualPanRef.current.x += dxP * 0.04; visualPanRef.current.y += dyP * 0.04; }
      } else if (cinView) {
        if (Math.abs(dzP) < 0.0005 && Math.abs(dxP) < 0.3 && Math.abs(dyP) < 0.3) {
          visualZoomRef.current = _tgtZ; visualPanRef.current.x = _tgtPan.x; visualPanRef.current.y = _tgtPan.y;
        } else { visualZoomRef.current += dzP * 0.032; visualPanRef.current.x += dxP * 0.032; visualPanRef.current.y += dyP * 0.032; }
      } else {
        const totalDist = Math.abs(dzP) * 40 + Math.sqrt(dxP * dxP + dyP * dyP) / 35;
        const lerpF = Math.min(0.13, 0.05 + 0.045 / (totalDist + 0.05));
        if (Math.abs(dzP) < 0.002 && Math.abs(dxP) < 0.5 && Math.abs(dyP) < 0.5) {
          visualZoomRef.current = _tgtZ; visualPanRef.current.x = _tgtPan.x; visualPanRef.current.y = _tgtPan.y;
        } else { visualZoomRef.current += dzP * lerpF; visualPanRef.current.x += dxP * lerpF; visualPanRef.current.y += dyP * lerpF; }
      }
      const z = visualZoomRef.current, pan = visualPanRef.current;
      const sc = Math.min(W / mw, H / mh) * z;
      // Sacsejada de càmera dels spells (explosió de la bola de foc, llamp): mou fons, mapa i tokens junts.
      const shake = spellShake(rActiveSpells.current, performance.now(), rAppStyle.current === 'pixel');
      const ox = (W - mw * sc) / 2 + pan.x + shake.x, oy = (H - mh * sc) / 2 + pan.y + shake.y;

      if (media) {
        const bgW = Math.round(mw * sc), bgH = Math.round(mh * sc);
        const bgL = Math.round(ox), bgT = Math.round(oy);
        const newStyle = `${bgW},${bgH},${bgL},${bgT}`;
        // Comparar també l'element: si el BG s'ha recreat (reconnexió/reenviament),
        // el nou <img> neix sense mida ni posició i cal reaplicar-li els estils
        // encara que la geometria no hagi canviat — si no, queda desajustat.
        if (newStyle !== prevBgStyle || media !== prevBgEl) {
          (media as HTMLElement).style.width  = bgW + 'px';
          (media as HTMLElement).style.height = bgH + 'px';
          (media as HTMLElement).style.left   = bgL + 'px';
          (media as HTMLElement).style.top    = bgT + 'px';
          prevBgStyle = newStyle;
          prevBgEl = media;
          prevPixelated = null;
        }
      }

      if (media) {
        const pix = rAppStyle.current === 'pixel';
        if (pix !== prevPixelated) { (media as HTMLElement).style.imageRendering = pix ? 'pixelated' : ''; prevPixelated = pix; }
      }

      // Diàleg: abans del `if (!hasMap)` (el narrador també funciona sense mapa).
      dialogHostRef.current?.tick(performance.now(), p => ({ x: ox + p.x * sc, y: oy + p.y * sc }));

      if (!hasMap) return;

      rSpellPreview.current = followSpellPreview(rSpellPreview.current, rSpellPreviewTarget.current, 0.35);

      const fc = {
        sc, ox, oy, mw, mh, isDM: false, pp,
        labelScale: nameScaleFor(W), nameTags: [],  // noms més grossos a la TV, pintats a `renderNameTags`
        rPaintedZones, rContextMenu, zoneAppearRef,
        isShapeDrawingRef, shapePointsRef,
        activeStrokeAnim, strokeQueueRef, drawCanvasRef,
        rActiveSpells, setActiveSpells,
        rConditions, rDefeated,
        defeatedAnimRef, invisAlphaRef,
        rEnemyHighlight, rHighlightAlpha, rHighlightLocked, highlightStartRef,
        visualPosRef, rPlayers, rTokenSizeOverride, rDragPreview, rMovePath,
        rGridVisible, rGridSize, rGridLineWidth, rGridOriginX, rGridOriginY,
        rGridCalibrating, rGridDmAlpha,
        gridCalibRef, gridCalibCurrRef, gridCalibHoverRef,
        rPointerPos, rMeasure, rSelectedToken, rMultiSelected, rTurn,
        rLibEnemies,
        rRooms, rWalls, rDoors, rLights, roomRevealAnimRef,
        rSpellPreview,
        mediaEl: media,
        rAppStyle, rTileLive,
      };

      ctx.save(); ctx.translate(ox, oy); ctx.scale(sc, sc);

      // Parts vives del mapa de caselles: sota de tot (la foscor de les sales les tapa).
      if (rTileLive.current) {
        const doors = rDoors.current;
        drawTileLive(ctx, rTileLive.current, doorOpenById(doors), performance.now());
      }
      renderPaintedZones(ctx, fc);
      renderShapePreview(ctx, fc);
      _advStroke(fc);
      renderSpells(ctx, fc, 'ground');

      const oc = drawCanvasRef.current;
      if (oc) { ctx.globalAlpha = 0.92; ctx.drawImage(oc, 0, 0); ctx.globalAlpha = 1; }

      {
        const FADE = 0.35, TOTAL = 3.5;
        if (rEnemyHighlight.current) {
          const el = highlightStartRef.current ? (performance.now() - highlightStartRef.current) / 1000 : 0;
          if      (el < FADE)          rHighlightAlpha.current = el / FADE;
          else if (el < TOTAL - FADE)  rHighlightAlpha.current = 1;
          else                         rHighlightAlpha.current = Math.max(0, 1 - (el - (TOTAL - FADE)) / FADE);
        } else {
          rHighlightAlpha.current = Math.max(0, rHighlightAlpha.current - 0.08);
        }
      }

      // Ventall dels apilats (pulsació llarga, `usePlayerTokenDrag`): un pas de l'animació.
      advanceTokenSpread(performance.now());
      // Amb portes de caselles, els tokens i els noms es queden en capes: les portes van damunt de
      // la foscor (i del token) i després les capes es tornen a posar només a les caselles de les
      // portes, perquè el token que hi passa quedi per sobre de la porta (i per sota de la paret).
      const scene = renderTokenScene(ctx, fc, { keepTokens: !!rTileLive.current?.doors.length });
      renderSpells(ctx, fc, 'air');  // projectiles/bolts/cones fly OVER the tokens

      // La foscor de les sales fosques es pinta DAMUNT de tot: així qualsevol token,
      // dibuix o spell dins d'una sala fosca queda amagat als jugadors (fog of war).
      renderRooms(ctx, fc);
      // Les portes del mapa de caselles es veuen sempre, com les parets: la foscor d'una sala
      // en tapava la meitat de la casella (cada meitat és d'una sala).
      if (rTileLive.current) {
        const doors = rDoors.current;
        drawTileDoorsOver(ctx, rTileLive.current, doorOpenById(doors));
        if (scene.tokens) {
          const open = doorOpenById(doors);
          ctx.save();
          if (clipTileDoors(ctx, rTileLive.current, open)) blitLayer(ctx, scene.tokens);
          ctx.restore();
          drawTileDoorEdgesOver(ctx, rTileLive.current, open);
          if (scene.names) {
            ctx.save();
            if (clipTileDoors(ctx, rTileLive.current, open)) blitLayer(ctx, scene.names);
            ctx.restore();
          }
        }
      }

      // Les caselles de moviment (groc) i el ghost del destí es pinten SOBRE la foscor: el
      // jugador ha de veure el seu abast i on deixarà anar encara que el destí no estigui
      // il·luminat (i el token real es queda quiet, sense il·luminar, fins deixar anar).
      {
        const drag = tokenDragRef.current;
        if (drag?.range) renderMoveRange(ctx, drag.range, mw, mh, sc);
      }
      renderDragGhost(ctx, fc);

      ctx.restore();

      renderGrid(ctx, fc);
      renderDifficult(ctx, rDifficult.current, fc);
      renderDMPointer(ctx, fc);
      renderMeasureRuler(ctx, fc);

      cinematicRef.current?.tick(performance.now());

    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(rafRef.current); unWake(); unPack(); };
  }, []);

  // Mode Fòsfor: el llenç de WebGL es crea un sol cop (s'amaga quan el mode és apagat).
  useEffect(() => {
    const c = phosphorCanvasRef.current; if (!c) return;
    const scr = new PhosphorScreen(c);
    phosphorScreenRef.current = scr;
    return () => { scr.dispose(); phosphorScreenRef.current = null; };
  }, []);

  // Incrustada a la wiki: `?fit=1` comença amb el mapa sencer i la wiki diu quan cal seguir el DM
  // (`{ rpg: 'embed', fit }`). La pantalla li diu si ja té mapa i com va la connexió. Dins de
  // l'iframe el canal queda aïllat (el navegador el particiona per lloc), així que el canal també
  // passa per la wiki, que el porta fins al DM (`relayToParent`, veure `lib/relay.ts`): no cal API.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('embed') !== '1' || window.parent === window) return;
    const em = embedRef.current;
    em.on = true; em.fit = q.get('fit') === '1';
    const onMsg = (e: MessageEvent) => {
      if (e.source !== window.parent) return;
      const d = e.data as { rpg?: string; fit?: unknown } | null;
      if (d?.rpg !== 'embed' || typeof d.fit !== 'boolean') return;
      if (em.fit !== d.fit) em.glide = true;
      em.fit = d.fit;
      wake();
    };
    window.addEventListener('message', onMsg);
    const relay = relayToParent(bcRef.current, e => { void bcHandlerRef.current?.(e as MessageEvent); });
    bcRef.current = relay.channel;
    relay.channel.postMessage({ type: 'PLAYER_READY' });
    _reportViewport();
    return () => {
      window.removeEventListener('message', onMsg);
      relay.undo();
      if (bcRef.current === relay.channel) bcRef.current = null;
    };
  }, [_reportViewport]);
  useEffect(() => {
    if (!embedRef.current.on) return;
    window.parent.postMessage({ rpg: 'player', ready: playerReady, conn: conn.status }, '*');
  }, [playerReady, conn.status]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && cinematicRef.current) skipBossIntroRef.current();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="full-stage player-root" style={{ background: '#000', position: 'relative', overflow: 'hidden' }}>
      {/* El «tub»: tota la pantalla, perquè l'animació d'apagar i encendre del mode Fòsfor
          l'aplani sencera (mapa, rètols, fitxes i diàlegs). Sense transform en repòs: no crea
          cap context d'apilament i els zIndex de dins funcionen com sempre. */}
      <div ref={tubeRef} style={{ position: 'absolute', inset: 0 }}>
      <div ref={stageRef} style={{ position: 'absolute', inset: 0 }} />
      <canvas
        ref={canvasRef}
        onPointerDown={tokenDrag.onPointerDown}
        onPointerMove={tokenDrag.onPointerMove}
        onPointerUp={tokenDrag.onPointerUp}
        onPointerCancel={tokenDrag.onPointerUp}
        onContextMenu={e => e.preventDefault()}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: 'transparent', touchAction: 'none', cursor: 'grab' }}
      />
      {/* Mode Fòsfor: damunt del mapa i del fons, sota de rètols, fitxes i diàlegs (zIndex ≥ 8).
          Sense punter: el drag dels tokens continua anant al canvas de sota. */}
      <canvas ref={phosphorCanvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none', display: 'none' }} />
      {phosphor && <div ref={phosphorGlassRef} className="phosphor-glass" />}
      <div
        ref={bgTransitionRef}
        style={{ position: 'absolute', inset: 0, background: '#000', zIndex: 8, opacity: 0, transition: 'opacity 0.5s ease', pointerEvents: 'none' }}
      />
      <TurnBanner data={turnBanner} pixel={pixel} />
      <SheetCard sheet={sheet} />
      {!playerReady && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', color: '#8b949e', flexDirection: 'column', gap: 16, padding: 24, fontFamily: 'system-ui,sans-serif', textAlign: 'center' }}>
          <Layers size={40} color="#21262d" />
          <div style={{ fontSize: 18, color: '#e6edf3', fontWeight: 600 }}>RPG Map Viewer</div>
          <div style={{ fontSize: 13 }}>Esperant al Dungeon Master...</div>
          <ConnDiag conn={conn} info={syncInfo} reachable={apiReachable} />
          <div style={{ fontSize: 16, marginTop: 12, color: '#fff', fontWeight: 700, letterSpacing: '0.06em' }}>{APP_VERSION}</div>
        </div>
      )}

      {/* Escena: imatge o vídeo de fons + text en subtítols (zIndex 52) */}
      <SceneOverlay controllerRef={sceneCtlRef} />
      <div ref={flashRef} style={{ position: 'absolute', inset: 0, zIndex: 90, background: '#fff', opacity: 0, pointerEvents: 'none' }} />
      </div>
    </div>
  );
}
