import type { Metadata } from 'next';
import './globals.css';
import { THEME_CLASS } from '@/theme';
import CRTOverlay from '@/components/CRTOverlay';

export const metadata: Metadata = {
  title: 'RPG Map Viewer',
  description: 'Dungeon Master map viewer with token management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca" className={THEME_CLASS || undefined}>
      <body>
        {children}
        <CRTOverlay />
      </body>
    </html>
  );
}
