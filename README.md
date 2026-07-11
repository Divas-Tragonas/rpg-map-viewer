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
| `/admin` | Back office (gestió d'enemics, mapes, zones) |

## Dev

```bash
npm install
npm run dev   # http://localhost:3001
```

## Multi-dispositiu (PC + tablet a la mateixa wifi)

Setup típic: el PC del DM amb dos monitors (vista DM + vista jugadors) i una tablet
dels jugadors, tots a la mateixa xarxa wifi. La sincronització entre finestres del
mateix PC va per `BroadcastChannel`; cap a la tablet va per WebSocket a través de la
API (`divas_tragonas_api`, endpoint `/sync` al port 3000).

1. **Al PC del DM**: arrencar la API (port 3000) i l'app (`npm run dev`, port 3001).
2. **Trobar la IP LAN del PC** (`ipconfig` a Windows / `ip addr` a Linux), p. ex. `192.168.68.102`.
3. **Verificar `next.config.ts`**: la IP del PC ha de ser a `allowedDevOrigins`
   (Next 16 bloqueja l'accés cross-origin al dev server si no hi és — la tablet
   carregaria una pàgina en blanc). Si la IP canvia (DHCP), actualitzar-la aquí.
4. **Monitors del PC**: `http://localhost:3001/` (DM) i `http://localhost:3001/player` (jugadors).
5. **Tablet**: obrir `http://[IP-del-PC]:3001/player` al navegador.

La tablet dedueix automàticament l'adreça del WebSocket a partir de la URL amb què
ha carregat la pàgina — no cal configurar `NEXT_PUBLIC_API_URL` per a l'ús en LAN.
Si la connexió cau (wifi inestable), el client es reconnecta sol cada 2 s i demana
l'estat complet al DM en tornar.

---

## Changelog

### v3.92
- **Millores al sistema per torns.** La barra és més gran i llegible. En finalitzar el combat demana **confirmació** (evita clics accidentals). L'aro daurat de torn actiu ara **només** surt als tokens de jugador (els enemics ja no es ressalten en or). Nou **clic dret sobre un token anterior** de la barra → "↩ Recuperar el seu torn" (torna a aquell token amb els peus que li quedaven). **Ctrl+Z** desfà l'últim moviment del torn i retorna els peus gastats — encaminat per eina: amb l'eina de **selecció** funciona el Ctrl+Z de combat; amb una eina de dibuix (pinzell/goma) funciona el de traços. Nou botó **⚙** a la barra que obre un **mode edició** on s'arrosseguen els tokens per canviar l'ordre de torn.

### v3.91
- **Sistema per torns (iniciativa).** Nova barra inferior al canvas del DM: s'activa el combat, s'hi afegeixen automàticament tots els jugadors i es trien quins enemics o grups incloure. Els tokens es mostren en fila per ordre de torn; el que té el torn actiu porta un **aro daurat sòlid** (al mapa i a la barra). Durant el seu torn, des de `/player` el jugador només pot moure el token actiu i fins que gasti els seus peus (p. ex. amb 15 ft: mou 5 → li queden 10); el disc de moviment s'encongeix a cada pas i el DM valida el saldo (rebot si se supera). Clicar el token actiu de la barra passa el torn al següent; en tancar la volta comença una ronda nova i tots recuperen moviment. Botó **⏭ Ronda** per forçar ronda nova. El DM no té cap límit de moviment. L'estat viatja al jugador dins `STATE`/`STRUCT` i persisteix a la sessió.

### v3.90
- **Àrea de moviment de tokens de jugador com un cercle real.** En comptes del rombe (que es veia estrany), el límit de moviment ara usa distància euclidiana (`dc² + dr² ≤ (maxCells + 0.5)²`) → un **disc rasteritzat** idèntic a les taules de cercles pixel-art. La diagonal costa el seu valor real (~7 ft = √2·5). El clamp del drag camina la casella cap endins fins entrar al disc conservant la direcció, i el ressaltat groc pinta el cercle amb perímetre esglaonat.

### v3.88
- **Àrea de moviment de tokens de jugador coherent (rombe).** El límit de moviment ara tracta la diagonal com a 10 ft (variant D&D), de manera que la regió abastable és un rombe (distància de Manhattan) en comptes d'un quadrat que arribava massa lluny en diagonal. El clamp del drag projecta el punter sobre la vora del rombe conservant la direcció, i el ressaltat groc dibuixa el rombe amb perímetre esglaonat.

### v3.87
- **Fix sincronització de tokens entre pantalles de jugador per WebSocket (iPad/cross-device).** El relay `TOKEN_RELAY` que propaga el moviment d'un token de jugador a la resta de pantalles ara està documentat al contracte (`api-spec.txt`) com a missatge dm→client: el servidor de la API l'ha de reenviar als clients igual que `STATE`. Fins ara només funcionava al mateix ordinador (BroadcastChannel); les pantalles connectades per WebSocket (iPad, teles) no es refrescaven perquè el servidor no reenviava aquest tipus.

### v3.86
- **Fix: bugs de rendering a la pantalla de jugador (sincronització robusta).**
  - Els spells d'àrea (dormir/grasa) ara desapareixen del jugador quan el DM els esborra encara que el `DELETE_SPELL` puntual es perdi: `activeSpells` es reconcilia al `STATE`/`STRUCT` (font de veritat del DM). També fa que un jugador que es connecta tard vegi els spells d'àrea ja actius.
  - La regla de mesura (distàncies) ja no queda encallada al jugador si es perd el `MEASURE` de neteja: `measure` es reconcilia a cada `STATE`.
  - En generar una nova pantalla de jugador, la resta de pantalles ja no parpellegen ni perden els tokens: el handler de `STRUCT` és ara idempotent (no reconstrueix imatges ni reinicia el suavitzat quan el mapa no ha canviat) i té guarda de reentrada (dos `STRUCT` concurrents ja no es trepitgen).

### v3.85
- **Fix definitiu del relay de moviment de tokens** (reset de zoom + enemics que desapareixien). Ara el DM reenvia un missatge dedicat `TOKEN_RELAY` amb només el token mogut, i la pantalla de jugador el **fusiona** dins les seves posicions sense reemplaçar la resta de l'estat ni tocar la càmera. Així la tele rep el moviment en temps real sense perdre enemics/sales ni resetejar el zoom.

### v3.84
- **Fix: el relay del moviment de tokens ja no fa desaparèixer enemics ni sales.** El relay de v3.83 enviava un STATE només amb `pos`, cosa que deixava fora la resta de l'estat. Ara el DM reenvia l'estat complet però amb l'opció `omitCamera` (sense `zoom`/`panOffset`), així la tele rep el moviment i tot l'estat en temps real però manté la seva pròpia vista.

### v3.83
- **Fix: el relay del moviment de tokens ja no reseteja el zoom** de la resta de pantalles de jugador. Ara el DM reenvia només la posició dels tokens (no un STATE complet amb zoom/pan), així la tele rep el moviment en temps real però manté la seva vista.

### v3.82
- **Fix: el moviment d'un token des d'una tablet s'actualitza en temps real a la resta de pantalles de jugador** (p. ex. una tele). Quan el DM rep un `TOKEN_MOVE` d'un jugador, ara reenvia l'estat (`_broadcastState`) perquè els altres clients rebin la nova posició a l'instant, sense necessitat de fer refresh de la pantalla del DM.

### v3.81
- **Tret el botó d'esborrar totes les parets** (era massa perillós). Les parets/sales es gestionen amb `Backspace` (desfà l'última), `Esc` (cancel·la la cadena en curs) i "Eliminar sala" al menú contextual de cada sala.

### v3.80
- **Fog of war real**: qualsevol token, dibuix o spell dins d'una sala fosca no revelada queda amagat als jugadors (la foscor es pinta damunt de tot al jugador).
- **Snap a línies**: en dibuixar parets, el cursor s'enganxa també a les arestes de parets existents (no només als vèrtexs), així les sales contigües queden connectades i "sobre rails".
- **Fi de geometria net**: en tancar-se una geometria s'acaba la cadena automàticament (cal tornar a clicar per començar-ne una altra; abans encadenava sol).
- **Esc cancel·la la cadena** de parets a mig fer (elimina totes les línies no completades); Backspace segueix desfent només l'última.
- **Costura de sales sense forats**: les sales contigües se solapen uns píxels perquè no es vegi cap fil del mapa a la paret compartida.
- **Menú de sala en viu**: en marcar una sala com a fosca amb el clic dret, la finestra flotant s'actualitza a l'instant (abans calia des-seleccionar i tornar-hi).
- **Amagar una sala revelada** requereix ara tenir el mode **Shift** actiu (evita re-enfosquir-la sense voler); revelar-la és lliure.
- Eliminats el doble-clic i el mode orto amb Shift de l'eina (redundants amb el nou flux).

### v3.79
- **Nova eina "Parets" (🧱, drecera `5`)**: es dibuixen parets clicant successivament (estil regla de mesura, amb línia elàstica i distància en peus). En tancar una geometria, el sistema detecta automàticament la sala tancada (detecció de cares en un graf planar: fusiona vèrtexs propers, parteix als encreuaments i a les unions en T). Cada cara nova tancada crea una sala automàticament; una paret que divideix una sala existent la parteix en dues.
- **Sales fosques amb ull (com Photoshop)**: clic dret sobre una sala → marcar-la com a *fosca*. Les sales fosques neixen amagades (interior negre opac al jugador) i el DM les revela/amaga amb l'ull (clic sobre la sala en mode selecció, o des del menú contextual). El revelat s'anima suaument al jugador. Reanomenar i eliminar sala també des del menú contextual.
- **Mecàniques bàsiques de dibuix**: tancament magnètic sobre vèrtexs existents, snap a la graella (si està actiu), mode orto amb Shift (0°/45°/90°), `Backspace` desfà l'última paret, `Esc` / doble-clic aixequen la ploma per començar una cadena nova.
- Parets i sales es sincronitzen al jugador (nou camp `rooms` a `STATE`/`STRUCT`) i es desen a la sessió. Les parets són una eina del DM (no es mostren al jugador); només viatja la foscor de les sales.

### v3.78
- **Fix: la targeta de jugador ja no canvia de mida** en aparèixer la confirmació d'esborrat (la capçalera té una alçada mínima estable).
- **Fix: bloquejar el moviment d'un jugador s'aplica a l'instant a la pantalla de jugador.** El bloqueig del drag ja funcionava en obrir un token nou, però ara, com a xarxa de seguretat, si arriba un `TOKEN_MOVE` d'un token bloquejat (p. ex. una pantalla de jugador que encara no hagués rebut el bloqueig), el DM reenvia la posició autoritzada i el token torna al seu lloc immediatament, sense necessitat de cap clic al DM.

### v3.77
- **Confirmació abans d'eliminar un jugador**: la ✕ de cada targeta ja no esborra directament; ara demana confirmació inline (Eliminar? Sí / No) per evitar pèrdues accidentals a mitja sessió.
- **El nom del jugador ja es pot editar bé un cop creat**: abans el camp rebutjava qualsevol valor buit intermedi (i retallava els espais), de manera que no es podien escriure noms amb espais ni esborrar l'últim caràcter per reescriure'l. Ara el camp admet qualsevol edició i, si es deixa buit, torna a "Jugador" en perdre el focus.

### v3.76
- **Redisseny del panell de jugadors (sidebar del DM)**: les targetes ocupen ara tota l'amplada del panell i s'apilen una sota l'altra (abans anaven a dues columnes i la segona quedava tallada).
- Vida molt més llegible (número gran) i botons −/+ més grans (32px, amb clic dret ±10 com abans).
- Nou botó d'engranatge a cada targeta que desplega una secció de configuració enganxada a sota (animació suau que desplaça la resta de targetes): vida actual, vida màxima, velocitat de moviment i interruptor per activar/desactivar el moviment des de la pantalla de jugador.
- **Nou camp `canMove` per jugador**: quan el DM el desactiva, el token no es pot arrossegar des de `/player` (el hit-test l'ignora i el DM descarta qualsevol `TOKEN_MOVE` seu per BC i WS). Es mostra un cadenat 🔒 a la targeta. El DM el pot moure sempre.

### v3.75
- **Fix indicador de punter/regla de mesura invisible a la tablet (Safari)**: en clicar amb l'eina "Senyal", ara el click mateix col·loca i emet l'indicador de punter (abans només ho feia el `mousemove`, que en pantalles tàctils no arriba de manera fiable abans del tap).
- El primer punt de la regla de mesura es dibuixa encara que no hi hagi posició de cursor viva: un click sempre deixa una marca visible al DM i al jugador.
- El punter i la regla de mesura viatgen ara dins del `STRUCT`: una reconnexió del WebSocket (Safari en tablet suspèn el socket en bloquejar la pantalla o canviar d'app) ja no els perd.

### v3.74
- **Fix: el revelador de text no es veia a Safari en tablet.**
- El DM ara reenvia `TEXTREVEAL_SHOW` quan rep `PLAYER_READY` (i en reconnectar el seu propi socket): iOS Safari talla el WebSocket en bloquejar la pantalla o canviar d'app, i la tablet es quedava rebent només `TEXTREVEAL_SYNC` sense el text — no es veia mai res. Ara, en reconnectar, recupera el revelador al punt on és.
- El jugador tracta el `TEXTREVEAL_SHOW` repetit (mateix text ja visible) com una resincronització: no reconstrueix els spans ni refà el crossfade.
- Eliminat el `will-change: opacity, filter` per caràcter del `RevealEngine`: amb un span per caràcter, iOS Safari promovia milers de capes compositades i en superar el límit de memòria deixava de pintar el text (pantalla en blanc). L'esvaïment es veu igual: només els caràcters actius porten `filter` transitòriament.

### v3.73
- **Fix: la pantalla del jugador es "refrescava" cada pocs segons i el fons quedava desajustat.** Cada reconnexió del WebSocket feia que el DM reenviés l'estat complet (i al mateix ordinador el fons arribava duplicat per BroadcastChannel i WS); el jugador destruïa i recreava l'`<img>` de fons a cada enviament, provocant un flaix visible. Ara el jugador descarta els fons idèntics al que ja mostra (firma per mida + hash) i només recarrega quan el fons canvia de veritat.
- **Fix del desajust del fons**: quan es recreava l'element de fons amb la mateixa geometria de vista, el `tick()` no li reaplicava mai la mida ni la posició (la caché `prevBgStyle` no canviava) i el fons quedava a dalt a l'esquerra a mida natural. Ara es detecta l'element nou i es reposiciona sempre (jugador i DM).
- Els object URLs antics del fons ara es revoquen en substituir-lo (evita una fuga de memòria a sessions llargues).

### v3.72
- **Fix crític: sincronització trencada al deploy de producció.** `src/lib/ws.ts` mai enviava el paràmetre `?key=` a la connexió WebSocket; des que el servidor `divas_tragonas_api` exigeix `SYNC_KEY` per a l'exposició pública (Tailscale Funnel), totes les connexions de DM i jugador eren rebutjades en silenci amb codi `4401` — per això la pantalla de jugador mai carregava el mapa entre dos dispositius diferents.
- Nova variable d'entorn `NEXT_PUBLIC_SYNC_KEY`: cal configurar-la a Vercel amb el mateix valor que el `SYNC_KEY` del servidor de la API i redesplegar.
- `api-spec.txt` actualitzat amb la secció d'autenticació del WebSocket (`&key=...`, codi `4401`).

### v3.71
- **Sincronització multi-dispositiu (tablet per wifi) arreglada**: la URL del WebSocket ara es dedueix en runtime del host amb què s'ha carregat la pàgina — abans la tablet intentava connectar a `localhost` (ella mateixa) i no rebia mai res si no es recompilava amb `NEXT_PUBLIC_API_URL` apuntant a la IP del PC.
- **`PLAYER_READY` fiable**: s'envia quan el socket està realment obert (abans s'enviava mentre encara connectava i es descartava en silenci) i es reenvia a cada reconnexió, així la tablet recupera l'estat complet si cau la wifi.
- El DM reenvia l'estat complet en (re)connectar el seu socket, perquè el servidor tingui sempre l'últim `STRUCT` en caché per als clients que arribin més tard.
- `allowedDevOrigins` amplia amb `127.0.0.1` i nova secció "Multi-dispositiu" al README amb el pas a pas del setup PC + tablet.

### v3.70
- **Velocitat de moviment en peus als tokens de jugador** (`speed`, per defecte 30 ft): nou camp editable al panell de Jugadors del DM (🏃 peus, amb equivalència en caselles).
- **Límit de moviment a la pantalla de jugador**: en arrossegar el seu token (tàctil o ratolí), el jugador només pot moure'l fins a la distància en peus del token (1 casella = 5 peus, distància Chebyshev: la diagonal compta 1 casella). El token queda clampat dins del rang.
- **Caselles disponibles marcades en groc suau** durant el drag, amb el perímetre del rang ressaltat.
- El DM no té cap limitació: mou els tokens la distància que calgui, com sempre.

### v3.69
- **La pantalla de jugador només permet moure tokens de jugador**: els enemics (PSD i biblioteca) ja no es poden arrossegar des de `/player`. El DM també ignora qualsevol `TOKEN_MOVE` que no sigui d'un token `pl_*`.
- **Moviment tàctil a mòbil/tablet**: el drag de tokens passa a pointer events amb captura de punter (funciona amb dit, stylus i ratolí), tolerància de toc més gran per al dit i el token arrossegat segueix el dit sense retard de LERP.
- El drag ja no es perd si arriba un `STATE` del DM a mig moviment (la posició local del token arrossegat es conserva).

### v3.68
- **Les màgies de projectil/con es rendereixen per sobre dels tokens**: bola de foc, llamp, raig màgic, míssil màgic, riallada i mans ardents ja no queden tapades pels tokens (nou passi `air` després de les fases de tokens, al DM i al jugador). Les màgies d'àrea (dormir, greix) es queden a terra, sota els tokens, com a efectes de sòl.
- **Redisseny del greix**: contingut dins del radi real de l'àrea (abans esquitxava molt més enllà de l'oval), color de moc verd viscós en lloc de greix fosc de cotxe, vora que ondula lentament, brillantors humides i gotes petites a la vora.

### v3.67
- **Redisseny complet de les animacions de màgies** (`src/lib/render/spells.ts`): blending additiu, gradients radials i partícules deterministes (seed per llançament) a tots els efectes.
  - **Bola de foc**: cometa amb cua de flames i fum + explosió multi-fase (flaix, bola de foc turbulenta, ona expansiva, brases voladores i fum) escalada al grid (~2,6 caselles de radi).
  - **Llamp**: geometria fractal nova a cada re-strike (~110ms) amb branques secundàries, glow blau-blanc de 3 capes i espurnes a l'impacte.
  - **Raig màgic**: amplada pulsant, polsos d'energia recorrent el feix, espurnes en espiral i glow de càrrega a l'origen.
  - **Míssil màgic**: ara són 3 projectils escalonats amb trajectòries corbes i impactes independents (com el conjur de D&D).
  - **Riallada horrible**: raig rosa ondulant i esclat amb crits "HA!" flotants.
  - **Mans ardents**: con sense vores dures (falques niuades) ple de llengües de flama que avancen amb flicker, nucli blanc a les mans i fum.
  - **Son**: cúpula de boira onírica amb volves orbitants, estrelles que parpellegen i "Z" tipogràfiques que s'eleven.
  - **Greix**: bassal fosc translúcid de contorn irregular amb reflexos iridescents en moviment, brillantors i esquitxos.
- **Textures de zones màgiques millorades** (gel i elèctric, les més fluixes):
  - **Gel**: blau glacial profund amb facetes cristal·lines (Worley), fractures brillants entre cristalls, vetes fines i espurneig fred.
  - **Elèctric**: base fosca de tempesta amb filaments d'arc fins blau-blanc que s'arrosseguen i parpellegen, i flaixos que il·luminen tota la zona.

### v3.66
- **Grid integrat a la barra flotant**: la configuració del grid (activar/calibrar cel·la, snap, mida automàtica de tokens, gruix de línia) passa de la pestanya lateral "Eines" a un botó nou dins la barra d'eines flotant. Clicar-lo obre un flyout amb tots els controls, seguint el mateix disseny que la resta d'eines. La pestanya "Eines" de la finestra lateral desapareix (només quedaven aquests controls).

### v3.65
- **Fix pinzell/goma a prop de la barra flotant**: el contenidor de la barra d'eines flotant capturava els clics i traços del canvas a tota la seva caixa invisible (columna + separació + espai buit sobre el flyout) a la cantonada inferior esquerra. Dibuixar a prop tallava el traç i el reprenia amb una línia recta en sortir de la zona. Ara el contenidor té `pointer-events: none` i només els dos panells visibles reben clics.

### v3.64
- **Dieta del missatge `STATE`**: els camps pesats (jugadors, condicions, zones màgiques, enemics de biblioteca i overrides amb imatges base64) només s'envien quan realment han canviat, en lloc de viatjar sencers a cada interacció. Els broadcasts de pan compartit, zoom de roda i l'animació de retorn de la vista privada ara van limitats a ~20Hz amb enviament final garantit (el jugador ja suavitza amb LERP, així que es veu igual de fluid). Elimina el lag en pan/zoom amb la pantalla de jugador connectada.
- **Broadcasts que faltaven**: eliminar un jugador, eliminar una capa del PSD, reposicionar un token al seu origen, esborrar un spell d'àrea (WS) i la neteja de punter/regla en desactivar l'eina (WS) ara sí que arriben a la pantalla de jugador.
- **Enemics derrotats (vista jugador)**: el retrat desaturat es cacheja per token; abans es creava un `<canvas>` nou i es redibuixava a cada frame per sempre.
- **Crossfade de l'expositor arreglat**: encadenar dues imatges seguides ara fa el fosa encadenat correctament (el handler llegia un estat congelat i saltava el fade).
- **Moviment de tokens des de la pantalla de jugador**: `TOKEN_MOVE` ara també s'envia per BroadcastChannel, així el drag del jugador arriba al DM en el setup de dues finestres al mateix ordinador (sense servidor WS). Base per a la futura pantalla tàctil.
- **Grid snap en grups**: en arrossegar una selecció múltiple amb snap actiu, tots els membres del grup snapen a la graella (abans només l'àncora i la resta quedava desalineada).
- **Neteja d'estat orfe**: eliminar un jugador o un enemic de biblioteca també neteja les seves condicions, estat de derrota i mida de token (abans quedaven per sempre a cada broadcast).
- Micro-optimitzacions del render: cache del `getBoundingClientRect` als handlers de ratolí i cerca de tint de condicions sense al·locacions per frame.

### v3.63
- **Grid de referència mentre mesures**: en activar l'eina de senyalar (4), la pantalla del DM mostra el grid encara que no estigui activat per als jugadors ("Activar" al panell Grid) — desapareix en tornar a l'eina "cap".
- **Repensades les mesures dels hechizos** (les anteriors no es llegien bé):
  - Eliminades totes les etiquetes numèriques de peus dels hechizos (animació de cast i placement d'àrea).
  - Ara, mentre es dibuixa un hechizo (recta o traç lliure), es mostra en viu la distància més curta (diagonal, inici→fi), no la longitud del traç.
  - Un traç lliure que es talla a si mateix es detecta automàticament com a hechizo d'àrea (dormir/greix) — es tanca com un cercle en el moment de creuar-se, sense necessitat d'Alt+click.

### v3.62
- **Eines flotants tipus Photoshop**: la barra de dibuix (Ploma, Goma, Màgies, Senyal, Desfer, Esborrar) surt de la finestra lateral i passa a ser una columna de botons flotants a baix a l'esquerra del canvas, apilats un sobre l'altre.
- La paleta de color i la mida del pinzell (Ploma/Goma) i l'ajuda de la regla (Senyal) apareixen en un flyout contextual al costat de la barra quan l'eina corresponent està activa.

### v3.61
- **Sistema de mesura en peus**: 1 casella de grid = 5 peus (conversió compartida amb l'AoE dels hechizos d'àrea).
  - **Regla de mesura** (eina 4/"Senyal"): clica per marcar l'inici, torna a clicar per fixar el final (es veu DM i jugadors), un tercer clic l'elimina i reinicia el cicle. ESC la cancel·la a mig fer.
  - **Mida de tokens en peus**: el menú contextual (right-click) d'enemics PSD, biblioteca i jugadors ara permet fixar el diàmetre en peus; es converteix a mida en píxels segons el grid actual.
  - **Distància dels hechizos**: totes les animacions de màgia (fireball, llamp, rajos, projectil màgic, riure, mans ardents...) mostren ara la distància recorreguda en peus, igual que ja feien les zones d'àrea (dormir/greix).

### v3.60
- **Freqüència de textura de zones màgiques adaptativa a la mida**: la reducció a 8 Hz de la v3.59 s'aplicava per igual a totes les zones, així que les petites (mai van ser el problema) es notaven amb l'animació més lenta/entretallada que abans. Ara cada zona calcula la seva pròpia freqüència segons quants texels té: zones petites (fins ~120px) mantenen els 20 Hz originals (animació fluida sense canvis), i només les zones que arriben al límit de resolució (grans) baixen gradualment fins als 8 Hz.

### v3.59
- **Optimització textura de zones màgiques al jugador (fps baixos amb zones grans/apilades)**: la màscara borrosa (filtre `blur` a 4× resolució) es recalculava sencera a cada regeneració de textura (~20/s per zona) tot i que només depèn de la forma de la zona, no del temps — ara es cacheja per zona i només es torna a fer quan la zona canvia de veritat. La resolució de la textura de soroll es limita més (era el coll d'ampolla real: desenes de ms per zona gran) i la freqüència de regeneració baixa de 20 a 8 Hz; a més cada zona regenera en un instant lleugerament diferent (esbiaix per zona) perquè zones apilades no facin tot el treball al mateix frame.
- **1 zona gran**: sense caiguda de fps perceptible. **3 zones grans totalment apilades** (cas extrem): de ~8 fps abans d'aquest canvi a ~23 fps; queda pendent moure el càlcul de soroll a un Web Worker si encara es nota lag amb molts overlaps simultanis.

### v3.58
- **Optimització zones màgiques (lag amb zones grans)**: les zones dibuixades a mà lliure generaven centenars/milers de punts en àrees grans, i cada punt es recorria cada frame (DM), a cada regeneració de textura (jugador) i a cada moviment de ratolí (hover/drag). Ara els punts es simplifiquen (Ramer-Douglas-Peucker) en crear la zona, amb un límit dur de 200 punts; el contorn de la zona al DM es cacheja com a `Path2D` per no reconstruir-lo cada frame; i la captura de punts en viu durant el dibuix ja no copia l'array sencer a cada moviment de ratolí (era O(n²) en zones grans).

### v3.57
- **Grups de tokens**: selecciona diversos tokens (PSD, biblioteca i/o jugadors barrejats) i fes right-click → "Crear grup" per agrupar-los. Doble click a qualsevol membre selecciona tot el grup a l'instant. Right-click sobre un grup complet mostra "Dissoldre grup"; sobre un sol token d'un grup, "Sortir del grup" (si només en queda 1, es dissol automàticament). Un token només pot pertànyer a un grup alhora. Estat 100% local del DM (no persisteix a reload, no es sincronitza al jugador).

### v3.56
- **Selecció per àrea additiva**: cada rectangle que dibuixes amb el mode `A` ara s'acumula a la selecció existent en comptes de substituir-la. Per netejar la selecció, prem `ESC`.

### v3.55
- **Selecció per àrea (marquee)**: prem `A` per activar un mode de selecció estil Age of Empires / cursor de Windows. Arrossega un rectangle sobre el mapa per seleccionar *només tokens* (enemics PSD, enemics de biblioteca i jugadors) que quedin dins. Prem `A` o `ESC` per sortir. Indicador "▣ SELECCIÓ" a la barra superior i cursor en creu.
- **Zoom ampliat fins al 1000%**: el zoom compartit (roda del ratolí i control inferior) ara arriba fins a ×10 en comptes de ×5.

### v3.54
- **Revelador de text**: nova eina d'escena. Botó "Text" a dalt a l'esquerra del visualitzador que obre una finestra flotant gran amb editor, controls (velocitat, suavitat, pauses dramàtiques, mode manual frase a frase) i previsualització.
- El DM controla la revelació; el jugador rep el text a pantalla completa amb tipografia gran (serif) i el mateix esvaïment suau, sincronitzat via `TEXTREVEAL_SHOW/SYNC/HIDE` (BroadcastChannel + WebSocket).
- Sinergia amb l'expositor: mostrar text amaga la imatge i viceversa, amb crossfade suau; "Ocultar" retorna al mapa amb fade. Funciona sobre qualsevol escena (mapa, imatge o res).
- Dreceres de teclat al panell: Espai (revela/pausa), ←/→ (navega/avança), R (reinicia).

### v3.53
- Fix: l'avís "Sin carpeta EXTRAS" (i altres warnings de PSD) ara es tanca automàticament als 10s d'aparèixer.

### v3.52
- Permet editar el nom dels jugadors un cop creats (camp editable al panell de jugadors)

### v3.51
- Fix selecció múltiple: clicar un token ja seleccionat dins un grup el treu de la selecció (clic sense arrossegar = toggle; arrossegar manté el grup).

### v3.50
- Selecció múltiple de tokens: clics consecutius (sense modificadors) afegeixen tokens a la selecció.
- Arrossegar qualsevol token seleccionat mou tot el grup mantenint els offsets relatius.
- Accions de grup des del menú contextual: alternar condició, marcar derrotats, netejar condicions, treure de la selecció.
- Anell de selecció blau polsant per a tokens enemics, de biblioteca i jugadors en multi-selecció.

### v3.49
- Animació de mort (X creuada + desaturació) ara també pels tokens de jugadors, no només pels enemics.
- `adjustPlayerHp` marca `rDefeated` automàticament quan l'HP arriba a 0.

### v3.48
- WebSocket sync (`/sync?role=dm|client`) per sincronitzar DM i clients iPad en xarxa local.
- `usePlayerTokenDrag`: hook per arrossegar tokens al PlayerView (ratolí + tactil).
- Tots els missatges BC duplicats per WS: STATE, STRUCT, BG (binary), STROKE, SPELL, BOSS_INTRO, EXPOSITOR, POINTER.
- Protocol binari de dos frames per imatges/vídeo (JSON metadata + ArrayBuffer).
- `gridSnap` propagat a BCStateMessage i BCStructMessage per a l'iPad.
- `src/lib/ws.ts`: SyncSocket amb reconnexió automàtica.
- API: nou mòdul `sync` (sync.service.ts + sync.routes.ts) amb late-join caching.

### v3.47
- Panell de jugadors: la vida màxima de cada personatge ara és editable directament (input al costat de l'HP).

### v3.46
- Fix: les sessions guardades abans del renom zona→sala (`zonasLayers`/`enemyZones`) ara es carreguen correctament (migració automàtica a `roomLayers`/`enemyRooms`).

### v3.45
- Recuperats els botons "Guardar"/"Cargar" partida (JSON) a `BottomControls`, al costat del Back Office.

### v3.44
- Fix: eliminar un spell d'àrea (sleep/grease) ara desapareix també a la vista del jugador (nou missatge BC `DELETE_SPELL`).

### v3.43
- CLAUDE.md: workflow obligatori per canvis cross-repo (frontend + API).

### v3.42
- Back office: pujada d'imatge per a enemics amb prévia i botó per treure-la (substitueix el camp base64).

### v3.41
- Vista DM: secció «Base de dades» al panell d'enemics mostra els enemics de la BD i permet afegir-los a l'escena.

### v3.40
- Fix: login ara redirigeix correctament al back office sense recarregar (window.location en lloc de router.push).

### v3.39
- Auth crida l'API directament des del navegador (elimina proxy Next.js `/api/admin/auth`).

### v3.38
- Dev server canviat al port 3001.

### v3.37
- **Back office** a `/admin`: gestió d'enemics via API externa amb CRUD complet.
- **Auth middleware**: protecció per contrasenya simple (`ADMIN_PASSWORD` env var, per defecte `admin`).
- **API client** (`src/lib/api.ts`): connector a `NEXT_PUBLIC_API_URL` per operacions CRUD.
- **Fitxer `.env.local.example`** amb totes les variables d'entorn necessàries.

### v3.36
- **Nova lògica de zones**: clic en zona visible = sempre l'amaga; SHIFT mode actiu + clic en zona oculta = la revela. Sense SHIFT actiu no es poden revelar zones des del canvas.
- **Eliminat roomsLocked**: tota la mecànica de bloqueig/desbloqueig de zones eliminada. El mode SHIFT ara fa de "mode edició de zones" complet (pan privat + revelar zones).
- **Neteja**: eliminats `ctrlHeld`, `ctrlHeldRef`, `rRoomsLocked`, botó lock CanvasHUD, `setRoomsLocked` de totes les interfícies.

### v3.35
- **CTRL mode restaura zoom**: en desactivar el mode CTRL, ara es restaura tant la posició com el zoom a l'estat anterior a l'activació.

### v3.34
- **Zoom respecta modes CTRL/SHIFT**: scroll del middle button fa zoom compartit per defecte (o amb CTRL actiu); amb SHIFT actiu fa zoom privat DM (jugador no veu el canvi).

### v3.33
- **Pan sempre amb middle button**: eliminat tot el paneo amb clic esquerre. Middle button = pan compartit (DM+Jugador) per defecte; amb mode SHIFT actiu = pan privat DM. CTRL/SHIFT segueixen sent toggles visuals amb badge.

### v3.32
- **Reescriptura SHIFT pan**: eliminada tota la lògica antiga del SHIFT. El nou SHIFT funciona igual que CTRL: tap per activar mode pan privat DM (badge "SHIFT"), drag per moure la càmera privada, tap per desactivar i retornar la càmera. Eliminada badge "Vista DM" antiga.

### v3.31
- **Fix doble badge SHIFT**: la badge "Vista DM" ja no apareix simultàniament amb la badge "SHIFT". Quan el mode SHIFT és actiu, la badge SHIFT és l'única que es mostra. En desactivar SHIFT, la càmera torna i la badge desapareix.

### v3.30
- **Fix mode SHIFT toggle**: eliminat conflicte entre el mode toggle SHIFT i l'antic SHIFT+drag. Ara el pan privat DM només funciona via toggle (tap SHIFT). SHIFT+eina màgies segueix funcionant per a línies de spell.

### v3.29
- **Badge SHIFT**: quan el mode SHIFT (pan privat DM) s'activa amb un tap, apareix badge blau "SHIFT" a la barra superior.
- **Badge CTRL simplificat**: ara mostra només "CTRL" sense text addicional.

### v3.28
- **Indicador visual mode CTRL**: quan el mode pan compartit (CTRL) està actiu, apareix un badge verd "⇔ Pan DM+J" a la barra superior, igual que el badge blau del mode SHIFT.

### v3.27
- **Fix Resaltar permanent**: `highlightLocked` ara es sincronitza a la pantalla del jugador via STATE i STRUCT. La opció "bloquejat" del DM ara manté el highlight permanent al jugador.
- **Auto-snap en canvi de mida de cel·la**: quan el Snap està actiu i es canvia la mida del grid, els tokens es re-snapen automàticament a la nova mida.

### v3.26
- **CTRL = toggle pan compartit**: prémer CTRL activa el mode pan (DM+Jugador), tornar a prémer CTRL desactiva i retorna les càmeres a la posició original.
- **SHIFT = toggle pan privat DM**: prémer SHIFT activa el mode pan privat DM, tornar a prémer SHIFT desactiva i retorna suaument la càmera DM.
- En EINA 3 (Màgies), SHIFT continua funcionant per a les línies de spell.

### v3.25
- **Reanomenament intern zones PSD → rooms**: diferencia clarament les sales/zones del PSD (`EnemyRoom`, `roomLayers`, `enemyRooms`, `rRoomsLocked`, `renderRoomOverlays`) de les zones màgiques pintades (`PaintedZone`). Cap canvi funcional.

### v3.24
- **Pan per middle button**: CTRL+mig = pan compartit (DM+Jugador); SHIFT+mig = pan privat DM. Elimina CTRL+clic esquerre per pan.
- **Zones: clic simple = mostrar, CTRL+clic = amagar**: clic en zona fosca la revela; CTRL+clic en zona visible la torna a amagar.
- **Tokens prioritaris en shape tool**: quan mous tokens amb CTRL en EINA 3, els tokens sempre guanyen prioritat sobre spells de zona i zones pintades.

### v3.23
- **ALT+clic per zones**: el toggle de zones (amagar/mostrar) ara requereix ALT+clic en lloc de clic simple, alliberant el clic normal per altres accions.
- **CTRL pan sense restriccions**: el pan compartit DM+Jugador amb CTRL funciona sempre, fins i tot quan el cursor és sobre una zona PSD.

### v3.22
- **Fix CTRL+clic zones**: CTRL+clic sobre una zona de PSD ara torna a funcionar (amagar/mostrar). El pan de CTRL no s'activa quan el cursor és sobre una zona.
- **Fix pluma tot el BG**: el canvas de dibuix es redimensiona automàticament a les dimensions reals del BG importat (imatge o vídeo) en carregar-lo. Ara la pluma pot pintar per tota la superfície del mapa.

### v3.21
- **Area spells permanents (refactor)**: Sleep i Grease ara queden permanents al mapa amb la seva aparença visual original (cercles animats congelats a alpha màxim). CTRL+arrossegar per moure'ls, clic dret → "Eliminar spell" per esborrar-los. No es converteixen en zones pintades.

### v3.20
- **Area spells permanents**: Quan expira l'animació d'un spell d'àrea (ALT: Sleep, Grease), es converteix automàticament en una zona pintada permanent (cercle de 48 punts). La zona segueix les propietats estàndard: movible amb CTRL+arrossegar, eliminable amb el menú contextual.
- **Elimina distàncies SHIFT**: Eliminats els labels numèrics de distància (`🔮 Xft`, `😂 Xft`, `🤲 Xft`) dels spells de línia (Magic Missile, Hideous Laughter, Burning Hands).

### v3.19
- **CTRL pan esquerra compartit**: CTRL+click esquerre en mode pointer mou la càmera compartida (DM+Jugador) igual que SHIFT mou la del DM.
- **Expositor molt més suau**: factor LERP `0.1 → 0.028`, moviments d'expositor molt més lents i fluids.
- **Cursor màgic EINA 3**: cursor pulsant lila (cercles + creu, idèntic a l'estètica del pointer) mentre es fa servir l'eina de Màgies, visible al DM.

### v3.18
- **Fix CTRL pan compartit**: CTRL+arrossegar ara mou la càmera de DM i Jugador simultàniament (SHIFT segueix sent privat DM).
- **Smooth càmera jugador**: LERP de pan basat en distància total (zoom + pan), reduint el factor màxim de 0.35 → 0.13 per un seguiment més fluid.

### v3.17
- **Fix highlight tokens de biblioteca**: `renderLibEnemyTokens` no aplicava l'anell daurat de resaltat d'enemics — afegits `rHighlightAlpha` i el bloc de render idèntic al dels tokens PSD.

### v3.16
- **Auditoria de coherència visual**: estudi contextual complet (tipografia, paleta, espaiat, icones, z-index).
- **Nous tokens al sistema de colors** (`C`): `hpHigh`, `hpMid`, `magic`, `magicBright`, `enemyHL` — centralitzen els colors que eren hardcodejats arreu.
- **HP bars unificades**: `#56d364` / `#e3b341` substituïts per `C.hpHigh` / `C.hpMid` en 5 components i `tokens.ts` (8 ocurrències).
- **Botó "Derrotado" unificat**: usava `#ef4444`/`#f87171` (roig pur) en lloc de `C.enemy` (#f85149) — ara consistent amb la resta de la UI i amb el X del canvas.
- **Cinèmatica i màgia unificades**: `#a855f7` / `#c084fc` ara referenciats via `C.magic` / `C.magicBright` en tots els components (ContextMenu, SceneConfig, SceneImgPicker, DrawToolsPanel).
- **Enemy highlight unificat**: `#ffd200` → `C.enemyHL` en CanvasHUD (intencionalment diferent de `C.accent` per visibilitat en combat).

### v3.15
- **Coherència visual spells**: estructura de 3 capes (glow exterior + traç mid + nucli blanc) per tots els spells de línia; helper `drawImpact` compartit per fireball, magic_missile i hideous_laughter.
- **Etiquetes ft unificades**: tots els spells de línia mostren la distància en peus amb tipografia `bold 11px monospace` i `emoji + ft` durant el vol.
- **Flash d'impacte**: anell de color + anell blanc per tots els spells que usen `drawImpact`.
- **Preview 3 capes**: les guies grogues de SHIFT i el preview d'AoE en mode area_place segueixen el mateix sistema de capes que els spells reals.

### v3.14
- **Menú spells en format donut SVG**: els botons circulars substituïts per sectors d'arc proporcionals al nombre d'opcions; cada sector té el color del spell, fill semitransparent i stroke; en hover s'expandeix cap a fora i mostra el nom del spell al centre del donut.
- **Centre del donut interactiu**: mostra l'etiqueta del mode (Hechizo / Direccional / Área) per defecte i el nom+emoji del spell en hover.
- **Gap entre sectors**: separació de 6° entre cada arc per facilitar la distinció visual.

### v3.13
- **Línies de guia grogues i gruixudes**: la preview de SHIFT+spell de línia ara és groga (`#ffd200`) i 2.5px, coherent amb l'estètica dels spells existents.
- **UX area spells replanteig complet**: flux en dos passos — (1) ALT+click obre el menú de spell i fixa l'origen; (2) en triar el spell, el cursor arrossega l'AoE en temps real i un click confirma el llançament.
- **Límit de rang: circumferència blanca puntejada completa** centrada a l'origen, sempre visible durant el placement.
- **AoE preview al cursor**: cercle/oval del color del spell, semi-transparent, mostra la mida real en world-units; etiqueta `emoji + ft` sobre el cercle.
- **Crosshair a l'origen** en comptes del punt sòlid, per no confondre amb l'AoE.
- **AreaSpellPending**: nova arquitectura per al placement en dos passos; el spell no es dispara fins que el DM confirma la posició final amb un click.

### v3.12
- **Fix mida spells d'àrea amb zoom**: eliminada la divisió per `sc` del radi dels spells Sleep i Grasa; ara el cercle escala correctament amb el zoom (es manté proporcional al grid).
- **Radis basats en peus DnD**: Sleep = 20ft (4 caselles), Grasa = 10ft (2 caselles); conversió automàtica via `gridSize`.
- **Input d'àrea canviat a drag**: ALT+mousedown fixa l'origen (posició del llançador), arrossegar mou l'AoE, soltar obre el menú; elimina el click simple anterior.
- **Preview d'àrea completa**: durant el drag es mostren els anells de rang de cada spell (💤 90ft, 🫙 60ft) en verd si el cursor és dins del rang i taronja si sobrepassa; l'AoE de cada spell es previsualitza al cursor; etiqueta de distància de llançament en peus.
- **AREA_SPELL_DATA**: nova estructura de dades centralitzada a `constants/index.ts` amb `aoeRadiusFt` i `rangeFt` per spell; elimina el marge de +5ft de la Grasa.

### v3.11
- **Nous spells direccionals (SHIFT + eina màgies)**: mantenint SHIFT mentre es dibuixa amb la vareta màgica es crea una línia recta; en soltar apareix el menú amb els hechizos de tir recte: Proyectil mágico (🔮), Risa horrible (😂), Manos ardientes (🤲).
- **Nous spells d'àrea (ALT + eina màgies)**: fent clic amb ALT apareix el menú amb els hechizos d'àrea: Dormir (💤, radi 20ft) i Grasa (🫙, oval).
- **Preview en temps real**: mentre es dibuixa la línia o es col·loca l'àrea, es mostra una previsualització puntejada sobre el canvas.
- **Animacions geomètriques planes**: totes les noves magies utilitzen figures geomètriques netes (sense textures/partícules), preparades per substituir per vídeos WebM en el futur.
- **SpellMenuOverlay adaptatiu**: el menú de hechizos mostra nomes els spells del mode actiu (path / direccional / àrea) i ajusta el radi automàticament.

### v3.10
- **Fix GIF cinematica al jugador**: els GIF com a retrat de boss intro ara s'animen correctament a la pantalla del jugador; el `SceneImgPicker` llegeix el fitxer GIF com a dataURL raw (FileReader) per preservar l'animació al BroadcastChannel, en lloc de convertir a JPEG estàtic via canvas.
- **Fix hitbox tokens jugador amb grid snap**: la detecció de clic i context menu dels tokens de jugador ara usa `rTokenSizeOverride` per calcular el centre i el radi, en lloc de valors fixos (22/26), eliminant el desajust quan l'autosize canvia la mida del token.
- **Moviment suau expositor al jugador**: l'expositor al jugador ara aplica LERP (factor 0.1 per frame) als valors de zoom, pan i Ken Burns rebuts via `EXPOSITOR_SYNC`, en lloc d'actualitzar el transform directament, produint un moviment fluid en lloc d'escacat.

### v3.9
- **Fix versió pantalla de benvinguda**: actualitzat el número de versió a `DMView.tsx` (estava aturat a v3.6).
- **CLAUDE.md**: regla de "mai branches, sempre master" posada com a primera i més prominent; afegida obligació d'actualitzar la versió a `DMView.tsx` en cada release.

### v3.8
- **Fix resaltat no visible al jugador**: `highlightStartRef` s'inicialitza ara quan `enemyHighlight` canvia a `true` al handler STATE (i STRUCT), de manera que el fade-in del ring daurant funciona correctament a la pantalla del jugador.
- **Nou cursor de punterer màgies**: eliminat el cursor antic (que es renderitzava abans del contingut i quedava cobert). Nou cursor vermell (cercles + creu) renderitzat en espai de pantalla DESPRÉS de tot el contingut al DM; el jugador manté els anells daurats (`renderDMPointer`).
- **Fix dibuixos de ploma sense PSD**: el canvas de dibuix es renderitza ara com a fallback antes del `if (!s) return`, de manera que els traços de ploma apareixen fins i tot si no hi ha PSD carregat.
- **Invisibilitat amagua completament el token al jugador**: alpha canviat de 0.22/0.25 a 0 per als enemics i early return per als jugadors quan `isInvis && !isDM`.
- **Càmera retorna a posició pre-cinematica**: guardat `origZoom`/`origPan` en iniciar la cinematica (DM i jugador); restaurats en acabar o saltar, evitant que la càmera quedi bloquejada al zoom del boss.
- **Cinematiques idèntiques a les dues pantalles**: la pantalla del jugador usa ara el mateix timeline que el DM (60ms/500ms/1100ms/4200ms/5100ms), incloent el flash blanc+daurat a 1100ms; eliminat el desfasament.
- **Canvi de terme**: "Escena" renomenat a "Cinematica" als botons de llançament de cinematica.

### v3.7
- **Fix zones PSD invertides**: les zones visibles ara amaguen correctament els tokens situats sota; la lògica de `hiddenByZone` estava invertida.
- **Fix cursor de ploma i màgies al DM**: el cercle de cursor (ploma/goma) i el punteret de màgies es renderitzen ara abans del `if (!s) return`, de manera que apareixen fins i tot sense PSD carregat; corregit també el radi del cercle de ploma.
- **Fix SHIFT+pan no mou la pantalla del jugador**: el jugador ara sempre usa `rZoom`/`rPanOffset` com a objectiu de càmera, ignorant `dmPreviewZoom`/`dmPreviewPan` (vista privada del DM).
- **Fix posició càmera jugador en escenes**: corregit el terme de centrat del canvas (`(W-mw*sc)/2`) que faltava al càlcul de `tgtPanX/Y`, evitant el desplaçament a cantonada.
- **Animacions de sortida en escenes**: títol i retrat surten ara amb transicions suaus de desplaçament lateral + fade, en lloc de desaparèixer en sec; les barres cinematiques també es tanquen amb transició.
- **Posicionament de text i retrat més centrats**: el text i la imatge del boss apareixen ara al 10%/5% respectivament, més propers al centre.
- **Fix costures de textura en zones màgiques**: ampliat el canvas de textura amb padding de 12 píxels per costat perquè el blur de màscara no talli mai al vora del canvas.
- **Eliminat contorn de color en aparició de zona**: s'ha eliminat el traç de color que apareixia breument en crear una nova zona màgica al jugador.
- **Cursor "grabbing" en arrossegar zones màgiques**: en iniciar el drag d'una zona màgica (Ctrl+arrossegar), el cursor canvia immediatament a la mà tancada.

### v3.6
- **Fix salt de càmera en escenes (jugador)**: en acabar o saltar una escena cinematica, la càmera del jugador ja no salta; es sincronitzen `rZoom` i `rPanOffset` amb la posició final de la càmera cinematica.
- **ESC escena sincronitzat al jugador**: en prémer ESC durant una escena al DM, s'envia ara `BOSS_INTRO_SKIP` al jugador perquè les dues pantalles s'aturen alhora.
- **Cursor "grabbing" en arrossegar tokens**: quan s'inicia el drag d'un token (enemic PSD, biblioteca o jugador), el cursor canvia a la mà tancada igual que en les zones màgiques.
- **Fix talls geomètrics en zones màgiques**: la màscara alfa es genera ara a 4× resolució per evitar vèrtexs visibles; el degradat de la vora és molt més brusc (2% blur en comptes del 13% anterior).
- **Fix contorn visible previ aparició de zona (jugador)**: la línia de contorn d'aparició queda ara multiplicada per `fadeAlpha`, de manera que no es veu fins que la zona comença a aparèixer.
- **Tokens ocults rere zones no visibles (jugador)**: tokens PSD, de biblioteca i de jugador situats dins d'una zona no revelada queden ara amagats a la pantalla del jugador.
- **Sync nom i imatge de fitxa PSD al jugador**: els canvis de nom i imatge fets des del DM s'inclouen ara al `BCStateMessage` i `BCStructMessage` i es mostren correctament al jugador.
- **Zoom DM més suau al jugador**: s'aplica un LERP adaptatiu (menor factor com major salt de zoom) per evitar el tall brusc en canvis grans de zoom.

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
