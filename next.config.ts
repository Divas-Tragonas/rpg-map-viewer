import type { NextConfig } from 'next';
import { networkInterfaces } from 'node:os';

// Orígens addicionals que poden accedir al dev server (Next 16 bloqueja cross-origin
// per defecte). Sense la IP LAN del PC del DM aquí, la tablet o el mòbil reben l'HTML
// però els recursos de /_next queden bloquejats: la pàgina es queda negra i congelada,
// sense cap error visible.
//
// La IP la posa el router per DHCP i canvia sola (i n'hi pot haver més d'una: wifi +
// cable + WSL). Tenir-ne una d'escrita a mà era una trampa: el dia que canviava, el
// mòbil deixava de carregar sense cap pista. Ara es llegeixen totes les IPv4 de les
// interfícies de la màquina en arrencar el dev server, i s'hi deixen a més els comodins
// dels rangs privats habituals per si s'arriba per una adreça que no és d'aquest PC.
function lanHosts(): string[] {
  const out: string[] = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address);
    }
  }
  return out;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '127.0.0.1',
    'localhost',
    ...lanHosts(),
    // Comodins dels rangs privats. Next compara les adreces per trossos separats per
    // punts, així que el comodí ha de ser un tros sencer (`172.2*.*.*` NO valdria).
    '192.168.*.*',
    '10.*.*.*',
    ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
  ],
};

export default nextConfig;
