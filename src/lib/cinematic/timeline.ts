/** Línia de temps d'esdeveniments puntuals (ms des de l'inici). La fa avançar el tick de cada pantalla. */
export class CinematicTimeline {
  private _ev: Array<{ ms: number; fn: (el: number) => void; done: boolean }> = [];
  private _t0: number | null = null;
  private _run = false;

  add(ms: number, fn: (el: number) => void): this {
    this._ev.push({ ms, fn, done: false });
    return this;
  }

  /** `offsetMs` > 0 arrenca ja avançada: els esdeveniments anteriors es disparen al primer tick. */
  play(offsetMs = 0): this {
    this._ev.sort((a, b) => a.ms - b.ms);
    this._ev.forEach(e => (e.done = false));
    this._t0 = performance.now() - offsetMs;
    this._run = true;
    return this;
  }

  tick(): void {
    if (!this._run || this._t0 === null) return;
    const el = performance.now() - this._t0;
    for (const e of this._ev) {
      if (!this._run) return;
      if (!e.done && el >= e.ms) { e.done = true; try { e.fn(el); } catch { /* ignore */ } }
    }
  }

  skip(): void { this._run = false; }
}
