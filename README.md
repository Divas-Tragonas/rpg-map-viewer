# RPG Map Viewer

**[▶ Obrir l'app](https://divas-tragonas.github.io/rpg-map-viewer/rpg-map-viewer.html)**

App HTML autocontinguda per a sessions de rol de taula. Dues finestres: **DM** i **Jugador**, sincronitzades en temps real via BroadcastChannel.

---

## Changelog

### v2.24
- Sistema HP complet per tokens enemics importats des de PSD: barra de vida al sidebar (compacta, inline), barra visual al canvas (DM), editor HP al menú contextual
- Menú Escena (⚡) permet editar el nom del token (PSD i biblioteca); el canvi aplica de forma persistent
- Menú Escena permet inicialitzar HP màxims per tokens PSD sense HP configurat
- Canvis de nom i imatge des d'Escena s'apliquen persistentment a TOTS els tokens enemics (PSD i biblioteca)
- Fix: snap de grid no s'aplica a les zones de visibilitat, només als tokens reals
- Fix: ESC per skipear cinematica DM ara sincronitza la finestra del jugador
- Fix: clic dret a token enemic PSD ja no peta la pàgina (TypeError `startsWith` en ID numèric)

### v2.23
- Imatges reals als tokens de Goblin (4 variants, assignació aleatòria en afegir)
- Token renderitzat com a imatge clipada al cercle; fallback a cercle de color si no hi ha imatge
- Animació de derrota (desaturació) també funciona amb imatges de token
- Sistema `ENEMY_IMAGES` + `getTokenImg` preparat per afegir imatges a la resta d'enemics

### v2.22
- Pestanya "Enemics" al sidebar (al costat de "Mapa" i "Eines")
- Biblioteca d'11 tipus d'enemic: Goblin, Llop, Ós, Zombie, Esquelet, Orc, Troll, Rata, Bandid, Aranya, Drac
- Clic a la biblioteca afegeix l'enemic al centre de la vista; arrossegable al mapa
- Tokens visuals: cercle de color amb inicials, barra de vida visible només al DM
- Funcionalitats: HP +/-10/+/-1 via menú contextual, eliminar de l'escena, condicions, Escena, Derrotado
- Sincronitzat al jugador via BroadcastChannel (sense barra de vida)
- Guardat/carregat a sessions

### v2.21
- Fix definitiu barra de vida en mode jugador: els tokens de jugador es renditen independentment de si hi ha PSD carregat (fix del `if (!s) return` que bloquejava el render)

### v2.20
- Barra de vida dels tokens: alçada proporcional al token en zoom alt (400% = barra gran), text escalat
- Barra de vida visible a la pantalla del jugador (defensiva: `hpMax || 0` en comptes de només `hpMax`)
- Guardar/Cargar sesión v2.2: inclou imatge BG, estructura PSD, capes, dibuixos, posicions i grid complets; la càrrega restaura tot l'estat sense necessitat de reimportar arxius

### v2.19
- Fix Demo: la imatge de fons carrega ara la capa "BG" del PSD (imatge real del mapa), no el composite exportat

### v2.18
- Botó "▶ Demo" a la secció d'importar: carrega automàticament la imatge de fons i el PSD de prova embedits al HTML

### v2.17
- Barra de vida dels tokens jugador més alta, text HP dins la barra; visible també a la pantalla del jugador
- SHIFT + botó mig: pan privat del DM (no sincronitzat al jugador); quan soltes Shift, torna suaument a la posició original

### v2.16
- Fix scroll lateral: punts de color del formulari de jugadors moguts a fila pròpia sota el nom

### v2.15
- Sidebar reorganitzat en dues pestanyes: **Mapa** (capes + jugadors) i **Eines** (dibuix + grid)
- Tot el contingut de cada pestanya és scrollable: ja no es perden opcions amb molts jugadors
- Jugadors en 2 columnes compactes: botó − (+1) i + (+1), clic dret per ±10
- Barra de vida eliminada del sidebar (queda al canvas DM)
- Colors i slider de mida del dibuix fusionats en una sola fila
- Botons d'importar BG i PSD ara ocupen tot l'ample disponible

### v2.14
- Jugadors amb vida: cada jugador té HP actual i HP màxims
- Botó "Carrega Party" al panell DM: crea els 5 jugadors per defecte (noms i HP editables a `DEFAULT_PARTY`)
- Controls HP al sidebar: -10, -1, +1, +10 per a cada jugador, amb barra de vida de colors
- Barra de vida visible al canvas (DM): HP actual/màxim i barra de color sota cada token de jugador
- El formulari d'afegir jugador inclou camp de HP màxims

### v2.13
- Fix Mida jugador: tokenSizeOverride ara s'envia al STRUCT inicial i al handler receptor del jugador

### v2.12
- Fix Mida: la imatge del token ara s'escala correctament (abans només canviava el box blanc del DM)

### v2.11
- Nova opció "Mida" al costat del Snap: ajusta tots els tokens (enemics i jugadors) al 90% de la cel·la del grid
- Els nous tokens de jugador creats amb Mida actiu hereden la mida del grid automàticament
- En re-calibrar el grid amb Mida actiu, es recalcula la mida de tots els tokens
- La mida override es sincronitza al jugador via BroadcastChannel

### v2.10
- Scene Engine: boss reveal cinematogràfic — portrait centrat, títol gran, parallax, impact frame, partícules
- Popup "⚡ Escena" al context menu amb importació d'imatge personalitzada (drag & drop o clic)
- Letterbox, vignette, dim overlay, flash blanc d'impacte + segon flash daurat
- Camera zoom cap al token, suavitzat sense jitter
- ESC per saltar l'escena; sincronització al jugador via BroadcastChannel

### v2.9
- Botons importar imatge i PSD ara side by side i més compactes
- Box d'avisos de capes faltants: es tanca sol als 10s, X centrada
- Expositor sincronitzat al jugador (quan el DM canvia de pestanya, el jugador ho veu)
- Mover zones màgiques: Ctrl+drag amb eina de forma (ja existent, confirmat funcional)
- Stepper de Celda i Línia del grid: salts d'1px i 0.1px, posats un al costat de l'altre
- Token seleccionat: anell blau animat al mapa; clicar token al panell de capes també el selecciona
- Versió visible dins l'app (v2.9); títol de la finestra sense número de versió

### v2.8
- Auto snap de tots els tokens al grid en activar el checkbox Snap
- Auto snap en finalitzar la calibració del grid (si Snap actiu)
- La posició snapped es sincronitza al jugador automàticament

### v2.7
- Versió inicial publicada
