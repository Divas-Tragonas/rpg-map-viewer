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

> **FORMAT DE LA VERSIÓ: `vMAJOR.MM` amb DOS dígits a la part petita** (`v4.09`, `v4.10`,
> `v4.11`… fins a `v4.99`). **Mai un sol dígit** (`v4.9` és un error: ordena malament i
> obliga a saltar a la v5 al cap de nou canvis). El salt de versió gran (`v5`) es reserva
> per a una fita de debò, no per haver-se quedat sense números.
>
> L'increment normal és de **+0.01** (`v4.09` → `v4.10`). Compte: `v4.9` i `v4.90` no són
> el mateix — sempre dos dígits.

**Abans de cada commit**, actualitzar el `README.md`:
1. Incrementar la versió (`vX.YY` → `vX.YY+1`) i posar-la al títol de l'entrada nova del Changelog
2. Afegir un nou bloc al Changelog amb la versió nova i un resum dels canvis:
   ```markdown
   ### vX.YY+1 — Títol curt del canvi
   - Descripció breu del canvi 1
   - Descripció breu del canvi 2
   ```
3. Actualitzar `APP_VERSION` a `src/constants/index.ts` (surt a la pantalla de benvinguda del DM i del jugador)
4. Incloure el `README.md` al commit

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
| `/expositor` | `ExpositorPage` | **Visor local** per a un monitor de recanvi: obres un fitxer a mà i es veu a pantalla completa. **No és l'Expositor del DM** (no rep res del BC ni del WS) |

---

## Estructura de fitxers

```
src/
├── app/
│   ├── layout.tsx          # RootLayout (carrega EB Garamond amb next/font/local → --font-serif)
│   ├── fonts/              # EBGaramond-latin.woff2 + OFL.txt (llicència: s'ha de distribuir amb la font)
│   ├── page.tsx            # → <DMView />
│   ├── player/page.tsx     # → <PlayerView />
│   └── expositor/page.tsx  # Expositor de campanya
├── components/
│   ├── DMView.tsx          # Component principal DM (estat + orquestració)
│   ├── PlayerView.tsx      # Component jugador
│   ├── icons.tsx           # Icones SVG inline
│   ├── player/TurnBanner.tsx  # Rètol de torn de la pantalla de jugador (TV i tablet)
│   ├── dm/                 # Panells i overlays del DM
│   │   ├── ImportPanel, LayerTree (capes de mapa del PSD), PlayersPanel (files primes de jugadors)
│   │   ├── TokenFields     # Fitxa d'un token dins del menú del clic dret (resolveToken, camps, NameField)
│   │   ├── SceneEnemiesPanel   # Tots els enemics de l'escena (PSD + biblioteca) en files primes
│   │   ├── FloatingToolbar, GridPanel, EnemyLibraryPanel (plantilles)
│   │   ├── TopBar          # Barra superior: nom del mapa, Clàssica·Píxel, Preparar·Jugar, Mostrar als jugadors, pantalles, partida, vista, ⋯
│   │   ├── TilePalette, PixelMapPanel, PixelPickers  # App Píxel: paleta de caselles, paquet + mapa, figureta i retrat
│   │   ├── ShowPanelHeader # Pestanyes Imatge o vídeo / Text / Diàleg del panell «Mostrar als jugadors»
│   │   ├── DialogPanel, DialogControls  # Diàlegs: pestanya per escriure el guió i barra del DM mentre corre
│   │   ├── CanvasHUD (selector de càmera + zoom a la cantonada + rètol de calibratge), ShortcutsHelp (finestra de dreceres, tecla ?)
│   │   └── ContextMenuOverlay, SceneConfigOverlay,
│   │       SpellMenuOverlay, ShapeMenuOverlay
│   └── ui/                 # Components UI genèrics
│       ├── Button          # Button / IconButton / buttonStyle: botons base (variants i mides)
│       ├── HpControl       # Control de vida únic (− vida/màx +, clic al número per escriure)
│       ├── Switch          # Interruptor encès/apagat (role="switch")
│       ├── RadialMenu      # Roda de selecció única (màgies i zones màgiques)
│       ├── Chip, DropZone, LayerRow, TreeGroup, SceneImgPicker
│       ├── SidebarSection  # Secció plegable del sidebar (capçalera + comptador + accions)
│       ├── ScrollArea      # Zona amb scroll i barra pròpia, discreta i amagada en repòs
│       ├── HoverTip        # Finestreta d'un botó (hover): nom, tecla i UNA línia
│       ├── NoticeStack     # Avisos a dalt de l'escenari (errors de càrrega, desat que falla…)
│       ├── ConditionIcon   # Isotip d'un estat com a <svg> (mateixos paths que el canvas)
│       ├── ConditionPicker # Estats del menú contextual: 2 files d'isotips (nom i traduccions al hover)
│       └── EnemyGroups     # Agrupar enemics de la BD: barra «Agrupar per», capçalera i cos de grup plegables
├── hooks/
│   ├── useDMRefs.ts        # Tots els refs del DM (state mirrors + interaction)
│   ├── useDMActions.ts     # Callbacks d'acció (PSD import, BC, drag...)
│   ├── useAutosave.ts      # Desat automàtic periòdic de la partida (IndexedDB)
│   ├── useEnemyGrouping.ts # Agrupació dels enemics de la BD i grups plegats (recordat a localStorage)
│   ├── useStoredFlag.ts    # Sí/no de la UI recordat a localStorage sense error d'hidratació (lateral plegat)
│   ├── useTileMap.ts       # App Píxel: crear/editar/cuinar el mapa de caselles i regenerar-ne parets, portes i llums
│   ├── useSpritePack.ts    # Estat del paquet de sprites per a la UI
│   ├── useCinematic.ts     # Lògica cinematica boss reveal
│   ├── useDialog.ts        # Diàlegs al DM: llançar, avançar, enrere, opcions, càmera, tecles, desats als tokens
│   ├── useRafLoop.ts       # RAF loop (tick) + totes les render phases
│   ├── useMouseHandlers.ts # Gestors de ratolí
│   ├── useKeyboardHandlers.ts
│   └── useWheelZoom.ts
├── lib/
│   ├── camera.ts           # Càmera en coords de mapa (viewRect/clampCamToMap/camToView)
│   ├── turn.ts             # Primitives de la cua d'iniciativa (budgetFor, nextActive, removeFromTurn)
│   ├── token-menu.ts       # tokenMenuFor: estat del menú del clic dret d'un token (mapa i files del lateral)
│   ├── dm-mode.ts          # Modes Preparar / Jugar del DM i a quin mode pertany cada eina (modeForTool)
│   ├── undo.ts             # Registre del «Desfer» únic: ordre de les piles de traços, mapa i moviments
│   ├── turn-banner.ts      # Projecció del combat al rètol de les pantalles de jugador
│   ├── rules/conditions.ts # Efecte mecànic dels estats sobre el moviment (movementLimit)
│   ├── autosave.ts         # Magatzem IndexedDB del desat automàtic (+ agoLabel)
│   ├── enemy-groups.ts     # groupEnemies / distinctValues / apiSupportsGroups (projecte i categoria)
│   ├── sprites/            # App Píxel: paquet Oryx (pack.ts: carrega els fulls de public/sprites/; draw.ts; manifest.ts GENERAT; portrait.ts; font.ts lletra de píxel; window.ts finestres 9-slice; variants.ts GENERAT: variants de color de les figuretes; states.ts: estats a la figureta; hitfx.ts: cops, envestides i curacions)
│   ├── dialog/             # Diàlegs: script.ts (guió), reveal.ts (lletra a lletra), camera.ts, tokens.ts, scene.ts (motor), host.ts (DM i jugador)
│   ├── tilemap/            # App Píxel: mapa de caselles (model, palette, editor, render/cuinat, geometry → parets, tmx)
│   ├── rooms/
│   │   ├── detect.ts       # detectRooms + reconcileRooms (cares del graf de parets)
│   │   ├── doors.ts        # Portes: effectiveWalls, pruneDoors, doorAt
│   │   ├── walls.ts        # Edició de parets: vertexAt, moveVertex, wallAt
│   │   └── pathing.ts      # Camins i caselles abastables (Dijkstra amb parets)
│   ├── psd/
│   │   ├── parser.ts       # parsePSDStructure(buffer) → ParsedPSD
│   │   ├── extractor.ts    # extractLayerImages → Record<number, HTMLCanvasElement>
│   │   └── tree.ts         # buildTree, validateStructure → MapStructure
│   ├── render/
│   │   ├── types.ts        # FrameContext interface
│   │   ├── zones.ts        # renderZoneOverlays, renderExtras, renderPaintedZones, renderShapePreview
│   │   ├── drawing.ts      # advanceStrokeAnim, replayStroke
│   │   ├── spells.ts       # renderSpells (dispatcher de tots els spells + preview)
│   │   ├── fireball.ts     # Bola de foc (ignició/vol/impacte/socarrim) + fireballShake
│   │   ├── lightning.ts    # Raig elèctric (llamp fractal, re-descàrregues) + lightningShake
│   │   ├── magicbeam.ts    # Raig màgic (càrrega, raig sostingut, col·lapse)
│   │   ├── bookspells.ts   # Conjurs dels grimoris (raig de gebre, flama sagrada, escut, curar ferides…)
│   │   ├── minorspells.ts  # Projectil màgic, risa horrible, mans ardents
│   │   ├── areaspells.ts   # Dormir i greix (àrees persistents, passada 'ground')
│   │   ├── fxsprites.ts    # Sprites de partícules (foc, fum, halo, socarrim) + ajudants comuns dels efectes
│   │   ├── zonefx.ts       # Zones màgiques a la pantalla del jugador (vora SDF + fotogrames clau fosos + arcs del llamp)
│   │   ├── tokens.ts       # renderEnemyTokens, renderLibEnemyTokens, renderPlayerTokens
│   │   └── grid.ts         # renderGrid, renderGridCalib, renderDMPointer
│   ├── cinematic/          # timeline.ts (CinematicTimeline) + bossIntro.ts (cinemàtica de boss, DM i jugador) + pixelIntros.ts (les 10 de pixel art)
│   ├── textreveal/index.ts # RevealEngine + helpers (revelador de text DM/Jugador)
│   ├── conditions/
│   │   ├── icons.ts        # CONDITION_ICONS: isotips vectorials (paths SVG) dels estats
│   │   └── index.ts        # drawConditionIcon / drawConditionBadges + conditionInk
│   ├── geometry.ts         # getBBox i utilitats geomètriques
│   ├── spellcast.ts        # clampToRange: limita el destí d'una màgia al seu abast en peus
│   ├── textures/noise.ts   # Soroll de les zones màgiques (el de valor de la v4.33 + gradient 3D)
│   ├── textures/fields.ts  # Camp de color de cada element de zona (texel, temps) → rgba
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
| `renderPaintedZones` | render/zones.ts | Zones màgiques: animades amb `drawZoneFx` de `zonefx.ts` (jugador, fotogrames clau fosos) / color pla (DM) |
| `renderShapePreview` | render/zones.ts | Preview del shape tool al DM |
| `advanceStrokeAnim` | render/drawing.ts | Reprodueix traços de dibuix frame a frame |
| `renderSpells` | render/spells.ts | Animacions dels spells (inclosos els dels grimoris, `bookspells.ts`). Dues passades: `'ground'` (sota tokens) i `'air'` (sobre) |
| `renderEnemyTokens` | render/tokens.ts | Tokens enemics PSD: drag, LERP, condicions, derrota |
| `renderLibEnemyTokens` | render/tokens.ts | Tokens biblioteca d'enemics lliures |
| `renderPlayerTokens` | render/tokens.ts | Tokens jugador: LERP, condicions |
| `renderRooms` | render/darkrooms.ts | Sales fosques: foscor amb llum dels tokens retallada (LOS) / overlay+contorn+ull (DM) |
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
| `STATE.dialog` / `STRUCT.dialog` | DM→Jugador | Diàleg en curs (`DialogSync`, camp lleuger, sempre; `null` = cap). Veure «Diàlegs de personatges» |
| `RESET_EXPLORED` | DM→Jugador | Reset de la memòria d'explorat d'una sala (torna a ser negra del tot). Porta el polígon `points`; DM i jugador criden `clearExploredAt(points)` a `darkrooms.ts` |

Tots els tipus estan definits a `BCMessage` a `src/types/index.ts`.

**Dieta del `STATE`** (`_broadcastState` a `useDMActions.ts`): els camps pesats (`players`, `conditions`, `defeated`, `paintedZones`, `tokenSizeOverride`, `libEnemies`, `psdEnemyOverrides`, `rooms`, `walls`, `doors`, `lights` — poden portar imatges base64) només s'inclouen al missatge quan la seva **referència** ha canviat des de l'últim enviament (`lastSentHeavyRef`). Per això és crític que tota mutació d'aquests valors creï un objecte/array **nou** (mai mutar in place) i que el jugador els tracti com a camps opcionals. Els broadcasts de pan/zoom (compartit i privat) i l'animació de retorn de vista privada van throttled a ~20Hz amb enviament final garantit — el jugador suavitza amb LERP, així que es veu fluid igualment. El mateix per a la **màgia que s'està apuntant** (`spellPreview`, camp lleuger, veure «Previsualització de les màgies als jugadors»).

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
  del dev server; si l'origen no hi és, el dispositiu rep l'HTML però no els `/_next/*`
  i **no hidrata** (pàgina negra congelada, sense errors visibles). Ja **no s'escriu cap
  IP a mà**: es llegeixen les IPv4 de les interfícies de la màquina (`os.networkInterfaces`)
  i s'hi afegeixen els comodins dels rangs privats. ⚠️ Next compara els orígens **per
  trossos separats per punts**, així que un comodí ha de ser un tros sencer
  (`192.168.*.*` sí, `172.2*.*.*` no).

---

## Funcionalitats principals

### PSD Import
- Parser binari: `parsePSDStructure(buffer)` → `ParsedPSD`
- Extracció imatges: `extractLayerImages` → `Record<number, HTMLCanvasElement>`
- Arbre de capes: `buildTree` + `validateStructure` → `MapStructure`
- Grups esperats al PSD: `zones`, `enemies`, `extras`

### Diàlegs de personatges (`src/lib/dialog/` + `useDialog` + pestanya «Diàleg»)
- **Dos usos, un motor** (`playDialog` a `lib/dialog/scene.ts`): **escena** (barres negres, càmera a qui parla i caixa de diàleg) i **globus** sobre el token en combat (sense barres ni càmera; no toca el `TurnState`). Com `bossIntro`, cada diàleg és propietari de tot el que crea i `dispose()` ho desfà tot. Només s'animen `transform` i `opacity`.
  - **App Píxel**: la caixa és un llenç en píxels del paquet ampliat a un **múltiple enter** (`pk()`: `SH/250` a l'escena) amb `pixelated`: finestra 9-slice (`lib/sprites/window.ts`, `navy`; `plum` per al xiuxiueig i el pensament), lletra de píxel (`lib/sprites/font.ts`) i la figureta a 1:1 (animació d'espera; en grisos si està derrotada).
  - **App Clàssica**: DOM amb `FONT_SERIF`, retrat (imatge del token, `Player.portrait` o capa del PSD) o inicials. Mides amb `s(px)` proporcional a l'**escenari** (no a la finestra).
- **Lletra de píxel** (`lib/sprites/font.ts`): majúscules, xifres i signes de `uf_interface.png` en una graella de 8 px (fila 8 = xifres i signes, fila 24 = majúscules). Minúscules → majúscules; **À È É Í Ï Ò Ó Ú Ü Ç Ñ** es componen amb la lletra base + els píxels de la marca (`MARKS`); `·` (L·L) i el punt es pinten com un quadrat de 2×2 (el punt del full es llegia com «+»); la **I** es pinta amb el peu recte (la del full té una cua i es llegia «J»). Una línia fa `PF_LINE` = 12 px (3 per als accents). El color es fa amb una còpia tenyida de la zona de la lletra (`tinted`, una per color). ⚠️ Codi nou que pinti la lletra o les finestres del paquet ha de fer servir aquests dos mòduls; les cinemàtiques de pixel art (`lib/cinematic/pixelIntros.ts`, v4.41) en tenen encara una còpia interna (monoespaiada i sense accents) que s'hauria de passar a `font.ts`/`window.ts`.
- **Guió** (`lib/dialog/script.ts`, format teatre): `Nom (opcions): text` · opcions = estil (`normal`, `crit`, `xiuxiueig`, `pensament`) i càmera (`auto`, `enfoca`, `dos`, `quiet`) · `> text -> etiqueta` (opció de resposta) · `# etiqueta` · `-> etiqueta` / `-> fi` · `//` comentari · una línia sense «Nom:» continua l'anterior. «Narrador» i «???» no tenen token ni nom visible. Els selectors d'estil i càmera de la pestanya reescriuen el parèntesi (`setLineOpts`): el guió és l'única font.
- **Repartiment** (`matchCast`): cada nom amb el token de l'escena que es diu igual (sense accents ni majúscules) o que hi comença; el que s'ha canviat a mà es conserva.
- **Text lletra a lletra** (`lib/dialog/reveal.ts`): funció pura de (text, cps) → cada pantalla compta les lletres amb el seu rellotge. `*paraula*` = èmfasi (color + tremolor), `...` pausa llarga, pauses als punts i a les comes. Velocitat per estil (`STYLE_SPEED`).
- **Sincronització** (sense canvis a la API): camp lleuger **`dialog`** (`DialogSync`) del `STATE` i del `STRUCT`. `age` = ms que feia que havia començat la línia **en el moment d'enviar** (`_dialogNow` a `useDMActions`): la pantalla fixa l'inici a `performance.now() − age`, o sigui que no depèn del rellotge del dispositiu i qui es connecta a mitja línia la continua des d'on va. `done` = el DM l'ha completada (totes la mostren sencera). El retrat **no viatja**: cada pantalla el treu del `tokenId`.
- **Un sol host per a les dues pantalles** (`DialogHost` a `lib/dialog/host.ts`): `apply(d)` crea/actualitza la vista, `tick(now, toScreen)` resol el retrat del token cada frame (derrotat → grisos, eliminat → veu) i el globus, i `cam` és l'objectiu de la càmera. Al DM el crida `useRafLoop` (abans del `if (!s)`); al jugador, el tick de `PlayerView`.
- **Càmera** (`dialogCamRect`, coords de mapa com `bossCamRect` però més tancada, i baixada un 12% perquè qui parla quedi per sobre de la caixa). `auto`: si el que ha parlat abans és a prop (`nearEnough`), enquadra els dos. Fa servir la mateixa interpolació de la cinemàtica (`cinematicCamRef` al DM, `visualZoomRef` al jugador), amb **prioritat per a la cinemàtica de boss**. En acabar, tothom torna a la vista d'abans (al DM, la privada inclosa). Si qui parla es mou, `useDialog` recalcula la càmera cada 150 ms i la reenvia si canvia (`sameCam`).
- ⚠️ **No revelar posicions** (`dialogToken(...).hidden`): invisible, ull tancat, coberta del PSD o dins d'una sala fosca no revelada sense cap jugador a dins → parla com a **veu**: `tokenId: null`, sense retrat ni càmera ni globus damunt seu. Ho decideix el DM; la pantalla de jugador no rep el token.
- **Prioritat**: començar un diàleg amaga l'Expositor i el Revelador de text, i mostrar-ne un acaba el diàleg (`dialogEndRef`), com fan ells entre ells. Començar-lo tanca el panell (la barra de control ho té tot).
- **Controls del DM** (`DialogControls`, a dalt a l'esquerra de l'escenari): línia actual, la següent («Després · …»), opcions per clicar la que han triat, ← / Següent / ✕. Tecles en fase de captura (`useDialog`): **Espai** o **→** completa la línia i, si ja és sencera, passa a la següent; **←** enrere; **1…9** opció; **Esc** acaba a totes les pantalles.
- **Desats al token** (`R.rDialogs`: token → `SavedDialog[]`, dins de `_buildSessionCore` → partida i desat automàtic; `onDialogsChange` refresca la UI en carregar). Menú del clic dret → **Parlar**: frase al moment (Enter = globus, Maj+Enter = escena), els diàlegs desats i «Preparar…». `afterBoss`: llança la cinemàtica de boss del token i comença quan `cinematicActiveRef` torna a ser fals.
- `prefers-reduced-motion`: sense tremolors ni sacsejada, barres amb fos, i la càmera salta (220 ms després) sota un vel negre.
- ⚠️ `useDialog` no escriu `R.x.current`: llegeix els refs per `refs.current` (un `useRef(R)` propi). Amb `R.x.current = …` dins dels callbacks, el lint dona `react-hooks/immutability`; i un efecte amb `[R]` com a dependència es tornaria a executar a cada render (`useDMRefs` retorna un objecte nou cada vegada) — el host es destruïa i el DM no veia res.

### Mapa només amb imatge (el PSD és OPCIONAL)
- **Problema que resol**: `tick()` (DM i jugador) surt aviat amb `if (!s) return` quan no hi ha `MapStructure`. Sense PSD no es dibuixava **res**: ni grid, ni sales, ni tokens.
- **Solució**: en carregar un fons sense PSD es crea una **estructura buida sintètica** (`emptyStructure()` a `src/lib/psd/tree.ts` → `MapStructure` amb `extras.children: []`, `roomLayers: []`, `enemyRooms: []` i **`synthetic: true`**). Totes les render phases hi passen sense branques especials (simplement no hi ha capes de PSD a pintar) i funcionen grid, parets/sales/portes, llums i fog of war, tokens, dibuix, zones màgiques, spells, torns i el sync amb el jugador.
- **On es crea** (`_applyImageOnlyStruct` a `useDMActions.ts`): al `load`/`loadedmetadata` del mèdia dins de `loadBg` (amb `psdInfo` = dimensions reals de la imatge) i com a fallback si `loadPSD` falla. **Mai substitueix un PSD real**: es comprova `rStruct.current && !rStruct.current.synthetic`. Envia `_sendStructState()` perquè el jugador surti també del seu `if (!s) return`.
- **UI**: `DMView` deriva `psdStruct = struct && !struct.synthetic ? struct : null` i passa **`psdStruct`** (no `struct`) a tot el que és exclusiu del PSD: `ImportPanel`, `LayerTree`, `TopBar` («Ressaltar enemics» del menú Vista) i `TurnTracker`. El render loop segueix llegint `rStruct` (la sintètica inclosa).
- **Sessió**: `synthetic` es desa dins de `psdStruct` i es restaura a `applySessionState` (si es perdés, la UI del PSD tornaria a sortir buida en carregar la partida).
- **Regla**: qualsevol codi nou que es pengi de `struct` ha de decidir explícitament si vol *"hi ha mapa"* (`struct`) o *"hi ha PSD"* (`psdStruct` / `!struct.synthetic`).

### App Píxel (Clàssica · Píxel) — `src/lib/sprites/`, `src/lib/tilemap/`
- **Interruptor «Clàssica · Píxel»** (`AppSwitch` a `TopBar`, estat `pixel` amb `useStoredFlag('rpg_pixel')`, ref `R.rAppStyle`). És un canvi d'«app» sobre la mateixa partida: com es pinta i quines eines hi ha. Viatja al jugador dins de cada `STATE` (`appStyle`, lleuger) i es desa a la partida. A la Clàssica no canvia res respecte de la v4.37.
- **Els sprites (Oryx «Ultimate Fantasy») són al repositori, a `public/sprites/`** (des de la v4.40, decisió del propietari del repo). Només hi van els fulls de `SHEET_FILES` (res més del `.zip`), passats per `oxipng` sense pèrdua (mateixos píxels RGBA). `ensurePack()` (`lib/sprites/pack.ts`) els carrega amb `<img>` de `SPRITES_URL` (= `NEXT_PUBLIC_BASE_PATH` + `/sprites/`; la mateixa variable fixa el `basePath` de `next.config.ts`), un sol cop per pàgina, al DM i a cada pantalla de jugador. Si falten els obligatoris (`heroes`, `terrain`), `status: 'error'` i es torna a provar a la crida següent.
  - **El paquet ja no viatja ni es desa**: fora l'IndexedDB `rpg-sprites`, la importació per `.zip`, la carpeta `public/oryx/` i el camp `spritePack`/`packId` (v4.38–v4.39). Un full nou: afegir-lo a `SHEET_FILES` i el PNG a `public/sprites/`.
- **Manifest** (`lib/sprites/manifest.ts`, GENERAT amb `scripts/oryx-manifest.py`): només noms i coordenades (criatures, objectes, peces de retrat). El terreny i els efectes es referencien per posició a la graella del full (`palette.ts`, `pixelspells.ts`).
- **Dibuix**: `blit` (`lib/sprites/draw.ts`) amb `imageSmoothingEnabled = false` sempre; el fons DOM porta `image-rendering: pixelated` a l'app Píxel (DM i jugador). `grayCreature` (derrotats) es fa amb `getImageData`, no amb `ctx.filter` (Safari).
- **Tokens** (`drawPixelFigure` a `render/tokens.ts`): si l'app és Píxel, el paquet hi és i el token té `sprite` (Player, LibEnemy, PsdEnemyOverride), es pinta la figureta en lloc del disc; nom, vida i estats es pinten igual. Sense `sprite` → disc de sempre.
  - **Aros en perspectiva**: amb figureta, l'anell d'estats (`drawConditionBadges` amb `foot`), l'aro del torn, el de ressaltar i el de selecció són **el·lipses als peus** (`ringPath`, `FOOT_DY`/`FOOT_FLAT`, la mateixa perspectiva que l'ombra) i els badges dels estats van sobre el cap. ⚠️ **Els aros van SOTA la figureta, mai a sobre**: `drawPixelFigure` pinta l'ombra i la base i **retorna la funció que pinta la figura** (`fig`), que cada família de tokens crida al final, després de tots els aros. Després hi van els badges (`drawConditionBadges(..., { ring: false })`; l'anell ja s'havia pintat abans amb `{ badges: false }`) i la creu de derrotat (`drawCross`). Un aro nou als peus s'ha de pintar abans de `fig()`.
  - **Animació d'espera 1-2-3-2** (`creatureFrame`, 300 ms): és la de l'autor (el fitxer solt `nom_4` és el fotograma 2). ⚠️ La 4a columna del full és una altra postura: ciclar-la feia que les figures donessin una sotragada a cada volta.
  - **Derrotat**: la figura es queda **dreta**, quieta i en grisos (no es tomba). Es gira cap a on es mou amb un marge (`R × 0,25`) perquè el LERP no la faci girar per tremolors. Figureta per defecte: `DEFAULT_PARTY[].sprite`, `ENEMY_TEMPLATES[].sprite`, `DEFAULT_PLAYER_SPRITE`. Es canvia al menú del clic dret (`PixelLook` a `TokenFields`).
- **Variants de color de les figuretes** (`scripts/oryx-variants.py` → `public/sprites/uf_heroes_v1.png` i `uf_heroes_v2.png` + `lib/sprites/variants.ts`; UI `SpriteVariants` a `TokenFields`): fins a dues variants per criatura, a les **mateixes coordenades** que `uf_heroes.png` (el manifest serveix per a tots tres fulls). El DM tria l'original o una variant, en miniatura, al menú del clic dret.
  - ⚠️ **Res de paleta lliure**: la v4.45 en tenia una i l'usuari la va rebutjar (espases roses, ocells i soldats d'un sol color empastat). El criteri és al script: cada figura es parteix en **materials** (rampes de l'autor que es toquen i tenen el mateix to). **No es toquen** el metall i els grisos, la pell, els cabells i les barbes (to càlid a la part de dalt de la figura), el cuir i la fusta, ni els ribets daurats. Es tenyeix la roba (o el cos d'un monstre o d'un animal), i els materials de to semblant van junts (el plomall segueix la capa). Colors per tipus de criatura (`CLOTH`, `NATURAL`, `FANTASY`) i `RULES` a mà quan l'automàtic no encerta. **Per canviar-ne una: tocar `RULES`, tornar a executar el script i revisar-ho amb `--sheet`**, mai editar els PNG ni `variants.ts` a mà.
  - La variant **viatja dins del nom de la figureta** (`goblin~2`, `parseSprite`/`spriteName` a `draw.ts`), així que la porten sola el `STATE`, la partida, el rètol, els diàlegs i les cinemàtiques, sense camps nous ni canvis a la API. El codi que necessiti el nom de la criatura ha de passar per `parseSprite(s).name`, o per `hasCreature`/`drawCreature`, que ja ho fan. Un sufix que no és una variant (el recolor de la v4.45, `goblin~14=c0392b`) es llegeix com l'original.
  - `creatureThumb`/`grayCreature` no desen res a la memòria cau mentre el full de la variant no s'ha carregat (`sheetReady`). Si no, s'hi quedaria l'original. `drawCreature` sí que pinta l'original mentrestant.
- **Estats a la figureta** (`lib/sprites/states.ts`, cridat des de `drawPixelFigure`): `figureLook(conds)` → postura (estirada: Tombat, Inconscient, Morint), pell (pedra > sang > verí, **una sola i excloent**, com demana la regla de «Estats dels tokens»), moviment (quieta, balanceig, tremolor, mig ritme) i contorn (Paralitzat o Encisat, del color de l'estat, i omplint els forats de dins de la figura: l'usuari ho vol així). Els efectes de color es fan amb `getImageData`, un sol cop per figureta i efecte (tires dels 3 fotogrames), mai amb `ctx.filter` (Safari). L'ombra semitransparent del full es treu a les tires (estirada quedaria dreta). Amb la figura estirada, els badges baixen (`badgeY` a `render/tokens.ts`). `prefers-reduced-motion`: sense tremolor ni balanceig, i el batec queda fix. El derrotat (grisos, dret) té prioritat sobre tot això, i Invisible conserva el seu tractament.
- **Cops a la figureta** (`lib/sprites/hitfx.ts`, cridat des de `drawPixelFigure`): es **dedueixen de la vida** (`noteFigure` apunta l'hp de cada token cada fotograma; el primer valor no compta). Si baixa: flaixos blancs (`flash` de `drawFigureState`, tira `white`), empenta, impacte de `uf_FX_impact.png` i el número del dany que puja (lletra de píxel, `numberCanvas`). La **força** (`severity`: lleu ≤5% o 1–2 punts, fort ≥25% o 15 punts, la resta normal) mana el nombre de flaixos, l'empenta, la mida de l'impacte, l'envestida i el color del número (`SEV`, `NUMBER_COLOR`); el fort hi afegeix tremolor, l'esclat d'estrella i gotes de sang. Si hi ha combat i el torn és d'un altre token, aquest fa l'envestida i s'inclina cap a la víctima (`_lunges`), i el cop arriba al cap de `LUNGE_HIT_MS`. L'impacte depèn de l'atacant (`styleOf`: arc d'espasa els jugadors, urpada animals i monstres, cop gòlems i elementals, tall la resta). Si puja: flaix i anells de curar en **vermell de poció** (`PAL.potion`; l'usuari no vol la curació verda, tampoc a Curar ferides) i «+N». **Cap missatge propi**: la vida ja arriba a totes les pantalles i totes veuen el mateix. `prefers-reduced-motion`: sense envestida ni empenta.
- **Retrats** (`Player.portrait`, dataURL PNG de 48 px): 36 de fets o compostos (`lib/sprites/portrait.ts`, ordre de capes del PSD de l'autor: fons → cap → roba → marques → celles → barba → cabell → al cap → complements). Surten al lateral, a la barra de torns i al rètol del jugador. **On es fan**: clic a l'avatar del jugador al lateral (Escena) o botó «Retrat» del menú del clic dret.
- **Cinemàtica de boss**: a l'app Píxel, si el token té figureta, el retrat de la cinemàtica és la figureta (`spritePortrait` a `useCinematic`, llenç de 48×66 amb la proporció del retrat) i `playBossIntro` amplia sense suavitzar qualsevol retrat de ≤ `PIXEL_MAX` px (i `encodePortrait` el desa en PNG). No es desa com a imatge del token.
- **Mapa de caselles** (`R.rTileMap`, `TileMap` a `lib/tilemap/model.ts`; codi de casella: terreny 0–999, objectes 1000+, món 2000+): l'eina **Caselles** (`'tiles'`, tecla 7, només a l'app Píxel i amb mapa de caselles) pinta amb la `TilePalette`; Sala = rectangle amb terra a dins i paret a la vora; clic dret esborra; Maj = rectangle. Les parets s'escullen soles (`wallTileFor`) amb la **regla dels mapes d'exemple de l'autor**, validada casella a casella contra els cinc `.tmx`: **cara** si a sota no hi ha paret (la paret de baix d'una sala es veu igual que la de dalt), **vora de dalt** només a la fila de dalt d'un mur de dues files que continua al costat, **centre** a la resta i **pilar** per a una peça sola. El buit i fora del mapa no compten com a paret.
  - **Portes** (peces de les columnes 10–13 del joc de paret): en una paret horitzontal, tancada = porta doble (10) i oberta = els dos muntants (11, també a la casella de dalt); en una paret **lateral**, tancada = la porta vista de cantell (12) i oberta = la fulla de cara girada contra la paret (13), totes dues ocupant la casella de dalt i la de la porta.
  - **Es «cou» com a fons** (`bakeTileMap` → PNG → `loadBg` el primer cop, `replaceBgImage` després): la resta de l'app (jugadors, boira, desat) no sap res de caselles. Mentre s'edita, el DM veu el cuinat local (`R.rTileCanvas`, repintat per caselles amb `repaintCells`) i el fons s'envia als jugadors 350 ms després del traç.
  - **Geometria** (`lib/tilemap/geometry.ts`, `regenGeometry` a `useTileMap`): parets = arestes entre casella de paret i casella amb terra (amb el buit no, perquè una sala envoltada de buit no tingui una «sala» exterior), marcades amb `Wall.tile`; portes `td_<casella>` (un tram pel mig de la casella, d'una paret a l'altra); llums `tl_<c>_<r>` de les torxes. Les dibuixades a mà es conserven. Les cares amb més d'un 15% de caselles de paret a dins no són sales (`keepRoomFace`).
  - **Parts vives** (`tileLiveOf` → `R.rTileLive`, camp pesat `tileLive` del `STATE`): aigua animada, torxes i portes (oberta/tancada segons `rDoors`). Es pinten cada fotograma amb `drawTileLive` abans de `renderRoomOverlays` (DM i jugador), o sigui sota la foscor de les sales. Una aigua amb res a sobre (vora, paret, objecte) es queda quieta.
  - **Desfer**: l'entrada de `rMapHistory` porta també `tileMap` (per referència: cada traç en crea un de nou) i `undoMapEdit` crida `R.rTileRestore`.
  - **Temes de masmorra** (`scripts/oryx-themes.py` → `public/sprites/uf_terrain_themes.png`; caselles `THEME_BASE` 3000+ a `model.ts`): Gel, Volcà, Cripta de molsa i Temple daurat. Cada tema és un bloc de 4 files: el joc de paret sencer recolorit (peces, pilar i portes a les mateixes columnes) i el terra. A la paleta són `WALL_SETS` i `FLOORS` amb `base: THEME_BASE`. ⚠️ Una peça d'un joc de paret s'ha d'obtenir amb `wallPiece(set, col, fila)`, mai amb `t(col, set.row + …)` (es perdria el full). El recolor és un mapa de gradient per lluminositat (pedra → rampa del tema; molsa del terra → accent; la de les parets → pedra, perquè amb l'accent semblaven núvols retallats). **Un tema nou**: entrada a `THEMES` del script **i** de `palette.ts` (mateix ordre) i tornar a executar el script.
  - **Full de poble** (`scripts/oryx-village.py` → `public/sprites/uf_village.png`, v4.52; encara no és a la paleta): l'estètica dels mapes pintats de la campanya (Conyberry), no la del paquet. ⚠️ **Tons apagats** (l'usuari ho va demanar: el píxel del paquet era massa saturat): totes les peces surten de les rampes de `RAMPS`, mesurades a la pintura, i el contorn és la tinta `INK`. Mida de píxel la del paquet (art de 24 px ampliat ×2). Terres del paquet passades per mapa de gradient (prat, herba fosca, camí) i fetes per codi (còdols, aigua). **Transicions per graella dual** (`transition`): cada peça va a la cantonada de 4 caselles i es tria pels 4 bits de quines són del terreny de sobre (1 dalt-esq., 2 dalt-dreta, 4 baix-dreta, 8 baix-esq.); són transparents a fora, o sigui que s'apilen sobre qualsevol terra (ordre: herba fosca, còdols —que inclouen l'aigua—, camí, aigua). Tanques i murs de pedra seca per 4 bits de veïns (1 amunt, 2 dreta, 4 avall, 8 esquerra). Arbres i roques: bonys amb relleu i llum de dalt a l'esquerra, quantitzats a 5 tons per percentils. Les teulades no són peces: `roof()` les dibuixa per rectangle. Posicions al full a `LAYOUT` (el codi de l'app les haurà de llegir igual). Per canviar-ne res: tocar el script i tornar-lo a executar, mai el PNG.
  - **Tiled** (`lib/tilemap/tmx.ts`): capes en ordre del document (la primera és el terra), «walls» → parets, «props/door/castle/marker» → objectes, criatures → enemics amb figureta; capes amb opacitat < 0,6 (núvols) no; es retalla al contingut.
- **Màgies en píxel** (`render/pixelspells.ts`): projectil del full (8 orientacions) + esclat de 5 fotogrames + segell. Els esclats que el full no té (arcà, llamp, radiant, encantament, poció) són l'esclat gris tenyit amb la paleta de l'escola (`BURST_TINT` amb `PAL`, via `tintedRegion` de `draw.ts`, un sol cop per retall i paleta); els segells es poden tenyir igual (`Seal.tint`: el de curar és vermell de poció). Les àrees persistents (dormir, greix) continuen amb l'efecte de sempre. Sense sacsejada de càmera a l'app Píxel.
- **Rètol de torn** (`PixelTurnBanner`), **barra de torns** i **lateral**: retrat o figureta en lloc de les inicials. **Biblioteca**: «Bestiari Oryx» amb les 130 criatures.

### Finestra lateral esquerra — pestanyes per funció
- **Escena · Mapa · Biblioteca** (`sidebarTab` a `DMView`). Abans eren «Mapa / Enemics» i els enemics vivien en dues pestanyes segons d'on sortien (els del PSD dins de l'arbre de capes, els de la biblioteca a «Enemics»): per seguir un combat calia saltar entre totes dues.
  - **Escena** (per defecte): `PlayersPanel` (jugadors en files primes, veure «Panell de jugadors») + `SceneEnemiesPanel` — **tots** els enemics a l'escena, del PSD (agrupats per carpeta) i de la biblioteca (grup «Afegits»), en **files primes** (~28 px) amb ull, nom i `HpControl` `sm`. Clic a una fila = seleccionar el token al canvas; **clic dret = el mateix menú que al mapa** (`openTokenMenu`). Reposicionar/eliminar surten en passar-hi el cursor.
  - **Mapa**: `ImportPanel` (fons i PSD), capes de **mapa** del PSD (`LayerTree`: només extres i zones) i `RoomsPanel` (sales i llums).
  - **Biblioteca**: `EnemyLibraryPanel`, només plantilles per **afegir** (i la BD si hi ha API, agrupada per projecte o categoria — veure «Enemics de la BD agrupats»). Cada plantilla diu quants n'hi ha a l'escena (`×N`, per `templateId`).
- **Regla**: el que és *a l'escena* va a Escena, el que és *del mapa* va a Mapa. Un panell nou s'ha de posar on toca per funció, no per origen de les dades.

### Finestra lateral esquerra — seccions plegables (`src/components/ui/SidebarSection.tsx`)
- Totes les seccions del sidebar del DM comparteixen `SidebarSection`: capçalera amb **fletxa, icona, títol, comptador i botons d'acció** (fletxa i icona vectorials d'`icons.tsx`, mai emojis; el comptador sempre neutre, `C.dim`) (`SectionButton`, amb `stopPropagation` perquè no pleguin la secció) i cos que s'anima amb el truc `grid-template-rows: 0fr → 1fr` (sense mesurar alçades, igual que el desplegable de configuració del jugador).
- `maxBodyHeight` dóna **scroll propi** a una secció (amb `ScrollArea`): les llistes llargues (capes del PSD, sales, llums) no empenyen la resta del panell fora de la pantalla.
- L'usen `ImportPanel`, `LayerTree` (embolcallat des de `DMView`), `RoomsPanel`, `PlayersPanel` i `EnemyLibraryPanel`.
- **`defaultOpen` només s'aplica en muntar.** Per fer que una secció es plegui sola quan canvia una condició, cal remuntar-la amb un `key` (ho fa `ImportPanel`: `key={bgLoaded ? 'loaded' : 'empty'}`).

### Lateral plegable (`sidebarOpen` a `DMView` + botó a `TopBar`)
- Botó de panell (`PanelLeftIcon`) a la dreta del bloc del nom del mapa de la barra superior: plega o desplega tot el lateral per donar més espai al mapa. Es recorda entre sessions (`useStoredFlag('rpg_sidebar_open')`, localStorage amb `useSyncExternalStore`: llegir-lo al primer render donaria error d'hidratació).
- S'anima l'**amplada del contenidor** (`SIDEBAR_W` = 270 → 0) i el contingut manté els seus 270 px a dins (no es reorganitza a mig plegar). El contingut plegat porta `inert` (el Tab no hi entra).
- El canvas s'adapta sol (el tick mira la mida cada frame). Com en redimensionar la finestra, el DM veu més mapa i les pantalles de jugador s'hi reenquadren (veure «Càmera compartida»).

### Panell de sales (`src/components/dm/RoomsPanel.tsx`)
- Arbre de "capes" d'un mapa dibuixat a l'app: substitueix el `LayerTree` quan no hi ha PSD (i conviu amb ell quan n'hi ha). Es mostra sempre que `bgLoaded`.
- **Sales i llums van cadascuna dins d'una `SidebarSection` plegada per defecte** amb el comptador a la capçalera (`Sales · 12`) i un resum de quantes són fosques i quantes revelades. Amb un mapa de moltes sales, la llista sencera se'n menjava el panell.
- Llista les **sales detectades** (`rRooms`): commutador 🌑 de sala fosca, ull de revelar/amagar (només si és fosca), nom editable en línia i desplegable amb "Afegir porta", "Resetejar explorat" (només si és fosca) i "Eliminar sala" amb **confirmació en dos passos** (es desa l'`id` pendent, no un booleà — mateix criteri que `ContextMenuOverlay`).
- Hover d'una fila → escriu a `R.rHoveredRoomId` (ref llegida per `renderRooms`), així la sala es ressalta al canvas.
- La capçalera de «Sales» no té botons: les eines Parets (`5`) i Llums (`6`) viuen a la barra d'eines del mode Preparar i el desfer és el «Desfer» únic de la barra superior (abans n'hi havia una còpia aquí).

### Modes Preparar · Jugar (`src/lib/dm-mode.ts`)
- **Problema que resolia**: les eines de construir el mapa (parets, llums, graella, capes) i les de jugar (regla, dibuix, màgies, torns) sortien totes alhora: 13 botons a la barra i 3 pestanyes al lateral, la majoria sense res a veure amb el que s'estava fent.
- Interruptor **Preparar · Jugar** a la barra superior (`ModeSwitch` a `TopBar`). Estat `mode` + `modeRef` a `DMView`. És **només UI del DM**: no es sincronitza ni canvia res del que veuen els jugadors.
  | | Preparar | Jugar |
  |---|---|---|
  | Barra d'eines | Selecció · Parets i portes · Llums · Graella · ▣ | Selecció · Senyal i regla · Dibuix · Màgies · ▣ · (✨ esborrar zones) |
  | Lateral | **Mapa** · Escena · Biblioteca (s'obre a Mapa) | Escena · Biblioteca |
  | Barra de torns | no | sí |
  | «Mostrar als jugadors» | només si s'hi mostra alguna cosa (per poder-la amagar) | sí |
- Escena i Biblioteca són als dos modes: col·locar enemics és preparar, però afegir-ne un a mitja partida també passa.
- **Font única de quina eina és de quin mode**: `modeForTool()`. ⚠️ El wrapper `setDrawTool` de `DMView` hi crida `applyMode`: triar una eina de l'altre mode (tecla 5 jugant, «Afegir porta» del menú d'una sala, tecla 1 preparant…) **canvia de mode sol**. Així les dreceres funcionen sempre i el mode no queda mai amb una eina que no hi és. Una eina nova s'ha d'afegir a `modeForTool`.
- `switchMode` (interruptor): si l'eina activa no és del mode nou, torna a la selecció (i, si era la de senyal, esborra el punter i la regla de les pantalles de jugador).
- **Mode en obrir fitxers**: un mapa nou o un PSD → Preparar (`openNewMap`, `openPsd`); una partida (fitxer, servidor, desat automàtic) o la demo → Jugar (`openSession`, `openServerSession`, `openDemo`). Per defecte, Jugar.
- A Preparar la barra de torns no es veu i **Enter no passa el torn** (`advanceTurnIfPlaying`): el combat continua igual i en tornar a Jugar hi és.

### Eines de dibuix (barra flotant)
- `FloatingToolbar` (`src/components/dm/FloatingToolbar.tsx`) — columna de botons flotants tipus Photoshop a baix a l'esquerra del canvas (dins del `stageRef`, no a la finestra lateral). Les eines depenen del mode (`PLAY_TOOLS` / `PREP_TOOLS`, veure «Modes Preparar · Jugar»).
- **Dibuix** és un sol botó per a la ploma i la goma (`ToolDef.also`): s'encén amb qualsevol de les dues i, en clicar-lo, posa la ploma. Al seu panell: Ploma · Goma (tecles 1 i 2), paleta (només ploma), gruix i **Esborrar tot el dibuix**. El desfer del traç és el «Desfer» únic de la barra superior. Abans eren dues eines i dos botons d'acció a la barra.
- **Graella** (només Preparar) obre `GridPanel`. Per ensenyar-la o amagar-la mentre es juga, interruptor al menú **Vista** (`toggleGridVisible`, sense obrir el calibratge). ⚠️ Al DM la graella només es dibuixa mentre arrossega tokens, calibra o mesura (`rGridDmAlpha`); l'interruptor és sobretot per als jugadors.
- **Barra apagada sense mapa** (`disabled` → `<fieldset disabled>`): es veu, però no reacciona ni mostra ajuda.
- **Modes de ratolí**: a la barra només hi queda la **selecció múltiple** (▣, `areaSelectMode`); els de càmera (vista privada i compartida temporal) són al selector de càmera del mapa (veure «Selector de càmera»). Les funcions (`toggleAreaSelect`, `setPrivateView`/`toggleShiftPan`, `toggleCtrlPan`) viuen a `DMView` i les comparteixen **el control i la tecla** — `useKeyboardHandlers` les rep per `opts` i no duplica la lògica. Si s'hi afegeix un mode nou, ha de seguir el mateix camí (una sola funció, dos disparadors).
- **Explicacions al hover, d'UNA línia**: cada botó va dins d'un embolcall `position: relative` que ancora un `HoverTip` amb el nom de l'eina, la drecera i **una sola línia** del que fa (`ToolDef.desc`, text de ≤ ~48 caràcters). Abans eren paràgrafs que tapaven mig mapa; el detall (els gestos de l'eina Màgies, les tecles de les parets) és ara a la finestra de dreceres (`ShortcutsHelp`, tecla ?). Totes les eines actives es marquen igual, en daurat (abans cada eina tenia el seu color). ⚠️ El component del botó (`ToolButton`) està definit **a nivell de mòdul**: si es declarés dins de `FloatingToolbar`, cada canvi de `hover` en crearia un tipus nou, React desmuntaria tots els botons i el `mouseleave` es perdria (finestreta enganxada).
- El `HoverTip` de la barra vertical s'alinea **per baix** (`bottom: 0`), no centrat: la barra viu a la cantonada inferior i una finestreta centrada sobre l'últim botó sortiria de la pantalla. ⚠️ Per això la barra d'eines va a `zIndex` 13, **per sobre de la barra de torns** (12): les finestretes i els panells (Dibuix, Graella) s'obren cap a la dreta a la mateixa alçada i quedaven tapats.
- Al flyout hi queden **només els controls manipulables**: el panell de Dibuix i el slider de radi (Llums). Parets i Senyal no en tenen.
- Eina **Llums** (drecera `6`): col·locació de punts de llum (torxes) — veure feature "Punts de llum".

### Barra superior (`src/components/dm/TopBar.tsx`)
- **Problema que resolia**: els controls que no són ni el mapa ni el lateral estaven repartits en tres llocs (barreta d'Expositor/Text a dalt a l'esquerra, xips a dalt al centre, peu del lateral) i moltes coses es podien fer des de dos llocs («Modo Jugador» i el xip 🖥; Guardar/Cargar, ☁ i el xip ⟳; el zoom al lateral i el reset a dalt).
- **Una sola barra** de `TOP_BAR_H` (48 px) per sobre del lateral i de l'escenari. D'esquerra a dreta: nom del mapa (bloc de 250 px perquè la resta s'alineï amb l'escenari; el nom va en EB Garamond i a la dreta hi ha el botó de plegar el lateral), l'interruptor **Preparar · Jugar**, **«Mostrar als jugadors»** i, a la dreta, el **Desfer** únic (veure «Desfer únic») i quatre menús: **Pantalles de jugador**, **Partida**, **Vista** (només amb mapa) i **⋯**.
  - **Pantalles** (`ScreensMenu`): veure «Menú de pantalles» a la secció de la càmera compartida. Mentre no n'hi ha cap, un **punt** d'avís (el botó no canvia de color).
  - **Partida** (`GameMenu`): l'etiqueta del botó és l'estat del desat («Desat fa 2 min», es refresca cada 15 s). Dins: interruptor del desat automàtic, desar ara, exportar a `.json`, obrir un `.json` i partides al servidor (si hi ha API).
  - **Vista** (`ViewMenu`): graella visible, opacitat del mapa i Ressaltar enemics (+ cadenat). Ressaltar surt amb qualsevol mapa (abans només amb PSD, i als mapes de caselles havia desaparegut).
  - **⋯** (`MoreMenu`): dreceres de teclat, back office i versió.
- ⚠️ Els botons de la barra (`BarButton`) són **sempre neutres**: un estat (cap pantalla, desat automàtic apagat, desat fa poc) el diu un punt (`Dot`) o la icona, no el color de tot el botó. `C.warn` (#d29922) és pràcticament el mateix daurat que l'acció principal i, amb el botó sencer de color avís, «Cap pantalla de jugador» semblava el botó principal de la barra.
- Els menús són `Popover` (nivell de mòdul): clic fora o **Esc** els tanquen. ⚠️ L'Esc es captura en fase de captura amb `stopImmediatePropagation`, si no `useKeyboardHandlers` també tornaria a l'eina de selecció (mateix criteri que `RadialMenu`).
- ⚠️ El cos (lateral + escenari) és un **context d'apilament propi** (`position: relative; zIndex: 0`) i la barra té `zIndex: 1`: així els menús de la barra queden sempre per sobre de tot el que hi ha a l'escenari (panells a `zIndex` 20, el rètol de deixar fitxers a 40…) sense haver de pujar números.
- El **zoom** és a la cantonada superior dreta del mapa (`CanvasHUD`): − / percentatge / +, i un clic al percentatge restableix la vista (zoom i posició). Al seu costat hi ha el selector de càmera.

### Selector de càmera (`CanvasHUD`)
- **Problema que resolia**: la càmera eren dos botons «CTRL» i «MAJ» a la barra d'eines, amb el nom de la tecla en lloc del que fan, i un avís a dalt quan estaven encesos.
- A la cantonada superior dreta del mapa, al costat del zoom: **«Què veuen els jugadors: Compartida · Privada»** (`role="radiogroup"`).
  - **Compartida** (per defecte): els jugadors et segueixen quan mous el mapa o fas zoom.
  - **Privada** (`setPrivateView`, mateix estat que el toc de Maj: `rShiftPanToggle`): et mous amb `dmLocalPan`/`dmLocalZoom` i els jugadors es queden on eren. En tornar a Compartida, la teva vista hi torna sola (`dmPrivateReturnAnim`). També cal per amagar una sala ja revelada (veure «Sales fosques»).
  - **«Enviar aquesta vista»** (només en Privada, `sendPrivateView`): la vista compartida pren el teu enquadrament (`rZoom × dmLocalZoom`, `rPanOffset + dmLocalPan`, zoom retallat a [0,2, 10]) i el privat torna a zero, o sigui que a la teva pantalla no es mou res i continues en Privada.
  - **Vista temporal** (toc de Ctrl, `toggleCtrlPan`): sense botó propi, però quan és activa surt un xip «Temporal · tornarà on era» amb ✕ per sortir-ne (tothom torna a l'enquadrament d'abans).
- `toggleShiftPan` (tecla) conserva la guarda de l'eina Màgies (Maj hi traça la línia del conjur); `setPrivateView` (selector) no la té.
- El zoom de la cantonada mou sempre la vista **compartida**, també en Privada (com feia el lliscador d'abans); la roda i la pinça, en Privada, fan zoom privat.

### Desfer únic (`src/lib/undo.ts` + botó a `TopBar`)
- **Problema que resolia**: tres desfers (traç al panell de Dibuix, mapa a la barra de Preparar, moviments només amb Ctrl+Z) i un Ctrl+Z que en triava un segons l'eina activa sense dir quin.
- **Un sol «Desfer»** a la barra superior, que diu què desfarà («Desfer · afegir paret», «· traç de dibuix», «· moviment de Liriandor»). **Ctrl+Z fa exactament el mateix** (`undoLast` a `DMView`, passat a `useKeyboardHandlers` com a `undo`).
- **Model**: les tres piles de sempre no canvien (`strokeHistoryRef`, `rMapHistory`, `rMoveHistory`). `rUndoLog` només en guarda l'**ordre**: cada entrada apunta a l'objecte apilat (`logUndo`, just després de cada `push`). `peekUndo` retorna l'última entrada **que encara és a la seva pila**; les altres han caducat (s'han desfet, s'ha esborrat el dibuix, ha canviat el torn, s'ha eliminat el token) i se salten. Per això cap camí que buidi una pila pel seu compte pot desordenar el desfer, i no cal netejar el registre enlloc.
- ⚠️ Una **pila de desfer nova** ha de: apuntar cada `push` amb `logUndo`, sortir a `peekDmUndo` i a `undoLast`, i avisar `onUndoChange` (o `refreshUndo`) quan canviï, perquè l'etiqueta del botó es refresqui. L'etiqueta es calcula a `refreshUndo` (estat `undoNext`), no al render: llegir refs al render és l'error de lint `react-hooks/refs`.
- Els moviments de combat que es desfan són els que fan **els jugadors** des de `/player` (el DM pot desfer-ne un de mal fet); els que fa el DM arrossegant no s'apilen.

### Panell «Mostrar als jugadors» (`ShowPanelHeader` + `DMView`)
- L'Expositor, el Revelador de text i el Diàleg són **les pestanyes d'un sol panell** (Imatge o vídeo · Text · Diàleg), que obre el botó «Mostrar als jugadors» de la barra. Abans eren dos botons i dos panells que ja s'excloïen l'un a l'altre.
- Cada pestanya continua obrint el seu estat de sempre (`expositorOpen` / `textRevealOpen`, un sol obert alhora) i la pestanya recordada és `showTab`: els bucles RAF i les dreceres de teclat de cada un no han canviat. En obrir el panell, si s'està mostrant alguna cosa, s'obre per aquella pestanya.
- Un punt verd a la pestanya (i al botó de la barra) diu què s'està mostrant als jugadors.
- Amplada fixa `SHOW_PANEL_W` (560) per a les dues pestanyes: canviar de pestanya no fa saltar el panell. Va a `top: 12` de l'escenari.

### Barra de desplaçament integrada (`src/components/ui/ScrollArea.tsx`)
- La barra nativa ocupava una franja fixa, sempre visible i que no lligava amb el lateral. `ScrollArea` amaga la nativa (`.sa-viewport`) i en dibuixa una **per sobre del contingut** (no li treu amplada): invisible en repòs, molt suau en passar el cursor per la zona, visible mentre es fa scroll (`data-scrolling`, s'apaga als 900 ms) i més ampla en apropar-s'hi o arrossegar-la. Es pot arrossegar el polze i clicar el carril per saltar-hi.
- La posició del polze s'escriu **directament al DOM** (no és estat de React): fer scroll no re-renderitza res. Mides amb `ResizeObserver` del viewport i del contingut. Estils de hover a `globals.css` (`.sa-*`).
- L'usen el contingut de les pestanyes del lateral i el cos de les `SidebarSection` amb `maxBodyHeight`. Una llista nova amb scroll al lateral ha de fer-la servir.
- El carril fa 8 px i va enganxat a la vora dreta: el contingut del lateral ja té ≥10 px de marge, o sigui que no tapa cap botó.

### Grid i tokens
- Grid configurable: `gridSize`, `gridOriginX/Y`, `gridLineWidth`
- **Snap**: `rGridSnap` — snapa tokens al centre de cel·la
- **AutoSize** (`gridAutoSize`): `rTokenSizeOverride` — map `{tokenId: R}` escala tokens al 90% cel·la

### Selecció per àrea (marquee)
- Drecera `A` (toggle) → `rAreaSelectMode`. Cursor en creu i el botó ▣ de la barra d'eines encès.
- En aquest mode, left-drag dibuixa un rectangle (`rAreaSelectRect` en coords de mapa) que selecciona **només tokens** (PSD enemies, lib enemies i jugadors) amb el centre dins. Resultat → `rMultiSelected`.
- `A` o `ESC` per sortir (gestionat a `useKeyboardHandlers`). El rectangle es renderitza en espai pantalla a `useRafLoop` (després del grid).
- **Zoom**: el cap del zoom compartit és ×10 (1000%) a `useWheelZoom` i al zoom de la cantonada (`CanvasHUD`).

### Tokens enemics
- **PSD enemies**: R = `Math.max(Math.min(en.w, en.h) / 2, 22)` (o override via `rTokenSizeOverride`)
- **Lib enemies**: `LibEnemy[]` afegits manualment des del panell, amb imatge custom opcional
- Overrides per PSD enemy: `PsdEnemyOverrides` (`hp`, `hpMax`, `name`, `imageData`)
- **Numeració automàtica** (`addEnemyNumbered` a `src/lib/enemy-naming.ts`, usada per `addLibEnemy` i `addDbEnemy`): el primer Goblin es diu "Goblin"; en afegir-ne un segon, el primer passa a "Goblin 1" i el nou a "Goblin 2", i la sèrie va ascendint. El **nom base** és el nom sense el número final (`/\s+\d+$/`), així que un nom propi escrit pel DM ("Goblin Cap") té un base diferent i queda fora de la sèrie. Retorna sempre un **array nou** (els `libEnemies` són camp pesat del `STATE`: mutar-los in place no els sincronitzaria).

### Grups de tokens
- `rTokenGroups` (`useDMRefs.ts`) — `Map<tokenId, groupId>`. Un token només pot pertànyer a un grup alhora. Estat 100% local del DM (ephemeral, ref-only, com `rMultiSelected`); no persisteix a reload ni es sincronitza al jugador.
- **Crear grup**: seleccionar ≥2 tokens (click additiu o marquee `A`, admet tipus mixtos: PSD/lib/players) → right-click → "🔗 Crear grup" (`onCreateGroup` a `DMView.tsx`). Reassigna els tokens seleccionats a un grup nou, traient-los de qualsevol grup anterior.
- **Doble click** sobre un token d'un grup (`onDoubleClick` a `useMouseHandlers.ts`) selecciona automàticament tots els membres del grup a `rMultiSelected`. Si el token no pertany a cap grup, funciona com un click normal (selecció solo).
- **Dissoldre / sortir**: right-click sobre un grup completament seleccionat mostra "🔓 Dissoldre grup" (`onDissolveGroup`); right-click sobre un sol token pertanyent a un grup mostra "🔓 Sortir del grup" (`onLeaveGroup`) — si només queda 1 membre, es dissol automàticament.
- `ContextMenuState.existingGroupId` distingeix "Crear grup" vs "Dissoldre grup" (multi-select: només si la selecció coincideix exactament amb tots els membres del grup) i mostra/amaga "Sortir del grup" (single-token: el grup del token, si en té).
- Eliminar un lib enemy (`removeLibEnemy`) neteja també la seva entrada a `rTokenGroups` i `rMultiSelected`.

### Estats dels tokens (condicions)

- **Model** (`Condition` a `types/index.ts`, llista a `constants/index.ts`): els **16 estats oficials** de la làmina de D&D. Cada un porta `label` **en català** (l'únic nom que es pinta), `es` i `en` (traduccions que van al `title` del menú) i un `color` propi. Les `id` són les angleses (`blinded`, `charmed`…), o sigui que **les partides desades continuen sent vàlides**; les noves respecte de la versió anterior són `exhaustion` i `dying`.
- **Els estats NO tenyeixen el token.** Hi havia un camp `tint` que pintava el token sencer del color de l'estat; amb dos o tres estats alhora els tints se sumaven i el color resultant no volia dir res. Tota la informació d'estat viu ara al distintiu (anell + badges). ⚠️ **L'única excepció és `invisible`**, que mai va fer servir `tint`: té el tractament propi de `render/tokens.ts` (alpha del fantasma via `invisAlphaRef` i contorn blau de guions, amagat del tot al jugador). Si algun dia es vol tornar a tenyir un token, que sigui per **un sol** estat i de manera excloent.
- **Isotips vectorials** (`src/lib/conditions/icons.ts`): cada estat és una llista de parts amb el `d` d'un path SVG dins d'una caixa de `ICON_BOX` (512). **Mai bitmaps**: al canvas es dibuixen amb `Path2D` (`conditionPaths`, cachejats per id) i al menú amb `<svg>` (`ConditionIcon`), o sigui que es re-rasteritzen a la resolució de cada zoom.
  - Part **sense `w`** → s'omple amb regla **evenodd** (els subpaths interiors fan de forat: ulls, boca, esquerdes…).
  - Part amb **`w`** → es traça (`dash` per a guions; és com es fa el contorn de l'estat *Invisible*). Els traços del mateix color se **superposen sense fer forats**, o sigui que són la manera de compondre postures (veure *Cansament*: cap, esquena, braços i cames com a traços separats) sense barallar-se amb l'evenodd.
  - Part amb **`bg`** → es pinta amb el **color del badge**. ⚠️ És l'única manera neta de fer la barra del "prohibit" (*Eixordat*): amb evenodd, allà on la barra creuava un forat de la silueta la doble inversió el tornava a omplir i quedava un escaquer.
- **Tinta llegible** (`conditionInk`): blanc sobre colors foscos i gairebé negre sobre els clars (groc, cian, gris). Sense això, els estats de color clar pintaven un isotip blanc sobre blanc.
- **Distintiu al mapa** (`drawConditionBadges`, cridada des de les tres famílies de tokens a `render/tokens.ts`, sempre **després** de pintar el token):
  1. **Anell segmentat** a la vora del token: un tram per estat amb el seu color. És la lectura d'un cop d'ull — encara que els isotips quedin petits, els colors ja diuen quants estats hi ha. Va **per dins** del radi del token: a fora hi viuen l'aro daurat del torn, el de ressaltar enemics i el blau de selecció, i s'hi trepitjarien.
  2. **Badges amb isotip** repartits en un **arc simètric respecte del capdamunt** del token: amb pocs estats queden centrats sobre el cap i, a mesura que se n'acumulen, s'obren cap als costats fins a envoltar-lo. Si l'arc s'omple, el badge s'encongeix fins a un mínim llegible i, només si encara no hi caben, l'últim lloc mostra «+N».
- **Menú** (`ConditionPicker`, usat pel menú d'un token i pel de multi-selecció a `ContextMenuOverlay`): **dues files de 8 isotips**, sense nom a sota (abans era una graella de 4 columnes amb el nom, que ocupava mig menú). El nom no es perd: la línia de capçalera «Estats» diu quins té el token i, en passar per sobre d'una icona, el nom en català amb el castellà i l'anglès (que també van al **`title` natiu** del botó). Els actius s'omplen del color de l'estat; els apagats són un isotip clar (`C.text`) sobre un cercle **opac** tenyit del seu color (`mix`): amb l'isotip del color de l'estat, els foscos (Encegat, Inconscient, Moribund) no es veien, i amb un cercle transparent les parts `bg` (la barra d'Ensordit) no tapaven la silueta.

### Efecte mecànic dels estats (`src/lib/rules/conditions.ts`)
- **Problema que resolia**: després de la feinada de la v4.07/v4.08 hi havia 16 estats amb isotip, color i traduccions i **només un feia alguna cosa** (`blinded`, que encongeix el radi de llum a `darkrooms.ts`). Un token Agafat o Paralitzat es movia els seus 30 peus com si res.
- **Regles** (`movementLimit(baseFt, conds)`): `grappled`, `restrained`, `paralyzed`, `petrified`, `stunned`, `incapacitated` i `unconscious` → **0 peus**; `prone` → **la meitat**, arrodonida a passos de 5 ft. Retorna `{ ft, reason, immobile }`, on `reason` és l'etiqueta en català per poder dir-ho a la pantalla.
- ⚠️ **Font única dels tres llocs que han de coincidir**: el clamp del drag (`usePlayerTokenDrag`), la pintura del rang groc (`renderMoveRange`, que es deriva del mateix `speedFt` ja limitat) i la validació autoritzada del DM (`handlePlayerTokenMove`). Si divergeixen, el jugador veu un rang que el DM després li rebutja. Mateix criteri que `buildMovePath` per al càlcul del camí.
- **No consumeix saldo**: s'aplica **sobre** `activeRemainingFt`, no el modifica. Si el DM treu l'estat a mig torn, els peus que quedaven tornen a estar disponibles a l'instant.
- Els estats ja viatgen al jugador dins de `conditions` (camp pesat del `STATE`): cap camp de sync nou.

### Rètol de torn a les pantalles de jugador (`src/components/player/TurnBanner.tsx`)
- **Problema que resol**: `/player` no tenia cap element d'interfície. En combat, qui juga des de la TV o la tablet no sabia de qui era el torn ni quants peus li quedaven (el disc groc només surt mentre s'arrossega, i amb el saldo a zero ni això).
- **Contingut**: ronda, avatar i nom de qui té el torn, i **peus restants sobre el total** amb número gran i barra. Dimensionat per llegir-se des del sofà, no des del teclat. Si un estat el bloqueja, en lloc dels peus surt **«No es pot moure · Agafat»**.
- ⚠️ **Projecció a `lib/turn-banner.ts`, no l'estat sencer.** `turn` arriba dins de CADA `STATE`, també els de pan/zoom a ~20 Hz: passar-lo a estat de React re-renderitzaria `PlayerView` vint cops per segon. `buildTurnBanner` en treu un objecte pla amb només el que es veu i `sameBanner` el compara; l'`useState` retorna `prev` quan no ha canviat res i React no re-renderitza. Qualsevol camp nou al rètol s'ha d'afegir a **totes dues** funcions.
- **Mides proporcionals a la finestra**: totes les mides del rètol passen per l'ajudant `s(px)` (`clamp` amb terra i sostre, amb `px` = la mida a `DESIGN_W` = 1550 px d'ample). Amb píxels fixos, el que es llegia bé a la TV ocupava gairebé tota l'amplada d'una pantalla petita. Qualsevol element nou del rètol ha de passar per `s()` també.
- Els enemics no tenen límit de moviment (sentinella `NO_MOVE_LIMIT_FT`): el seu rètol no mostra peus.
- La barra del DM (`TurnTracker`) fa servir el mateix `movementLimit` i ensenya el saldo igual de gran, perquè les dues pantalles diguin el mateix.

### Editar parets ja dibuixades (`src/lib/rooms/walls.ts`)
- **Moure un vèrtex**: amb l'eina Parets i **cap cadena en curs** (`rWallPenLast === null`), els vèrtexs es pinten més grossos (són nanses), s'encenen en passar-hi el cursor (`rWallVertexHover`) i s'arrosseguen. Un vèrtex no és una entitat pròpia sinó un punt on coincideixen extrems: `moveVertex` mou **tots** els extrems que hi cauen a sobre (si no, la cantonada s'obriria i la sala deixaria de detectar-se) i descarta les parets que quedin degenerades.
- **Durant el drag només es mouen les parets** (barat, `rWalls` es recalcula sempre des de `rWallVertexDrag.base` per no acumular error); `redetectRooms()` —que reconcilia noms i estats i poda les portes òrfenes— es crida **només al deixar anar**.
- ⚠️ `snapWall` accepta un conjunt `skip`: les parets del vèrtex que s'està movent no compten per a l'imant, si no el cursor s'hi imantaria a sobre i el vèrtex no es mouria mai.
- **Esborrar un tram**: amb l'eina Parets, clic dret sobre una paret (si no hi ha cap porta a sota) l'elimina. Abans, una paret mal posada només es podia desfer amb Backspace mentre era l'última de la cadena.

### Desfer canvis del mapa (Ctrl+Z de parets, sales, portes i llums)
- **Model** (`rMapHistory` a `useDMRefs`, `_pushMapEdit`/`undoMapEdit` a `useDMActions`): una entrada és **només les quatre referències d'array** (`walls`, `rooms`, `doors`, `lights`) d'abans del canvi. Com que tota mutació d'aquests camps crea arrays nous —el que fa funcionar la dieta del `STATE`—, desar-les no costa cap còpia i restaurar-les torna l'estat exacte. Màxim `MAP_HISTORY_MAX` entrades. DM-only: no es sincronitza ni es desa a la partida.
- **Qui hi entra**: afegir (`'afegir paret'`, des de la v4.29: abans no s'apilava i un Ctrl+Z en desfeia un altre canvi més antic), esborrar i moure paret, esborrar sala, reanomenar sala, afegir/eliminar porta, afegir/eliminar llum i esborrar totes les parets. **No** hi entren les accions de joc (obrir una porta, marcar una sala com a fosca o revelar-la): Ctrl+Z no ha de desfer una decisió de partida.
- **Com es desfà**: amb el «Desfer» únic de la barra superior o Ctrl+Z, que desfan l'última acció de qualsevol mena (veure «Desfer únic»). Desfer un canvi del mapa cancel·la la cadena de parets i la col·locació de porta en curs.

### Menú contextual d'un token (`ContextMenuOverlay`) — amb la fitxa a dins
- **Tot el que és d'un token en un sol lloc**: clic dret al token al mapa, o a la seva fila del lateral (jugadors i enemics de l'Escena). A la v4.30 la fitxa era un panell a baix del lateral i el menú hi enviava amb «Editar la fitxa»; ara la fitxa és **dins del menú**.
- **Ordre**: capçalera (**nom editable**, «💀 Derrotar» / «💀 Derrotat» i ✕) → vida (`HpControl` `md`, si en té) → camps de la fitxa (`TokenFields`: vida màx., mida, i als jugadors velocitat, visió i l'interruptor «Es mou des de la seva pantalla») → estats (compactes) → ✨ conjurs (jugadors amb grimori) → una fila d'accions petites: sortir del grup, cinemàtica, treure de l'escena (biblioteca) o eliminar jugador (amb confirmació en dos passos, desada per id com la de les sales).
- L'estat derrotat és un botó amb nom: abans era un ✕ solt just on s'espera el de tancar.
- **Un sol constructor de l'estat del menú**: `tokenMenuFor(R, id, x, y)` (`lib/token-menu.ts`). El fan servir el clic dret al mapa (`useMouseHandlers`) i a les files (`openTokenMenu` a `DMView`); si se'n fes un segon, els dos menús acabarien sent diferents.
- Llegeix el token de l'**estat** (`resolveToken(id, edit)`, amb `players`, `libEnemies`, `psdEnemyOverrides`… per la prop `edit`), no de refs ni del `contextMenu` (que és una foto del moment d'obrir-lo): així el nom, la vida i els camps es refresquen mentre s'editen.
- ⚠️ **Els camps s'apliquen en confirmar** (`NumField` / `NameField`: Enter o perdre el focus), no a cada tecla: esborrar el número per escriure'n un altre deixaria el token a 0 a mig camí i enviaria un `STATE` per tecla. **Esc dins d'un camp cancel·la l'edició i no tanca el menú** (`stopPropagation`; el menú escolta l'Esc a `window`). L'Esc fa `blur()` abans que React apliqui el `setDraft(null)`, per això hi ha la marca `cancelled` (sense ella, el `onBlur` aplicava l'esborrany igualment).
- ⚠️ **Tancar el menú = primer `blurActive()`**, després desmuntar (`onClose` envolta el de `DMView`). Un camp que es desmunta amb el focus no rep el `blur`, o sigui que un valor escrit i deixat en clicar fora del menú (o en una acció del menú) es perdia. Per això `renameRoom` ara no fa res si el nom no canvia (el camp de nom de la sala també s'aplica en perdre el focus).
- **Menú flotant** (`floatPos`/`onFloat`, estat `menuFloat` a `DMView`): tots els menús del clic dret s'arrosseguen per la capçalera (`MenuHeader`: mànec `GripIcon` o qualsevol tros buit; mai des dels camps ni els botons). Un cop moguts, són flotants: un clic fora no els tanca, el clic dret en buit del mapa tampoc (`setContextMenuFromMap` ignora el `null` mentre `menuFloatRef` hi és), i un clic dret a un altre token el canvia al mateix lloc. **✕ i Esc** (`onDismiss`) tanquen i treuen el flotant. Les accions del menú que el tanquen (parlar, conjur, treure de l'escena…) fan servir `onClose` i conserven el lloc per al pròxim. `floatBox` el retalla perquè la capçalera es vegi sempre i el cos faci scroll.
- **Regla**: un camp nou d'un token va a `TokenFields` (dins d'aquest menú), no a un panell ni a una targeta.

### Cinematica boss reveal (`src/lib/cinematic/bossIntro.ts`)
- **Un sol motor per al DM i el jugador** (`playBossIntro`): abans eren dues còpies de ~200 línies a `useCinematic` i `PlayerView` que ja havien divergit. Cada pantalla només hi posa el seu escenari, la seva càmera i el seu tick (`cinematicRef.current?.tick(now)`).
- **Cada execució és propietària de tot el que crea** (elements, timeouts, espurnes) i `dispose()` ho desfà tot. ⚠️ No tornar a una neteja amb `setTimeout` que toqui refs compartides: la d'una cinemàtica saltada esborrava les dades de la següent.
- **Llançament únic** (`launchBossIntro` a `useCinematic`): la reprodueix al DM, codifica el retrat (`encodePortrait`: JPEG ≤600 px; els GIF animats tal qual fins a ~3 MB) i envia `BOSS_INTRO` per BC i WS. Retorna el retrat codificat perquè `SceneConfigOverlay` el desi al token si era una imatge triada a mà. `ContextMenuOverlay` i `SceneConfigOverlay` no fan cap `postMessage` propi.
- **Càmera en coordenades de mapa**: el DM calcula `cam` (`bossCamRect`: la meitat del que veu, entre 1/1,8 i 1/4 del mapa, retallat al mapa) i viatja dins `BOSS_INTRO`. Cada pantalla el tradueix amb `camToView` cada frame (`cinematicCamRef.rect`), igual que la càmera compartida. Al DM la vista s'interpola des de la seva vista actual i, en acabar, hi torna suau (`active` es manté fins que hi arriba); al jugador ho fa el seu LERP de càmera. Si el DM és antic i no envia `cam`, el jugador el calcula des de `rCam`.
- **Mides de l'escenari** (`stage.clientWidth/Height`), mai de `window`: al DM el sidebar en treu un tros.
- **Espurnes deterministes**: funció pura de (llavor = `seedFor(tokenId)`, índex, temps) — iguals a totes les pantalles i independents dels fps.
- El jugador compensa el que triga a descodificar el retrat (`offsetMs`, màx. 600 ms) perquè no vagi endarrerit. Una `BOSS_INTRO` nova mentre en corre una la reemplaça.
- Esc al DM la salta a tot arreu (`BOSS_INTRO_SKIP`); Esc a la pantalla de jugador només la salta allà. Amb `prefers-reduced-motion`, flaix suau i sense glitch ni parallax.
- ⚠️ **Rendiment: animar només `transform` i `opacity`.** El resplendor del nom animava un `text-shadow` amb desenfocs de 220 px i feia caure els fps de 60 a ~36 (tot el nom es repintava a cada frame). Ara és una còpia del nom amb una ombra de 50 px + un halo de degradat radial, pintats un cop, i se n'anima l'opacitat. Desenfocs grossos (`text-shadow`, `filter: blur`) només estàtics i de mida moderada.
- `SceneImgPicker` per importar imatge custom al menú de configuració.
- **Diàleg després de la cinemàtica**: un diàleg desat amb «Després de la cinemàtica de boss» la llança i comença quan s'acaba (veure «Diàlegs de personatges»).
- **Pendent**: no té en compte la boira de guerra (si el boss és dins d'una sala fosca, la càmera hi fa zoom i es veu negre) ni l'agafa una pantalla que es connecti a mitja cinemàtica.

### Cinemàtiques de boss en pixel art (`src/lib/cinematic/pixelIntros.ts`)
- **Selector** a `SceneConfigOverlay` (botó «Cinemàtica» del menú d'un token, que ara obre sempre el selector): «La de sempre» + les 10 de `PIXEL_INTROS` (encontre salvatge, repte del líder, apareix un monstre, mirall trencat, portal del temps, fons psicodèlic, WARNING, versus, rètol del boss, l'ombra). L'última triada es recorda a `localStorage['rpg_boss_intro']` (`useStoredString`). **«Veure-la»** (`BossIntroRequest.preview`) la reprodueix només al DM: no s'envia. El selector es munta amb `key` = token, així els enemics triats i el missatge es buiden en obrir-lo per a un altre.
- **Grups** (`BossIntroRequest.extras`, fins a `MAX_FOES − 1`, de `sceneFoes` a `DMView`: enemics del PSD i de la biblioteca): `foeOf` (`useCinematic`) en treu nom, figureta i, sense figureta, una imatge petita (`smallImage`, dataURL ≤ 96 px) que viatja dins de `BOSS_INTRO.extras`. A l'escena, `foeSlots` reparteix el grup: el boss al mig i la resta més petits als costats i enrere, o `row` (tots iguals en fila, Dragon Quest). Una escena nova ha de pintar els enemics amb `foes()`/`foeSlots()`, mai només el boss.
- **Missatge propi** (`message`): les cinemàtiques amb `PIXEL_INTROS[].msg` el mostren al selector com a exemple i el DM en pot escriure un altre; `say(e, id)` resol `{nom}` amb el nom del grup (`groupName`: «A, B I C» o «A I 3 MES»). `wrap` el parteix per paraules i `sayLines` l'escriu lletra a lletra amb els noms en groc.
- **Motor** (`playPixelIntro`): mateix contracte que `playBossIntro` (`BossIntro`: `tick`/`skip`/`dispose`), o sigui que `cinematicRef`, l'Esc i `BOSS_INTRO_SKIP` funcionen igual. Pinta en una **pantalla virtual** d'uns 200 px d'alt (píxel `P = round(H/200)`) ampliada amb `image-rendering: pixelated`: sprites, lletra i finestres queden a la mateixa escala de píxel. Cada escena és una funció pura de (t, llavor) → totes les pantalles veuen el mateix al mateix moment. Comença amb una captura de l'escenari (`snapshotStage`) per a les que trenquen o tapen el mapa.
- **Material** (tot dels fulls de `public/sprites/`, també a l'app Clàssica): figureta del boss (`sprite`; sense figureta, el retrat), la colla (`party`, fins a 5 jugadors visibles amb la seva figureta), la lletra 7×7 del full d'interfície (`text`: només majúscules sense accents, `pixelText`; la «I» es corregeix al full tenyit i la decorada fa servir la normal perquè semblava un «1»), la finestra fosca (`panel` → `drawWindow` de `lib/sprites/window.ts`, la mateixa dels diàlegs), les barres de vida (`hpBar`: 48×12 amb extrems de 3 px; blocs de color cada 160 px, blau 0, vermell 160, verd 320) i els efectes de `uf_FX`/`uf_FX_impact`. ⚠️ Lletra: els glifs es pinten amb 8 files (la cua de la coma i del punt i coma és a la 8a) i el punt és fet a mà (el full no en té: el glif del seu lloc és un punt volat).
- **Sync**: el mateix `BOSS_INTRO` amb `style`, `sprite`, `party`, `extras` i `message` (la API el reenvia opac: cap canvi a la API). Sense `cam`: tapen tot l'escenari i no cal acostar la càmera.
- Mentre els fulls es carreguen (o si no s'han pogut llegir) no es poden triar al DM, i una pantalla de jugador sense fulls fa la de sempre.
- **Mides de figura**: `fitSize` (múltiple de 48 per sota) o `fitRound` (el més proper): mai escales no enteres, que deformen el pixel art. Amb `fitSize(H*0.45)` una figura queda a 48 px en una pantalla de 200 i l'usuari la va trobar petita.
- **Afegir-ne una**: funció `Scene` + entrada a `PIXEL_INTROS` (amb `dur` i, si té text, `msg`) i a `SCENES`.

### Bola de foc (`src/lib/render/fireball.ts`)
- **Quatre temps** (constants `CHARGE`, `TRAVEL`, `IMPACT_AT`, `FIREBALL_DUR`): ignició directa a la mà (flamarada + flaix direccional, 0,14 s; **res de cercles rúnics**: l'usuari els va trobar massa místics) → projectil que accelera amb cua de foc que queda al món → impacte (flaix, bola que s'infla i es refreda, ona expansiva amb anell de pols, terra que s'encén, runa, fum) → socarrim amb brases. Radi visual: 15 ft (`BLAST_FT`).
- **Partícules deterministes**: cada partícula és funció pura de (llavor del `sp.id`, temps). Cap estat entre frames → DM i jugadors veuen la mateixa explosió. ⚠️ Dins de cada sistema, **tots els `rnd()` d'una partícula es treuen abans del `continue`** de les que no són vives; si no, el flux del PRNG es desalinea i les partícules canvien a mig efecte.
- **Sprites** (`fxsprites.ts`): foc (4 temperatures × 3 variants de soroll), fum, halo i socarrim, generats una sola vegada amb `ImageData` i copiats amb `drawImage`. La temperatura contínua es fa fonent dos sprites veïns (`fire()`). No tornar a `createRadialGradient` per partícula: és més car i tot surt amb forma de cercle perfecte.
- **Dues passades**: el socarrim i les brases (`drawFireballGround`) van a la `'ground'`, sota els tokens; la resta a la `'air'`.
- **Sacsejada de càmera** (`spellShake` a `spells.ts`, que suma `fireballShake` i `lightningShake`): el tick del DM (`useRafLoop`) i el del jugador (`PlayerView`) la sumen a `ox/oy`, així el fons DOM i el canvas es mouen junts. No afecta `rDmCam` (que surt de `rZoom`/`rPanOffset`) ni es sincronitza: cada pantalla la calcula del seu `startTime`. Un spell nou amb sacsejada s'afegeix a `spellShake`, no als ticks.
- **Ajudants comuns** (`fxsprites.ts`): `glow`, `blitStretch` (sprite estirat: flares, flaixos direccionals), `fire` (bufarada de foc amb temperatura), `streak` (espurna), `impactBurst`, `smoothstep`, `dragged` (desplaçament amb fricció), `fxCell` (mida de casella o fallback de pantalla)… Els efectes nous els han de fer servir en lloc de copiar-los.

### Llenguatge visual comú dels spells
- **Una paleta per escola** (`PAL` a `fxsprites.ts`: `fire`, `arcane`, `charm`, `dream`; cadascuna `white → light → mid → deep`). Un spell nou n'agafa una; no s'inventa colors propis. Projectil i raig màgic = `arcane`; bola de foc i mans ardents = `fire`.
- **Impacte únic** (`impactBurst`): flaix → llum → anell → espurnes. Tots els spells que toquen un objectiu l'usen, a una mida proporcional al seu nivell.
- **Estructura en fases** (càrrega/llançament → acció → resolució), mides en caselles (`fxCell`), llum dinàmica amb `glow` additiu i partícules deterministes per llavor.
- **Contenció**: els spells de nivell 1 (`minorspells.ts`) són més curts i amb menys peces que la bola de foc o els raigs. Sacsejada de càmera només als grossos (bola de foc, llamp).
- **Llegibilitat primer**: quan un efecte de partícules no deixa clara l'àrea, s'hi afegeix una capa de forma suau (la falca de calor de les mans ardents, l'onada i el contorn de dormir).
- **Àrees persistents** (`areaspells.ts`): reben `e` clampat a la meitat de la durada (l'aparició hi ha de cabre sencera); el que es mou mentre hi són va amb el rellotge absolut. Mai surten de l'àrea de reglament.

### Raig elèctric (`src/lib/render/lightning.ts`)
- **Geometria fractal**: desplaçament recursiu del punt mig (`fractal`) amb branques que surten dels punts mitjos. ⚠️ Les branques només es generen a nivells grossos (`depth >= 3`) i amb fondària limitada: sense això un llamp llarg fa milers de segments. Els segments es tracen **agrupats per gruix** (`strokeBolt`: un path per nivell), no un stroke per segment.
- **Descàrregues a intervals irregulars** (`strikeTimes`, deterministes per llavor): cadascuna té geometria nova (`boltFor`, memòria cau per `spellId:índex`, podada a `pruneLightningFx`) i una intensitat amb pic i caiguda exponencial més un fons que manté el llamp visible entre descàrregues.
- Líder que avança a salts (0,1 s) → descàrrega principal amb flaix i sacsejada → re-descàrregues → postllum violeta. Marca socarrimada a la passada `'ground'` (`drawLightningGround`).

### Raig màgic (`src/lib/render/magicbeam.ts`)
- Càrrega (espurnes en espiral + destell anamòrfic horitzontal) → el raig s'estén en 0,12 s → sostingut (capes violeta/magenta/blanc que vibren, fibres en hèlix, anells, polsos, espurnes; a l'impacte estrella giratòria, ones i esquitxos) → col·lapse i implosió.
- ⚠️ Les **fibres en hèlix** es mostregen a ~12 punts per volta (`NH`), independentment del mostreig del cos del raig: amb poques mostres surten en ziga-zaga. Es tracen en dues passades (davant / darrere) per donar profunditat sense fer un stroke per segment.

### Previsualització de les màgies als jugadors (`spellPreview`)
- **Problema que resol**: quan el DM apuntava una màgia (el cercle de Dormir, l'abast del grimori, la línia d'un raig amb els peus) només ho veia ell. Els jugadors no podien dir «una mica més a l'esquerra, que hi entri el goblin» ni veure a qui agafarà l'àrea.
- **Font**: la mateixa `rSpellPreview` que ja pinta el DM (`SpellPreview`: `line` o `area_place`). Tots els camins que l'apunten (Maj+arrossegar, roda d'àrees, grimori del token, Esc, clic dret…) hi escriuen un **objecte nou**.
- **Enviament** (`useRafLoop`): el tick compara la ref amb l'última enviada i, si ha canviat, envia un `STATE` (throttle ~20 Hz amb reintent: `sentPreview` només s'actualitza en enviar, així el `null` final de llançar-la o cancel·lar-la sempre arriba). Un sol punt de detecció: cap handler ha de cridar res. ⚠️ Mai mutar `rSpellPreview.current` in place (el tick no veuria el canvi).
- **Transport**: camp lleuger `spellPreview` dins del **`STATE`** (sempre, `null` = cap) i del `STRUCT`. No és un missatge propi a propòsit: el servidor reenvia el `STATE` opac (com el camp `cam`), o sigui que funciona a la tablet per WebSocket **sense tocar la API**. Absent al missatge (DM antic) → el jugador no toca res.
- **Jugador** (`PlayerView`): desa l'última rebuda a `rSpellPreviewTarget` i cada frame `followSpellPreview` (`render/spells.ts`) hi acosta la que es pinta (`rSpellPreview`, LERP 0,35): el cercle i la punta llisquen en lloc d'anar a salts de 20 Hz. Una altra màgia, un altre mode o un altre origen → salta directe. La pinta `renderSpells` (passada `'air'`), com al DM.
- **Boira de guerra**: es pinta **abans** de `renderRooms`, com les màgies: dins d'una sala fosca no es veu (si no, una línia que surt de la foscor delataria l'enemic que la llança).
- Les màgies de **trajectòria** (traç obert) no tenen previsualització ni al DM: no s'envien.

### Roda de màgies i zones (`src/components/ui/RadialMenu.tsx`)
- **Una sola roda** per a tot el que obre l'eina Màgies: `SpellMenuOverlay` (màgies de trajectòria, direccionals i d'àrea) i `ShapeMenuOverlay` (elements de zona màgica) només li passen les opcions. Abans eren dos menús amb dissenys diferents.
- **Quina roda surt depèn del gest** (`useMouseHandlers`): traç obert → trajectòria; tancar el traç → zona màgica; Maj+arrossegar → direccional; Alt+clic o traç que es creua → àrea. Els noms i subtítols dels quatre gestos viuen a **`SPELL_MODES`** (`constants`) i els fan servir la roda i l'ajuda de la barra: si en canvia un, canvia als dos llocs.
- Sectors opacs amb icona + nom; el primer centrat a dalt i la resta en sentit horari. Centre: títol i subtítol del mode o, en hover, nom i detall de l'opció (el detall es parteix per « · » en línies; si no en té, diu la tecla).
- ⚠️ **Teclat en fase de captura** (`stopImmediatePropagation`): 1…N trien i Esc tanca. Si no, les xifres canviarien d'eina (1–6) i l'Esc tornaria a l'eina de selecció.
- La roda es recol·loca perquè no surti de la finestra. Clic al centre o fora = tancar.
- Noms de màgies (`SPELL_TYPES.title`, amb `SPELL_BY_TYPE`) i d'elements (`ELEMENTS.label`) en català: són els mateixos que surten al menú contextual («💤 Dormir», «🔥 Zona de foc»).

### Grimoris dels personatges (`SPELLBOOKS` a `constants` + `bookspells.ts`)
- **Font**: les fitxes de la base «DIVAS y TRAGONAS» del Notion; el de **Liriandor** el va confirmar el jugador a la v4.33 (base + Grasa i Risa horrible de nivell 2 + Hechizar persona per un objecte). Cada grimori és una llista `{ name, level, type, item? }`: `name` tal com està apuntat (en castellà), `type` l'efecte que el pinta i `item` si la màgia la dona un objecte (surt a la finestreta del botó; si el personatge perd l'objecte, s'ha de treure del grimori). Només en tenen **Liriandor** (mag) i **Yunquerin** (clergue); la resta són guerrers i pícar. `spellbookFor(nom)` el troba pel **primer nom** del jugador, sense accents ni majúscules («Liriandor Líadon» → `liriandor`). Si es reanomena un jugador amb un altre primer nom, el grimori deixa de sortir.
- **Gest de cada màgia** (`SPELL_TYPES[].mode`): `path` (traç), `line` (en línia recta), `area` (a un punt dins d'abast) i `self` (surt del llançador). `tokenOnly` → de toc o personals: només es llancen des del grimori (sense llançador no tenen sentit) i no ocupen les rodes dels gestos.
- **Abast**: `AREA_SPELL_DATA[t].rangeFt` per a les àrees (0 = personal) i `LINE_SPELL_RANGE_FT` per a les direccionals; `spellRangeFt(t)` és l'única lectura. `clampToRange` (`lib/spellcast.ts`) el fa complir **al moviment i al clic** (si no, la previsualització i el que es llança no coincidirien). Sense graella no es limita (no hi ha mida de casella per passar de peus a píxels).
- **Llançar des del token**: menú contextual d'un jugador → ✨ Conjurs (`Spellbook` a `ContextMenuOverlay`, origen = `ContextMenuState.casterPos`, el centre del token). `castFromToken` (`DMView`): les personals surten a l'instant; la resta deixen `rAreaPlacementPending` amb `mode: 'line' | 'area'` i el clic següent fixa el destí. **Funciona amb qualsevol eina** (el clic i la previsualització van abans de les branques de cada eina). Esc o clic dret el cancel·len.
- **Persistents vs instantànies**: `AREA_SPELL_DATA[t].persistent` (dormir, greix) → passada `'ground'`, arrossegables i amb menú per esborrar (`PERSISTENT_SPELLS`). La resta fan l'animació i caduquen com un projectil. ⚠️ No tornar a escriure llistes `['sleep','grease']` a mà: es deriven de `PERSISTENT_SPELLS`.
- **Efecte nou**: funció a `bookspells.ts` + durada a `SPELL_DURATIONS` i entrada a `BOOK_SPELLS` (`spells.ts`). Arriba al jugador pel mateix `SPELL` de sempre: cap camp de sync nou.
- **Encisar persona** (`charm_person`, `bookspells.ts`): direccional de 30 ft, paleta `charm` (la mateixa escola que Risa horrible). Dues hebres en hèlix (~12 mostres per volta, com les fibres del raig màgic) amb un cor a la punta → lligam fi que s'esvaeix → batec «lub-dub» a l'objectiu i tres cors que li orbiten sobre el cap.

### Zones màgiques (Painted Zones) — `render/zonefx.ts` + `textures/fields.ts` + `textures/noise.ts`
- Polígons amb element de `ELEMENTS` (fire, ice, water, lightning, poison, magic). Al DM es pinten amb color pla i l'emoji (`drawFlatZone`); a la pantalla del jugador, animades (`drawZoneFx`).
- **Història, per no repetir-la**: la v4.33 era soroll calculat texel a texel 8–20 cops per segon (anava a salts i era car). La v4.34/v4.35 el va canviar per textures enrajolables que llisquen + vora lluminosa + partícules, i l'usuari ho va rebutjar tot: vores marcades, foc «d'animació cutre», aigua amb capes que no lliguen, màgia amb una espiral, llamp massa nítid, gel amb filaments solts i cap cohesió entre elements. La v4.37 torna als **camps de la v4.33** (el foc tal qual: «el terra semblava que cremés») amb el que fallava arreglat.
- **Un sol pipeline per als sis elements** (és el que dona cohesió: mateixa vora, mateixa definició, mateix pressupost de moviment):
  1. **Vora**: polígon rasteritzat a `D` texels per casella → camp de distàncies amb signe (EDT de Felzenszwalb–Huttenlocher, `edt2d`) → `maskA` = rampa suau de ±`EDGE_H` caselles centrada al contorn (més estreta a les zones petites) + erosió quieta amb soroll (`EROSION`).
  2. **Interior** (`inner`, 0 a la vora .. 1 a dins): la màscara difuminada (`boxBlur`) i normalitzada; no fa plecs a l'eix mitjà. L'aigua s'hi fa més fonda, el gel hi posa el gebre i els arcs del llamp s'hi esvaeixen.
  3. **Camp de l'element** (`FIELDS` a `fields.ts`): funció (texel, temps) → rgba, avaluada a baixa resolució i ampliada amb un sol `drawImage` bilineal (la suavitat ve d'aquí). `wx, wy` = unitats antigues (px de mapa / `TSCALE` 90) per als camps de la v4.33; `px, py` = caselles per al que és nou. Els termes que no depenen del temps es calculen un sol cop per texel (`prep` → `st`).
  4. **Accents**: només el llamp (arcs curts a `drawArcs`). Res més dibuixat a sobre.
- **Fotogrames clau** (`step`, `work`): el camp no es calcula a cada fotograma (costava 6–40 ms per zona). Cada element té un `period` (foc 0,15 s, aigua i màgia 0,25, llamp 0,25, verí 0,3; el gel és quiet: un sol fotograma) i es calcula el següent clau **fila a fila** dins d'un **pressupost compartit** (`BUDGET_MS`, repartit entre les zones que tenen feina; la que encara no té cap clau pot gastar tot el que queda). Entre dos claus es fon amb `'lighter'` a pesos (1−f) i f en un llenç propi: interpolació exacta, sense batec d'opacitat (mesurat: el contrast varia <0,5% al ritme dels claus). Si el pressupost no arriba, l'animació **va més lenta, mai no salta**.
- **El camp es mesura des de la cantonada de la zona** (+ un desplaçament per llavor de l'`id`): arrossegar una zona la trasllada sense refer res. Estat per zona a `_states` (`Map` per `id`, amb `signature` de la forma relativa + casella): forma o graella noves → es refà; sense dibuixar-se 10 s → s'esborra (`EVICT_S`). `_byZone` (WeakMap) evita recalcular la signatura cada fotograma.
- **Mides en caselles** (`gridSize`; sense graella, `NO_GRID_CELL` fix): mateixa escala al mapa sigui quina sigui la zona. Les zones grans baixen de `D` (màx. `MAX_TEX` texels) en lloc de costar més.
- **Llamp**: núvol de tempesta fosc i suau + venes amples que parpellegen (camp) + arcs curts que espurnegen (cada arc viu ~0,3 s i canvia de forma 12 cops per segon; halo ample, mig i nucli de ~0,08 caselles). Els arcs es pinten a 30 px per casella i **només al rectangle que ocupen** (esborrar, esvair amb `inner` i copiar): fer-ho al llenç sencer costava 1–3 ms per fotograma.
- **Rendiment**: el soroll de valor antic fa servir un **hash enter** (`txHash`); el `sin` de la v4.33 costava ~26 ns i el foc en fa 80 per texel. Mateix soroll estadísticament, 3× més ràpid. Ampliació **bilineal** (`imageSmoothingQuality = 'low'`): 'high' duplicava el cost i no es nota. Zones fora de pantalla: ni es calculen ni es pinten. Mesura de referència (rasteritzador per programari, sis zones): 60 fps; amb sis zones enormes, algunes animacions baixen a ~0,7× de velocitat.
- ⚠️ **Res de `ctx.filter` ni de `shadowBlur` per a la vora**: la pantalla de jugador sovint és un iPad (Safari no suporta `filter` i comprimeix el `shadowBlur` gran). La vora surt de la màscara SDF.
- ⚠️ **Prohibit** (l'usuari ja ho ha rebutjat): vores lluminoses, contorns o partícules a la vora; capes de textura que **llisquen** (el moviment ha de ser el camp que evoluciona **on és**); espirals, remolins, cercles arcans, runes o símbols a la màgia (ha de semblar un fluid místic); línies d'1 px o més nítides que la resta (el llamp de la v4.35); filaments solts al gel; flames dibuixades com a sprites. Un element nou ha de passar pel mateix pipeline i tenir la mateixa definició que els altres.
- Per afegir un element: entrada a `FIELDS` (`fields.ts`, amb el seu `period`) i a `ELEMENTS` (constants).

### Parets → Sales fosques (eina "Parets", drecera `5`)
- **Model**: el DM dibuixa **parets** (segments) clicant successivament (estil regla de mesura). El conjunt de parets és la font de veritat del DM (`rWalls`). Les **sales** (`rRooms`) se'n deriven per **detecció de cares en un graf planar** (`src/lib/rooms/detect.ts` → `detectRooms`): fusiona vèrtexs propers, parteix als encreuaments (X) i a les unions en T, i extreu les cares tancades mínimes (recorregut de half-edges amb gir horari; cares acotades = àrea > 0 en coords de pantalla). Cada cara nova és una sala; una paret que divideix una sala la parteix en dues. Les **portes** són entitats explícites sobre les parets (veure secció següent); un tram sense dibuixar entre parets també fa d'obertura.
- **Reconciliació** (`reconcileRooms`): a cada canvi de parets es recalculen les cares i s'aparellen amb les sales existents (per centroide + àrea) perquè `id`, nom i estat (`dark`/`revealed`) es preservin.
- **Interacció** (`useMouseHandlers`, eina `'wall'`): clic afegeix un vèrtex i tanca el tram amb l'anterior; `snapWall` fa imant a **vèrtexs i arestes** de parets existents (tancament + unions en T "sobre rails") i snap a graella. En completar-se una geometria nova (augmenta el nombre de sales) la cadena **s'acaba automàticament** (`rWallChain`), cal tornar a clicar. `Backspace` desfà l'última paret (`removeLastWall`), `Esc` cancel·la tota la cadena en curs (`cancelWallChain`). Re-detecció via `redetectRooms` (a `useDMActions`).
- **Sales fosques**: les sales noves **neixen fosques per defecte** (`reconcileRooms` a `detect.ts` → `dark: true`); `Room.dark` també es commuta via clic dret (el menú s'actualitza en viu) → interior negre opac al jugador; `Room.revealed` (ull: clic sobre la sala en mode selecció, o menú contextual) → es revela amb fade suau (`roomRevealAnimRef`). **Revelar és lliure, però amagar una sala revelada amb l'ull requereix el mode Shift actiu** (`rShiftPanToggle`), com les sales PSD. Menú de sala a `ContextMenuOverlay` (`isRoom`): marcar fosca, revelar/amagar, reanomenar, afegir porta, resetejar explorat i eliminar. **Eliminar demana confirmació en dos passos** (`confirmDelRoomId` a `ContextMenuOverlay`: es desa l'**id** de la sala pendent de confirmar, no un booleà, perquè obrir el menú d'una altra sala no arribi ja confirmat sense necessitat d'un efecte que reiniciï l'estat).
- **Render** (`src/lib/render/darkrooms.ts`): `renderRooms` — al **jugador** es pinta DAMUNT de tot (després dels tokens/spells) perquè qualsevol token/dibuix dins una sala fosca quedi amagat (fog of war); al **DM** va dins la transformació de mapa (semitransparent, hi veu a través). El farciment es fa amb el polígon + contorn del mateix color perquè les sales contigües se solapin i no quedi cap fil visible a la paret compartida. `renderWalls` (parets, només DM), `renderWallDraft` (paret elàstica en curs, espai pantalla).
- **Sync**: camps `rooms` i `walls` a `STATE`/`STRUCT` (pesats: només s'envien quan canvia la referència). Persisteix a la sessió (`walls` + `rooms`). Les parets viatgen al jugador **però no s'hi dibuixen**: calen per a la llum (línia de visió) i per a la col·lisió de moviment.
- **Pendent** (futur): revelat automàtic de la sala sencera en entrar-hi un jugador. Obrir/tancar portes i edició de vèrtexs ja estan fets (veure «Portes» i «Editar parets ja dibuixades»).

### Portes (col·locació obligada en tancar una sala)
- **Model** (`Door` a `types/index.ts`, helpers a `src/lib/rooms/doors.ts`): una porta és un **segment sobre una paret** (`{id, a, b, open?}`). Per a llum i col·lisió es calculen les **parets efectives** (`effectiveWalls`): cada paret amb els trams de porta **oberta** retallats — per una porta oberta hi passen la llum i el moviment; una porta **tancada** (`open: false`) deixa la paret sencera i torna a bloquejar. La detecció de sales continua usant les parets senceres (una porta no parteix la sala). Una paret pot tenir **diverses portes**.
- **Obrir/tancar**: amb el **cursor normal (mode selecció)**, passar per sobre d'una porta la **destaca** (hover reactiu tipus botó: traç brillant + halo + cursor `pointer`, `rHoveredDoorId`) i el **clic la commuta** (`toggleDoor`). Les portes noves neixen **tancades**.
- **Amplada per dos clics** (`nearestWallHit` + `doorEndOnWall` a `src/lib/rooms/doors.ts`): la col·locació és de **dos clics**. **Primer clic** → marca l'inici de la porta imantat a la paret més propera (`rDoorPlacement.current.anchor = { wall, s }`). **Segon clic** → fixa el final (l'amplada) projectat sobre la **mateixa paret** i crea la porta (`addDoor`). Amb grid **i el "snap grid" actiu** (`rGridSnap`), cada extrem s'imanta a la línia de graella més propera al llarg de l'eix dominant de la paret (`snapSToGrid`); si el snap està desactivat, la porta es col·loca lliure. No hi ha límit de mida ni control `+/−` (deprecats: `rDoorWidthCells` i `doorPlacementAt` queden sense ús).
- **Col·locació obligada**: en tancar-se una sala nova amb l'eina Parets, s'obre automàticament el **mode de col·locació de porta** (`rDoorPlacement`). Sense inici marcat, la previsualització (`rDoorPreview`) és un **punt** imantat a la paret; amb l'inici marcat, és el **segment** de porta de l'inici al cursor projectat. **Segon clic → col·loca i surt**; **Maj+2n clic → col·loca i continua** (per posar-ne més); **Esc → desfà el primer clic si n'hi ha, si no omet**. El rètol d'ajuda (amb l'amplada en peus quan hi ha inici) es pinta a `renderDoorDraft` (espai pantalla, `useRafLoop` després de `renderWallDraft`).
- **Gestió**: menú contextual de sala → "🚪 Afegir porta" (`startDoorPlacement`, activa l'eina Parets en mode porta, permet més d'una porta per sala). Amb l'eina Parets, **clic dret sobre una porta l'elimina** (`removeDoor`, la paret es tanca de nou). `pruneDoors` (cridat a `redetectRooms`) fa caure soles les portes que perden la seva paret (Backspace, eliminar sala, Esc de cadena...).
- **Render** (`renderWalls`): el traç sòlid de paret usa les parets efectives (el forat es veu de veritat) i cada porta es marca amb un **rectangle de traç gruixut del mateix daurat que les parets** (`drawDoorMark`) muntat sobre la paret: **oberta → buit per dins; tancada → interior pintat**. En hover es ressalta (traç brillant + halo). Només al DM.
- **Sync**: camp pesat `doors` a `STATE`/`STRUCT`; persisteix a la sessió. El jugador les usa (parets efectives al drag i a la llum) però no les dibuixa.

### Il·luminació de sales fosques (llum per token de jugador)
- **Model**: cada token de jugador **visible** emet llum dins del seu radi de visió (`Player.visionFt`, peus; per defecte `DEFAULT_VISION_FT = 30`, `0` = sense llum; el DM l'edita al menú del clic dret del token via `setPlayerVision`). Com `speed`, viatja dins l'array `players` sense camps de sync nous. **Radi efectiu = `visionFt/5 − 1` casella (mínim 1)** — es veu una mica menys que la visió nominal. La condició **cegat (`blinded`)** força el radi al mínim (**1 casella, 5 ft**) mentre dura.
- **Animacions de llum** (`_lightAnim`, `_doorAnim` a `darkrooms.ts`, mòdul-level com `_darkCanvas`): el **radi** i la **intensitat** de cada llum s'animen amb LERP. (1) **Mort**: la llum es manté mentre dura la X (`defeatedAnimRef` 0→1) i **després** l'intensitat baixa a 0 (la sala s'enfosqueix suau). (2) **Canvi de visió**: el radi LERPa cap al nou valor. (3) **Portes**: l'obertura de cada porta s'anima (`_doorAnim` 0..1) **només per a la llum** via `effectiveWallsAnimated` (el forat creix/s'estreny gradual); la **col·lisió de moviment** segueix usant `effectiveWalls` (binari, instantani).
- **Render** (`renderRooms` a `src/lib/render/darkrooms.ts`): la foscor de les sales fosques es pinta en una **capa fora de pantalla** (`_darkCanvas`, reutilitzada; mateixa transformació que el ctx via `getTransform`), s'hi **esborren** les zones il·luminades amb `destination-out` i es composita el resultat. Cada llum és la **UNIÓ de dues zones**, ambdues retallades amb el gradient radial: **(a) la SALA on és el token** (`pointInPoly` sobre `rRooms`) → dins de la teva sala veus **tot el radi**, sense ombres internes de mobles/murs/estructures; **(b) el polígon de visibilitat** (raycasting per escombrat angular contra les parets, `src/lib/rooms/visibility.ts` → `visibilityPolygon`) → per a la llum que s'escola per **portes i obertures cap a ALTRES sales** (allà sí que les parets fan ombra). Així l'oclusió només compta per canviar de sala, no dins de la sala pròpia. La UNIÓ es construeix com una **màscara plana** (blanc opac de sala + polígon a `_lightTmp`) i s'hi aplica el gradient **una sola vegada** amb `source-in` — clau perquè la superposició sala/polígon NO dobli l'alfa (que destruïa el gradient a la zona de solapament). Gradient radial (la sala "es va il·luminant" amb la distància; radi animat, veure a dalt). L'alpha del gradient s'escala per la **intensitat** de la llum (0..1) per a l'esvaïment en morir. El gradient radial manté la **brillantor plena fins al 90% del radi** i només s'esvaeix a l'últim tram (així una sala més petita que el radi queda del tot il·luminada fins a les parets). Les llums s'acumulen a una **capa de llum** (`_lightCanvas`) que es composita amb `destination-out`. La llum s'atura **EXACTAMENT a les parets** (el polígon de visibilitat les respecta): **res de blur ni d'engreix cap enfora** — abans feien vessar un marge de llum a la sala del costat (fuga a bordes adjacents). Per eliminar el **fil fosc arran de paret** (el polígon queda un pèl per dins) sense tornar a vessar, es fa un **traç de la vora del polígon RETALLAT a l'interior** (el `clip` encara actiu descarta la meitat exterior del traç). La vora exterior suau la dóna el gradient radial. Les parets bloquegen la llum; s'escola per les portes i obertures (es raytraça contra les **parets efectives amb obertura de porta animada**, `effectiveWallsAnimated`). Sense fonts de llum es pinta directe (camí barat, com abans). El centre de la llum segueix `visualPosRef` (LERP) perquè es mogui fluida.
- **Boira "explorada" (AoE)** (`_exploredCanvas`, `_memCanvas` a `darkrooms.ts`, sempre actiu): a les zones ja vistes però ARA fosques es mostra el **mapa de fons ATENUAT** (`MEM_DIM`), però **no els tokens** (queden sota la foscor opaca). Els polígons de visibilitat s'acumulen a una **màscara alpha en coords de map** (resolució reduïda, `EXPLORED_MAX`; es reinicia quan canvia la mida del mapa, local a cada pantalla), **retallats a la unió de sales fosques i al radi de visió** — així una zona oberta (sense sala) que un token il·lumina no queda marcada com explorada (si després s'hi crea una sala fosca, surt negra fins que s'hi entra). Cada frame es construeix `_memCanvas` = terreny (`fc.mediaEl`) retallat a `explorat` (destination-in amb la màscara) ∩ `fosc-no-il·luminat` (destination-in amb `_darkCanvas` post-carve) i es composita atenuat damunt de la foscor. Les zones no explorades queden negres; la il·luminada actual es veu en viu (el `_darkCanvas` post-carve hi és transparent).
- **DM**: mateixos forats de llum sobre el seu overlay semitransparent (així veu exactament què veuen els jugadors); contorns, noms i ull es pinten a sobre com sempre. `revealed` (ull) continua sent el revelat manual de tota la sala.
- **Rendiment (⚠️ no fer marxa enrere)**: el cost de la llum creixia amb *nombre de tokens × àrea de la finestra* i saturava l'app amb una party gran. Optimitzacions clau:
  0. **Memòria cau del rasteritzat de cada llum** (`_maskCache`, clau = `Light.key`). Rasteritzar una llum (màscara sala ∪ polígon de visió → erosió → gradient) és **el gruix del cost del frame**, i es refeia per a TOTES les llums a cada frame encara que només se n'hagués mogut una. Ara es reutilitza el canvas de la llum mentre no canviï la firma: parets/portes (`wallsSig`), transformació de càmera, rectangle de pantalla i posició/radi/intensitat (**quantitzats a ¼ de píxel de pantalla** — imperceptible, i necessari perquè el LERP del token, que convergeix asimptòticament, torni a encertar la memòria cau al cap d'un segon en lloc de fallar-hi durant vuit). El rasteritzat es fa **directament al canvas de la memòria cau, en coordenades locals del rectangle** (`T.e - bx, T.f - by`), així desar-lo no costa cap còpia. Mesures (80 sales, 1600×900, rasteritzador per programari): movent 1 token amb 5 jugadors 98→52 ms/frame; amb 8 jugadors 133→51 ms; tothom quiet 94→45 ms.
  0b. La màscara es **torna a traçar** a `tmp2` en lloc de copiar-s'hi amb un `drawImage`: al perfil els `fill` no hi surten i els blits són el 64% del frame. No canviar-ho per una còpia "per estalviar un fill".
  1. **`carveLights` treballa per rectangle de llum.** Cada llum calcula el seu bbox en píxels de pantalla (centre transformat per `octx.getTransform()`, radi × escala, +3px de marge), fa `clip()` a aquest rectangle i passa rects explícits a tots els `drawImage` (còpia a `_lightTmp2`, els 4 desplaçaments de l'erosió i l'acumulació a `_lightCanvas`). El resultat és pixel a pixel idèntic al de tocar el canvas sencer (el `source-in` del gradient ja retallava tot el que quedava fora del radi). **L'acumulació a `_lightCanvas` ha d'anar amb rects** — amb `drawImage(tmp, 0, 0)` es tornaria a sumar el que una altra llum hagi deixat a `tmp` fora del rectangle i l'alfa es doblaria.
  2. **Memòria cau del polígon de visibilitat** (`_visCache`, clau = `Light.key`, que és `pl_<id>` o `light_<id>`). El raycasting només es refà quan canvia la signatura `parets|x,y,r` (posició i radi arrodonits a l'enter). La signatura de parets ve de `lightWalls`, que versiona `rWalls`/`rDoors` **per referència** (per això tota mutació ha de crear arrays nous) i **quantitza l'obertura animada de porta** a `DOOR_STEPS` passos — amb un valor continu la memòria cau no encertaria mai. `lightWalls` també cacheja l'array d'`effectiveWallsAnimated` amb la mateixa signatura.
  - `accumulateExplored` se salta els frames en què cap polígon ha canviat; `clearExploredAt` i el reinici d'`ensureExplored` posen `_exploredDirty` per forçar-ne una. El retall de sales fosques es construeix **per llum**, només amb les sales que toquen el seu cercle (després es retalla al radi, o sigui que la resta no hi aportaven res).
  3. **Culling per pantalla** a `renderRooms`: les sales fosques que queden fora del canvas no es tracen (ni el farciment del jugador ni els contorns/noms/ull del DM). ⚠️ La llista **sencera** (`fills`, no `visFills`) és la que alimenta `accumulateExplored`: el que s'explora fora de càmera ha de quedar memoritzat igual. El compòsit de la foscor i el del terreny memoritzat es limiten al rectangle de pantalla de les sales fosques visibles.
  4. `_lightCanvas` només es **neteja** a la regió que va escriure el frame anterior (`_lcDirty`) i només es **composita** a la unió dels rectangles de les llums — dues passades de pantalla completa menys per frame.

  **Nota per a mesures futures:** la memòria d'explorat s'acumula amb `fill` de polígons antialiasats, o sigui que la vora guanya alfa amb cada acumulació. Dues captures de pantalla del **mateix** build poden diferir en una línia d'1 px (≤9/255) si han renderitzat un nombre diferent de frames. En comparar builds, verifica sempre primer si el mateix build és consistent amb ell mateix.

### Punts de llum (torxes/llànties) — eina "Llums" (drecera `6`)
- **Model** (`LightSource {id,x,y,radiusFt}` a `types/index.ts`; refs `rLights`, `rLightSelected`, `rNewLightRadiusFt`, `rLightDrag` a `useDMRefs`): fonts de llum fixes col·locades pel DM dins d'una sala. **S'encenen només quan un token de jugador visible i no derrotat és dins de la MATEIXA sala** que la llum (`pointInPoly` sobre `rRooms` a `collectLights`). Així una sala fosca sense ningú a dins queda negra encara que hi hagi torxes; en entrar-hi un token, la zona de la torxa s'il·lumina (unió sala∩radi + polígon de visió, com la llum dels tokens). En sortir el token, la zona queda **explorada** (terreny memoritzat atenuat) però deixa de veure's. Radi = `radiusFt/5` caselles; intensitat animada (LERP) amb clau `light_<id>` a `_lightAnim`.
- **Interacció** (`useMouseHandlers`, eina `'light'`): clic en buit col·loca una llum nova (`addLight`, radi = `rNewLightRadiusFt`); clic sobre una llum la selecciona i arma un drag (`rLightDrag`) per moure-la; clic dret l'elimina (`removeLight`). El flyout de la barra té un slider de radi (5–60 ft): edita la llum seleccionada (`setLightRadius`) i el valor per defecte de les noves. Seleccionar una llum sincronitza el slider amb el seu radi.
- **Render**: `renderLightSources` a `darkrooms.ts` dibuixa el solet groc (< mitja casella) + anell de radi **NOMÉS al DM** (cridat a `useRafLoop` després de `renderWalls`); el jugador només veu la zona il·luminada (gestionada per `carveLights` via `collectLights`, que ara també recull les fonts de llum).
- **Sync**: camp pesat `lights` a `STATE`/`STRUCT`; persisteix a la sessió (`buildSessionState`/`applySessionState`).

### Reset de l'explorat d'una sala
- Menú contextual d'una sala fosca → "🌑 Resetejar explorat": `clearExploredAt(points)` a `darkrooms.ts` esborra el polígon de la sala de `_exploredCanvas` (torna a ser negra del tot, fog of war). El DM ho fa localment i envia `RESET_EXPLORED { points }` (BC+WS) perquè el jugador esborri la seva pròpia memòria (cada pantalla té el seu `_exploredCanvas`).

### Col·lisions de moviment amb parets (pantalla de jugador)
- **Regla**: un token de jugador no pot travessar cap paret des de `/player`; per canviar de sala cal passar per una porta o obertura. Tota la col·lisió es calcula sobre les **parets efectives** (`effectiveWalls`: parets amb els trams de porta retallats). **El DM mou sense restriccions** (el seu drag no passa per aquesta via).
- **Amb grid** (`src/lib/rooms/pathing.ts` → `computeReachableCells`): en començar el drag, la regió de moviment (velocitat, o `activeRemainingFt` en combat) passa a ser les caselles amb **camí transitable** des de l'origen: **Dijkstra 8-dir amb cost de camí real** (1 ortogonal, √2 diagonal; abastable si cost ≤ maxCells + 0.5) on un pas es bloqueja si el tram centre→centre creua una paret (`segmentsIntersect`; índex espacial de parets per casella per fer-ho barat), i una diagonal exigeix a més un camí en L net (no colar-se per una cantonada). **El desvium es cobra**: anar per darrere d'una paret via la porta costa el camí sencer. Retorna `null` si no hi ha parets → disc euclidià pur, zero cost extra (comportament de sempre). El resultat (`MoveRange.reach`, mapa "dc,dr" → cost) l'usen **la mateixa condició** el clamp del drag (`usePlayerTokenDrag`) i la pintura groga (`renderMoveRange`), perquè límit i pintura coincideixin.
- **Sense grid**: col·lisió incremental durant el drag — si el tram des de l'últim centre vàlid creua una paret, es prova la projecció per eixos (`slideAgainstWalls`: el token **llisca** per la paret) i si tot xoca es queda quiet.
- **Validació al DM** (`handlePlayerTokenMove` a `DMView.tsx`): a més del bloqueig manual, torn actiu i saldo de peus, comprova que la casella de destí sigui al conjunt abastable (mateix `computeReachableCells`, budget = saldo en combat o velocitat fora de combat); **en combat amb parets, el cost descomptat és el del camí** (`ceil(cost − 0.5) × 5 ft`), no la línia recta. Sense grid, que el tram directe entre centres no creui cap paret (`segmentBlocked`). Si falla → rebot amb `TOKEN_RELAY` (posició autoritzada).

### Moviment de tokens des de la pantalla de jugador (`usePlayerTokenDrag`)
- `src/hooks/usePlayerTokenDrag.ts` — drag de tokens al canvas de `/player` amb **pointer events** (ratolí, dit i stylus unificats; `touch-action: none` al canvas + `setPointerCapture`).
- **Només tokens de jugador** (`pl_*`): el hit-test ignora enemics PSD i de biblioteca, i el DM també descarta qualsevol `TOKEN_MOVE` que no comenci per `pl_` (BC i WS).
- Tolerància tàctil més gran amb el dit (`pointerType === 'touch'` → slop 16px vs 4px de ratolí). Un sol drag actiu (es guarda el `pointerId`; la resta de tocs s'ignoren).
- **Previsualització amb ghost (el token real no es mou fins deixar anar)**: durant el drag **no es toca `rPos`** — el token real es queda quiet (i **no il·lumina cap sala**) i la destinació s'escriu a `rDragPreview` (`{ id, x, y }`), que es pinta com un **ghost semitransparent** (`renderDragGhost` a `render/tokens.ts`, cridat **després de `renderRooms`** perquè el ghost es vegi fins i tot sobre la foscor). En deixar anar (`onPointerUp`), es confirma la destinació a `rPos` (el token fa l'**animació de desplaçament** i és llavors quan la llum es mou) i s'envia `TOKEN_MOVE` per BC **i** WS. Un tap sense arrossegar (sense preview) no mou res.
- **Moviment vorejant les parets (forma d'L)** (`rMovePath`, `buildMovePath` → `computePath` a `src/lib/rooms/pathing.ts`): amb grid+parets, en deixar anar es calcula el **camí real** (Dijkstra amb predecessors, mateixes regles que `computeReachableCells`) de l'origen del drag al destí i es desa a `rMovePath[id]` com a llista de punts. `buildMovePath(from, to, {walls, grid, R, maxCells?, straightFallback?})` és el **constructor únic del camí** (drag local, `TOKEN_RELAY` a `PlayerView` i animació del DM) i ja retorna la polilínia suavitzada amb l'origen inclòs i el destí exacte; amb `straightFallback` retorna `[from, to]` quan no hi ha camí per caselles (el fa servir només el DM, veure sota). el camí es **suavitza amb Chaikin** (`smoothPath`, corba natural en lloc d'escala esglaonada) i `renderPlayerTokens` el recorre —via l'ajudant compartit `advanceMovePath` a `render/tokens.ts`— a **velocitat de creuer constant** (`PATH_CRUISE` × mida de casella per frame) amb **frenada suau** al final (`PATH_BRAKE`, ease-out); `pts` inclou l'origen i acaba exacte al destí. La **llum no talla per sales fosques que el token no travessa**. Els moviments d'1 casella no desen camí → LERP recte de sempre. Sense grid/parets, o si origen i destí són adjacents, no es desa camí → LERP recte de sempre. També s'aplica a la resta de pantalles via `TOKEN_RELAY` (veure sota): cada pantalla recalcula el camí des de la posició antiga (`_setMovePath` a `PlayerView`; un eco del relay del propi token, origen==destí, és no-op i no esborra el camí ja fixat). El handler de `STATE` del jugador conserva la posició local del token arrossegat perquè un broadcast del DM no el faci saltar enrere.
- **Relay a la resta de pantalles de jugador** (`TOKEN_RELAY`): quan el DM rep un `TOKEN_MOVE` vàlid (BC o WS, handlers a `DMView.tsx`), després d'actualitzar `rPos`/`setPos` reenvia un missatge **`TOKEN_RELAY { id, x, y }`** (per BC i WS) amb només el token mogut. **S'envia sempre** (també en combat) i **abans** del `STATE`, perquè cada pantalla pugui calcular el camí en L des de la posició antiga abans que el `STATE` (en combat) reajusti `rPos`. La pantalla de jugador el **fusiona** dins `rPos` (`rPos.current = { ...rPos.current, [id]: {x,y} }`) sense reemplaçar la resta de posicions ni tocar cap altre camp. Això és clau: **no s'ha de reenviar un `STATE` complet** aquí — reemplaçar tot `rPos` feia desaparèixer els enemics (les posicions PSD que el client tenia quedaven sobreescrites) i incloure la càmera resetejava el zoom del client a cada moviment. Amb el merge d'un sol token no es toca ni la càmera ni la resta de tokens/sales. Si la pantalla que rep està arrossegant el mateix token, conserva la seva posició local (no salta a mig drag). El mateix `TOKEN_RELAY` (amb la posició autoritzada) s'usa per fer tornar enrere un token bloquejat (`canMove === false`) sense resetejar-li el zoom.
- **Eco del mateix `TOKEN_MOVE` (BC + WS)**: la pantalla de jugador envia cada moviment pel **BroadcastChannel i pel WebSocket**, o sigui que una pantalla del mateix ordinador (amb la API engegada) el fa arribar al DM **dues vegades**. `handlePlayerTokenMove` descarta l'eco d'entrada (`rPos[id]` ja és exactament a `x,y` → `return`). Sense aquesta guarda la segona còpia esborrava el camí d'animació que acabava de fixar la primera (el token semblava **teletransportar-se** al DM, i només amb la API engegada) i duplicava el `TOKEN_RELAY` i l'entrada de `rMoveHistory`. La pantalla de jugador té la guarda equivalent a `_setMovePath` (origen==destí per caselles → no-op).
- **Animació del moviment també a la pantalla del DM** (`rMovePath` a `useDMRefs`): quan `handlePlayerTokenMove` accepta un `TOKEN_MOVE`, **abans** d'escriure la nova posició a `rPos` calcula el camí des de la posició antiga amb `buildMovePath(..., { straightFallback: true })` i el desa a `rMovePath[sid]`; així el DM veu el token **desplaçar-se i per on ha passat** (vorejant les parets, o en línia recta si no n'hi ha) en lloc d'un salt sec. També hi ancora `visualPosRef[sid] = from` perquè `renderRooms` (que hi centra la llum i corre **abans** de `renderPlayerTokens`) no il·lumini el destí durant el primer frame. La branca DM de `renderPlayerTokens` només fa servir `visualPosRef` mentre hi ha camí; en acabar **esborra l'entrada** perquè la llum torni a seguir `rPos` directament. Cancel·len l'animació el drag del propi DM (`onMouseMove` de `useMouseHandlers`, també per als membres d'un grup) i `undoTokenMove` (Ctrl+Z), que són instantanis. Res d'això es sincronitza: és estat visual local del DM.
- **Límit de moviment per velocitat** (`Player.speed`, peus; per defecte `DEFAULT_SPEED_FT = 30`): el drag des de `/player` clampa el centre del token a un rang de `maxCells = floor(speed/5)` caselles al voltant de la casella d'origen del drag. **La regió abastable és un cercle** (distància euclidiana: `dc² + dr² ≤ (maxCells + 0.5)²`), és a dir un **disc rasteritzat** com les taules de cercles pixel-art — la diagonal costa el seu valor real (~7 ft = √2·5). El clamp (`onPointerMove` a `usePlayerTokenDrag.ts`) camina la casella cap endins fins entrar al disc reduint primer l'eix dominant (així la casella final és sempre una de les pintades i segueix la direcció del punter). Les caselles abastables es pinten en groc suau durant el drag amb perímetre esglaonat (`renderMoveRange` a `render/grid.ts`, cridada al tick del jugador **després de `renderRooms`** perquè el groc es vegi sobre la foscor de les sales; mateixa condició `inRange` que el clamp perquè pintura i límit coincideixin). Amb parets dibuixades, el disc queda a més restringit a les caselles amb camí transitable (`MoveRange.reach`, veure "Col·lisions de moviment amb parets"). El DM edita la velocitat al menú del clic dret del token (`setPlayerSpeed`) i **no** té cap límit en moure tokens. `speed` viatja dins l'array `players` (STRUCT/STATE/sessió), sense camps de sync nous.
- **Bloqueig a 0 de vida** (`Player.hp`): amb `hpMax > 0 && hp <= 0` el jugador **no pot moure el token** (ni començar el drag ni validar el `TOKEN_MOVE` al DM) fins que recuperi vida. **El DM sempre pot** (el seu drag no passa per aquesta via).
- **Bloqueig de moviment per jugador** (`Player.canMove`, absent → `true`): amb `canMove === false` el hit-test de `usePlayerTokenDrag` ignora el token (no es pot ni començar el drag des de `/player`). A més, si arriba un `TOKEN_MOVE` d'un token bloquejat (BC o WS, handlers a `DMView.tsx`), el DM no només el descarta sinó que **reenvia l'estat** (`_broadcastState({})`) perquè la posició autoritzada torni al jugador a l'instant — així un client que encara no hagués rebut el bloqueig no deixa el token mogut fins al següent broadcast. El DM el commuta amb l'interruptor del menú del clic dret del token (`setPlayerCanMove`); la fila del jugador mostra un cadenat. Com `speed`, viatja dins `players` sense camps de sync nous.

### Enemics de la BD agrupats per projecte o categoria (`src/lib/enemy-groups.ts`)
- **Model**: `ApiEnemy.project` i `ApiEnemy.category`, **text lliure** a la API (trim, màx. 60; `''` = sense). No hi ha cap col·lecció de grups: `groupEnemies(enemies, camp)` els treu de la mateixa llista. La clau del grup (`groupKey`) és el valor sense majúscules ni espais de més, així «Cripta» i «cripta » van junts; l'etiqueta és la primera grafia trobada. Ordre alfabètic i el grup «Sense projecte/categoria» sempre l'últim.
- **On surt**: al back office (`/admin/enemics`, taula amb una fila-capçalera per grup; la columna del camp agrupat s'amaga) i a la Biblioteca del DM (secció Base de dades). Tots dos fan servir els mateixos components (`ui/EnemyGroups.tsx`: `EnemyGroupToolbar`, `GroupHeader`, `GroupBody`) — un tercer llistat d'enemics de la BD ha de fer servir els mateixos.
- **Formulari** del back office: camps Projecte i Categoria amb `<datalist>` dels valors existents (`distinctValues`). En desar un enemic que cau en un grup plegat, el grup es desplega (si no, semblaria que no s'ha desat).
- **Edició en bloc** (back office, `applyBulk` a `admin/enemics/page.tsx`): caselles per fila, per grup i a la capçalera (amb estat indeterminat), i **Maj+clic** per a un tram de les files que es veuen (`visibleRows`: els grups plegats no compten). La barra de sobre la taula posa la mateixa categoria o projecte a tots els seleccionats (camp buit → «Treure»). **No hi ha endpoint de lots**: un `PUT /enemies/:id` per enemic, `BULK_CHUNK` alhora amb `Promise.allSettled`; només s'envien els que canvien i, si n'hi ha que fallen, es diu quants (la resta queden desats i seleccionats). La selecció es deriva de la llista (`picked`), així un id eliminat no compta. ⚠️ La barra **sempre hi és** (apagada sense selecció) i el missatge va en una sola línia: si aparegués o creixés en marcar, la taula baixaria i la casella següent ja no seria sota el cursor.
- **Estat recordat** (`useEnemyGrouping(scope)`): `by` (projecte/categoria/cap) i les claus plegades per camp, a `localStorage['rpg_enemy_groups_<scope>']` (`admin` i `dm` per separat). Es llegeix amb `useSyncExternalStore` (`null` al servidor) per no tenir error d'hidratació, i hi ha una còpia en memòria perquè funcioni sense localStorage. Cal desar-ho: la Biblioteca es desmunta a cada canvi de pestanya.
- **API antiga**: una API sense aquests camps no els retorna i descarta en silenci els que rep. `apiSupportsGroups` ho detecta (cap enemic de la llista porta les claus) i el back office mostra un avís i desactiva els dos camps.

### Panell de jugadors (`src/components/dm/PlayersPanel.tsx`)
- Va dins d'una `SidebarSection` ("Jugadors · N") amb els botons ＋ (desplega el formulari d'alta, que si no no ocupa espai) i Party.
- **Una fila prima per jugador** (`PlayerRow`, ~32 px, el mateix format que les files d'enemics de l'Escena): avatar amb inicials del seu color, nom, cadenat si `canMove === false` i `HpControl` `sm`. Clic a la fila = seleccionar el token (la fila seleccionada s'encén); **clic dret = el menú del token**, amb la fitxa (també per a un token que ara no es veu a la pantalla).
- Abans eren targetes de 68 px amb un engranatge que desplegava la configuració (vida màxima, velocitat, visió, moviment): amb cinc jugadors el panell ocupava mig lateral. Tot això és ara al **menú del clic dret** del token; el panell només és per veure i tocar la vida durant el joc.

### Control de vida únic (`src/components/ui/HpControl.tsx`)
- **Un sol component** per a la vida de qualsevol token: files de jugadors i d'enemics de l'Escena (`sm`, prim perquè se n'hi apilin molts), menú contextual (`md`). La mida `lg` era la de les antigues targetes de jugador i ara no la fa servir ningú. Abans n'hi havia quatre de diferents (−/+ gros, −1/barra/+1, −10/−1/barra/+1/+10 i una barra fina sense número), cadascun amb la seva gramàtica.
- Gramàtica: **clic ±1, clic dret ±10**; **clic al número** → camp on «-7» aplica dany, «+5» cura i «12» fixa la vida (Enter aplica, Esc o clicar fora cancel·la). El color surt de `hpColor()` (verd > 50%, groc > 25%, vermell).
- Sempre crida la funció `adjust*Hp(id, delta)` corresponent (que ja retalla a [0, hpMax] i marca/desmarca derrotat). Per fixar un valor absolut es passa `valor − hp`.

### Sistema visual del DM (`FS`, `RADIUS`, `SHADOW`, `tint` a `constants` + `ui/Button.tsx`)
- **Escala tipogràfica** `FS = { xs: 10, sm: 11, md: 12, lg: 14, xl: 18 }`: tota mida de lletra de la UI del DM surt d'aquí (el mínim és `FS.xs`). Abans n'hi havia 22 de diferents, de 7,5 a 32 px, i els noms dels estats no es llegien. Les xifres grans (vida, peus, ronda) i les icones/emojis són mides de *display* i poden anar a part.
- **Radis** `RADIUS = { sm: 4, md: 6, lg: 10, pill }`, **ombres** `SHADOW.float` / `SHADOW.menu`, i colors **sempre de la paleta** `C` (afegits `C.onAccent` —text damunt d'accent— i `C.float` —fons de panells flotants—). Transparències amb `tint(C.enemy, 0.12)`, no amb `rgba(...)` escrit a mà.
- **Botons**: `Button` (variants `primary` / `secondary` / `ghost` / `danger` / `tint`, mides `sm` / `md` / `lg`, `active` per a commutadors) i `IconButton` (quadrat d'una icona). `buttonStyle()` per donar aspecte de botó a un `<label>` o `<Link>`. Una sola acció `primary` per bloc.
- ⚠️ No afegir estils de botó, mides de lletra ni colors escrits a mà en components nous: si falta una variant, s'afegeix a `Button`.
- **El daurat (`C.accent`) només vol dir dues coses: l'acció principal d'un bloc (`primary`) i el que està actiu o seleccionat** (eina, pestanya, mode, xip del torn, interruptor encès). No per a dades (ronda, peus, comptadors, valors de camps), etiquetes, insígnies ni avisos. Un avís va amb un punt o un text en `C.warn`, no amb tot un botó del color avís (veure `BarButton`).
- **Tipografia de títols** `FONT_SERIF` (EB Garamond, servida des de l'app amb `next/font/local`, sense internet): nom del mapa a la barra superior, títol de la benvinguda, nom del token a la capçalera del menú del clic dret, títols dels diàlegs (dreceres, partides al servidor) i el text que es llegeix als jugadors (revelador). La resta de la UI, en sans. ⚠️ Mai `'EB Garamond'` escrit a mà: `next/font` canvia el nom de la família i no la trobaria (cauria a Georgia, com passava abans: la font no s'havia carregat mai).
- **Icones, mai emojis, a la interfície** (botons, capçaleres de secció, menús): vectorials d'`icons.tsx`, que agafen el color del text. Les emojis surten diferent a cada sistema (a Windows, glifs negres sobre el fons fosc). L'excepció són les màgies i els elements (`SPELL_TYPES.emoji`, `ELEMENTS.emoji`): són el «retrat» de cada màgia a la roda i al grimori, contingut i no controls.

### Sistema per torns (iniciativa) — barra inferior
- **Estat**: `TurnState` (`types/index.ts`) `{ active, order, turnIndex, round, activeRemainingFt }`. Mirall `rTurn` (`useDMRefs.ts`), estat React `turn` (`DMView.tsx`). El DM és la font de veritat; viatja al jugador dins `STATE`/`STRUCT` (camp lleuger `turn`, sempre enviat) i persisteix a la sessió (save/load).
- **Component**: `TurnTracker` (`src/components/dm/TurnTracker.tsx`) — barra flotant a baix al centre del `stageRef`. Inactiu: botó "⚔️ Iniciar torns" que obre un popover de selecció (tots els jugadors s'afegeixen automàticament; es trien enemics PSD/lib visibles i **grups** llegits de `rTokenGroups`). Actiu: badge de ronda + fila de chips en ordre de torn + botó "⏭ Ronda" + "✕".
- **Ordre** (`startTurnCombat` a `DMView.tsx`): `order` = ids plans `[...jugadors, ...selecció]` amb dedup (els grups s'expandeixen als seus tokens en iniciar; l'ordre no guarda referències a grups perquè `rTokenGroups` és efímer).
- **Primitives compartides** (`src/lib/turn.ts`): `budgetFor` (peus amb què arrenca un token: `Player.speed` per `pl_*`, sentinella `NO_MOVE_LIMIT_FT` per enemics), `nextActive` / `firstActive` (recorregut de la cua saltant-se els derrotats) i `removeFromTurn`. Viuen fora de `DMView` perquè **`useDMActions` també les necessita**: veure "Eliminar un token" més avall.
- **Passar torn** (`advanceTurn`): botó principal **«Següent ▶»** de la barra, tecla **Enter** (`useKeyboardHandlers`; no si el focus és en un botó, que ja el prem Enter) o clic al chip **actiu**. Abans només existia el clic al xip, i el botó destacat era «⏭ Ronda». Avança amb `nextActive`, que **se salta els tokens derrotats** (`rDefeated`): un enemic amb la X o un jugador a 0 de vida ja no juga, i abans calia passar-li el torn a mà, un clic buit per baixa i per ronda. Cada volta completa fa `round++` i neteja els saldos; si tothom és derrotat, la funció torna al mateix token després d'una volta (mai un bucle infinit). Cada token, en agafar el torn, reinicia `activeRemainingFt` amb `budgetFor`. Botó "⏭ Ronda" (`advanceRound`) i `startTurnCombat` arrenquen amb `firstActive` pel mateix motiu. Al `TurnTracker`, el chip d'un derrotat surt **atenuat, en gris i amb la ✕**.
- **Eliminar un token** (`_cleanupTokenKey` a `useDMActions.ts`): a més de condicions, derrotat, mida, selecció i grups, **el treu de la cua d'iniciativa** (`removeFromTurn`) i de `rMoveHistory`. Sense això, esborrar un token durant el combat deixava el seu chip a la barra amb el nom «?» i, en arribar-li el torn, l'aro daurat no es pintava enlloc. Si s'esborra el token que **té** el torn, passa al següent amb el saldo sencer; si la cua queda buida, el combat s'acaba. La ronda **no** s'incrementa per una eliminació (qui la fa avançar és el DM). Com que `turn` és camp lleuger del `STATE`, el `_broadcastState` que ja fan `removePlayer`/`removeLibEnemy` el propaga.
- **Distintiu**: aro **daurat sòlid** al token actiu (`drawActiveTurnRing` a `render/tokens.ts`), pintat a **les tres** famílies de tokens — `renderPlayerTokens`, `renderEnemyTokens` (PSD, `_activeId === en.id`, numèric) i `renderLibEnemyTokens` (`_activeId === \`lib_${en.id}\``) — perquè al mapa es vegi a qui li toca moure i no calgui mirar la barra d'iniciativa. No es pinta si el token està derrotat o pràcticament invisible (`enAlpha > 0.3`). Coherent amb el groc però diferent de l'aro de "ressaltar enemics" i del blau de selecció.
- **Límit de moviment per torn** (extensió de `usePlayerTokenDrag`): amb combat actiu, des de `/player` només es pot **agafar** el token del torn actiu, i el disc de moviment usa `activeRemainingFt` en lloc de la velocitat sencera (es va encongint drag a drag: p. ex. 15 ft → mou 5 → queden 10). El DM valida cada `TOKEN_MOVE` (`handlePlayerTokenMove`): comprova bloqueig manual (`canMove`), que sigui el token actiu i que el cost no superi el saldo (mateixa mètrica de disc: `cost = ceil(hypot(dc,dr) − 0.5)` caselles × 5 ft); si el supera, rebot amb `TOKEN_RELAY`. En aplicar, descompta el saldo i propaga amb `_broadcastState` (perquè el disc del jugador s'encongeixi). **El DM mou sense límits** (el seu drag no passa per aquesta via). Sense grid no hi ha límit (com el clamp existent).
- **Recuperar un torn anterior**: clic dret sobre un token **no actiu** de la barra → "↩ Recuperar el seu torn" (`recoverTurn`). Torna `turnIndex` a aquell token amb el saldo de peus que li quedava (`TurnState.remaining`, mapa de saldos desat en deixar cada torn; es neteja a cada ronda nova).
- **Desfer moviment (Ctrl+Z)**: `rMoveHistory` (DM-only, es reinicia a cada canvi de torn via `_applyTurn`) apila `{ id, from, spentFt }` a cada moviment de combat (`handlePlayerTokenMove`). `undoTokenMove` restaura la posició i retorna els peus. Es desfà amb el «Desfer» únic (botó de la barra o Ctrl+Z), en l'ordre en què han passat les coses respecte dels traços i dels canvis del mapa.
- **Editar l'ordre** (estil iPhone): botó **⚙** a la barra activa un mode edició (xips amb vora de guions; «Següent» passa a ser **«✓ Fet»**). ⚠️ **Res de balanceig** (l'efecte «tremolor» de l'iPhone): es va provar i els xips girats sobresortien del carril, la barra de scroll apareixia i desapareixia i tremolava tota la barra. El xip agafat s'aixeca com a **clon** (fora del carril, perquè l'`overflow` no el retalli) i la resta s'aparten **en viu** amb `transform` per deixar el forat on cauria (`layoutLefts` + `dropIndex`, calculats amb les amplades fixes, no mesurades). En deixar-lo anar, el clon vola al forat (`SETTLE_MS`) i llavors `commitDrag` crida `reorderTurn` (que manté actiu el mateix token recalculant `turnIndex`) **en un sol render amb les transicions apagades** (`noAnim`): cada xip ja era visualment al seu lloc nou, així que no salta res. Pointer events (ratolí i dit), no l'HTML5 drag & drop. Arrossegar a la vora del carril fa scroll. En mode edició, clicar un xip no fa res.
- **Acabar combat**: el botó ✕ demana **confirmació** («Finalitzar el combat?») per evitar clics accidentals. **«⏭ Ronda»** (salta tots els que queden) és secundari i també demana confirmació («Saltar a la ronda N?»). Les confirmacions i el «Recuperar el torn» van en un **globus a sobre de la barra** (`Bubble`, un sol `pop` obert alhora) que es tanca clicant fora o amb Esc — mai substituint el botó dins de la barra (la feia créixer).
- **Amplada**: la barra fa com a màxim `100% − 150px` de l'escenari (no tapa la barra d'eines de l'esquerra); si hi ha molts tokens, els xips fan scroll i el del torn actiu es desplaça sol a la vista (`data-active` + `scrollTo`, només quan canvia QUI té el torn, no en reordenar).
- **Mida fixa durant el combat** (constants al cap de `TurnTracker.tsx`): el xip actiu fa sempre `ACTIVE_W × ACTIVE_H` (columna de nom i peus d'amplada fixa, `INFO_W`; el nom s'escurça amb «…») i la resta `SLOT_W × SLOT_H`, o sigui que la suma no depèn de qui té el torn. El carril té una **amplada fixa** (`railWidth(n)`, amb `overflow: hidden`) i l'amplada extra del xip actiu es reparteix amb **`flex-grow`** (1 l'actiu, 0 la resta, sobre una base de `SLOT_W`); l'animació és del `flex-grow`, no de `width`. Així, encara que es passin torns molt de pressa i les transicions es tallin a mitges, els xips omplen sempre el mateix carril. ⚠️ Amb `width` animat a cada xip la suma només quadrava si les dues transicions anaven sincronitzades: amb clics ràpids la barra variava uns 5 px. ⚠️ Res que depengui de l'estat (confirmacions, mode edició, nom, peus) pot canviar l'amplada de la barra: s'hi posa un globus o es reserva l'espai (`NEXT_W` per a «Següent»/«Fet»).
- **Iniciar**: el popover té «Tots / Cap» per marcar d'un cop tots els enemics visibles. Sense mapa carregat, o en mode Preparar, la barra no apareix.

### Càmera compartida — independent de la mida i el format de finestra (`src/lib/camera.ts`)
- **Problema que resol**: la càmera es sincronitzava com `{ zoom, panOffset }` amb `panOffset` en **píxels de pantalla del DM**, i cada pantalla hi aplicava després la seva pròpia escala d'ajust `min(W/mw, H/mh)`. Amb finestres de mida o format diferents, el mateix `panOffset` desplaçava una quantitat de mapa diferent i el rectangle visible depenia del format: en fer zoom, **cada pantalla retallava per un costat diferent**. El DM tenia contingut a la vora de la seva pantalla i els jugadors no el veien, sense cap indici.
- **Model**: el que viatja és `cam: CamRect { cx, cy, w, h }` — el **rectangle de MAPA** que enquadra el DM. Camp lleuger de `STATE`/`STRUCT` (4 números, s'envia sempre). `zoom`/`panOffset` es continuen enviant **només per compatibilitat amb clients antics**.
- **DM** (`useRafLoop` escriu `rDmCam` cada frame; `_currentCam()` a `useDMActions` el recalcula **al moment d'enviar**): `viewRect()` a partir de `rZoom`/`rPanOffset` — **mai** de `dmLocalZoom`/`dmLocalPan` (vista privada) ni de la càmera de la cinemàtica, que són locals. Després `clampCamToMap()`: no es demana a les altres pantalles que reservin espai per als marges buits del DM (amb formats molt diferents això empetitia molt el mapa a l'altra banda); la **mida** del rectangle es conserva i només es desplaça cap endins, així que tot el contingut de mapa que veu el DM hi continua sent.
  - ⚠️ **No llegir `rDmCam` directament dins del missatge**: el tick l'escriu un cop per frame i les interaccions (roda, pan) broadcastegen **síncronament dins del seu handler**, o sigui que s'enviaria l'enquadrament del frame ANTERIOR. Com que després d'una roda de zoom no arriba cap més missatge, el jugador es quedava un pas de zoom enrere per sempre (~12% d'enquadrament). Sempre `_currentCam()`.
- **Jugador** (`PlayerView`): desa `cam` a `rCam` i **cada frame** el tradueix al seu `{zoom, pan}` amb `camToView()` (regla **contain**: `sc = min(W/cam.w, H/cam.h)`), escrivint-lo a `rZoom`/`rPanOffset` perquè la resta del codi (LERP i hit-test del drag de tokens) el llegeixi com sempre. Com que es recalcula cada frame amb la mida REAL d'ara, **girar la tablet o canviar de mida reenquadra tot sol** sense esperar cap missatge. Si el DM és antic i no envia `cam`, es cau al model vell.
- **Garantia**: amb la regla contain, **cap pantalla no veu mai menys que el DM**; una de format diferent veu **més** mapa als costats. Verificat sobre 1210 combinacions de mapa/finestra/zoom/pan.
- **El DM redimensiona**: el tick detecta el canvi de `W×H` i rebroadcasteja (throttle 120ms amb reintent: si es descarta l'enviament, `prevWH` NO s'actualitza i el frame següent hi torna, així la mida final sempre arriba).
- **Menú de pantalles (`TopBar` → `ScreensMenu`)**: sense cap pantalla diu «**Cap pantalla de jugador**» en color d'avís. En clicar-lo obre un panell amb les pantalles, un botó per obrir-ne una en aquest PC i **l'adreça per a la tablet** (botó de copiar): si el DM ha obert l'app per `localhost`, s'hi proposen les IPs LAN del PC, que `next.config.ts` exposa com a `process.env.LAN_HOSTS` (no s'usen si el DM és en un altre host, p. ex. un desplegament).  les pantalles de jugador reporten la seva mida amb `VIEWPORT {id,w,h}` (en connectar, en redimensionar i cada 15s de heartbeat); el DM les desa a `rPlayerScreens` i oblida les que fa >50s que no diuen res. Entre finestres del mateix PC va pel BroadcastChannel; les de fora (tablet per wifi) pel relay `VIEWPORT` client→dm de la API. El contracte del WS es pot comprovar amb `node scripts/check-sync.mjs`. El botó mostra quantes n'hi ha i, al menú, quant de mapa veu **de més** cadascuna (`extraSeen`). El format de l'enquadrament es mostreja cada 700ms a l'estat `camAr` — **no llegir `rDmCam` durant el render** (és una ref que escriu el tick; el menú no es refrescaria).

### Avisos a la pantalla (`src/components/ui/NoticeStack.tsx`)
- **Problema que resolia**: tot el que fallava en carregar (fons il·legible, `.json` de partida corrupte, demo inabastable, desat automàtic sense espai) només deixava rastre a `console.error`. Des de fora es veia exactament igual que «no passa res»: l'usuari tornava a clicar sense cap pista.
- **Model**: `Notice {id, kind: 'error'|'warn'|'info', text}` a `types/index.ts`. `DMView` en té la pila (`notices`) i passa `notify(text, kind?)` dins de l'objecte `Setters` de `useDMActions` — o sigui que **qualsevol acció del DM pot avisar sense arrossegar props**. `useAutosave` el rep per l'opció `onError`.
- **Comportament**: es pinten a dalt al centre del `stageRef`, amb icona vectorial i colors de la paleta. Un **error no marxa sol** (si s'esvaís, es perdria justament el missatge que explica per què no hi ha mapa); els avisos i les informacions sí. Un text repetit no s'apila (es dedupliquen) i se'n mostren com a molt 3.
- **Regla**: si afegeixes un camí que pot fallar de cara a l'usuari, ha de passar per `notify`, no per `console.error` tot sol.

### Càrrega del fons: validació i fracàs visible (`loadBg` a `useDMActions.ts`)
- **Tipus**: només `image/*` i `video/*` (un tipus buit es tracta com a imatge, perquè les partides desades des de versions antigues no sempre en porten). Qualsevol altra cosa es rebutja amb el nom del fitxer al missatge — abans, un `.zip` es convertia en un `<img>` silenciós.
- **Mida**: sostre a `MAX_BG_BYTES` (256 MB) i avís a partir de `WARN_BG_BYTES` (40 MB). El fons es guarda sencer a memòria, es passa per base64 a cada desat `.json` i s'envia pel WS **sense control de flux**: sense sostre, un vídeo de mig giga tomba la pestanya sense dir-ne res.
- **`error` listener** (⚠️ el bug que amagava): sense ell, un fitxer malmès o un còdec no admès no disparava mai `load`, però `setBgLoaded(true)` ja s'havia executat — l'app deia que hi havia mapa, la pantalla quedava negra i no hi havia cap error. Ara es reverteix l'estat, es neteja el mèdia i es diu què passa (amb consell de format si és un vídeo).
- **Object URL**: el del fons anterior es **revoca** en carregar-ne un de nou (`bgUrlRef`). Abans cada canvi de mapa deixava penjada a memòria la imatge o el vídeo sencers. Mateix patró que ja feien `PlayerView` i `/expositor`.

### Límit de l'historial de dibuix (base + historial)
- **Problema que resolia**: `strokeHistory` creixia **sense cap límit** i viatja sencer dins de **cada `STRUCT`** (late join, reconnexió de la tablet), dins de **cada `UNDO_DRAW`** (i per duplicat: BC + WS) i entra a **cada desat automàtic**. Una sessió llarga de dibuix degradava les tres coses alhora.
- **Model**: el dibuix es reconstrueix sempre com a **BASE + HISTORIAL**. Es conserven com a objectes els últims `STROKE_HISTORY_MAX` (120) traços; els que passen del límit es **rasteritzen** a `strokeBaseRef` (canvas offscreen) i surten de la llista. El resultat a la pantalla és idèntic.
- **`_capStrokeHistory`** (`useDMActions`) es crida just després d'afegir un traç — des de `useMouseHandlers`, que el rep **per paràmetre** (com `_broadcastState`: aquest hook no rep l'objecte d'accions sencer). `_repaintDrawCanvas` és l'únic lloc que repinta (base + historial): l'usen el desfer i la càrrega de partida.
- **Desfer únic**: un traç que surt de l'historial deixa de ser a la seva pila, o sigui que `peekUndo` el dona per caducat i el «Desfer» se'l salta (un traç cuit a la base ja no es pot desfer).
- **Sync**: `strokeBaseVerRef` puja a cada rasterització i `sentBaseVerRef` recorda què ha rebut el jugador. El `STRUCT` sempre porta la base; l'`UNDO_DRAW` **només quan ha canviat** — la base no es toca en desfer, així que una tanda de desfers l'envia una sola vegada (és una imatge de la mida del mapa). El jugador la conserva a `strokeBaseImgRef` i reconstrueix amb `_rebuildDrawing`, amb guarda de seqüència (`drawSeqRef`) perquè una descàrrega lenta no trepitgi una reconstrucció més nova.
- **Sessió**: `strokeBaseline` es desa dins de l'estat. Sense això, carregar una partida amb molt dibuix en perdria el gruix. Les partides anteriors a aquest camp no en porten: llavors l'historial ja ho és tot (comportament de sempre).
- ⚠️ `clearDrawing` ha de **buidar també la base**; si no, els traços vells reapareixerien al primer desfer després d'esborrar-ho tot.

### Desat automàtic de la partida (`src/lib/autosave.ts` + `src/hooks/useAutosave.ts`)
- **Problema que resol**: tot l'estat viu del DM (fons, parets, sales, portes, llums, posicions, vides, estats, dibuix i torns) només existia en refs de memòria. Un F5, un hot-reload del dev server o una pestanya que el navegador descarrega buidaven la partida sencera si el DM no havia premut «Desar».
- **Magatzem**: IndexedDB (`rpg-map-viewer` → store `autosave`) amb **tres claus**: `meta` (data + nom del mapa + empremta del fons), `state` (la partida) i `bg` (la imatge). **No localStorage**: el mapa són megabytes i localStorage té ~5 MB i només accepta text.
- **El fons va a part i com a `Blob`** (`bgFingerprint`: tipus + mida + suma de bytes mostrejats). Mentre no canviï el mapa, els desats successius només reescriuen l'estat (uns KB). ⚠️ **No tornar-lo a passar per base64** com fa el fitxer `.json`: infla la imatge un 33% i el bucle de `btoa` sobre un mapa de 8 MB bloqueja el fil principal — a un desat cada 30 s es notaria.
- **Què es desa**: `_buildSessionCore()` a `useDMActions.ts` — el mateix nucli que el fitxer `.json` i el desat al servidor, **sense** el fons ni el `drawCanvas` (que `applySessionState` no llegeix mai: el dibuix es reconstrueix des de `strokeHistory`). `buildSessionState()` hi afegeix el base64 i el dataURL; `buildAutosaveRecord()` hi afegeix el Blob.
- **Quan es desa** (`useAutosave`): cada **30 s** i sempre que la pestanya passa a **amagada** (`visibilitychange`), i **només si hi ha canvis** — `rAutosaveDirty` el posa `_broadcastState` (per on passa tota mutació) i el traç de dibuix a `useMouseHandlers` (que no hi passa). La marca es neteja **abans** de construir l'estat, així un canvi que arribi mentre s'escriu no es dona per desat. Si l'escriptura falla (quota, mode privat) es torna a marcar i es reintenta al cicle següent.
- **Recuperació**: a la pantalla de benvinguda (sense mapa) surt **«↩ Recuperar l'última partida · fa X min»** amb el nom del mapa i un enllaç per descartar-la. `applySessionState` accepta el fons com a `state.bgBlob` (Blob) a més del `state.bgData` (base64) dels fitxers `.json` i del servidor.
- **Control**: menú **Partida** de la barra superior. El botó diu quan s'ha desat per últim cop i, a dins, hi ha l'interruptor i «Desar ara». La preferència va a `localStorage['rpg_autosave']` (un booleà sí que hi cap) i apagar-lo **esborra** el que hi hagués desat.
- **Tolerància a fallades**: sense IndexedDB (mode privat, navegador antic) cap funció de `lib/autosave.ts` llança: retornen `null`/`false` i l'app funciona com abans.
- **El fracàs és visible** (⚠️ no tornar-hi enrere): amb la quota plena o en finestra privada, l'única pista era que l'etiqueta del desat deixava d'avançar — ningú no se n'adonava fins a perdre la partida. Ara, a partir de `FAIL_STREAK_TO_WARN` (2) fallades seguides, `useAutosave` retorna `failing` (el botó **Partida** de la barra superior diu «No es pot desar» amb un punt vermell) i crida `onError` **una sola vegada per ratxa** (si no, en sortiria un avís cada 30 s). Una escriptura correcta reinicia el comptador.
- També s'hi desen els **grups de tokens** (`tokenGroups`, com a parells perquè un `Map` no sobreviu al JSON) — abans es perdien en carregar una partida.

### La pantalla de jugador al mòbil
- **`meta viewport`** (`export const viewport` a `src/app/layout.tsx`): sense això el mòbil assumeix una finestra virtual de ~980 px i escala el resultat — la pantalla de jugador sortia minúscula i mal enquadrada, i semblava que no carregués. `viewportFit: 'cover'` per als mòbils amb osca.
- **Alçada `100dvh`** (classe `.full-stage` a `globals.css`, usada per l'arrel de `PlayerView`): `100vh` al mòbil val l'alçada AMB la barra del navegador desplegada i tallava el rètol de torn. Es declara `100vh` i tot seguit `100dvh` perquè un navegador antic es quedi amb el primer.
- **`BroadcastChannel` amb guarda** (`try/catch` a l'efecte de `PlayerView`): no existeix a iOS Safari < 15.4 i, sense protecció, l'excepció tombava l'arbre de React (pantalla en negre). Al mòbil no cal: la sincronització hi va per WebSocket. ⚠️ Per això el handler dels missatges viu a **`bcHandlerRef`** i el WS l'hi crida directament — abans el WS despatxava via `bcRef.current.onmessage`, o sigui que sense BroadcastChannel no hauria processat res.
- **Diagnòstic a la pantalla d'espera** (`ConnDiag` a `PlayerView`; `SyncState`/`syncUrl`/`syncBlockedByMixedContent`/`hasSyncKey`/`probeApiReachable` a `lib/ws.ts`): sota "Esperant al Dungeon Master..." es diu l'estat del WS i **a quina adreça truca**. La URL es calcula dins del callback d'estat del socket, ja al client (depèn de `window.location`: calculada al render, el servidor en donaria una altra i hi hauria error d'hidratació).
- **Les tres avaries que des de fora es veuen igual** (i com se separen):
  1. **Contingut mixt** — pàgina per `https` (Vercel) i API per `http`: el navegador bloqueja el WebSocket. Es detecta abans de connectar (`syncBlockedByMixedContent`).
  2. **Clau rebutjada** — la API amb `SYNC_KEY` tanca amb **codi `4401`** (`api-spec.txt`); el frontend l'ha d'enviar des de `NEXT_PUBLIC_SYNC_KEY`. El codi arriba a `SyncState.code` des de l'`onclose`. ⚠️ `hasSyncKey()` diu **només si n'hi ha**, mai el valor.
  3. **Host inabastable vs WebSocket bloquejat** — les dues donen codi `1006`. Es distingeixen amb `probeApiReachable()` (petició `no-cors` a `/enemies` quan el socket es tanca, una sola vegada): si el host respon per HTTP, el problema és el WebSocket, no la xarxa.
- Els consells del rètol depenen de si la API és a la LAN o a un host públic (`isLanHost`): parlar de "la mateixa wifi" i del "port 3000" no ajuda gens quan la API va per Tailscale Funnel.

### Dreceres de teclat i modificadors (`useKeyboardHandlers`)
- ⚠️ **Ctrl i Maj commuten els modes de vista NOMÉS amb un toc net**: prémer i deixar anar la tecla sola, sense cap altra tecla, clic ni roda pel mig i en menys de `TAP_MS`. Abans commutaven en *prémer-la* (keydown), o sigui que tot **Ctrl+Z** encenia el mode CTRL (i el segon el tornava a apagar restaurant la càmera de tothom) i el **Maj+clic** de portes/màgies encenia la vista privada. `rShiftHeld` continua sent la tecla física premuda (la fan servir les màgies i les portes). La pinça del trackpad envia `ctrlKey` sense cap keydown: no toca res.
- **Espai mantingut** (`rSpaceHeld`) = arrossegar el mapa amb qualsevol eina (cursor `grab`/`grabbing` via els estats `spaceHeld`/`panning` de `DMView`).
- **Enter** passa el torn; **V** o **Esc** (quan no hi ha res més a cancel·lar) tornen a l'eina de selecció; **?** obre `ShortcutsHelp` (també des del menú ⋯ de la barra superior). Ctrl+Z accepta també Cmd+Z. Sense mapa, les dreceres de les eines no fan res.
- Si s'afegeix una drecera, afegir-la també a la llista de `ShortcutsHelp.tsx`. Aquesta finestra també explica els **gestos de l'eina Màgies** (de `SPELL_MODES`) i les tecles de les **parets**: és on va el detall que no cap a la finestreta d'una línia de la barra d'eines.

### Moure el mapa (pan) — `useMouseHandlers` + `useWheelZoom`
- Formes de fer-ho: **botó central**, **Espai + arrossegar** (qualsevol eina), **arrossegar en buit amb l'eina de selecció**, i al trackpad **dos dits** (la **pinça** fa zoom continu). Sense botó central abans no es podia moure el mapa des d'un portàtil.
- **Clic o pan** (`panDragRef.onClick`): un mousedown en buit amb l'eina de selecció arma un pan i DESA l'acció del clic (deseleccionar, revelar la sala fosca o treure la coberta d'una zona del PSD). Si en deixar anar no s'ha mogut més de 4 px, s'executa el clic; si s'ha arrossegat, només s'ha mogut el mapa. Així començar un pan damunt d'una sala fosca **no la revela**.
- **Roda**: el primer esdeveniment de cada ràfega (220 ms sense rodes la tanquen) decideix si és zoom o pan i es manté: `ctrlKey` o `deltaMode ≠ 0` → zoom; `deltaX ≠ 0` o `|deltaY| < 50` → pan (trackpad); la resta (osques de 100/120 px) → zoom. Amb la vista privada activa, el pan va a `dmLocalPan`.

### Vista privada DM
- Selector de càmera «Privada» o toc de Maj (`rShiftPanToggle`): zoom i pan locals, **no** sincronitzats al jugador (no entren a `cam`). «Enviar aquesta vista» els passa a la vista compartida (veure «Selector de càmera»).
- Refs: `dmLocalPan`, `dmLocalZoom` — animació de retorn suau (`dmPrivateReturnAnim`)

### Pantalla de benvinguda i fitxers deixats al canvas (`DMView`)
- Sense mapa: «**Obrir mapa**» (primari), «**Provar la demo**», «**Recuperar l'última partida**» (si hi ha desat automàtic) i enllaços per carregar un PSD o una partida `.json`. Abans el text del centre enviava a una caixa petita del panell lateral, i el centre no acceptava fitxers.
- **Tot l'escenari accepta fitxers** (`onStageDrop` → `loadAnyFile`): imatge/vídeo → mapa, `.psd` → capes, `.json` → partida, amb un marc «Deixa anar per carregar-lo». Només reacciona a arrossegaments de fitxers (`dataTransfer.types` inclou `Files`). ⚠️ Qualsevol zona de drop interna (p. ex. la previsualització de l'Expositor) ha de fer `stopPropagation`, si no el fitxer també es carregaria com a mapa.
- Sense mapa, la barra d'eines queda apagada, la barra de torns no surt, el zoom i el menú Vista no apareixen i «Exportar a un fitxer» (menú Partida) queda desactivat.

### Ull de visibilitat — un sol significat
- A tota l'app l'ull respon **«ho veuen els jugadors?»**: obert = sí, tancat = no (enemics, sales dibuixades i zones del PSD, a les llistes i al canvas).
- ⚠️ A les zones del PSD, `vis[id]` vol dir que la **coberta** es veu, o sigui que la zona està **amagada**: `LayerTree` passa `visible={!vis[id]}` i `renderRoomOverlays` pinta l'ull obert quan `!isVis`. Abans l'ull hi tenia el significat invers.

### Opacitat del fons (només DM)
- Control lliscant al menú **Vista** de la barra superior que abaixa l'**opacitat del mapa de fons NOMÉS a la pantalla del DM** (ajuda per veure clar sales/tokens/màgies quan hi ha molta informació). `rBgDmOpacity` (default 1) → el tick de `useRafLoop` fa `media.style.opacity`. Com que el fons és un element DOM darrere del canvas, abaixar-lo dim només la imatge del mapa; els overlays del canvas (sales, tokens, spells, dibuix) es mantenen nítids. **No es sincronitza**: els jugadors veuen sempre el fons opac.

### Expositor (visualitzador d'imatges/vídeo)
- Pestanya «Imatge o vídeo» del panell «Mostrar als jugadors» (botó de la barra superior) → preview amb zoom/pan + Ken Burns.
- El jugador mostra el contingut a pantalla completa (overlay zIndex 50) amb fade IN/OUT i `EXPOSITOR_SYNC` (LERP).

### Revelador de text (`src/lib/textreveal/`)
- Pestanya «Text» del panell «Mostrar als jugadors» → editor, controls i previsualització.
- Motor compartit `RevealEngine` (`src/lib/textreveal/index.ts`): construeix spans, esvaïment per caràcter (smoothstep + blur), pauses dramàtiques al final de frase, mode manual.
- **El DM és la font de veritat**: integra el front `pos` (velocitat `cps` + pauses + manual) i emet `TEXTREVEAL_SYNC { pos, cps, fadeMs }` a ~30fps. El jugador *segueix* aquest `pos` amb el seu propi rellotge (`RevealEngine.follow`), de manera que les pauses es propaguen però l'esvaïment continua suau.
- Overlay del jugador a zIndex 51 (sobre l'expositor) amb tipografia serif gran i fade IN/OUT (1.4s / 0.3s), igual que l'expositor.
- **Sinergia**: mostrar text amaga l'expositor i viceversa (crossfade); són dues pestanyes del mateix panell; funciona sobre qualsevol escena (mapa, imatge o res) perquè el seguidor del jugador corre *abans* de `if (!s) return` al `tick()`.
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
| `CONDITIONS` | array | Estats de D&D (16, amb `label` en català, `es`/`en` i `color`) |
| `FS` / `RADIUS` / `SHADOW` | objectes | Escala tipogràfica, radis i ombres del DM (veure «Sistema visual») |
| `FONT_SERIF` | string | EB Garamond per a títols i el text dels jugadors (via `--font-serif`) |
| `SPELL_TYPES` / `SPELL_BY_TYPE` / `SPELL_MODES` | array / Map / objecte | Màgies (nom en català, color, mode) i els quatre gestos de l'eina Màgies |
| `tint(color, a)` | funció | Color de la paleta amb transparència (`#rrggbb` + alfa hex) |
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
| Codi nou penjat de `struct` | Apareix UI de PSD en un mapa només amb imatge (o a l'inrevés) | Usar `psdStruct` (o `!struct.synthetic`) per al que és exclusiu del PSD; `struct` només vol dir "hi ha mapa" |
| Sincronitzar càmera en píxels de pantalla | Els jugadors veuen un tros de mapa diferent del DM segons la mida/format de finestra | Enviar `cam` (coords de mapa) i traduir-lo a cada pantalla amb `camToView` |
| Llegir `rDmCam` dins del missatge en lloc de `_currentCam()` | El jugador es queda un pas de zoom/pan enrere | El ref l'escriu el tick un cop per frame; els handlers d'interacció envien abans del frame següent |
| Processar dos cops un missatge jugador→DM | Efectes que es "desfan" sols i **només amb la API engegada** (p. ex. l'animació de moviment que es talla) | Tot missatge del jugador viatja per BC **i** WS: al mateix ordinador arriba duplicat. Fer els handlers idempotents (descartar l'eco: l'estat ja hi és) |
| Isotip d'estat pintat amb evenodd damunt d'una barra de "prohibit" | Escaquer allà on la barra creua un forat de la silueta | Fer la barra amb dues parts `bg` + tinta (veure `deafened` a `conditions/icons.ts`) |
| Finestreta d'ajuda pròpia per a un text curt d'un botó | Ocupa espai, tapa altres controls i obliga el contenidor a `overflow: visible` | Usar l'atribut `title` natiu (com `PlayersPanel`, `TopBar` i `CanvasHUD`) |
| Escoltador de teclat global sense guarda d'escriptura | Escriure una majúscula o fer Ctrl+A en un camp dispara una drecera (commuta la vista privada/compartida) | Passar sempre per `isTyping(e)` a `useKeyboardHandlers` (input, textarea **i** `contentEditable`) |
| Estat de token no purgat en eliminar-lo | Xip fantasma «?» a la barra d'iniciativa, aro daurat pintat enlloc | Afegir-lo a `_cleanupTokenKey` (`useDMActions.ts`), que ja neteja condicions, derrotat, mida, selecció, grups i torn |
| Regla de moviment duplicada en lloc de compartida | El jugador veu un rang groc que el DM li rebutja (o al revés) | Passar sempre per `movementLimit` (`lib/rules/conditions.ts`), com `buildMovePath` per al camí |
| Estat de combat passat sencer a React al jugador | `PlayerView` es re-renderitza ~20 cops/s (el `turn` va dins de cada STATE) | Projectar-lo amb `buildTurnBanner` + `sameBanner` i retornar `prev` quan no canvia |
| Component definit dins d'un altre component | El hover es queda enganxat / l'estat intern es perd a cada render | Declarar-lo a nivell de mòdul (veure `ToolButton` a `FloatingToolbar`) |
| Mode nou només al teclat | L'usuari no sap que existeix | Una sola funció `toggle*` a `DMView`, compartida pel botó de `FloatingToolbar` i per `useKeyboardHandlers` |
| Commutar un mode en el keydown d'un modificador (Ctrl, Maj…) | Ctrl+Z o Maj+clic encenen el mode sense voler | Només amb un toc net (keydown+keyup sense res pel mig), com fa `useKeyboardHandlers` |
| ✕ per a una acció que no és tancar/eliminar | L'usuari el prem per tancar i fa una altra cosa (p. ex. marcar derrotat) | ✕ només tanca o elimina; la resta, botó amb nom (`💀 Derrotar`) |
| Ull amb un significat diferent segons la llista | Es revela o s'amaga el contrari del que es volia | L'ull sempre vol dir «ho veuen els jugadors?» (vigilar `vis` de les zones del PSD, que és invers) |
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
| Llegir refs dins del render d'un menú | Valors que no es refresquen i error de lint `react-hooks/refs` | Passar l'estat per props (com `ContextMenuOverlay`: `libEnemies`, `players`, `psdEnemyOverrides`) |
| Camí que pot fallar resolt amb `console.error` tot sol | L'usuari veu «no passa res» i torna a clicar | Passar per `notify` (veure «Avisos a la pantalla») |
| Element de mèdia sense listener d'`error` | «Mapa carregat» amb la pantalla negra i cap pista | Parella obligatòria: `load`/`loadedmetadata` **i** `error`, revertint l'estat a l'error |
| `createObjectURL` sense el seu `revokeObjectURL` | Cada canvi de mapa o d'imatge deixa el fitxer sencer a memòria | Desar l'URL en un ref i revocar-lo en substituir-lo (`bgUrlRef`, `customUrlRef`) |
| Estat que viatja a cada `STRUCT` i creix sense límit | Late join, desfer i desat automàtic es degraden a la vegada | Posar-hi sostre i rasteritzar el que en surt (veure «Límit de l'historial de dibuix») |
