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

---

## Changelog

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
