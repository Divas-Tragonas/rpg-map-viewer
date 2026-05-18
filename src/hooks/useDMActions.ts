'use client';
import { useCallback } from 'react';
import { parsePSDStructure } from '@/lib/psd/parser';
import { extractLayerImages } from '@/lib/psd/extractor';
import { buildTree, validateStructure } from '@/lib/psd/tree';
import { replayStroke } from '@/lib/render/drawing';
import { getBBox } from '@/lib/geometry';
import { BC_CHANNEL, DEFAULT_PARTY, ELEMENTS_BY_ID, ENEMY_TEMPLATES, ENEMY_IMAGES } from '@/constants';
import type { MapStructure, PSDInfo, PSDLayer, VisMap, PosMap, LibEnemy, PsdEnemyOverrides, PsdEnemyOverride } from '@/types';
import type { DMRefs } from './useDMRefs';

interface Setters {
  setBgLoaded: (v: boolean) => void;
  setBgName: (v: string) => void;
  setPsdInfo: (v: PSDInfo | null) => void;
  setStruct: (v: MapStructure | null | ((s: MapStructure | null) => MapStructure | null)) => void;
  setWarnings: (v: string[]) => void;
  setParseError: (v: string | null) => void;
  setParsing: (v: boolean) => void;
  setLayerImages: (v: Record<number, HTMLCanvasElement> | ((prev: Record<number, HTMLCanvasElement>) => Record<number, HTMLCanvasElement>)) => void;
  setVis: (v: VisMap | ((prev: VisMap) => VisMap)) => void;
  setPos: (v: PosMap | ((prev: PosMap) => PosMap)) => void;
  setZoom: (v: number | ((prev: number) => number)) => void;
  setPlayers: (v: import('@/types').Player[] | ((prev: import('@/types').Player[]) => import('@/types').Player[])) => void;
  setConditions: (v: import('@/types').ConditionsMap) => void;
  setDefeated: (v: import('@/types').DefeatedMap) => void;
  setPaintedZones: (v: import('@/types').PaintedZone[]) => void;
  setExpanded: (v: Record<number, boolean> | ((prev: Record<number, boolean>) => Record<number, boolean>)) => void;
  setCanUndo: (v: boolean) => void;
  setActiveSpells: (v: import('@/types').Spell[]) => void;
  setGridSize: (v: number) => void;
  setGridSnap: (v: boolean) => void;
  setGridLineWidth: (v: number) => void;
  setGridOriginX: (v: number) => void;
  setGridOriginY: (v: number) => void;
  setGridCalibrating: (v: boolean) => void;
  setTokenSizeOverride: (v: import('@/types').TokenSizeMap) => void;
  setWarningsDismissed: (v: boolean) => void;
  setGridVisible: (v: boolean) => void;
  setGridAutoSize: (v: boolean) => void;
  setLibEnemies: (v: LibEnemy[] | ((prev: LibEnemy[]) => LibEnemy[])) => void;
  setPsdEnemyOverrides: (v: PsdEnemyOverrides) => void;
}

export function useDMActions(R: DMRefs, S: Setters) {
  const {
    bcRef, rVis, rPos, rZoom, rPanOffset, rPlayers, rLibEnemies, rConditions, rDefeated,
    rPaintedZones, rGridVisible, rGridSize, rGridSnap, rGridAutoSize, rTokenSizeOverride,
    rGridLineWidth, rGridOriginX, rGridOriginY, rEnemyHighlight, rHighlightLocked, rHighlightAlpha,
    rActiveSpells, rStruct, rStruct2, dmLocalPan, dmLocalZoom, dmPreviewBcastRef,
    rDMPreviewActive, rDMPreviewZoom, rDMPreviewPan, rLayerImages, rLayerUrls,
    rZonesLocked, rContextMenu, rDefeated: rDef, rGridCalibrating, rSelectedToken,
    stageRef, mediaRef, bgBufferRef, rPsdInfo, drawCanvasRef, strokeHistoryRef,
    gridCalibRef, gridCalibCurrRef, zoneAnimRef, visualPosRef, strokeQueueRef,
    activeStrokeAnim, defeatedAnimRef, rPsdEnemyOverrides, rPsdEnemyImgCache,
  } = R;

  const _broadcastState = useCallback((extra: Record<string, unknown> = {}) => {
    const bc = bcRef.current; if (!bc) return;
    const _isDMPrev = dmLocalPan.current.x !== 0 || dmLocalPan.current.y !== 0 || dmLocalZoom.current !== 1;
    bc.postMessage({
      type: 'STATE',
      vis: rVis.current, pos: rPos.current, zoom: rZoom.current,
      players: rPlayers.current, conditions: rConditions.current, defeated: rDefeated.current,
      paintedZones: rPaintedZones.current, panOffset: rPanOffset.current,
      gridVisible: rGridVisible.current, gridSize: rGridSize.current,
      gridOriginX: rGridOriginX.current, gridOriginY: rGridOriginY.current,
      gridLineWidth: rGridLineWidth.current, enemyHighlight: rEnemyHighlight.current,
      tokenSizeOverride: rTokenSizeOverride.current,
      libEnemies: rLibEnemies.current,
      psdEnemyOverrides: rPsdEnemyOverrides.current,
      dmPreviewActive: _isDMPrev,
      dmPreviewZoom: rZoom.current * dmLocalZoom.current,
      dmPreviewPan: { x: rPanOffset.current.x + dmLocalPan.current.x, y: rPanOffset.current.y + dmLocalPan.current.y },
      ...extra,
    });
  }, []);

  const _sendFullState = useCallback(() => {
    const bc = bcRef.current; if (!bc) return;
    if (bgBufferRef.current) {
      bc.postMessage({ type: 'BG', buffer: bgBufferRef.current.buffer, mimeType: bgBufferRef.current.mimeType });
    }
    bc.postMessage({
      type: 'STRUCT',
      struct: rStruct2.current,
      vis: rVis.current, pos: rPos.current, zoom: rZoom.current,
      players: rPlayers.current, psdInfo: rPsdInfo.current,
      layerImageUrls: rLayerUrls.current,
      conditions: rConditions.current, defeated: rDefeated.current,
      paintedZones: rPaintedZones.current, panOffset: rPanOffset.current,
      gridVisible: rGridVisible.current, gridSize: rGridSize.current,
      gridOriginX: rGridOriginX.current, gridOriginY: rGridOriginY.current,
      gridLineWidth: rGridLineWidth.current, enemyHighlight: rEnemyHighlight.current,
      tokenSizeOverride: rTokenSizeOverride.current,
      libEnemies: rLibEnemies.current,
      psdEnemyOverrides: rPsdEnemyOverrides.current,
    });
  }, []);

  const loadBg = useCallback(async (file: File) => {
    if (!file) return;
    const buf = await file.arrayBuffer();
    bgBufferRef.current = { buffer: buf, mimeType: file.type };
    const stage = stageRef.current; if (!stage) return;
    if (mediaRef.current) { mediaRef.current.remove(); (mediaRef as React.MutableRefObject<HTMLImageElement | HTMLVideoElement | null>).current = null; }
    const blob = new Blob([buf], { type: file.type });
    const url = URL.createObjectURL(blob);
    const isVid = file.type.startsWith('video/');
    const el = document.createElement(isVid ? 'video' : 'img') as HTMLImageElement | HTMLVideoElement;
    el.style.cssText = 'position:absolute;pointer-events:none;display:block;top:0;left:0;';
    if (isVid) { (el as HTMLVideoElement).autoplay = true; (el as HTMLVideoElement).loop = true; (el as HTMLVideoElement).muted = true; (el as HTMLVideoElement).playsInline = true; }
    (el as HTMLImageElement).src = url;
    stage.appendChild(el);
    (mediaRef as React.MutableRefObject<HTMLImageElement | HTMLVideoElement | null>).current = el;
    S.setBgLoaded(true); S.setBgName(file.name);
    _broadcastState({});
    bcRef.current?.postMessage({ type: 'BG', buffer: buf, mimeType: file.type, withFade: true });
  }, [_broadcastState]);

  const loadPSD = useCallback(async (file: File) => {
    S.setParsing(true); S.setParseError(null); S.setStruct(null); S.setWarnings([]); S.setLayerImages({}); S.setWarningsDismissed(false);
    try {
      const buf = await file.arrayBuffer();
      const parsed = parsePSDStructure(buf);
      const { error, width, height, layers } = parsed;
      if (error && layers.length === 0) { S.setParseError(error); S.setParsing(false); return; }
      if (error) S.setParseError(`Aviso: ${error}`);
      const tree = buildTree(layers);
      const { warnings: w, structure: s } = validateStructure(tree);
      S.setWarnings(w); S.setPsdInfo({ width, height }); S.setStruct(s);
      rPsdInfo.current = { width, height };
      const initVis: VisMap = {}, initPos: Record<number | string, { x: number; y: number }> = {};
      [...s.extras.children, ...s.zonasLayers, ...s.enemyZones.flatMap(z => z.enemies)].forEach(l => {
        initVis[l.id] = l.visible;
        initPos[l.id] = { x: l.left + l.w / 2, y: l.top + l.h / 2 };
      });
      rVis.current = initVis; rPos.current = initPos;
      S.setVis(initVis); S.setPos(initPos);
      const ez: Record<number, boolean> = {};
      s.enemyZones.forEach(z => { ez[z.id] = true; (z.subGroups || []).forEach(sg => { ez[sg.id] = true; }); });
      S.setExpanded(ez);
      const targetIds = [
        ...s.extras.children.map(l => l.id),
        ...s.zonasLayers.map(l => l.id),
        ...s.enemyZones.flatMap(z => z.enemies.map(e => e.id)),
      ];
      if (targetIds.length > 0 && parsed.channelDataOffset > 0) {
        const imgs = await extractLayerImages(buf, parsed, targetIds);
        rLayerImages.current = imgs;
        S.setLayerImages(imgs);
        const cachedUrls: Record<string, string> = {};
        for (const id of Object.keys(imgs)) { try { cachedUrls[id] = imgs[+id].toDataURL('image/png'); } catch { /* empty */ } }
        rLayerUrls.current = cachedUrls;
      }
      rStruct.current = s; rStruct2.current = s;
      setTimeout(() => _sendFullState(), 100);
    } catch (err) { S.setParseError((err as Error).message); }
    S.setParsing(false);
  }, [_sendFullState]);

  const loadDemo = useCallback(async () => {
    try {
      const [bgRes, psdRes] = await Promise.all([fetch('/demo_bg.png'), fetch('/demo.psd')]);
      const bgBlob = await bgRes.blob();
      const psdBlob = await psdRes.blob();
      await loadBg(new File([bgBlob], 'demo_bg.png', { type: 'image/png' }));
      await loadPSD(new File([psdBlob], 'demo.psd', { type: 'application/octet-stream' }));
    } catch (err) { console.error('Error loading demo:', err); }
  }, [loadBg, loadPSD]);

  const snapAllTokens = useCallback(() => {
    const gs = rGridSize.current; if (gs <= 0) return;
    const gox = ((rGridOriginX.current % gs) + gs) % gs;
    const goy = ((rGridOriginY.current % gs) + gs) % gs;
    const snapCC = (v: number, origin: number) => Math.round((v - origin - gs / 2) / gs) * gs + origin + gs / 2;
    const zoneIds = new Set((rStruct.current?.zonasLayers || []).map(l => String(l.id)));
    const newPos = { ...rPos.current };
    for (const [id, p] of Object.entries(newPos)) {
      if (zoneIds.has(id)) continue;
      if (String(id).startsWith('pl_')) {
        const Rv = rTokenSizeOverride.current[id] ?? 22;
        newPos[id] = { x: snapCC(p.x + Rv, gox) - Rv, y: snapCC(p.y + Rv, goy) - Rv };
      } else {
        newPos[id] = { x: snapCC(p.x, gox), y: snapCC(p.y, goy) };
      }
    }
    // Also snap lib enemies
    rLibEnemies.current.forEach(en => {
      const key = `lib_${en.id}`;
      const p = newPos[key];
      if (p) newPos[key] = { x: snapCC(p.x, gox), y: snapCC(p.y, goy) };
    });
    rPos.current = newPos; S.setPos(newPos); _broadcastState({});
  }, [_broadcastState]);

  const sizeAllTokens = useCallback(() => {
    const gs = rGridSize.current; if (gs <= 0) return;
    const Rv = Math.round(gs * 0.45);
    const overrides: Record<string, number> = {};
    if (rStruct.current) rStruct.current.enemyZones.forEach(zone => zone.enemies.forEach(en => { overrides[en.id] = Rv; }));
    rPlayers.current.forEach(pl => { overrides[`pl_${pl.id}`] = Rv; });
    rLibEnemies.current.forEach(en => {
      const tmpl = ENEMY_TEMPLATES.find(t => t.id === en.templateId);
      const sm = tmpl?.sm ?? 0.90;
      overrides[`lib_${en.id}`] = Math.max(8, Math.round(gs * sm / 2));
    });
    rTokenSizeOverride.current = overrides;
    S.setTokenSizeOverride(overrides);
    _broadcastState({ tokenSizeOverride: overrides });
  }, [_broadcastState]);

  const addPlayer = useCallback((name: string, color: string, hpMax: number) => {
    if (!name.trim()) return;
    const m = mediaRef.current;
    let mw = 1920, mh = 1080;
    if (m?.tagName === 'IMG' && (m as HTMLImageElement).naturalWidth) { mw = (m as HTMLImageElement).naturalWidth; mh = (m as HTMLImageElement).naturalHeight; }
    if (m?.tagName === 'VIDEO' && (m as HTMLVideoElement).videoWidth) { mw = (m as HTMLVideoElement).videoWidth; mh = (m as HTMLVideoElement).videoHeight; }
    const plR = rGridAutoSize.current ? Math.round(rGridSize.current * 0.45) : 22;
    const hp = Math.max(1, hpMax || 20);
    const pl = { id: Date.now(), name: name.trim(), color, x: mw / 2 - plR, y: mh / 2 - plR, visible: true, hp, hpMax: hp };
    const ns = [...rPlayers.current, pl];
    rPlayers.current = ns; S.setPlayers(ns);
    rPos.current[`pl_${pl.id}`] = { x: pl.x, y: pl.y };
    S.setPos(p => ({ ...p, [`pl_${pl.id}`]: { x: pl.x, y: pl.y } }));
    if (rGridAutoSize.current) {
      const ov = { ...rTokenSizeOverride.current, [`pl_${pl.id}`]: plR };
      rTokenSizeOverride.current = ov; S.setTokenSizeOverride(ov);
      _broadcastState({ tokenSizeOverride: ov });
    } else { _broadcastState({}); }
  }, [_broadcastState]);

  const removePlayer = useCallback((id: number) => {
    S.setPlayers(ps => { const ns = ps.filter(p => p.id !== id); rPlayers.current = ns; return ns; });
    S.setPos(p => { const n = { ...p }; delete n[`pl_${id}`]; return n; });
  }, []);

  const adjustPlayerHp = useCallback((id: number, delta: number) => {
    const updated = rPlayers.current.map(pl =>
      pl.id === id ? { ...pl, hp: Math.max(0, Math.min(pl.hpMax, (pl.hp ?? pl.hpMax) + delta)) } : pl
    );
    rPlayers.current = updated; S.setPlayers(updated); _broadcastState({});
  }, [_broadcastState]);

  const loadParty = useCallback(() => {
    const plR = rGridAutoSize.current ? Math.round(rGridSize.current * 0.45) : 22;
    const spacing = plR * 2 + 12;
    const totalW = spacing * (DEFAULT_PARTY.length - 1);
    const m = mediaRef.current;
    let mw = 1920, mh = 1080;
    if (m?.tagName === 'IMG' && (m as HTMLImageElement).naturalWidth) { mw = (m as HTMLImageElement).naturalWidth; mh = (m as HTMLImageElement).naturalHeight; }
    const now = Date.now();
    const newPlayers = DEFAULT_PARTY.map((def, i) => ({
      id: now + i, name: def.name, color: def.color,
      x: mw / 2 - totalW / 2 + i * spacing - plR, y: mh / 2 - plR,
      visible: true, hp: def.hpMax, hpMax: def.hpMax,
    }));
    const ns = [...rPlayers.current, ...newPlayers];
    rPlayers.current = ns; S.setPlayers(ns);
    const newPos: Record<string, { x: number; y: number }> = {};
    newPlayers.forEach(pl => { newPos[`pl_${pl.id}`] = { x: pl.x, y: pl.y }; });
    rPos.current = { ...rPos.current, ...newPos };
    S.setPos(p => ({ ...p, ...newPos }));
    if (rGridAutoSize.current) {
      const ov = { ...rTokenSizeOverride.current };
      newPlayers.forEach(pl => { ov[`pl_${pl.id}`] = plR; });
      rTokenSizeOverride.current = ov; S.setTokenSizeOverride(ov);
      _broadcastState({ tokenSizeOverride: ov });
    } else { _broadcastState({}); }
  }, [_broadcastState]);

  const clearDrawing = useCallback(() => {
    const oc = drawCanvasRef.current; if (!oc) return;
    oc.getContext('2d')!.clearRect(0, 0, oc.width, oc.height);
    strokeHistoryRef.current = []; S.setCanUndo(false);
    bcRef.current?.postMessage({ type: 'CLEAR_DRAW' }); _broadcastState({});
  }, [_broadcastState]);

  const undoStroke = useCallback(() => {
    const hist = strokeHistoryRef.current;
    if (hist.length === 0) return;
    hist.pop(); S.setCanUndo(hist.length > 0);
    const oc = drawCanvasRef.current; if (!oc) return;
    const ctx2 = oc.getContext('2d')!;
    ctx2.clearRect(0, 0, oc.width, oc.height);
    for (const stroke of hist) replayStroke(ctx2, stroke);
    bcRef.current?.postMessage({ type: 'UNDO_DRAW', strokeHistory: [...hist] });
  }, []);

  const saveSession = useCallback(() => {
    const oc = drawCanvasRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state: Record<string, any> = {
      version: '2.2',
      vis: rVis.current, pos: rPos.current, zoom: rZoom.current,
      panOffset: rPanOffset.current, players: rPlayers.current,
      conditions: rConditions.current, defeated: rDefeated.current,
      paintedZones: rPaintedZones.current, strokeHistory: strokeHistoryRef.current,
      gridVisible: rGridVisible.current, gridSize: rGridSize.current, gridSnap: rGridSnap.current,
      gridLineWidth: rGridLineWidth.current, gridOriginX: rGridOriginX.current, gridOriginY: rGridOriginY.current,
      tokenSizeOverride: rTokenSizeOverride.current,
      libEnemies: rLibEnemies.current,
      drawCanvas: oc && oc.width > 1 ? oc.toDataURL('image/png') : null,
    };
    if (bgBufferRef.current) {
      const u8 = new Uint8Array(bgBufferRef.current.buffer);
      let bin = ''; const CHUNK = 8192;
      for (let i = 0; i < u8.length; i += CHUNK) bin += String.fromCharCode(...u8.subarray(i, i + CHUNK));
      state.bgData = btoa(bin); state.bgMimeType = bgBufferRef.current.mimeType;
    }
    if (rStruct2.current) {
      state.psdStruct = rStruct2.current;
      state.psdInfo = rPsdInfo.current;
      state.layerImageUrls = rLayerUrls.current;
    }
    const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sesion-rpg.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const loadSession = useCallback(async (file: File) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const state: Record<string, any> = JSON.parse(await file.text());
      // Restore BG image
      if (state.bgData) {
        const bin = atob(state.bgData); const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        await loadBg(new File([arr], state.bgName || 'background.png', { type: state.bgMimeType || 'image/png' }));
      }
      // Restore PSD struct and layer images
      if (state.psdStruct) {
        rStruct.current = state.psdStruct; rStruct2.current = state.psdStruct;
        S.setStruct(state.psdStruct);
        if (state.psdInfo) { rPsdInfo.current = state.psdInfo; S.setPsdInfo(state.psdInfo); }
        const urls: Record<string, string> = state.layerImageUrls || {};
        const imgs: Record<number, HTMLCanvasElement> = {};
        await Promise.all(Object.keys(urls).map(id => new Promise<void>(res => {
          const img = new Image();
          img.onload = () => {
            const oc2 = document.createElement('canvas');
            oc2.width = img.naturalWidth; oc2.height = img.naturalHeight;
            oc2.getContext('2d')!.drawImage(img, 0, 0);
            imgs[Number(id)] = oc2; res();
          };
          img.onerror = () => res(); img.src = urls[id];
        })));
        rLayerImages.current = imgs; S.setLayerImages(imgs); rLayerUrls.current = urls;
      }
      const normPlayers = (state.players || []).map((pl: import('@/types').Player) => ({ ...pl, hpMax: pl.hpMax || 0, hp: pl.hp ?? (pl.hpMax || 0) }));
      if (state.vis)           { rVis.current = state.vis;       S.setVis(state.vis); }
      if (state.pos)           { rPos.current = state.pos;       S.setPos(state.pos); }
      if (state.zoom)          { rZoom.current = state.zoom;     S.setZoom(state.zoom); }
      if (state.panOffset)     { rPanOffset.current = state.panOffset; }
      if (normPlayers.length)  { rPlayers.current = normPlayers; S.setPlayers(normPlayers); }
      if (state.conditions)    { rConditions.current = state.conditions; S.setConditions(state.conditions); }
      if (state.defeated)      { rDefeated.current = state.defeated; S.setDefeated(state.defeated); }
      if (state.paintedZones)  { rPaintedZones.current = state.paintedZones; S.setPaintedZones(state.paintedZones); }
      if (state.strokeHistory) { strokeHistoryRef.current = state.strokeHistory; S.setCanUndo(state.strokeHistory.length > 0); }
      if (state.gridVisible !== undefined) { rGridVisible.current = state.gridVisible; S.setGridVisible(state.gridVisible); }
      if (state.gridSize)      { rGridSize.current = state.gridSize; S.setGridSize(state.gridSize); }
      if (state.gridSnap !== undefined)     { rGridSnap.current = state.gridSnap; S.setGridSnap(state.gridSnap); }
      if (state.gridLineWidth !== undefined){ rGridLineWidth.current = state.gridLineWidth; S.setGridLineWidth(state.gridLineWidth); }
      if (state.gridOriginX !== undefined)  { rGridOriginX.current = state.gridOriginX; S.setGridOriginX(state.gridOriginX); }
      if (state.gridOriginY !== undefined)  { rGridOriginY.current = state.gridOriginY; S.setGridOriginY(state.gridOriginY); }
      if (state.tokenSizeOverride) { rTokenSizeOverride.current = state.tokenSizeOverride; S.setTokenSizeOverride(state.tokenSizeOverride); }
      if (state.libEnemies)    { rLibEnemies.current = state.libEnemies; S.setLibEnemies(state.libEnemies); }
      if (state.strokeHistory && state.strokeHistory.length > 0) {
        const oc = drawCanvasRef.current;
        if (oc) {
          const w = state.psdInfo?.width || oc.width, h = state.psdInfo?.height || oc.height;
          if (oc.width !== w || oc.height !== h) { oc.width = w; oc.height = h; }
          const ctx2 = oc.getContext('2d')!; ctx2.clearRect(0, 0, oc.width, oc.height);
          for (const stroke of state.strokeHistory) replayStroke(ctx2, stroke);
        }
      }
      _broadcastState({});
      if (state.psdStruct && bcRef.current) setTimeout(() => _sendFullState(), 150);
    } catch (err) { console.error('Error cargando sesión:', err); }
  }, [_broadcastState, _sendFullState, loadBg]);

  const addSpell = useCallback((type: string, points: { x: number; y: number }[], setSpellMenu: (v: null) => void) => {
    const sp = { id: Date.now().toString(), type: type as import('@/types').Spell['type'], points, startTime: performance.now() };
    const ns = [...rActiveSpells.current, sp];
    rActiveSpells.current = ns; S.setActiveSpells(ns);
    bcRef.current?.postMessage({ type: 'SPELL', spell: { ...sp, startTime: 0 } });
    setSpellMenu(null);
  }, []);

  const deleteLayer = useCallback((id: number, kind: string) => {
    S.setStruct(s => {
      if (!s) return s;
      let ns: MapStructure;
      if (kind === 'zone')  ns = { ...s, zonasLayers: s.zonasLayers.filter(l => l.id !== id) };
      else if (kind === 'enemy') ns = { ...s, enemyZones: s.enemyZones.map(z => ({ ...z, enemies: z.enemies.filter(e => e.id !== id) })) };
      else if (kind === 'extra') ns = { ...s, extras: { ...s.extras, children: s.extras.children.filter(l => l.id !== id) } };
      else return s;
      rStruct.current = ns; rStruct2.current = ns; return ns;
    });
    S.setVis(v => { const n = { ...v }; delete n[id]; rVis.current = n; return n; });
    S.setPos(p => { const n = { ...p }; delete n[id]; rPos.current = n; return n; });
    S.setLayerImages(li => { const n = { ...li }; delete n[id]; rLayerImages.current = n; return n; });
  }, []);

  const toggleVis = useCallback((id: number) => {
    const nv = { ...rVis.current, [id]: !rVis.current[id] };
    rVis.current = nv; S.setVis(nv); _broadcastState({});
  }, [_broadcastState]);

  const resetToken = useCallback((en: PSDLayer) => {
    const np = { x: en.left + en.w / 2, y: en.top + en.h / 2 };
    rPos.current = { ...rPos.current, [en.id]: np };
    S.setPos(p => ({ ...p, [en.id]: np }));
  }, []);

  const addPaintedZone = useCallback((element: string, shapeMenu: { points: { x: number; y: number }[]; bbox: import('@/types').BBox } | null, setShapeMenu: (v: null) => void) => {
    if (!shapeMenu) return;
    const zone: import('@/types').PaintedZone = { id: Date.now().toString(), element, points: shapeMenu.points, bbox: shapeMenu.bbox };
    const nz = [...rPaintedZones.current, zone];
    rPaintedZones.current = nz; S.setPaintedZones(nz); setShapeMenu(null); _broadcastState({});
  }, [_broadcastState]);

  const deletePaintedZone = useCallback((id: string) => {
    const nz = rPaintedZones.current.filter(z => z.id !== id);
    rPaintedZones.current = nz; S.setPaintedZones(nz); _broadcastState({});
  }, [_broadcastState]);

  const clearPaintedZones = useCallback(() => {
    rPaintedZones.current = []; S.setPaintedZones([]); _broadcastState({});
  }, [_broadcastState]);

  const toggleCondition = useCallback((tokenId: string, condId: string) => {
    const cur = rConditions.current[tokenId] || [];
    const nc = { ...rConditions.current, [tokenId]: cur.includes(condId) ? cur.filter(x => x !== condId) : [...cur, condId] };
    rConditions.current = nc; S.setConditions(nc); _broadcastState({});
  }, [_broadcastState]);

  const openPlayerWindow = useCallback(() => {
    window.open('/player', '_blank', 'width=1280,height=720');
  }, []);

  const addLibEnemy = useCallback((tmpl: typeof ENEMY_TEMPLATES[number]) => {
    const canvas = R.canvasRef.current;
    let cx = 480, cy = 360;
    if (canvas) {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      const mw = rPsdInfo.current?.width || 960; const mh = rPsdInfo.current?.height || 720;
      const sc2 = Math.min(W / mw, H / mh) * rZoom.current;
      const pan = rPanOffset.current;
      const ox2 = (W - mw * sc2) / 2 + pan.x; const oy2 = (H - mh * sc2) / 2 + pan.y;
      cx = (W / 2 - ox2) / sc2; cy = (H / 2 - oy2) / sc2;
    }
    const _imgs = ENEMY_IMAGES[tmpl.id] || [];
    const imageData = _imgs.length > 0 ? _imgs[Math.floor(Math.random() * _imgs.length)] : null;
    const _sm = tmpl.sm || 0.90;
    const _libR = rGridAutoSize.current && rGridSize.current > 0 ? Math.max(8, Math.round(rGridSize.current * _sm / 2)) : tmpl.R;
    const newEn: LibEnemy = { id: Date.now(), templateId: tmpl.id, name: tmpl.name, color: tmpl.color, hpMax: tmpl.hpMax, hp: tmpl.hpMax, R: _libR, visible: true, imageData };
    const ns = [...rLibEnemies.current, newEn];
    rLibEnemies.current = ns; S.setLibEnemies(ns);
    const np = { ...rPos.current, [`lib_${newEn.id}`]: { x: cx, y: cy } };
    rPos.current = np; S.setPos(np);
    _broadcastState({});
  }, [_broadcastState]);

  const adjustLibEnemyHp = useCallback((id: number, delta: number) => {
    const updated = rLibEnemies.current.map(en =>
      en.id === id ? { ...en, hp: Math.max(0, Math.min(en.hpMax, (en.hp ?? en.hpMax) + delta)) } : en
    );
    rLibEnemies.current = updated; S.setLibEnemies(updated);
    const changed = updated.find(en => en.id === id);
    if (changed) {
      const key = `lib_${id}`;
      const isNowDefeated = changed.hp <= 0;
      const wasDefeated = !!rDefeated.current[key];
      if (isNowDefeated !== wasDefeated) {
        const nd = { ...rDefeated.current };
        if (isNowDefeated) nd[key] = true; else delete nd[key];
        rDefeated.current = nd; S.setDefeated({ ...nd });
      }
    }
    _broadcastState({});
  }, [_broadcastState]);

  const adjustPsdEnemyHp = useCallback((id: number, delta: number) => {
    const ov = rPsdEnemyOverrides.current;
    const cur = ov[id] || {};
    const hpMax = cur.hpMax || 0;
    if (hpMax <= 0) return;
    const newHp = Math.max(0, Math.min(hpMax, (cur.hp ?? hpMax) + delta));
    const nOv = { ...ov, [id]: { ...cur, hp: newHp } };
    rPsdEnemyOverrides.current = nOv; S.setPsdEnemyOverrides(nOv);
    const isNowDefeated = newHp <= 0;
    const wasDefeated = !!rDefeated.current[id];
    if (isNowDefeated !== wasDefeated) {
      const nd = { ...rDefeated.current };
      if (isNowDefeated) nd[id] = true; else delete nd[id];
      rDefeated.current = nd; S.setDefeated({ ...nd });
    }
    _broadcastState({});
  }, [_broadcastState]);

  const setPsdEnemyProps = useCallback((id: number, props: PsdEnemyOverride) => {
    const ov = rPsdEnemyOverrides.current;
    const cur = ov[id] || {};
    const nOv = { ...ov, [id]: { ...cur, ...props } };
    rPsdEnemyOverrides.current = nOv; S.setPsdEnemyOverrides(nOv);
    if (props.imageData) {
      const img = new Image();
      img.onload = () => {
        const oc = document.createElement('canvas');
        oc.width = img.naturalWidth; oc.height = img.naturalHeight;
        oc.getContext('2d')!.drawImage(img, 0, 0);
        rPsdEnemyImgCache.current[id] = oc;
      };
      img.src = props.imageData;
    }
    _broadcastState({});
  }, [_broadcastState]);

  const setLibEnemyProps = useCallback((id: number, props: Partial<LibEnemy>) => {
    const updated = rLibEnemies.current.map(en => en.id === id ? { ...en, ...props } : en);
    rLibEnemies.current = updated; S.setLibEnemies(updated);
    _broadcastState({});
  }, [_broadcastState]);

  const removeLibEnemy = useCallback((id: number) => {
    const updated = rLibEnemies.current.filter(en => en.id !== id);
    rLibEnemies.current = updated; S.setLibEnemies(updated);
    const np = { ...rPos.current }; delete np[`lib_${id}`];
    rPos.current = np; S.setPos(np);
    if (R.rSelectedToken.current === `lib_${id}`) { R.rSelectedToken.current = null; }
    _broadcastState({});
  }, [_broadcastState]);

  const toggleLibEnemyVisibility = useCallback((id: number) => {
    const updated = rLibEnemies.current.map(en => en.id === id ? { ...en, visible: !en.visible } : en);
    rLibEnemies.current = updated; S.setLibEnemies(updated);
    _broadcastState({});
  }, [_broadcastState]);

  return {
    _broadcastState, _sendFullState, loadBg, loadPSD, loadDemo, snapAllTokens, sizeAllTokens,
    addPlayer, removePlayer, adjustPlayerHp, loadParty, clearDrawing, undoStroke,
    saveSession, loadSession, addSpell, deleteLayer, toggleVis, resetToken,
    addPaintedZone, deletePaintedZone, clearPaintedZones, toggleCondition, openPlayerWindow,
    addLibEnemy, adjustLibEnemyHp, adjustPsdEnemyHp, setPsdEnemyProps, setLibEnemyProps,
    removeLibEnemy, toggleLibEnemyVisibility,
  };
}
