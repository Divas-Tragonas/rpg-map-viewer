# Sincronització DM ↔ jugador

> BroadcastChannel, WebSocket, càmera compartida, pantalla de jugador (mòbil i incrustada a la wiki).
> Part de la documentació tècnica: vegeu [docs/README.md](README.md) per a l'índex.

## BroadcastChannel — sincronització DM→Jugador

Canal: `BC_CHANNEL = 'rpg_map_sync_v18'`

| Tipus missatge | Direcció | Contingut |
|---|---|---|
| `STRUCT` | DM→Jugador | Estat complet (connexió inicial). Inclou `strokeHistory` perquè el jugador reconstrueixi el dibuix a ploma (late join / càrrega de partida) |
| `STATE` | DM→Jugador | Delta d'estat (interaccions) |
| `BG` | DM→Jugador | Buffer de la imatge/vídeo de fons |
| `STROKE` | DM→Jugador | Traç de dibuix (reproducció animada) |
| `CLEAR_DRAW` | DM→Jugador | Netejar canvas de dibuix |
| `UNDO_DRAW` | DM→Jugador | Desfer + reaplicar `strokeBaseline` (només quan ha canviat) + historial |
| `POINTER` | DM→Jugador | Posició del cursor DM |
| `MEASURE` | DM→Jugador | Punts A/B de la regla de mesura |
| `SPELL` | DM→Jugador | Inici d'animació de spell |
| `DELETE_SPELL` | DM→Jugador | Eliminar un spell d'àrea actiu |
| `BOSS_INTRO` | DM→Jugador | Cinematica boss reveal. `style` (absent = la de sempre) + `sprite` i `party` per a les de pixel art |
| `BOSS_INTRO_SKIP` | DM→Jugador | Saltar cinematica |
| `EXPOSITOR_SHOW/HIDE/SYNC` | DM→Jugador | Expositor d'imatge/vídeo (veure feature) |
| `TEXTREVEAL_SHOW` | DM→Jugador | Revelador de text: text complet + `pos`, `cps`, `fadeMs` |
| `TEXTREVEAL_SYNC` | DM→Jugador | Front de revelació (`pos`) streamejat a ~30fps |
| `TEXTREVEAL_HIDE` | DM→Jugador | Amagar revelador de text |
| `PLAYER_READY` | Jugador→DM | Sol·licita estat complet |
| `VIEWPORT` | Jugador→DM | Mida del canvas d'aquella pantalla (`{id,w,h}`). El DM en fa la llista del menú de pantalles de la barra superior |
| `TOKEN_MOVE` | Jugador→DM | Token mogut des de la pantalla de jugador (BC i WS). Només tokens de jugador (`pl_*`): el DM descarta la resta |
| `TOKEN_RELAY` | DM→Jugador | Relay d'un token mogut (id+x+y) a la resta de pantalles de jugador. El jugador el **fusiona** dins `rPos` sense reemplaçar l'estat ni tocar la càmera |
| `STATE.appStyle` / `STATE.tileLive` | DM→Jugador | App Píxel (camps dins del `STATE`, no missatges propis: la API els reenvia opacs). `appStyle` lleuger, `tileLive` pesat. Els sprites NO viatgen: cada pantalla els carrega de `public/sprites/` |
| `STATE.figureGrade` / `STRUCT.figureGrade` | DM→Jugador | Ajust de color de les figuretes del mapa (`FigureGrade`, lleuger, sempre; `null` = cap). Veure «Missions» |
| `STATE.phosphor` / `STRUCT.phosphor` | DM→Jugador | Mode Fòsfor (boolean, lleuger, sempre): la pantalla de jugador es veu com una TV de tub antiga. Veure «Mode Fòsfor» |
| `STATE.curtain` / `STRUCT.curtain` | DM→Jugador | Fos a negre del canvi d'escena (`SceneCurtain`, lleuger, sempre; `null` = cap). Veure «Llocs de les missions» |
| `STATE.dialog` / `STRUCT.dialog` | DM→Jugador | Diàleg en curs (`DialogSync`, camp lleuger, sempre; `null` = cap). Veure «Diàlegs de personatges» |
| `STATE.sheet` / `STRUCT.sheet` | DM→Jugador | Fitxa d'un personatge a les pantalles (`SheetShow`, camp **pesat**: només quan canvia; `null` = amagada). Veure «Fitxes de personatge i experiència» |
| `RESET_EXPLORED` | DM→Jugador | Reset de la memòria d'explorat d'una sala (torna a ser negra del tot). Porta el polígon `points`; DM i jugador criden `clearExploredAt(points)` a `darkrooms.ts` |

Tots els tipus estan definits a `BCMessage` a `src/types/index.ts`.

**Dieta del `STATE`** (`_broadcastState` a `useDMActions.ts`): els camps pesats (`players`, `conditions`, `defeated`, `paintedZones`, `tokenSizeOverride`, `libEnemies`, `rooms`, `walls`, `doors`, `lights` — poden portar imatges base64) només s'inclouen al missatge quan la seva **referència** ha canviat des de l'últim enviament (`lastSentHeavyRef`). Per això és crític que tota mutació d'aquests valors creï un objecte/array **nou** (mai mutar in place) i que el jugador els tracti com a camps opcionals. Els broadcasts de pan/zoom (compartit i privat) i l'animació de retorn de vista privada van throttled a ~20Hz amb enviament final garantit — el jugador suavitza amb LERP, així que es veu fluid igualment. El mateix per a la **màgia que s'està apuntant** (`spellPreview`, camp lleuger, veure «Previsualització de les màgies als jugadors»).

**Quan s'afegeix un nou estat sincronitzat**, actualitzar en 3 llocs:
1. `BCStateMessage` o `BCStructMessage` a `types/index.ts`
2. `_broadcastState` a `useDMActions.ts` → missatge `STATE` (si és un camp pesat, afegir-lo a `heavy` i a `_syncHeavySent`)
3. `_sendFullState` → missatge `STRUCT` + handler al jugador

## WebSocket — sincronització multi-dispositiu (tablet per wifi)

Cada missatge BC té un mirall WS (`src/lib/ws.ts` → endpoint `/sync?role=dm|client`
de la API, port 3000; protocol documentat a `api-spec.txt`). **Tot `postMessage` nou
al BC ha d'anar acompanyat del seu `wsRef.current?.send(JSON.stringify(...))`.** Els
binaris (fons, expositor) van com a frame `*_META` JSON + frame binari.

- **URL del WS en runtime** (`resolveApiBase` a `ws.ts`): si `NEXT_PUBLIC_API_URL` no
  està definida (o apunta a localhost i la pàgina s'ha carregat des d'un altre host),
  el WS es connecta al host de `window.location` amb port 3000. Així la tablet que obre
  `http://[IP-PC]:3001/player` troba la API sense configuració.
- **`onOpen`** (3r paràmetre de `createSyncSocket`): s'executa a cada connexió i
  reconnexió. El jugador hi envia `PLAYER_READY` (mai enviar-lo just després de crear
  el socket: encara està CONNECTING i es descarta). El DM hi fa `_sendFullState()` per
  refrescar el `STRUCT` en caché del servidor (late join).
- **`allowedDevOrigins` a `next.config.ts`**: Next 16 bloqueja recursos cross-origin
  del dev server; si l'origen no hi és, el dispositiu rep l'HTML però no els `/_next/*`
  i **no hidrata** (pàgina negra congelada, sense errors visibles). Ja **no s'escriu cap
  IP a mà**: es llegeixen les IPv4 de les interfícies de la màquina (`os.networkInterfaces`)
  i s'hi afegeixen els comodins dels rangs privats. ⚠️ Next compara els orígens **per
  trossos separats per punts**, així que un comodí ha de ser un tros sencer
  (`192.168.*.*` sí, `172.2*.*.*` no).

## Càmera compartida — independent de la mida i el format de finestra (`src/lib/camera.ts`)
- **Problema que resol**: la càmera es sincronitzava com `{ zoom, panOffset }` amb `panOffset` en **píxels de pantalla del DM**, i cada pantalla hi aplicava després la seva pròpia escala d'ajust `min(W/mw, H/mh)`. Amb finestres de mida o format diferents, el mateix `panOffset` desplaçava una quantitat de mapa diferent i el rectangle visible depenia del format: en fer zoom, **cada pantalla retallava per un costat diferent**. El DM tenia contingut a la vora de la seva pantalla i els jugadors no el veien, sense cap indici.
- **Model**: el que viatja és `cam: CamRect { cx, cy, w, h }` — el **rectangle de MAPA** que enquadra el DM. Camp lleuger de `STATE`/`STRUCT` (4 números, s'envia sempre). `zoom`/`panOffset` es continuen enviant **només per compatibilitat amb clients antics**.
- **DM** (`useRafLoop` escriu `rDmCam` cada frame; `_currentCam()` a `useDMActions` el recalcula **al moment d'enviar**): `viewRect()` a partir de `rZoom`/`rPanOffset` — **mai** de `dmLocalZoom`/`dmLocalPan` (vista privada) ni de la càmera de la cinemàtica, que són locals. Després `clampCamToMap()`: no es demana a les altres pantalles que reservin espai per als marges buits del DM (amb formats molt diferents això empetitia molt el mapa a l'altra banda); la **mida** del rectangle es conserva i només es desplaça cap endins, així que tot el contingut de mapa que veu el DM hi continua sent.
  - ⚠️ **No llegir `rDmCam` directament dins del missatge**: el tick l'escriu un cop per frame i les interaccions (roda, pan) broadcastegen **síncronament dins del seu handler**, o sigui que s'enviaria l'enquadrament del frame ANTERIOR. Com que després d'una roda de zoom no arriba cap més missatge, el jugador es quedava un pas de zoom enrere per sempre (~12% d'enquadrament). Sempre `_currentCam()`.
- **Jugador** (`PlayerView`): desa `cam` a `rCam` i **cada frame** el tradueix al seu `{zoom, pan}` amb `camToView()` (regla **contain**: `sc = min(W/cam.w, H/cam.h)`), escrivint-lo a `rZoom`/`rPanOffset` perquè la resta del codi (LERP i hit-test del drag de tokens) el llegeixi com sempre. Com que es recalcula cada frame amb la mida REAL d'ara, **girar la tablet o canviar de mida reenquadra tot sol** sense esperar cap missatge. Si el DM és antic i no envia `cam`, es cau al model vell.
- **Garantia**: amb la regla contain, **cap pantalla no veu mai menys que el DM**; una de format diferent veu **més** mapa als costats. Verificat sobre 1210 combinacions de mapa/finestra/zoom/pan.
- **El DM redimensiona**: el tick detecta el canvi de `W×H` i rebroadcasteja (throttle 120ms amb reintent: si es descarta l'enviament, `prevWH` NO s'actualitza i el frame següent hi torna, així la mida final sempre arriba).
- **Menú de pantalles (`TopBar` → `ScreensMenu`)**: sense cap pantalla diu «**Cap pantalla de jugador**» en color d'avís. En clicar-lo obre un panell amb les pantalles, un botó per obrir-ne una en aquest PC i **l'adreça per a la tablet** (botó de copiar): si el DM ha obert l'app per `localhost`, s'hi proposen les IPs LAN del PC, que `next.config.ts` exposa com a `process.env.LAN_HOSTS` (no s'usen si el DM és en un altre host, p. ex. un desplegament).  les pantalles de jugador reporten la seva mida amb `VIEWPORT {id,w,h}` (en connectar, en redimensionar i cada 15s de heartbeat); el DM les desa a `rPlayerScreens` i oblida les que fa >50s que no diuen res. Entre finestres del mateix PC va pel BroadcastChannel; les de fora (tablet per wifi) pel relay `VIEWPORT` client→dm de la API. El contracte del WS es pot comprovar amb `node scripts/check-sync.mjs`. El botó mostra quantes n'hi ha i, al menú, quant de mapa veu **de més** cadascuna (`extraSeen`). El format de l'enquadrament es mostreja cada 700ms a l'estat `camAr` — **no llegir `rDmCam` durant el render** (és una ref que escriu el tick; el menú no es refrescaria).

## La pantalla de jugador al mòbil
- **`meta viewport`** (`export const viewport` a `src/app/layout.tsx`): sense això el mòbil assumeix una finestra virtual de ~980 px i escala el resultat — la pantalla de jugador sortia minúscula i mal enquadrada, i semblava que no carregués. `viewportFit: 'cover'` per als mòbils amb osca.
- **Alçada `100dvh`** (classe `.full-stage` a `globals.css`, usada per l'arrel de `PlayerView`): `100vh` al mòbil val l'alçada AMB la barra del navegador desplegada i tallava el rètol de torn. Es declara `100vh` i tot seguit `100dvh` perquè un navegador antic es quedi amb el primer.
- **`BroadcastChannel` amb guarda** (`try/catch` a l'efecte de `PlayerView`): no existeix a iOS Safari < 15.4 i, sense protecció, l'excepció tombava l'arbre de React (pantalla en negre). Al mòbil no cal: la sincronització hi va per WebSocket. ⚠️ Per això el handler dels missatges viu a **`bcHandlerRef`** i el WS l'hi crida directament — abans el WS despatxava via `bcRef.current.onmessage`, o sigui que sense BroadcastChannel no hauria processat res.
- **Diagnòstic a la pantalla d'espera** (`ConnDiag` a `PlayerView`; `SyncState`/`syncUrl`/`syncBlockedByMixedContent`/`hasSyncKey`/`probeApiReachable` a `lib/ws.ts`): sota "Esperant al Dungeon Master..." es diu l'estat del WS i **a quina adreça truca**. La URL es calcula dins del callback d'estat del socket, ja al client (depèn de `window.location`: calculada al render, el servidor en donaria una altra i hi hauria error d'hidratació).
- **Les tres avaries que des de fora es veuen igual** (i com se separen):
  1. **Contingut mixt** — pàgina per `https` (Vercel) i API per `http`: el navegador bloqueja el WebSocket. Es detecta abans de connectar (`syncBlockedByMixedContent`).
  2. **Clau rebutjada** — la API amb `SYNC_KEY` tanca amb **codi `4401`** (`api-spec.txt`); el frontend l'ha d'enviar des de `NEXT_PUBLIC_SYNC_KEY`. El codi arriba a `SyncState.code` des de l'`onclose`. ⚠️ `hasSyncKey()` diu **només si n'hi ha**, mai el valor.
  3. **Host inabastable vs WebSocket bloquejat** — les dues donen codi `1006`. Es distingeixen amb `probeApiReachable()` (petició `no-cors` a `/enemies` quan el socket es tanca, una sola vegada): si el host respon per HTTP, el problema és el WebSocket, no la xarxa.
- Els consells del rètol depenen de si la API és a la LAN o a un host públic (`isLanHost`): parlar de "la mateixa wifi" i del "port 3000" no ajuda gens quan la API va per Tailscale Funnel.

## Mode Fòsfor — TV de tub antiga a la pantalla de jugador (`src/lib/phosphor/screen.ts`, v4.92)
- **Què és**: un aspecte de monitor de tub per a les pantalles de jugador (referència: una foto d'un joc de masmorres de 8 bits en un monitor CRT). Interruptor «Mode Fòsfor» al menú **Pantalles** de la barra superior (`ScreensMenu` a `TopBar`). Estat `phosphor` a `DMView` (`useStoredFlag('rpg_phosphor')`: el navegador del DM el recorda; **no** es desa a la partida), ref `R.rPhosphor`, camp lleuger `phosphor` del `STATE` i del `STRUCT`. El DM no el veu.
- **Com es pinta** (`PhosphorScreen`, WebGL 1): després de pintar l'escena de sempre (`phosphorPass` al tick de `PlayerView`, que crida `frame()` i després el pas del fòsfor). Passada 1: compon el fons (`<img>`/`<video>`, textura pujada un sol cop per imatge i cada fotograma si és vídeo; posició llegida del seu `style`) amb el canvas del mapa, fa la mitjana amb els 4 veïns (treu el soroll de les textures) i converteix cada píxel en el **color més proper** de `PHOSPHOR_PALETTE` (**DawnBringer 32**), mesurat en OKLab (`hexToOklab`; la paleta es passa a OKLab a la CPU i el shader porta un `if` desplegat per color). Passada 2: corbatura, línies d'escombrat (`scanlinePx`), halo, punts RGB i parpelleig.
  - ⚠️ **A la resolució real**: l'usuari no vol que es redueixin els píxels (la primera versió ho feia a ~240 línies i es va treure).
  - ⚠️ **Criteri de la paleta: només proximitat** (v4.93). La v4.92 classificava per famílies (neutres foscos → blau, mitjans → verd, clars → taronja…) i l'usuari ho va rebutjar: «tot verd, taronja i blau, sense criteri». Una paleta nova: canviar `PHOSPHOR_PALETTE` (una paleta coherent, amb rampes de tots els tons), mai afegir-hi regles per tons.
  - ⚠️ **Cap comentari dins del GLSL**: només hi pot anar ASCII (els comentaris en català, fora de la cadena).
  - ⚠️ **El temps no entra al shader** (`mediump` no hi té prou precisió): el parpelleig es calcula a la CPU (`flick`).
- **Capes**: el llenç del fòsfor és a `zIndex 2` (damunt del fons i del canvas del mapa, `pointer-events: none`: el drag dels tokens continua anant al canvas de sota) i per sota de rètols (20), fitxes (21), cortina (49), Expositor (50) i diàlegs (56). El vidre de CSS (`.phosphor-glass` a `globals.css`, `zIndex 70`) posa línies fines, cantonades arrodonides i vinyeta damunt de TOT; és estàtic (res d'animar filtres).
- **Animació d'apagar i encendre** (`_setPhosphor`): tot el contingut de la pantalla és dins del «tub» (`tubeRef`), que s'aplana amb la Web Animations API (`transform` només) i un flaix blanc (`flashRef`, `opacity`). El mode canvia a mig camí; si el DM el torna a tocar durant l'animació, en acabar se'n fa una altra. `prefers-reduced-motion`: canvi directe.
- **Pla B**: sense WebGL o amb un fons d'un altre origen (no es pot pujar a la GPU) el llenç s'amaga i es veu l'escena normal amb el vidre a sobre.
- Limitació coneguda: els noms dels tokens també passen per la paleta i, amb colors de jugador semblants al del text, es llegeixen pitjor.

## Pantalla de jugador dins de la wiki (`/player?embed=1`)
- **Per a què**: el tauler de missions de la wiki (`divas-tragonas/wiki`, `src/missions/pixel.js`) té un botó del mode DM, «Mapa en píxel», que transforma el mapa pintat de Cony Cirera en el d'aquesta app amb una onada de caselles i hi posa a sobre aquesta pantalla de jugador en directe (iframe). El DM fa servir el visor en una altra finestra, com sempre, i és qui obre el tauler.
- **Sincronització sense API** (`src/lib/relay.ts`, v4.57): dins d'un iframe d'un altre lloc el `BroadcastChannel` queda aïllat (el navegador el particiona per lloc) i l'usuari no vol dependre de la API. Per això el DM obre el tauler des del menú **Pantalles → «Obrir el tauler de missions»** (`openBoard`, `BOARD_URL`; `NEXT_PUBLIC_BOARD_URL` el canvia per provar-ho en local) i els missatges van de finestra a finestra amb `postMessage`: DM ⇄ tauler (`window.opener`) ⇄ iframe. `relayBoards` (DM) fa que tot el que s'envia pel canal vagi també als taulers i que el que en ve entri pel mateix handler; només accepta l'origen del tauler. `relayToParent` (pantalla incrustada) fa el mateix cap a la pàgina que la conté (i fa de canal si el navegador no en té). Sobre: `{ rpg: 'bc', msg }`; salutació `{ rpg: 'bc-hello' }` → el DM contesta amb `base` (on és el visor, amb la carpeta), d'on el tauler treu l'adreça de l'iframe i del mapa en píxel. Si hi ha API, el WebSocket també hi és i els duplicats es descarten com sempre.
- ⚠️ El pont **pedaça `postMessage` del canal** (DM i pantalla) en lloc de tocar les ~40 crides: un missatge nou al canal arriba sol als taulers. Ha de ser clonable (`structuredClone`), com ja ho exigeix el `BroadcastChannel`.
- **Protocol amb la wiki** (`postMessage`, només entre la pantalla i la pàgina que la conté; res va al DM ni a la API):
  - wiki → pantalla: `{ rpg: 'embed', fit: boolean }`. `fit` = el mapa sencer (zoom 1, sense pan), tal com és la imatge de l'onada; `false` = la càmera del DM. El canvi llisca lent (`embedRef.glide`, LERP 0,04 al tick). `?fit=1` comença amb `fit` encès.
  - pantalla → wiki: `{ rpg: 'player', ready, conn }` cada cop que canvia si ja té mapa (`playerReady`) o l'estat del WebSocket.
- L'encaix de l'onada depèn que el mapa de la missió i el de la wiki tinguin la mateixa proporció (1728×1200 i 4950×3431). Si es torna a generar el mapa amb una altra mida, cal canviar `pixel` de Cony Cirera a `packages/model/src/towns.ts` de la wiki (mida i caselles). Si el tauler es publica en un altre domini (la wiki també es pot desplegar a Vercel), cal canviar `BOARD_URL`.
