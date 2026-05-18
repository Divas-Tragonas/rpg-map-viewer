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

### v3.5
- **Cursor vareta màgica**: l'eina Màgies/Spells utilitza un cursor de vareta daurada en pixel art en lloc del crosshair genèric.
- **Colors paleta més saturats**: els colors de llapis i tokens de jugador s'han actualitzat amb més saturació i brillantor per a millor visibilitat.
- **Selecció de zona màgica persistent**: en fer clic dret sobre una zona, s'activa un contorn de ratlles blanques animat que es manté fins a seleccionar una altra zona o desseleccionar; la selecció ja no desapareix en moure el ratolí.
- **Zoom fins al 500%**: augmentat el límit màxim de zoom de 400% a 500% (slider, scroll i botons).
- **Fix salt de càmera en escenes**: en acabar una escena cinematica (boss intro), la càmera ja no salta a la posició anterior; es sincronitzen `rZoom` i `rPanOffset` amb la posició final de la càmera cinematica per evitar el salt.

### v3.4
- **Expositor: auto-enviar nova imatge**: arrossegar una nova imatge al panell de l'expositor l'envia automàticament al jugador si l'expositor ja estava actiu.
- **Expositor: panell més gran i amb zoom/pan**: el panell flota a 480px d'ample amb previsualització de 260px; scroll per fer zoom, arrossegar per fer pan; tot es sincronitza a la pantalla del jugador en temps real.
- **Expositor: animació Ken Burns**: animació subtil automàtica (zoom, pan dreta/esquerra/amunt) amb cicles de 38s; s'aplica al DM i al jugador via EXPOSITOR_SYNC a 30fps.
- **Expositor: barra espaiadora**: prem espai per pausar/reprendre KB i retornar a la posició neutra.
- **Expositor: transicions suaus**: fade-out de 0.3s + fade-in de 1.4s en canviar d'imatge o activar/desactivar l'expositor.
- **Expositor: indicador actiu**: el botó de l'expositor mostra ◉ quan la pantalla del jugador l'està mostrant.
- **Zones màgiques (jugador): vores en degradat**: les zones no tenen cap borda dur; s'aplica una màscara blurred via `destination-in` per un degradat alfa natural als marges.
- **Cursor especial eina Màgies**: el cursor canvia a `crosshair` quan l'eina de zones màgiques (shape) està activa.

### v3.3
- **Fix lag càmera jugador**: la pantalla del jugador ara segueix la càmera del DM quasi instantàniament (LERP 0.35 + snap); eliminats els micro-ajustos de ~1 segon.
- **Fix cursor llapis/goma durant el pan**: el cercle de cursor ja no es queda estàtic quan es mou la càmera arrossegant.
- **Tecla SHIFT per vista privada DM**: SHIFT+arrossegar (o SHIFT+scroll) mou/zooma la vista del DM sense afectar el jugador; en soltar SHIFT torna suaument a la posició compartida.
- **Guia visual zones màgiques**: al DM, l'eina Màgies ara ressalta la zona activa en vermell/color de l'element quan passes per sobre (CTRL), i amb glow complet quan l'arrossegues. Cursor `grab`/`grabbing` com els tokens.
- **Fade-in i vores difuminades zones màgiques**: al jugador, les zones noves apareixen amb un fade-in de 0.75s; les vores de les zones presenten un difuminat interior (vinyeta) per integrar-se millor amb el fons.

### v3.2
- **Fix càmera escena**: la boss intro sobre tokens de biblioteca ja no desplaça la càmera a (0,0); ara apunta a la posició real del token al mapa.
- **Expositor integrat**: el botó "Expositor" obre un panell flotant al DM en lloc d'una finestra nova. El jugador rep el contingut via BroadcastChannel amb fade IN/OUT suau, zoom i pan.
- **Línies guia de spells en groc**: les línies de previsualització de l'eina Màgies ara són grogues per coherència amb la paleta del HUD.
- **Fix cursor Senyal permanent**: el cursor del DM ja s'esborra correctament en desactivar l'eina "Senyal".
- **HP tokens PSD a la barra lateral**: els enemies PSD amb HP assignat mostren barra de vida i botons +/− al LayerTree; quan cauen derrotats el nom apareix ratllat.
- **Cursor de llapis i goma al canvas**: el cercle de previsualització del tamany del pinzell/goma es dibuixa directament al canvas com a cursor, proporcional a la mida real.
- **Versió v3.2 a la pantalla de benvinguda**: el número de versió és ara més gran i en blanc.
- **README millorat**: descripcions del changelog més clares i concretes.

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
