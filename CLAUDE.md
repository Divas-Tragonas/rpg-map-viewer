@AGENTS.md

# RPG Map Viewer — CLAUDE.md

> **INSTRUCCIÓ OBLIGATÒRIA:** Llegir aquest fitxer sencer abans de fer qualsevol canvi.
> Actualitzar aquest CLAUDE.md sempre que s'afegeixi o canviï una funcionalitat.

---

## ⚠️ REGLA ABSOLUTA — Git

> **MAI crear branches. MAI fer pull requests. SEMPRE push directe a `master`.**
> Incomplir aquesta regla és un error crític. No hi ha excepcions.

Workflow obligatori després de cada canvi:
```bash
git add -p
git commit -m "Títol del canvi"
git push origin master
```

**Versió a la pantalla de benvinguda** (`src/components/DMView.tsx`): actualitzar-la sempre que pugi la versió al README.

---

## Git workflow

### Autenticació GitHub — OBLIGATORI

El remote `origin` ha d'apuntar a la URL amb el PAT inclòs. El token es guarda a `.git/config` (no commitejat).

**Al inici de cada sessió nova**, verificar i configurar si cal:

```bash
# Verificar si el remote ja té el token:
git remote get-url origin   # ha de contenir "oauth2:github_pat_..."

# Si NO el té, configurar-lo (substituir TOKEN pel PAT real):
git remote set-url origin https://oauth2:TOKEN@github.com/Divas-Tragonas/rpg-map-viewer.git
```

> **Nota:** El PAT real no es desa al repositori per seguretat (GitHub push protection el bloqueja). El propietari del repo el té guardat fora del codi.

### Versió i changelog — OBLIGATORI en cada push

**Abans de cada commit**, actualitzar el `README.md`:
1. Incrementar la versió (`vX.Y` → `vX.Y+1`) al títol de l'entrada més recent del Changelog
2. Afegir un nou bloc al Changelog amb la versió nova i un resum dels canvis:
   ```markdown
   ### vX.Y+1
   - Descripció breu del canvi 1
   - Descripció breu del canvi 2
   ```
3. Incloure el `README.md` al commit

---

## ⚠️ REGLA ABSOLUTA — Canvis que requereixen modificar la API

> **MAI implementar codi frontend que depengui d'un endpoint o camp que encara no existeix a la API.**
> Incomplir aquesta regla causa errors silenciosos en producció que són difícils de diagnosticar.

Quan un canvi al frontend requereix modificar o ampliar la API (`divas_tragonas_api`), el flux **obligatori** és:

### Pas 1 — Detectar la dependència

Abans de tocar cap fitxer frontend, identificar si el canvi necessita:
- Un endpoint nou
- Un camp nou en un model existent
- Un canvi en la resposta d'un endpoint existent
- Un canvi d'autenticació o permisos

Si la resposta és sí a qualsevol dels anteriors → **ATURAR** i anar al Pas 2.

### Pas 2 — Generar el prompt per a la sessió de la API

Generar un bloc de text complet i autònom per enganxar a la sessió de `divas_tragonas_api`. El prompt ha d'incloure:

1. **Què cal canviar** — endpoint, mètode HTTP, ruta exacta
2. **Esquema de la petició** — body JSON amb tots els camps i tipus
3. **Esquema de la resposta** — camps retornats i codi HTTP esperat
4. **Canvis al model** — si cal afegir camps al mongoose schema
5. **Context mínim** — per què és necessari (una frase)

Exemple de format:

```
Modifica la API (divas_tragonas_api) per afegir suport per a [X].

CANVI 1 — Model Enemy (app/src/modules/enemies/enemy.model.ts)
Afegir camp: `tags: [String]` (opcional, per defecte [])

CANVI 2 — Endpoint existent PUT /enemies/:id
Ha de acceptar i retornar el nou camp `tags` a la resposta.

CANVI 3 — Validació (enemy.schema.ts)
Afegir `tags: z.array(z.string()).optional().default([])`

Motiu: el frontend necessita etiquetar enemics per filtrar-los al panell del DM.
```

### Pas 3 — Presentar el prompt a l'usuari i ATURAR

Mostrar el prompt generat i escriure **exactament**:

> "He detectat que aquest canvi requereix modificacions a la API. Aquí tens el prompt per enganxar a la sessió de `divas_tragonas_api`. Quan hagis aplicat i desplegat els canvis, torna aquí i continua."

**No escriure cap codi frontend fins que l'usuari confirmi que la API està actualitzada i desplegada.**

### Pas 4 — Verificació abans de continuar

Quan l'usuari torni i digui que la API ja té els canvis, **verificar activament**:

```bash
curl http://[NEXT_PUBLIC_API_URL]/[endpoint] ...
```

Si la resposta conté els camps esperats → continuar amb el frontend.
Si no → informar l'usuari i no avançar.

### Actualitzar `api-spec.txt`

Sempre que es detecti o implementi un canvi a la API, actualitzar `api-spec.txt` per reflectir l'estat actual del contracte. Aquest fitxer és la font de veritat compartida entre els dos repositoris.

---

## Stack

| Element | Detall |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Render | Canvas 2D API (`useRafLoop` → `tick()`) |
| Fons | Element DOM `<img>` o `<video>` posicionat absolutament darrere del canvas |
| Sync | `BroadcastChannel` (`BC_CHANNEL = 'rpg_map_sync_v18'`) — DM envia, Jugador rep |
| PSD | Parser binari propi a `src/lib/psd/` (sense dependències) |
| Dev server | `npm run dev` → `http://localhost:3001` |

---

## Rutes de l'app

| URL | Component | Descripció |
|---|---|---|
| `/` | `DMView` | Vista del Dungeon Master (pantalla principal) |
| `/player` | `PlayerView` | Vista del jugador (pantalla secundària) |
| `/expositor` | `ExpositorPage` | Pantalla d'expositor de campanya (imatge/vídeo) |

---

## Estructura de fitxers

```
src/
├── app/
│   ├── layout.tsx          # RootLayout
│   ├── page.tsx            # → <DMView />
│   ├── player/page.tsx     # → <PlayerView />
│   └── expositor/page.tsx  # Expositor de campanya
├── components/
│   ├── DMView.tsx          # Component principal DM (estat + orquestració)
│   ├── PlayerView.tsx      # Component jugador
│   ├── icons.tsx           # Icones SVG inline
│   ├── dm/                 # Panells i overlays del DM
│   │   ├── ImportPanel, LayerTree, PlayersPanel
│   │   ├── FloatingToolbar, GridPanel, EnemyLibraryPanel
│   │   ├── BottomControls, CanvasHUD
│   │   └── ContextMenuOverlay, SceneConfigOverlay,
│   │       SpellMenuOverlay, ShapeMenuOverlay
│   └── ui/                 # Components UI genèrics
│       ├── Chip, DropZone, LayerRow, TreeGroup, SceneImgPicker
├── hooks/
│   ├── useDMRefs.ts        # Tots els refs del DM (state mirrors + interaction)
│   ├── useDMActions.ts     # Callbacks d'acció (PSD import, BC, drag...)
│   ├── useCinematic.ts     # Lògica cinematica boss reveal
│   ├── useRafLoop.ts       # RAF loop (tick) + totes les render phases
│   ├── useMouseHandlers.ts # Gestors de ratolí
│   ├── useKeyboardHandlers.ts
│   └── useWheelZoom.ts
├── lib/
│   ├── psd/
│   │   ├── parser.ts       # parsePSDStructure(buffer) → ParsedPSD
│   │   ├── extractor.ts    # extractLayerImages → Record<number, HTMLCanvasElement>
│   │   └── tree.ts         # buildTree, validateStructure → MapStructure
│   ├── render/
│   │   ├── types.ts        # FrameContext interface
│   │   ├── zones.ts        # renderZoneOverlays, renderExtras, renderPaintedZones, renderShapePreview
│   │   ├── drawing.ts      # advanceStrokeAnim, replayStroke
│   │   ├── spells.ts       # renderSpells (fireball, lightning, magic_beam)
│   │   ├── tokens.ts       # renderEnemyTokens, renderLibEnemyTokens, renderPlayerTokens
│   │   └── grid.ts         # renderGrid, renderGridCalib, renderDMPointer
│   ├── cinematic/index.ts  # cpBurst, cpUpdate, cpDraw (partícules cinematica)
│   ├── textreveal/index.ts # RevealEngine + helpers (revelador de text DM/Jugador)
│   ├── conditions/index.ts # Helpers de condicions D&D
│   ├── geometry.ts         # getBBox i utilitats geomètriques
│   ├── textures/           # Textures procedurals (noise, elements)
│   └── enemy-images.ts     # ENEMY_IMAGES (imatges base64 enemics)
├── constants/index.ts      # CONDITIONS, ELEMENTS, PALETTE, ENEMY_TEMPLATES, C, BC_CHANNEL...
└── types/index.ts          # Tots els tipus TypeScript
```

---

## Arquitectura del DM

```
DMView (component React)
│
├── useState (UI state)             →  vis, pos, zoom, players, libEnemies...
├── useDMRefs() → R                 →  tots els refs (mirrors + interaction)
├── useDMActions(R, setters) → A    →  callbacks (importPSD, broadcastState...)
├── useRafLoop(R, opts)             →  tick() + render phases (60fps)
├── useMouseHandlers(R, A, ...)     →  drag, pan, draw, calibre grid
├── useWheelZoom(R, A, ...)         →  zoom roda del ratolí
├── useKeyboardHandlers(R, A, ...) →  ESC, Ctrl, Delete...
└── useCinematic(R, A, ...)         →  boss intro cinematica
```

---

## Render loop — tick() (`src/hooks/useRafLoop.ts`)

`tick()` s'executa cada frame via `requestAnimationFrame`:

1. Resize canvas si cal
2. Obtenció del `ctx` (cached a `_ctx2dRef`)
3. Càlcul de `mw, mh` (dimensions del mèdia de fons)
4. Animació de retorn vista privada DM (`dmPrivateReturnAnim`)
5. Càlcul de `z, pan` (cinematica cam o local+shared)
6. Càlcul de `sc, ox, oy` (scale i offset)
7. Sync posició DOM del fons (evita thrashing amb `prevBgStyle`)
8. `if (!s) return` — res a renderitzar sense PSD
9. **Construcció de `fc`** (`FrameContext`) — passat a totes les render phases
10. `ctx.save() / translate(ox,oy) / scale(sc,sc)`
11. Render phases (en ordre)
12. `ctx.restore()`
13. `renderGrid / renderGridCalib / renderDMPointer` (espai pantalla)
14. Cinematic tick (partícules)

### FrameContext (fc) — `src/lib/render/types.ts`

Objecte tipat (`FrameContext`) construït una vegada per frame i passat a totes les render phases. Inclou: `sc, ox, oy, mw, mh, isDM, s, v, pp` + tots els refs necessaris.

---

## Render phases — com afegir-ne una de nova

Les render phases viuen a `src/lib/render/`. Reben `(ctx: CanvasRenderingContext2D, fc: FrameContext)`.

```ts
// src/lib/render/fog.ts
import type { FrameContext } from './types';
export function renderFog(ctx: CanvasRenderingContext2D, fc: FrameContext) {
  const { sc, isDM, rGridSize } = fc;
  // ...
}
```

Afegir la crida a `useRafLoop.ts` entre `ctx.save()` i `ctx.restore()`.

**Regles crítiques:**
- Sempre destructurar els refs de `fc` — si no, `undefined` silenciós
- Si cal un ref nou, afegir-lo a `FrameContext` (types.ts) i a l'objecte `fc` de `useRafLoop.ts`

---

## Render phases existents

| Funció | Fitxer | Descripció |
|---|---|---|
| `renderZoneOverlays` | render/zones.ts | Zones: visibilitat, fade, eye-icon, etiquetes |
| `renderExtras` | render/zones.ts | Capa "extras" sempre visible |
| `renderPaintedZones` | render/zones.ts | Zones màgiques: textures animades (jugador) / flat (DM) |
| `renderShapePreview` | render/zones.ts | Preview del shape tool al DM |
| `advanceStrokeAnim` | render/drawing.ts | Reprodueix traços de dibuix frame a frame |
| `renderSpells` | render/spells.ts | Animacions: fireball, lightning, magic_beam |
| `renderEnemyTokens` | render/tokens.ts | Tokens enemics PSD: drag, LERP, condicions, derrota |
| `renderLibEnemyTokens` | render/tokens.ts | Tokens biblioteca d'enemics lliures |
| `renderPlayerTokens` | render/tokens.ts | Tokens jugador: LERP, condicions |
| `renderRooms` | render/darkrooms.ts | Sales fosques: foscor (jugador) / overlay+contorn+ull (DM) |
| `renderWalls` | render/darkrooms.ts | Parets dibuixades pel DM (no visibles al jugador) |
| `renderWallDraft` | render/darkrooms.ts | Paret elàstica en curs (espai pantalla, com la regla) |
| `renderGrid` | render/grid.ts | Grid overlay |
| `renderGridCalib` | render/grid.ts | Calibració visual del grid |
| `renderDMPointer` | render/grid.ts | Cursor del DM visible al jugador |

---

## Patró state ↔ ref

Cada valor d'estat té **dos** contenidors (definits a `useDMRefs.ts`):

```ts
// DMView.tsx
const [vis, setVis] = useState<VisMap>({});   // React (triggers re-render, UI)
// useDMRefs.ts
const rVis = useRef<VisMap>({});              // ref mirall (lectura O(1) dins tick)
```

**Regla:** Quan modifiques un estat, actualitza sempre `setState` i el `ref` corresponent. `tick()` llegeix refs, mai state.

---

## BroadcastChannel — sincronització DM→Jugador

Canal: `BC_CHANNEL = 'rpg_map_sync_v18'`

| Tipus missatge | Direcció | Contingut |
|---|---|---|
| `STRUCT` | DM→Jugador | Estat complet (connexió inicial) |
| `STATE` | DM→Jugador | Delta d'estat (interaccions) |
| `BG` | DM→Jugador | Buffer de la imatge/vídeo de fons |
| `STROKE` | DM→Jugador | Traç de dibuix (reproducció animada) |
| `CLEAR_DRAW` | DM→Jugador | Netejar canvas de dibuix |
| `UNDO_DRAW` | DM→Jugador | Desfer + reapplicar historial |
| `POINTER` | DM→Jugador | Posició del cursor DM |
| `MEASURE` | DM→Jugador | Punts A/B de la regla de mesura |
| `SPELL` | DM→Jugador | Inici d'animació de spell |
| `DELETE_SPELL` | DM→Jugador | Eliminar un spell d'àrea actiu |
| `BOSS_INTRO` | DM→Jugador | Cinematica boss reveal |
| `BOSS_INTRO_SKIP` | DM→Jugador | Saltar cinematica |
| `EXPOSITOR_SHOW/HIDE/SYNC` | DM→Jugador | Expositor d'imatge/vídeo (veure feature) |
| `TEXTREVEAL_SHOW` | DM→Jugador | Revelador de text: text complet + `pos`, `cps`, `fadeMs` |
| `TEXTREVEAL_SYNC` | DM→Jugador | Front de revelació (`pos`) streamejat a ~30fps |
| `TEXTREVEAL_HIDE` | DM→Jugador | Amagar revelador de text |
| `PLAYER_READY` | Jugador→DM | Sol·licita estat complet |
| `TOKEN_MOVE` | Jugador→DM | Token mogut des de la pantalla de jugador (BC i WS). Només tokens de jugador (`pl_*`): el DM descarta la resta |
| `TOKEN_RELAY` | DM→Jugador | Relay d'un token mogut (id+x+y) a la resta de pantalles de jugador. El jugador el **fusiona** dins `rPos` sense reemplaçar l'estat ni tocar la càmera |

Tots els tipus estan definits a `BCMessage` a `src/types/index.ts`.

**Dieta del `STATE`** (`_broadcastState` a `useDMActions.ts`): els camps pesats (`players`, `conditions`, `defeated`, `paintedZones`, `tokenSizeOverride`, `libEnemies`, `psdEnemyOverrides` — poden portar imatges base64) només s'inclouen al missatge quan la seva **referència** ha canviat des de l'últim enviament (`lastSentHeavyRef`). Per això és crític que tota mutació d'aquests valors creï un objecte/array **nou** (mai mutar in place) i que el jugador els tracti com a camps opcionals. Els broadcasts de pan/zoom (compartit i privat) i l'animació de retorn de vista privada van throttled a ~20Hz amb enviament final garantit — el jugador suavitza amb LERP, així que es veu fluid igualment.

**Quan s'afegeix un nou estat sincronitzat**, actualitzar en 3 llocs:
1. `BCStateMessage` o `BCStructMessage` a `types/index.ts`
2. `_broadcastState` a `useDMActions.ts` → missatge `STATE` (si és un camp pesat, afegir-lo a `heavy` i a `_syncHeavySent`)
3. `_sendFullState` → missatge `STRUCT` + handler al jugador

### WebSocket — sincronització multi-dispositiu (tablet per wifi)

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
  del dev server. La IP LAN del PC del DM ha de ser-hi o la tablet no hidrata (pàgina
  congelada sense errors visibles).

---

## Redesign visual — fonament (`src/theme/index.ts` + `globals.css`)

> **És un REDESIGN, no un restyle**: els components s'han de RECONSTRUIR per fases damunt d'aquest fonament. Si un canvi es pot fer només amb variables CSS, no és suficient.

- **Tokens de color** (única font de color): CSS custom properties a `globals.css` scoped sota `html.theme-df` — `--bg #0A0A0C`, `--panel #14141C`, `--panel-in #0D0D14`, `--bevel-hi #4A4A5A`, `--bevel-lo #000000`, `--accent #C41E1E`, `--gold #E8B84B`, `--amber #FFAA00`, `--bone #E8E0D0`, `--danger #FF5555`, `--magic #AA00AA`, `--ok #55AA55`, `--dim #5A5A6A`. Mirall TS exacte: `T` a `src/theme/index.ts` (el canvas no llegeix CSS vars — les render phases usen `T` o `C`).
- **`C` és un adaptador de compatibilitat**: tradueix la interfície vella als tokens per als components encara no reconstruïts. Quan es reconstrueixi un component, ha de consumir `T` / CSS vars directament, no `C`.
- **Reset global** (scoped a `html.theme-df`): `border-radius: 0 !important` (excepte canvas), `image-rendering: pixelated` a img/canvas/video, **tota transició amb `steps(4, end)`** (`transition-timing-function` global amb `!important`), cap `box-shadow` amb blur (tercer valor sempre 0).
- **Fonts**: `VT323` per a TOTES les dades i etiquetes (per defecte a body i form controls), `Pirata One` NOMÉS per a capçaleres (`h1..h6` i classe `.df-header`). Carregades amb `next/font/google` a `layout.tsx`, exposades com `--font-vt323` / `--font-pirata` (next/font hasheja els noms de família: referenciar SEMPRE via `var(...)`, mai pel nom literal). No hi ha cap altra font al projecte.
- **Mòdul 8px**: `--u: 8px` (mirall TS: `U`). Tot padding, gap i mida en múltiples de `--u` als components reconstruïts.
- **`.bevel` / `.bevel-in`**: bisell dur reutilitzable (`inset 2px 2px 0 var(--bevel-hi), inset -2px -2px 0 var(--bevel-lo)`; la variant `-in` l'inverteix per a pous).
- **Sistema de sprites**: `public/sprites/` + `sprites.json` (`{ tile: 32, fallback, creatures: {nom → fitxer} }`; art font 32×32 exactes). Component `<Sprite name size>` (`src/components/Sprite.tsx`): renderitza a 2x o 3x amb `image-rendering: pixelated`; nom desconegut → silueta fallback.
- **Revert**: `DARK_FANTASY = false` a `src/theme/index.ts` desactiva classe, tokens i overlay i recupera la paleta original (els components reconstruïts amb tokens, però, ja no tenen branca vella).
- **`CRTOverlay`**: marc físic amb cantoneres (llegeix els tokens via `var(...)`).

---

## Funcionalitats principals

### PSD Import
- Parser binari: `parsePSDStructure(buffer)` → `ParsedPSD`
- Extracció imatges: `extractLayerImages` → `Record<number, HTMLCanvasElement>`
- Arbre de capes: `buildTree` + `validateStructure` → `MapStructure`
- Grups esperats al PSD: `zones`, `enemies`, `extras`

### Eines de dibuix (barra flotant)
- `FloatingToolbar` (`src/components/dm/FloatingToolbar.tsx`) — columna de botons flotants tipus Photoshop a baix a l'esquerra del canvas (dins del `stageRef`, no a la finestra lateral).
- Botons apilats: Selecció (`none`), Ploma, Goma, Màgies, Senyal, separador, Desfer, Esborrar tot i (condicional) Esborrar zones màgiques.
- Quan l'eina activa és Ploma/Goma o Senyal, apareix un flyout contextual a la dreta de la columna amb la paleta de color + mida de pinzell, o l'ajuda de la regla de mesura, respectivament.
- La pestanya lateral "Eines" només conté ara el `GridPanel` (configuració de grid).

### Grid i tokens
- Grid configurable: `gridSize`, `gridOriginX/Y`, `gridLineWidth`
- **Snap**: `rGridSnap` — snapa tokens al centre de cel·la
- **AutoSize** (`gridAutoSize`): `rTokenSizeOverride` — map `{tokenId: R}` escala tokens al 90% cel·la

### Selecció per àrea (marquee)
- Drecera `A` (toggle) → `rAreaSelectMode`. Cursor en creu + indicador "▣ SELECCIÓ" a `CanvasHUD`.
- En aquest mode, left-drag dibuixa un rectangle (`rAreaSelectRect` en coords de mapa) que selecciona **només tokens** (PSD enemies, lib enemies i jugadors) amb el centre dins. Resultat → `rMultiSelected`.
- `A` o `ESC` per sortir (gestionat a `useKeyboardHandlers`). El rectangle es renderitza en espai pantalla a `useRafLoop` (després del grid).
- **Zoom**: el cap del zoom compartit és ×10 (1000%) a `useWheelZoom` i `BottomControls`.

### Tokens enemics
- **PSD enemies**: R = `Math.max(Math.min(en.w, en.h) / 2, 22)` (o override via `rTokenSizeOverride`)
- **Lib enemies**: `LibEnemy[]` afegits manualment des del panell, amb imatge custom opcional
- Overrides per PSD enemy: `PsdEnemyOverrides` (`hp`, `hpMax`, `name`, `imageData`)

### Grups de tokens
- `rTokenGroups` (`useDMRefs.ts`) — `Map<tokenId, groupId>`. Un token només pot pertànyer a un grup alhora. Estat 100% local del DM (ephemeral, ref-only, com `rMultiSelected`); no persisteix a reload ni es sincronitza al jugador.
- **Crear grup**: seleccionar ≥2 tokens (click additiu o marquee `A`, admet tipus mixtos: PSD/lib/players) → right-click → "🔗 Crear grup" (`onCreateGroup` a `DMView.tsx`). Reassigna els tokens seleccionats a un grup nou, traient-los de qualsevol grup anterior.
- **Doble click** sobre un token d'un grup (`onDoubleClick` a `useMouseHandlers.ts`) selecciona automàticament tots els membres del grup a `rMultiSelected`. Si el token no pertany a cap grup, funciona com un click normal (selecció solo).
- **Dissoldre / sortir**: right-click sobre un grup completament seleccionat mostra "🔓 Dissoldre grup" (`onDissolveGroup`); right-click sobre un sol token pertanyent a un grup mostra "🔓 Sortir del grup" (`onLeaveGroup`) — si només queda 1 membre, es dissol automàticament.
- `ContextMenuState.existingGroupId` distingeix "Crear grup" vs "Dissoldre grup" (multi-select: només si la selecció coincideix exactament amb tots els membres del grup) i mostra/amaga "Sortir del grup" (single-token: el grup del token, si en té).
- Eliminar un lib enemy (`removeLibEnemy`) neteja també la seva entrada a `rTokenGroups` i `rMultiSelected`.

### Cinematica boss reveal
- Llançada via `triggerBossIntroRef.current(data)`
- `BOSS_INTRO` BC message inclou `portraitDataUrl` (JPEG base64, max 600px)
- `SceneImgPicker` per importar imatge custom al context menu

### Zones màgiques (Painted Zones)
- Polígons amb element de `ELEMENTS` (fire, ice, water, lightning, poison, magic)
- Textures procedurals animades al jugador (`src/lib/textures/`)

### Parets → Sales fosques (eina "Parets", drecera `5`)
- **Model**: el DM dibuixa **parets** (segments) clicant successivament (estil regla de mesura). El conjunt de parets és la font de veritat del DM (`rWalls`, no es sincronitza). Les **sales** (`rRooms`) se'n deriven per **detecció de cares en un graf planar** (`src/lib/rooms/detect.ts` → `detectRooms`): fusiona vèrtexs propers, parteix als encreuaments (X) i a les unions en T, i extreu les cares tancades mínimes (recorregut de half-edges amb gir horari; cares acotades = àrea > 0 en coords de pantalla). Cada cara nova és una sala; una paret que divideix una sala la parteix en dues.
- **Reconciliació** (`reconcileRooms`): a cada canvi de parets es recalculen les cares i s'aparellen amb les sales existents (per centroide + àrea) perquè `id`, nom i estat (`dark`/`revealed`) es preservin.
- **Interacció** (`useMouseHandlers`, eina `'wall'`): clic afegeix un vèrtex i tanca el tram amb l'anterior; `snapWall` fa imant a **vèrtexs i arestes** de parets existents (tancament + unions en T "sobre rails") i snap a graella. En completar-se una geometria nova (augmenta el nombre de sales) la cadena **s'acaba automàticament** (`rWallChain`), cal tornar a clicar. `Backspace` desfà l'última paret (`removeLastWall`), `Esc` cancel·la tota la cadena en curs (`cancelWallChain`). Re-detecció via `redetectRooms` (a `useDMActions`).
- **Sales fosques**: `Room.dark` (marcar via clic dret; el menú s'actualitza en viu) → interior negre opac al jugador; `Room.revealed` (ull: clic sobre la sala en mode selecció, o menú contextual) → es revela amb fade suau (`roomRevealAnimRef`). **Revelar és lliure, però amagar una sala revelada amb l'ull requereix el mode Shift actiu** (`rShiftPanToggle`), com les sales PSD. Menú de sala a `ContextMenuOverlay` (`isRoom`): marcar fosca, revelar/amagar, reanomenar, eliminar (esborra les parets exclusives de la sala).
- **Render** (`src/lib/render/darkrooms.ts`): `renderRooms` — al **jugador** es pinta DAMUNT de tot (després dels tokens/spells) perquè qualsevol token/dibuix dins una sala fosca quedi amagat (fog of war); al **DM** va dins la transformació de mapa (semitransparent, hi veu a través). El farciment es fa amb el polígon + contorn del mateix color perquè les sales contigües se solapin i no quedi cap fil visible a la paret compartida. `renderWalls` (parets, només DM), `renderWallDraft` (paret elàstica en curs, espai pantalla).
- **Sync**: camp nou `rooms` a `STATE`/`STRUCT` (camp pesat: només s'envia quan canvia la referència). Persisteix a la sessió (`walls` + `rooms`). Les parets NO viatgen al jugador.
- **Pendent** (futur): sistema d'il·luminació/visió, revelat automàtic en entrar-hi un jugador, portes, edició de vèrtexs.

### Moviment de tokens des de la pantalla de jugador (`usePlayerTokenDrag`)
- `src/hooks/usePlayerTokenDrag.ts` — drag de tokens al canvas de `/player` amb **pointer events** (ratolí, dit i stylus unificats; `touch-action: none` al canvas + `setPointerCapture`).
- **Només tokens de jugador** (`pl_*`): el hit-test ignora enemics PSD i de biblioteca, i el DM també descarta qualsevol `TOKEN_MOVE` que no comenci per `pl_` (BC i WS).
- Tolerància tàctil més gran amb el dit (`pointerType === 'touch'` → slop 16px vs 4px de ratolí). Un sol drag actiu (es guarda el `pointerId`; la resta de tocs s'ignoren).
- En deixar anar, envia `TOKEN_MOVE` per BC **i** WS. Mentre es arrossega: el token segueix el dit sense LERP (`renderPlayerTokens` snapeja si `rSelectedToken === key`) i el handler de `STATE` del jugador conserva la posició local del token arrossegat perquè un broadcast del DM no el faci saltar enrere.
- **Relay a la resta de pantalles de jugador** (`TOKEN_RELAY`): quan el DM rep un `TOKEN_MOVE` vàlid (BC o WS, handlers a `DMView.tsx`), després d'actualitzar `rPos`/`setPos` reenvia un missatge **`TOKEN_RELAY { id, x, y }`** (per BC i WS) amb només el token mogut. La pantalla de jugador el **fusiona** dins `rPos` (`rPos.current = { ...rPos.current, [id]: {x,y} }`) sense reemplaçar la resta de posicions ni tocar cap altre camp. Això és clau: **no s'ha de reenviar un `STATE` complet** aquí — reemplaçar tot `rPos` feia desaparèixer els enemics (les posicions PSD que el client tenia quedaven sobreescrites) i incloure la càmera resetejava el zoom del client a cada moviment. Amb el merge d'un sol token no es toca ni la càmera ni la resta de tokens/sales. Si la pantalla que rep està arrossegant el mateix token, conserva la seva posició local (no salta a mig drag). El mateix `TOKEN_RELAY` (amb la posició autoritzada) s'usa per fer tornar enrere un token bloquejat (`canMove === false`) sense resetejar-li el zoom.
- **Límit de moviment per velocitat** (`Player.speed`, peus; per defecte `DEFAULT_SPEED_FT = 30`): el drag des de `/player` clampa el centre del token a un rang de `maxCells = floor(speed/5)` caselles al voltant de la casella d'origen del drag. **La regió abastable és un cercle** (distància euclidiana: `dc² + dr² ≤ (maxCells + 0.5)²`), és a dir un **disc rasteritzat** com les taules de cercles pixel-art — la diagonal costa el seu valor real (~7 ft = √2·5). El clamp (`onPointerMove` a `usePlayerTokenDrag.ts`) camina la casella cap endins fins entrar al disc reduint primer l'eix dominant (així la casella final és sempre una de les pintades i segueix la direcció del punter). Les caselles abastables es pinten en groc suau durant el drag amb perímetre esglaonat (`renderMoveRange` a `render/grid.ts`, cridada al tick del jugador abans dels tokens; mateixa condició `inRange` que el clamp perquè pintura i límit coincideixin). El DM edita la velocitat al `PlayersPanel` (`setPlayerSpeed`) i **no** té cap límit en moure tokens. `speed` viatja dins l'array `players` (STRUCT/STATE/sessió), sense camps de sync nous.
- **Bloqueig de moviment per jugador** (`Player.canMove`, absent → `true`): amb `canMove === false` el hit-test de `usePlayerTokenDrag` ignora el token (no es pot ni començar el drag des de `/player`). A més, si arriba un `TOKEN_MOVE` d'un token bloquejat (BC o WS, handlers a `DMView.tsx`), el DM no només el descarta sinó que **reenvia l'estat** (`_broadcastState({})`) perquè la posició autoritzada torni al jugador a l'instant — així un client que encara no hagués rebut el bloqueig no deixa el token mogut fins al següent broadcast. El DM el commuta al desplegable de configuració del `PlayersPanel` (`setPlayerCanMove`); la targeta mostra 🔒. Com `speed`, viatja dins `players` sense camps de sync nous.

### Panell de jugadors (`src/components/dm/PlayersPanel.tsx`)
- Targetes a **una columna** (amplada completa del sidebar), apilades verticalment.
- Cada targeta (`PlayerCard`): capçalera (color, nom editable, 🔒 si `canMove === false`, ✕ eliminar) + fila d'HP gran (botons −/+ de 32px amb clic dret ±10, vida a 24px) + botó d'engranatge.
- L'engranatge desplega una **secció de configuració** enganxada sota la targeta amb animació suau (truc CSS `grid-template-rows: 0fr→1fr`, sense mesurar alçades): vida actual, vida màxima, velocitat (peus + equivalència en caselles) i toggle de moviment des de la pantalla de jugador. Només un desplegable obert alhora (`openConfigId`).

### Sistema per torns (iniciativa) — barra inferior
- **Estat**: `TurnState` (`types/index.ts`) `{ active, order, turnIndex, round, activeRemainingFt }`. Mirall `rTurn` (`useDMRefs.ts`), estat React `turn` (`DMView.tsx`). El DM és la font de veritat; viatja al jugador dins `STATE`/`STRUCT` (camp lleuger `turn`, sempre enviat) i persisteix a la sessió (save/load).
- **Component**: `TurnTracker` (`src/components/dm/TurnTracker.tsx`) — barra flotant a baix al centre del `stageRef`. Inactiu: botó "⚔️ Iniciar torns" que obre un popover de selecció (tots els jugadors s'afegeixen automàticament; es trien enemics PSD/lib visibles i **grups** llegits de `rTokenGroups`). Actiu: badge de ronda + fila de chips en ordre de torn + botó "⏭ Ronda" + "✕".
- **Ordre** (`startTurnCombat` a `DMView.tsx`): `order` = ids plans `[...jugadors, ...selecció]` amb dedup (els grups s'expandeixen als seus tokens en iniciar; l'ordre no guarda referències a grups perquè `rTokenGroups` és efímer).
- **Passar torn** (`advanceTurn`): clic al chip **actiu** de la barra. En tancar la volta (`turnIndex` supera l'últim) → `round++` i `turnIndex=0`. Cada token, en agafar el torn, reinicia `activeRemainingFt` a la seva velocitat (`_budgetFor`: `Player.speed` per `pl_*`, sentinella gran per enemics). Botó "⏭ Ronda" (`advanceRound`): salta els que queden i comença ronda nova.
- **Distintiu**: aro **daurat sòlid** al token actiu (`drawActiveTurnRing` a `render/tokens.ts`) — **només als tokens de jugador** (`renderPlayerTokens`); els enemics no es ressalten en or (només surten a la barra). Coherent amb el groc però diferent de l'aro de "ressaltar enemics" i del blau de selecció.
- **Límit de moviment per torn** (extensió de `usePlayerTokenDrag`): amb combat actiu, des de `/player` només es pot **agafar** el token del torn actiu, i el disc de moviment usa `activeRemainingFt` en lloc de la velocitat sencera (es va encongint drag a drag: p. ex. 15 ft → mou 5 → queden 10). El DM valida cada `TOKEN_MOVE` (`handlePlayerTokenMove`): comprova bloqueig manual (`canMove`), que sigui el token actiu i que el cost no superi el saldo (mateixa mètrica de disc: `cost = ceil(hypot(dc,dr) − 0.5)` caselles × 5 ft); si el supera, rebot amb `TOKEN_RELAY`. En aplicar, descompta el saldo i propaga amb `_broadcastState` (perquè el disc del jugador s'encongeixi). **El DM mou sense límits** (el seu drag no passa per aquesta via). Sense grid no hi ha límit (com el clamp existent).
- **Recuperar un torn anterior**: clic dret sobre un token **no actiu** de la barra → "↩ Recuperar el seu torn" (`recoverTurn`). Torna `turnIndex` a aquell token amb el saldo de peus que li quedava (`TurnState.remaining`, mapa de saldos desat en deixar cada torn; es neteja a cada ronda nova).
- **Desfer moviment (Ctrl+Z)**: `rMoveHistory` (DM-only, es reinicia a cada canvi de torn via `_applyTurn`) apila `{ id, from, spentFt }` a cada moviment de combat (`handlePlayerTokenMove`). `undoTokenMove` restaura la posició i retorna els peus. **Encaminat per eina** a `useKeyboardHandlers`: amb l'eina de selecció (`rDrawTool === 'none'`) el Ctrl+Z fa `undoTokenMove`; amb qualsevol eina de dibuix fa `undoStroke` (cadascú el seu, no es barregen).
- **Editar l'ordre**: botó **⚙** a la barra activa un mode edició on els chips es poden **arrossegar** (HTML5 drag) per reordenar `order` (`reorderTurn`, que manté actiu el mateix token recalculant `turnIndex`). En mode edició, clicar el chip actiu no passa torn.
- **Acabar combat**: el botó ✕ demana **confirmació** ("Finalitzar? Sí/No") per evitar clics accidentals.

### Vista privada DM
- `Ctrl+scroll/drag`: zoom i pan locals, no sincronitzats al jugador
- Refs: `dmLocalPan`, `dmLocalZoom` — animació de retorn suau (`dmPrivateReturnAnim`)

### Expositor (visualitzador d'imatges/vídeo)
- Botó "Expositor" a dalt a l'esquerra del canvas → panell flotant al DM (preview amb zoom/pan + Ken Burns).
- El jugador mostra el contingut a pantalla completa (overlay zIndex 50) amb fade IN/OUT i `EXPOSITOR_SYNC` (LERP).

### Revelador de text (`src/lib/textreveal/`)
- Botó "Text" a dalt a l'esquerra (al costat d'Expositor) → panell flotant gran al DM amb editor, controls i previsualització.
- Motor compartit `RevealEngine` (`src/lib/textreveal/index.ts`): construeix spans, esvaïment per caràcter (smoothstep + blur), pauses dramàtiques al final de frase, mode manual.
- **El DM és la font de veritat**: integra el front `pos` (velocitat `cps` + pauses + manual) i emet `TEXTREVEAL_SYNC { pos, cps, fadeMs }` a ~30fps. El jugador *segueix* aquest `pos` amb el seu propi rellotge (`RevealEngine.follow`), de manera que les pauses es propaguen però l'esvaïment continua suau.
- Overlay del jugador a zIndex 51 (sobre l'expositor) amb tipografia serif gran i fade IN/OUT (1.4s / 0.3s), igual que l'expositor.
- **Sinergia**: mostrar text amaga l'expositor i viceversa (crossfade); obrir un panell tanca l'altre; funciona sobre qualsevol escena (mapa, imatge o res) perquè el seguidor del jugador corre *abans* de `if (!s) return` al `tick()`.
- **Reconnexió / late join (tablet Safari)**: el DM reenvia `TEXTREVEAL_SHOW` quan rep `PLAYER_READY` i quan reconnecta el seu WS (`trResendShowRef` a `DMView.tsx`) — iOS Safari talla el WS en bloquejar la pantalla i, sense això, la tablet només rebia `TEXTREVEAL_SYNC` (sense text, no mostrava res). El jugador tracta un `SHOW` amb el mateix text ja visible com a resincronització (no reconstrueix ni refà el crossfade).
- **No posar `will-change` als spans per caràcter** (`RevealEngine.setText`): iOS Safari promou cada span a capa compositada i amb textos llargs supera el límit de memòria de capes → el text no es pinta (pantalla en blanc a la tablet).

---

## Constants clau (`src/constants/index.ts`)

| Constant | Valor | Ús |
|---|---|---|
| `BC_CHANNEL` | `'rpg_map_sync_v18'` | BroadcastChannel |
| `TOKEN_LERP` | `0.07` | Suavitzat moviment tokens |
| `TSCALE` | `90` | Escala base tokens |
| `C` | objecte colors | Paleta UI (`bg`, `panel`, `accent`, `text`...) |
| `CONDITIONS` | array | Condicions D&D (14 condicions) |
| `ELEMENTS` | array | Elements màgics (fire, ice, water...) |
| `ENEMY_TEMPLATES` | array | Plantilles enemics (goblin, troll, drac...) |
| `DEFAULT_PARTY` | array | 5 jugadors per defecte |

---

## Errors comuns a evitar

| Error | Símptoma | Fix |
|---|---|---|
| Ref no a `fc` | Render phase rep `undefined` | Afegir a `FrameContext` (types.ts) i a l'objecte `fc` de `useRafLoop.ts` |
| `setState` sense ref mirall | UI actualitzada, render no | Actualitzar sempre `setState` + `rX.current` |
| Nou estat no afegit a STRUCT | Jugador no rep l'estat en connectar | Afegir a `BCStructMessage`, `_sendFullState` i al seu handler |
| `'use client'` oblidat | Error de hidratació | Tots els components amb hooks o events necessiten `'use client'` |
