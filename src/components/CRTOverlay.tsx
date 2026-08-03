import { DARK_FANTASY } from '@/theme';

// Marc físic de l'aparell (estil Diablo 2): bisell de pedra/ferro fosc al
// voltant de la pantalla amb cantoneres d'or antic. Sense cap efecte sobre
// el contingut (ni scanlines ni vinyeta): la llegibilitat mana.
// Tot pointer-events: none i estàtic — cost zero per al render loop.
// Es munta des de layout.tsx només quan DARK_FANTASY és actiu.

const IRON = '#171008';
const IRON_HI = 'rgba(240,225,190,0.12)';
const GOLD = '#c7a55a';

function Corner({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const s: React.CSSProperties = {
    position: 'absolute', width: 20, height: 20,
    ...(pos === 'tl' && { top: 3, left: 3, borderTop: `3px solid ${GOLD}`, borderLeft: `3px solid ${GOLD}` }),
    ...(pos === 'tr' && { top: 3, right: 3, borderTop: `3px solid ${GOLD}`, borderRight: `3px solid ${GOLD}` }),
    ...(pos === 'bl' && { bottom: 3, left: 3, borderBottom: `3px solid ${GOLD}`, borderLeft: `3px solid ${GOLD}` }),
    ...(pos === 'br' && { bottom: 3, right: 3, borderBottom: `3px solid ${GOLD}`, borderRight: `3px solid ${GOLD}` }),
    opacity: 0.7,
  };
  return <div style={s} />;
}

export default function CRTOverlay() {
  if (!DARK_FANTASY) return null;
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 9000, pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', inset: 0,
        border: `6px solid ${IRON}`,
        boxShadow: `inset 0 0 0 1px ${IRON_HI}, inset 0 0 0 2px rgba(0,0,0,0.7)`,
      }} />
      <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
    </div>
  );
}
