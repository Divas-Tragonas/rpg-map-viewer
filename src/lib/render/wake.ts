// Ritme del bucle de render (DM i pantalla de jugador).
//
// Abans el canvas es netejava i es repintava sencer a cada `requestAnimationFrame`, sempre:
// amb l'escena quieta la tablet o la TV treballaven igual que a mig combat. Ara cada
// fotograma es decideix en tres graons:
//
//  1. DESPERT (ritme ple): durant `WAKE_TAIL_MS` després de l'últim `wake()` (un missatge,
//     una interacció, un render de React, una imatge que acaba de carregar) o mentre el bucle
//     digui que hi ha una animació «calenta» (màgia en vol, cinemàtica, token caminant…). La
//     cua cobreix tots els LERP i esvaïments curts (tokens, càmera, sales, portes), que
//     convergeixen en molt menys temps.
//  2. AMBIENT (~30 fps): no ha canviat res, però l'escena té animacions perpètues i lentes
//     (figuretes en espera, aigua, zones màgiques, pols del torn o de la selecció).
//  3. ADORMIT: res a animar. No es toca el canvas (conserva l'últim fotograma).
//
// A més, mai no es pinta més d'un fotograma cada `FRAME_MIN_MS`: els LERP avancen un pas
// fix per fotograma (estan afinats a 60 fps) i en una pantalla de 120–144 Hz tot anava al
// doble de velocitat fent el doble de feina.
//
// ⚠️ Tot el que canviï el que es veu SENSE passar per un missatge, una interacció o un
// `setState` ha de cridar `wake()`; i una animació nova que duri més que la cua ha d'entrar
// a la llista «calenta» o «ambient» del bucle (`useRafLoop` / `PlayerView`). Si alguna cosa
// es queda congelada, `IDLE_PACING = false` torna al comportament d'abans.

/** Interruptor general dels graons ambient/adormit (el sostre de fotogrames es manté). */
export const IDLE_PACING = true;
/** Cua de ritme ple després de l'últim `wake()`. */
export const WAKE_TAIL_MS = 4000;
/** Separació mínima entre fotogrames: deixa passar fins a ~90 Hz i parteix per dos a partir de 100 Hz. */
export const FRAME_MIN_MS = 10.5;
/** Separació entre fotogrames al graó ambient (un de cada dos a 60 Hz). */
export const AMBIENT_MS = 30;

let lastWake = 0;

/** Alguna cosa del que es veu ha canviat (o està a punt de fer-ho): ritme ple una estona. */
export function wake(): void { lastWake = performance.now(); }

/** Decideix, fotograma a fotograma, si toca pintar. Un per bucle. */
export class FramePacer {
  private last = -1e9;
  /** `hot`: animació que demana ritme ple · `ambient`: només animacions perpètues i lentes. */
  due(now: number, hot: boolean, ambient: boolean): boolean {
    const dt = now - this.last;
    if (dt < FRAME_MIN_MS) return false;
    if (IDLE_PACING && !hot && now - lastWake >= WAKE_TAIL_MS) {
      if (!ambient || dt < AMBIENT_MS) return false;
    }
    this.last = now;
    return true;
  }
}

const WAKE_EVENTS = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'wheel', 'keydown', 'keyup',
  'touchstart', 'touchmove', 'touchend', 'resize', 'focus', 'orientationchange'] as const;

/** Qualsevol interacció amb la finestra desperta el bucle. Retorna la funció per desfer-ho. */
export function installWakeListeners(): () => void {
  const opts = { capture: true, passive: true } as const;
  for (const ev of WAKE_EVENTS) window.addEventListener(ev, wake, opts);
  document.addEventListener('visibilitychange', wake);
  return () => {
    for (const ev of WAKE_EVENTS) window.removeEventListener(ev, wake, opts);
    document.removeEventListener('visibilitychange', wake);
  };
}

/** Hi ha alguna entrada amb contingut? (mapes d'estats, camins de moviment…) */
export function anyKey(o: object | null | undefined): boolean {
  if (!o) return false;
  for (const k in o) { void k; return true; }
  return false;
}
