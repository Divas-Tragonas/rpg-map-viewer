# Changelog

Historial de versions de l'RPG Map Viewer (format `vMAJOR.MM`, sempre dos dígits a la part petita).
La versió actual també surt a la pantalla de benvinguda (`APP_VERSION` a `src/constants/index.ts`).

### v5.24 — Paquets de decorat a la paleta de Caselles
- Objectes: seccions noves «Cofres» (5 models en 3 colors, tancats i oberts), «Gerres» (3 mides en 4 colors) i «Bosc» (soca, roca, mata, falguera i dos arbres grans, en tres paletes)
- Botí: secció «Objectes petits» (31 objectes: pocions, claus, monedes, armes, calavera, torxa…); Decorat: «Gerres trencades»
- La mida del píxel és la de l'autor: les peces més petites que la casella queden al mig amb aire al voltant; els arbres ocupen 3×2 caselles amb el tronc a la casella on es clica
- Es mouen, es giren i s'ordenen per capes com la resta d'objectes; les partides d'abans no canvien

### v5.23 — Paquets nous de decorat al repositori
- Nou `assets/decor-packs/` amb quatre paquets sencers: Gentle Forest (bosc, tres paletes), Treasure Chests, Breakable Pots i Tiny Dungeon Items (32 objectes de 16 px)
- Catàleg `assets/decor-packs/INDEX.md` amb què hi ha a cada paquet, les mides i l'avís de llicències; encara no surten a la paleta de Caselles

### v5.22 — Mapa de caselles: ordre de les capes i eina Girar
- Clic dret (sense arrossegar) sobre un objecte o un decorat: menú amb Porta al davant · Porta endavant · Envia enrere · Envia al fons, Girar 90° i Esborrar (a la pantalla tàctil, mantenir premut). Clic dret arrossegant continua esborrant
- Els decorats i els objectes s'apilen a la mateixa casella (fins a 4): el nou va a sobre i l'esborrador en treu un cada vegada
- «Girar» ara és una eina: es tria i cada clic gira 90° l'objecte o el decorat de sota; la R gira el que hi ha sota el cursor. Els pinzells de la paleta ja no es giren

### v5.21 — Sales fosques: només la paret vertical, no la vista des de dalt
- De la paret de dalt d'una sala fosca, només es fa fosca la meitat de baix (la cara vertical, on hi ha els maons i el que hi penja); la meitat de dalt és la paret vista des de dalt i es veu sempre, com les parets laterals
- Les partides desades amb la v5.20 es corregeixen soles en carregar-les

### v5.20 — Sales fosques: la paret de dalt també es fa fosca
- Al mapa de caselles, la cara de paret que mira cap a una sala (amb els estendards, teranyines, mobles o decorat que hi hagi a sobre) forma part de la sala: queda fosca amb ella i s'il·lumina quan hi ha algú a dins
- Les partides desades abans s'actualitzen soles en carregar-les; parets, portes i moviment no canvien

### v5.19 — Mapa de caselles: girar el decorat i els objectes i moure objectes fora de la graella
- Tecla R (o «Girar» a la paleta): el decorat i els objectes es pinten girats de 90 en 90°; la miniatura i la previsualització sota el cursor ja surten girades
- Pinzell «Moure» (pestanyes Objectes i Botí): arrossega un objecte ja posat on vulguis, al píxel (Maj l'enganxa a la casella); clicat queda triat i la R el gira
- Les torxes mogudes o girades també mouen la llum; tot es pot desfer i es desa a la partida sense canvis a la API

### v5.18 — Fòsfor: parpelleig com a capa de CSS (GPU a zero en repòs) i figuretes més àgils en espera
- El parpelleig del mode Fòsfor és una capa negra d'opacitat animada (compositor); el shader ja no es repeteix en repòs: amb l'escena quieta no es toca la GPU
- L'animació d'espera de les figuretes va un ~30 % més ràpida (230 ms per fotograma, abans 300)

### v5.17 — Mode Fòsfor molt més àgil a les tauletes
- La conversió a la paleta es fa amb una taula de colors calculada una sola vegada (una lectura per píxel en lloc d'OKLab + 32 comparacions)
- Amb l'escena quieta ja no es repeteix la passada de paleta: només el parpelleig (a ~30 fps)
- Els vídeos de fons només es tornen a pujar a la GPU quan canvia el fotograma; el halo passa de 8 a 4 mostres
- Mesura (WebGL per programari): fotograma amb mapa repintat −31 %, escena quieta −76 %

### v5.16 — Escena (imatge + text) molt més àgil a la pantalla de jugador
- El text ja no repinta cada caràcter a cada fotograma: només s'escriu al DOM el que canvia, el desenfocament queda als últims caràcters (i s'apaga a l'iPad i quan va lent) i el seguiment del scroll no força el layout a cada frame
- Ombres de text més lleugeres i fons desenfocat de la imatge pintat una sola vegada en un llenç petit
- Mentre l'escena tapa tot el mapa, la pantalla de jugador deixa de pintar el mapa de sota
- Mesura: temps de ràster del text −70 % (subtítols) i −89 % (pantalla completa)

### v5.15 — Càmera més àgil amb llums: reprojecció, terra explorat en coordenades de mapa i qualitat adaptativa
- En moure o fer zoom a la càmera, les llums ja no es refan a cada fotograma: es reprojecta el rasteritzat anterior i, en aturar-se, es fa una passada final a resolució plena
- El terra explorat es guarda en coordenades de mapa: moure la càmera no el refà
- Qualitat adaptativa de les llums: si el dispositiu no arriba a ~33 fps mentre canvien, baixa la resolució i espaia els rasteritzats; quan va sobrat, torna a pujar
- Mesura (rasteritzador per programari): càmera sola ~31 → ~15 ms/frame; càmera + tokens ~34 → ~26 ms

### v5.14 — Llums a baixa resolució mentre es mouen, sense capa intermèdia i terra explorat dins la foscor
- La llum d'un token en moviment es rasteritza a la meitat de resolució (¼ dels píxels) i, quan s'atura, es refà una vegada a resolució plena
- Les llums esborren la foscor directament (menys blits de pantalla per frame)
- Pantalla de jugador: el terra explorat es pinta dins de la capa de foscor (un sol blit en lloc de tres)
- Mesura: ~77 → ~29 ms/frame movent tokens (rasteritzador per programari, 5 jugadors)

### v5.13 — Llums més àgils: límit de ritme, explorat més espaiat i terra explorat en memòria cau
- La llum i el seu polígon de visió es refan com a molt cada ~24 ms mentre un token es mou (el darrer fotograma sempre és exacte)
- La memòria d'explorat s'acumula com a molt cada 150 ms (i sempre acaba d'acumular-se en aturar-se)
- El terra explorat («mapa ∩ explorat») es guarda en una memòria cau i ja no es repinta el mapa sencer a cada fotograma

### v5.12 — Pantalla de jugador a l'iPad: sense selecció falsa en mantenir premut
- Mantenir premut un token (p. ex. apilats) a la pantalla de jugador ja no activa la selecció de text ni la lupa/menú d'Apple (`user-select`/`-webkit-touch-callout: none` amb pantalla tàctil, i `contextmenu` bloquejat al canvas)

### v5.11 — Ordre de tokens per alçada, token actiu fix, portes sota els tokens i noms ajustats
- **Ordre de pintat**: el token més avall al mapa tapa el de darrere (abans, el de més amunt anava per sobre); el clic segueix el mateix ordre
- **Token de l'última acció** (agressor i víctima/afectats) es queda per sobre de tots **fins que un altre en faci o en rebi una**, sense límit de 3,5 s; igual a la pantalla de jugador
- **Portes laterals**: el token que passa per una porta queda **per sobre de la porta però per sota de la paret** (la vora del tram de baix), al DM i a la pantalla de jugador igual
- **Noms**: pengen de l'aro dels peus (no de la vora de la casella) i el DM fa servir la mateixa col·locació que la pantalla de jugador; es pinten després de tots els tokens (cap figureta els tapa) i, si a sota taparien el token del costat, van **al costat dels peus** (filera de tokens). A la pantalla de jugador tampoc queden sota les portes
- **Noms i vida esvaïts sobre les figuretes**: allà on el nom o la vida d'un token passen per damunt de la figureta d'un altre, s'esvaeixen perquè se'n llegeixi la silueta (DM i jugador)
- **Barra de vida del DM** enganxada sota el nom: puja amb ell i el segueix allà on vagi (ja no la tapa el token de sota)

### v5.10 — Desfer del diari i dels morts, V només selecció, token actiu al davant
- **Ctrl+Z** recupera una anotació del diari esborrada (✕ d'una anotació o d'un combat); Ctrl+Y la torna a esborrar
- **Desfer un atac o conjur** treu també el missatge de l'historial del combat i, si havia tirat un jugador a terra, la seva anotació «cau» del diari (Ctrl+Y els torna)
- **V** és només l'eina de selecció: apaga també la selecció múltiple (àrea) i qualsevol altra eina
- **Token actiu al davant**: el que rep o fa una acció (cop, conjur, estat) es pinta uns segons per sobre dels altres, amb nom, figureta i animacions, al DM i a la pantalla de jugador (també al hit-test)

### v5.09 — Selecció només amb Ctrl, grups amb nom i un sol torn, halo que pulsa, mapes de caselles sense límit
- **Diari**: fora l'estrella i el botó «Anteriorment…» (i el seu recap); cada anotació és un requadre amb la vora i l'etiqueta del color del seu tipus, com l'historial de combat
- **Halo del torn** més visible: línia més gruixuda i dos vels que **pulsen** lentament (intensitat i mida)
- **Grups al combat**: un grup triat en iniciar els torns juga **alhora** (un sol torn per a tots els seus membres: halo, moviment, estats i recàrregues); a la barra **un grup és un sol xip** (avatar + recompte, «N / total drets» quan té el torn) i el rètol de jugador diu el nom del grup
- **Crear un grup** obre una finestreta flotant al lloc del clic per posar-li nom (Enter l'accepta); per defecte «Grup N+1» amb un comptador intern que només puja
- **Selecció**: un clic a un token substitueix la selecció; per afegir-ne, **Ctrl/⌘ + clic** (també el rectangle `A`). Surt a l'ajuda de dreceres
- **Llenç del mapa de caselles ajustat**: sempre la zona pintada + 10 caselles de marge a cada banda (una sala 5×5 → llenç 25×25), tot el contingut es desplaça amb ell i el desfer ho recorda
- **Mapa de caselles** sense el límit de 120: ara el sostre és de seguretat (300 per costat, 40.000 caselles). El botó de centrar vista centra el que hi ha pintat, no el llenç sencer
- Sense canvis a la API (`together`/`groupNames` van dins de `turn`, que el servidor reenvia tal qual)

### v5.08 — Historial de combat més llegible, fitxa dels jugadors i diari amb combats plegats
- **Historial de combat** (botó de la barra de torns): cada missatge va en un petit requadre amb una vora del color del seu tipus (atac, conjur, efecte, cura, informació); les rondes en un títol a part
- **Fitxa 5e als tokens dels jugadors de DIVAS**: el menú del token porta la mateixa «Fitxa 5e» plegable que els enemics (CA · nivell · velocitat; característiques, salvacions amb competència, atacs i trets), feta a partir de la seva fitxa de personatge
- **Logotip del mode Píxel fora de tot arreu** (l'espasa no es deia què era): barra superior, pantalla de benvinguda, selector Clàssica/Píxel del menú principal (ara només text) i avís de «Carregant els sprites…»; la icona s'ha esborrat d'`icons.tsx`
- **Diari de la sessió**: cada combat (de «Comença» a «Combat acabat») és una sola fila desplegable amb el detall, ronda per ronda; en acabar, el combat desa el seu historial al diari (també al bloc JSON del resum). Els combats d'abans es desplegaran amb el que s'havia anotat
- Sense canvis a la API

### v5.07 — Alè de foc del drac i raig necròtic, refets
- **Alè de foc** (poder de criatura, app Clàssica): la gola s'encén, un front de flames escombra el con i el raig es manté amb flames que es refreden i s'inflen a mesura que s'obre; guspires, tremolor suau de la càmera, i el terra queda socarrimat amb flametes i brases que s'apaguen sota les figures. Abans eren tres falques planes
- **Raig necròtic** (Dit de la mort, Danyar, Marcir…): un fuet negre amb la vora verda que es retorça; a l'objectiu no esclata sinó que implosiona, i les espurnes de vida viatgen de la víctima cap a qui l'ha llançat. Abans era una boleta grisa i tres anells
- A l'app Píxel no canvia res; mateixa durada fins al dany. Sense canvis a la API

### v5.06 — Rendiment: el bucle descansa quan no passa res
- **Ritme del bucle de render** (`lib/render/wake.ts`, DM i jugador): ple mentre hi ha canvis o una animació en marxa, **~30 fps** amb només animacions lentes (figuretes en espera, aigua, zones, pols del torn) i **cap repintat** amb l'escena quieta. Abans es repintava tot a 60 fps sempre. Si alguna cosa es quedés congelada, `IDLE_PACING = false` torna al comportament d'abans
- **Sostre de fotogrames**: a pantalles de 100 Hz o més es pinta un fotograma de cada dos (les animacions van per fotograma i anaven al doble de velocitat fent el doble de feina)
- **Mode Fòsfor**: el canvas del mapa només es torna a pujar a la GPU quan s'ha repintat
- **Fons reduït per als jugadors** (`lib/bg-reduce.ts`, només estil Clàssic): les imatges PNG/JPEG de més d'1,5 MB s'envien reduïdes a 4096 px de costat i en WebP; el DM i els desats segueixen amb l'original. El STRUCT porta `bgSize` (mida real del mapa)
- **Vida dels enemics**: el STATE ja no repeteix la imatge (base64) dels enemics que el jugador ja té
- **Tokens**: retrat dels enemics retallat un sol cop (sense `clip` per fotograma), amplada dels noms sense `measureText` per fotograma i punts de vida amb contorn en lloc de `shadowBlur`
- **Pantalla de jugador**: els fulls de sprites (~720 KB) només es carreguen si la partida és en estil Píxel (o arriba una fitxa, un diàleg o una cinemàtica)
- Portes del mapa de caselles: índex per id en lloc d'un `find` per porta i fotograma
- Sense canvis a la API (`bgSize` és un camp més del `STRUCT`, que el servidor reenvia tal qual)

### v5.05 — Càpsules: capturar un moment i disparar-lo des de la Història
- **Història → Mòdul → «+ Capturar el moment»**: desa el que hi ha ara en una càpsula del mòdul: els **enemics de l'escena amb la seva posició** (també els amagats) i/o l'**Escena** de «Mostrar als jugadors» (imatges, text i ajustos)
- Opcions en capturar: treure els enemics del mapa (per preparar-los sense que es vegin) i mostrar l'Escena als jugadors en disparar
- **«Disparar»** torna a posar els enemics on eren (vida sencera, numerats) i carrega l'Escena; amb l'opció, la mostra als jugadors i el text comença sol. Queda al diari
- Les càpsules es desen al navegador (IndexedDB, amb les imatges) i sobreviuen a recarregar la pàgina; es poden reanomenar i eliminar. Eliminar un mòdul n'elimina les càpsules
- Corregit: un mòdul «En joc» tornava a «Preparat» en recarregar la pàgina
- Sense canvis a la API

### v5.04 — Editor de mòduls dins l'app
- **Història → Mòduls → «+ Nou mòdul»**: formulari per crear un mòdul sense JSON ni Claude (títol, disparador, escena, textos per llegir, enemics amb suggeriments del bestiari, diàlegs en format teatre, sortides cap a altres mòduls, NPCs i notes del DM)
- **Llapis a cada mòdul** de la biblioteca per editar-lo (l'`id` i l'estat de joc es conserven, així les sortides dels altres mòduls segueixen funcionant)
- `saveModule` a `lib/modules.ts`; sense canvis a la API

### v5.03 — Habilitats de la fitxa al menú del token, amb descans
- **Habilitats a punt per usar**: `sheet.powers` (mateix format que els poders de les criatures) surt al menú del token dels jugadors com a «Habilitats». Yunquerin: **Expulsar Muertos Vivientes** (aura 30 ft, salvació SAB CD 13, espantats 1 min) i **Preservar Vida** (cura en aura 30 ft), que comparteixen l'ús de Canalizar Divinidad; Jaume: **Oleada de Acción** i **Segundo Aire**; Espardeny: **Segundo Aire**. Les armes noves ja surten a «Atacs»
- **Es gasten com l'alè d'un drac**: en fer-les servir (en confirmar l'efecte) el botó s'apaga i marca ⟳, però es pot prémer igualment. Mateixa mecànica que els poders amb recàrrega, però amb `rest` ('short' | 'long') en lloc d'un d6; `uses` fa que dos poders comparteixin l'ús. Es queden gastades fora i dins de combat fins al descans
- **Descans curt / llarg a tots els jugadors** (menú del token): el curt torna les habilitats de descans curt; el **llarg torna tota la vida** i totes les habilitats
- Corregit el text de les habilitats al menú (es veia en vertical)
- Sense canvis a la API

### v5.02 — Munició a mà i seccions només per al DM
- **Munició a mà**: al menú del token d'un jugador surt «Munició» amb − / + per pila (Maj = 5 en 5), per quan recuperen o perden fletxes a banda del tret. Es desa a la fitxa (API)
- **Seccions «Només DM»**: una secció de la fitxa amb el títol començat per «Només DM» no viatja mai a les pantalles de jugador (ni encara que es demani) i no surt al panell «Fitxa» per triar què s'ensenya. Cigarramic hi té la ranura màgica del bastó, encara no pública
- Sense canvis a la API

### v5.01 — Fitxes d'Espardeny i Cigarramic, i munició que es gasta
- **Espardeny**: 21 PV màxims, ballesta (1d8 amb Destresa, 80/320 ft), 20 fletxes i 25 fletxes de ballesta, 702 d'XP (a la còpia local; a la API, des del back office)
- **Cigarramic**: 17 PV màxims, **Bastó pelegrí** (arma especial amb una ranura màgica: bastó 1d4 o espasa 1d6, amb Destresa) i ballesta (1d8)
- **Munició que es gasta**: un atac pot gastar una pila de `sheet.ammo` (`SheetAttack.ammo`). En apuntar-lo a un objectiu en baixa una peça de la fitxa; el menú «Atacs» mostra el que queda i s'apaga a 0. Sense pila = il·limitada. Editable al back office («Munició» a cada atac i apartat «Munició»)
- Sense canvis a la API (`sheet` és opac)

### v5.00 — Versió 5
- Publicació de la **versió 5**: tot el que s'ha fet de la v5 snapshot 1 a la 19. Resum de les novetats al [README](README.md#novetats-de-la-v5)
- Combat amb regles de 5e (dany amb defenses, conjurs amb salvacions, estats i durades), bestiari de 5e complet amb poders i historial del combat, animacions de pixel art noves i l'Escena (imatges en diapositives amb subtítols) en lloc de l'Expositor i el Revelador de text
- Necessita la API amb els camps de 5e als enemics (v5 snapshots 1 i 7, veure `api-spec.txt`)

### v5 snapshot 19 — L'Escena substitueix l'Expositor i el Revelador de text
- **Fora les pestanyes «Imatge o vídeo» i «Text»** del panell «Mostrar als jugadors» (Expositor i Revelador de text), també a les pantalles de jugador: l'**Escena** en fa les dues coses. El panell queda amb Escena · Diàleg · Fitxa. El text que deixen els mòduls de la Història («llegir en veu alta», «Anteriorment…») va a la caixa de text de l'Escena
- **Configuració de l'Escena reorganitzada**: dos grups (Text · Imatge) en una graella de tres columnes iguals, amb el nom de cada ajust a sobre. Els botons fan sempre la mateixa mida: canviar a L/R (sense imatge) ja no mou res. «Buida» passa al grup Imatge
- **Carrusel centrat a la finestra**: ocupa tota l'amplada i la imatge que es veu queda al centre del panell. Sense números. El **«+»** és una diapositiva amb contorn de ratlles al final, que es mou amb el carrusel
- **Moviment de les imatges el doble de lent**
- La caixa de text s'encongeix una mica si no hi cap, en lloc de fer scroll
- Sense canvis a la API

### v5 snapshot 18 — Escena: panell compacte i alineació sense imatge
- **Tot el panell de l'Escena cap a la pantalla sense scroll** (1920×1080 a escala 125 %): configuració en files compactes, el progrés del text com una línia a sota de la previsualització i l'estat al costat dels botons
- **Text i subtítols en un sol grup** de la configuració; el d'Imatge en una sola fila
- **Subtítols sempre frase a frase**: fora l'opció «Continu»
- **Sense imatge, la posició passa a ser l'alineació** del text a pantalla completa: els botons diuen L · Centre · R (dalt = esquerra, baix = dreta). La mida S/M/L també hi compta
- **Miniatures més petites**, amb la que es veu sempre al centre del carrusel
- Sense canvis a la API

### v5 snapshot 17 — Escena: diapositives, dos blocs i configuració endreçada
- **Diverses imatges o vídeos** a l'Escena, que es passen com a diapositives (amb un fos suau als jugadors). Tots es preparen a les pantalles en mostrar l'escena, així el canvi és immediat
- **Dos blocs a la previsualització**: clic al bloc de la imatge = imatge següent; clic al bloc del text (la franja dels subtítols) = avançar el text. Una pista diu què farà cada clic
- **Carrusel de miniatures** entre la previsualització i el text: la d'ara, la següent i les que vénen; clic per anar-hi, arrossegar per canviar l'ordre, × per treure-la, «+» per afegir-ne. Tecles ↓/↑ per passar d'imatge. Opció «Bucle»
- **Configuració endreçada** en tres grups (Text · Subtítols · Imatge), plegable amb un resum d'una línia
- Sense canvis a la API

### v5 snapshot 16 — Escena: imatge o vídeo amb subtítols
- **Pestanya nova «Escena»** al panell «Mostrar als jugadors»: una imatge o un vídeo de fons i el text a sobre, com uns subtítols. Sense imatge, el text surt a pantalla completa (com el Revelador)
- **Previsualització 16:9** que és el que veuen els jugadors: la imatge omple tot l'escenari i el text hi va a sobre. S'hi pot arrossegar el fitxer, fer zoom amb la roda i moure la imatge
- Opcions compactes a dalt (velocitat, pauses, suavitat, manual) i opcions noves: posició dels subtítols (baix, centre, dalt), mida, franja fosca, **frase a frase** o text continu, encaixar/omplir la imatge, moviment de càmera i recentrar. El text s'escriu a sota de tot
- Els canvis de text, opcions o imatge mentre es mostra arriben als jugadors en directe; funciona a la tablet (també si es connecta tard)
- L'Expositor i el Revelador de text no canvien: l'Escena n'aprofita el motor. Mostrar-ne un amaga els altres
- Sense canvis a la API

### v5 snapshot 15 — Animacions d'atac i conjurs un 15 % més lentes
- Totes les animacions d'atacs, conjurs i poders de criatures van un 15 % més lentes (`FX_SLOW`), a totes les pantalles
- El dany i els estats dels conjurs en combat s'apliquen quan l'efecte arriba, amb el nou ritme
- Sense canvis a la API

### v5 snapshot 14 — Màgies d'un objectiu centrades al token
- Clicant sobre un token (també sobre el cap de la figureta o un costat), les màgies d'un sol objectiu (Flama sagrada, Curar ferides, Riure histèric, Raig de gebre…) i les d'àrea petita van al centre del token: les animacions que esclaten al terra queden a la seva base
- Raigs i cons, igual que abans, cap al centre del token. Les àrees grans (Bola de foc, Son…) continuen anant on es clica
- La previsualització en apuntar mostra el mateix punt on caurà
- Sense canvis a la API

### v5 snapshot 13 — Efectes centrats a la figureta
- **Creu de derrotat** centrada al cos de la figureta (abans, al centre de la casella, que cau a les cames)
- **Conjurs de l'app Píxel**: els efectes al cos i els segells (exclamació, estrelles, zzz…) fan servir la geometria dels tokens; els segells que suren queden damunt del cap, sense tapar-lo
- **Globus de diàleg** ancorat al cap de la figureta
- Sense canvis a la API

### v5 snapshot 12 — Icones de pixel art i estats sense bombolles
- **Paquet d'icones «UPSCALE» separat i net**: les quatre captures borroses (armes, equipament, objectes i conjurs) convertides en **1.686 icones soltes de 16×16 amb el fons transparent**, a `assets/icon-packs/` amb un catàleg i fulls numerats. En lloc d'ampliar-les més, se n'ha recuperat la resolució original (estaven ampliades ×1,9 amb suavitzat) i es pinten ampliades sense suavitzar: nítides a qualsevol mida
- **Icones noves a la interfície** en lloc dels emojis: roda de màgies, roda de zones, grimori dels jugadors, poders de les criatures, pop-up dels conjurs i l'icona de les zones del DM. Els **atacs** tenen la icona de la seva arma (espasa, arc, ballesta, daga, destral, maça, llança, bastó, mossegada, urpa…)
- **Estats sense bombolles**: fora les bombolles amb l'isotip sobre el cap dels tokens, que tapaven les animacions (marejat, enverinat…). L'estat es veu a l'anell de colors dels peus i a l'animació. El nom ja no puja sobre el cap si hi ha una animació
- Sense canvis a la API

### v5 snapshot 11 — L'animació d'atac la fa qui ataca
- **Arreglat**: l'envestida de l'atac (app Píxel) la feia sempre el token que tenia el torn. Ara la fa el token des del qual s'ha triat l'atac: si al torn de Liriandor el guerrer ataca una rata, s'hi llança el guerrer
- **Fora de combat també hi ha animació d'atac** (abans no en sortia cap perquè no hi havia torn)
- Els conjurs i els poders de les criatures fan l'impacte des del llançador (sense envestida)
- Sense canvis a la API

### v5 snapshot 10 — Animacions noves d'atacs, màgies, estats i zones (app Píxel)
- **Paquets de pixel art nous al repositori**, sencers, a `assets/fx-packs/` (foc i elements, Magic Pack 9, Magic VFX, i els SoggySocks de combat, terra, estats, llamp, natura, aigua i icones), amb un catàleg de cada textura a `assets/fx-packs/INDEX.md` per poder-ne fer servir més endavant
- **La tria que encaixa** (31 animacions) va a un sol full, `public/sprites/fx_anims.png` (69 KB), generat amb `scripts/fx-atlas.py`
- **Màgies**: la bola de foc fa un esclat gran amb esclats petits fins a la vora i deixa brases a terra; el llamp i el raig màgic són un arc elèctric que va del llançador al destí; les mans ardents i els alès són onades d'esclats que s'obren en con (foc, gel i neu, núvols de verí); l'alè d'àcid, esquitxos en línia. Impactes nous per al projectil màgic, el raig de gel (esclat i punxes de gel), l'agafada electritzant, la flama sagrada (llamp de llum del cel), curar ferides (gotes vermelles que pugen), encisar persona (cors), beneir, prestidigitació, taumatúrgia, el raig de foc, el raig necròtic, el terror, el núvol, desaparèixer (remolí), l'ona de tro, enredar (lianes) i la fletxa àcida
- **Cops**: el cop fort esquitxa sang, el que deixa a 0 aixeca pols, l'atac a distància fa un impacte propi (no un tall d'espasa) i la curació són gotes vermelles que pugen. Arreglat: el número dels cops lleus es tallava abans d'hora
- **Estats a la figureta**: Atordit (estrelles), Encisat (cors), Paralitzat (espurnes), Enverinat (núvol de verí), Retingut (lianes als peus), Inconscient (zetes) i Beneït (espurnes daurades)
- **Zones màgiques a la pantalla de jugador**: detalls de pixel art escampats per dins (flametes, cristalls de gel, bassals d'àcid, espurnes…), lluny de la vora i quiets al seu lloc. El camp de sempre no canvia
- Tot a l'app Píxel; la Clàssica no canvia. Sense canvis a la API ni a la sincronització

### v5 snapshot 9 — Poders i conjurs de les criatures, recàrrega i mides de 5e
- **Poders i conjurs al menú dels enemics i aliats**: tots els encanteris i accions especials del seu bloc (dades de 5e.tools), com el grimori de Liriandor: alès dels dracs, el Rostre horrorós i el Lament de la banshee, les mirades de les mòmies, els raigs oculars de l'espectador i el contemplador, el Xiscle i les Espores del vrock, i els encanteris del Mag malvat, Nezznar, el Sacerdot, el Druida, el Lich… amb la seva CD i el seu bonus d'atac
- **Cada poder té animació i efecte**: les màgies que ja existien i 15 animacions noves (alès de foc, fred, verí i àcid, rajos necròtics, raigs oculars, immobilitzar, terror, núvols, ones de tro, desaparèixer…). El pop-up de sempre amb els afectats, la salvació, els estats i el dany, amb «CD 14 · 12d6» a la capçalera. Els que no tenen efecte de joc (Druidisme, Passa boirosa…) només fan l'animació
- **Alès**: el con o la línia surten de la criatura amb la seva llargada; mentre apuntes es veuen les caselles que cobreixen
- **Recàrrega automàtica en combat**: un poder com l'alè de drac queda gastat en usar-lo; a l'inici del torn de la criatura es tira el d6 sol i ho diu l'historial (i un avís si es recarrega). Fora de combat no es gasta mai
- **Mides de 5e**: en col·locar una criatura gran (drac jove, trol, ós, gòlems, elementals…) surt de 2×2, les enormes de 3×3 i les gegantines de 4×4; les diminutes, més petites. Les de 2×2 s'encaixen a la graella pel vèrtex
- Sense canvis a la API

### v5 snapshot 8 — Bestiari revisat amb les dades de 5e.tools
- **Tots els blocs del bestiari de l'app tornats a generar a partir de 5e.tools** (Manual de monstres, La mina perduda de Phandelver i Volo): CA, vida, velocitat, característiques, salvacions, resistències, immunitats, immunitats a estats, **tots els atacs** amb abast i dany extra, accions especials (alès, teranyina…), trets, encanteris per nivell i reaccions
- Correccions respecte d'abans: el **Mag malvat** (bastó 1d8−1 i els seus encanteris reals: light, mage hand, shocking grasp, charm person, magic missile, hold person, misty step), **Mormesk** (VD 3, 45 PV, Drenar vida +5 3d8+3), el **Rei Grol** (CA 17, estrella del matí +5 2d8+3 i javelina), **Nezznar** (DES 13, SAV 14), el **Druida** (bastó +2 1d6; +4 1d8 amb shillelagh), el **Cuc porpra** (+14), el **Sacerdot** (30 ft), l'**Explorador** (arc llarg 150/600) i el **Foc follet** (pot quedar petrificat)
- **Sildar Flocdeneu** ara té el seu bloc de Phandelver (VD 1, 27 PV, CA 16) en lloc del de Cavaller
- Plantilles noves de Phandelver al Bestiari: **Rufià dels Mantells Vermells** i **Zombi de cendra**
- L'atac múltiple i els noms dels encanteris es mostren en anglès, com a la font
- Sense canvis a la API

### v5 snapshot 7 — Historial del combat, avisos a baix i bloc de 5e als enemics de la BD
- **Historial del combat**: botó petit a la dreta de la barra de torns amb el que ha passat, per rondes: inici i fi, cada atac (qui, a qui, amb què, el dany final i el perquè, si era fora d'abast i si cau), cada conjur amb els afectats (dany, salvació, resistències, estats) i els efectes que s'acaben. No hi surten els torns ni els ± de vida a mà
- **Avisos a baix**, just a sobre de la barra de combat (o arran de baix si no n'hi ha), i duren més (10 s). Només surten com a avís les coses del moment (Escut aplicat, un efecte que s'acaba); el dany i els estats van a l'historial
- **Enemics de la BD amb bloc de 5e**: al back office, VD, CA, velocitat, característiques i salvacions, immunitats a estats i a armes no màgiques, atacs i trets, amb «Omplir des del bestiari» per copiar el bloc d'un monstre de l'app i retocar-lo
- Al joc, els enemics de la BD fan servir el seu bloc com els del bestiari: atacs al menú, fitxa 5e, immunitats als pop-ups i salvació de l'objectiu. Els que ja són al mapa agafen els canvis del back office en recarregar
- **Canvis a la API**: bloc de 5e als enemics (`cr`, `ac`, `speedFt`, `move`, `abilities`, `saves`, `nonMagicImmunities`, `conditionImmunities`, `attacks`, `traits`). Veure `api-spec.txt`

### v5 snapshot 6 — Bestiari de 5e complet i Mans ardents fora d'abast
- **Arreglat: Mans ardents fora d'abast**. En clicar la figureta d'un token (a l'app Píxel és per sobre de la seva casella), el con apuntava massa curt i no el tocava. Ara una màgia direccional clicada sobre un token apunta al seu centre
- **Bestiari de l'app amb tots els blocs de 5e** (Manual de monstres, Phandelver, Volo): CA, característiques, salvacions, velocitat, resistències, immunitats, vulnerabilitats, immunitats a estats, atacs i trets de cada monstre. Abans només hi havia VD, vida i XP
- **El dany ho té en compte**: l'Elemental de foc és immune al foc (Mans ardents: 0), l'esquelet és vulnerable al contundent, els gòlems són immunes a les armes no màgiques, etc. També els enemics que ja eren al mapa
- **Immunitats a estats**: al pop-up d'un conjur, un estat al qual l'objectiu és immune surt ratllat i no s'aplica (l'Elemental de foc no es pot adormir)
- **Salvació de l'objectiu** al pop-up dels conjurs (enemics del bestiari i jugadors amb fitxa): «supera (+3)»
- **Atacs dels enemics** del bestiari al menú del token, amb el seu abast (urpes, mossegades, arcs…)
- **Fitxa 5e** plegable al menú del token dels enemics: el bloc sencer per consultar-lo en partida
- Sense canvis a la API (els enemics de la BD continuen tenint només defenses i abast)

### v5 snapshot 5 — Durades de 5e en combat, beneficis al token i Supr
- **Mà de mag, Llum, Prestidigitació, Taumatúrgia i Detectar màgia** ja no obren el pop-up de dany: no en fan. Només hi surten les màgies que fan dany, curen, posen estats o donen un benefici
- **Durades en combat** (regles de 5e, comptant els torns de qui l'ha llançat): Escut fins al principi del seu proper torn; Dormir, Riure horrible i Beneir 1 minut (10 rondes). En acabar-se, l'estat es treu sol i surt un avís. **Dormir s'acaba si l'adormit rep dany**. Encisar (1 hora), Greix (fins que s'aixequi) i Armadura de mag (8 hores) no caduquen dins del combat
- **Beneficis marcats al token**: Escut, Beneït i Armadura de mag són estats nous (amb icona) que es veuen a l'anell del token i al selector d'estats. En acabar el combat, Escut i Beneït es treuen
- **Supr** elimina el token seleccionat sense confirmació; **Ctrl+Z** el torna (també al seu lloc a la barra de torns)
- Sense canvis a la API

### v5 snapshot 4 — Graella subtil i només al terra, conjurs fora de combat i Escut
- **Graella més subtil**. Als mapes de caselles només es veu al **terra de les sales** (ni al buit negre ni a les parets); als mapes d'imatge o vídeo, per tot el fons
- **Al DM la graella torna a sortir només mentre mous un token** (la v5 snapshot 2 la deixava sempre encesa als mapes de caselles)
- **Pop-up del conjur també fora de combat**: es pot fer el dany sense iniciar els torns
- **Tots els conjurs que toquen un token obren el pop-up** (Mà de mag, Llum…: dany a mà si cal). Amb el dany buit, Enter només llança l'efecte
- **Fora d'abast**: el con de Mans ardents s'allarga fins on cliques, i toca el que hi ha fins allà
- **Escut** mostra el benefici («CA 12 → 17 fins al principi del seu proper torn», amb la CA de la fitxa) i en deixa un avís en aplicar-lo. També Armadura de mag (13 + DES) i Beneir (+1d4)
- Sense canvis a la API

### v5 snapshot 3 — Primer el dany, després l'animació; abasts per caselles; app Píxel per defecte
- **App Píxel per defecte**: l'app arrenca a la Píxel (també qui tenia triada la Clàssica, una vegada); a partir d'aquí es recorda el que triïs
- **Conjurs en combat: primer es decideix i després es veu**. En clicar el destí surt el pop-up i el conjur encara no es llança; en aplicar, surt l'animació i el dany i els estats arriben quan l'efecte toca. «Només l'efecte» la llança sense aplicar res; Cancel·lar/Esc no llança res
- **Sense cop cos a cos fals**: el dany d'un conjur o d'un atac a distància ja no fa que el token del torn faci l'envestida (abans, un Raig de gebre feia que Liriandor «pegués» cos a cos en aplicar-lo)
- **Abasts i àrees per caselles**: amb graella, l'abast dels atacs i els conjurs es pinta com les caselles a l'abast (com el rang de moviment) i les àrees com les caselles que cobreixen; la distància i qui queda afectat també es calculen per caselles. Sense graella, cercles com abans
- L'etiqueta de la línia d'un conjur i la del token assenyalat donen la mateixa distància
- Sense canvis a la API

### v5 snapshot 2 — Els conjurs fan dany i posen estats en combat; graella dels mapes de caselles
- **Conjurs en combat**: amb els torns actius, en llançar una màgia que toca tokens surt un pop-up al costat dels afectats. Poses el dany tirat un cop, marques qui **supera** la salvació (meitat o res, segons la màgia) i s'aplica a cadascun amb les seves resistències. **Enter** aplica, **Esc** cancel·la
- **Estats proposats**: Dormir → Inconscient, Riure horrible → Tombat i Incapacitat, Greix → Tombat, Encisar persona → Encisat. Surten marcats a qui no supera la salvació; els pots desmarcar abans d'aplicar
- Formes: Bola de foc i Dormir (àrea), Raig elèctric i Raig màgic (línia), Mans ardents (con de 15 ft), la resta a un sol objectiu. Curar ferides cura
- **Mapa de caselles**: en crear-lo o importar-lo, la graella s'encén sola amb la mida de les caselles i es veu també a la pantalla del DM (abans només hi havia l'imant, sense línies)
- La graella també surt mentre pintes terreny difícil
- Sense canvis a la API

### v5 snapshot 1 — Dany amb resistències (combat amb regles de 5e, versió no definitiva)
- **Pop-up de dany**: atacant des del menú del token, clicar l'objectiu obre un pop-up al seu costat (sense tapar-lo). Hi escrius el dany que han tret els daus i veus el **dany final** segons les defenses de l'enemic, amb el perquè («Resistent a tallant (arma no màgica): la meitat») i els PV que li quedaran. **Enter** aplica (es pot desfer), **Esc** cancel·la
- **Defenses dels enemics** al back office: abast cos a cos en peus, resistències, resistències a armes no màgiques, vulnerabilitats i immunitats (botons per tipus de dany). Immune → 0, resistent → la meitat, vulnerable → el doble; resistent i vulnerable alhora es compensen
- L'atac dels enemics al mapa fa servir el seu abast de la BD
- Les defenses no s'envien a les pantalles de jugador
- Els enemics que ja eren al mapa abans d'aquesta versió no tenen defenses: cal tornar-los a afegir de la biblioteca
- **Canvis a la API**: camps nous a `/enemies` (`reachFt`, `resistances`, `vulnerabilities`, `immunities`, `nonMagicResistances`). Veure `api-spec.txt`

### v4.99 — Terreny difícil i atacs amb abast al menú del token
- **Terreny difícil** (eina nova al mode Preparar, tecla `8`): pinta caselles de la graella amb el clic (el dret esborra), també sobre mapes d'imatge. Es veuen ratllades a totes les pantalles i costen el **doble** de moviment: el rang groc del jugador i la validació del DM ho tenen en compte. Es desa amb la partida
- **Atacs al menú del token**: secció «Atacs» amb les armes de la fitxa (es llegeixen soles del text «Atacs», o s'editen al back office). En triar-ne una, el mapa mostra l'anell de l'abast (i de l'abast llarg) i la distància de **vora a vora** fins al token sota el cursor: verd dins, ambre a l'abast llarg (desavantatge), vermell fora. Només avisa: el clic sempre s'accepta
- Els enemics, de moment, tenen un «Cos a cos» de 5 ft (l'abast propi arribarà amb la API)
- **Back office**: editor d'atacs a la fitxa (nom, tipus, abast, distància, bonus, dany i tipus de dany)
- Sense canvis a la API

### v4.98 — L'abast de les màgies és un avís, no un límit
- **Abast com a avís**: apuntant una màgia des del grimori, si el cursor és fora d'abast el cercle, la línia, l'àrea i l'etiqueta passen a **vermell**, però el clic llança igualment (abans la punta es tallava a l'abast)
- **Token assenyalat**: amb el cursor sobre un token, s'hi dibuixa un anell (verd dins d'abast, vermell fora) amb els peus fins a la seva **vora**; només ho veu el DM
- Distàncies de vora a vora (`lib/rules/reach.ts`); la mida del token és el seu radi, sense categories
- Sense canvis a la API

### v4.97 — La mà de Jaume es mou i les parets només amb l'eina
- **Jaume III**: el guant puja i baixa amb la destral, com la mà del bàrbar (abans la destral es movia i la mà no)
- **Arreglat**: les línies daurades de les parets i els punts grocs dels vèrtexs es veien sempre al DM; ara només surten amb l'eina Parets (o col·locant una porta). Les portes es continuen veient per obrir-les i tancar-les jugant
- Sense canvis a la API

### v4.96 — Destral animada, noms i vida iguals per a tothom i miniatures als enemics
- **Jaume III**: la destral puja i baixa com la del bàrbar (abans es quedava quieta)
- **Noms al mapa**: els enemics i aliats fan servir la mateixa lletra, mida i fons que les DIVAS (només canvia el color)
- **Vida al mapa (DM)**: les DIVAS ara tenen la mateixa barra que els enemics, gruixuda i amb els punts a dins
- **Lateral (Escena)**: enemics i aliats amb miniatura com les DIVAS (figureta, imatge o inicials amb la vora del seu color); fora el puntet de color, i l'ull just al costat de la miniatura
- Sense canvis a la API

### v4.95 — Figuretes noves de la colla i ventall amb pulsació llarga
- **Jaume III**: templari vermell amb la destral del bàrbar (figureta nova, editada a partir de les dues del paquet)
- **Espardeny**: guerrer amb la roba verda del color del seu halo (figureta nova)
- **Liriandor**: mag blau · **Cigarramic**: lladre mitjà lila (variant 3) · Yunquerin es queda igual
- Les partides desades amb les figuretes d'abans passen a les noves en carregar-se (si no se n'havia triat una altra)
- **Pantalla de jugador**: mantenir premut un munt de tokens obre el ventall dels apilats per poder agafar el de sota; un toc fora el tanca. Només hi entren tokens de jugador (no delata enemics amagats)
- El toc agafa el token més proper al dit, no el primer de la llista
- Sense canvis a la API

### v4.94 — Fora Cony Cirera i el sistema de missions
- Eliminat tot el que era de **Cony Cirera**: el mapa de la missió, les cases (farga, batlle, graner, rectoria, capella, hostal…), el full de poble i els scripts que els generaven
- Eliminat el **sistema de missions** (menú «Missions», botó de la benvinguda, entrar a les cases amb fos a negre, menú de llocs) i l'**ajust de color de les figuretes** («Figuretes a to amb el mapa»)
- Fora els dos **mòduls d'exemple** del panell Història i el camp `map` dels mòduls (apuntava a una missió)
- Es manté la demo de la taverna i el tauler de missions de la wiki (ara sense apuntar a cap lloc)
- Les partides desades amb missió es poden seguir carregant: els camps que ja no existeixen s'ignoren
- Sense canvis a la API

### v4.93 — Mode Fòsfor: paleta DB32 per proximitat
- La paleta del mode Fòsfor ara és la **DawnBringer 32** (DB32): 32 colors pensats per a pixel art que lliguen entre ells (rampes de pell, terra, verds, blaus i grisos)
- Cada color del mapa passa al **color més proper** de la paleta, mesurat en OKLab (com ho veu l'ull). Fora les regles per famílies de la v4.92, que ho tornaven tot verd, taronja i blau: ara el camí continua sent sorra, la pedra grisa, la fusta marró i les teulades vermelles
- Sense canvis a la API

### v4.92 — Mode Fòsfor: les pantalles de jugador com una TV de tub antiga
- **Mode Fòsfor**: interruptor al menú **Pantalles** del DM. Totes les pantalles de jugador s'apaguen com una TV (la imatge s'aplana en una ratlla blanca) i s'engeguen amb l'aspecte d'un monitor de tub: paleta de 16 colors (buit negre, terra verd, parets crema i taronja, aigua blava), pantalla corbada, línies d'escombrat, punts de fòsfor RGB, halo dels colors brillants i un parpelleig lleuger
- A la resolució real de la pantalla: **no es redueixen els píxels**, el detall del mapa i de les figuretes es conserva
- Rètols, fitxes, diàlegs i l'Expositor queden «dins del vidre»: línies fines i cantonades fosques per sobre
- El DM continua veient el mapa normal. El mateix interruptor el torna a apagar (amb la mateixa animació) i el navegador del DM el recorda
- Sense canvis a la API: el camp `phosphor` viatja dins del STATE i del STRUCT, que ja es reenvien opacs

### v4.91 — Mapa de caselles: portes tancades i parets que no es travessen
- Als mapes de caselles (Píxel), el jugador ja **no pot passar per una porta tancada ni quedar-se a sobre de la seva casella**, ni posar-se **a sobre d'una paret** o al buit (fora del terra). El rang groc ja no hi arriba i el DM rebutja el moviment amb la mateixa regla
- Causa: el tram de la porta passa pel centre de la seva casella i el pas de casella a casella només el tocava a l'extrem (no comptava com a creuar-lo); i pel costat del buit les parets no tenen vora
- Oberta, la porta es pot travessar i s'hi pot estar, com sempre

### v4.90 — Halos: ordre de dins a fora i color més saturat
- Els halos es pinten de dins a fora: estats, color i selecció, cadascun per sobre de l'anterior (abans l'anell dels estats tapava el de color); els isotips dels estats, damunt de tot
- El halo de color del token té +15 % de saturació
- Sense canvis a la API

### v4.89 — Sense fil negre al jugador, portes seguides i fora les portes dobles
- **Fil negre arran de paret, del tot fora** a la pantalla de jugador: la llum del token s'aturava un píxel abans de la vora de la seva sala (per no vessar a la del costat) i aquell píxel quedava mig fosc. Ara la sala pròpia s'il·lumina sencera fins a la paret, sense tocar cap altra sala
- **Portes horitzontals seguides**: el tram de mur entre dues portes ja no surt com un pilar solt (més estret i amb una altra cara), sinó com la resta del mur
- **Fora les portes laterals dobles** (v4.88): cada casella torna a ser una porta normal

### v4.88 — Portes Píxel sempre visibles, portes laterals dobles i sense vora negra
- **Sense vora negra a la sala il·luminada**: la foscor de les sales ja no s'eixampla amb un contorn cap enfora; quedava un fil negre arran de paret encara que el token hi veiés. Ara totes les sales del mateix to es farceixen en un sol camí (tampoc no hi queda cap fil entre sales veïnes)
- **Les portes del mapa de caselles es veuen sempre**, com les parets: es tornen a pintar per sobre de la foscor (abans la sala fosca en tapava mitja porta, o tota)
- **Portes laterals dobles**: dues portes laterals una sota l'altra són una sola porta doble (un clic l'obre sencera). Oberta: la fulla de dalt i, de la de baix, la part de dalt que treu el cap per sobre del mur. Tancada: el muntant de cada fulla
- La cara del mur just a sobre d'una porta lateral és sempre la llisa (l'estendard o la calavera quedaven tapats a mitges per la porta)

### v4.87 — Desfer i refer de tot, sales d'un clic i portes Píxel com al paquet
- **Desfer / refer únic**: una sola pila d'accions (màx. 100). A més del dibuix i dels canvis del mapa, ara es desfan moure tokens el DM (un arrossegament = una entrada, també en grup), PV (clics seguits s'agrupen), estats, derrotat, mida, visibilitat, **eliminar un jugador o un enemic** (torna on era, també a la iniciativa), obrir/tancar portes, revelar/amagar i marcar fosca una sala, moure llums i el seu radi, i les zones màgiques
- **Refer**: Ctrl+Maj+Z o Ctrl+Y, i un botó al costat de «Desfer»; tots dos diuen què faran
- La càmera no entra mai a la pila. El jugador rep sempre l'estat resultant: provat desfent 21 accions fins a l'inici i refent-les fins al final, amb el DM i la pantalla de jugador idèntics
- Desfer una paret ja no torna a amagar una sala revelada després ni tanca una porta oberta després
- **Sales**: clic a la sala fosca ressaltada la revela o la torna a amagar d'un sol gest (abans amagar-la demanava el mode Maj); els tokens i les portes de dins tenen prioritat
- **Portes Píxel** col·locades com als mapes d'exemple del paquet: la porta lateral deixa la vora del tram de baix (el muntant ja no sura a mitja obertura), la porta horitzontal fa ombra a sota, i en un mur de dues files la porta va a la fila de baix amb el pas obert a les dues (abans hi sortia una sala fantasma)

### v4.86 — Biblioteca: sempre dues columnes
- Els tokens del bestiari amb nom llarg ja no ocupen dues caselles: la graella és sempre de dues columnes i el nom s'escurça amb «…» (sencer en passar-hi per sobre)

### v4.85 — Torn: halo de color més gruixut i una mica més viu
- Quan el token té el torn o es ressalta, el halo de color es queda al seu lloc: línia més gruixuda, color una mica més saturat i lluminós, i un vel del mateix color per sota que respira (abans quedava tapat per la selecció)
- Sense canvis a la API

### v4.84 — Torn: el mateix efecte que l'aro daurat
- El halo de color, quan el token té el torn o es ressalta, fa exactament l'efecte que tenia l'aro daurat (vel translúcid que respira i línia més gruixuda), amb el color del token
- Fora el difuminat de la v4.83
- Sense canvis a la API

### v4.83 — Torn i ressaltat amb el halo de color
- Fora l'aro daurat del torn i el groc de «ressaltar enemics»: el halo de color del token fa de distintiu. És sempre igual i, quan el token té el torn o es ressalta, fa un doble resplendor del color del token que respira
- El resplendor va en proporció a la mida del token a la pantalla: no canvia de proporció amb el zoom
- Sense canvis a la API

### v4.82 — Forja de figuretes
- Nova secció **Forja** a la Biblioteca: crea figuretes vestint un maniquí (tres cossos d'home) amb **armadura** (10 jocs: tela, cuir, cuir reblonat, malla, placa, reial, or, sang, místic, salvatge), **casc** (10), **arma** (15, en acer, or, místic o vorpal) i **escut** (4 formes, 8 materials). Previsualització animada, «A l'atzar», nom, vida, XP i aliat
- Les peces són els objectes del paquet redibuixats a l'escala i la densitat de detall de les figuretes; el casc va centrat sobre el cap
- «Afegir a l'escena» o «Desar»: les desades surten al bestiari, al grup Forja
- **Equipament**: al menú del clic dret d'un token de la Forja es pot canviar l'armadura, el casc, l'arma i l'escut; la resta de tokens tenen «Equipar a la Forja»
- Es veuen igual al DM i a les pantalles de jugador (la recepta viatja dins del nom de la figureta; res de la API), amb animació, ajust de color de les missions, estats i gris de derrotat
- `scripts/forja-preview.py` per previsualitzar i retocar les peces

### v4.81 — Lot Dades: contrasenya de la web i un sol bestiari
- **Contrasenya de la web**: tota la web (DM, back office, Expositor) demana una contrasenya; la **pantalla de jugador** (`/player`, també dins de la wiki) no. Viu al servidor de Next, no a la API: funciona encara que la API estigui apagada. Es configura a Vercel amb `SITE_PASSWORD` (i `SITE_SECRET`); sense, la porta queda oberta (ús local). Pàgina nova `/login`, cookie httpOnly de 30 dies
- `middleware.ts` → `proxy.ts` (nom nou de Next 16); el back office segueix demanant el login de la API a més de la contrasenya
- **Biblioteca: un sol bestiari**. Desapareix la secció «Base de dades»: els enemics de la BD surten dins d'**Enemics**, barrejats per projecte i amb la icona de la base de dades. Sense connexió amb la API simplement no hi són. Els noms llargs ocupen la fila sencera
- Nou `docs/millores.md` (apartat «Dades»): decisions, opcions per fer tokens nous amb els sprites (variants de color, equipament, retrat) i esborrany dels prompts de la API
- `api-spec.txt`: documentat `POST /auth/login` i afegida la proposta pendent (camps `role`/`sprite`/`notes` a Enemy, seguretat de la API)

### v4.80 — Tokens: halos en carrils, peus més avall, ventall amb espera
- **Halos**: tornen a ser tres anells (estats, color i la selecció blava discontínua de sempre) i cadascun té el seu carril a la mateixa distància de l'ombra per tot arreu (a l'app Píxel, l'el·lipse de l'ombra eixamplada, no escalada): ja no s'encavalquen
- A l'app Píxel, els peus, l'ombra i els halos van una mica per sota del centre de la casella
- Canviar la mida d'un jugador ja no el fa saltar un moment a la pantalla de jugador
- Tokens apilats: el ventall s'obre després de 0,4 s amb el cursor a sobre, i el token assenyalat creix una mica i passa a sobre
- Menú del token: Dades, Conjurs, Estats, Parla i Nivell
- Sense canvis a la API

### v4.79 — Tokens: halos, centre, apilats i menú al costat
- **Halos amb jerarquia**: estats = anell segmentat per dins; color = línia fina contínua per fora; torn = aro daurat que respira; **selecció = claudàtors cian** a les cantonades de tot el token (l'únic que no és un anell i es pinta a sobre de la figura)
- **Centre**: a l'app Píxel l'ombra i l'aro de color van al centre de la casella i la figura els trepitja, centrada pel contingut real de cada sprite (capsa alfa, sense valors per token). L'ombra dels discos és concèntrica
- `sizeAllTokens` (i apagar «Mida» a la graella) recentren els jugadors en canviar-los el radi
- **Un sol hit-test** (`render/token-geom.ts`) en l'ordre en què es pinten: el seleccionat queda a sobre i és el que es clica; la base del token té prioritat sobre el cap d'una figura veïna
- **Tokens apilats**: amb el cursor a sobre (centres a menys de mitja casella, `TOKEN_STACK_TOL`) s'obren en ventall amb una animació curta i tornen al seu lloc en sortir. Offset només visual
- **Menú del token** al costat del token (dreta o esquerra), centrat verticalment i dins la pantalla; contingut reordenat: vida, estats, conjurs i parlar a dalt, la fitxa a baix
- Sense canvis a la API

### v4.78 — Menú principal, rail de la dreta, icones i menys text
- **Menú ☰**: «Vista» i «⋯» s'uneixen en un sol menú pla (Vista · App · Ajuda). La barra passa de 4 menús a 3 (Pantalles, Partida, ☰)
- **Rail de la dreta**: «Mostrar als jugadors» i «Història» surten de la barra i passen a una columna d'icones a la dreta del mapa (punt verd si s'està mostrant res). El panell d'Història li deixa lloc
- **Icones noves** perquè cap concepte en comparteixi: Història (pergamí), Preparar (martell), Mostrar (faristol), Missions (bandera), Base de dades, Back office (tauler), menú (hamburguesa); Enemics → calavera i Aliats → escut a l'Escena; Desar ara → disquet; Importar mapa → imatge
- **Menys text tutorial**: eliminats o passats a tooltip els textos explicatius de la benvinguda, Biblioteca, Jugadors, Enemics, Sales, Mapa de caselles, paleta, diàleg, diari, mòduls, menús de Pantalles/Partida/Vista i Llocs. Els buits diuen només «Cap jugador», «Cap enemic», «Cap sala»

### v4.77 — Polit d'UI: Bestiari, DIVAS i botons de mida estable
- **Bestiari**: la graella de plantilles era `1fr 1fr` i la columna no baixava de la mida del nom més llarg: «Castell de la Fumarola» sortia del lateral (tallat) i era més ample que el Bestiari. Ara `minmax(0, 1fr)`: les dues seccions fan la mateixa mida i els noms llargs porten punts suspensius
- «**Party**» i «**la colla**» passen a «**DIVAS**» en tot el text visible (botó del panell de jugadors, tooltips, missions, cinemàtica Versus, back office). Els noms interns (`loadParty`, `DEFAULT_PARTY`, `party`) no canvien
- **Botons de la barra de mida estable**: Partida diu sempre «Partida» (estat amb icona ✓ / ⚠ / disquet + punt d'avís; el «Desat fa 2 min» va al tooltip), Pantalles diu sempre «Pantalles» (recompte al tooltip), Desfer ja no allarga el botó amb el nom de l'acció (és al tooltip) i els punts d'estat reserven el seu lloc
- Nou `docs/millores.md` amb el checklist del lot A

### v4.76 — Mòduls d'exemple
- Botó **Exemples** a Història → Mòduls: importa dos mòduls de prova encadenats (*Les runes de Cony Cirera* → *L'Àgata (exemple)*) que fan servir tots els camps: textos per llegir, enemics (per plantilla, per figureta Oryx i genèric), PNJ, un diàleg amb opcions, sortides amb enllaç a un altre mòdul i al mapa de Cony Cirera (poble i Capella enrunada)
- El paquet és a `public/modules/exemples.json` (abans, `docs/exemples/`)

### v4.75 — Història: mòduls i diari de la sessió
- Nou botó **Història** a la barra superior i panell a la dreta del mapa (DM-only, no es sincronitza): pestanyes **Mòdul**, **Mòduls** i **Diari**
- **Mòduls**: paquets JSON que reflecteixen les pàgines de la base MÒDULS de Notion (disparador, escena, textos per llegir, enemics, PNJ, diàlegs, sortides, notes del DM). Es generen des de Notion (a mà o amb Claude) i s'importen per fitxer o enganxant el JSON. Des del mòdul actiu: **Llegir** (deixa el text al Revelador), **Col·locar** enemics (a la biblioteca de l'escena, amb la seva figureta), **Parlar** (diàleg amb el repartiment automàtic), **Obrir** el mapa, **Anar-hi** (sortida: acaba el mòdul i obre el següent) i **Marcar com a jugat**
- **Diari de la sessió**: anota sol, amb l'hora, les escenes, els combats (inici, rondes i derrotats), l'XP repartida, els diàlegs, les cinemàtiques, els textos als jugadors, les sales revelades, els jugadors que cauen, els mapes i els mòduls. **Tecla N** = nota ràpida. Resum en markdown (cronologia, mòduls, combats, XP, notes) amb un bloc JSON per a Claude: copiar o descarregar, i **Tancar la sessió** l'arxiva
- **Anteriorment…**: marca amb ★ el que vols recordar i deixa el recap al Revelador de text
- Els mòduls i el diari viuen a `localStorage` **fora de la partida** (una nit passa per diversos mapes): `lib/localStore.ts`, `lib/modules.ts`, `lib/journal.ts`. Paquet d'exemple a `docs/exemples/` i guia completa a `docs/historia-i-moduls.md`
- Sense canvis a la API (la sincronització entre dispositius queda com a proposta documentada)

### v4.74 — Un sol bloc d'enemics i aliats a part
- La Biblioteca té un sol bloc «Bestiari» (plantilles + Oryx, per ordre alfabètic): les criatures Oryx que ja són una plantilla (Drac = `dragon_red`, Rata = `rat_giant`, Goblin, Llop, Trol…) deixen de sortir repetides. Els enemics del Castell de la Fumarola, a dalt
- Nou `ally` (plantilla i `LibEnemy`): Sildar, Gota i Roc surten a una secció «Aliats» a la Biblioteca i a l'Escena, a part d'«Enemics». El «ressaltar enemics» no els marca i no donen XP

### v4.73 — Bestiari i plantilles unificats + Castell de la Fumarola
- Un sol catàleg a `lib/bestiary.ts` (`EnemyTemplate`): les plantilles de `ENEMY_TEMPLATES` i el Bestiari Oryx surten a la mateixa secció «Bestiari» de la Biblioteca, amb una sola cerca i grups (Castell de la Fumarola, Aliats, Plantilles, Bestiari Oryx). Les criatures Oryx que repetirien una plantilla (mateixa figureta i vida) no es dupliquen
- Un sol camí d'alta: `addLibEnemy` accepta qualsevol entrada; fora `addOryxCreature`. `sizeAllTokens` troba la mida també de les criatures `oryx_*` (`findTemplate`)
- Tokens nous (Notion, base de dades de campanya): Goblin Bocapeñasco, Hobgoblin, Yegg, Lhupo, Grick, Os mussol captiu, Snarl, Rei Jalil i Vyerith; aliats Sildar Flocdeneu, Gota i Roc Cercarocs (XP 0)
- Sense canvis a la API

### v4.72 — DMView més petit
- La pantalla de benvinguda surt de `DMView` a un component propi (`WelcomeScreen`), amb els seus camps de fitxer
- Netejats imports i referències sense ús a `DMView` i `useDMActions`

### v4.71 — Fora el PSD
- L'app ja no importa PSD: el mapa és una imatge o un vídeo i tot el que hi va a sobre (graella, parets, sales, portes, llums, tokens, dibuix, màgies, torns) es fa dins l'app
- Eliminats el parser i l'extractor de PSD, l'arbre de capes, el panell «Capes del PSD», els enemics i les zones/extres que venien del PSD, l'ull de visibilitat de capes (`vis`) i `demo.psd`
- La demo carrega només el mapa de fons (sense els enemics del PSD)
- El `STRUCT` ja no porta `struct`, `vis`, `psdInfo` ni `layerImageUrls`: porta `mapSize`. Les partides desades amb PSD es carreguen igualment (aquests camps s'ignoren i es conserva la mida del mapa)
- Documentació actualitzada

### v4.70 — Una barra més senzilla
- L'interruptor Clàssica · Píxel surt de la barra superior i passa al menú ⋯ (a la mateixa mida que al mòbil); queda un sol interruptor gran, Preparar · Jugar
- La pantalla de benvinguda explica el recorregut en 3 passos i ofereix el canvi d'app com a enllaç

### v4.69 — Documentació ordenada
- `README.md` curt per a qui arriba de nou: què és, com s'engega, les pantalles i un primer ús en 5 passos
- L'historial de versions passa a `CHANGELOG.md`
- `CLAUDE.md` queda només amb les regles i un índex; la documentació tècnica es reparteix per àrea a `docs/`

### v4.68 — Fitxes sense connexió, vida real i XP del bestiari
- **Fitxes sense connexió**: les fitxes es desen en aquest ordinador. Sense back office (o sense el Mac mini engegat) es poden consultar, mostrar als jugadors, donar experiència i pujar de nivell igual; els canvis queden en una cua i es pugen sols quan et connectes (cada 30 s, en tornar a la pestanya o quan torna la xarxa). Si mai no t'havies connectat, es fan servir les fitxes de Notion i es creen al servidor la primera vegada. L'experiència no es compta mai dues vegades.
- **Vida real**: la colla per defecte surt amb la vida i la velocitat de les fitxes (Jaume 12, Liriandor 8, Yunquerin 11 i 25 ft, Espardeny 12, Cigarramic 9 i 25 ft) i la vida màxima de cada jugador se sincronitza sola amb la seva fitxa (qui era ple es queda ple). Canviar-la al menú del token també canvia la fitxa.
- **XP i vida del Bestiari Oryx**: cada una de les 130 criatures es juga amb un monstre oficial de D&D 5e (el de La mina perduda de Phandelver quan l'aventura el té: goblins, hobgoblins, espectador, Nezznar, Venomfang, gelatina ocre, estirges…) i en surt amb la vida i l'XP del seu valor de desafiament. Al botó de cada criatura es veu quin monstre és, el VD i l'XP.

### v4.67 — Fitxes de personatge i experiència
- Les fitxes de la colla viuen a la base de dades (API `/characters`). Al back office hi ha una pàgina nova, **Personatges**: crear i editar fitxes (dades, característiques, salvacions i seccions de text), donar o treure experiència amb el motiu, veure'n l'historial, pujar de nivell i importar d'un clic les cinc fitxes de Notion.
- **Experiència automàtica**: cada enemic té la seva XP (les plantilles, la de D&D 5e; els de la BD, el camp nou del back office; qualsevol, al menú del clic dret). En acabar un combat surt «Experiència del combat» amb la XP dels enemics derrotats repartida entre els jugadors: es pot retocar i, en confirmar-la, s'actualitzen les fitxes. La mateixa entrega no es compta mai dues vegades.
- Al menú del clic dret de cada jugador: la seva fitxa, nivell i experiència, «Donar» experiència a mà i «Pujar a nivell N» quan en té prou (taula de D&D 5e).
- Pestanya nova **Fitxa** a «Mostrar als jugadors»: una targeta al costat del mapa, a les pantalles de jugador, amb el nivell, l'experiència, les estadístiques i les parts de la fitxa que triï el DM (característiques, atacs, màgia, equip…).

### v4.66 — El número del cop no delata la vida
- El número que surt damunt de la figureta en rebre un cop és el dany que ha posat el DM, encara que el token en tingués menys: un atac de 6 a un goblin amb 2 de vida surt «-6», no «-2». Abans els jugadors podien deduir quanta vida li quedava.
- El mateix amb les curacions: curar 5 a un token que ja era ple surt «+5» (abans no sortia res, i es veia que estava al màxim).
- Sense camps nous de sincronització ni canvis a la API: l'últim canvi de vida viatja dins del mateix token (`hpHit`).

### v4.65 — Màgies a la mida de la graella
- Els efectes de les màgies (projectils, foc, halos, esclats, espurnes i segells) són més petits i es mesuren per la casella de la graella, a l'app Clàssica i a la Píxel: el projectil màgic feia tres dards tan grossos com les figuretes i un esclat de casella i mitja.
- Les àrees de reglament no canvien: la bola de foc, dormir, greix i la resta continuen marcant exactament on arriben.
- Una sola mida per a tots els efectes (`FX_SIZE` a `render/fxsprites.ts`).

### v4.64 — Noms en negreta
- Tots els noms sota els tokens van en negreta, a la pantalla de jugador i a la del DM (abans només els dels enemics de la biblioteca): a la TV, la lletra prima es perdia damunt del mapa.

### v4.63 — Noms dels tokens que es llegeixen a la TV
- A la **pantalla de jugador** (també la incrustada al tauler de missions de la wiki), el nom sota cada token creix amb la mida de la pantalla: a una TV de 1920 px és gairebé el doble que abans; a una tablet o un mòbil, igual que sempre. A la pantalla del DM no canvia res.
- Els noms ja **no s'encavalquen ni queden tapats** per la figureta de sota quan la colla va junta: es pinten després de totes les figuretes i cadascun va al lloc lliure més proper (a sota, una línia més avall, sobre el cap o una mica de costat), sense saltar mai per sobre d'una altra figureta. Els dels jugadors tenen preferència, i els noms amagats a la foscor no mouen els visibles.

### v4.62 — Cony Cirera calcat del mapa pintat
- El **mapa en píxel de Cony Cirera** es torna a fer a partir del mapa pintat de la wiki, perquè el «match cut» del tauler de missions (l'onada que passa de l'un a l'altre) encaixi: cada cosa és al mateix lloc a tots dos.
- **Menys bosc**: abans s'omplien d'arbres a l'atzar totes les caselles de bosc i el bosc tapava el prat, els murs i els camins. Ara cada arbre, mata o grup d'arbres és on és al pintat (tret de les seves taques d'arbres).
- **Camins** d'una casella d'ample, pel traçat del pintat; **murs de pedra seca** i **tanques** resseguits casella a casella (el mur llarg de l'oest, el de dalt, el de l'est fins a l'hostal, els tancats de la casa del batlle, del graner, del cementiri i del sud).
- Pou, barca, moll, roques del cementiri i taulons (passeres, escales i el portal de fusta) al seu lloc; dos coberts nous (el del tancat del graner i el porxo del cementiri).
- En sortir d'un lloc, la colla surt a les mateixes portes (només canvien algunes de les caselles del costat, que ara són lliures).

### v4.61 — Més mòbil: combat, eines i figuretes
- **Barra de combat** a l'amplada de la pantalla del mòbil, amb botons d'icona (Següent, Ronda, acabar). Mantenir premut un xip recupera el seu torn (com el clic dret).
- **Barra d'eines horitzontal a dalt** al mòbil (ocupa menys i deixa la de baix per al combat); els panells (dibuix, llums…) s'obren a sota i sense finestretes d'ajuda enganxades.
- Mantenir premut un token ja no selecciona text ni obre el menú del sistema.
- El **selector de figureta** (i el de retrat) s'obre a la mida de la pantalla i no obre el teclat sol (abans el teclat desplaçava la pàgina i el menú del personatge semblava moure's).
- Al mòbil, el zoom de la cantonada només mostra el percentatge (la pinça fa el zoom) i «Sortir» del lloc és una icona.

### v4.60 — El DM al mòbil
- **La pantalla del DM s'adapta al mòbil** (provat a la mida d'un iPhone, dret i ajagut): la barra de dalt passa a icones i tots els menús hi caben (Pantalles, Partida, Vista, ⋯), oberts a l'amplada de la pantalla. Des del mòbil ja es pot obrir una pantalla de jugador (Pantalles → «Obrir-ne una en aquest dispositiu») i la missió de Cony Cirera.
- El lateral (jugadors, enemics, biblioteca) és un calaix que s'obre amb el botó de dalt a l'esquerra i es tanca tocant fora.
- **Gestos al mapa**: un dit fa el que feia el ratolí (moure tokens, moure el mapa en buit, dibuixar…), **dos dits** fan zoom i mouen el mapa, **mantenir premut** obre el menú del token (el clic dret) i el **doble toc** entra a les portes dels llocs de la missió.
- El canvi d'app (Clàssica · Píxel) és al menú ⋯ al mòbil.

### v4.59 — Entrar a les cases de Cony Cirera
- **Set llocs on entrar** a la missió de Cony Cirera, els grups de cases marcats al mapa: **Farga vella** (el pati vist de prop, amb l'enclusa rovellada a fora), **Casa del batlle** (sala gran, despatx, cambra, cuina, rebost, magatzem esfondrat i el pati tancat), **Graner** (sostre caigut i bardissa seca… on s'amaguen les plagues de branquetes), **Casa de la taula parada** (un eco de la Gran Guerra), **Rectoria**, **Capella enrunada** (campana caiguda, forat al sostre i cementiri) i **Hostal vell** (barra, cuina, rebost i estables). Contingut tret de la wiki i del Notion.
- **Canvi d'escena amb fos a negre** a totes les pantalles i el nom del lloc al mig (en lletra de píxel). La colla entra sencera (vida, estats, diàlegs) i el combat s'acaba; en sortir, apareix davant de la porta.
- **Menú de llocs** a dalt a l'esquerra del mapa i **marques a les portes** (només les veu el DM): doble clic a la marca per entrar o sortir.
- Cada lloc porta les parets, les portes i les sales amb nom: sales fosques, llum per línia de visió i col·lisions sense dibuixar res. Cada lloc es recorda tal com es va deixar (enemics, dibuix, sales revelades) i es desa a la partida.
- Sense canvis a la API.

### v4.58 — Documentació del tauler de missions
- El `CLAUDE.md` apunta on és ara el codi del tauler a la wiki (`src/missions/pixel.js`) i on es configura.

### v4.57 — El tauler de missions sense API
- **El mapa en píxel de la wiki ja no necessita la API.** Obre el tauler des del visor: menú **Pantalles → «Obrir el tauler de missions»**. El visor i el tauler es passen els missatges directament entre finestres, i la pantalla de dins de la wiki rep la partida igual que una pantalla del mateix ordinador. Funciona amb el visor de Vercel.
- El tauler ja no demana l'adreça del visor: la treu del visor que l'ha obert.

### v4.56 — La pantalla de jugador dins del tauler de missions de la wiki
- **Cony Cirera en píxel des de la wiki.** Al tauler de missions de Cony Cirera, en mode DM, el botó «Mapa en píxel» (o la tecla P) transforma el mapa pintat en el del visor amb una onada de caselles que s'aixequen i giren. Després hi entra la pantalla de jugador en directe, s'eixampla a tota la pantalla i segueix la teva càmera. Esc torna al tauler amb l'onada al revés.
- **Com cal tenir-ho**: el visor obert en mode DM amb la missió de Cony Cirera i la seva API engegada (la pantalla de la wiki s'hi connecta pel WebSocket, com la tauleta). L'adreça del visor es canvia al botó «Visor» del mode DM del tauler (per defecte `http://localhost:3001`).
- **Pantalla incrustada** (`/player?embed=1`): pot ensenyar el mapa sencer mentre la wiki hi fa l'onada i lliscar lent fins a la càmera del DM, i li diu a la wiki si ja té el mapa i com va la connexió.
- La missió «Conyberry» ara es diu **Cony Cirera**, com a la wiki.

### v4.55 — Figuretes que destaquen i graella de la missió
- **Les figuretes destaquen sobre el mapa de Conyberry**: l'ajust de color és més viu (menys apagat que abans) i cada figureta fa una ombra cap a baix a la dreta, com els arbres i les cases. No és cap contorn.
- **La missió obre amb la graella bona**: casella de 48 px (5 ft) visible i, en afegir un enemic de la Biblioteca, surt a la mida de la casella i hi encaixa.
- La partida desa també si els tokens s'ajusten a la mida de la casella (abans es perdia en carregar-la).

### v4.54 — Poble sense contorns i arbres orgànics
- **Res de contorns** a les peces del full de poble (arbres, roques, cases, tanques, murs, pou, barca i moll), com el paquet: la forma la fa el to fosc del seu propi color a la banda de l'ombra. Ara lliguen amb les figuretes.
- **Arbres nous**: grups de fulles repartits a l'atzar, de mides diferents i solapats, amb la textura de fulles de la bardissa del paquet. Ja no és una graella de boles que es veia falsa.
- **Roques** llises com les del paquet, i **teulades** amb teules d'amplada variable i desgast, sense patró de rajola.
- El mapa de la missió de Conyberry s'ha tornat a generar amb les peces noves.

### v4.53 — Missió de Conyberry
- **Missions preparades**: «Missió · Conyberry» a la pantalla de benvinguda i al menú **Partida**. Obre el mapa del poble amb la colla ja col·locada al camí, al sud del pou, i passa a l'app Píxel. És una partida feta: es desa i se sincronitza amb els jugadors com qualsevol altra.
- **Figuretes a to amb el mapa**: en aquest mapa, les figuretes del paquet (molt saturades) es passen pels colors del mapa (menys saturació, to càlid i negres de tinta), al DM i a les pantalles de jugador. Es pot apagar i encendre al menú **Vista** («Figuretes a to amb el mapa»).
- **Arbres nous** al full de poble: grups de fulles rodons amb contorn, llum i plec, al mateix estil de píxel que les figuretes. Els d'abans tenien una textura de soroll fina que no hi lligava. Les roques, igual.
- El mapa es genera amb `scripts/mission-conyberry.py` (disposició escrita a mà dins del script, per anar-la polint) i de moment viu al repositori (`public/missions/conyberry/`).

### v4.52 — Full de poble (primera versió)
- **Generador de textures de poble** (`scripts/oryx-village.py` → `public/sprites/uf_village.png`): amb l'estètica dels mapes pintats de la campanya (Conyberry), en tons apagats d'aquarel·la i tinta, i no amb els verds saturats del paquet. Mateixa mida de píxel que el paquet.
- Conté: prat, herba fosca, camí, còdols i aigua (amb reflexos animats); transicions de vora irregular per al camí, els còdols, l'aigua i l'herba fosca; arbustos, arbres de tres mides i un de molt gran, roques, tanques de fusta i murs de pedra seca (que s'enllacen amb els veïns), moll, pou i barca. Les teulades a dues aigües es dibuixen per rectangle.
- Encara no surt a l'editor de caselles: és la base per fer-hi mapes de poble.

### v4.51 — Curació vermella i cops amb força
- **La curació és vermella, com una poció** (no verda): el flaix i els anells de la figureta, la màgia Curar ferides en píxel (esclat i segell) i també la de l'app Clàssica.
- **La força del cop es nota**, segons la vida perduda respecte de la màxima:
  - **Lleu** (1–2 punts o ≤5%): un sol flaix, un impacte petit i una empenta mínima.
  - **Normal**: dos flaixos i l'impacte de sempre.
  - **Fort** (≥25% de la vida o 15 punts): tres flaixos, la figura tremola, l'impacte gran amb un esclat al darrere i gotes de sang, i l'envestida de qui ataca és més llarga.
- **Número que puja** sobre la figura: «−N» blanc (lleu), groc (normal) o vermell i gros (fort), i «+N» vermell clar per a les curacions. Fet amb la lletra de píxel del paquet.

### v4.50 — Temes de masmorra i cops a les figuretes
- **Temes de masmorra** per al mapa de caselles (app Píxel): **Gel**, **Volcà**, **Cripta de molsa** i **Temple daurat**. Cada tema té un joc de paret (amb pilar i portes) i un terra que es trien a la paleta com els de sempre.
  - Són els jocs de l'autor recolorits per lluminositat, de manera que la textura i les ombres es conserven.
  - Les juntes del terra fan de gebre, de brases o d'or segons el tema.
  - Les portes, els estendards i les calaveres no canvien.
- **Cops a les figuretes**, deduïts de la vida (sense canvis de sincronització; es veuen igual a totes les pantalles):
  - **Cop rebut**: quan a un token li baixa la vida, la figura fa dos flaixos blancs, rep una petita empenta i hi surt l'impacte del full d'efectes.
  - **Atac**: en combat, el token que té el torn s'inclina i fa una envestida cap a qui ha rebut el cop. L'impacte depèn de qui ataca: arc d'espasa (jugadors), tall (gent armada), urpada (animals i monstres) o cop (gòlems, elementals…).
  - **Curació**: si la vida puja, la figura fa un flaix verd suau amb els anells de curar.
- **Esclats nous** a les màgies en píxel: arcà (projectil màgic, raig màgic), llamp (raig elèctric, contacte electritzant), radiant (flama sagrada) i encantament (encisar persona, riure horrible), amb els mateixos colors que els efectes de sempre.

### v4.49 — Menús del clic dret flotants
- Els menús del clic dret (token, selecció múltiple, sala, zona màgica) es poden arrossegar pel mànec de sis punts de la capçalera o per qualsevol tros buit d'aquesta.
- Un cop moguts, són **flotants**: es queden oberts on els has deixat mentre treballes al mapa (un clic fora no els tanca). Si fas clic dret a un altre token, el menú canvia al nou token al mateix lloc. El mànec i la vora es tornen daurats per indicar-ho.
- ✕ o Esc el tanquen del tot, i el pròxim torna a obrir-se al costat del cursor.

### v4.48 — Els aros dels peus, sota la figureta
- A l'app Píxel, l'anell dels estats es pintava per sobre de la figureta i li tapava els peus (i la figura estirada). Passava igual amb l'aro del torn, el de ressaltar enemics i el de selecció. Ara tots van per sota de la figura, i només els badges dels estats i la creu de derrotat queden a sobre.

### v4.47 — Els estats es veuen a la figureta
- A l'app Píxel, la figureta del token també mostra els estats que té (els badges i l'anell continuen dient quins són):
  - **Tombat, Inconscient i Morint**: estirada a terra. Inconscient i Morint, a més, no es mouen.
  - **Petrificat**: de pedra i quieta.
  - **Enverinat**: batec verd. **Morint**: batec vermell.
  - **Paralitzat** i **Encisat**: contorn del color de l'estat (groc i rosa) que batega.
  - **Agafat, Retingut i Incapacitat**: deixa de fer l'animació d'espera.
  - **Atordit**: es balanceja. **Espantat**: tremola. **Cansament**: respira a mig ritme.
- Amb la figura estirada, els badges dels estats baixen fins a ella. Amb «reduir el moviment» del sistema, res no tremola ni balla.
- Es veu igual al DM i a les pantalles de jugador (els estats ja hi arribaven): sense canvis a la API.

### v4.46 — Variants de color amb criteri
- Fora la paleta lliure de la v4.45: amb colors a l'atzar sortien espases roses, ocells d'un sol color i soldats empastats.
- Ara cada figureta té **dues variants fetes amb criteri** (122 de les 130 criatures), i al menú del clic dret del token es tria entre l'original i les variants, en miniatura.
- Només canvia la roba (capa, túnica, caputxa, plomall) o el cos dels monstres i dels animals. Armes, armadures, pell, cabells, barbes, cuir i ribets daurats es queden com són, perquè les parts continuïn distingint-se.
- Colors segons la criatura: roba en colors heràldics, animals en colors naturals (rata grisa, serp marró, falcó gris), monstres en colors de fantasia, i res de rosa. També hi ha triats a mà alguns casos: dracs d'or, negre, plata, bronze i coure; goblins i trolls amb pell olivàcia o rogenca; bàrbars i presoners amb tons de pell; i el mímic de plata.
- Les variants són dos fulls nous a `public/sprites/` (`uf_heroes_v1.png` i `uf_heroes_v2.png`), generats amb `scripts/oryx-variants.py`. Una figureta recolorida amb la v4.45 torna a l'original.

### v4.45 — Figuretes de colors
- **Recolor de figuretes** (app Píxel): al menú del clic dret d'un token, sota «Canviar la figureta», hi ha una mostra per cada color de la criatura (túnica, ribet, pell, armadura…). Se'n clica una i es tria el color nou d'una paleta de 12. Així es poden fer tres goblins de colors diferents, un mag de foc o un esquelet negre amb una sola figureta.
- El canvi es fa sobre les rampes de color de l'autor, conservant ombres i llums: sembla dibuixat així. Els grisos (armadures, ossos) també es poden tenyir. «Original» ho desfà.
- Surt a tot arreu on surt la figureta: mapa (DM i jugadors), lateral, barra de torns, rètol del jugador, diàlegs i cinemàtiques. Es desa amb la partida. Sense canvis a la API.

### v4.44 — Cinemàtiques de boss en grup i amb missatge propi
- **Cinemàtiques de grup**: al selector de la cinemàtica es poden triar fins a quatre enemics més de l'escena que entren amb el boss (de costat i una mica enrere; a «Apareix un monstre», en fila com a Dragon Quest). El missatge els anomena tots.
- **Missatge propi**: les cinemàtiques que tenen text deixen escriure'n un altre (`{nom}` = el nom de l'enemic o del grup).
- *Encontre salvatge*: figures més grans, com al joc, i la barra de vida amb els extrems bons (agafava un tros de la peça del costat).
- *Repte del líder*: el boss més gran i la cinemàtica més llarga.
- *Apareix un monstre*: ara es juga un tros de torn. El cursor tria MÀGIA, repassa les màgies, torna enrere i tria LLUITAR, i el boss ni s'immuta amb l'atac. Sense jugadors no surt la barra de dalt, els noms i les figuretes van centrats i la fletxa de «continua» és al marge de baix a l'esquerra.
- *Vidre trencat* passa a ser **Mirall trencat**: dos cops esquerden el mapa, el vidre esclata cap a la càmera i el boss el travessa (res de les finestres de Final Fantasy).
- *Versus*: enemics més grans. *Rètol del boss*: el boss ja no queda enganxat a terra.
- Lletra: coma i punt bons (la coma perdia la cua i el full no té punt).

### v4.43 — Res no falla en silenci, i el dibuix deixa de créixer sense fre
- Recuperada i fusionada una branca de la v4.15 que s'havia quedat penjada fora del `master`.
- **El fons ja diu quan no es pot obrir**: amb un fitxer malmès o un còdec no admès, l'app es donava el mapa per carregat amb la pantalla negra. Ara es reverteix i es diu què passa. Es valida el tipus (només imatge o vídeo) i la mida (màxim 256 MB, avís a partir de 40 MB).
- **Avisos a la pantalla**: una partida corrupta, un `.json` que no és una partida o la demo sense connexió ara surten com a avís a dalt de l'escenari, en lloc de quedar-se a la consola.
- **El desat automàtic avisa quan no pot escriure** (espai ple, finestra privada): el botó Partida diu «No es pot desar» amb un punt vermell i surt un avís, un sol cop per ratxa.
- **L'historial de dibuix ja no creix sense límit**: es conserven els últims 120 traços i els més antics es rasteritzen a una base. El dibuix es veu igual, però el `STRUCT`, el desfer i el desat automàtic deixen de créixer en una sessió llarga.
- **Fuites de memòria**: es revoca l'object URL del fons anterior i el de la imatge triada per a un token (que ara també diu quan no es pot obrir).
- `/expositor` passa a dir-se **visor local** i explica que no està connectat amb el DM.
- Codi mort fora: `doorPlacementAt`, `rDoorWidthCells` i la còpia d'`unpackBits` del parser de PSD.

### v4.42 — Diàlegs de personatges
- **Pestanya «Diàleg»** al panell «Mostrar als jugadors»: guió en format teatre (`Nom: text`), cada nom relacionat amb el token que es diu igual (es pot canviar), estil i càmera per línia, opcions de resposta amb etiquetes i velocitat.
- **Escena**: barres negres, càmera que s'acosta a qui parla (o enquadra els dos que parlen) i caixa amb retrat, nom i text que apareix lletra a lletra. App Píxel amb la finestra i la lletra del paquet (accents catalans compostos); Clàssica amb EB Garamond i el retrat o les inicials.
- **Globus en combat** sobre el token (clic dret → Parlar), sense barres ni càmera i sense tocar els torns.
- Diàlegs desats al token (partida i desat automàtic), llançables des del clic dret i encadenables després de la cinemàtica de boss.
- Espai/→ avança (primer completa la línia), ← enrere, 1…9 tria l'opció, Esc acaba a totes les pantalles. El DM veu la línia següent.
- No revela posicions: qui és invisible, amagat o dins d'una sala fosca parla com a veu, sense retrat ni càmera. Derrotat → retrat en grisos.
- Viatja com a camp lleuger `dialog` del STATE/STRUCT (sense canvis a la API): la tablet que entra a mitja conversa veu la línia d'ara.

### v4.41 — Deu cinemàtiques de boss en pixel art
- **Es pot triar la cinemàtica**: el botó «Cinemàtica» del menú d'un token obre un selector amb «La de sempre» i deu de noves en pixel art, inspirades en entrades de boss de jocs retro: *Encontre salvatge* (Pokémon), *Repte del líder*, *Apareix un monstre* (Dragon Quest), *Vidre trencat* (Final Fantasy), *Portal del temps* (Chrono Trigger), *Fons psicodèlic* (EarthBound), *WARNING* (Mega Man), *Versus* (Street Fighter), *Rètol del boss* (Zelda) i *L'ombra* (Souls).
- Fan servir el material del paquet Oryx: la figureta del token (o la seva imatge si no en té), la colla amb les seves figuretes, la lletra, les finestres i les barres de vida del full d'interfície i els efectes.
- **«Veure-la»**: la reprodueix només a la pantalla del DM abans de llançar-la. L'última triada es recorda.

### v4.40 — Sprites inclosos a l'app
- **Els fulls del paquet Oryx venen amb l'app** (`public/sprites/`, PNG optimitzats sense pèrdua: de 970 KB a 414 KB amb els mateixos píxels). El DM i totes les pantalles de jugador els carreguen sols; ja no cal carregar el `.zip`.
- El paquet ja no viatja per WebSocket (`spritePack`, `packId`) ni es desa a IndexedDB; fora la importació per `.zip`.
- Si l'app es publica dins d'una subcarpeta, `NEXT_PUBLIC_BASE_PATH` en fixa la base (també per als sprites).

### v4.39 — App Píxel: correccions
- **Parets com les de l'autor**: la paret de baix d'una sala fa la mateixa cara que la de dalt. La regla s'ha comprovat casella a casella contra els cinc mapes d'exemple del paquet.
- **Portes laterals** amb les peces bones: tancada, la porta vista de cantell; oberta, la fulla girada contra la paret.
- **Figures**: animació d'espera de l'autor (1-2-3-2, sense la sotragada que feia la pantalla tan moguda) i, derrotades, es queden dretes en grisos en lloc de tombar-se.
- **Estats, torn, selecció i ressaltat** en aureoles en perspectiva als peus de la figura, com l'ombra; els badges dels estats van sobre el cap.
- **Les màgies ja no surten dues vegades** a la pantalla de jugador (arribaven pel canal local i per la API).
- El paquet de sprites només s'envia a la pantalla que no el té (abans, 1,3 MB a cada reconnexió i a cada canvi d'app).
- **Ressaltar enemics** torna a sortir al menú Vista amb qualsevol mapa (amb els mapes de caselles havia desaparegut).
- **Cinemàtica de boss amb la figureta** del token, ampliada en pixel art.
- **Retrats**: clic a l'avatar d'un jugador al lateral per fer-li'n un.

### v4.38 — App Píxel: sprites, mapes de caselles i Tiled
- **Botó «Clàssica · Píxel»** a la barra superior: canvia d'«app». La Píxel fa servir el paquet de sprites Oryx a tot arreu i ho propaga a les pantalles de jugador; la Clàssica és la de sempre.
- **Tokens amb figureta animada** (130 criatures, 4 fotogrames): base de color de l'equip, giren cap on es mouen i cauen en grisos en ser derrotats. Figureta per defecte per a la party i les plantilles; es canvia al menú del clic dret.
- **Editor de mapes per caselles** (eina **Caselles**, tecla 7, mode Preparar): sales d'un rectangle (terra + paret), 16 terres, 6 jocs de paret que s'ajusten sols, portes, aigua i lava animades, mobles, torxes, botí i el mapa del món. **Les parets pintades fan de parets de veritat**: sales fosques, llum, boira i col·lisions sense dibuixar res a mà; les portes s'obren i es tanquen amb un clic i les torxes fan llum.
- **Importar mapes de Tiled (.tmx)**, com els d'exemple del paquet: terra, parets, objectes i les criatures com a tokens.
- **Retrats** dels jugadors: 36 de fets o compostos per peces (cap, roba, cabell, barba, caputxa…). Surten al lateral, a la barra de torns i al rètol.
- **Màgies en píxel** (projectils, esclats i segells del paquet) i **rètol de torn en píxel** a les pantalles de jugador.
- **Bestiari Oryx** a la Biblioteca: qualsevol de les 130 criatures com a enemic.
- Els sprites **no van al repositori** (llicència): es carreguen del `.zip` original o d'una carpeta local que Git ignora.

> **Numeració:** `vMAJOR.MM`, amb **dos dígits** a la part petita (`v4.09`, `v4.10`, …
> `v4.99`) i increments de +0.01. Les entrades de la v4 que abans es deien `v4.1`–`v4.8`
> s'han renumerat a `v4.01`–`v4.08`: així hi caben 99 canvis abans de necessitar una v5,
> que queda reservada per a una fita de debò.

### v4.37 — Zones màgiques: torna la base antiga, arreglada
- **Foc, gel, aigua, verí i màgia tornen als camps de la v4.33** («el terra semblava que cremés»), sense el que no funcionava: ja no van a salts (fotogrames clau fosos entre ells), la màgia no té cap remolí al centre, el gel és quiet i sense filaments solts i l'aigua és més calmada i més fonda cap al mig.
- **Vora suau i irregular a totes les zones**, la mateixa per als sis elements: fora la vora lluminosa i les partícules de la vora, que feien que es notés tallada.
- **Llamps**: núvol de tempesta fosc amb venes amples i arcs curts que espurnegen, com a la v4.35 però sense les línies blanques d'1 px que el feien massa nítid.
- Més lleuger: el càlcul es reparteix entre fotogrames amb un pressupost fix i el soroll antic és tres vegades més ràpid. Amb sis zones, la pantalla del jugador es manté a 60 fps.

### v4.36 — Editar enemics en bloc al back office
- **Selecció múltiple a la taula d'enemics** (`/admin/enemics`): casella a cada fila, a cada grup (tot el grup d'un cop) i a la capçalera (tots). **Maj+clic** marca el tram entre dues files.
- **Barra d'edició en bloc** a sobre de la taula: escriu una categoria (o un projecte, amb els valors que ja existeixen com a suggeriments) i «Aplicar» la posa a tots els seleccionats. Amb el camp buit, «Treure» els la treu.
- Només es desen els que canvien, i si algun falla es diu quants i per què (la resta queden desats). Funciona amb la API de sempre: un `PUT /enemies/:id` per enemic.

### v4.35 — Màgia com un portal i retocs al foc, el gel i l'aigua
- **Màgia**: fora el cercle arcà amb runes. Torna a ser un fluid místic: nebulosa amb corrents que llisquen i un remolí al centre que xucla les motes cap a dins, com un portal.
- **Foc**: les flames són llengües (base ampla, punta estreta que s'inclina i parpelleja) en lloc de taques rodones de llum.
- **Gel**: placa llisa i translúcida, més blava on és fonda, amb només unes quantes esquerdes i fractures llargues (abans semblava un enrajolat), bombolles atrapades i gebre acumulat a la vora.
- **Aigua**: les càustiques són bandes de llum suaus (abans semblava vidre esquerdat o electricitat), amb reflexos d'onades que llisquen, escuma que respira a la vora i ones més discretes.

### v4.34 — Zones màgiques noves
- **Textures noves per a les sis zones màgiques**, a la pantalla dels jugadors. Abans eren taques de soroll borroses que anaven a salts (el gel i l'aigua gairebé no es distingien).
  - **Foc**: terra de carbó amb esquerdes de brasa que brillen on crema, flames que pugen, espurnes i fum.
  - **Gel**: placa de cristalls blaus amb esquerdes blanques, gebre a la vora, un reflex que la creua i destells.
  - **Aigua**: fons blau amb càustiques que es mouen, escuma a la vora i ones on cau una gota.
  - **Verí**: fang tòxic amb venes, taques que brillen, bombolles que esclaten i vapors.
  - **Llamps**: núvol carregat amb electricitat estàtica, arcs que salten entre punts i llampecs que il·luminen la zona.
  - **Màgia**: nebulosa que gira, cercle arcà amb runes i hexagrama, i motes que pugen.
- L'animació és fluida (abans s'actualitzava 8–20 cops per segon) i costa menys de pintar: les textures es generen un sol cop i després només es mouen.

### v4.33 — Grimori de Liriandor i màgies previsualitzades als jugadors
- El grimori de Liriandor (menú del clic dret del token → Conjurs) és ara la llista que ha confirmat el jugador: els 4 trucs i els 6 conjurs de base, **Grasa** i **Risa horrible** (triats en passar a nivell 2) i **Hechizar persona** (li dona un objecte; la finestreta del botó ho diu).
- **Encisar persona**, màgia nova (direccional, abast 30 ft): un fil rosat de dues hebres surt de la mà amb un cor a la punta, lliga l'objectiu i, en arribar, l'objectiu batega i li orbiten tres cors sobre el cap. També surt a la roda de les màgies direccionals (Maj + arrossegar).
- **Els jugadors veuen on apunta el DM**: mentre apuntes una màgia (el cercle de Dormir o Grasa, l'abast del grimori, la línia d'un raig amb els peus), les pantalles de jugador ho veuen en viu i en desapareix quan la llances o la cancel·les. Funciona també a la tablet sense canviar res de la API. Dins d'una sala fosca no es veu, com la màgia mateixa.

### v4.32 — Repàs visual (simplificació, fase 5)
- **Icones en lloc d'emojis** a tota la interfície del DM: capçaleres del lateral, menús del clic dret, barra de torns, sales, benvinguda, importar i partides al servidor. Les emojis es veien diferents a cada ordinador (a Windows, negres sobre el fons fosc). Les de les màgies i els elements es queden: són el retrat de cada màgia.
- **El daurat només per a l'acció principal i el que està actiu.** Fora el daurat dels comptadors, la insígnia de la demo, la ronda, els peus, els camps de la fitxa i l'ajuda. «Cap pantalla de jugador» i el desat ja no pinten tot el botó: un punt diu l'estat.
- **Títols en EB Garamond**: nom del mapa, benvinguda, nom del token al menú i títols dels diàlegs. La font ara es carrega de debò (abans s'hi feia referència però sortia Georgia), també al revelador de text dels jugadors, i funciona sense internet.
- **Lateral plegable**: botó al costat del nom del mapa per amagar-lo i tenir més mapa. Es recorda.
- **Finestretes de la barra d'eines d'una sola línia.** El detall (gestos de les màgies, tecles de les parets) és a la finestra de dreceres (?). Ara no queden tapades per la barra de torns.
- Totes les eines actives es marquen igual (daurat), en lloc d'un color diferent per eina.
- Textos que quedaven en castellà al panell d'Importar («Procesando», «Clic o arrastre»…), ara en català.

### v4.31 — La fitxa del token, dins del menú del clic dret
- La fitxa (nom, vida màxima, mida i, als jugadors, velocitat, visió i si es poden moure) ja no és un panell a baix del lateral: és **dins del menú del clic dret**, a sota de la vida. Tot el que és d'un token, en un sol lloc.
- El nom s'edita a la capçalera del menú.
- **Estats compactes**: dues files d'icones en lloc de la graella amb noms. La línia «Estats» diu quins té el token i, en passar per sobre d'una icona, el nom en català, castellà i anglès. Ara també es veuen bé els estats de color fosc (Encegat, Inconscient, Moribund).
- **Clic dret a una fila del lateral** (jugadors i enemics de l'Escena) obre el mateix menú que al mapa, també per als tokens que no tens a la vista.
- Les accions del final (cinemàtica, treure de l'escena, eliminar jugador…) van en una sola fila.
- Un valor escrit en un camp ja no es perd si tanques el menú clicant fora sense prémer Enter. Esc dins d'un camp desfà el que hi has escrit sense tancar el menú.

### v4.30 — Fitxa del token i menú contextual curt (simplificació, fase 4)
- **Fitxa del token** a baix del lateral (a qualsevol pestanya): surt en seleccionar un token i hi ha tot el que és configurar-lo — nom, vida, vida màxima, mida i, als jugadors, velocitat, visió a les fosques, si es poden moure des de la seva pantalla i eliminar-lo.
- Els camps de la fitxa s'apliquen en prémer Enter o sortir del camp (Esc cancel·la): esborrar un número per escriure'n un altre ja no deixa el token a 0 a mig camí.
- **Menú del clic dret més curt**: només accions ràpides (vida, estats, conjurs, grup, cinemàtica, treure de l'escena) i «✏️ Editar la fitxa». El nom, la vida màxima i la mida han passat a la fitxa.
- **Jugadors en files primes** com les dels enemics de l'Escena (avatar, nom, cadenat si no es pot moure i vida). Abans eren targetes de 68 px amb un engranatge cadascuna; amb cinc jugadors ocupaven mig lateral.
- Clicar la fila d'un jugador el selecciona al mapa i n'obre la fitxa.

### v4.29 — Selector de càmera i un sol Desfer (simplificació, fase 3)
- **Selector de càmera** a la cantonada del mapa, al costat del zoom: «Què veuen els jugadors: **Compartida** · **Privada**». Substitueix els botons «CTRL» i «MAJ» de la barra d'eines (les tecles funcionen igual).
- **«Enviar aquesta vista»**: en vista privada, un clic i els jugadors passen a veure el que estàs veient tu.
- La vista temporal del toc de Ctrl continua existint i ara es veu: surt un xip «Temporal · tornarà on era» amb una ✕ per sortir-ne.
- **Un sol «Desfer»** a la barra de dalt que diu què desfarà («Desfer · afegir paret», «· traç de dibuix», «· moviment de Liriandor»). Ctrl+Z fa el mateix. Abans n'hi havia tres i el Ctrl+Z en triava un segons l'eina, sense dir quin.
- Ara també es pot desfer **afegir una paret** (abans un Ctrl+Z en desfeia un altre canvi més antic).
- Fora de la barra d'eines CTRL, MAJ, «Desfer al mapa» i «Desfer traç»: la barra queda en 5 botons a cada mode.

### v4.28 — Modes Preparar i Jugar (simplificació, fase 2)
- **Interruptor Preparar · Jugar** a la barra de dalt. Cada mode només ensenya les seves eines: la barra de l'esquerra passa de 13 botons a 7 o 8.
  - **Preparar** (construir el mapa): Selecció, Parets i portes, Llums, Graella i Desfer al mapa. Al lateral, la pestanya **Mapa** (fons, capes del PSD, sales), a més d'Escena i Biblioteca.
  - **Jugar** (a la taula): Selecció, Senyal i regla, Dibuix i Màgies, i la barra de torns. Al lateral, Escena i Biblioteca.
- **Ploma i Goma en una sola eina, «Dibuix»**. Al seu panell: ploma o goma, color, gruix, desfer l'últim traç i esborrar-ho tot.
- Les dreceres funcionen igual: si prems la tecla d'una eina de l'altre mode (p. ex. la 5 mentre jugues), canvia de mode sol.
- Obrir un mapa nou o un PSD et porta a Preparar; obrir una partida desada o la demo, a Jugar.
- **Graella visible** al menú Vista (per ensenyar-la o amagar-la als jugadors sense obrir la configuració). El panell de la graella, en català («Graella», «Imantar»).
- El desfer dels canvis del mapa passa de la capçalera de Sales a la barra d'eines de Preparar.

### v4.27 — Una sola barra a dalt i res repetit (simplificació, fase 1)
- **Barra superior nova** amb tot el que no és el mapa ni el lateral: nom del mapa, «Mostrar als jugadors», pantalles de jugador, partida, vista i ⋯. Desapareixen la barreta d'Expositor/Text de dalt a l'esquerra, els xips de dalt al centre i tot el peu del lateral.
- **Expositor i Revelador de text en un sol panell** («Mostrar als jugadors») amb dues pestanyes: Imatge o vídeo · Text. Ja s'excloïen l'un a l'altre; un punt verd diu què s'està mostrant.
- **Pantalles de jugador**: un sol botó en lloc de «Modo Jugador» + el xip «Cap pantalla». En groc mentre no n'hi ha cap; dins, obrir-ne una en aquest PC i l'adreça per a la tablet.
- **Menú Partida**: desat automàtic (amb interruptor i quan s'ha desat per últim cop), desar ara, exportar a un fitxer .json, obrir un fitxer i partides al servidor. Abans eren quatre controls repartits.
- **Zoom a la cantonada del mapa** (− 100% +; clic al percentatge = restablir la vista). L'opacitat del mapa i «Ressaltar enemics» van al menú **Vista**; les dreceres de teclat i el back office, al menú **⋯**.
- Fora els botons de Parets i Llums repetits a la capçalera de Sales (ja són a la barra d'eines).
- **Barra de desplaçament integrada** al lateral: va per sobre del contingut, és invisible en repòs, surt suau en passar-hi el cursor o en fer scroll i es pot arrossegar.
- Tot en català: fora «Modo Jugador», «Guardar», «Cargar», «Resaltar», «Bloqueado permanente». Plantilles «Zombi», «Trol» i «Bandit»; la partida es descarrega com a `partida-rpg.json`.

### v4.26 — Enemics de la BD agrupats per projecte o per categoria
- **Cada enemic del back office pot tenir un projecte i una categoria** (text lliure, p. ex. «La cripta» i «Morts vivents»). Al formulari es proposen els que ja existeixen.
- **Agrupar per Projecte · Categoria · Cap**, al back office (`/admin/enemics`) i a la Biblioteca del DM (Base de dades). Cada grup té una capçalera amb fletxa i nombre d'enemics; plegar-lo amaga els seus enemics. «Plegar tot» / «Desplegar tot» d'un sol clic.
- Cada pantalla recorda com ho tens agrupat i què tens plegat, també en canviar de pestanya o recarregar. Si deses un enemic en un grup plegat, el grup es desplega perquè el vegis.
- Si la API encara no té aquests camps (servidor sense reiniciar), el back office ho avisa i no deixa escriure-hi, en lloc de perdre'ls en silenci.

### v4.25 — Base de dades de la Biblioteca en una sola columna
- Els enemics de la base de dades (pestanya Biblioteca) es llisten en **una sola columna**: a dues, els noms llargs quedaven tallats.

### v4.24 — Cinemàtica de boss sense baixada de fps
- **De ~36 a 60 fps durant la cinemàtica.** El resplendor del nom animava un `text-shadow` amb desenfocs de fins a 220 px, i el navegador repintava tot el nom a cada frame. Ara el resplendor és una capa pintada un sol cop (ombra de 50 px + halo de degradat radial) i només se n'anima l'opacitat, que la fa la GPU.
- Fora també l'aturada d'uns 200 ms que hi havia just quan el nom començava a brillar.

### v4.23 — Grimoris dels personatges: llançar els seus conjurs des del token
- **Clic dret a Liriandor o Yunquerin → ✨ Conjurs.** Hi surten els conjurs apuntats a les seves fitxes del Notion, agrupats com a la resta de l'app: **direccionals** (en línia recta), **a un punt** (dins d'un abast) i **personals** (surten del mateix token). Espardeny, Jaume III i Cigarramic no en tenen.
- **Es llancen des del token, amb l'abast en peus.** En triar-ne un, el raig o l'àrea segueix el ratolí però no passa de l'abast (cercle de guions); un clic el llança. Esc o clic dret el cancel·la. Funciona amb qualsevol eina activa.
- **12 efectes nous:** Raig de gebre, Toc electritzant, Mà de mag, Prestidigitació, Armadura de mag, Escut, Detectar màgia, Llum, Flama sagrada, Taumatúrgia, Beneir i Curar ferides. Els que no són de toc ni personals també surten a les rodes dels gestos.
- **Les màgies direccionals de la roda també respecten l'abast** (Mans ardents no passa de 15 ft), i les àrees no es poden deixar més lluny del seu abast.

### v4.22 — Cinemàtica de boss: un sol motor i errors corregits
- **Totes les pantalles enquadren el boss igual.** La càmera de la cinemàtica viatja ara en coordenades de mapa (`cam`, com la càmera compartida): abans cada pantalla calculava el seu zoom amb la seva mida i el boss quedava descentrat a les finestres d'un altre format.
- **Saltar-la i tornar-la a llançar ja no la trenca.** La neteja retardada de la primera esborrava les dades de la segona (franges i retrat penjats).
- **Ocupa l'escenari, no la finestra.** Al DM les franges i el retrat es mesuraven amb la finestra sencera (sidebar inclòs) i quedaven desplaçats.
- **Espurnes iguals a tot arreu i a qualsevol fps.** Abans anaven el doble de ràpid a 120 Hz i cada pantalla en veia unes d'aleatòries.
- La càmera del DM torna suau a la vista normal en lloc de fer un salt. El retrat s'envia sempre reduït (abans, des de la biblioteca, s'enviava la imatge sencera). La pantalla de jugador compensa el que triga a carregar el retrat i no va endarrerida.
- Els noms llargs s'encongeixen per cabre en una línia, i amb «reduir moviment» del sistema el flaix és molt més suau.
- Un sol mòdul (`lib/cinematic/bossIntro.ts`) per al DM i el jugador: abans eren dues còpies de ~200 línies que ja havien divergit.

### v4.21 — Barra de torns sense tremolors i icona nova de l'Expositor
- **Fora el balanceig del mode edició.** Els xips girats sobresortien un píxel del carril i feien aparèixer i desaparèixer la barra de scroll: tremolava tota la barra, no els tokens. Ara el mode edició es distingeix només per la vora daurada, la vora de guions dels xips i el botó «✓ Fet».
- **La barra ja no varia de mida passant torns molt de pressa.** Les transicions que es tallaven a mitges deixaven la suma de les amplades descompensada (fins a 5 px). Ara el carril té una amplada fixa i el xip actiu s'eixampla repartint-se l'espai amb els altres, així que la suma sempre quadra.
- **Icona nova de l'Expositor:** un marc d'imatge vectorial del mateix estil que la barra d'eines. L'emoji 🖼 sortia negre a Windows i no es veia.

### v4.20 — Barra de torns de mida fixa i reordenació en viu
- **La barra de torns ja no canvia de mida durant el combat.** Abans s'eixamplava i s'encongia a cada torn (el xip actiu feia l'amplada del nom, i un jugador portava la columna de peus i un enemic no) i també en clicar «⏭ Ronda» o «✕» (el botó es convertia en la frase de confirmació). Ara el xip actiu té sempre la mateixa mida (els noms llargs s'escurcen amb «…»), i el xip que deixa el torn i el que l'agafa s'animen a la vegada perquè la barra no es mogui ni durant la transició.
- **Les confirmacions surten en un globus a sobre de la barra** («Saltar a la ronda N?», «Finalitzar el combat?», «Recuperar el torn de…»). Es tanquen clicant fora o amb Esc (abans clicar fora no les tancava).
- **Reordenar com a l'iPhone:** amb ⚙, els xips es balancegen; el que agafes s'aixeca i segueix el ratolí, i la resta s'aparten en viu per deixar el forat on quedarà. En deixar-lo anar, vola al seu lloc. Si hi ha més tokens dels que hi caben, portar-lo a la vora fa scroll sol. Funciona també amb el dit.
- En mode edició, el botó «Següent» es converteix en **«✓ Fet»** per sortir-ne (al mateix lloc i amb la mateixa amplada).

### v4.19 — Una sola roda per a les màgies i les zones màgiques
- **La roda de màgies i la d'elements són ara la mateixa** (`RadialMenu`). Abans, segons el gest, l'eina Màgies obria un anell transparent amb només emojis i el nom a 8 px, o uns botons rodons amb degradat on el ✕ tapava el títol.
- **Llegible sobre qualsevol mapa:** fons opac, cada opció amb **icona i nom**, i al centre què s'està triant («Trajectòria · segueix el traç», «Direccional», «Àrea», «Zona màgica»). En passar el cursor per una opció, el centre en diu el nom i el detall (a les d'àrea, el radi i l'abast).
- **Mateixa mida i disposició en tots els modes:** la primera opció sempre a dalt, i la roda no surt mai de la finestra encara que el traç acabi a la vora.
- **Teclat:** 1…N trien l'opció i Esc tanca, sense canviar d'eina (abans l'1–6 de la roda activaven altres eines i l'Esc et treia de Màgies). Clic al centre o fora també tanca.
- **Noms en català i coherents a tot arreu:** Bola de foc, Raig elèctric, Raig màgic, Projectil màgic, Riure horrible, Mans ardents, Dormir, Greix; i els elements Foc, Gel, Aigua, Verí, Llamps, Màgia. El menú contextual d'un encanteri d'àrea deia l'identificador intern («💤 sleep») i ara diu «💤 Dormir»; el d'una zona, «🔥 Zona de foc».
- **L'ajuda de l'eina Màgies explica els quatre gestos** (traç obert, tancar el traç, Maj+arrossegar, Alt+clic o creuar el traç) amb els mateixos noms que la roda. Abans parlava de «clicar els vèrtexs d'un polígon», que no és com funciona.

### v4.18 — Els cinc spells restants, amb el mateix llenguatge visual
- **Coherència**: cada escola de màgia té una sola paleta (`PAL` a `fxsprites.ts`: foc, arcà, encantament, son) i tots els impactes fan servir el mateix esclat (`impactBurst`: flaix → llum → anell → espurnes). El projectil màgic comparteix el violeta del raig màgic; les mans ardents, el foc de la bola de foc.
- **Projectil màgic**: la mà s'encén i els tres dards es materialitzen un a un; volen corbats i acceleren, amb una estela que s'aprima, cap allargat per la velocitat i llum sobre el mapa; cadascun impacta en un punt lleugerament diferent de l'objectiu.
- **Risa horrible**: un projectil rosa juganer amb dues boletes que hi orbiten i una estela de purpurina; a l'objectiu, un esclat i una aura que batega a ritme de riallada, amb «HA!» que salten amb rebot i s'enlairen.
- **Mans ardents**: un llançaflames curt: flames que surten de les mans, es frenen i es refreden al final del con, fum a la punta, espurnes i una falca de calor que fa llegible l'abast.
- **Dormir**: una boira de son que s'escampa amb una onada fins al límit de l'àrea i hi queda girant a poc a poc, amb pols de somni que s'enlaira i les Zzz.
- **Greix**: el bassal cau amb esquitxos, té textura d'oli amb vetes, vora més fosca, reflexos humits que llisquen i bombolles que creixen i peten.
- `spells.ts` queda com a dispatcher i previsualització; els efectes viuen a `minorspells.ts` i `areaspells.ts`.

### v4.17 — Raig elèctric i raig màgic nous; bola de foc més directa
- **Bola de foc**: fora el cercle rúnic. Ara la flama s'encén a la mà en un instant i surt disparada amb una flamarada i un flaix direccional. L'explosió és una mica més petita (15 ft de radi en lloc de 20).
- **Raig elèctric refet**: llamp fractal de debò (desplaçament del punt mig amb branques), amb un líder que avança a salts, descàrrega principal amb flaix i sacsejada curta, re-descàrregues a intervals irregulars (parpelleja com un llamp de veritat), arcs que ballen a l'impacte i a la mà, espurnes, llum blava sobre el mapa, postllum violeta i marca socarrimada a terra.
- **Raig màgic refet**: càrrega amb energia que convergeix en espiral i destell anamòrfic; el raig s'estén en un instant i queda sostingut amb capes violeta → magenta → nucli blanc que vibren, dues fibres en hèlix, anells i polsos que hi viatgen, espurnes i llum. A l'impacte, estrella de raigs que gira, ones i esquitxos; al final el raig s'aprima i l'impacte implosiona.
- La sacsejada de càmera passa per `spellShake` (a `spells.ts`), que suma la de tots els spells.

### v4.16 — La bola de foc, refeta amb estil de videojoc
- **Nou efecte en quatre temps**: càrrega (cercle rúnic al conjurador i espurnes que s'hi arremolinen), vol (projectil que accelera amb nucli incandescent que gira, cua de foc que queda enrere al món, fum i espurnes), impacte (flaix, bola de foc que s'infla i es refreda de blanc a vermell, ona expansiva amb anell de pols, terra que s'encén al pas de l'ona, runa encesa volant i fum que s'alça) i residu (socarrim a terra amb brases que es refreden).
- **Llum dinàmica**: el projectil i l'explosió il·luminen el mapa del voltant amb pampallugues de foc.
- **Sacsejada de càmera** a l'impacte, a totes les pantalles (fons, mapa i tokens es mouen junts).
- **Mida de reglament**: l'explosió fa 20 ft de radi (abans ~13).
- **Sprites amb soroll** (`src/lib/render/fxsprites.ts`): el foc i el fum són textures grumolloses pre-rasteritzades una sola vegada, en lloc d'un gradient radial per partícula i per frame. Més bonic i més barat.
- El socarrim es pinta a la passada `ground` (sota els tokens); la resta a la `air`.

### v4.15 — Usabilitat i coherència de la pantalla del DM
- **Ctrl+Z i Maj+clic ja no encenen modes de vista sense voler.** Ctrl i Maj commutaven la vista compartida i la privada en *prémer-les*, o sigui que tot Ctrl+Z encenia el mode CTRL (i el segon el tornava a apagar, fent saltar la càmera de tothom enrere) i el «Maj+clic» de les portes encenia la vista privada. Ara només compta un **toc net** de la tecla sola. També s'accepta Cmd+Z al Mac.
- **«💀 Derrotar» amb nom al menú d'un token.** Era un ✕ solt just on s'espera el botó de tancar el menú. Ara el ✕ del menú **tanca** (i Esc també), com a tota la resta de l'app.
- **L'ull vol dir el mateix a tot arreu: «ho veuen els jugadors?».** A les zones del PSD l'ull obert volia dir que la zona estava *amagada* (la coberta es veia), al revés que a les sales dibuixades i als enemics.
- **Botó «Següent ▶» per passar torn** (i **Enter** com a drecera). Abans només es podia fer clicant el xip actiu, i el botó destacat era «⏭ Ronda», que salta tots els que queden: ara «Ronda» és secundari i demana confirmació. Amb molts tokens, els xips fan scroll i el del torn actiu queda sempre a la vista; la barra ja no tapa la barra d'eines.
- **Moure el mapa sense botó central del ratolí:** **Espai + arrossegar** amb qualsevol eina, **arrossegar en buit** amb l'eina de selecció, i al trackpad **dos dits = moure, pinça = zoom** (la roda del ratolí continua fent zoom). Arrossegar començant damunt d'una sala fosca ja no la revela: només el clic.
- **Pantalla de benvinguda nova:** «Obrir mapa», «Provar la demo» i «Recuperar l'última partida» en gran, i **tot el canvas accepta fitxers** (imatge/vídeo → mapa, .psd → capes, .json → partida). Sense mapa, les eines, els torns, el zoom i «Guardar» queden apagats.
- **Panell lateral per funció: Escena · Mapa · Biblioteca.** A **Escena** hi ha els jugadors i **tots** els enemics (del PSD i de la biblioteca) en files primes amb la vida; a **Mapa**, el fons, les capes del PSD, les sales i els llums; a **Biblioteca**, les plantilles per afegir-ne (amb quants n'hi ha a l'escena de cadascuna).
- **Un sol control de vida a tota l'app** (targeta de jugador, files d'enemics i menú contextual), en tres mides. Clic ±1, clic dret ±10 i **clic al número per escriure-hi**: «-7» dany, «+5» cura, «12» vida exacta.
- **Sistema visual:** escala de 5 mides de lletra (mínim 10 px; els noms dels estats en feien 7,5), 3 radis, ombres i colors de la paleta en lloc d'escrits a mà, i botons base (`Button`/`IconButton`).
- **Polit:** fora els xips de depuració del peu del panell i el xip «DM»; el xip de pantalles diu **«Cap pantalla»** en color d'avís i en clicar-lo ofereix obrir-ne una o **l'adreça per a la tablet** (amb botó de copiar); **V** o **Esc** tornen a l'eina de selecció; **?** (o el botó ⌨ del HUD) mostra totes les dreceres; «Tots/Cap» per triar enemics en iniciar un combat.
- **Arreglat:** amb el panell de l'Expositor obert, **qualsevol tecla** reiniciava el Ken Burns (la condició de l'Espai tenia la precedència malament), i deixar-hi anar un fitxer també el carregava com a mapa.

### v4.14 — El diagnòstic de connexió diu QUINA de les avaries és
- **Codi de tancament del WebSocket a la pantalla.** Un socket que no connecta i un socket que el servidor **rebutja** es veien exactament igual. Ara es llegeix el codi: `4401` («invalid key», el que retorna la API quan té `SYNC_KEY`) surt com a **clau de sincronització incorrecta**, amb el detall de si aquest build en porta cap — que és el fracàs típic quan es desplega a Vercel sense la `NEXT_PUBLIC_SYNC_KEY`.
- **Prova del host per HTTP** (`probeApiReachable`): quan el socket cau, es fa una petició `no-cors` a la API. Així se separa **«no s'arriba al host»** (ordinador apagat o adormit, túnel públic tancat, sense xarxa) de **«el host respon però el WebSocket es tanca»** (clau, o alguna cosa entremig que el bloqueja). Abans les dues coses deien el mateix.
- **Consells segons on és la API**: amb una adreça de xarxa local es parla de la wifi i del port 3000; amb un host públic (Tailscale Funnel) es parla de l'ordinador, del servei i del túnel — que és el que toca comprovar-hi.

### v4.13 — La pantalla de jugador ja funciona al mòbil (i diu per què no connecta)
- **Arreglada la mida al mòbil.** Faltava el `meta viewport`: el telèfon assumia una finestra virtual de ~980 px i n'escalava el resultat, així que la pantalla de jugador sortia minúscula i mal enquadrada. Ara fa servir l'amplada real del dispositiu, ocupa tota la pantalla (osca inclosa) i l'alçada segueix `100dvh` — amb `100vh` la barra del navegador tallava el rètol de torn.
- **Ja no cal escriure la IP del PC a `next.config.ts`.** `allowedDevOrigins` es calcula a l'arrencada amb les IPv4 de les interfícies del PC i els rangs privats habituals. Amb una sola IP escrita a mà, el dia que el router en donava una de nova, Next bloquejava els recursos del dev server i el mòbil es quedava amb una **pàgina negra congelada i cap error visible**.
- **La pantalla d'espera diu què passa.** Sota "Esperant al Dungeon Master..." hi surt ara l'estat de la connexió i a quina adreça truca: connectat, connectant o sense connexió (amb què cal comprovar). Si la pàgina s'ha obert per `https` (el desplegament de Vercel) i el DM va per `http`, ho diu explícitament: el navegador bloqueja el WebSocket per contingut mixt i abans no s'hi veia cap pista.
- **`BroadcastChannel` amb guarda.** No existeix a iOS Safari < 15.4 ni a navegadors antics d'Android i es creava sense protecció: l'excepció tombava l'arbre de React i la pantalla es quedava en negre. Al mòbil no fa cap falta (la sincronització hi va per WebSocket), així que ara si no hi és s'ignora i el WS continua funcionant.

### v4.12 — El rètol de torn s'adapta a la mida de la pantalla
- **El rètol de torn de la pantalla de jugador escala amb la finestra.** Estava dimensionat en píxels fixos, pensat per a la TV: en una pantalla petita es menjava gairebé tota l'amplada. Ara totes les mides (tipografia, avatar, marges i barra) van amb `clamp` proporcional a l'amplada de la finestra, amb terra i sostre — ni desapareix en una pantalla petita ni es fa gegant en un monitor gran.
- Mesurat: passa d'ocupar un 89% de l'amplada en una pantalla de 800 px a **entre el 37% i el 47% a totes les mides** (de 1920 a 600 px), amb una alçada d'entre el 6% i el 13%.

### v4.11 — Els estats ja fan efecte i les parets es poden editar
- **Indicador de torn a les pantalles de jugador.** La TV i la tablet ja diuen, en gran, **de qui és el torn**, la ronda i **quants peus de moviment queden** (número gran + barra que s'encongeix). Fins ara qui jugava des de la tablet només ho sabia si el DM li deia en veu alta, i el rang groc de moviment només apareixia mentre arrossegava. A la barra del DM, els peus del token actiu també passen a ser un número gran amb barra, perquè les dues pantalles diguin exactament el mateix.
- **Els estats ja tenen efecte de debò sobre el moviment.** Dels 16 estats, només *Encegat* feia alguna cosa (encongir la llum). Ara **Agafat, Retingut, Paralitzat, Petrificat, Atordit, Incapacitat i Inconscient deixen la velocitat a 0** i **Tombat la parteix per la meitat** (aixecar-se costa mig moviment).
  - No és silenciós: el token no es pot ni arrossegar i les dues pantalles diuen per què (**«No es pot moure · Agafat»**).
  - El límit el calcula un únic `movementLimit` que comparteixen el clamp del drag, la pintura del rang groc i la validació del DM, així que el jugador no veu mai un rang que després li rebotin.
  - **No consumeix peus**: si el DM treu l'estat a mig torn, el moviment que quedava torna a estar disponible a l'instant.
- **Editar parets ja dibuixades.** Amb l'eina 🧱 i cap paret a mitges, els vèrtexs es poden **agafar i arrossegar** (surten més grossos i s'encenen en passar-hi per sobre); la cantonada es manté unida perquè es mouen tots els extrems que hi coincideixen, i les sales es reconcilien conservant nom i estat. **Clic dret sobre un tram l'esborra.** Abans, una paret mal posada només es podia desfer amb Backspace mentre encara era l'última; passat aquell moment calia eliminar la sala sencera.
- **Ctrl+Z de debò al mapa.** Ara es desfan **parets, vèrtexs moguts, sales, portes i llums**, no només els traços de dibuix i els moviments de combat. Nou botó **↶** a la capçalera de «Sales», amb el nom del canvi que desfarà, perquè no sigui una drecera invisible. Ctrl+Z continua encaminat per eina: dibuix → traç, Parets/Llums → canvi de mapa, i amb l'eina de selecció desfà el moviment de combat o, si no n'hi ha cap, l'últim canvi de mapa.

### v4.10 — Arreglats quatre errors i la partida ja no es perd amb un F5
- **Escriure ja no descol·loca la vista.** Prémer Maj per fer una majúscula a l'editor del revelador de text, o mentre reanomenaves un jugador o una sala, **activava i desactivava la vista privada del DM** a cada pulsació — amb l'animació de retorn de càmera cada vegada. Amb Ctrl passava el mateix amb la vista compartida: un Ctrl+A o un Ctrl+V dins d'un camp la commutava. Els dos commutadors ara ignoren el teclat quan estàs escrivint (i les dreceres continuen funcionant igual fora dels camps).
- **Eliminar un token durant el combat ja no deixa un fantasma a la iniciativa.** Fins ara el seu xip es quedava a la barra amb el nom «?», i quan li arribava el torn l'aro daurat no es pintava enlloc i calia passar-lo a mà. Ara surt de la cua: si era el token que tenia el torn, passa al següent amb el seu saldo de moviment sencer, i si era l'últim de la cua el combat s'acaba sol. També cau de l'historial de Ctrl+Z.
- **Els tokens derrotats ja no agafen torn.** Un enemic amb la X o un jugador a 0 de vida se salta automàticament (abans calia un clic buit per cada baixa i per cada ronda). El seu xip surt atenuat i amb la ✕ per veure que hi és però no juga; si recupera vida, torna a jugar sol.
- **Desat automàtic de la partida.** Tot l'estat viu (fons, parets, sales, portes, llums, tokens, vides, estats, dibuix i torns) només existia en memòria: un F5 accidental, un hot-reload o una pestanya que el navegador descarrega i s'havia acabat. Ara es desa sol a IndexedDB **cada 30 segons i sempre que amagues la pestanya**, i a la pantalla de benvinguda hi surt **«↩ Recuperar l'última partida · fa 4 min»**. Nou xip ⟳ al HUD amb l'últim desat: clic per desar ara, clic dret per apagar-lo (apagar-lo esborra el que hi hagi desat).
  - El fons es desa com a **Blob i en un registre a part**: no es torna a copiar la imatge mentre no canviï el mapa, i s'evita el base64, que la infla un 33% i bloqueja el fil principal.
  - Els **grups de tokens** ara també entren a la partida desada (abans es perdien en carregar-la).

### v4.09 — Els estats ja no tenyeixen el token
- S'elimina el tint de color que alguns estats aplicaven al token sencer: amb dos o tres estats alhora els colors se sumaven i el resultat no volia dir res. Tota la lectura d'estats queda al distintiu (anell segmentat + badges), que sí que els distingeix un per un.
- **Excepció**: `invisible` continua igual (fantasma semitransparent al DM, contorn blau de guions i amagat del tot al jugador) — mai va anar pel tint.

### v4.08 — Retocs al menú d'estats
- **Traduccions revisades**: *Ensordit* (no «Eixordat», que no és català estàndard) i *Tombat* per a `prone`.
- **Menú molt més compacte** (230 px d'ample, 4×4 fitxes) i les traduccions al castellà i a l'anglès passen a la **finestreta natiua del sistema** (`title`) en lloc d'un menú propi de l'app.
- **Isotips millorats**: la cara d'*Encegat* ja no somriu (cap estat és una cosa bona), *Cansament* és una figura ensorrada de debò, *Agafat* passa a ser un puny que estreny i *Petrificat* té els trossos de pedra que se'n desprenen.

### v4.07 — Menú d'estats de token refet de cap i de nou
- **Els 16 estats oficials** de la làmina de D&D (s'hi afegeixen **Cansament** i **Morint**), amb el nom **en català**; en passar el cursor per sobre d'una fitxa del menú surten les traduccions al **castellà i a l'anglès**.
- **Isotips nous, vectorials** (`src/lib/conditions/icons.ts`): paths SVG en una caixa de 512, dibuixats amb `Path2D` al canvas i amb `<svg>` al menú, o sigui **màxima resolució a qualsevol zoom** (res de bitmaps).
- **Un color propi per estat** en lloc del vermell/gris de sempre.
- **Un token amb molts estats ja s'entén**: els distintius es reparteixen en un arc simètric damunt del token i s'obren fins a envoltar-lo (encongint-se si cal, amb «+N» com a últim recurs), i la vora del token es pinta com un **anell segmentat** amb el color de cada estat — d'un cop d'ull ja se sap quants n'hi ha i quins.
- Menú contextual redissenyat: graella de fitxes amb isotip i nom, les actives enceses del color de l'estat.

### v4.06 — Redisseny de la finestra lateral i barra d'eines completa
- **Finestra lateral en seccions plegables.** Importar, capes del PSD, sales, punts de llum, jugadors i la biblioteca d'enemics comparteixen ara la mateixa capçalera (títol, comptador i botons d'acció) i es poden plegar. Les llistes llargues (capes, sales, llums) tenen scroll propi en lloc d'empènyer la resta del panell fora de la pantalla.
- **Les sales van comprimides en un grup**, plegat per defecte i amb el comptador a la capçalera (`Sales · 12`), més un resum de quantes són fosques i quantes estan revelades. Les files són més compactes. Igual per als punts de llum.
- **La secció Importar es plega sola** en carregar el primer mapa, i el formulari d'alta de jugadors només ocupa espai quan el desplegues (botó ＋).
- **Targetes de jugador un 5% més baixes** (72 → 68 px) i amb **el número de vida molt més gran** (24 → 30 px), aprofitant tota l'alçada de la fila i mantenint els marges amb el nom i amb la vora de la targeta.
- **La barra d'eines flotant ja té totes les eines**: s'hi han afegit els tres modes que fins ara només existien per teclat i no hi havia manera de descobrir — **vista compartida (CTRL)**, **vista privada (MAJ)** i **selecció múltiple (A)**. Botó i tecla comparteixen exactament la mateixa acció (`toggleCtrlPan` / `toggleShiftPan` / `toggleAreaSelect` a `DMView`).
- **Les explicacions de les eines surten en passar-hi el cursor per sobre**, en una finestreta enganxada a la dreta del botó, amb el nom de l'eina i la seva drecera. Abans només es veien —i ocupant espai fix a baix a l'esquerra— quan l'eina ja estava seleccionada, o sigui quan ja no calien. Al flyout hi queden només els controls que cal manipular (color i gruix del pinzell, radi de la llum).
- **Expositor i Text passen a ser botons d'eina** dins d'una barra igual a la superior esquerra del canvas, amb la mateixa finestreta d'explicació (desplegada cap avall) i un punt verd quan s'estan mostrant als jugadors.
- **Els tokens d'enemic de la biblioteca es numeren sols**: el primer Goblin es diu "Goblin"; en crear-ne un segon, el primer passa a "Goblin 1" i el nou a "Goblin 2", i la sèrie va ascendint. Els noms propis que hagis escrit tu ("Goblin Cap") queden fora de la sèrie i no es toquen.

### v4.05 — Arreglat: els tokens continuaven teletransportant-se al DM
- L'animació de la v4.04 no s'arribava a veure **si la API estava engegada**. La pantalla de jugador envia cada `TOKEN_MOVE` pel BroadcastChannel **i** pel WebSocket, així que una pantalla del mateix ordinador el feia arribar al DM **dues vegades**: la segona còpia no movia res (el token ja hi era) però **esborrava el camí d'animació** que acabava de fixar la primera, i el token saltava igualment. Ara el DM descarta l'eco d'un moviment ja aplicat.
- De retruc, l'eco també duplicava el `TOKEN_RELAY` cap a la resta de pantalles i l'entrada de l'historial de Ctrl+Z (calien dues pulsacions per desfer un sol moviment).

### v4.04 — El DM veu el desplaçament dels tokens que mouen els jugadors
- **Els tokens moguts des de `/player` ja no salten de cop a la pantalla del DM.** Fins ara el DM només veia la posició final i no sabia per on havia passat el token (ni si havia vorejat una paret o havia creuat una porta). Ara reprodueix la **mateixa animació de desplaçament** que les pantalles de jugador: velocitat de creuer constant seguint el camí real (forma d'L, suavitzat) i frenada suau al final.
- Quan no hi ha grid ni parets (o el moviment és d'una sola casella) el token es desplaça en **línia recta animada** en lloc de teleportar-se.
- La llum del token acompanya l'animació també al DM, així que veu exactament el mateix que els jugadors.
- El que mou el DM amb el ratolí continua sent instantani (el token segueix el cursor), i arrossegar un token o fer Ctrl+Z cancel·la qualsevol animació pendent.
- El càlcul del camí que abans estava duplicat entre la pantalla de jugador i el drag passa a un únic `buildMovePath` (`src/lib/rooms/pathing.ts`), compartit ara també pel DM.

### v4.03 — El que veu el DM és el que veuen els jugadors (càmera independent del format)
- **Arreglat: els jugadors no veien el mateix tros de mapa que el DM.** La càmera es sincronitzava com a `zoom` + `panOffset` en **píxels de la pantalla del DM**, i cada pantalla aplicava després la seva pròpia escala d'ajust (`min(W/mw, H/mh)`). Amb finestres de mida o format diferents (monitor del DM, tele dels jugadors, tablet 4:3) el mateix desplaçament en píxels movia una quantitat de mapa diferent i cada pantalla retallava per un costat: el DM tenia un enemic o una porta a la vora de la seva pantalla i a l'altra banda no hi era, **sense cap indici que allò passés**.
- **Ara viatja l'enquadrament en coordenades de MAPA** (`cam`: centre + amplada/alçada visibles, `src/lib/camera.ts`) i cada pantalla l'hi fa **encaixar dins** (regla "contain"). Conseqüència garantida: **cap pantalla no veu mai menys que el DM**; si el format no coincideix, la diferència surt com a marge extra de mapa, mai com a retall. Verificat sobre 1210 combinacions de mapa, finestra, zoom i pan.
- **Es reenquadra sol quan canvia una finestra**: girar la tablet, entrar a pantalla completa o moure la finestra del DM a un altre monitor ja no descol·loca res (abans la mida només es llegia en connectar).
- **Nou indicador 🖥 al HUD del DM** amb les pantalles de jugador connectades i quant de mapa veuen **de més** que ell (les pantalles reporten la seva mida amb el missatge `VIEWPORT`). El DM ja no ha d'endevinar què hi ha a l'altra banda.
- El camp `cam` no necessita cap canvi a la API (és un camp més dins de missatges que el servidor ja reenvia). Per al comptador 🖥, la API reenvia `VIEWPORT` client→dm; les pantalles del mateix ordinador hi surten igualment via `BroadcastChannel`. Nou script de comprovació del contracte del WS: `node scripts/check-sync.mjs [ws://host:3000] [SYNC_KEY]`.
- La vista privada del DM (Maj) continua sent local i no es propaga.

### v4.02 — La pantalla de jugador va molt més fluida amb sales fosques
- **Memòria cau del rasteritzat de cada llum** (`_maskCache` a `render/darkrooms.ts`). Calcular la llum d'un token (màscara sala ∪ visió → erosió → gradient) és el gruix del cost del frame, i es refeia per a **totes** les llums a cada frame encara que només se n'hagués mogut una. Ara cada llum es reutilitza mentre no canviï res que en determini els píxels (parets/portes, càmera, posició/radi/intensitat). Movent un token amb una party de 5: **98 ms → 52 ms per frame**; amb 8 jugadors: **133 ms → 51 ms** (el cost ja gairebé no depèn de la mida del grup). Amb tothom quiet: **94 ms → 45 ms**.
- **`_lightCanvas` només es neteja i es composita a la finestra que ocupen les llums**, en lloc de dues passades de pantalla completa per frame.
- **Culling de les sales fora de pantalla**: les sales fosques que no es veuen ja no es tracen (farciment + contorn al jugador; contorns, noms i ull al DM). La memòria d'explorat continua fent servir *totes* les sales, perquè el que s'explora fora de càmera ha de quedar memoritzat igual.
- **El terreny memoritzat (fog explorat) es composita només al rectangle de les sales fosques visibles**, no a tota la pantalla.
- **`accumulateExplored`** construeix el retall de sales per llum (només les que toquen el seu cercle) en lloc d'unir els polígons de totes les sales del mapa a cada frame.
- Cerca de la sala que conté un punt amb descart previ per bbox (`roomAt`).
- Sense canvis visuals: el resultat és el mateix píxel a píxel.

### v4.01 — El PSD passa a ser opcional (mapa només amb imatge)
- **Un mapa només amb la imatge de fons ja és jugable.** Fins ara, sense un arxiu de Photoshop el canvas no dibuixava res: el render loop sortia aviat (`if (!s) return`) perquè no hi havia estructura de capes. Ara, en carregar una imatge o un vídeo sense PSD es crea una **estructura buida sintètica** i tot funciona amb la imatge sola: **grid** (activar, calibrar, snap, autosize), **parets → sales fosques**, **portes**, **punts de llum** i **fog of war**, **tokens** de jugador i de biblioteca, **dibuix a ploma**, **zones màgiques**, **spells**, **regla de mesura**, **sistema per torns** i la **sincronització amb la pantalla de jugador** (STRUCT + BG).
- **Nou panell "Sales"** al sidebar (pestanya Mapa): l'equivalent de l'arbre de capes per a un mapa dibuixat a l'app. Llista les sales detectades amb el commutador de sala fosca, l'ull de revelar/amagar, reanomenar en línia i un desplegable amb afegir porta, resetejar explorat i eliminar (amb confirmació). Passar el ratolí per una fila la ressalta al mapa. A sota, la llista de **punts de llum** amb el seu radi. Accessos directes a les eines 🧱 Parets i 🔆 Llums.
- **La UI exclusiva del PSD s'amaga** quan no n'hi ha (arbre de capes, "Resaltar enemics", comptador d'actius i les dimensions a la caixa del PSD), en lloc de sortir buida.
- **Un PSD il·legible ja no deixa el mapa bloquejat**: si la lectura falla es torna al mapa només amb imatge en comptes de quedar-se sense res dibuixat.
- **Fix**: el clic dret sobre una sala detectada no obria el menú contextual si no hi havia cap PSD carregat (es sortia abans d'arribar-hi).
- Les partides desades sense PSD es tornen a carregar igual (la marca d'estructura sintètica es conserva al fitxer de sessió).

### v4 — Sales fosques, llum dinàmica i fog of war (oficial)
Primera versió estable de tot el cicle `v3.99 pre-release`. Novetats principals:
- **Parets → sales fosques**: el DM dibuixa parets (eina Parets, `5`) i les sales es deriven automàticament. Neixen fosques per defecte; es poden revelar/amagar (ull) i reanomenar. Eliminar-ne una **demana confirmació** (també s'esborren les parets exclusives de la sala).
- **Portes**: entitats sobre les parets (dos clics d'amplada), obrir/tancar amb un clic; la llum i el moviment hi passen quan són obertes.
- **Il·luminació dinàmica (fog of war)**: cada token de jugador emet llum dins del seu radi de visió; il·lumina del tot la seva sala i s'escola per portes/obertures cap a les del costat (raycasting). Les parets bloquegen la llum; s'atura net a la paret.
- **Punts de llum (torxes/llànties)**: l'eina Llums (`6`) col·loca fonts de llum que s'encenen quan un token entra a la sala (radi regulable, només el DM veu el marcador).
- **Memòria d'explorat (estil Age of Empires)**: les zones ja vistes es recorden amb el terreny atenuat (sense tokens); botó per **resetejar l'explorat** d'una sala.
- **Moviment de tokens des de la pantalla de jugador**: drag amb ghost, límit per velocitat, col·lisió amb parets i camí vorejant-les (forma d'L suavitzada), amb sistema per torns.
- **Rendiment de la llum amb molts tokens**: la il·luminació escalava amb *nombre de tokens × àrea de la finestra* i saturava l'app amb una party gran. Dos colls d'ampolla resolts:
  - **Composició per llum limitada al seu rectangle.** Cada llum feia ~7 operacions sobre el canvas SENCER (netejar, copiar, els 4 desplaçaments de l'erosió i acumular); ara només toca el rectangle de pantalla que ocupa. El resultat és **pixel a pixel idèntic** (verificat comparant les dues versions) i, en una mesura amb 6 llums a 2560×1440, la composició baixa de ~507 ms a ~62 ms per frame.
  - **Memòria cau del polígon de visibilitat.** El raycasting contra les parets es refeia per llum i per frame encara que ni la llum ni les parets s'haguessin mogut (el cas normal entre moviments). Ara es recalcula només quan la llum canvia de posició/radi o quan canvien les parets efectives (amb l'obertura animada de porta quantitzada perquè la memòria cau encerti). La memòria d'"explorat" també s'estalvia els frames sense canvis, i els vèrtexs compartits entre parets ja no generen rajos duplicats.
- **Sistema per torns**: aro daurat al token que té el torn, pintat a **totes** les famílies de tokens (jugadors i enemics PSD i de biblioteca), perquè al mapa es vegi a qui li toca moure sense mirar la barra d'iniciativa.
- **Extres**: opacitat del fons només al DM, control de visió/velocitat/bloqueig per jugador al PlayersPanel.

### v3.99 pre-release 12
- **Punts de llum (torxes/llànties).** Nova eina "Llums" (tecla `6`) a la barra flotant: clica dins d'una sala per posar-hi una font de llum (un solet groc que **només veu el DM**). La llum **s'encén només quan un token de jugador és dins de la mateixa sala**; llavors els jugadors veuen la zona il·luminada (i el DM la veu igual). En sortir el token, la zona queda **explorada** (terreny memoritzat atenuat) però deixa de veure's. El **radi és regulable** amb el flyout (5–60 ft); seleccionant una llum el slider n'edita el radi. Arrossega una llum per moure-la, clic dret per eliminar-la. Sincronitzades al jugador i persistides a la partida.
- **Resetejar l'explorat d'una sala.** Nou botó al menú contextual d'una sala fosca ("🌑 Resetejar explorat"): esborra la memòria del que s'hi havia vist i la sala torna a ser **negra del tot** (fog of war), sincronitzat als jugadors.

### v3.99 pre-release 11
- **Smooth interior a la vora de la llum: la llum ja no vessa ~1px passada la paret.** L'antialiàsing de la vora del farciment deixava d'esborrar foscor ~1px més enllà de la paret, i quan un token s'hi acostava es pintava un fil de llum a la sala del costat. Ara s'aplica una **erosió morfològica** (~1px cap endins) a la màscara de llum, així la llum s'atura una mica ABANS de la paret (per dins) i no toca la sala veïna.

### v3.99 pre-release 10
- **Fix del gradient de llum destruït a la zona de solapament.** Abans es pintava dues vegades la mateixa zona (farciment de la sala + polígon de visió), i on se superposaven l'alfa se sumava → aquella part sortia a plena brillantor i es "menjava" el gradient. Ara es calcula la **unió** (sala pròpia + vessament per portes) i s'aplica el gradient radial **una sola vegada** sobre aquesta unió (màscara + `source-in`). Les parets internes ja no fan ombra dins la sala; el raycasting només afecta el vessament cap a altres sales.
- **Tret el traç que il·luminava la vora exterior de les parets** (el smooth exterior). La llum s'atura net a la paret.

### v3.99 pre-release 9
- **Les sales noves neixen FOSQUES per defecte** (ja no cal activar-ho amb clic dret).
- **Fix boira "explorada": ja no surten zones explorades sense haver-hi entrat.** La memòria d'explorat ara només s'acumula **dins de sales fosques** i **dins del radi de visió** d'un token. Abans, qualsevol terra oberta que un token il·luminava quedava marcada; en crear-hi després una sala, sortia ja explorada. Ara una sala nova surt negra fins que un token hi entra i la veu.
- La zona de la teva pròpia sala que il·lumines (fins al radi) també queda marcada com explorada, així que no queden forats negres darrere d'estructures dins del radi.

### v3.99 pre-release 8
- **La llum il·lumina del tot la sala on és el token.** Dins de la teva sala veus **tot el radi de visió**, sense ombres internes de mobles, murs o estructures: l'oclusió (raycasting) només s'aplica per a la llum que s'escola cap a **altres sales** per portes i obertures. Abans, una paret o estructura dins de la sala projectava una ombra dins la mateixa sala (falca fosca dins del radi), que era el bug que es veia.
- **Mode debug de llum (tecla `L`)**: dibuixa les parets efectives (magenta), el polígon de visió (cian) i el radi (groc) per diagnosticar la il·luminació.

### v3.99 pre-release 7
- **Boira "explorada" (Age of Empires) recuperada i ben feta.** A les zones fosques ja vistes però ARA no il·luminades es mostra el **mapa de fons atenuat** (saps el terreny que hi ha), però **NO els tokens/enemics** (queden amagats sota la foscor). Les zones no explorades es mantenen negres i la zona il·luminada actual es veu en viu. La memòria (`_exploredCanvas`) acumula el que s'ha vist; es composita el terreny atenuat només a `explorat ∩ fosc-no-il·luminat`.
- **Moviment del token més ràpid (com abans) i més realista.** S'ha restaurat la velocitat i s'ha afegit suavitzat de camí (Chaikin): el recorregut vorejant parets és una **corba natural** en lloc d'una escala esglaonada. La velocitat és un sol paràmetre (`PATH_CRUISE`).

### v3.99 pre-release 6
- **Eliminada la boira "explorada" (AoE)** — no acabava de funcionar; s'ha tret del tot (codi i botó).
- **Moviment del token seguint el camí (forma d'L) MOLT més lent i suau**: velocitat de creuer lenta i constant amb frenada suau al final, en lloc del desplaçament massa ràpid.
- **Corregides les línies negres als bordes de sala il·luminada**: el gradient manté la brillantor plena fins al 90% del radi i s'afegeix un traç interior retallat que segella la vora arran de paret, sense tornar a vessar llum a la sala del costat.

### v3.99 pre-release 5
- **Mode boira "explorada" (estil Age of Empires).** Les zones fosques que ja s'han vist es mantenen amb una **foscor més clara** (saps el terreny però no hi veus enemics) en lloc de tornar-se negre del tot. S'acumula el que s'ha vist en una màscara en coords de mapa. Nou botó al panell del DM «🌫️ Boira explorada: ON/OFF» (per defecte **ON**), sincronitzat als jugadors.
- **Correcció de fuga de llum als bordes de sales adjacents.** La llum ja no vessa un marge il·luminat a la sala del costat quan hi ets a prop però fora: s'ha tret el blur i l'engreix del polígon de llum, així la llum s'atura **exactament a les parets** (la vora exterior suau la manté el gradient radial).
- **Moviment en L més lent i suau.** El desplaçament seguint el camí torna a tenir el mateix tacte que abans (ease-out per longitud d'arc), en lloc de la velocitat constant massa ràpida.
- **Les portes ja no fan snap a la graella si el "snap grid" està desactivat.**

### v3.99 pre-release 4
- **Moviment de tokens vorejant les parets (forma d'L).** En deixar anar un token, ara recorre el **camí real** calculat (voreja les parets, passa per les portes) en lloc de la línia recta, de manera que la seva llum ja **no talla per sales fosques que no travessa**. Es calcula amb Dijkstra (`computePath`), s'anima a velocitat constant i acaba exacte al destí; sense grid/parets manté el moviment recte de sempre. S'aplica a la pantalla del qui mou i, via `TOKEN_RELAY` (ara enviat també en combat, abans del `STATE`), a la resta de pantalles de jugador.

### v3.99 pre-release 3
- **L'abast de moviment (groc) es veu sobre les sales fosques.** Les caselles disponibles i el ghost del drag es pinten DAMUNT de la foscor, així es veuen encara que hi hagi una sala fosca a sobre.
- **A 0 de vida el jugador no pot moure el seu token** fins que recuperi vida (el DM sempre pot). Es bloqueja tant al drag des de `/player` com a la validació del DM.
- **Ajust de distàncies de llum.** El radi de llum es redueix en 1 casella (`visionFt/5 − 1`, mínim 1): es veu una mica menys.
- **El cegament (blinded) redueix la visió al mínim** (1 casella, 5 ft) mentre dura la condició.
- **Animacions de llum suavitzades**: (1) en morir un token, primer es veu l'animació de la X i després la llum s'esvaeix fins a 0; (2) els canvis de distància de visió (radi) s'animen suaument; (3) obrir/tancar una porta fa que la llum s'escoli/talli gradualment (obertura animada només per a la llum; la col·lisió segueix sent instantània).

### v3.99 pre-release 2
- **Previsualització del moviment de tokens (pantalla de jugador).** En arrossegar un token des de `/player`, ara es mostra un **ghost semitransparent** al destí mentre el token real es queda quiet: **cap sala s'il·lumina durant el drag** (el token encara no s'ha mogut). En deixar anar, el token fa l'**animació de desplaçament** (LERP) fins a la posició final i és llavors quan la llum es mou. El ghost es pinta fins i tot sobre la foscor perquè el jugador vegi on deixarà anar.
- **Control d'opacitat del fons (DM).** Nou control lliscant al panell inferior del DM per **abaixar l'opacitat del mapa de fons** només a la seva pantalla (ajuda per veure més clar sales, tokens i màgies quan hi ha molta informació). No afecta el que veuen els jugadors.
- **Correcció d'il·luminació de sales fosques.** Els marges de la sala ja no es veien foscos tot i tenir el token dins del radi de llum: el gradient manté la brillantor plena fins al 80% del radi i el polígon de llum s'engreixa cap enfora amb el mateix gradient per compensar el desenfocament dels marges, de manera que la llum arriba fins a les parets.
- **Portes amb dos clics.** Nou sistema de col·locació de portes: **primer clic** marca l'inici de la porta sobre la paret; **segon clic** en fixa el final (l'amplada). Substitueix l'amplada fixa amb `+/−`. Maj+2n clic per col·locar-ne una altra seguida; Esc desfà el primer clic o omet.
- **Els dibuixos a ploma ara es veuen al jugador en carregar una partida** (i en connectar-se tard). El missatge `STRUCT` porta l'historial de traços (`strokeHistory`) i el jugador reconstrueix el `drawCanvas`; abans els traços només es propagaven de manera incremental i una pantalla que no hi era quan es van dibuixar (o després de carregar una partida) no els veia.

### v3.99 pre-release 1
- **Desar/carregar partides al servidor (meitat frontend, PRE-RELEASE).** Implementat el costat de l'app del recurs `Session`: nou client HTTP a `src/lib/api.ts` (`api.sessions` list/get/create/update/delete + `isAdminLoggedIn`) i un panell modal («☁ Partides al servidor», a `BottomControls`) per desar la partida actual amb nom, sobreescriure'n una d'existent, carregar-la o eliminar-la. El botó només apareix si `NEXT_PUBLIC_API_URL` està configurat; si el DM no està loguejat al back office, el panell ho indica i l'app continua funcionant amb el save/load a `.json`. Marcat com a **pre-release**: requereix que la API tingui desplegats els endpoints `/sessions` (contracte a `api-spec.txt`) perquè el desat al servidor funcioni de veritat. La versió es mantindrà com a pre-release fins que el circuit complet estigui verificat en producció.

### v3.99
- **Portes tancades per defecte i toggle amb el cursor normal.** Les portes noves neixen **tancades** (bloquegen llum i moviment fins que s'obren). Per obrir-les o tancar-les ja no cal cap eina: amb el **cursor de selecció normal**, en passar per sobre d'una porta aquesta es **destaca** (traç brillant + halo, cursor en forma de mà, com un botó web) i un **clic la commuta**.
- **Colors unificats.** La porta usa el mateix daurat que les parets. **Tancada → l'interior del rectangle es pinta**; **oberta → buit per dins** (com fins ara). La previsualització de col·locació ja es mostra tancada.

### v3.98
- **Obrir i tancar portes.** Amb l'eina Parets, un **clic sobre una porta** la commuta: tancada torna a bloquejar la llum i el moviment (com si la paret fos sencera); oberta hi deixa passar tot. Les portes noves neixen obertes.
- **Nou aspecte de les portes.** Cada porta es mostra com un **rectangle groc de traç gruixut i buit per dins**, muntat sobre la paret (estil plànol). Amb la porta oberta, el forat de la paret es veu dins del rectangle; amb la tancada, la línia de paret el travessa i el rectangle queda lleugerament farcit.
- **Marges de llum difuminats.** La llum dels tokens a les sales fosques ja no acaba amb un tall dur: les vores del con de llum i de les ombres es **difuminen** suaument (blur en la composició de la capa de llum).

### v3.97
- **Portes explícites a les parets.** En tancar una sala nova amb l'eina Parets s'obre automàticament el **mode de col·locació de porta**: la previsualització llisca sempre **imantada a la paret** més propera sota el cursor (amb snap a caselles exactes quan hi ha grid) i un clic la col·loca; **Esc** l'omet. La porta obre un forat real a la paret: **la llum i el moviment hi passen**, i el forat es veu al traç de la paret (marca verda amb brancals).
- **Múltiples entrades i mides de porta.** Durant la col·locació, **+/−** canvia l'amplada de la porta (1–10 caselles; l'amplada es recorda i el rètol la mostra en peus) i **Maj+clic** col·loca la porta i continua en mode porta per posar-ne més seguides. També es poden afegir portes en qualsevol moment des del menú contextual de sala ("🚪 Afegir porta") i esborrar-les amb **clic dret** a sobre (eina Parets). Si s'esborra la paret, la porta cau sola. Les portes es sincronitzen al jugador i persisteixen a la sessió.

### v3.96
- **Sistema d'il·luminació a les sales fosques.** Cada token de jugador emet llum dins del seu **radi de visió** (`Visió a les fosques`, configurable per jugador al panell, per defecte 30 ft; 0 = sense llum). En entrar en una sala fosca, la foscor s'esvaeix gradualment al voltant del token (gradient radial) i **les parets bloquegen la llum** (línia de visió per raycasting): la llum s'escola per les obertures/portes però no travessa les parets. El DM veu els mateixos forats de llum sobre el seu overlay semitransparent, per saber exactament què veuen els jugadors.
- **Col·lisions de moviment amb les parets.** Els tokens de jugador ja no poden travessar parets des de la pantalla de jugador: per anar d'una sala a una altra cal passar per una obertura (porta). Amb grid, el disc de moviment (velocitat o peus restants en combat) queda restringit a les caselles amb **camí transitable** (Dijkstra que no creua parets) i **el desvium es cobra**: vorejar una paret per la porta costa el camí sencer, no la línia recta — la pintura groga i el clamp del drag ho mostren igual; sense grid, el token **llisca** per la paret. El DM valida cada `TOKEN_MOVE` amb la mateixa lògica (rebot amb `TOKEN_RELAY` si no hi ha camí) i el DM segueix movent sense cap límit.
- Les parets ara es sincronitzen a la pantalla de jugador (camp pesat `walls` a `STATE`/`STRUCT`) per a la llum i les col·lisions; continuen sense dibuixar-s'hi.

### v3.95
- **Contracte API per desar partides al servidor (back office).** S'ha definit a `api-spec.txt` el nou recurs `Session` (partida) i els endpoints `GET/POST/PUT/DELETE /sessions` per guardar i carregar l'estat complet d'una partida al servidor, com a alternativa al save/load a `.json` (que es manté per a ús offline). La implementació del frontend queda pendent que la API tingui els endpoints desplegats.

### v3.94
- **Nou previsualitzador d'enemics al grid (back office).** Al modal d'editar/crear enemic, el vell punt de color sense referència s'ha substituït per una mini-porció de mapa amb la **graella groga de 5 peus**: mostra com quedaria el token de l'enemic (color + imatge + inicials) a la seva mida real relativa al grid (el camp `sm` és el diàmetre en caselles) al costat d'un **token de Jugador estàndard de 5 peus**, per comparar-ne la mida d'un cop d'ull. Cada token porta la seva etiqueta amb l'equivalència en peus.

### v3.93
- **Botó de Party actualitzat amb els jugadors actuals.** El botó "Party" ja no genera "Jugador 1–5" genèrics, sinó els cinc personatges de la campanya: **Jaume III** (vermell), **Liriandor** (blau), **Yunquerin** (groc), **Espardeny** (verd) i **Cigarramic** (lila). La vida (hpMax) és provisional (45 a tots) perquè els personatges han pujat de nivell i encara no en tenim els valors reals; s'ajustaran des del panell de jugadors quan es confirmin.

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
