import type { Metadata, Viewport } from 'next';
import './globals.css';

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
    <html lang="ca">
      <body>{children}</body>
    </html>
  );
}
