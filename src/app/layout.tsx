import type { Metadata } from 'next';
import { VT323, Pirata_One } from 'next/font/google';
import './globals.css';
import { THEME_CLASS } from '@/theme';
import CRTOverlay from '@/components/CRTOverlay';

// Fonts del redesign (Google Fonts, auto-hostatjades per next/font en
// build): VT323 per a dades/etiquetes, Pirata One només per a capçaleres.
const vt323 = VT323({ weight: '400', subsets: ['latin', 'latin-ext'], variable: '--font-vt323', display: 'swap' });
const pirata = Pirata_One({ weight: '400', subsets: ['latin', 'latin-ext'], variable: '--font-pirata', display: 'swap' });

export const metadata: Metadata = {
  title: 'RPG Map Viewer',
  description: 'Dungeon Master map viewer with token management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca" className={[THEME_CLASS, vt323.variable, pirata.variable].filter(Boolean).join(' ')}>
      <body>
        {children}
        <CRTOverlay />
      </body>
    </html>
  );
}
