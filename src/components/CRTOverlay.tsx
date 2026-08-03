import { DARK_FANTASY } from '@/theme';

// Acabat de "dispositiu": scanlines, vinyeta i bloom de fòsfor àmbar per
// sobre de tota la pantalla. Sense hooks ni events (pointer-events: none),
// és una capa estàtica que el compositor de la GPU pinta gratis.
// Es munta des de layout.tsx només quan DARK_FANTASY és actiu.
export default function CRTOverlay() {
  if (!DARK_FANTASY) return null;
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 9000, pointerEvents: 'none' }}>
      {/* Scanlines 1px */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 1px, transparent 3px)',
      }} />
      {/* Vinyeta: el negre és el substrat, no el fons */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 75% 70% at 50% 48%, transparent 55%, rgba(4,2,8,0.38) 82%, rgba(3,1,6,0.62) 100%)',
      }} />
      {/* Bloom de fòsfor àmbar, molt tènue, centrat */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(255,176,50,0.045), transparent 65%)',
        mixBlendMode: 'screen',
      }} />
      {/* Franja cromàtica mínima als marges laterals */}
      <div style={{
        position: 'absolute', inset: 0,
        background:
          'linear-gradient(90deg, rgba(255,40,60,0.06) 0px, transparent 3px), ' +
          'linear-gradient(270deg, rgba(60,120,255,0.06) 0px, transparent 3px)',
      }} />
    </div>
  );
}
