# RPG Map Viewer

Eina per a Dungeon Masters per gestionar mapes, tokens i jugadors en temps real.

**Live:** [https://rpg-map-viewer.vercel.app/](https://rpg-map-viewer.vercel.app/)

---

## Pantalles

| URL | Descripció |
|---|---|
| `/` | Vista del Dungeon Master |
| `/player` | Vista del jugador (pantalla secundària) |
| `/expositor` | Pantalla d'expositor de campanya |

## Dev

```bash
npm install
npm run dev   # http://localhost:3000
```

---

## Changelog

### v3.1
- Afegit enllaç directe a la web al README
- Regla de versionat automàtic al CLAUDE.md

### v3.0
- Migració completa de single-HTML a Next.js 16 + React 19 + TypeScript
- App Router, components separats, hooks, render loop via RAF
- Desplegament a Vercel

### v2.25
- Fix bordes negres en PSD
- Mides per criatura
- Edició nom/HP al click dret

### v2.24
- HP per tokens PSD
- Edició nom/imatge des de l'escena
- Fixes snap/ESC/crash

### v2.23
- Snap de grid no s'aplica a zones

### v2.22 i anteriors
- Vegeu historial de git
