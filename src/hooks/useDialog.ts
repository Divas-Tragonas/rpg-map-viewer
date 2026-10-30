'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CamRect, DialogStyle, DialogSync, SavedDialog } from '@/types';
import type { DMRefs } from './useDMRefs';
import type { BossIntroRequest } from './useCinematic';
import { clampCamToMap, mediaSize, viewRect } from '@/lib/camera';
import { isAnonymous, isNarrator, nextSay, parseScript, sayAtLabel, type ParsedScript, type ScriptSay } from '@/lib/dialog/script';
import { layoutReveal, STYLE_SPEED } from '@/lib/dialog/reveal';
import { dialogCamRect, nearEnough, sameCam, type Speaker } from '@/lib/dialog/camera';
import { dialogToken, type DialogToken } from '@/lib/dialog/tokens';
import { DialogHost } from '@/lib/dialog/host';
import { bubbleLifetime } from '@/lib/dialog/scene';

/** Velocitat per defecte (lletres per segon). */
export const DIALOG_CPS = 32;

/** El que el DM veu a la barra de control mentre corre un diàleg. */
export interface DialogUi {
  /** Esperant que s'acabi la cinemàtica de boss per començar. */
  waiting: boolean;
  title: string;
  kind: 'scene' | 'bubble';
  /** Intervenció actual (1…) i quantes en té el guió. */
  step: number;
  total: number;
  name: string;
  text: string;
  style: DialogStyle;
  /** El text ja s'ha escrit sencer (a totes les pantalles). */
  complete: boolean;
  options: string[];
  /** Línia següent (el DM la veu abans de llançar-la). `null` = és l'última. */
  next: { name: string; text: string } | null;
  canBack: boolean;
}

export interface DialogStart {
  title: string;
  script: string;
  cast: Record<string, string | null>;
  cps?: number;
  kind?: 'scene' | 'bubble';
  /** Token de qui fer la cinemàtica de boss abans de començar. */
  afterBossOf?: string | null;
}

interface Run {
  id: string;
  title: string;
  parsed: ParsedScript;
  cast: Record<string, string | null>;
  kind: 'scene' | 'bubble';
  cps: number;
  index: number;
  history: number[];
  /** Càmera de l'última línia (per a «no moure» i per a les veus). */
  cam: CamRect | null;
  /** Qui ha parlat a la línia d'abans (per enquadrar-ne dos). */
  prevKey: string | null;
  total: number;
  timer: number;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const say = (p: ParsedScript, i: number) => p.steps[i] as ScriptSay;

export function useDialog(R: DMRefs, o: {
  broadcast: () => void;
  /** Amaga l'Expositor i el Revelador de text als jugadors (el diàleg té prioritat). */
  hideOthers: () => void;
  launchBossIntro: (req: BossIntroRequest) => Promise<string | null>;
}) {
  // Els refs del DM es llegeixen a través d'un ref propi: escriure `R.x.current` des d'un
  // callback del hook és l'error de lint `react-hooks/immutability` (`R` és un argument).
  const refs = useRef(R);
  useEffect(() => { refs.current = R; });
  const [ui, setUi] = useState<DialogUi | null>(null);
  const run = useRef<Run | null>(null);
  const waitRef = useRef(0);
  const oRef = useRef(o);
  useEffect(() => { oRef.current = o; });

  // Vista del diàleg a la pantalla del DM (la mateixa que als jugadors). Un sol cop: `R` és
  // un objecte nou a cada render (els refs de dins, no).
  useEffect(() => {
    const host = new DialogHost(() => refs.current.stageRef.current, R, () => refs.current.rAppStyle.current === 'pixel');
    refs.current.dialogHostRef.current = host;
    return () => { host.dispose(); refs.current.dialogHostRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tokenOf = useCallback((r: Run, name: string): DialogToken | null => {
    if (isNarrator(name) || isAnonymous(name)) return null;
    return dialogToken(R, r.cast[name] ?? null);
  }, [R]);

  /** Enquadrament d'una línia segons el seu mode de càmera. */
  const camFor = useCallback((r: Run, st: ScriptSay, tok: DialogToken | null): CamRect | null => {
    if (r.kind !== 'scene' || st.cam === 'quiet' || !tok || tok.hidden) return r.cam;
    const c = refs.current.canvasRef.current;
    const W = c?.clientWidth ?? 0, H = c?.clientHeight ?? 0;
    if (!W || !H) return r.cam;
    const { mw, mh } = mediaSize(refs.current.mediaRef.current);
    const cur = clampCamToMap(viewRect(W, H, mw, mh, refs.current.rZoom.current, refs.current.rPanOffset.current), mw, mh);
    const cell = refs.current.rGridSize.current > 4 ? refs.current.rGridSize.current : 50;
    const me: Speaker = { center: tok.center, R: tok.R };
    const prev = r.prevKey && r.prevKey !== tok.key ? dialogToken(R, r.prevKey) : null;
    const other: Speaker | null = prev && !prev.hidden ? { center: prev.center, R: prev.R } : null;
    const both = other && (st.cam === 'dos' || (st.cam === 'auto' && nearEnough(me, other, cell)));
    return dialogCamRect(both ? [me, other] : [me], cur, mw, mh, cell);
  }, [R]);

  const refreshUi = useCallback(() => {
    const r = run.current, d = refs.current.rDialog.current;
    if (!r || !d) { setUi(null); return; }
    const st = say(r.parsed, r.index);
    const nx = st.options?.length ? null : nextSay(r.parsed, r.index);
    const complete = d.done || performance.now() - refs.current.rDialogT0.current >= layoutReveal(d.text, d.cps).total;
    setUi({
      waiting: false, title: r.title, kind: r.kind,
      step: r.parsed.steps.slice(0, r.index + 1).filter(s => s.kind === 'say').length, total: r.total,
      name: st.name, text: st.text, style: st.style, complete,
      options: st.options?.map(op => op.text) ?? [],
      next: nx === null ? null : { name: say(r.parsed, nx).name, text: say(r.parsed, nx).text },
      canBack: r.history.length > 0,
    });
  }, []);

  const publish = useCallback((d: DialogSync | null) => {
    refs.current.rDialog.current = d;
    refs.current.dialogHostRef.current?.apply(d ? { ...d, age: performance.now() - refs.current.rDialogT0.current } : null);
    oRef.current.broadcast();
  }, []);

  const finish = useCallback(() => {
    const r = run.current;
    if (r) clearTimeout(r.timer);
    clearInterval(waitRef.current);
    run.current = null;
    if (refs.current.rDialog.current) publish(null);
    setUi(null);
  }, [publish]);

  /** Mostra la intervenció `i` a totes les pantalles. */
  const showLine = useCallback((i: number) => {
    const r = run.current; if (!r) return;
    clearTimeout(r.timer);
    r.index = i;
    const st = say(r.parsed, i);
    const tok = tokenOf(r, st.name);
    const voice = !tok || tok.hidden;
    const cam = camFor(r, st, tok);
    r.cam = cam;
    const cps = Math.round(r.cps * (STYLE_SPEED[st.style] ?? 1));
    const d: DialogSync = {
      id: r.id, line: i, kind: r.kind,
      // Algú que els jugadors no poden veure parla com a veu: ni retrat ni token (el globus
      // o la càmera delatarien on és).
      tokenId: voice ? null : tok.key,
      name: isNarrator(st.name) || isAnonymous(st.name) ? '' : st.name,
      voice, text: st.text, style: st.style, cps, age: 0, done: false,
      bars: r.kind === 'scene', cam, options: st.options?.map(op => op.text),
    };
    refs.current.rDialogT0.current = performance.now();
    if (tok && !tok.hidden) r.prevKey = tok.key;
    publish(d);
    refreshUi();
    // Quan el text s'acaba d'escriure, la barra del DM ho ha de saber (botó «Següent»).
    const total = layoutReveal(st.text, cps).total;
    r.timer = window.setTimeout(() => {
      refreshUi();
      // Un globus se'n va sol quan ja s'ha pogut llegir.
      if (r.kind === 'bubble' && run.current === r) {
        r.timer = window.setTimeout(() => { if (run.current === r) finish(); }, Math.max(0, bubbleLifetime(st.text, cps) - total));
      }
    }, total + 30);
  }, [tokenOf, camFor, publish, refreshUi, finish]);

  const start = useCallback((s: DialogStart) => {
    const parsed = parseScript(s.script);
    const first = sayAtLabel(parsed, null);
    if (first === null) return false;
    finish();
    oRef.current.hideOthers();
    const r: Run = {
      id: uid(), title: s.title, parsed, cast: s.cast, kind: s.kind ?? 'scene', cps: s.cps ?? DIALOG_CPS,
      index: first, history: [], cam: null, prevKey: null, timer: 0,
      total: parsed.steps.filter(st => st.kind === 'say').length,
    };
    run.current = r;
    const go = () => { if (run.current === r) showLine(first); };
    const boss = s.afterBossOf ? dialogToken(R, s.afterBossOf) : null;
    if (boss && r.kind === 'scene') {
      setUi({ waiting: true, title: r.title, kind: r.kind, step: 0, total: r.total, name: '', text: '', style: 'normal', complete: false, options: [], next: null, canBack: false });
      const portrait = typeof boss.image === 'string' ? Object.assign(new Image(), { src: boss.image }) : boss.image ?? null;
      void oRef.current.launchBossIntro({ tokenId: boss.key.startsWith('pl_') || boss.key.startsWith('lib_') ? boss.key : Number(boss.key), bossName: boss.name, portrait, tokenPos: boss.center });
      // Comença quan la cinemàtica ha deixat lliure la càmera.
      waitRef.current = window.setInterval(() => {
        if (run.current !== r) { clearInterval(waitRef.current); return; }
        if (!refs.current.cinematicActiveRef.current) { clearInterval(waitRef.current); go(); }
      }, 120);
    } else go();
    return true;
  }, [R, finish, showLine]);

  /** Frase improvisada: «Parlar» del menú del token. */
  const speak = useCallback((tokenKey: string, text: string, kind: 'scene' | 'bubble') => {
    const tok = dialogToken(R, tokenKey);
    const name = (tok?.name ?? 'Veu').replace(/[:()]/g, ' ').trim() || 'Veu';
    const clean = text.replace(/\n+/g, ' ').trim();
    if (!clean) return;
    start({ title: 'Frase', script: `${name}: ${clean}`, cast: { [name]: tokenKey }, kind });
  }, [R, start]);

  /** Espai o →: completa la línia si encara s'escriu; si no, passa a la següent. */
  const advance = useCallback(() => {
    const r = run.current, d = refs.current.rDialog.current;
    if (!r || !d) return;
    const complete = d.done || performance.now() - refs.current.rDialogT0.current >= layoutReveal(d.text, d.cps).total;
    if (!complete) { publish({ ...d, done: true }); refreshUi(); return; }
    if (d.options?.length) return;        // cal triar una opció
    const nx = nextSay(r.parsed, r.index);
    if (nx === null) { finish(); return; }
    r.history.push(r.index);
    showLine(nx);
  }, [publish, refreshUi, finish, showLine]);

  const back = useCallback(() => {
    const r = run.current; if (!r || !r.history.length) return;
    showLine(r.history.pop()!);
  }, [showLine]);

  const choose = useCallback((i: number) => {
    const r = run.current; if (!r) return;
    const op = say(r.parsed, r.index).options?.[i]; if (!op) return;
    const nx = sayAtLabel(r.parsed, op.label);
    if (nx === null) { finish(); return; }
    r.history.push(r.index);
    showLine(nx);
  }, [finish, showLine]);

  // La càmera segueix qui parla si es mou (i deixa d'anar-hi si s'elimina).
  useEffect(() => {
    if (!ui || ui.waiting || ui.kind !== 'scene') return;
    const t = window.setInterval(() => {
      const r = run.current, d = refs.current.rDialog.current;
      if (!r || !d || d.voice) return;
      const st = say(r.parsed, r.index);
      const tok = tokenOf(r, st.name);
      if (!tok) return;
      const cam = camFor(r, st, tok);
      if (sameCam(cam, d.cam)) return;
      r.cam = cam;
      publish({ ...d, cam });
    }, 150);
    return () => clearInterval(t);
  }, [ui, R, tokenOf, camFor, publish]);

  // Tecles mentre corre un diàleg. En fase de captura: Espai no ha d'arrossegar el mapa, Esc
  // no ha de tornar a l'eina de selecció i les xifres no han de canviar d'eina.
  useEffect(() => {
    if (!ui) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (ui.waiting) {
        // Esc salta la cinemàtica (ho fa `useKeyboardHandlers`) i cancel·la el diàleg.
        if (e.key === 'Escape') finish();
        return;
      }
      let hit = true;
      if (e.key === ' ' || e.key === 'ArrowRight') advance();
      else if (e.key === 'ArrowLeft') back();
      else if (e.key === 'Escape') finish();
      else if (/^[1-9]$/.test(e.key) && ui.options.length && ui.complete) choose(Number(e.key) - 1);
      else hit = false;
      if (hit) { e.preventDefault(); e.stopImmediatePropagation(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [ui, advance, back, finish, choose]);

  // ── Diàlegs desats als tokens ───────────────────────────────────────────────
  const [dialogs, setDialogs] = useState<Record<string, SavedDialog[]>>({});
  const reloadDialogs = useCallback(() => setDialogs(refs.current.rDialogs.current), []);
  const saveDialog = useCallback((tokenKey: string, dlg: SavedDialog) => {
    const list = refs.current.rDialogs.current[tokenKey] ?? [];
    const next = list.some(x => x.id === dlg.id) ? list.map(x => (x.id === dlg.id ? dlg : x)) : [...list, dlg];
    refs.current.rDialogs.current = { ...refs.current.rDialogs.current, [tokenKey]: next };
    refs.current.rAutosaveDirty.current = true;
    setDialogs(refs.current.rDialogs.current);
  }, []);
  const deleteDialog = useCallback((tokenKey: string, id: string) => {
    const next = (refs.current.rDialogs.current[tokenKey] ?? []).filter(x => x.id !== id);
    const all = { ...refs.current.rDialogs.current };
    if (next.length) all[tokenKey] = next; else delete all[tokenKey];
    refs.current.rDialogs.current = all;
    refs.current.rAutosaveDirty.current = true;
    setDialogs(all);
  }, []);
  const playSaved = useCallback((tokenKey: string, id: string) => {
    const dlg = (refs.current.rDialogs.current[tokenKey] ?? []).find(x => x.id === id); if (!dlg) return;
    start({ title: dlg.title, script: dlg.script, cast: dlg.cast, afterBossOf: dlg.afterBoss ? tokenKey : null });
  }, [start]);

  return { ui, start, speak, advance, back, choose, end: finish, dialogs, reloadDialogs, saveDialog, deleteDialog, playSaved };
}
