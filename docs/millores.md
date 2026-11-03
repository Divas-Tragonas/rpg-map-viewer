# Millores en curs (checklists per lots)

> Cada lot té el seu apartat. Marca `[x]` el que està fet; el que surt fora d'abast s'anota
> a «Fora d'abast» del lot i no es toca. Sobreviu al compactat del context.

---

## Dades (lot D+E) — dades, API i decisions

**Estat:** FASE 1 lliurada (anàlisi + prompts). **Esperant confirmació** de l'usuari i
desplegament de la API abans de la FASE 2.

### Checklist

- [x] a) Mapa de l'estat actual Biblioteca/BD/Aliats + estructura final proposada
- [ ] a) Saber com acaba la frase tallada «Posar únicament …» (pregunta oberta)
- [x] b) Disseny de la contrasenya (opcions + recomanació)
- [x] c) NPCs no enemics: anàlisi de conflictes + recomanació
- [x] d) Botí com a tokens: anàlisi + recomanació
- [x] e) Prompts per a `divas_tragonas_api` + `api-spec.txt` (secció «PROPOSTA PENDENT — lot Dades»)
- [ ] FASE 2: verificar la API amb `curl` (camps `role`, `sprite`, `notes`; 401 a les mutacions sense JWT)
- [ ] FASE 2: `ApiEnemy` + `LibEnemy.role` (`src/types`, `src/lib/api.ts`) amb lectura compatible de `ally`
- [ ] FASE 2: catàleg unificat (adaptadors `fromTemplate` / `fromApi`) a la Biblioteca
- [ ] FASE 2: back office `/admin/enemics` → «Criatures», camp Rol + Figureta + Notes, filtre per rol
- [ ] FASE 2: filtres de rol (Iniciar torns «Tots», XP, ressaltar, extres de la cinemàtica)
- [ ] FASE 2: login amb cookie httpOnly + `proxy.ts` (substitueix `middleware.ts`)
- [ ] FASE 2: botí com a token (`role: 'object'`, només dades; el pintat bo és d'un altre lot)

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
  barreja plantilles del codi i entrades de la BD (aquestes amb la icona del núvol). Cerca única a dalt.
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

### Prompts per a `divas_tragonas_api`

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
- `origin/master` i les branques: hi ha una altra branca amb `v4.77` (`claude/brave-brown-w4sa88`) encara no a master.
