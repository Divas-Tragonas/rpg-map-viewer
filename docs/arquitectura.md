# Arquitectura

> Stack, rutes, estructura de fitxers, arquitectura del DM, bucle de render i patró state↔ref.
> Part de la documentació tècnica: vegeu [docs/README.md](README.md) per a l'índex.

## Stack

| Element | Detall |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Render | Canvas 2D API (`useRafLoop` → `tick()`) |
| Fons | Element DOM `<img>` o `<video>` posicionat absolutament darrere del canvas |
| Sync | `BroadcastChannel` (`BC_CHANNEL = 'rpg_map_sync_v18'`) — DM envia, Jugador rep |
| Dev server | `npm run dev` → `http://localhost:3001` |

## Rutes de l'app

| URL | Component | Descripció |
|---|---|---|
| `/` | `DMView` | Vista del Dungeon Master (pantalla principal) |
| `/player` | `PlayerView` | Vista del jugador (pantalla secundària) |
| `/player?embed=1` | `PlayerView` | La mateixa, incrustada al tauler de missions de la wiki (veure «Pantalla de jugador dins de la wiki») |
| `/expositor` | `ExpositorPage` | **Visor local** per a un monitor de recanvi: obres un fitxer a mà i es veu a pantalla completa. **No és l'Expositor del DM** (no rep res del BC ni del WS) |
| `/login` | `SiteLoginPage` | Contrasenya de la web (veure «Contrasenya de la web»). Pública |
| `/admin/*` | back office | Enemics i personatges de la API; demana també el login de la API (`/admin/login`) |

### Contrasenya de la web (`src/proxy.ts` + `src/lib/site-auth.ts`, v4.81)

- **Què protegeix**: tota la web menys la pantalla de jugador (`/player`, també `?embed=1`), `/login`,
  `/api/site-login` i els fitxers estàtics (el `matcher` exclou `_next/*` i qualsevol camí amb extensió:
  sprites, mapes, mòduls). Sense la cookie → redirecció a `/login?next=…` (o 401 a `/api/*`).
- **No depèn de la API**: la contrasenya viu al servidor de Next. Variables d'entorn (a Vercel:
  *Settings → Environment Variables*, i tornar a desplegar):
  - `SITE_PASSWORD` — la contrasenya. **Sense, la porta està oberta** (`npm run dev`, LAN).
  - `SITE_SECRET` — recomanat (text llarg a l'atzar): signa la cookie. Canviar-lo o canviar la
    contrasenya tanca totes les sessions.
- **Cookie** `site_session`: httpOnly, `SameSite=Lax`, `Secure` amb https, 30 dies (`SITE_SESSION_DAYS`).
  Porta `<caducitat>.<HMAC-SHA256>`, res llegible. Sortir: `DELETE /api/site-login`.
- **Back office**: `/admin/*` demana a més el JWT de la API (`admin_token`), com abans. Next 16:
  `middleware.ts` és obsolet i el fitxer es diu `proxy.ts` (funció `proxy`).
- ⚠️ Una pàgina pública nova (com `/player`) s'ha d'afegir a `isPublicPath`; un fitxer que la
  pantalla de jugador carregui sense extensió quedaria darrere la contrasenya.

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
│   ├── player/SheetCard.tsx   # Fitxa d'un personatge a la pantalla de jugador (targeta a la dreta)
│   ├── dm/                 # Panells i overlays del DM
│   │   ├── ImportPanel (fons + demo), WelcomeScreen (benvinguda), PlayersPanel (files primes de jugadors)
│   │   ├── TokenFields     # Fitxa d'un token dins del menú del clic dret (resolveToken, camps, NameField)
│   │   ├── SceneEnemiesPanel   # Tots els enemics i aliats de l'escena, en files com les DIVAS (miniatura + ull)
│   │   ├── FloatingToolbar, GridPanel, EnemyLibraryPanel (plantilles)
│   │   ├── TopBar          # Barra superior: nom del mapa, Preparar·Jugar, pantalles, partida, ☰ (vista, app, ajuda); RightRail: Mostrar als jugadors i Història
│   │   ├── TilePalette, PixelMapPanel, PixelPickers  # App Píxel: paleta de caselles, paquet + mapa, figureta i retrat
│   │   ├── ShowPanelHeader # Pestanyes Imatge o vídeo / Text / Diàleg del panell «Mostrar als jugadors»
│   │   ├── DialogPanel, DialogControls  # Diàlegs: pestanya per escriure el guió i barra del DM mentre corre
│   │   ├── StoryPanel, ModuleView, ModuleLibrary, JournalView  # Història: mòdul actiu, biblioteca de mòduls i diari (veure historia-i-moduls.md)
│   │   ├── CharacterSection # Fitxa i experiència d'un jugador dins del menú del clic dret (+ XpBar)
│   │   ├── XpAwardDialog   # «Experiència del combat»: repartiment en acabar el combat
│   │   ├── SheetPanel      # Pestanya «Fitxa» de Mostrar als jugadors
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
│   ├── useDMActions.ts     # Callbacks d'acció (càrrega del fons, BC, drag...)
│   ├── useAutosave.ts      # Desat automàtic periòdic de la partida (IndexedDB)
│   ├── useEnemyGrouping.ts # Agrupació dels enemics de la BD i grups plegats (recordat a localStorage)
│   ├── useStoredFlag.ts    # Sí/no de la UI recordat a localStorage sense error d'hidratació (lateral plegat)
│   ├── useCompact.ts       # Pantalla compacta (mòbil): useCompactLayout + CompactContext
│   ├── useCanvasPointer.ts # Ratolí i dit al canvas del DM (pointer events): pinça, mantenir premut, doble toc
│   ├── useTileMap.ts       # App Píxel: crear/editar/cuinar el mapa de caselles i regenerar-ne parets, portes i llums
│   ├── useSpritePack.ts    # Estat del paquet de sprites per a la UI
│   ├── useCinematic.ts     # Lògica cinematica boss reveal
│   ├── useDialog.ts        # Diàlegs al DM: llançar, avançar, enrere, opcions, càmera, tecles, desats als tokens
│   ├── useStory.ts         # Història: el que un mòdul fa sobre l'escena (llegir, col·locar enemics, diàlegs, sortides)
│   ├── useJournalWatchers.ts # Anota al diari sales revelades, jugadors caiguts i mapes oberts
│   ├── useCharacters.ts    # Fitxes al DM (API + còpia local): llista, donar XP (una o en lot), desar, sync de la cua
│   ├── useRafLoop.ts       # RAF loop (tick) + totes les render phases
│   ├── useMouseHandlers.ts # Gestors de ratolí
│   ├── useKeyboardHandlers.ts
│   └── useWheelZoom.ts
├── lib/
│   ├── camera.ts           # Càmera en coords de mapa (viewRect/clampCamToMap/camToView)
│   ├── turn.ts             # Primitives de la cua d'iniciativa (budgetFor, nextActive, removeFromTurn)
│   ├── relay.ts            # Pont del canal amb el tauler de missions de la wiki (postMessage, sense API)
│   ├── token-menu.ts       # tokenMenuFor: estat del menú del clic dret d'un token (mapa i files del lateral)
│   ├── dm-mode.ts          # Modes Preparar / Jugar del DM i a quin mode pertany cada eina (modeForTool)
│   ├── undo.ts             # Registre del «Desfer» únic: ordre de les piles de traços, mapa i moviments
│   ├── turn-banner.ts      # Projecció del combat al rètol de les pantalles de jugador
│   ├── rules/conditions.ts # Efecte mecànic dels estats sobre el moviment (movementLimit)
│   ├── autosave.ts         # Magatzem IndexedDB del desat automàtic (+ agoLabel)
│   ├── enemy-groups.ts     # groupEnemies / distinctValues / apiSupportsGroups (projecte i categoria)
│   ├── localStore.ts       # Magatzem JSON a localStorage fora de la partida (createJsonStore / useJsonStore)
│   ├── modules.ts          # Mòduls de la història: format del paquet, importació, biblioteca (localStorage)
│   ├── journal.ts          # Diari de la sessió: logJournal, resum en markdown, recap (localStorage)
│   ├── characters.ts       # Fitxes: format de `sheet`, taula d'XP de 5e, characterFor, buildSheetShow
│   ├── characters-seed.ts  # Les 5 fitxes de Notion (importar-les al back office i primera còpia local)
│   ├── characters-store.ts # Còpia local de les fitxes i cua de canvis fets sense connexió (localStorage)
│   ├── bestiary.ts         # Catàleg únic d'enemics (`ENEMY_TEMPLATES`, Castell de la Fumarola, aliats) + monstre 5e, VD, XP i vida de cada criatura Oryx
│   ├── sprites/            # App Píxel: paquet Oryx (pack.ts: carrega els fulls de public/sprites/; draw.ts; manifest.ts GENERAT; portrait.ts; font.ts lletra de píxel; window.ts finestres 9-slice; variants.ts GENERAT: variants de color de les figuretes; states.ts: estats a la figureta; hitfx.ts: cops, envestides i curacions) · `kit.ts` + `kit-art.json`: Forja de figuretes
│   ├── dialog/             # Diàlegs: script.ts (guió), reveal.ts (lletra a lletra), camera.ts, tokens.ts, scene.ts (motor), host.ts (DM i jugador)
│   ├── tilemap/            # App Píxel: mapa de caselles (model, palette, editor, render/cuinat, geometry → parets, tmx)
│   ├── rooms/
│   │   ├── detect.ts       # detectRooms + reconcileRooms (cares del graf de parets)
│   │   ├── doors.ts        # Portes: effectiveWalls, pruneDoors, doorAt
│   │   ├── walls.ts        # Edició de parets: vertexAt, moveVertex, wallAt
│   │   └── pathing.ts      # Camins i caselles abastables (Dijkstra amb parets)
│   ├── render/
│   │   ├── types.ts        # FrameContext interface
│   │   ├── zones.ts        # renderPaintedZones, renderShapePreview
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
│   │   ├── tokens.ts       # renderEnemyTokens, renderLibEnemyTokens, renderPlayerTokens (halos)
│   │   ├── token-geom.ts   # centre, figureta (placeFigure), hit-test (tokenAt) i ventall dels apilats
│   │   └── grid.ts         # renderGrid, renderGridCalib, renderDMPointer
│   ├── cinematic/          # timeline.ts (CinematicTimeline) + bossIntro.ts (cinemàtica de boss, DM i jugador) + pixelIntros.ts (les 10 de pixel art)
│   ├── textreveal/index.ts # RevealEngine + helpers (revelador de text DM/Jugador)
│   ├── conditions/
│   │   ├── icons.ts        # CONDITION_ICONS: isotips vectorials (paths SVG) dels estats
│   │   └── index.ts        # drawConditionIcon / drawConditionBadges + conditionInk
│   ├── geometry.ts         # getBBox i utilitats geomètriques
│   ├── rules/reach.ts      # edgeDistanceFt (vora a vora), isOutOfRange
│   ├── rules/terrain.ts    # terreny difícil: caselles, terrainCost (cost ×2 al pathfinding)
│   ├── spellcast.ts        # aimSpell / aimAttack (previsualització + avís d'abast) i previewForPlayers
│   ├── phosphor/screen.ts  # Mode Fòsfor: la pantalla de jugador com una TV de tub (paleta + CRT en WebGL)
│   ├── textures/noise.ts   # Soroll de les zones màgiques (el de valor de la v4.33 + gradient 3D)
│   ├── textures/fields.ts  # Camp de color de cada element de zona (texel, temps) → rgba
│   └── enemy-images.ts     # ENEMY_IMAGES (imatges base64 enemics)
├── constants/index.ts      # CONDITIONS, ELEMENTS, PALETTE, ENEMY_TEMPLATES, C, BC_CHANNEL...
└── types/index.ts          # Tots els tipus TypeScript
```

## Arquitectura del DM

```
DMView (component React)
│
├── useState (UI state)             →  pos, zoom, players, libEnemies...
├── useDMRefs() → R                 →  tots els refs (mirrors + interaction)
├── useDMActions(R, setters) → A    →  callbacks (loadBg, broadcastState...)
├── useRafLoop(R, opts)             →  tick() + render phases (60fps)
├── useMouseHandlers(R, A, ...)     →  drag, pan, draw, calibre grid
├── useWheelZoom(R, A, ...)         →  zoom roda del ratolí
├── useKeyboardHandlers(R, A, ...) →  ESC, Ctrl, Delete...
└── useCinematic(R, A, ...)         →  boss intro cinematica
```

## Render loop — tick() (`src/hooks/useRafLoop.ts`)

`tick()` s'executa cada frame via `requestAnimationFrame`:

1. Resize canvas si cal
2. Obtenció del `ctx` (cached a `_ctx2dRef`)
3. Càlcul de `mw, mh` (dimensions del mèdia de fons)
4. Animació de retorn vista privada DM (`dmPrivateReturnAnim`)
5. Càlcul de `z, pan` (cinematica cam o local+shared)
6. Càlcul de `sc, ox, oy` (scale i offset)
7. Sync posició DOM del fons (evita thrashing amb `prevBgStyle`)
8. `if (!hasMap)` — res a renderitzar fins que hi ha mapa (`rMapSize`)
9. **Construcció de `fc`** (`FrameContext`) — passat a totes les render phases
10. `ctx.save() / translate(ox,oy) / scale(sc,sc)`
11. Render phases (en ordre)
12. `ctx.restore()`
13. `renderGrid / renderGridCalib / renderDMPointer` (espai pantalla)
14. Cinematic tick (partícules)

## Render phases existents

| Funció | Fitxer | Descripció |
|---|---|---|
| `renderPaintedZones` | render/zones.ts | Zones màgiques: animades amb `drawZoneFx` de `zonefx.ts` (jugador, fotogrames clau fosos) / color pla (DM) |
| `renderShapePreview` | render/zones.ts | Preview del shape tool al DM |
| `advanceStrokeAnim` | render/drawing.ts | Reprodueix traços de dibuix frame a frame |
| `renderSpells` | render/spells.ts | Animacions dels spells (inclosos els dels grimoris, `bookspells.ts`). Dues passades: `'ground'` (sota tokens) i `'air'` (sobre) |
| `renderLibEnemyTokens` | render/tokens.ts | Tokens biblioteca d'enemics lliures. Al DM, dues passades amb `renderPlayerTokens` (`'base'` i `'top'`: el seleccionat a sobre); abans, `advanceTokenSpread` |
| `renderPlayerTokens` | render/tokens.ts | Tokens jugador: LERP, condicions |
| `renderNameTags` | render/tokens.ts | Només jugador: els noms de tots els tokens, junts i sense encavalcar-se (veure «Noms dels tokens a la pantalla de jugador») |
| `renderRooms` | render/darkrooms.ts | Sales fosques: foscor amb llum dels tokens retallada (LOS) / overlay+contorn+ull (DM) |
| `renderWalls` | render/darkrooms.ts | Parets dibuixades pel DM (no visibles al jugador) |
| `renderWallDraft` | render/darkrooms.ts | Paret elàstica en curs (espai pantalla, com la regla) |
| `renderGrid` | render/grid.ts | Grid overlay |
| `renderGridCalib` | render/grid.ts | Calibració visual del grid |
| `renderDMPointer` | render/grid.ts | Cursor del DM visible al jugador |

### FrameContext (fc) — `src/lib/render/types.ts`

Objecte tipat (`FrameContext`) construït una vegada per frame i passat a totes les render phases. Inclou: `sc, ox, oy, mw, mh, isDM, s, v, pp` + tots els refs necessaris.

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

## Patró state ↔ ref

Cada valor d'estat té **dos** contenidors (definits a `useDMRefs.ts`):

```ts
// DMView.tsx
const [pos, setPos] = useState<PosMap>({});   // React (triggers re-render, UI)
// useDMRefs.ts
const rPos = useRef<PosMap>({});              // ref mirall (lectura O(1) dins tick)
```

**Regla:** Quan modifiques un estat, actualitza sempre `setState` i el `ref` corresponent. `tick()` llegeix refs, mai state.

## Constants clau (`src/constants/index.ts`)

| Constant | Valor | Ús |
|---|---|---|
| `BC_CHANNEL` | `'rpg_map_sync_v18'` | BroadcastChannel |
| `TOKEN_LERP` | `0.07` | Suavitzat moviment tokens |
| `TSCALE` | `90` | Escala base tokens |
| `FX_SLOW` | `1.15` | Lentitud de les animacions d'atacs, conjurs i accions (divideix el temps; veure `efectes-i-cinematiques.md`) |
| `TOKEN_STACK_TOL` | `0.5` | Tokens «apilats» (fracció de casella entre centres): s'obren en ventall sota el cursor (`render/token-geom.ts`) |
| `C` | objecte colors | Paleta UI (`bg`, `panel`, `accent`, `text`...) |
| `CONDITIONS` | array | Estats de D&D (16, amb `label` en català, `es`/`en` i `color`) |
| `FS` / `RADIUS` / `SHADOW` | objectes | Escala tipogràfica, radis i ombres del DM (veure «Sistema visual») |
| `FONT_SERIF` | string | EB Garamond per a títols i el text dels jugadors (via `--font-serif`) |
| `SPELL_TYPES` / `SPELL_BY_TYPE` / `SPELL_MODES` | array / Map / objecte | Màgies (nom en català, color, mode) i els quatre gestos de l'eina Màgies |
| `tint(color, a)` | funció | Color de la paleta amb transparència (`#rrggbb` + alfa hex) |
| `ELEMENTS` | array | Elements màgics (fire, ice, water...) |
| `ENEMY_TEMPLATES` | array | Plantilles enemics (goblin, troll, drac...) |
| `DEFAULT_PARTY` | array | 5 jugadors per defecte |
