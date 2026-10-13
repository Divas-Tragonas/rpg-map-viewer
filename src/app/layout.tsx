import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// EB Garamond per als títols i el text que es llegeix als jugadors (`FONT_SERIF`). Es serveix
// des de l'app (fitxer a `fonts/`, llicència OFL al costat) i no des de Google: la partida es
// pot jugar sense internet i `next/font/google` el baixa en compilar. Variable (pes 400–800),
// només el joc llatí: hi cap tot el català (à, ç, l·l…).
const ebGaramond = localFont({
  src: './fonts/EBGaramond-latin.woff2',
  weight: '400 800',
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RPG Map Viewer',
  description: 'Dungeon Master map viewer with token management',
};

// Sense això, el mòbil no fa servir l'amplada real de la pantalla: assumeix una
// finestra virtual de ~980px i n'escala el resultat, de manera que la pantalla de
// jugador surt minúscula i mig fora de lloc (semblava que "no carregués").
// `viewportFit: 'cover'` fa servir tota la pantalla en mòbils amb osca.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0d1117',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca" className={ebGaramond.variable}>
      <body>{children}</body>
    </html>
  );
}
