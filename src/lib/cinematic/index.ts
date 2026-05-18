export class CinematicTimeline {
  private _ev: Array<{ ms: number; fn: (el: number) => void; done: boolean }> = [];
  private _t0: number | null = null;
  private _run = false;

  add(ms: number, fn: (el: number) => void): this {
    this._ev.push({ ms, fn, done: false });
    return this;
  }

  play(): this {
    this._ev.sort((a, b) => a.ms - b.ms);
    this._ev.forEach(e => (e.done = false));
    this._t0 = performance.now();
    this._run = true;
    return this;
  }

  tick(): void {
    if (!this._run || this._t0 === null) return;
    const el = performance.now() - this._t0;
    for (const e of this._ev) {
      if (!e.done && el >= e.ms) { e.done = true; try { e.fn(el); } catch { /* ignore */ } }
    }
  }

  skip(): void { this._run = false; }
}

const _CP_MAX = 80;
const _cpPool = Array.from({ length: _CP_MAX }, () => ({
  alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, mxL: 1, r: 2, col: '#fff',
}));

export function cpSpawn(x: number, y: number, vx: number, vy: number, life: number, r: number, col: string): void {
  const p = _cpPool.find(p => !p.alive); if (!p) return;
  p.alive = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.mxL = life; p.r = r; p.col = col;
}

export function cpBurst(W: number, H: number, qty: number): void {
  const cols = ['#d4a017', '#ff9900', '#ffd700'];
  for (let i = 0; i < qty; i++) {
    const col = cols[i % cols.length];
    const ang = Math.random() * Math.PI * 2, spd = 40 + Math.random() * 110;
    const x = W * (0.3 + Math.random() * 0.45), y = H * (0.25 + Math.random() * 0.5);
    cpSpawn(x, y, Math.cos(ang) * spd, Math.sin(ang) * spd, 0.6 + Math.random() * 1.1, 1 + Math.random() * 2.5, col);
  }
}

export function cpUpdate(dt: number): void {
  for (const p of _cpPool) {
    if (!p.alive) continue;
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.life <= 0) { p.alive = false; continue; }
    p.vx *= Math.pow(0.97, dt * 60); p.vy *= Math.pow(0.97, dt * 60);
  }
}

export function cpDraw(ctx: CanvasRenderingContext2D): void {
  for (const p of _cpPool) {
    if (!p.alive) continue;
    const t = p.life / p.mxL;
    ctx.save(); ctx.globalAlpha = t * 0.85; ctx.shadowColor = p.col; ctx.shadowBlur = p.r * 3;
    ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
}

export function cpKill(): void { _cpPool.forEach(p => (p.alive = false)); }
