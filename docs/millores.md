# Millores — checklist

> Checklist viu per sobreviure al compactat del context. Marcar el que es fa.

## Lot A — Polit d'UI i textos
- [x] 1. Bestiari tallat: graella `1fr 1fr` → `minmax(0, 1fr)` (v4.77)
- [x] 2. Mida inconsistent Castell de la Fumarola / Bestiari: era el mateix defecte; ara comparteixen `GRID`
- [x] 3. «Party»/«la colla» → «DIVAS» (text visible; identificadors intactes)
- [x] 4. Textos tipus tutorial (v4.78; #16 TurnTracker, #7 sense ShortcutsHelp)
- [x] 5. Botons de mida estable: Partida, Pantalles, Desfer, punts d'estat, Copiar (v4.77)
- [x] 6. Icones + ☰ (v4.78). Pendent d'ajustar segons ús
- [x] 7. Menú principal: ☰ a la dreta (no a l'esquerra), Vista dins (v4.78)
- [x] 8. Alternativa A: rail de la dreta (v4.78)

### Anotat fora d'abast
- El lateral té un `ScrollArea` dins d'un altre (`SidebarSection maxBodyHeight={420}` a Biblioteca): doble scroll a pantalles baixes.
- Textos de FloatingToolbar (radi de llums) i resta de TurnTracker no tocats (fora d'abast).
- Pendent: línia de dreceres de la paleta de caselles a `ShortcutsHelp`.

## Dades (lot D+E) — dades, API i decisions

**Estat:** FASE 2 en marxa a la branca `claude/zen-hypatia-48d1jp` (a `master` en acabar).
Respostes de l'usuari (després de la fase 1): a) d'acord; b) només vol que la web tingui contrasenya i la pantalla de
jugador no; c) d'acord, s'anirà revisant; d) volia dir **fer tokens nous a partir dels sprites** (soldat amb
armadura daurada, equipar tokens amb objectes); e) els prompts de la API, quan la resta estigui resolta.
La frase «Posar únicament …» no tenia més sentit: un sol bestiari on els de la BD desapareixen sense connexió.

### Checklist

- [x] a) Mapa de l'estat actual + estructura final proposada
- [x] a) **Un sol bestiari** a la Biblioteca: els de la BD barrejats per projecte (icona BD); sense connexió no hi són (v4.81)
- [x] b) **Contrasenya de la web** sense API: `SITE_PASSWORD` a Vercel, cookie httpOnly, `proxy.ts`; `/player` lliure (v4.81)
- [ ] b) Configurar `SITE_PASSWORD` i `SITE_SECRET` a Vercel i tornar a desplegar (**ho ha de fer l'usuari**)
- [x] c) PNJ: recomanació aprovada (camp `role`); s'anirà revisant
- [ ] c) `LibEnemy.role` + filtres (Iniciar torns «Tots», XP, ressaltar, extres de la cinemàtica)
- [x] d) Anàlisi dels sprites + maqueta de recolorit (opcions a «d) bis»)
- [x] d) Estudi dels objectes + prototip de re-pixelat (`scripts/sprite-kit-prototype.py`), a «d) ter»
- [x] d) Triada l'**opció 2** (peces retocades a mà + Forja), només bases d'home, casc centrat
- [x] d) Forja v1 (v4.82): `kit.ts` + `kit-art.json` + `ForgePanel` + equipament al menú del token; 0 px de diferència app ↔ script
- [ ] d) Retoc de l'art segons ús (peces que no agradin, més armes o cascos); més endavant, bases de dona/goblin/esquelet
- [ ] d) Figuretes de la Forja a la BD: el camp `sprite` del prompt de la API ha de ser ≤120 (receptes de ~50 caràcters)
- [ ] e) Prompts definitius per a `divas_tragonas_api` (quan a–d estiguin resolts): `role`/`sprite`/`notes` + seguretat de la API
- [ ] FASE final: verificar la API amb `curl`, back office «Criatures» amb Rol/Figureta/Notes, i pujar a `master`

### a) Unificar «Base de dades» amb «Enemics» i «Aliats»

**Estat actual**

| On | Què hi ha | D'on surt |
|---|---|---|
| DM · Biblioteca (`EnemyLibraryPanel`) · **Enemics** | Genèriques + Castell de la Fumarola + bestiari Oryx (només app Píxel) | Codi: `ENEMY_TEMPLATES` / `creatureTemplate` (`lib/bestiary.ts`) |
| DM · Biblioteca · **Aliats** | Sildar, Gota, Roc (`ally: true`, XP 0) | Codi: `ALLIES` (`lib/bestiary.ts`) |
| DM · Biblioteca · **Base de dades** | Enemics del back office, agrupats per projecte/categoria | API `GET /enemies` (sense login) |
| DM · Escena (`SceneEnemiesPanel`) | Tokens a l'escena, partits per `LibEnemy.ally` | `libEnemies` (STATE) |
| Back office `/admin/enemics` | CRUD només dels de la BD | API `POST/PUT/DELETE /enemies` |

Tres models per al mateix concepte: `EnemyTemplate` (codi: té `sprite`, `detail`, `ally`, `group`),
`ApiEnemy` (BD: té `imageData`, `project`, `category`; **no** té `sprite`, ni `ally`, ni notes) i
`LibEnemy` (token a l'escena). Conseqüències: un enemic de la BD **no té figureta a l'app Píxel**,
**no pot ser aliat**, i un enemic de campanya es pot crear en dos llocs (una línia de codi o el back office).

**Estructura final proposada** — un sol «catàleg de criatures» amb el **rol** com a primer tall i el
projecte/categoria com a agrupació, sense importar d'on ve:

- Biblioteca: seccions **Enemics · Aliats · PNJ** (i més endavant **Objectes**, veure d). Cada secció
  barreja plantilles del codi i entrades de la BD (aquestes amb la icona de la BD). Cerca única a dalt.
  Desapareix la secció «Base de dades» com a bloc a part.
- Agrupació: la mateixa `useEnemyGrouping` (projecte/categoria). Les plantilles del codi reben
  `project` = `Castell de la Fumarola` / `Bestiari` perquè es puguin agrupar igual.
- Back office: «Enemics» → **«Criatures»**, amb columna i filtre de **Rol** i camps **Figureta**
  (selector de l'Oryx) i **Notes** (el `detail` de les plantilles).
- Codi: un tipus `CatalogEntry` i dos adaptadors (`fromTemplate`, `fromApi`) a `lib/bestiary.ts`; el
  `TemplateButton` i `addLibEnemy`/`addDbEnemy` passen a rebre `CatalogEntry`.

**Migració**

1. API: camps nous `role`, `sprite`, `notes` a Enemy (els documents antics llegeixen `role: 'enemy'`).
2. Frontend llegeix els camps nous amb defecte (una API antiga segueix funcionant, com `apiSupportsGroups`).
3. `LibEnemy.ally?: boolean` → `LibEnemy.role?: 'enemy' | 'ally' | 'npc' | 'object'`. Les partides
   desades i els mòduls (`useStory`) amb `ally: true` es llegeixen com `role: 'ally'` (no es perd res).
4. Opcional: botó al back office «Importar les plantilles de la campanya» (com «Importar les fitxes de
   Notion»): puja CASTLE/ALLIES a la BD (només els que no hi són pel nom). Després el codi es queda
   només amb les genèriques + Oryx com a reserva sense connexió.

> ❓ **Pendent:** la frase «Posar únicament …» va quedar tallada. Segons com acabi, el punt 4 deixa de
> ser opcional (p. ex. «… la base de dades» = la BD passa a ser l'única font i el codi només és la llavor).

### b) Contrasenya

> **Decisió (v4.81):** contrasenya **de la web**, no de la API: `SITE_PASSWORD` al servidor de Next
> (Vercel), cookie httpOnly i `src/proxy.ts`. Tot demana la contrasenya menys `/player`. Funciona encara
> que la API estigui apagada. Detall a `docs/arquitectura.md` («Contrasenya de la web»). El que hi ha a
> sota és l'anàlisi inicial; els forats de la **API** (2 i 3) segueixen oberts i van al prompt de l'e).


**Estat actual:** una sola contrasenya (`POST /auth/login` a la API, que **no surt a `api-spec.txt`**)
→ JWT. El navegador el desa a la cookie `admin_token` **escrita per JavaScript** (no httpOnly) i
`src/lib/api.ts` la llegeix per enviar `Authorization: Bearer` a la API (un altre origen). `middleware.ts`
verifica el JWT (`JWT_SECRET`) **només a `/admin/*`**. Forats:

1. La vista del DM (`/`) és oberta: qui tingui l'URL fa de DM.
2. `GET/POST/PUT/DELETE /enemies` no demanen JWT: qualsevol pot esborrar el bestiari.
3. `NEXT_PUBLIC_SYNC_KEY` va dins del JS públic: qualsevol jugador pot connectar-se al WebSocket amb
   `role=dm` i enviar `STATE` com si fos el DM.
4. Token llegible per JS (XSS) i sense tancar sessió al servidor. A Next 16 `middleware.ts` està
   **obsolet**: el fitxer és `proxy.ts` (codemod `middleware-to-proxy`).

**Opcions**

| | Què és | Pros | Contres | Cost |
|---|---|---|---|---|
| **1. Clau compartida del DM, ben guardada (recomanada)** | Una contrasenya del DM. Login per un Route Handler de Next que crida `/auth/login` i posa la cookie **httpOnly, Secure, SameSite=Lax** (7–30 dies). `proxy.ts` protegeix `/` i `/admin/*` (`/player`, `/expositor`, `/_next`, `/sprites`, `/modules` queden oberts). El client demana el Bearer a `GET /api/auth/token` (mateix origen) i el té **només a memòria**. | Tanca els forats 1–4 sense comptes. Encaixa amb Vercel (front) + Tailscale (API), que són llocs diferents: una cookie posada per la API seria de tercers i Safari la bloqueja. Les partides grosses (desenes de MB) **no passen per Next** (Vercel talla a ~4,5 MB). | El Bearer segueix sent visible per JS mentre la pestanya és oberta (risc acceptable a aquesta mida). Una sola clau per a tothom que faci de DM. | ~1 dia front + ½ dia API |
| 2. Comptes per usuari (DM + jugadors) | Model User a la API (bcrypt, rols `dm`/`player`), login amb usuari i contrasenya. | Permetria que cada jugador vegi/editi la seva fitxa al mòbil i auditar qui fa què. | Ara no hi ha cap pantalla que ho necessiti; gestió de comptes, reset de contrasenyes. | 3–5 dies |
| 3. Mínim | Només ampliar el `matcher` a `/`. | 10 minuts. | Deixa els forats 2–4. | — |

**Què va on (opció 1)**

- **API:** JWT a les mutacions de `/enemies` (GET pot quedar obert per a la Biblioteca o demanar-lo
  també); WebSocket `role=dm` exigeix `&token=<JWT>` (el `SYNC_KEY` queda només per als clients);
  límit d'intents a `/auth/login`; claim `role: 'dm'` al JWT. Prompt 2.
- **Frontend:** `src/app/api/auth/{login,logout,token}/route.ts`, `src/proxy.ts`, la pàgina de login
  passa a fer `POST` al Route Handler, `lib/api.ts` agafa el Bearer de memòria (i el refà en un 401),
  `ws.ts` afegeix `&token=` en connectar com a DM. Variables al servidor de Next: `JWT_SECRET`
  (ja hi és) i la URL de la API.

### c) PNJ no enemics

**Conflictes si s'afegeixen avui com a `LibEnemy` (o com a aliats):**

- **Iniciar torns**: «Tots» marca **tots** els `libEnemies` visibles (`TurnTracker`, `allEnemyKeys`) →
  el botiguer entra a la iniciativa.
- **XP**: en acabar el combat es compten els derrotats amb XP; un PNJ amb XP la donaria.
- **Ressaltar enemics** (`render/tokens.ts`): ja exclou `ally`, no exclouria un altre rol.
- **Cinemàtica de boss** (`extras`: «enemics del grup») podria endur-se'l.
- **Jugadors**: el nom surt en vermell (`#ffaaaa`) igual que un enemic; la barra de vida es veu.
- Sincronització: **cap conflicte** — `libEnemies` ja viatja dins del STATE i un camp nou hi va opac.

**Categoria nova vs camp `role`**

| | Pros | Contres | Cost |
|---|---|---|---|
| Família de tokens nova (`npc_*`) | Separació total | Duplicar render, menú, `_cleanupTokenKey`, STRUCT, desfer, grups, selecció… (vegeu errors comuns: «Estat de token no purgat») | 3–5 dies, risc alt |
| **Camp `role` a `LibEnemy` i a Enemy (recomanat)** | Un sol tipus de token; tot el que ja funciona (moure, estats, diàlegs, grups) segueix igual; filtres explícits | Cal revisar la dotzena de llocs que recorren `libEnemies` (21 fitxers l'esmenten) | ~1 dia |

**Recomanació:** camp `role: 'enemy' | 'ally' | 'npc'` (substitueix `ally`). Regles: XP sempre 0 si
no és `enemy`; «Tots» a Iniciar torns només marca `enemy` (aliats i PNJ a part, desmarcats);
ressaltar i `extras` només `enemy`. El color del nom per rol a la pantalla de jugador és del lot de
render (anotat a «Fora d'abast»).

### d) Botí com a tokens (cofres, objectes al mapa)

**Estat actual:** el «Botí» és una pestanya de l'editor de caselles (`TilePalette`, app Píxel): claus
`i:<nom>` (`LOOT_KEYS`) de `ITEMS` (`uf_items.png`, 48 px: armes, armadures, pocions, claus, gemmes,
`chest_*`…). Es desen com a `TileObject { c, r, k }` dins del **mapa de caselles** (geometria
preparada, sense vida, sense moviment, no es poden revelar/amagar per separat). Els tokens
(`LibEnemy`) són una altra cosa: posició lliure, visibilitat, estats, menú del clic dret.

**Es pot reutilitzar?** Sí, i sense API (el catàleg d'objectes és al codi, no a la BD):

- Pas 1 (dades, aquest lot): pestanya **Objectes** a la Biblioteca amb els mateixos `LOOT_KEYS` i
  `tileThumb`; en clicar, crea un `LibEnemy` amb `role: 'object'`, `sprite: 'i:<nom>'`, sense vida
  ni XP, fora de torns, i el DM el mostra/amaga amb l'ull (un cofre que els jugadors encara no han vist).
- Pas 2 (lot de render, **fora d'abast**): pintar `sprite: 'i:…'` com a objecte (sense cercle, sense
  barra de vida, sense aro), també a l'app Clàssica. Mentrestant, com a solució provisional es pot
  posar el `tileThumb` a `imageData`: es veu dins del cercle de sempre.
- Opcional: «obrir el cofre» = canviar `chest_closed` → `chest_open` des del menú del token.

**Esforç:** pas 1 ~½ dia; pas 2 ~1 dia (render + pantalla de jugador). **Recomanació:** fer-ho via
`role: 'object'` (el mateix camp de c), no un tipus nou.

### d) bis — Tokens nous a partir dels sprites

**Primera proposta (descartada per l'usuari):** només recolorir figuretes existents. Era un pintat:
no canviava ni armes ni cascos.

### d) ter — Estudi: refer els objectes a l'escala de les figuretes («Forja»)

**Què representen els objectes** (`ITEMS`, `uf_items.png`):
- **Armadures:** 10 jocs (cloth, leather, studded, chain, plate, royal, gold, blood, mystic, wild) × 5 peces
  (casc, cos, guants, cames, botes). Cada joc té el seu casc propi: cimera daurada, visera de placa,
  gorra de cuir, cota de malla…
- **Escuts:** 4 formes (buckler, heater, kite, great) × 8 materials (wood, iron, gold, royal, elven,
  flame, ice, mystic, vorpal).
- **Armes:** ~35 formes (espasa, espasa ampla, falç, daga, destral, destral gran, maça, maça gran,
  martell, llança, llança gran, trident, bastons, arcs, ballesta…) més les sèries or, místic, vorpal i
  màgic (les mateixes formes amb una altra paleta).

**Densitat de detall (mesurat):**

| | Figureta (`uf_heroes`) | Objecte (`uf_items`) |
|---|---|---|
| Mida | cos ~20–31 × 31–36 px; cap ~7 px | casc 14×18–25, espasa 8×31, escut 22×22 |
| Colors | ~15 per figureta, sense contorn negre (tot és ombrejat) | 5–7 per objecte |
| Escala | 1× | **~2,2×**: cal reduir a ~0,45 |

**Base per vestir:** `prisoner_a/b/c` són **cossos nus** (maniquí): cap a les files 9–16, tors 14–23,
braços avall amb les mans a les files 24–26, cames 29–39. Animació d'espera de 3 fotogrames: el tronc baixa
0/1/2 px i les cames no es mouen. Per tant, cada peça només necessita aquest desplaçament per fotograma.

**Prototip** (`scripts/sprite-kit-prototype.py`): «re-pixelat» = reduir l'objecte a mida de figureta
(casc 7 px, escut 8–9, arma 11–21) i tornar cada píxel a la paleta del mateix objecte (sense mitges
tintes), més recolorir la pell del tors i de les cames amb els tons del joc d'armadura.
- ✅ Proporcions i siluetes bones: a mida de mapa es distingeixen el casc, la llança, la destral, el
  bastó i l'escut.
- ❌ Materials massa plans (un sol color per a tot el cos); el peto reduït queda empastat; no hi ha
  el contrast metall + roba + pell de les figuretes originals.
- Conclusió: l'automàtic resol la **forma**, però el **material del cos** s'ha de dibuixar a mà.

**Proposta: «Forja» de figuretes** (sense API; les dades van al camp `sprite` que ja existeix)
- **Recepta** com a clau de figureta: `kit:<base>|<armadura>|<casc>|<arma>|<escut>`
  (p. ex. `kit:prisoner_a|gold|gold|broadsword|gold_heater`). Funciona per a plantilles, tokens i
  partides desades. Per a la BD, el camp `sprite` del prompt de la API ha de ser ≤120 caràcters.
- **Full de peces** `public/sprites/kit.png`, generat pel script i **retocat a mà**:
  - 10 cossos i 10 cames (un per joc, amb 3 tons i un accent de roba);
  - 10 cascos;
  - ~12 armes de forma diferent (les sèries or, místic i vorpal són canvis de paleta);
  - 4 escuts (els materials són canvis de paleta).

  En total, unes 46 peces petites.
- **Execució:** la figureta es compon un cop, en carregar (3 fotogrames, a memòria cau, amb
  `figureGradeKey()` a la clau), i es registra com una criatura més. `drawCreature` i la resta no
  canvien gaire (un `if` per a `kit:`; és del lot de render).
- **UI:** pestanya «Forja» a la Biblioteca. Hi tries base, armadura, casc, arma i escut, la
  previsualització es mou i, en desar-la, queda com a plantilla.
- **«Equipar» tokens actuals:** només es pot amb les figuretes de la Forja, perquè tenen capes. Les
  figuretes Oryx fixes (`knight`, `warrior_m`…) no tenen capes: canviar-los l'arma voldria dir
  esborrar-ne píxels a mà, una per una.

**Opcions:**

| | Què | Qualitat | Cost |
|---|---|---|---|
| 1 | Automàtic, com el prototip, millorat | mitjana (com la maqueta) | ~1,5 dies |
| 2 (recomanada) | Kit generat + **retocat a mà** + Forja | propera a l'Oryx | 3–4 dies |
| 3 | Només 8–10 figuretes acabades (sense Forja ni combinacions lliures) | alta | ~1,5 dies |

Preguntes obertes: quines bases (homes, dones, també goblins o esquelets equipats?) i qui retoca els
píxels (jo per codi, o tu amb Aseprite sobre el full generat).

**Decisió (v4.82):** opció 2, bases d'home (`prisoner_a/b/c`), el retoc el fa Claude per codi. Detall
tècnic a `docs/pixel-i-missions.md` («Forja de figuretes»). El casc del prototip anava d'1 px a la dreta
(7 px de la columna 22 a la 28 sobre un cap de la 21 a la 26): ara els cascos fan 8 px, de la 20 a la 27.

### Prompts per a `divas_tragonas_api`

> Es lliuraran definitius quan a–d estiguin resolts (petició de l'usuari). Esborrany:

**Prompt 1 — rol, figureta i notes a Enemy (a, c, d)**

```
Modifica la API (divas_tragonas_api) per afegir rol, figureta i notes al model Enemy.

CANVI 1 — Model Enemy (app/src/modules/enemies/enemy.model.ts)
Afegir camps:
- `role: String` enum ['enemy','ally','npc','object'], per defecte 'enemy'
- `sprite: String` (trim, màx. 60), per defecte ''  — nom de la figureta Oryx (p. ex. "goblin_warrior")
  o d'un objecte ("i:chest_gold"); '' = sense
- `notes: String` (trim, màx. 300), per defecte ''  — text curt per al DM

CANVI 2 — Validació (enemy.schema.ts)
- `role: z.enum(['enemy','ally','npc','object']).optional().default('enemy')`
- `sprite: z.string().trim().max(60).optional().default('')`
- `notes: z.string().trim().max(300).optional().default('')`
Al PUT, només es toquen si venen al body (com `project`/`category`). Fora de rang → 400.

CANVI 3 — Respostes de GET /enemies, POST /enemies, PUT /enemies/:id
Han de retornar SEMPRE els tres camps, també als documents antics ('enemy', '', '').

CANVI 4 — XP
Si `role` != 'enemy', la API desa igualment l'`xp` que rebi (el frontend el força a 0); no cal lògica.

Motiu: el frontend unifica la Biblioteca (Enemics · Aliats · PNJ · Objectes) en un sol catàleg i
necessita marcar el rol i la figureta de l'app Píxel dels enemics de la BD.
```

**Prompt 2 — seguretat (b)**

```
Modifica la API (divas_tragonas_api) per tancar l'accés sense contrasenya.

CANVI 1 — Rutes /enemies
POST /enemies, PUT /enemies/:id i DELETE /enemies/:id demanen el JWT admin
(Authorization: Bearer <token>), com /sessions i /characters. Sense token vàlid → 401
{ "error": "unauthorized" }. GET /enemies queda obert (lectura de la Biblioteca).

CANVI 2 — POST /auth/login (ja existeix; documentar-lo i endurir-lo)
Body: { password: string }. 200 → { token: string, expiresAt: string (ISO 8601) }.
401 → { "error": "Contrasenya incorrecta" }.
- Afegir al payload del JWT `role: 'dm'` i `exp` (30 dies).
- Límit d'intents: màx. 10 per IP cada 15 minuts → 429 { "error": "Massa intents" }.

CANVI 3 — WebSocket /sync
- role=client: com ara (`&key=<SYNC_KEY>` si està configurat).
- role=dm: a més de la key, exigir `&token=<JWT>` vàlid amb role 'dm'. Si no → tancar amb codi
  4403 i motiu "dm token required". Si JWT_SECRET no està definit (ús LAN), no exigir-lo.

CANVI 4 — CORS
Afegir `Authorization` a Access-Control-Allow-Headers (si no hi és).

Motiu: la SYNC_KEY va dins del JS públic del frontend, així que qualsevol jugador podia fer de DM
pel WebSocket, i qualsevol podia esborrar enemics de la BD.
```

### Fora d'abast (anotat, no tocat)

- Render: pintar `sprite: 'i:…'` com a objecte i color del nom per rol a la pantalla de jugador (lot de render).
- Lot A: el lateral té doble scroll a la Biblioteca (`SidebarSection maxBodyHeight`), ja anotat al lot A.

## Lot B — Tokens (render i interacció)

Decisions de l'usuari: ombra al centre de la cel·la (la figura la trepitja); fix mínim a `useDMActions` (radi ↔ posició dels jugadors); el «submenú» és `ContextMenuOverlay`; la tasca 4 queda per després.

- [x] 1. Halos: jerarquia (v4.79 amb claudàtors; a la v4.80 tornen a ser tres anells, veure Ronda 2)
- [x] 2. Centroide: ombra i peus de la figura al centre de la cel·la; figura centrada pel seu contingut real (bbox alfa, per sprite); ombra dels discos concèntrica
- [x] 2b. `sizeAllTokens` / reset d'AutoSize compensen la posició dels jugadors (cantonada + R)
- [x] 3a. Hit-test únic (`lib/render/token-geom.ts`) en ordre z visual; el seleccionat es pinta i es clica a sobre
- [x] 3b. Tokens apilats: s'obren en passar-hi per sobre (offset visual, animat al rAF), tolerància `TOKEN_STACK_TOL`
- [x] 4. Colors i textures del grup (v4.95): figuretes pròpies `templar_axe` (Jaume) i `warrior_green` (Espardeny), Liriandor `wizard`, Cigarramic `halfling_thief~2`
- [x] 5. Menú del token (`ContextMenuOverlay`) al costat del token, centrat verticalment i dins la pantalla
- [x] Verificació: tsc + lint + captures (1, 2 apilats, 5 junts, vora, zoom)
- [x] CHANGELOG + APP_VERSION + docs

### Ronda 2 (v4.80, comentaris del DM)
- [x] Halos: tornen a ser tres anells (selecció blava discontínua de sempre), cadascun al seu carril a distància fixa de l'ombra/vora
- [x] Peus i ombra una mica per sota del centre de la casella (`FOOT_DROP` 0,3·R)
- [x] Salt en canviar la mida d'un jugador (pantalla de jugador: LERP de la cantonada) corregit
- [x] Ventall: espera de 0,4 s i augment del token assenyalat
- [x] Menú: Dades, Conjurs, Estats, Parla, Nivell

- [x] Torn i ressaltar enemics: sense aro daurat/groc; el halo de color es queda al seu lloc, més gruixut, una mica més viu i amb un vel que respira (v4.85, opció B)
- [x] Ordre dels halos de dins a fora (estats < color < selecció) i halo de color amb +15 % de saturació (v4.90)

### Fora d'abast (anotat, no tocat)
- El menú no segueix el token si canvia de mida (capsa del moment d'obrir-lo).
- `usePlayerTokenDrag` (pantalla de jugador) té el seu propi hit-test circular: no fa servir el nou `token-geom` (no agafa el cap de les figuretes).
- La selecció per marquee (`useMouseHandlers`, `inside(...)`) llegeix els centres a mà; funciona, però podria passar per `tokenSlots(R, false)`.
- `selectAndArmDrag` afegeix el token a la selecció múltiple encara que només n'hi hagi un de seleccionat (clic a A i després a B → tots dos seleccionats). Comportament previ; revisar si és volgut.
- Les figuretes es pinten en ordre d'array, no per Y: en una vista 3/4, la de més avall hauria de tapar la de dalt. Canviar-ho també canviaria l'ordre z del hit-test.
- ~~Al tàctil no hi ha hover~~ — resolt a la v4.95: pulsació llarga a la pantalla de jugador.

## Lot C — Interacció: desfer global, sales, portes (v4.87)

Decisions de l'usuari: model aprovat + eliminar tokens també es desfà; «sala seleccionada» = la sala fosca ressaltada (ull) i el clic la commuta; les portes dolentes són les del mode Píxel (peces del sprite), resoltes mirant els exemples del paquet; push a `master`.

- [x] 1a. Inventari del que entrava a l'historial
- [x] 1b. Model: pila única d'ordres reversibles (veure `docs/ui-dm.md`, «Desfer / refer únic»)
- [x] 1c. Implementació: tokens (moure, PV, estats, derrotat, mida, visibilitat, eliminar), geometria, portes, sales, llums, zones, traços, moviments de combat; refer (Ctrl+Maj+Z, Ctrl+Y, botó); límit 100; agrupar clics seguits
- [x] 1d. Prova llarga (Playwright): 21 accions → desfer fins a l'inici → refer fins al final; DM (export .json) i jugador (BroadcastChannel) idèntics als dos extrems, cap error
- [x] 2. Clic a la sala ressaltada = revelar/amagar d'un sol gest (tokens i portes primer)
- [x] 3. Portes Píxel: peces col·locades com a `uf_example_*.tmx` (vora sota la porta lateral, ombra de la porta horitzontal, mur de dues files); captures abans/després
- [x] tsc + lint (cap error de tipus; el lint només afegeix avisos del mateix patró que ja tenia el fitxer: refs mutades dins de `useCallback`)
- [x] CHANGELOG + APP_VERSION + docs (`ui-dm.md`, `mapa-sales-llum.md`)

### Ronda 2 (v4.88, comentaris del DM)
- [x] Fil negre arran de paret a la sala il·luminada: la foscor ja no s'eixampla amb un contorn (`fillDarkness`)
- [x] Portes Píxel tallades per la foscor: es tornen a pintar per sobre (`drawTileDoorsOver`)
- [x] ~~Portes laterals dobles~~ — tretes a la v4.89 a petició del DM (cada casella és una porta)

### Ronda 3 (v4.89)
- [x] Fil negre: al jugador ja no en queda cap (mesurat: el píxel de la vora passa de 74/57 a 174/133, el valor del terra)
- [x] Portes horitzontals seguides: el mur entre portes ja no és un pilar solt
- [x] Fora les portes dobles

### Ronda 4 (v4.91)
- [x] Mapa de caselles: no es pot passar per una porta tancada, ni estar-hi a sobre, ni a sobre d'una paret o al buit (rang del jugador + validació del DM). Provat amb Playwright: abans travessava la porta tancada; ara s'atura a la casella del davant
- [ ] Pendent de decidir: si el DM també ha de quedar limitat en arrossegar (ara mou lliure, com sempre)

### Fora d'abast (anotat, no tocat)
- Afegir tokens (DIVAS, un enemic de la biblioteca) no es desfà: només eliminar-los.
- «Estat» sobre una selecció múltiple des del menú fa una entrada per token (treure'ls tots sí que és una sola).
- Dibuixar una sala nova contra una paret que ja té porta (classe Clàssica) no la detecta si es comença a la cantonada: cal partir-la des de dins (vist en reproduir les portes).
- ~~Els llocs de missió (`pd_`)~~ — eliminats amb Cony Cirera (v4.94).
- Les ordres de desfer apilen fins i tot canvis que no canvien res (−1 PV amb 0 PV); són inofensius però ocupen una entrada.

## Ronda de neteja (v4.94–v4.95)
- [x] Fora Cony Cirera i el sistema de missions sencer (decisió de l'usuari): mapa, cases, full de poble, scripts, ajust de color, escenes/llocs, mòduls d'exemple. Es manté la demo de la taverna i el tauler de missions de la wiki
- [x] Colors i figuretes de la colla (v4.95)
- [x] Ventall dels apilats amb pulsació llarga a la pantalla de jugador (v4.95)
