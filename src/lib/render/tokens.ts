import type { FrameContext } from './types';
import { TOKEN_LERP, CONDITIONS_BY_ID, C } from '@/constants';
import { drawConditionBadges } from '@/lib/conditions';

const _tokenImgCache = new Map<string, HTMLImageElement>();
function getTokenImg(src: string): HTMLImageElement {
  let img = _tokenImgCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    _tokenImgCache.set(src, img);
  }
  return img;
}

// Aro del token que té el torn actiu (sistema per torns). Daurat SÒLID i gruixut:
// coherent amb la paleta groga però deliberadament diferent de l'aro de "ressaltar
// enemics" (doble anell suau, alpha animat) i del blau discontinu de selecció del DM.
function drawActiveTurnRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, sc: number): void {
  const pT = performance.now() / 1000, pulse = 0.5 + 0.5 * Math.sin(pT * 3);
  ctx.save();
  ctx.strokeStyle = `rgba(255,190,40,${0.22 + 0.14 * pulse})`; ctx.lineWidth = 9 / sc;
  ctx.beginPath(); ctx.arc(cx, cy, R + (9 + 3 * pulse) / sc, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,196,52,0.95)'; ctx.lineWidth = 4 / sc;
  ctx.beginPath(); ctx.arc(cx, cy, R + (5 + 1.5 * pulse) / sc, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// Troba l'última condició amb tint sense crear arrays intermedis (s'executa per token i frame).
function findTintCond(condIds: string[]) {
  for (let i = condIds.length - 1; i >= 0; i--) {
    const c = CONDITIONS_BY_ID.get(condIds[i]);
    if (c?.tint) return c;
  }
  return undefined;
}

// El retrat desaturat d'un enemic derrotat només canvia mentre avança l'animació (~1s);
// després és estàtic. Cachejar-lo evita crear un <canvas> nou i redibuixar-lo a cada
// frame per sempre a la vista del jugador.
const _deathCanvasCache = new Map<number | string, { canvas: HTMLCanvasElement; prog: number; img: HTMLCanvasElement | null; R: number }>();

export function renderEnemyTokens(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const {
    sc, pp, isDM, s, v, rLayerImages, rConditions, rDefeated,
    defeatedAnimRef, invisAlphaRef, rEnemyHighlight, rHighlightAlpha,
    rHighlightLocked, highlightStartRef, visualPosRef, rTokenSizeOverride, rSelectedToken, rMultiSelected,
    rPsdEnemyOverrides, rPsdEnemyImgCache,
  } = fc;

  s.enemyRooms.forEach(room => room.enemies.forEach(en => {
    const rawPos = pp[en.id];
    if (!rawPos) return;
    const isVis    = !!v[en.id];
    const enCondIds = rConditions.current[en.id] || [];
    const isInvis   = enCondIds.includes('invisible');
    const isDefeated = !!rDefeated.current[en.id];
    const R = rTokenSizeOverride.current[en.id] ?? Math.max(Math.min(en.w, en.h) / 2, 22);

    let ep = rawPos;
    if (!isDM) {
      const key = String(en.id);
      const vp = visualPosRef.current[key];
      if (!vp) { visualPosRef.current[key] = { ...rawPos }; ep = rawPos; }
      else {
        vp.x += (rawPos.x - vp.x) * TOKEN_LERP;
        vp.y += (rawPos.y - vp.y) * TOKEN_LERP;
        ep = vp;
      }
      const hiddenByRoom = s.roomLayers.some(zl => {
        if (!v[zl.id]) return false;
        const zp = pp[zl.id] || { x: zl.left + zl.w / 2, y: zl.top + zl.h / 2 };
        const zx = zp.x - zl.w / 2, zy = zp.y - zl.h / 2;
        return ep.x >= zx && ep.x <= zx + zl.w && ep.y >= zy && ep.y <= zy + zl.h;
      });
      if (hiddenByRoom) return;
    }

    const targetInvisAlpha = isInvis && !isDM ? 0 : 1;
    const prevInvis = invisAlphaRef.current[en.id] ?? 1;
    invisAlphaRef.current[en.id] = prevInvis + (targetInvisAlpha - prevInvis) * 0.08;
    const enAlpha = invisAlphaRef.current[en.id];
    if (enAlpha < 0.02 && !isDM) return;

    if (isDefeated) {
      const key = String(en.id);
      if (defeatedAnimRef.current[key] === undefined) defeatedAnimRef.current[key] = 0;
      defeatedAnimRef.current[key] = Math.min(1, defeatedAnimRef.current[key] + 0.018);
    }
    const crossProg = isDefeated ? (defeatedAnimRef.current[en.id] ?? 0) : 0;

    const layerImg = rLayerImages.current[en.id];
    const ovImg = rPsdEnemyImgCache.current[en.id];
    const displayImg = ovImg || layerImg;
    const ov = rPsdEnemyOverrides.current[en.id];
    const displayName = ov?.name ?? en.name;
    ctx.save();
    ctx.globalAlpha = enAlpha;

    if (isDefeated && !isDM) {
      const desatAlpha = Math.min(1, crossProg * 2);
      if (desatAlpha > 0) {
        let entry = _deathCanvasCache.get(en.id);
        if (!entry || entry.prog !== desatAlpha || entry.img !== (displayImg ?? null) || entry.R !== R) {
          const deathC = entry?.canvas ?? document.createElement('canvas');
          deathC.width = R * 2; deathC.height = R * 2;
          const dc = deathC.getContext('2d')!;
          dc.save();
          dc.beginPath(); dc.arc(R, R, R, 0, Math.PI * 2); dc.clip();
          if (displayImg) { dc.drawImage(displayImg, 0, 0, displayImg.width, displayImg.height, 0, 0, R * 2, R * 2); }
          else { dc.fillStyle = '#888'; dc.fillRect(0, 0, R * 2, R * 2); }
          dc.globalCompositeOperation = 'saturation';
          dc.fillStyle = `rgba(0,0,0,${desatAlpha})`; dc.fillRect(0, 0, R * 2, R * 2);
          dc.restore();
          entry = { canvas: deathC, prog: desatAlpha, img: displayImg ?? null, R };
          _deathCanvasCache.set(en.id, entry);
        }
        ctx.drawImage(entry.canvas, ep.x - R, ep.y - R);
      }
    } else {
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.beginPath(); ctx.arc(ep.x + 2 / sc, ep.y + 2 / sc, R, 0, Math.PI * 2); ctx.fill();
      if (displayImg) {
        ctx.save(); ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(displayImg, ep.x - R, ep.y - R, R * 2, R * 2);
        ctx.restore();
      } else {
        ctx.fillStyle = '#444';
        ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.fill();
        ctx.font = `bold ${R * 0.55}px system-ui`; ctx.fillStyle = '#ccc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(displayName.slice(0, 2).toUpperCase(), ep.x, ep.y); ctx.textBaseline = 'alphabetic';
      }

      const tintCond = findTintCond(enCondIds);
      if (tintCond) {
        ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = 0.45;
        ctx.fillStyle = tintCond.tint!;
        ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = isInvis ? 'rgba(100,180,255,.6)' : 'rgba(255,255,255,.7)';
      ctx.lineWidth = 2 / sc;
      if (isInvis) ctx.setLineDash([5 / sc, 3 / sc]);
      ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    const showStates = isDM || !isInvis;
    if (showStates) {
      ctx.font = `${10 / sc}px system-ui`; ctx.textAlign = 'center'; ctx.globalAlpha = enAlpha;
      const tw = ctx.measureText(displayName).width;
      ctx.fillStyle = 'rgba(8,12,18,.85)'; ctx.fillRect(ep.x - tw / 2 - 4 / sc, ep.y + R + 2 / sc, tw + 8 / sc, 13 / sc);
      ctx.fillStyle = isVis ? '#ffaaaa' : '#888'; ctx.fillText(displayName, ep.x, ep.y + R + 12 / sc);
    }
    if (isDM && ov?.hpMax && ov.hpMax > 0) {
      const hp = Math.max(0, ov.hp ?? ov.hpMax);
      const hpRatio = hp / ov.hpMax;
      const barW = R * 2, barH = Math.max(13 / sc, R * 0.35);
      const barX = ep.x - R, barY = ep.y + R + 16 / sc;
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? C.hpHigh : hpRatio > 0.25 ? C.hpMid : C.enemy;
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
      const barFontSize = Math.max(9 / sc, barH * 0.62);
      ctx.font = `bold ${barFontSize}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 2 / sc;
      ctx.fillText(`${hp}/${ov.hpMax}`, ep.x, barY + barH / 2);
      ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
    if (!isDM && isInvis) { /* skip badges */ } else { drawConditionBadges(ctx, ep.x, ep.y, R, enCondIds, sc); }

    const _ha = rHighlightAlpha.current;
    if (_ha > 0.01 && isVis && !isDefeated && enAlpha > 0.3) {
      const pT = performance.now() / 1000;
      const phaseOff = (typeof en.id === 'number' ? en.id : 0) * 0.43;
      const pulse = 0.5 + 0.5 * Math.sin(pT * 3.2 + phaseOff);
      ctx.save();
      ctx.strokeStyle = `rgba(255,210,0,${(0.10 + 0.08 * pulse) * _ha})`; ctx.lineWidth = 10 / sc;
      ctx.beginPath(); ctx.arc(ep.x, ep.y, R + (11 + 4 * pulse) / sc, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(255,220,50,${(0.60 + 0.35 * pulse) * _ha})`; ctx.lineWidth = 2.5 / sc;
      ctx.beginPath(); ctx.arc(ep.x, ep.y, R + (4 + 2 * pulse) / sc, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    if (isDefeated && showStates && (isDM || crossProg > 0)) {
      const cr = R * 0.82;
      ctx.save(); ctx.strokeStyle = C.enemy; ctx.lineWidth = 5 / sc; ctx.lineCap = 'round';
      if (isDM) {
        ctx.beginPath(); ctx.moveTo(ep.x - cr, ep.y - cr); ctx.lineTo(ep.x + cr, ep.y + cr); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ep.x + cr, ep.y - cr); ctx.lineTo(ep.x - cr, ep.y + cr); ctx.stroke();
      } else {
        const lineLen = cr * 2 * 1.42;
        const p1 = Math.min(1, crossProg * 2);
        if (p1 > 0) { ctx.setLineDash([p1 * lineLen, lineLen * 2]); ctx.beginPath(); ctx.moveTo(ep.x - cr, ep.y - cr); ctx.lineTo(ep.x + cr, ep.y + cr); ctx.stroke(); }
        const p2 = Math.max(0, crossProg * 2 - 1);
        if (p2 > 0) { ctx.setLineDash([p2 * lineLen, lineLen * 2]); ctx.beginPath(); ctx.moveTo(ep.x + cr, ep.y - cr); ctx.lineTo(ep.x - cr, ep.y + cr); ctx.stroke(); }
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    if (isDM && (rSelectedToken.current === en.id || rMultiSelected.current.has(en.id))) {
      const pT = performance.now() / 1000, pulse = 0.5 + 0.5 * Math.sin(pT * 4.5);
      ctx.save(); ctx.strokeStyle = `rgba(100,210,255,${0.65 + 0.35 * pulse})`; ctx.lineWidth = 2.5 / sc; ctx.setLineDash([6 / sc, 3 / sc]);
      ctx.beginPath(); ctx.arc(ep.x, ep.y, R + 7 / sc, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }

    ctx.restore();
  }));
}

export function renderLibEnemyTokens(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const {
    sc, pp, isDM, s, v, rLibEnemies, rConditions, rDefeated, defeatedAnimRef, invisAlphaRef,
    visualPosRef, rSelectedToken, rMultiSelected, rTokenSizeOverride, rHighlightAlpha,
  } = fc;

  rLibEnemies.current.forEach(en => {
    const rawEp = (pp[`lib_${en.id}`] as { x: number; y: number } | undefined) || { x: 0, y: 0 };
    let ep: { x: number; y: number };
    if (isDM) {
      ep = rawEp;
    } else {
      const key = `lib_${en.id}`;
      const vp = visualPosRef.current[key];
      if (!vp) { visualPosRef.current[key] = { ...rawEp }; ep = rawEp; }
      else { vp.x += (rawEp.x - vp.x) * TOKEN_LERP; vp.y += (rawEp.y - vp.y) * TOKEN_LERP; ep = vp; }
    }
    const R = rTokenSizeOverride.current[`lib_${en.id}`] ?? en.R;
    const enCondIds = (rConditions.current[`lib_${en.id}`] as string[] | undefined) || [];
    const isInvis = enCondIds.includes('invisible');
    const isDefeated = !!rDefeated.current[`lib_${en.id}`];
    const isVis = en.visible !== false;

    if (!isDM) {
      const hiddenByRoom = s.roomLayers.some(zl => {
        if (!v[zl.id]) return false;
        const zp = pp[zl.id] || { x: zl.left + zl.w / 2, y: zl.top + zl.h / 2 };
        const zx = zp.x - zl.w / 2, zy = zp.y - zl.h / 2;
        return ep.x >= zx && ep.x <= zx + zl.w && ep.y >= zy && ep.y <= zy + zl.h;
      });
      if (hiddenByRoom) return;
    }

    let enAlpha: number;
    if (isDM) {
      enAlpha = isVis ? 1 : 0.3;
    } else {
      const target = (!isVis || isInvis) ? 0 : 1;
      const prev = (invisAlphaRef.current[`lib_${en.id}`] as number | undefined) ?? target;
      const next = prev + (target - prev) * 0.07;
      invisAlphaRef.current[`lib_${en.id}`] = Math.abs(next - target) < 0.004 ? target : next;
      enAlpha = invisAlphaRef.current[`lib_${en.id}`] as number;
      if (enAlpha < 0.02) return;
    }

    let colorProg = 0, crossProg = 0;
    if (isDefeated) {
      if (isDM) { colorProg = 1; crossProg = 1; }
      else {
        const key = `lib_${en.id}`;
        let prog = (defeatedAnimRef.current[key] as number | undefined) ?? 0;
        if (prog < 1) { prog = Math.min(1, prog + 0.018); defeatedAnimRef.current[key] = prog; }
        colorProg = Math.min(1, prog * 2); crossProg = Math.max(0, prog * 2 - 1);
      }
    }

    const enTintCond = findTintCond(enCondIds);
    ctx.globalAlpha = enAlpha;
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.arc(ep.x + 2 / sc, ep.y + 2 / sc, R, 0, Math.PI * 2); ctx.fill();

    if (isDefeated && colorProg > 0) {
      ctx.save();
      ctx.filter = `grayscale(${Math.round(colorProg * 100)}%)`;
      ctx.globalAlpha = enAlpha * (1 - colorProg * 0.35);
      ctx.fillStyle = en.color;
      ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.fill();
      if (en.imageData) {
        const dtImg = getTokenImg(en.imageData);
        if (dtImg.complete && dtImg.naturalWidth > 0) {
          ctx.save(); ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.clip();
          ctx.drawImage(dtImg, ep.x - R, ep.y - R, R * 2, R * 2); ctx.restore();
        }
      }
      if (enTintCond) {
        ctx.save(); ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.clip();
        ctx.globalAlpha = enAlpha * (1 - colorProg * 0.35) * 0.45;
        ctx.fillStyle = enTintCond.tint!; ctx.fillRect(ep.x - R, ep.y - R, R * 2, R * 2); ctx.restore();
      }
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2 / sc;
      ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.globalAlpha = enAlpha * colorProg * 0.42;
      ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#cc1111'; ctx.fillRect(ep.x - R, ep.y - R, R * 2, R * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = en.color;
      ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.fill();
      if (en.imageData) {
        const tImg = getTokenImg(en.imageData);
        if (tImg.complete && tImg.naturalWidth > 0) {
          ctx.save(); ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.clip();
          ctx.drawImage(tImg, ep.x - R, ep.y - R, R * 2, R * 2); ctx.restore();
        }
      }
      if (enTintCond) {
        ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = 0.45;
        ctx.fillStyle = enTintCond.tint!;
        ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      ctx.strokeStyle = isInvis ? 'rgba(100,180,255,.6)' : 'rgba(255,255,255,.85)'; ctx.lineWidth = 2 / sc;
      if (isInvis) ctx.setLineDash([5 / sc, 3 / sc]);
      ctx.beginPath(); ctx.arc(ep.x, ep.y, R, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    const showStates = isDM || !isInvis;
    ctx.globalAlpha = enAlpha;
    if (!en.imageData) {
      ctx.font = `bold ${11 / sc}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(en.name.slice(0, 2).toUpperCase(), ep.x, ep.y);
    }
    ctx.textBaseline = 'alphabetic';
    if (showStates) {
      ctx.font = `bold ${11 / sc}px system-ui`; ctx.textAlign = 'center';
      const tw = ctx.measureText(en.name).width;
      ctx.fillStyle = 'rgba(8,12,18,.85)';
      ctx.fillRect(ep.x - tw / 2 - 4 / sc, ep.y + R + 2 / sc, tw + 8 / sc, 13 / sc);
      ctx.fillStyle = isVis ? '#ffaaaa' : '#888';
      ctx.fillText(en.name, ep.x, ep.y + R + 12 / sc);
    }
    ctx.globalAlpha = 1;
    if (showStates) drawConditionBadges(ctx, ep.x, ep.y, R, enCondIds, sc);

    const _ha = rHighlightAlpha.current;
    if (_ha > 0.01 && isVis && !isDefeated && enAlpha > 0.3) {
      const pT = performance.now() / 1000;
      const pulse = 0.5 + 0.5 * Math.sin(pT * 3.2 + en.id * 0.43);
      ctx.save();
      ctx.strokeStyle = `rgba(255,210,0,${(0.10 + 0.08 * pulse) * _ha})`; ctx.lineWidth = 10 / sc;
      ctx.beginPath(); ctx.arc(ep.x, ep.y, R + (11 + 4 * pulse) / sc, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(255,220,50,${(0.60 + 0.35 * pulse) * _ha})`; ctx.lineWidth = 2.5 / sc;
      ctx.beginPath(); ctx.arc(ep.x, ep.y, R + (4 + 2 * pulse) / sc, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    if (isDM && en.hpMax > 0) {
      const hp = Math.max(0, en.hp ?? en.hpMax);
      const hpRatio = hp / en.hpMax;
      const barW = R * 2, barH = Math.max(13 / sc, R * 0.35);
      const barX = ep.x - R, barY = ep.y + R + 16 / sc;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? C.hpHigh : hpRatio > 0.25 ? C.hpMid : C.enemy;
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
      const barFontSize = Math.max(9 / sc, barH * 0.62);
      ctx.font = `bold ${barFontSize}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 2 / sc;
      ctx.fillText(`${hp}/${en.hpMax}`, ep.x, barY + barH / 2);
      ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    }

    if (isDefeated && showStates && (isDM || crossProg > 0)) {
      const cr = R * 0.82;
      ctx.save(); ctx.strokeStyle = C.enemy; ctx.lineWidth = 5 / sc; ctx.lineCap = 'round';
      if (isDM) {
        ctx.beginPath(); ctx.moveTo(ep.x - cr, ep.y - cr); ctx.lineTo(ep.x + cr, ep.y + cr); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ep.x + cr, ep.y - cr); ctx.lineTo(ep.x - cr, ep.y + cr); ctx.stroke();
      } else {
        const lineLen = cr * 2 * 1.42;
        const p1 = Math.min(1, crossProg * 2);
        if (p1 > 0) { ctx.setLineDash([p1 * lineLen, lineLen * 2]); ctx.beginPath(); ctx.moveTo(ep.x - cr, ep.y - cr); ctx.lineTo(ep.x + cr, ep.y + cr); ctx.stroke(); }
        const p2 = Math.max(0, crossProg * 2 - 1);
        if (p2 > 0) { ctx.setLineDash([p2 * lineLen, lineLen * 2]); ctx.beginPath(); ctx.moveTo(ep.x + cr, ep.y - cr); ctx.lineTo(ep.x - cr, ep.y + cr); ctx.stroke(); }
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    if (isDM && (rSelectedToken.current === `lib_${en.id}` || rMultiSelected.current.has(`lib_${en.id}`))) {
      const pT = performance.now() / 1000, pulse = 0.5 + 0.5 * Math.sin(pT * 4.5);
      ctx.save(); ctx.strokeStyle = `rgba(100,210,255,${0.65 + 0.35 * pulse})`; ctx.lineWidth = 2.5 / sc; ctx.setLineDash([6 / sc, 3 / sc]);
      ctx.beginPath(); ctx.arc(ep.x, ep.y, R + 7 / sc, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }

    ctx.globalAlpha = 1;
  });
}

export function renderPlayerTokens(ctx: CanvasRenderingContext2D, fc: FrameContext): void {
  const {
    sc, pp, isDM, s, v, rPlayers, rConditions, visualPosRef, rSelectedToken, rMultiSelected, rTokenSizeOverride,
    rDefeated, defeatedAnimRef, rTurn,
  } = fc;
  const _turn = rTurn?.current;
  const _activeId = _turn?.active ? _turn.order[_turn.turnIndex] : null;
  rPlayers.current.forEach(pl => {
    const rawPos = pp[`pl_${pl.id}`] || { x: pl.x, y: pl.y };
    let ppos = rawPos;
    if (!isDM) {
      const key = `pl_${pl.id}`;
      const vp = visualPosRef.current[key];
      if (!vp) { visualPosRef.current[key] = { ...rawPos }; ppos = rawPos; }
      // Drag local a la pantalla de jugador: el token segueix el dit sense LERP
      else if (rSelectedToken.current === key) { vp.x = rawPos.x; vp.y = rawPos.y; ppos = vp; }
      else { vp.x += (rawPos.x - vp.x) * TOKEN_LERP; vp.y += (rawPos.y - vp.y) * TOKEN_LERP; ppos = vp; }
      const cx = ppos.x + (rTokenSizeOverride.current[`pl_${pl.id}`] ?? 22);
      const cy = ppos.y + (rTokenSizeOverride.current[`pl_${pl.id}`] ?? 22);
      const hiddenByRoom = s.roomLayers.some(zl => {
        if (!v[zl.id]) return false;
        const zp = pp[zl.id] || { x: zl.left + zl.w / 2, y: zl.top + zl.h / 2 };
        const zx = zp.x - zl.w / 2, zy = zp.y - zl.h / 2;
        return cx >= zx && cx <= zx + zl.w && cy >= zy && cy <= zy + zl.h;
      });
      if (hiddenByRoom) return;
    }
    const R = rTokenSizeOverride.current[`pl_${pl.id}`] ?? 22;
    const plCondIds = rConditions.current[`pl_${pl.id}`] || [];
    const isInvis = plCondIds.includes('invisible');
    if (isInvis && !isDM) return;
    const isDefeated = !!rDefeated.current[`pl_${pl.id}`];
    let colorProg = 0, crossProg = 0;
    if (isDefeated) {
      if (isDM) { colorProg = 1; crossProg = 1; }
      else {
        const key = `pl_${pl.id}`;
        let prog = defeatedAnimRef.current[key] ?? 0;
        if (prog < 1) { prog = Math.min(1, prog + 0.018); defeatedAnimRef.current[key] = prog; }
        colorProg = Math.min(1, prog * 2); crossProg = Math.max(0, prog * 2 - 1);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.arc(ppos.x + R + 2 / sc, ppos.y + R + 2 / sc, R, 0, Math.PI * 2); ctx.fill();
    const plTintCond = findTintCond(plCondIds);
    if (isDefeated && colorProg > 0) {
      ctx.save();
      ctx.filter = `grayscale(${Math.round(colorProg * 100)}%)`;
      ctx.globalAlpha = 1 - colorProg * 0.35;
      ctx.fillStyle = pl.color;
      ctx.beginPath(); ctx.arc(ppos.x + R, ppos.y + R, R, 0, Math.PI * 2); ctx.fill();
      if (plTintCond) {
        ctx.save(); ctx.beginPath(); ctx.arc(ppos.x + R, ppos.y + R, R, 0, Math.PI * 2); ctx.clip();
        ctx.globalAlpha = (1 - colorProg * 0.35) * 0.45;
        ctx.fillStyle = plTintCond.tint!; ctx.fillRect(ppos.x, ppos.y, R * 2, R * 2); ctx.restore();
      }
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2 / sc;
      ctx.beginPath(); ctx.arc(ppos.x + R, ppos.y + R, R, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.globalAlpha = colorProg * 0.42;
      ctx.beginPath(); ctx.arc(ppos.x + R, ppos.y + R, R, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#cc1111'; ctx.fillRect(ppos.x, ppos.y, R * 2, R * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = pl.color;
      ctx.beginPath(); ctx.arc(ppos.x + R, ppos.y + R, R, 0, Math.PI * 2); ctx.fill();
      if (plTintCond) {
        ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = 0.45;
        ctx.fillStyle = plTintCond.tint!;
        ctx.beginPath(); ctx.arc(ppos.x + R, ppos.y + R, R, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = isInvis ? 'rgba(100,180,255,.6)' : 'rgba(255,255,255,.85)'; ctx.lineWidth = 2 / sc;
      if (isInvis) ctx.setLineDash([5 / sc, 3 / sc]);
      ctx.beginPath(); ctx.arc(ppos.x + R, ppos.y + R, R, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = '#fff'; ctx.font = `bold ${13 / sc}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pl.name.slice(0, 2).toUpperCase(), ppos.x + R, ppos.y + R);
    ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
    ctx.font = `${10 / sc}px system-ui`; ctx.textAlign = 'center';
    const tw2 = ctx.measureText(pl.name).width;
    ctx.fillStyle = 'rgba(8,12,18,.8)'; ctx.fillRect(ppos.x + R - tw2 / 2 - 4 / sc, ppos.y + R * 2 + 3 / sc, tw2 + 8 / sc, 12 / sc);
    ctx.fillStyle = pl.color; ctx.fillText(pl.name, ppos.x + R, ppos.y + R * 2 + 12 / sc);
    ctx.textAlign = 'left';
    drawConditionBadges(ctx, ppos.x + R, ppos.y + R, R, plCondIds, sc);

    if (isDM && pl.hpMax > 0) {
      const hp = pl.hp ?? pl.hpMax, hpRatio = Math.max(0, Math.min(1, hp / pl.hpMax));
      const barW = R * 2, barH = 5 / sc, barX = ppos.x, barY = ppos.y + R * 2 + 18 / sc;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? C.hpHigh : hpRatio > 0.25 ? C.hpMid : C.enemy;
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
      ctx.font = `bold ${9 / sc}px system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#e6edf3';
      ctx.fillText(`${hp}/${pl.hpMax}`, ppos.x + R, barY + barH + 9 / sc); ctx.textAlign = 'left';
    }

    if (isDefeated && (isDM || crossProg > 0)) {
      const cx = ppos.x + R, cy = ppos.y + R, cr = R * 0.82;
      ctx.save(); ctx.strokeStyle = C.enemy; ctx.lineWidth = 5 / sc; ctx.lineCap = 'round';
      if (isDM) {
        ctx.beginPath(); ctx.moveTo(cx - cr, cy - cr); ctx.lineTo(cx + cr, cy + cr); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + cr, cy - cr); ctx.lineTo(cx - cr, cy + cr); ctx.stroke();
      } else {
        const lineLen = cr * 2 * 1.42;
        const p1 = Math.min(1, crossProg * 2);
        if (p1 > 0) { ctx.setLineDash([p1 * lineLen, lineLen * 2]); ctx.beginPath(); ctx.moveTo(cx - cr, cy - cr); ctx.lineTo(cx + cr, cy + cr); ctx.stroke(); }
        const p2 = Math.max(0, crossProg * 2 - 1);
        if (p2 > 0) { ctx.setLineDash([p2 * lineLen, lineLen * 2]); ctx.beginPath(); ctx.moveTo(cx + cr, cy - cr); ctx.lineTo(cx - cr, cy + cr); ctx.stroke(); }
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    if (isDM && (rSelectedToken.current === `pl_${pl.id}` || rMultiSelected.current.has(`pl_${pl.id}`))) {
      const pT = performance.now() / 1000, pulse = 0.5 + 0.5 * Math.sin(pT * 4.5);
      ctx.save(); ctx.strokeStyle = `rgba(100,210,255,${0.65 + 0.35 * pulse})`; ctx.lineWidth = 2.5 / sc; ctx.setLineDash([6 / sc, 3 / sc]);
      ctx.beginPath(); ctx.arc(ppos.x + R, ppos.y + R, R + 7 / sc, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    }

    if (_activeId != null && _activeId === `pl_${pl.id}` && !isDefeated) drawActiveTurnRing(ctx, ppos.x + R, ppos.y + R, R, sc);
  });
}
