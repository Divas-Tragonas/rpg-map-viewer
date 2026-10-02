'use client';
import React, { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { C, FS, RADIUS, SHADOW, tint } from '@/constants';
import { Button } from '@/components/ui/Button';
import { StepForward } from '@/components/icons';
import type { Player, LibEnemy, MapStructure, PsdEnemyOverrides, VisMap, TurnState, DefeatedMap, ConditionsMap } from '@/types';
import { movementLimit, type MovementLimit } from '@/lib/rules/conditions';
import { budgetFor } from '@/lib/turn';

interface Props {
  turn: TurnState;
  players: Player[];
  libEnemies: LibEnemy[];
  struct: MapStructure | null;
  psdEnemyOverrides: PsdEnemyOverrides;
  vis: VisMap;
  /** Tokens derrotats: el seu xip surt atenuat i amb la ✕ (ja no agafen torn). */
  defeated: DefeatedMap;
  /** Estats dels tokens: limiten el moviment (Agafat → 0 peus, Tombat → la meitat). */
  conditions: ConditionsMap;
  tokenGroupsRef: MutableRefObject<Map<number | string, string>>;
  onStart: (ids: (number | string)[]) => void;
  onEnd: () => void;
  onAdvance: () => void;
  onAdvanceRound: () => void;
  onRecoverTurn: (id: number | string) => void;
  onReorder: (newOrder: (number | string)[]) => void;
}

interface TokenInfo { name: string; color: string; img: string | null }

/* ── Geometria fixa de la barra activa ─────────────────────────────────────────
   Un cop començat el combat, la barra no canvia de mida. Abans s'eixamplava i
   s'encongia a cada torn (el xip actiu feia l'amplada del nom, i un jugador portava la
   columna de peus i un enemic no) i en demanar «Saltar a la ronda?» o «Finalitzar?» (el
   botó es convertia en una frase). Ara tot el que depèn de l'estat té mida constant: el
   xip actiu fa sempre ACTIVE_W × ACTIVE_H i la resta SLOT_W × SLOT_H, o sigui que la
   suma no depèn de QUI té el torn, i les confirmacions surten en un globus a sobre.
   El carril té una amplada FIXA calculada amb aquestes xifres (`railWidth`) i l'amplada
   extra del xip actiu es reparteix amb `flex-grow` (1 l'actiu, 0 la resta). Animar el
   `flex-grow` en lloc de l'amplada fa que, encara que es passin torns molt de pressa i
   les transicions es tallin a mitges, els xips omplin sempre el mateix carril: abans,
   amb `width` animat, la suma ja no quadrava i la barra variava uns píxels.
   ⚠️ Si es toca el farciment o la vora del xip, quadrar-ho amb aquestes xifres. */
const SLOT_W = 52;                                    // vora 2 + farciment 7 + avatar 34, per banda
const SLOT_H = 48;
const INFO_W = 112;                                   // columna de nom i peus del xip actiu
const ACTIVE_W = 2 + 7 + 42 + 7 + INFO_W + 12 + 2;   // vora, farciment, avatar, separació, columna
const ACTIVE_H = 60;
const GAP = 8;
const ROW_H = ACTIVE_H + 8;  // una mica d'aire per a la lluentor del xip actiu
const NEXT_W = 112;          // «Següent» i «Fet» ocupen el mateix lloc
const EASE = 'cubic-bezier(.2,.8,.2,1)';
const RESIZE = `width .24s ${EASE}, height .24s ${EASE}`;

/** Amplada del carril amb `n` xips: un d'actiu i la resta en espera. */
const railWidth = (n: number) => n * SLOT_W + (ACTIVE_W - SLOT_W) + Math.max(0, n - 1) * GAP;

/* ── Reordenar arrossegant (mode edició) ───────────────────────────────────────
   Com les icones de l'iPhone: el xip agafat s'aixeca i segueix el punter, i la resta
   s'aparten en viu per deixar-li el forat on cauria. Fins a deixar-lo anar NO es toca
   l'ordre: els xips es desplacen amb `transform` i, en deixar-lo, el clon vola al forat
   (SETTLE_MS) i llavors es fixa l'ordre en un render sense transicions — cada xip ja
   era visualment al seu lloc nou, així que no salta res. Pointer events (no l'HTML5
   drag & drop, que no deixa dibuixar el que s'arrossega ni funciona amb el dit). */
const SETTLE_MS = 200;
const LIFT = 6;         // px que s'aixeca el xip agafat
const DRAG_SLOP = 5;    // px de moviment abans de considerar-ho un arrossegament
const EDGE = 40;        // px de la vora del carril on arrossegar fa scroll
const EDGE_SPEED = 14;  // px per frame a la vora mateix

const NO_LIMIT: MovementLimit = { ft: 0, reason: null, immobile: false };

/** Vora esquerra de cada xip (per índex original) si el `from` caigués a la posició `to`. */
function layoutLefts(widths: number[], from: number, to: number): number[] {
  const seq = widths.map((_, i) => i).filter(i => i !== from);
  seq.splice(to, 0, from);
  const lefts: number[] = new Array(widths.length);
  let x = 0;
  for (const i of seq) { lefts[i] = x; x += widths[i] + GAP; }
  return lefts;
}

/** Posició de la cua on cauria el xip `from` amb el centre a `centerX` (coords del carril). */
function dropIndex(widths: number[], from: number, centerX: number): number {
  const others = widths.filter((_, i) => i !== from);
  const half = widths[from] / 2;
  let best = from, bestD = Infinity, x = 0;
  for (let t = 0; t <= others.length; t++) {
    const d = Math.abs(x + half - centerX);
    if (d < bestD) { bestD = d; best = t; }
    if (t < others.length) x += others[t] + GAP;
  }
  return best;
}

function moveItem<T>(arr: readonly T[], from: number, to: number): T[] {
  const a = [...arr];
  const [m] = a.splice(from, 1);
  a.splice(to, 0, m);
  return a;
}

type Pop = null | 'round' | 'end' | { recover: number | string };

/** El que es pinta d'un arrossegament: on és el clon (coords de la barra) i on cauria. */
interface DragView { from: number; to: number; x: number; y: number; settling: boolean }

/** Arrossegament en curs: tot el que fan servir els escoltadors de `window`. */
interface DragSession {
  pointerId: number;
  from: number;
  to: number;
  order: (number | string)[];
  widths: number[];
  startX: number;
  startY: number;
  lastX: number;
  grabX: number;   // on s'ha agafat el xip, des de la seva vora esquerra
  top: number;     // vora superior del xip, en coords de la barra
  started: boolean;
  raf: number;
  settleTimer: number;
  detach: () => void;
}

export function TurnTracker({
  turn, players, libEnemies, struct, psdEnemyOverrides, vis, defeated, conditions, tokenGroupsRef,
  onStart, onEnd, onAdvance, onAdvanceRound, onRecoverTurn, onReorder,
}: Props) {
  const [selecting, setSelecting] = useState(false);
  const [selEnemies, setSelEnemies] = useState<Set<string>>(new Set());
  const [selGroups, setSelGroups] = useState<Set<string>>(new Set());
  // Barra activa. Un sol globus obert alhora a sobre de la barra: les confirmacions de
  // «Ronda» i de finalitzar, i el «Recuperar el torn» del clic dret.
  const [pop, setPop] = useState<Pop>(null);
  const [editMode, setEditMode] = useState(false);
  const [drag, setDrag] = useState<DragView | null>(null);
  // Un render sense transicions just quan es fixa l'ordre nou (veure `commitDrag`).
  const [noAnim, setNoAnim] = useState(false);
  const dragRef = useRef<DragSession | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);  // carril dels xips (fa scroll)
  const barRef = useRef<HTMLDivElement | null>(null);
  // Ordre vigent per al final d'un arrossegament (que s'executa fora del render).
  const orderRef = useRef(turn.order);
  useEffect(() => { orderRef.current = turn.order; }, [turn.order]);

  // Amb molts tokens a la cua els xips fan scroll: el del torn actiu sempre queda a la vista.
  // Només quan canvia QUI té el torn (reordenar mou l'índex però no el token: no ha de
  // fer saltar el carril). La posició es calcula, no es mesura: els xips encara estan
  // animant l'amplada i la mesura donaria la d'abans.
  const activeKey = turn.active ? String(turn.order[turn.turnIndex]) : '';
  useEffect(() => {
    const c = railRef.current;
    if (!c || !activeKey) return;
    const idx = [...c.querySelectorAll<HTMLElement>('[data-chip]')].findIndex(el => el.dataset.active === '1');
    if (idx < 0) return;
    c.scrollTo({ left: idx * (SLOT_W + GAP) - c.clientWidth / 2 + ACTIVE_W / 2, behavior: 'smooth' });
  }, [activeKey]);

  // Els globus es tanquen clicant fora o amb Esc.
  useEffect(() => {
    if (pop === null) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('[data-tt-pop]')) setPop(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPop(null); };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [pop]);

  // Si la barra desapareix a mig arrossegament, no deixar escoltadors penjats.
  useEffect(() => () => {
    const d = dragRef.current;
    if (d) { d.detach(); clearTimeout(d.settleTimer); }
  }, []);

  // Resol un id de token a la seva info de presentació (nom, color, imatge opcional).
  const resolve = (id: number | string): TokenInfo => {
    const s = String(id);
    if (s.startsWith('pl_')) {
      const p = players.find(pl => `pl_${pl.id}` === s);
      return { name: p?.name ?? '?', color: p?.color ?? '#888', img: null };
    }
    if (s.startsWith('lib_')) {
      const e = libEnemies.find(en => `lib_${en.id}` === s);
      return { name: e?.name ?? '?', color: e?.color ?? '#b0424a', img: e?.imageData ?? null };
    }
    const en = struct?.enemyRooms.flatMap(r => r.enemies).find(e => e.id === Number(id));
    const ov = psdEnemyOverrides[Number(id)];
    return { name: ov?.name ?? en?.name ?? '?', color: '#b0424a', img: ov?.imageData ?? null };
  };

  // ── Popover de selecció (combat inactiu) ───────────────────────────────────
  const openSelect = () => { setSelEnemies(new Set()); setSelGroups(new Set()); setSelecting(true); };

  const psdEnemies = (struct?.enemyRooms.flatMap(r => r.enemies) ?? []).filter(en => vis[en.id]);
  const libVisible = libEnemies.filter(en => en.visible !== false);

  const groupMap = new Map<string, (number | string)[]>();
  tokenGroupsRef.current.forEach((gid, tid) => {
    const arr = groupMap.get(gid) ?? [];
    arr.push(tid);
    groupMap.set(gid, arr);
  });
  const groups = [...groupMap.entries()];

  const toggle = (set: Set<string>, setSet: (s: Set<string>) => void, key: string) => {
    const n = new Set(set);
    if (n.has(key)) n.delete(key); else n.add(key);
    setSet(n);
  };

  // «Tots / Cap»: selecciona (o treu) d'un cop tots els enemics visibles de la llista.
  const allEnemyKeys = [...psdEnemies.map(en => String(en.id)), ...libVisible.map(en => `lib_${en.id}`)];
  const allEnemiesSelected = allEnemyKeys.length > 0 && allEnemyKeys.every(k => selEnemies.has(k));
  const toggleAllEnemies = () => setSelEnemies(allEnemiesSelected ? new Set() : new Set(allEnemyKeys));

  const confirmStart = () => {
    const ids = new Set<number | string>();
    selGroups.forEach(gid => (groupMap.get(gid) ?? []).forEach(id => ids.add(id)));
    selEnemies.forEach(id => ids.add(id.startsWith('lib_') || id.startsWith('pl_') ? id : Number(id)));
    setSelecting(false);
    onStart([...ids]);
  };

  const wrap: React.CSSProperties = {
    position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
    // Sense envair la barra d'eines de l'esquerra (a sota quedaria inaccessible): si hi ha
    // molts tokens a la cua, els xips fan scroll en lloc d'eixamplar la barra.
    zIndex: 12, width: 'max-content', maxWidth: 'calc(100% - 150px)',
  };

  if (!turn.active) {
    return (
      <div style={wrap}>
        {selecting && (
          <div style={{
            position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)',
            width: 360, maxHeight: 380, overflowY: 'auto',
            background: 'rgba(13,17,23,0.98)', border: `1px solid ${C.border}`, borderRadius: RADIUS.lg,
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)', padding: 14,
          }}>
            <div style={{ color: C.bright, fontWeight: 700, fontSize: FS.lg, marginBottom: 4 }}>Iniciar combat per torns</div>
            <div style={{ color: C.dim, fontSize: FS.sm, marginBottom: 10 }}>
              Tots els jugadors s&apos;afegeixen automàticament. Tria quins enemics o grups incloure:
            </div>

            {groups.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ color: C.dim, fontSize: FS.xs, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Grups</div>
                {groups.map(([gid, ids], i) => (
                  <label key={gid} style={rowStyle(selGroups.has(gid))} onClick={() => toggle(selGroups, setSelGroups, gid)}>
                    <span style={{ display: 'flex', marginRight: 8 }}>
                      {ids.slice(0, 4).map(id => (
                        <span key={String(id)} style={{ marginLeft: -6 }}><Avatar info={resolve(id)} size={24} /></span>
                      ))}
                    </span>
                    <span style={{ flex: 1, color: C.text, fontSize: FS.lg }}>Grup {i + 1}</span>
                    <span style={{ color: C.dim, fontSize: FS.sm }}>{ids.length} tokens</span>
                    {check(selGroups.has(gid))}
                  </label>
                ))}
              </div>
            )}

            {(psdEnemies.length > 0 || libVisible.length > 0) && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ flex: 1, color: C.dim, fontSize: FS.xs, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enemics</span>
                  <Button size="sm" variant="ghost" onClick={toggleAllEnemies} style={{ color: C.accent }}>
                    {allEnemiesSelected ? 'Cap' : 'Tots'}
                  </Button>
                </div>
                {psdEnemies.map(en => {
                  const key = String(en.id);
                  return (
                    <label key={key} style={rowStyle(selEnemies.has(key))} onClick={() => toggle(selEnemies, setSelEnemies, key)}>
                      <span style={{ marginRight: 8 }}><Avatar info={resolve(en.id)} size={24} /></span>
                      <span style={{ flex: 1, color: C.text, fontSize: FS.lg }}>{psdEnemyOverrides[en.id]?.name ?? en.name}</span>
                      {check(selEnemies.has(key))}
                    </label>
                  );
                })}
                {libVisible.map(en => {
                  const key = `lib_${en.id}`;
                  return (
                    <label key={key} style={rowStyle(selEnemies.has(key))} onClick={() => toggle(selEnemies, setSelEnemies, key)}>
                      <span style={{ marginRight: 8 }}><Avatar info={resolve(key)} size={24} /></span>
                      <span style={{ flex: 1, color: C.text, fontSize: FS.lg }}>{en.name}</span>
                      {check(selEnemies.has(key))}
                    </label>
                  );
                })}
              </div>
            )}

            {groups.length === 0 && psdEnemies.length === 0 && libVisible.length === 0 && (
              <div style={{ color: C.dim, fontSize: FS.sm, padding: '6px 0' }}>Cap enemic visible. Es començarà només amb els jugadors.</div>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <Button style={{ flex: 1 }} onClick={() => setSelecting(false)}>Cancel·lar</Button>
              <Button variant="primary" style={{ flex: 2 }} onClick={confirmStart}>Començar combat</Button>
            </div>
          </div>
        )}
        <button
          onClick={() => (selecting ? setSelecting(false) : openSelect())}
          title="Iniciar sistema per torns"
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 22,
            border: `1px solid ${selecting ? C.accent : C.border}`,
            background: selecting ? `${C.accent}22` : 'rgba(13,17,23,0.95)',
            color: selecting ? C.accent : C.text, cursor: 'pointer', fontWeight: 700, fontSize: FS.lg,
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}>
          ⚔️ Iniciar torns
        </button>
      </div>
    );
  }

  // ── Barra de torns (combat actiu) ──────────────────────────────────────────
  const widthOf = (i: number) => (i === turn.turnIndex ? ACTIVE_W : SLOT_W);

  const chipProps = (id: number | string, i: number): ChipBodyProps => {
    const isActive = i === turn.turnIndex;
    return {
      info: resolve(id),
      active: isActive,
      defeated: !!defeated[String(id)],
      isPlayer: String(id).startsWith('pl_'),
      /* Peus efectius del token actiu: el saldo del torn retallat pels seus estats
         (mateix `movementLimit` que fa servir el clamp del jugador i la validació). */
      limit: isActive ? movementLimit(turn.activeRemainingFt, conditions[String(id)]) : NO_LIMIT,
      totalFt: isActive ? budgetFor(id, players) : 0,
      editMode,
    };
  };

  // Recol·loca el clon sota el punter i recalcula on cauria.
  const updateDrag = (d: DragSession) => {
    const rail = railRef.current, bar = barRef.current;
    if (!rail || !bar) return;
    const rr = rail.getBoundingClientRect(), br = bar.getBoundingClientRect();
    const left = d.lastX - d.grabX;  // vora esquerra del clon (coords de pantalla)
    d.to = dropIndex(d.widths, d.from, left - rr.left + rail.scrollLeft + d.widths[d.from] / 2);
    setDrag({ from: d.from, to: d.to, x: left - br.left - bar.clientLeft, y: d.top - LIFT, settling: false });
  };

  // Deixat anar i aterrat el clon: fixa l'ordre. Tot en un sol render (ordre nou, cap
  // desplaçament i transicions apagades): cada xip ja era visualment al seu lloc nou.
  const commitDrag = (d: DragSession) => {
    dragRef.current = null;
    setNoAnim(true);
    setDrag(null);
    // Si la cua ha canviat mentrestant (s'ha eliminat un token), l'ordre desat és vell.
    const cur = orderRef.current;
    const same = cur.length === d.order.length && cur.every((id, k) => String(id) === String(d.order[k]));
    if (d.to !== d.from && same) onReorder(moveItem(d.order, d.from, d.to));
    requestAnimationFrame(() => requestAnimationFrame(() => setNoAnim(false)));
  };

  const onChipPointerDown = (e: React.PointerEvent<HTMLDivElement>, i: number) => {
    const bar = barRef.current;
    if (e.button !== 0 || dragRef.current || !bar) return;
    e.preventDefault();  // que arrossegar no seleccioni text
    const slot = e.currentTarget.getBoundingClientRect();
    const br = bar.getBoundingClientRect();

    // A prop de les vores del carril, arrossegar fa scroll (si hi ha més xips dels que hi caben).
    const autoScroll = () => {
      const rail = railRef.current;
      if (rail) {
        const rr = rail.getBoundingClientRect();
        let v = 0;
        if (d.lastX < rr.left + EDGE) v = -Math.min(1, (rr.left + EDGE - d.lastX) / EDGE);
        else if (d.lastX > rr.right - EDGE) v = Math.min(1, (d.lastX - (rr.right - EDGE)) / EDGE);
        if (v) {
          const before = rail.scrollLeft;
          rail.scrollLeft += v * EDGE_SPEED;
          if (rail.scrollLeft !== before) updateDrag(d);
        }
      }
      d.raf = requestAnimationFrame(autoScroll);
    };
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== d.pointerId) return;
      d.lastX = ev.clientX;
      if (!d.started) {
        if (Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) < DRAG_SLOP) return;
        d.started = true;
        document.body.style.cursor = 'grabbing';
        d.raf = requestAnimationFrame(autoScroll);
      }
      updateDrag(d);
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== d.pointerId) return;
      d.detach();
      if (!d.started) { dragRef.current = null; return; }  // un clic, no un arrossegament
      if (ev.type === 'pointercancel') d.to = d.from;
      const rail = railRef.current, b = barRef.current;
      if (!rail || !b) { commitDrag(d); return; }
      const rr = rail.getBoundingClientRect(), bb = b.getBoundingClientRect();
      const slotLeft = layoutLefts(d.widths, d.from, d.to)[d.from];
      setDrag({
        from: d.from, to: d.to, settling: true, y: d.top,
        x: rr.left - rail.scrollLeft + slotLeft - bb.left - b.clientLeft,
      });
      d.settleTimer = window.setTimeout(() => commitDrag(d), SETTLE_MS);
    };
    const d: DragSession = {
      pointerId: e.pointerId, from: i, to: i, order: [...turn.order],
      widths: turn.order.map((_, j) => widthOf(j)),
      startX: e.clientX, startY: e.clientY, lastX: e.clientX,
      grabX: e.clientX - slot.left, top: slot.top - br.top - bar.clientTop,
      started: false, raf: 0, settleTimer: 0,
      detach: () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        cancelAnimationFrame(d.raf);
        document.body.style.cursor = '';
      },
    };
    dragRef.current = d;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // Previsualització: desplaçament de cada xip perquè quedi el forat on cauria l'arrossegat.
  const widths = turn.order.map((_, i) => widthOf(i));
  const shifts = drag
    ? (() => {
        const now = layoutLefts(widths, drag.from, drag.from);
        const next = layoutLefts(widths, drag.from, drag.to);
        return next.map((x, i) => x - now[i]);
      })()
    : null;
  const dragged = drag ? chipProps(turn.order[drag.from], drag.from) : null;

  return (
    <div style={wrap}>
      {/* Globus a sobre de la barra: no la fan créixer (abans la confirmació hi ocupava lloc) */}
      {pop !== null && typeof pop === 'object' && (
        <Bubble align="center">
          <button
            onClick={() => { onRecoverTurn(pop.recover); setPop(null); }}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', borderRadius: RADIUS.md, border: 'none', background: 'transparent', color: C.text, cursor: 'pointer', fontSize: FS.md, fontWeight: 600 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = tint(C.accent, 0.13))}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            ↩ Recuperar el torn de {resolve(pop.recover).name}
          </button>
        </Bubble>
      )}
      {pop === 'round' && (
        <Bubble align="right">
          <span style={{ color: C.text, fontSize: FS.sm, padding: '0 4px 0 6px' }}>Saltar a la ronda {turn.round + 1}?</span>
          <Button variant="primary" onClick={() => { setPop(null); onAdvanceRound(); }}>Sí</Button>
          <Button onClick={() => setPop(null)}>No</Button>
        </Bubble>
      )}
      {pop === 'end' && (
        <Bubble align="right">
          <span style={{ color: C.text, fontSize: FS.sm, padding: '0 4px 0 6px' }}>Finalitzar el combat?</span>
          <Button onClick={() => { setPop(null); setEditMode(false); onEnd(); }}
            style={{ background: C.enemy, borderColor: C.enemy, color: '#fff' }}>Sí</Button>
          <Button onClick={() => setPop(null)}>No</Button>
        </Bubble>
      )}
      {editMode && pop === null && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)',
          pointerEvents: 'none', whiteSpace: 'nowrap', padding: '5px 12px', borderRadius: RADIUS.pill,
          background: C.float, border: `1px solid ${tint(C.accent, 0.5)}`, boxShadow: SHADOW.float,
          color: C.accent, fontSize: FS.sm, fontWeight: 600,
        }}>
          Arrossega un token per canviar-lo de lloc
        </div>
      )}

      <div ref={barRef} style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', gap: 10, userSelect: 'none',
        background: 'rgba(13,17,23,0.97)', border: `1px solid ${editMode ? C.accent : C.border}`, borderRadius: 16,
        padding: '8px 12px', boxShadow: '0 8px 28px rgba(0,0,0,0.65)',
      }}>
        <div style={{
          width: 64, flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '4px 0', borderRadius: RADIUS.lg, background: tint(C.accent, 0.09), border: `1px solid ${tint(C.accent, 0.33)}`,
        }}>
          <span style={{ color: C.dim, fontSize: FS.xs, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Ronda</span>
          <span style={{ color: C.accent, fontSize: 24, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{turn.round}</span>
        </div>

        {/* Botó configuració/edició d'ordre (com el dels jugadors) */}
        <button onClick={() => { setEditMode(v => !v); setPop(null); }}
          title={editMode ? 'Sortir del mode edició' : 'Editar ordre (arrossega els tokens)'}
          style={{
            flexShrink: 0, width: 38, height: 38, borderRadius: RADIUS.lg, cursor: 'pointer',
            border: `1px solid ${editMode ? C.accent : C.border}`,
            background: editMode ? tint(C.accent, 0.13) : 'transparent',
            color: editMode ? C.accent : C.dim, fontSize: 17, lineHeight: 1,
          }}>
          ⚙
        </button>

        <div ref={railRef} style={{ flex: '0 1 auto', minWidth: 0, overflowX: 'auto', overflowY: 'hidden' }}>
          {/* Amplada fixa i `overflow: hidden`: res del que passi a dins (transicions a mitges,
              xips desplaçats en reordenar) pot fer aparèixer la barra de scroll i canviar-ne l'alçada. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: GAP, height: ROW_H, width: railWidth(turn.order.length), overflow: 'hidden' }}>
            {turn.order.map((id, i) => {
              const p = chipProps(id, i);
              const shift = shifts ? shifts[i] : 0;
              return (
                <div
                  key={String(id)}
                  data-chip
                  data-active={p.active ? '1' : undefined}
                  onPointerDown={editMode ? (e) => onChipPointerDown(e, i) : undefined}
                  onClick={!editMode && p.active ? onAdvance : undefined}
                  onContextMenu={(e) => { e.preventDefault(); if (!editMode && !p.active) setPop({ recover: id }); }}
                  title={editMode ? 'Arrossega per reordenar' : p.defeated ? `${p.info.name} · derrotat, se li salta el torn` : p.active ? 'Clica per passar el torn · clic dret per recuperar un torn anterior' : `${p.info.name} · clic dret per recuperar el seu torn`}
                  style={{
                    flex: `${p.active ? 1 : 0} 0 ${SLOT_W}px`, minWidth: 0, height: p.active ? ACTIVE_H : SLOT_H,
                    transform: shift ? `translateX(${shift}px)` : undefined,
                    transition: noAnim ? 'none' : `flex-grow .24s ${EASE}, height .24s ${EASE}, transform .22s ${EASE}`,
                    // L'agafat deixa el seu lloc buit (el clon el dibuixa a sobre).
                    visibility: drag?.from === i ? 'hidden' : undefined,
                    cursor: editMode ? 'grab' : p.active ? 'pointer' : 'default',
                    touchAction: editMode ? 'none' : undefined,
                  }}>
                  <ChipBody {...p} />
                </div>
              );
            })}
          </div>
        </div>

        {/* El xip agafat: fora del carril perquè el seu scroll no el retalli en aixecar-se */}
        {drag && dragged && (
          <div aria-hidden style={{
            position: 'absolute', left: 0, top: 0, zIndex: 4, pointerEvents: 'none',
            width: dragged.active ? ACTIVE_W : SLOT_W, height: dragged.active ? ACTIVE_H : SLOT_H,
            transform: `translate(${drag.x}px, ${drag.y}px)`,
            transition: drag.settling ? `transform ${SETTLE_MS}ms ${EASE}` : 'none',
          }}>
            <div style={{
              width: '100%', height: '100%',
              transform: `scale(${drag.settling ? 1 : 1.1})`,
              transition: `transform ${SETTLE_MS}ms ${EASE}`,
              animation: `tt-lift .14s ${EASE}`,
            }}>
              <ChipBody {...dragged} lifted={!drag.settling} />
            </div>
          </div>
        )}

        {/* Passar torn és l'acció més freqüent del combat: botó principal i gran, amb
            drecera (Enter). En mode edició el mateix lloc el pren «Fet» (mateixa amplada). */}
        {editMode ? (
          <Button variant="primary" size="lg" onClick={() => setEditMode(false)} title="Acabar d'editar l'ordre"
            style={{ flexShrink: 0, width: NEXT_W }}>
            ✓ Fet
          </Button>
        ) : (
          <Button variant="primary" size="lg" onClick={onAdvance} title="Passar el torn al següent (Enter)"
            style={{ flexShrink: 0, width: NEXT_W, gap: 6 }}>
            Següent <StepForward size={13} />
          </Button>
        )}
        <Button data-tt-pop variant="secondary" active={pop === 'round'} disabled={editMode}
          onClick={() => setPop(p => (p === 'round' ? null : 'round'))}
          title="Acabar la ronda ara: salta tots els que queden i comença la següent (tots recuperen moviment)"
          style={{ flexShrink: 0 }}>
          ⏭ Ronda
        </Button>

        {/* Acabar combat (amb confirmació al globus) */}
        <button data-tt-pop onClick={() => setPop(p => (p === 'end' ? null : 'end'))} title="Acabar combat"
          style={{
            flexShrink: 0, width: 36, height: 36, borderRadius: RADIUS.lg, cursor: 'pointer', fontSize: 15, lineHeight: 1,
            border: `1px solid ${pop === 'end' ? C.enemy : C.border}`,
            background: pop === 'end' ? tint(C.enemy, 0.12) : 'transparent',
            color: pop === 'end' ? C.enemy : C.dim,
          }}>
          ✕
        </button>
      </div>
    </div>
  );
}

function Avatar({ info, size }: { info: TokenInfo; size: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: info.img ? `#000 center/cover url(${info.img})` : info.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.4, fontWeight: 800, overflow: 'hidden',
      border: `1px solid rgba(255,255,255,0.25)`,
      transition: `${RESIZE}, font-size .24s ${EASE}`,
    }}>
      {!info.img && info.name.slice(0, 2).toUpperCase()}
    </div>
  );
}

interface ChipBodyProps {
  info: TokenInfo;
  active: boolean;
  defeated: boolean;
  isPlayer: boolean;
  limit: MovementLimit;
  totalFt: number;
  editMode: boolean;
  /** El clon que segueix el punter mentre es reordena. */
  lifted?: boolean;
}

/** Aspecte d'un xip de la cua (el del carril i el clon que s'arrossega). Ocupa tota la
 *  mida del seu contenidor, que és qui la fixa (veure `SLOT_W` / `ACTIVE_W`). */
function ChipBody({ info, active, defeated, isPlayer, limit, totalFt, editMode, lifted }: ChipBodyProps) {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', gap: 7,
      padding: active ? '5px 12px 5px 7px' : '5px 7px',
      // La columna de nom i peus queda retallada mentre el xip s'eixampla: es destapa sola.
      borderRadius: 22, overflow: 'hidden',
      border: active ? `2px solid ${C.accent}` : lifted ? `2px solid ${tint(C.accent, 0.55)}` : editMode ? `2px dashed ${tint(C.dim, 0.4)}` : '2px solid transparent',
      // L'aixecat va per sobre d'altres xips: fons opac (el tint sol és translúcid).
      background: lifted ? `linear-gradient(${tint(C.accent, active ? 0.13 : 0.06)}, ${tint(C.accent, active ? 0.13 : 0.06)}), ${C.bg}`
        : active ? tint(C.accent, 0.13) : 'transparent',
      boxShadow: lifted ? '0 12px 28px rgba(0,0,0,0.6)' : active ? `0 0 16px ${tint(C.accent, 0.4)}` : 'none',
      opacity: defeated ? 0.34 : active || lifted ? 1 : 0.75,
      filter: defeated ? 'grayscale(1)' : 'none',
      transition: 'background .2s, border-color .2s, box-shadow .2s, opacity .2s',
    }}>
      <span style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
        <Avatar info={info} size={active ? 42 : 34} />
        {defeated && (
          <span aria-hidden style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: C.enemy, fontSize: active ? 30 : 24, fontWeight: 900, lineHeight: 1, pointerEvents: 'none',
          }}>✕</span>
        )}
      </span>
      {active && (
        <span style={{ display: 'flex', flexDirection: 'column', width: INFO_W, flexShrink: 0, lineHeight: 1.2, textAlign: 'left' }}>
          <span style={{ color: C.bright, fontSize: FS.lg, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.name}</span>
          {isPlayer && (limit.immobile ? (
            // Un estat li impedeix moure's: val més dir-ho que ensenyar peus que no pot gastar.
            <span style={{ color: C.enemy, fontSize: FS.md, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={`${limit.reason}: no es pot moure`}>
              ✋ {limit.reason}
            </span>
          ) : (
            <>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ color: limit.ft >= 5 ? C.accent : C.enemy, fontSize: 22, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {limit.ft}
                </span>
                <span style={{ color: C.dim, fontSize: FS.sm, fontWeight: 700 }}>/ {totalFt} ft</span>
              </span>
              <span style={{ display: 'block', marginTop: 3, height: 4, width: '100%', borderRadius: RADIUS.sm, background: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
                <span style={{
                  display: 'block', height: '100%', borderRadius: RADIUS.sm,
                  width: `${Math.max(0, Math.min(1, totalFt > 0 ? limit.ft / totalFt : 0)) * 100}%`,
                  background: limit.ft >= 5 ? C.accent : C.enemy, transition: 'width 0.3s ease',
                }} />
              </span>
            </>
          ))}
        </span>
      )}
    </div>
  );
}

/** Globus a sobre de la barra (confirmacions i menú de clic dret). */
function Bubble({ align, children }: { align: 'center' | 'right'; children: React.ReactNode }) {
  return (
    <div data-tt-pop style={{
      position: 'absolute', bottom: 'calc(100% + 10px)', zIndex: 3,
      ...(align === 'center' ? { left: '50%', transform: 'translateX(-50%)' } : { right: 0 }),
      display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', padding: 5,
      background: 'rgba(13,17,23,0.99)', border: `1px solid ${C.border}`, borderRadius: RADIUS.lg,
      boxShadow: SHADOW.menu,
    }}>
      {children}
    </div>
  );
}

const rowStyle = (sel: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', padding: '5px 6px', borderRadius: RADIUS.md, cursor: 'pointer',
  background: sel ? tint(C.accent, 0.14) : 'transparent', marginBottom: 2,
});

const check = (sel: boolean) => (
  <span style={{
    width: 16, height: 16, marginLeft: 6, borderRadius: RADIUS.sm, flexShrink: 0,
    border: `1px solid ${sel ? C.accent : '#3a4048'}`, background: sel ? C.accent : 'transparent',
    color: C.onAccent, fontSize: FS.sm, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>{sel ? '✓' : ''}</span>
);
