# Errors comuns a evitar

> Taula de trampes ja trobades i com evitar-les.
> Part de la documentació tècnica: vegeu [docs/README.md](README.md) per a l'índex.

| Error | Símptoma | Fix |
|---|---|---|
| Ref no a `fc` | Render phase rep `undefined` | Afegir a `FrameContext` (types.ts) i a l'objecte `fc` de `useRafLoop.ts` |
| `setState` sense ref mirall | UI actualitzada, render no | Actualitzar sempre `setState` + `rX.current` |
| Nou estat no afegit a STRUCT | Jugador no rep l'estat en connectar | Afegir a `BCStructMessage`, `_sendFullState` i al seu handler |
| `'use client'` oblidat | Error de hidratació | Tots els components amb hooks o events necessiten `'use client'` |
| Codi nou que depèn de la mida del mapa | El render o el jugador no pinten res mentre no hi ha mapa | La porta és `R.rMapSize` (DM) / `rMapSize` (jugador): `null` = encara no hi ha mapa |
| Sincronitzar càmera en píxels de pantalla | Els jugadors veuen un tros de mapa diferent del DM segons la mida/format de finestra | Enviar `cam` (coords de mapa) i traduir-lo a cada pantalla amb `camToView` |
| Llegir `rDmCam` dins del missatge en lloc de `_currentCam()` | El jugador es queda un pas de zoom/pan enrere | El ref l'escriu el tick un cop per frame; els handlers d'interacció envien abans del frame següent |
| Processar dos cops un missatge jugador→DM | Efectes que es "desfan" sols i **només amb la API engegada** (p. ex. l'animació de moviment que es talla) | Tot missatge del jugador viatja per BC **i** WS: al mateix ordinador arriba duplicat. Fer els handlers idempotents (descartar l'eco: l'estat ja hi és) |
| Isotip d'estat pintat amb evenodd damunt d'una barra de "prohibit" | Escaquer allà on la barra creua un forat de la silueta | Fer la barra amb dues parts `bg` + tinta (veure `deafened` a `conditions/icons.ts`) |
| Finestreta d'ajuda pròpia per a un text curt d'un botó | Ocupa espai, tapa altres controls i obliga el contenidor a `overflow: visible` | Usar l'atribut `title` natiu (com `PlayersPanel`, `TopBar` i `CanvasHUD`) |
| Escoltador de teclat global sense guarda d'escriptura | Escriure una majúscula o fer Ctrl+A en un camp dispara una drecera (commuta la vista privada/compartida) | Passar sempre per `isTyping(e)` a `useKeyboardHandlers` (input, textarea **i** `contentEditable`) |
| Estat de token no purgat en eliminar-lo | Xip fantasma «?» a la barra d'iniciativa, resplendor del torn pintat enlloc | Afegir-lo a `_cleanupTokenKey` (`useDMActions.ts`), que ja neteja condicions, derrotat, mida, selecció, grups i torn |
| Regla de moviment duplicada en lloc de compartida | El jugador veu un rang groc que el DM li rebutja (o al revés) | Passar sempre per `movementLimit` (`lib/rules/conditions.ts`), com `buildMovePath` per al camí |
| Estat de combat passat sencer a React al jugador | `PlayerView` es re-renderitza ~20 cops/s (el `turn` va dins de cada STATE) | Projectar-lo amb `buildTurnBanner` + `sameBanner` i retornar `prev` quan no canvia |
| Component definit dins d'un altre component | El hover es queda enganxat / l'estat intern es perd a cada render | Declarar-lo a nivell de mòdul (veure `ToolButton` a `FloatingToolbar`) |
| Mode nou només al teclat | L'usuari no sap que existeix | Una sola funció `toggle*` a `DMView`, compartida pel botó de `FloatingToolbar` i per `useKeyboardHandlers` |
| Gestor nou al canvas del DM amb `onMouse*` o un gest que només sap fer el ratolí | Al mòbil no fa res (el dit no té clic dret ni roda) | El canvas va amb pointer events via `useCanvasPointer`; el que necessiti clic dret o roda ha de tenir també el seu gest (mantenir premut, pinça) |
| Commutar un mode en el keydown d'un modificador (Ctrl, Maj…) | Ctrl+Z o Maj+clic encenen el mode sense voler | Només amb un toc net (keydown+keyup sense res pel mig), com fa `useKeyboardHandlers` |
| ✕ per a una acció que no és tancar/eliminar | L'usuari el prem per tancar i fa una altra cosa (p. ex. marcar derrotat) | ✕ només tanca o elimina; la resta, botó amb nom (`💀 Derrotar`) |
| Ull amb un significat diferent segons la llista | Es revela o s'amaga el contrari del que es volia | L'ull sempre vol dir «ho veuen els jugadors?» |
| Contingut variable dins d'una barra flotant (nom del token, confirmació que substitueix un botó) | La barra canvia de mida i es mou a cada interacció | Mides fixes per al que depèn de l'estat i confirmacions en un globus a sobre (veure `TurnTracker`) |
| Emoji com a icona d'un botó o d'una capçalera (🖼 sense el selector `U+FE0F`) | A Windows surt com un glif monocrom negre i no es veu sobre el fons fosc | Icona vectorial d'`icons.tsx` amb color de la paleta (veure «Sistema visual») |
| Daurat (`C.accent`) per a una dada, una etiqueta o un avís | El daurat deixa de dir «això és el principal / està actiu» i tot competeix | Daurat només per a `primary` i actiu; dades en `C.bright`/`C.text`, avisos amb un punt |
| `fontFamily: "'EB Garamond', …"` escrit a mà | Surt Georgia (la font no es troba: `next/font` li canvia el nom) | `FONT_SERIF` (`constants`) |
| Finestreta de la barra d'eines amb un paràgraf | Tapa el mapa i ningú la llegeix | Una línia a `ToolDef.desc`; el detall a `ShortcutsHelp` |
| Animar l'amplada de diversos elements esperant que la suma es mantingui | Si les transicions es tallen (clics ràpids), la suma deixa de quadrar i el contenidor canvia de mida | Contenidor d'amplada fixa i repartir l'espai amb `flex-grow` animat (veure `TurnTracker`) |
| Mida de lletra, radi o color escrits a mà | La UI torna a perdre la coherència (22 mides, colors repetits) | `FS`, `RADIUS`, `C`, `tint()` i `Button` |
| Menú de selecció nou fet a mà (anells, botons rodons…) | Cada menú de l'eina Màgies es veia i es feia servir diferent | Fer servir `RadialMenu` |
| Animar `text-shadow`, `filter` o `box-shadow` amb desenfocs grossos | Els fps cauen a la meitat mentre dura l'animació | Pintar l'efecte un cop en una capa pròpia i animar-ne només `opacity`/`transform` (veure el nom de la cinemàtica de boss) |
| Llegir `localStorage` a l'inicialitzador d'un `useState` | Error d'hidratació (el servidor no en té i pinta un altre estat) | `useSyncExternalStore` amb snapshot de servidor `null` (veure `useEnemyGrouping`) |
| Llista del lateral amb `overflowY: 'auto'` a pèl | Torna a sortir la barra nativa, una franja fixa que no lliga amb la resta | Embolcallar-la amb `ScrollArea` (o `SidebarSection` amb `maxBodyHeight`) |
| Pila de desfer nova que no passa per `logUndo` | El «Desfer» se la salta o desfà les coses en un altre ordre | `logUndo` a cada `push` i entrar-la a `peekDmUndo`/`undoLast` (veure «Desfer únic») |
| Mateixa acció en dos llocs (un botó al lateral i un xip a dalt…) | L'usuari no sap quin és el bo i la UI s'omple | Un sol lloc per acció; si cal una drecera, que cridi la mateixa funció (veure `TopBar`) |
| Camp numèric que aplica el valor a cada tecla | Esborrar el número per escriure'n un altre deixa el token a 0 (i s'envia un `STATE` per tecla) | Aplicar en confirmar (Enter o perdre el focus), com `NumField` a `TokenFields` |
| Dades d'un token repartides (un camp al panell, un altre al menú…) | L'usuari no sap on es canvia cada cosa | Tot el que és d'un token, al menú del clic dret (`TokenFields`) |
| Tancar un menú amb un camp a mig editar sense treure'n el focus | El valor escrit es perd (el camp es desmunta sense rebre el `blur`) | `blurActive()` abans de tancar, com `ContextMenuOverlay` |
| Efecte d'un hook amb `[R]` (refs del DM) com a dependència | Es torna a executar a cada render: el que crea (p. ex. el host del diàleg) es destrueix i no es veu res | `R` és un objecte nou a cada render: dependències `[]` i llegir els refs per un `useRef(R)` (veure `useDialog`) |
| Text de joc pintat amb una tipografia que no és la del paquet a l'app Píxel | No lliga amb la resta de la pixel art | `pfDraw`/`pfDrawChar` (`lib/sprites/font.ts`) a escala entera, i `drawWindow` per a les finestres |
| Carregar un fitxer de `public/` amb un camí absolut escrit a mà (`/sprites/…`) | Es trenca si l'app es publica dins d'una subcarpeta | Prefixar amb `NEXT_PUBLIC_BASE_PATH` (veure `SPRITES_URL` a `lib/sprites/pack.ts`) |
| Pintar sprites amb el suavitzat encès | Pixel art borrós | `blit()` (apaga `imageSmoothingEnabled`) i `image-rendering: pixelated` al DOM |
| Rebre un `SPELL` dues vegades (BC i WS) | La màgia es pinta doble a la pantalla de jugador (només amb la API engegada) | El handler del jugador descarta un `SPELL` amb un `id` que ja té |
| Animar al `tileLive` una casella amb coses a sobre | L'aigua animada tapa la vora, la paret o l'objecte | `tileLiveOf` només anima les caselles d'aigua lliures |
| Llegir refs dins del render d'un menú | Valors que no es refresquen i error de lint `react-hooks/refs` | Passar l'estat per props (com `ContextMenuOverlay`: `libEnemies`, `players`) |
| Camí que pot fallar resolt amb `console.error` tot sol | L'usuari veu «no passa res» i torna a clicar | Passar per `notify` (veure «Avisos a la pantalla») |
| Element de mèdia sense listener d'`error` | «Mapa carregat» amb la pantalla negra i cap pista | Parella obligatòria: `load`/`loadedmetadata` **i** `error`, revertint l'estat a l'error |
| `createObjectURL` sense el seu `revokeObjectURL` | Cada canvi de mapa o d'imatge deixa el fitxer sencer a memòria | Desar l'URL en un ref i revocar-lo en substituir-lo (`bgUrlRef`, `customUrlRef`) |
| Nom d'un token pintat amb `fillText` dins de la seva família, en px de pantalla fixos | A la TV no es llegeix, i a la pantalla de jugador s'encavalca amb els altres o la figureta de sota el tapa | `nameTag` (`render/tokens.ts`): al DM el pinta on toca i a la pantalla de jugador el col·loca `renderNameTags` |
| Escriure a la fitxa amb `api.characters.*` des del DM en lloc de `useCharacters` | Sense connexió el canvi es perd (no va a la cua ni a la còpia local) | Passar sempre per `award`/`awardBatch`/`update` del hook |
| Experiència sumada a la fitxa sense `awardId` | Un reintent (xarxa lenta, doble clic) la compta dues vegades | Passar sempre un `awardId` a `award`/`awardBatch` (veure «Fitxes de personatge i experiència») |
| Estat que viatja a cada `STRUCT` i creix sense límit | Late join, desfer i desat automàtic es degraden a la vegada | Posar-hi sostre i rasteritzar el que en surt (veure «Límit de l'historial de dibuix») |
| Dades de la història (mòduls, diari) dins de la partida (`_buildSessionCore`) | Es perden en carregar una partida, i viatgen a cada desat/STRUCT | Magatzem a part (`createJsonStore`, localStorage), DM-only: veure `historia-i-moduls.md` |
| Llegir `localStorage` d'un magatzem a l'inicialitzador d'un `useState` o al render | Error d'hidratació | `useJsonStore` (`useSyncExternalStore` amb el valor inicial al servidor) |
| Anotar al diari des d'un handler amb codi propi en lloc de `logJournal` | Entrades duplicades o que fallen amb el magatzem; el diari trenca el joc si llança | `logJournal(kind, text)` (no llança i desduplica); els esdeveniments sense punt únic, a `useJournalWatchers` |
| Panell flotant nou a la dreta amb `zIndex` ≥ 12 | Tapa la barra de torns i els seus globus («Finalitzar el combat?»); el combat no es pot acabar | `zIndex` 11 i deixar l'espai de la barra amb combat (veure `StoryPanel`) |
| Hit-test de tokens escrit a mà (un bucle per família) | El clic agafa un token que és sota un altre, o no troba el cap d'una figureta | `tokenAt` (`render/token-geom.ts`): mateix ordre que el render, base abans que figura i amb el ventall dels apilats |
| Offset o radi d'un jugador canviat sense moure la cantonada | El token surt del centre de la casella | Els jugadors es desen per la cantonada (centre = `pos + R`): compensar −ΔR com `setTokenSize`/`sizeAllTokens` |
| LERP o animació de la posició d'un jugador sense tenir en compte el radi | En canviar-li la mida, el token salta i torna lliscant (pantalla de jugador) | La posició és la cantonada: moure també la cantonada visual −ΔR (`_lastR` a `renderPlayerTokens`) |
| Destí d'una màgia nova calculat a mà amb el cursor | Clicant al cap de la figureta, l'impacte cau fora del token; la previsualització i el clic no coincideixen | `spellAimPoint` (`lib/spellcast.ts`), el fan servir `aimSpell` i el clic |
| Efecte «sobre el token» posat al centre de la casella o amb un desplaçament escrit a mà | Amb figureta, la creu queda a les cames i l'exclamació tapa el cap | Fer servir la geometria de `render/token-geom.ts`: `figureMid`, `figureBox`, `footOf` o `FIG_*_DY` (en caselles) |
| Halo als peus fet escalant l'el·lipse de l'ombra | A dalt i a baix s'encavalca amb l'ombra i els altres halos; als costats se separa | `ringPath` amb una distància a la base (`footEllipse`: eixamplar els dos eixos igual) i el carril de `haloSlots` |
| Tecla global que escriu al camp que acaba d'enfocar | La «n» de la drecera apareix dins el camp de nota | `preventDefault` al keydown i enfocar amb un petit retard (`JournalView`) |
| Comentari en català (o qualsevol caràcter no ASCII) dins d'un shader GLSL | El shader no compila en alguns navegadors i el mode Fòsfor no surt | Comentaris fora de la cadena del shader (veure `lib/phosphor/screen.ts`) |
| Peça nova de la Forja escrita només a `kit-art.json` sense mirar-la, o canvi de composició només a `kit.ts` | Casc desplaçat, fila d'una amplada diferent (tot es desquadra), o la previsualització no diu la veritat | `python3 scripts/forja-preview.py` (valida amplades) i mantenir `kit.ts` i el script iguals |
| Ampliar una animació de pixel art fins a l'àrea de reglament (bola de foc, núvol, tro) | Píxels de 7 px de pantalla, molt més gruixuts que les figuretes: sembla un altre joc | Escala de píxel de la figureta (`casella / 40` × `k`) i les àrees amb una gran al mig + còpies repartides (`scatter`), veure «Màgies en píxel» |
| Editar `public/sprites/fx_anims.png` o `fxanims.ts` a mà | Es perd en tornar a generar l'atles | `scripts/fx-atlas.py` (`ANIMS`) i tornar-lo a executar |
| Ampliar pixel art borrós (una captura escalada amb suavitzat) amb un altre escalat | Encara més borrós | Recuperar-ne la resolució original (centre de cada píxel d'art, veure `scripts/icons-extract.py`) i ampliar sense suavitzar a múltiples enters |
| Tornar a pintar badges o qualsevol cosa dels estats sobre el cap del token | Tapa les animacions dels estats (estrelles, verí, cors) | L'estat es veu a l'anell dels peus i a l'animació (`statusfx.ts`); el cap és per a les animacions |
