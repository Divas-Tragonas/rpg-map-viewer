// ─────────────────────────────────────────────────────────────────────────────
// Revelador de text — motor de revelació compartit (DM + Jugador)
//
// El DM és la font de veritat: integra `pos` (front continu de caràcters) a partir
// de la velocitat, les pauses dramàtiques i el mode manual, i emet `TEXTREVEAL_SYNC`
// amb { pos, cps, fadeMs } a ~30fps. El Jugador segueix aquest `pos` amb el seu propi
// rellotge per a l'esvaïment, de manera que les pauses es propaguen però l'esvaïment
// continua suaument (idèntic a l'algoritme del prototip `revelador`).
// ─────────────────────────────────────────────────────────────────────────────

// 5..55 caràcters/s
export function cpsFromSlider(v: number): number { const t = (v - 1) / 99; return 5 + t * 50; }
// 120..900 ms per caràcter
export function fadeMsFromSlider(v: number): number { const t = (v - 1) / 99; return 120 + t * 780; }

export function speedLabel(v: number): string {
  return v < 25 ? 'molt lenta' : v < 45 ? 'lenta' : v < 65 ? 'mitjana' : v < 85 ? 'ràpida' : 'molt ràpida';
}
export function smoothLabel(v: number): string {
  return v < 25 ? 'subtil' : v < 50 ? 'suau' : v < 75 ? 'molt suau' : 'vaporós';
}

// Final de frase: després de [.!?…] (+ cometes/parèntesis + espais) i als canvis de paràgraf.
export function computeBounds(t: string): { bounds: number[]; paraSet: Set<number> } {
  const bounds: number[] = [];
  const paraSet = new Set<number>();
  let i = 0;
  const L = t.length;
  while (i < L) {
    while (i < L && !/[.!?…]/.test(t[i]) && !(t[i] === '\n' && /\n/.test(t[i + 1] || ''))) i++;
    if (i >= L) { bounds.push(L); break; }
    if (t[i] === '\n') { while (i < L && t[i] === '\n') i++; bounds.push(i); paraSet.add(i); continue; }
    while (i < L && /[.!?…]/.test(t[i])) i++;
    while (i < L && /["»''’”)\]]/.test(t[i])) i++;
    while (i < L && /\s/.test(t[i])) i++;
    bounds.push(i);
  }
  if (!bounds.length || bounds[bounds.length - 1] !== L) bounds.push(L);
  return { bounds, paraSet };
}

export class RevealEngine {
  chars = '';
  n = 0;
  units: HTMLSpanElement[] = [];
  revealStart: number[] = [];
  pos = 0;        // front continu (caràcters)
  passed = 0;     // caràcters que ja han començat a revelar-se
  solid = 0;      // índex fins on l'esvaïment ja és complet
  target = 0;     // objectiu del front (manual / seguiment)
  dwell = 0;      // pausa dramàtica pendent (ms)
  clock = 0;      // rellotge lògic (ms)
  bounds: number[] = [];
  paraSet: Set<number> = new Set();

  setText(text: string, container: HTMLElement): void {
    this.chars = text;
    this.n = text.length;
    this.pos = 0; this.passed = 0; this.solid = 0; this.target = 0; this.dwell = 0; this.clock = 0;
    this.revealStart = new Array(this.n).fill(Infinity);
    this.units = [];
    container.innerHTML = '';
    if (!text) { this.bounds = []; this.paraSet = new Set(); return; }
    const frag = document.createDocumentFragment();
    for (let i = 0; i < this.n; i++) {
      const sp = document.createElement('span');
      sp.style.opacity = '0';
      sp.style.willChange = 'opacity,filter';
      sp.textContent = text[i];
      frag.appendChild(sp);
      this.units.push(sp);
    }
    container.appendChild(frag);
    const b = computeBounds(text);
    this.bounds = b.bounds; this.paraSet = b.paraSet;
  }

  clearVisual(): void {
    for (let i = 0; i < this.passed; i++) {
      if (this.units[i]) { this.units[i].style.opacity = '0'; this.units[i].style.filter = ''; }
    }
    for (let j = 0; j < this.n; j++) this.revealStart[j] = Infinity;
    this.passed = 0; this.solid = 0;
  }

  reset(): void {
    this.clearVisual();
    this.pos = 0; this.target = 0; this.dwell = 0; this.clock = 0;
  }

  // Datem enrere l'inici de l'esvaïment de cada caràcter pel moment real de creuament.
  crossTo(np: number, cps: number): void {
    while (this.passed < np && this.passed < this.n) {
      this.revealStart[this.passed] = this.clock - (np - this.passed) / cps * 1000;
      this.passed++;
    }
  }

  // Salt enrere instantani (reset parcial / frase anterior): tot per sota de `t` queda sòlid.
  snapTo(t: number): void {
    const k = Math.max(0, Math.min(this.n, Math.floor(t)));
    this.clearVisual();
    for (let i = 0; i < k; i++) {
      this.revealStart[i] = -1e12;
      if (this.units[i]) { this.units[i].style.opacity = '1'; this.units[i].style.filter = 'none'; }
    }
    this.passed = k; this.solid = k; this.pos = t; this.target = t;
  }

  private boundaryIn(a: number, b: number): number {
    for (const v of this.bounds) { if (v > a + 1e-9 && v <= b) return v; }
    return -1;
  }

  nextBoundary(ref: number): number {
    for (const v of this.bounds) { if (v > ref + 1e-6) return v; }
    return -1;
  }

  prevBoundary(ref: number): number {
    let prev = 0;
    for (const v of this.bounds) { if (v < ref - 0.5) prev = v; else break; }
    return prev;
  }

  sentenceIndex(): number {
    let cur = 0;
    for (let i = 0; i < this.bounds.length; i++) { if (this.bounds[i] <= Math.round(this.pos)) cur = i + 1; }
    return Math.min(cur, this.bounds.length);
  }

  tick(dt: number): void { this.clock += dt; }

  // DM autoritatiu: avança el front segons velocitat, pauses dramàtiques i mode manual.
  advance(dt: number, cps: number, dramatic: boolean, manual: boolean): void {
    if (manual) {
      if (this.pos < this.target - 1e-6) {
        const np = Math.min(this.target, this.pos + cps * dt / 1000);
        this.crossTo(np, cps); this.pos = np;
      }
    } else {
      if (this.dwell > 0) { this.dwell -= dt; if (this.dwell < 0) this.dwell = 0; }
      else if (this.pos < this.n) {
        let np = this.pos + cps * dt / 1000; if (np > this.n) np = this.n;
        if (dramatic) {
          const b = this.boundaryIn(this.pos, np);
          if (b > 0) { np = b; this.dwell = this.paraSet.has(b) ? 750 : 520; }
        }
        this.crossTo(np, cps); this.pos = np;
      }
    }
  }

  // Jugador: segueix el `pos` rebut del DM (endavant esglaonat, enrere instantani).
  follow(targetPos: number, cps: number): void {
    if (targetPos < this.pos - 0.5) { this.snapTo(targetPos); return; }
    this.target = targetPos;
    this.crossTo(targetPos, cps);
    this.pos = targetPos;
  }

  render(fadeMs: number, stage?: HTMLElement | null): void {
    if (!this.n) return;
    while (this.solid < this.passed && (this.clock - this.revealStart[this.solid]) >= fadeMs) {
      this.units[this.solid].style.opacity = '1';
      this.units[this.solid].style.filter = 'none';
      this.solid++;
    }
    for (let i = this.solid; i < this.passed; i++) {
      let p = (this.clock - this.revealStart[i]) / fadeMs; p = p < 0 ? 0 : p > 1 ? 1 : p;
      const o = p * p * (3 - 2 * p); // smoothstep
      this.units[i].style.opacity = o.toFixed(3);
      this.units[i].style.filter = o > 0.985 ? 'none' : `blur(${((1 - o) * 2.4).toFixed(2)}px)`;
    }
    if (stage) this.follow_scroll(stage);
  }

  // Re-anivella `solid` (en pausa, en moure el control de suavitat).
  recompute(): void { this.solid = 0; }

  private follow_scroll(stage: HTMLElement): void {
    let k = Math.round(this.pos); if (k < 0) k = 0; if (k > this.n - 1) k = this.n - 1;
    const u = this.units[k]; if (!u) return;
    const cr = u.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    if (cr.bottom > sr.bottom - 40 || cr.top < sr.top + 40) {
      stage.scrollTop += (cr.top - (sr.top + sr.height * 0.55));
    }
  }
}
