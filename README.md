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

### v3.2
- **Fix càmera escena**: quan s'activava una escena (boss intro) sobre un token de biblioteca amb imatge, la càmera anava a la cantonada superior esquerra perquè la posició era sempre (0,0). Ara s'usa la posició real del token al mapa.
- **Expositor integrat**: el botó "Expositor" ja no obre una finestra nova del navegador. Ara mostra un panell flotant dins la vista del DM on es pot carregar una imatge o vídeo i enviar-la als jugadors. La finestra del jugador rep el contingut via BroadcastChannel i el mostra amb transició fade IN/OUT suau, zoom amb roda del ratolí i pan amb drag.
- **Línies guia de spells en groc**: les línies de previsualització dels spells (eina de Màgies) ara són grogues en lloc de liles/morades, per coherència amb la paleta de colors del HUD.
- **Fix cursor Senyal permanent**: al desactivar l'eina "Senyal" des del panell, el cursor del DM es quedava visible indefinidament. Ara s'esborra correctament en canviar d'eina.
- **HP tokens PSD a la barra lateral**: els tokens enemics importats del PSD ara mostren una barra de vida mini sota el seu nom al LayerTree del DM, quan se'ls ha assignat HP al menú contextual.
- **Previsualització de llapis i goma**: el panell de dibuix mostra un cercle de previsualització del tamany actual del llapis o la goma, que s'actualitza en temps real en moure el slider.
- **Versió actualitzada a v3.2** al fons de presentació de la pantalla de benvinguda (text més gran i en blanc).
- **README millorat**: les descripcions del changelog ara expliquen el "perquè" del canvi, no només el "que".

### v3.1
- Afegit l'URL de desplegament al README per accés directe des de qualsevol dispositiu.
- Definida la regla de versionat obligatori al CLAUDE.md per garantir que cada canvi quedi registrat.

### v3.0
- Migració completa de l'aplicació monolítica en HTML/JS a un projecte Next.js 16 amb App Router, React 19 i TypeScript, separant cada funcionalitat en components, hooks i mòduls de render independents.
- Implementat el render loop via requestAnimationFrame (RAF) per garantir animacions a 60fps sense bloquejar la UI.
- Desplegament continu a Vercel configurat.

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
