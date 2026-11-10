'use client';
/**
 * La història dins la partida: el que un mòdul (`lib/modules.ts`) pot fer sobre l'escena.
 * Cada acció reutilitza un motor que ja existeix (Revelador de text, diàlegs, biblioteca
 * d'enemics) i anota al diari el que passa.
 *
 * El hook no té estat de React propi: la biblioteca i el diari són magatzems externs
 * (`modulesStore`, `journalStore`) que els components llegeixen amb `useJsonStore`.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { LibEnemy } from '@/types';
import type { DMRefs } from './useDMRefs';
import type { DialogStart } from './useDialog';
import { C } from '@/constants';
import { creatureTemplate, ENEMY_TEMPLATES, findTemplate, type EnemyTemplate } from '@/lib/bestiary';
import { addEnemyNumbered } from '@/lib/enemy-naming';
import { ENEMY_IMAGES } from '@/lib/enemy-images';
import { CREATURES } from '@/lib/sprites/manifest';
import { matchCast, norm, parseScript } from '@/lib/dialog/script';
import { logJournal } from '@/lib/journal';
import {
  getCapsule, newCapsuleId, saveCapsule,
  type Capsule, type CapsuleEnemy, type CapsuleScene,
} from '@/lib/capsules';
import {
  modulesStore, setActiveModule, setModuleStatus, slugify,
  type ModuleDialog, type ModuleExit, type ModuleFoe,
} from '@/lib/modules';

interface Deps {
  setLibEnemies: (v: LibEnemy[]) => void;
  setPos: (v: Record<string, { x: number; y: number }>) => void;
  broadcast: () => void;
  notify: (text: string, kind?: 'error' | 'warn' | 'info') => void;
  /** Deixa el text al Revelador (obre la pestanya Text); el DM el mostra als jugadors quan vulgui. */
  showText: (text: string) => void;
  startDialog: (s: DialogStart) => boolean;
  /** Tokens de l'escena per relacionar-hi els noms del guió. */
  sceneTokens: { key: string; name: string }[];
  /** Treu un enemic de l'escena (amb desfer), per netejar-la després de capturar. */
  removeLibEnemy: (id: number) => void;
  /** El que hi ha ara a la pestanya Escena. */
  sceneSnapshot: () => CapsuleScene;
  /** Carrega una Escena desada al panell i, amb `autoShow`, la mostra als jugadors. */
  playScene: (s: CapsuleScene, autoShow: boolean) => void;
  mapName: string;
}

/** El que es pot capturar ara mateix (per al formulari de «Capturar»). */
export interface CaptureInfo { enemies: number; hidden: number; slides: number; hasText: boolean }
export interface CaptureOpts { name: string; enemies: boolean; scene: boolean; removeAfter: boolean; autoShow: boolean }

/** La plantilla de la biblioteca que millor encaixa amb el que diu el paquet. */
export function templateForFoe(f: ModuleFoe): EnemyTemplate {
  const byId = findTemplate(f.creature) ?? findTemplate(slugify(f.creature).replace(/-/g, '_'));
  if (byId) return byId;
  const n = norm(f.creature);
  const byName = ENEMY_TEMPLATES.find(t => norm(t.name) === n);
  if (byName) return byName;
  const oryx = f.creature.toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (CREATURES[oryx]) return creatureTemplate(oryx);
  const sprite = f.sprite && CREATURES[f.sprite.split('~')[0]] ? f.sprite : undefined;
  return { id: `mod_${slugify(f.creature)}`, name: f.creature, color: C.enemy, hpMax: f.hp ?? 10, R: 25, sm: 0.9, sprite, xp: f.xp ?? 0, group: 'Bestiari' };
}

export function useStory(R: DMRefs, deps: Deps) {
  const refs = useRef(R);
  const dRef = useRef(deps);
  useEffect(() => { refs.current = R; dRef.current = deps; });

  const note = useCallback((text: string) => logJournal('note', text), []);

  const open = useCallback((id: string) => {
    const m = modulesStore.get().library[id]; if (!m) return;
    if (modulesStore.get().active === id) return;
    setActiveModule(id);
    if (m.status === 'preparat' || m.status === 'esborrany') setModuleStatus(id, 'en-joc');
    logJournal('module', `Mòdul: ${m.pack.title}`, { data: { id } });
  }, []);

  const finish = useCallback((id: string) => {
    const m = modulesStore.get().library[id]; if (!m) return;
    setModuleStatus(id, 'jugat');
    logJournal('module', `Mòdul jugat: ${m.pack.title}`, { data: { id, done: true } });
  }, []);

  const readAloud = useCallback((text: string) => { dRef.current.showText(text); }, []);

  /** Posa els enemics del mòdul al centre de la vista, en fila i a les caselles si hi ha graella. */
  const placeFoes = useCallback((foes: ModuleFoe[], moduleTitle: string) => {
    const Rf = refs.current, d = dRef.current;
    const total = foes.reduce((n, f) => n + f.count, 0);
    if (!total) return;
    const canvas = Rf.canvasRef.current;
    let cx = 480, cy = 360;
    if (canvas) {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      const mw = Rf.rMapSize.current?.width || 960, mh = Rf.rMapSize.current?.height || 720;
      const sc = Math.min(W / mw, H / mh) * Rf.rZoom.current;
      const pan = Rf.rPanOffset.current;
      cx = (W / 2 - ((W - mw * sc) / 2 + pan.x)) / sc;
      cy = (H / 2 - ((H - mh * sc) / 2 + pan.y)) / sc;
    }
    const g = Rf.rGridSize.current;
    const step = g > 0 ? g : 64;
    const snap = (v: number, o: number) => (g > 0 ? Math.round((v - o - g / 2) / g) * g + o + g / 2 : v);
    // Files de com a molt 6 per no sortir del mapa.
    const perRow = Math.min(total, 6);
    let ens = Rf.rLibEnemies.current;
    const pos = { ...Rf.rPos.current };
    const base = Date.now();
    let k = 0;
    for (const f of foes) {
      const t = templateForFoe(f);
      for (let i = 0; i < f.count; i++, k++) {
        const id = base + k;
        const imgs = ENEMY_IMAGES[t.id] || [];
        const R_ = g > 0 && Rf.rGridAutoSize.current ? Math.max(8, Math.round(g * t.sm / 2)) : t.R;
        const hpMax = f.hp ?? t.hpMax;
        const en: LibEnemy = {
          id, templateId: t.id, name: f.name ?? t.name, color: t.color, hpMax, hp: hpMax, R: R_, visible: true,
          imageData: imgs.length ? imgs[Math.floor(Math.random() * imgs.length)] : null,
          sprite: f.sprite ?? t.sprite, xp: t.ally ? 0 : (f.xp ?? t.xp), ...(t.ally ? { ally: true } : {}),
        };
        ens = addEnemyNumbered(ens, en);
        const col = k % perRow, row = Math.floor(k / perRow);
        pos[`lib_${id}`] = {
          x: snap(cx + (col - (perRow - 1) / 2) * step, Rf.rGridOriginX.current),
          y: snap(cy + row * step, Rf.rGridOriginY.current),
        };
      }
    }
    Rf.rLibEnemies.current = ens; d.setLibEnemies(ens);
    Rf.rPos.current = pos; d.setPos(pos);
    d.broadcast();
    const what = foes.map(f => `${f.count}× ${f.name ?? templateForFoe(f).name}`).join(', ');
    logJournal('module', `${moduleTitle}: surten ${what}`);
    d.notify(`${total} ${total === 1 ? 'enemic col·locat' : 'enemics col·locats'} al centre del mapa.`, 'info');
  }, []);

  const playDialog = useCallback((dlg: ModuleDialog) => {
    const d = dRef.current;
    const cast = matchCast(parseScript(dlg.script).speakers, d.sceneTokens);
    if (!d.startDialog({ title: dlg.title, script: dlg.script, cast })) d.notify(`El diàleg «${dlg.title}» no té cap frase.`, 'warn');
  }, []);

  /** Una sortida: el mòdul s'acaba i, si apunta a un altre, aquest passa a ser l'actiu. */
  const takeExit = useCallback((fromId: string, ex: ModuleExit) => {
    const lib = modulesStore.get().library;
    const from = lib[fromId]?.pack.title ?? fromId;
    const to = ex.to ? lib[ex.to] : undefined;
    logJournal('module', `Sortida de «${from}»: ${ex.label}${to ? ` → ${to.pack.title}` : ''}`, { data: { id: fromId, exit: ex.id } });
    if (lib[fromId] && lib[fromId].status !== 'jugat') finish(fromId);
    if (to) open(to.pack.id);
  }, [finish, open]);

  // ── Càpsules (`lib/capsules`) ───────────────────────────────────────────────
  const captureInfo = useCallback((): CaptureInfo => {
    const Rf = refs.current;
    const ens = Rf.rLibEnemies.current.filter(e => Rf.rPos.current[`lib_${e.id}`]);
    const sc = dRef.current.sceneSnapshot();
    return { enemies: ens.length, hidden: ens.filter(e => !e.visible).length, slides: sc.slides.length, hasText: !!sc.text.trim() };
  }, []);

  /** Desa el moment actual (enemics de l'escena i/o l'Escena) com una càpsula del mòdul. */
  const capture = useCallback(async (moduleId: string, o: CaptureOpts): Promise<string | null> => {
    const Rf = refs.current, d = dRef.current;
    const taken = o.enemies ? Rf.rLibEnemies.current.filter(e => Rf.rPos.current[`lib_${e.id}`]) : [];
    const enemies: CapsuleEnemy[] = taken.map(e => {
      const { id, hp: _hp, hpHit: _hit, ...enemy } = e; // eslint-disable-line @typescript-eslint/no-unused-vars
      const p = Rf.rPos.current[`lib_${id}`];
      return { enemy, x: p.x, y: p.y };
    });
    const sc = o.scene ? d.sceneSnapshot() : null;
    const scene = sc && (sc.text.trim() || sc.slides.length) ? sc : undefined;
    if (!enemies.length && !scene) { d.notify('No hi ha res per capturar: col·loca enemics o prepara l\'Escena.', 'warn'); return null; }
    const c: Capsule = {
      id: newCapsuleId(), moduleId, name: o.name.trim() || 'Càpsula', createdAt: Date.now(),
      mapName: d.mapName || undefined, ...(enemies.length ? { enemies } : {}), ...(scene ? { scene, autoShow: o.autoShow } : {}),
    };
    const persisted = await saveCapsule(c);
    if (o.removeAfter) for (const e of taken) d.removeLibEnemy(e.id);
    d.notify(persisted ? `Càpsula «${c.name}» desada.` : `Càpsula «${c.name}» desada només fins que tanquis la pàgina (el navegador no deixa desar-la).`, persisted ? 'info' : 'warn');
    return c.id;
  }, []);

  /** Dispara una càpsula: els enemics tornen on eren i l'Escena es carrega (o es mostra). */
  const fireCapsule = useCallback(async (id: string) => {
    const Rf = refs.current, d = dRef.current;
    const c = await getCapsule(id);
    if (!c) { d.notify('No s\'ha trobat la càpsula (potser es va desar en una altra pestanya o navegador).', 'error'); return; }
    if (c.enemies?.length) {
      let ens = Rf.rLibEnemies.current;
      const pos = { ...Rf.rPos.current };
      const base = Date.now();
      c.enemies.forEach((ce, k) => {
        const en: LibEnemy = { ...ce.enemy, id: base + k, hp: ce.enemy.hpMax };
        ens = addEnemyNumbered(ens, en);
        pos[`lib_${en.id}`] = { x: ce.x, y: ce.y };
      });
      Rf.rLibEnemies.current = ens; d.setLibEnemies(ens);
      Rf.rPos.current = pos; d.setPos(pos);
      d.broadcast();
    }
    if (c.scene) d.playScene(c.scene, !!c.autoShow);
    const title = modulesStore.get().library[c.moduleId]?.pack.title;
    logJournal('module', `${title ? `${title}: ` : ''}càpsula «${c.name}»${c.enemies?.length ? ` · ${c.enemies.length} enemics` : ''}`, { data: { id: c.moduleId, capsule: c.id } });
    if (c.mapName && d.mapName && c.mapName !== d.mapName && c.enemies?.length) {
      d.notify(`La càpsula es va capturar al mapa «${c.mapName}»: els enemics surten a les mateixes coordenades.`, 'warn');
    }
  }, []);

  return { note, open, finish, readAloud, placeFoes, playDialog, takeExit, captureInfo, capture, fireCapsule };
}

export type StoryActions = ReturnType<typeof useStory>;
