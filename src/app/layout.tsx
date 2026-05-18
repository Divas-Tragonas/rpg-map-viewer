import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RPG Map Viewer',
  description: 'Dungeon Master map viewer with token management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca">
      <body>{children}</body>
    </html>
  );
}
