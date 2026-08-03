import { DARK_FANTASY } from '@/theme';

// L'aparell físic que "resol" la masmorra: bisell de ferro al voltant de
// tota la pantalla amb cantoneres daurades (fragment de registre alt), i
// l'acabat de pantalla: scanlines, vinyeta, bloom de fòsfor àmbar amb
// parpelleig ocasional i franja cromàtica als marges.
// Tot pointer-events: none i estàtic — cost zero per al render loop.
// Es munta des de layout.tsx només quan DARK_FANTASY és actiu.

const IRON = '#120c18';
const IRON_HI = 'rgba(255,225,160,0.14)';
const GOLD = '#e8b84a';

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const s: React.CSSProperties = {
    position: 'absolute', width: 22, height: 22,
    ...(pos === 'tl' && { top: 4, left: 4, borderTop: `3px solid ${GOLD}`, borderLeft: `3px solid ${GOLD}` }),
    ...(pos === 'tr' && { top: 4, right: 4, borderTop: `3px solid ${GOLD}`, borderRight: `3px solid ${GOLD}` }),
    ...(pos === 'bl' && { bottom: 4, left: 4, borderBottom: `3px solid ${GOLD}`, borderLeft: `3px solid ${GOLD}` }),
    ...(pos === 'br' && { bottom: 4, right: 4, borderBottom: `3px solid ${GOLD}`, borderRight: `3px solid ${GOLD}` }),
    opacity: 0.75,
    filter: 'drop-shadow(0 0 4px rgba(232,184,74,0.4))',
  };
  return <div style={s} />;
}

export default function CRTOverlay() {
  if (!DARK_FANTASY) return null;
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 9000, pointerEvents: 'none' }}>
      {/* Bisell de ferro de l'aparell (marc físic) */}
      <div style={{
        position: 'absolute', inset: 0,
        border: `8px solid ${IRON}`,
        boxShadow: `inset 0 0 0 1px ${IRON_HI}, inset 0 0 0 2px rgba(0,0,0,0.8), inset 0 0 42px rgba(0,0,0,0.75)`,
      }} />
      <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
      {/* Scanlines 1px */}
      <div style={{
        position: 'absolute', inset: 8,
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 3px)',
      }} />
      {/* Vinyeta: el negre és el substrat, no el fons */}
      <div style={{
        position: 'absolute', inset: 8,
        background: 'radial-gradient(ellipse 72% 66% at 50% 48%, transparent 48%, rgba(3,1,6,0.5) 80%, rgba(2,1,4,0.78) 100%)',
      }} />
      {/* Bloom de fòsfor àmbar amb parpelleig ocasional */}
      <div style={{
        position: 'absolute', inset: 8,
        background: 'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(255,176,50,0.06), transparent 65%)',
        mixBlendMode: 'screen',
        animation: 'dfPhosphor 7s steps(1) infinite',
      }} />
      {/* Franja cromàtica mínima als marges laterals */}
      <div style={{
        position: 'absolute', inset: 8,
        background:
          'linear-gradient(90deg, rgba(255,40,60,0.07) 0px, transparent 4px), ' +
          'linear-gradient(270deg, rgba(60,120,255,0.07) 0px, transparent 4px)',
      }} />
    </div>
  );
}
