/**
 * Mode Fòsfor: la pantalla de jugador es veu com una TV de tub antiga (v4.92; paleta DB32 per proximitat des de la v4.93).
 *
 * Es fa DESPRÉS de pintar l'escena de sempre, sense tocar-la, i a la resolució real de la pantalla
 * (sense reduir píxels: el detall del mapa i de les figuretes es conserva):
 *   1. passada 1 (WebGL): el fons (`<img>`/`<video>`) i el canvas del mapa es componen i cada píxel
 *      es converteix en el color més proper de la paleta DB32 (32 colors);
 *   2. passada 2 (WebGL): corbatura del tub, línies d'escombrat, punts RGB, halo dels colors
 *      brillants i un parpelleig lleuger.
 * Les línies fines i les cantonades fosques de damunt de tot (rètols, fitxes, diàlegs) són CSS
 * (`.phosphor-glass` a `globals.css`), perquè els elements DOM no passen per aquí.
 *
 * Sense WebGL (o amb un fons d'un altre origen, que no es pot llegir) el llenç s'amaga: es veu
 * l'escena normal amb el vidre de CSS a sobre.
 */

/**
 * Paleta del mode: **DawnBringer 32** (DB32), la paleta de 32 colors de DawnBringer feta per a
 * pixel art, d'ús lliure i molt estesa. És coherent (rampes de pell, terra, verds, blaus i grisos
 * pensades per anar juntes) i cobreix tots els tons, així que cada color del mapa troba un parent
 * proper: el marró continua sent marró, la pedra grisa i l'aigua blava.
 */
export const PHOSPHOR_PALETTE = [
  '#000000', '#222034', '#45283c', '#663931', '#8f563b', '#df7126', '#d9a066', '#eec39a',
  '#fbf236', '#99e550', '#6abe30', '#37946e', '#4b692f', '#524b24', '#323c39', '#3f3f74',
  '#306082', '#5b6ee1', '#639bff', '#5fcde4', '#cbdbfc', '#ffffff', '#9badb7', '#847e87',
  '#696a6a', '#595652', '#76428a', '#ac3232', '#d95763', '#d77bba', '#8f974a', '#8a6f30',
] as const;

/** sRGB (#rrggbb) → OKLab: l'espai on la distància s'assembla a la diferència que veu l'ull. */
export function hexToOklab(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const r = lin((n >> 16) & 255), g = lin((n >> 8) & 255), b = lin(n & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

/** Alçada en px de pantalla de cada línia d'escombrat (la del WebGL i la del vidre de CSS). */
export function scanlinePx(H: number): number {
  return Math.max(3, Math.min(4.5, H / 240));
}

const VS = `
attribute vec2 p;
varying vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }
`;

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return `vec3(${((n >> 16) & 255) / 255}, ${((n >> 8) & 255) / 255}, ${(n & 255) / 255})`;
};
const f = (v: number) => v.toFixed(6);
// Un `if` per color de la paleta (desplegat: el GLSL ES 1.0 no deixa triar un element d'una
// taula uniforme amb un índex calculat al fragment).
const NEAREST = PHOSPHOR_PALETTE.map(h => {
  const [L, A, B] = hexToOklab(h);
  return `  e = lab - vec3(${f(L)}, ${f(A)}, ${f(B)}); d = dot(e, e); if (d < bd) { bd = d; o = ${hex(h)}; }`;
}).join('\n');

// Passada 1: composició (fons + canvas del mapa) i paleta. Cada píxel es converteix en el color
// MÉS PROPER de la paleta, mesurat en OKLab (no en RGB: en RGB un gris mitjà i un verd apagat
// semblen a la mateixa distància). Cap regla per famílies: el criteri és només la proximitat.
// Abans es fa la mitjana amb els 4 veïns: sense, la textura del terra (herba, llambordes) saltava
// d'un color a l'altre i feia soroll.
// `rect` = on és el fons, en fraccions de la pantalla des de dalt a l'esquerra (x, y, amplada, alçada).
// Les textures es pugen girades (UNPACK_FLIP_Y): `uv` (0 a baix) val tal qual per al mapa.
// ⚠️ Cap comentari dins del GLSL: només hi pot anar ASCII.
const FS_PALETTE = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 uv;
uniform sampler2D map;
uniform sampler2D media;
uniform float hasMedia;
uniform vec4 rect;
uniform vec2 texel;
vec3 comp(vec2 q) {
  vec3 c = vec3(0.0);
  vec2 top = vec2(q.x, 1.0 - q.y);
  vec2 m = (top - rect.xy) / rect.zw;
  if (hasMedia > 0.5 && m.x >= 0.0 && m.x <= 1.0 && m.y >= 0.0 && m.y <= 1.0) c = texture2D(media, vec2(m.x, 1.0 - m.y)).rgb;
  vec4 k = texture2D(map, q);
  return mix(c, k.rgb, k.a);
}
void main() {
  vec3 c = comp(uv) * 0.36
         + (comp(uv + texel) + comp(uv - texel) + comp(uv + vec2(texel.x, -texel.y)) + comp(uv + vec2(-texel.x, texel.y))) * 0.16;
  vec3 lin = mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
  vec3 lms = vec3(
    dot(lin, vec3(0.4122214708, 0.5363325363, 0.0514459929)),
    dot(lin, vec3(0.2119034982, 0.6806995451, 0.1073969566)),
    dot(lin, vec3(0.0883024619, 0.2817188376, 0.6299787005)));
  lms = pow(max(lms, vec3(0.0)), vec3(1.0 / 3.0));
  vec3 lab = vec3(
    dot(lms, vec3(0.2104542553, 0.7936177850, -0.0040720468)),
    dot(lms, vec3(1.9779984951, -2.4285922050, 0.4505937099)),
    dot(lms, vec3(0.0259040371, 0.7827717662, -0.8086757660)));
  vec3 o = vec3(0.0); vec3 e; float d; float bd = 100.0;
${NEAREST}
  gl_FragColor = vec4(o, 1.0);
}
`;

// Passada 2: el tub. Corbatura, línia d'escombrat cada `line` px de pantalla, halo amb 8 mostres
// del voltant, punts de fòsfor RGB (columnes de 3 px) i el parpelleig (`flick`, calculat a la CPU:
// `mediump` no té prou precisió per al temps).
const FS_CRT = `
precision mediump float;
varying vec2 uv;
uniform sampler2D pal;
uniform vec2 res;
uniform float line;
uniform float flick;
vec2 curve(vec2 q) {
  q = q * 2.0 - 1.0;
  vec2 off = abs(q.yx) / vec2(6.0, 4.6);
  q = q + q * off * off;
  return q * 0.5 + 0.5;
}
void main() {
  vec2 q = curve(uv);
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec3 col = texture2D(pal, q).rgb;
  float fy = fract((1.0 - q.y) * res.y / line) - 0.5;
  float scan = exp(-fy * fy * 9.0);
  col *= mix(0.45, 1.1, scan);
  vec2 d = 2.5 / res;
  vec3 g = texture2D(pal, q + vec2(d.x, 0.0)).rgb + texture2D(pal, q - vec2(d.x, 0.0)).rgb
         + texture2D(pal, q + vec2(0.0, d.y)).rgb + texture2D(pal, q - vec2(0.0, d.y)).rgb
         + texture2D(pal, q + d * 2.0).rgb + texture2D(pal, q - d * 2.0).rgb
         + texture2D(pal, q + vec2(d.x, -d.y) * 2.0).rgb + texture2D(pal, q + vec2(-d.x, d.y) * 2.0).rgb;
  col += g * 0.045;
  float m = mod(gl_FragCoord.x, 3.0);
  vec3 mask = m < 1.0 ? vec3(1.0, 0.8, 0.8) : m < 2.0 ? vec3(0.8, 1.0, 0.8) : vec3(0.8, 0.8, 1.0);
  col *= mask * 1.1;
  col *= flick;
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, fsSrc: string): WebGLProgram | null {
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type); if (!s) return null;
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error('Fòsfor:', gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const vs = mk(gl.VERTEX_SHADER, VS), fs = mk(gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const pr = gl.createProgram(); if (!pr) return null;
  gl.attachShader(pr, vs); gl.attachShader(pr, fs);
  gl.bindAttribLocation(pr, 0, 'p');
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.error('Fòsfor:', gl.getProgramInfoLog(pr)); return null; }
  return pr;
}

function newTex(gl: WebGLRenderingContext): WebGLTexture | null {
  const tx = gl.createTexture(); if (!tx) return null;
  gl.bindTexture(gl.TEXTURE_2D, tx);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tx;
}

type Media = HTMLImageElement | HTMLVideoElement;
type U = WebGLUniformLocation | null;

export class PhosphorScreen {
  private gl: WebGLRenderingContext | null = null;
  private progPal: WebGLProgram | null = null;
  private progCrt: WebGLProgram | null = null;
  private texMap: WebGLTexture | null = null;
  private texMedia: WebGLTexture | null = null;
  private texPal: WebGLTexture | null = null;
  private fbo: WebGLFramebuffer | null = null;
  private palW = 0; private palH = 0;
  /** Fons ja pujat a la GPU (una imatge es puja un sol cop; un vídeo, cada fotograma). */
  private mediaUp: Media | null = null;
  /** El canvas del mapa ja és a la textura (amb la mida d'ara)? */
  private mapUp = false;
  private u: { hasMedia: U; rect: U; texel: U; res: U; line: U; flick: U } = { hasMedia: null, rect: null, texel: null, res: null, line: null, flick: null };
  private shown: boolean | null = null;
  /** `false` = sense WebGL: el llenç s'amaga i es veu l'escena normal. */
  gpu = false;

  constructor(private out: HTMLCanvasElement) {
    this.initGl();
    out.addEventListener('webglcontextlost', e => { e.preventDefault(); this.gpu = false; });
    out.addEventListener('webglcontextrestored', () => this.initGl());
  }

  private initGl() {
    const gl = this.out.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    this.gl = gl;
    this.gpu = false;
    this.mediaUp = null;
    this.mapUp = false;
    if (!gl) return;
    this.progPal = compile(gl, FS_PALETTE);
    this.progCrt = compile(gl, FS_CRT);
    if (!this.progPal || !this.progCrt) return;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.texMap = newTex(gl);
    this.texMedia = newTex(gl);
    this.texPal = newTex(gl);
    this.fbo = gl.createFramebuffer();
    this.palW = this.palH = 0;
    gl.useProgram(this.progPal);
    gl.uniform1i(gl.getUniformLocation(this.progPal, 'map'), 0);
    gl.uniform1i(gl.getUniformLocation(this.progPal, 'media'), 1);
    this.u.hasMedia = gl.getUniformLocation(this.progPal, 'hasMedia');
    this.u.rect = gl.getUniformLocation(this.progPal, 'rect');
    this.u.texel = gl.getUniformLocation(this.progPal, 'texel');
    gl.useProgram(this.progCrt);
    gl.uniform1i(gl.getUniformLocation(this.progCrt, 'pal'), 0);
    this.u.res = gl.getUniformLocation(this.progCrt, 'res');
    this.u.line = gl.getUniformLocation(this.progCrt, 'line');
    this.u.flick = gl.getUniformLocation(this.progCrt, 'flick');
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    this.gpu = true;
  }

  private show(on: boolean) {
    if (on === this.shown) return;
    this.out.style.display = on ? 'block' : 'none';
    this.shown = on;
  }

  /** Amaga el llenç (mode apagat). */
  hide() { this.show(false); }

  dispose() { this.gl?.getExtension('WEBGL_lose_context')?.loseContext(); }

  /**
   * Un fotograma. `media` és el fons (posicionat amb `left/top/width/height` en px CSS, el mateix
   * espai que el canvas del mapa) i `map` el canvas del mapa, de mida `W×H`.
   */
  draw(media: Media | null, map: HTMLCanvasElement, W: number, H: number, now: number, fresh = true) {
    const gl = this.gl;
    if (!this.gpu || !gl) { this.show(false); return; }
    this.show(true);
    if (this.out.width !== W || this.out.height !== H) { this.out.width = W; this.out.height = H; this.mapUp = false; }
    try {
      // Fons: on és i, si cal, pujar-lo.
      let hasMedia = 0;
      if (media) {
        const isVid = media.tagName === 'VIDEO';
        const ready = isVid ? (media as HTMLVideoElement).readyState >= 2 : (media as HTMLImageElement).complete && (media as HTMLImageElement).naturalWidth > 0;
        const st = media.style;
        const l = parseFloat(st.left), t = parseFloat(st.top), mw = parseFloat(st.width), mh = parseFloat(st.height);
        if (ready && mw > 0 && mh > 0) {
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, this.texMedia);
          if (isVid || this.mediaUp !== media) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media);
            this.mediaUp = media;
          }
          hasMedia = 1;
          gl.useProgram(this.progPal);
          gl.uniform4f(this.u.rect, l / W, t / H, mw / W, mh / H);
        }
      }
      // Passada 1: composició + paleta → `texPal` (a la mida de la pantalla).
      gl.activeTexture(gl.TEXTURE0);
      if (this.palW !== W || this.palH !== H) {
        gl.bindTexture(gl.TEXTURE_2D, this.texPal);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texPal, 0);
        this.palW = W; this.palH = H;
      }
      gl.bindTexture(gl.TEXTURE_2D, this.texMap);
      // Pujar el canvas del mapa és el gruix del cost: només quan s'ha repintat (`fresh`).
      if (fresh || !this.mapUp) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, map);
        this.mapUp = true;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.viewport(0, 0, W, H);
      gl.useProgram(this.progPal);
      gl.uniform1f(this.u.hasMedia, hasMedia);
      gl.uniform2f(this.u.texel, 1 / W, 1 / H);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // Passada 2: tub.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, this.texPal);
      gl.useProgram(this.progCrt);
      gl.uniform2f(this.u.res, W, H);
      gl.uniform1f(this.u.line, scanlinePx(H));
      const ts = now / 1000;
      gl.uniform1f(this.u.flick, 1 + 0.015 * Math.sin(ts * 37) + 0.008 * Math.sin(ts * 113));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } catch (err) {
      // Fons d'un altre origen (no es pot llegir) o GPU sense memòria: escena normal.
      console.error('Fòsfor: sense WebGL', err);
      this.gpu = false;
      this.show(false);
    }
  }
}
