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
│   ├── camera.ts           # Càmera en coords de mapa (viewRect/clampCamToMap/camToView)
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
| `VIEWPORT` | Jugador→DM | Mida del canvas d'aquella pantalla (`{id,w,h}`). El DM en fa la llista del HUD 🖥 |
| `TOKEN_MOVE` | Jugador→DM | Token mogut des de la pantalla de jugador (BC i WS). Només tokens de jugador (`pl_*`): el DM descarta la resta |
| `TOKEN_RELAY` | DM→Jugador | Relay d'un token mogut (id+x+y) a la resta de pantalles de jugador. El jugador el **fusiona** dins `rPos` sense reemplaçar l'estat ni tocar la càmera |
| `RESET_EXPLORED` | DM→Jugador | Reset de la memòria d'explorat d'una sala (torna a ser negra del tot). Porta el polígon `points`; DM i jugador criden `clearExploredAt(points)` a `darkrooms.ts` |

Tots els tipus estan definits a `BCMessage` a `src/types/index.ts`.

**Dieta del `STATE`** (`_broadcastState` a `useDMActions.ts`): els camps pesats (`players`, `conditions`, `defeated`, `paintedZones`, `tokenSizeOverride`, `libEnemies`, `psdEnemyOverrides`, `rooms`, `walls`, `doors`, `lights` — poden portar imatges base64) només s'inclouen al missatge quan la seva **referència** ha canviat des de l'últim enviament (`lastSentHeavyRef`). Per això és crític que tota mutació d'aquests valors creï un objecte/array **nou** (mai mutar in place) i que el jugador els tracti com a camps opcionals. Els broadcasts de pan/zoom (compartit i privat) i l'animació de retorn de vista privada van throttled a ~20Hz amb enviament final garantit — el jugador suavitza amb LERP, així que es veu fluid igualment.

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

## Funcionalitats principals

### PSD Import
- Parser binari: `parsePSDStructure(buffer)` → `ParsedPSD`
- Extracció imatges: `extractLayerImages` → `Record<number, HTMLCanvasElement>`
- Arbre de capes: `buildTree` + `validateStructure` → `MapStructure`
- Grups esperats al PSD: `zones`, `enemies`, `extras`

### Mapa només amb imatge (el PSD és OPCIONAL)
- **Problema que resol**: `tick()` (DM i jugador) surt aviat amb `if (!s) return` quan no hi ha `MapStructure`. Sense PSD no es dibuixava **res**: ni grid, ni sales, ni tokens.
- **Solució**: en carregar un fons sense PSD es crea una **estructura buida sintètica** (`emptyStructure()` a `src/lib/psd/tree.ts` → `MapStructure` amb `extras.children: []`, `roomLayers: []`, `enemyRooms: []` i **`synthetic: true`**). Totes les render phases hi passen sense branques especials (simplement no hi ha capes de PSD a pintar) i funcionen grid, parets/sales/portes, llums i fog of war, tokens, dibuix, zones màgiques, spells, torns i el sync amb el jugador.
- **On es crea** (`_applyImageOnlyStruct` a `useDMActions.ts`): al `load`/`loadedmetadata` del mèdia dins de `loadBg` (amb `psdInfo` = dimensions reals de la imatge) i com a fallback si `loadPSD` falla. **Mai substitueix un PSD real**: es comprova `rStruct.current && !rStruct.current.synthetic`. Envia `_sendStructState()` perquè el jugador surti també del seu `if (!s) return`.
- **UI**: `DMView` deriva `psdStruct = struct && !struct.synthetic ? struct : null` i passa **`psdStruct`** (no `struct`) a tot el que és exclusiu del PSD: `ImportPanel`, `LayerTree`, `CanvasHUD` (botó "Resaltar"), `BottomControls` i `TurnTracker`. El render loop segueix llegint `rStruct` (la sintètica inclosa).
- **Sessió**: `synthetic` es desa dins de `psdStruct` i es restaura a `applySessionState` (si es perdés, la UI del PSD tornaria a sortir buida en carregar la partida).
- **Regla**: qualsevol codi nou que es pengi de `struct` ha de decidir explícitament si vol *"hi ha mapa"* (`struct`) o *"hi ha PSD"* (`psdStruct` / `!struct.synthetic`).

### Panell de sales (`src/components/dm/RoomsPanel.tsx`)
- Arbre de "capes" d'un mapa dibuixat a l'app: substitueix el `LayerTree` quan no hi ha PSD (i conviu amb ell quan n'hi ha). Es mostra sempre que `bgLoaded`.
- Llista les **sales detectades** (`rRooms`): commutador 🌑 de sala fosca, ull de revelar/amagar (només si és fosca), nom editable en línia i desplegable amb "Afegir porta", "Resetejar explorat" (només si és fosca) i "Eliminar sala" amb **confirmació en dos passos** (es desa l'`id` pendent, no un booleà — mateix criteri que `ContextMenuOverlay`).
- Hover d'una fila → escriu a `R.rHoveredRoomId` (ref llegida per `renderRooms`), així la sala es ressalta al canvas.
- Secció de **punts de llum** (`rLights`): radi en peus, selecció (sincronitza el slider del flyout) i eliminar.
- Botons d'accés directe a les eines 🧱 Parets (`5`) i 🔆 Llums (`6`).

### Eines de dibuix (barra flotant)
- `FloatingToolbar` (`src/components/dm/FloatingToolbar.tsx`) — columna de botons flotants tipus Photoshop a baix a l'esquerra del canvas (dins del `stageRef`, no a la finestra lateral).
- Botons apilats: Selecció (`none`), Ploma, Goma, Màgies, Senyal, separador, Desfer, Esborrar tot i (condicional) Esborrar zones màgiques.
- Quan l'eina activa és Ploma/Goma o Senyal, apareix un flyout contextual a la dreta de la columna amb la paleta de color + mida de pinzell, o l'ajuda de la regla de mesura, respectivament.
- La pestanya lateral "Eines" només conté ara el `GridPanel` (configuració de grid).
- Eina **Llums** (drecera `6`): col·locació de punts de llum (torxes) — veure feature "Punts de llum".

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
- **Model**: el DM dibuixa **parets** (segments) clicant successivament (estil regla de mesura). El conjunt de parets és la font de veritat del DM (`rWalls`). Les **sales** (`rRooms`) se'n deriven per **detecció de cares en un graf planar** (`src/lib/rooms/detect.ts` → `detectRooms`): fusiona vèrtexs propers, parteix als encreuaments (X) i a les unions en T, i extreu les cares tancades mínimes (recorregut de half-edges amb gir horari; cares acotades = àrea > 0 en coords de pantalla). Cada cara nova és una sala; una paret que divideix una sala la parteix en dues. Les **portes** són entitats explícites sobre les parets (veure secció següent); un tram sense dibuixar entre parets també fa d'obertura.
- **Reconciliació** (`reconcileRooms`): a cada canvi de parets es recalculen les cares i s'aparellen amb les sales existents (per centroide + àrea) perquè `id`, nom i estat (`dark`/`revealed`) es preservin.
- **Interacció** (`useMouseHandlers`, eina `'wall'`): clic afegeix un vèrtex i tanca el tram amb l'anterior; `snapWall` fa imant a **vèrtexs i arestes** de parets existents (tancament + unions en T "sobre rails") i snap a graella. En completar-se una geometria nova (augmenta el nombre de sales) la cadena **s'acaba automàticament** (`rWallChain`), cal tornar a clicar. `Backspace` desfà l'última paret (`removeLastWall`), `Esc` cancel·la tota la cadena en curs (`cancelWallChain`). Re-detecció via `redetectRooms` (a `useDMActions`).
- **Sales fosques**: les sales noves **neixen fosques per defecte** (`reconcileRooms` a `detect.ts` → `dark: true`); `Room.dark` també es commuta via clic dret (el menú s'actualitza en viu) → interior negre opac al jugador; `Room.revealed` (ull: clic sobre la sala en mode selecció, o menú contextual) → es revela amb fade suau (`roomRevealAnimRef`). **Revelar és lliure, però amagar una sala revelada amb l'ull requereix el mode Shift actiu** (`rShiftPanToggle`), com les sales PSD. Menú de sala a `ContextMenuOverlay` (`isRoom`): marcar fosca, revelar/amagar, reanomenar, afegir porta, resetejar explorat i eliminar. **Eliminar demana confirmació en dos passos** (`confirmDelRoomId` a `ContextMenuOverlay`: es desa l'**id** de la sala pendent de confirmar, no un booleà, perquè obrir el menú d'una altra sala no arribi ja confirmat sense necessitat d'un efecte que reiniciï l'estat).
- **Render** (`src/lib/render/darkrooms.ts`): `renderRooms` — al **jugador** es pinta DAMUNT de tot (després dels tokens/spells) perquè qualsevol token/dibuix dins una sala fosca quedi amagat (fog of war); al **DM** va dins la transformació de mapa (semitransparent, hi veu a través). El farciment es fa amb el polígon + contorn del mateix color perquè les sales contigües se solapin i no quedi cap fil visible a la paret compartida. `renderWalls` (parets, només DM), `renderWallDraft` (paret elàstica en curs, espai pantalla).
- **Sync**: camps `rooms` i `walls` a `STATE`/`STRUCT` (pesats: només s'envien quan canvia la referència). Persisteix a la sessió (`walls` + `rooms`). Les parets viatgen al jugador **però no s'hi dibuixen**: calen per a la llum (línia de visió) i per a la col·lisió de moviment.
- **Pendent** (futur): revelat automàtic de la sala sencera en entrar-hi un jugador, obrir/tancar portes, edició de vèrtexs.

### Portes (col·locació obligada en tancar una sala)
- **Model** (`Door` a `types/index.ts`, helpers a `src/lib/rooms/doors.ts`): una porta és un **segment sobre una paret** (`{id, a, b, open?}`). Per a llum i col·lisió es calculen les **parets efectives** (`effectiveWalls`): cada paret amb els trams de porta **oberta** retallats — per una porta oberta hi passen la llum i el moviment; una porta **tancada** (`open: false`) deixa la paret sencera i torna a bloquejar. La detecció de sales continua usant les parets senceres (una porta no parteix la sala). Una paret pot tenir **diverses portes**.
- **Obrir/tancar**: amb el **cursor normal (mode selecció)**, passar per sobre d'una porta la **destaca** (hover reactiu tipus botó: traç brillant + halo + cursor `pointer`, `rHoveredDoorId`) i el **clic la commuta** (`toggleDoor`). Les portes noves neixen **tancades**.
- **Amplada per dos clics** (`nearestWallHit` + `doorEndOnWall` a `src/lib/rooms/doors.ts`): la col·locació és de **dos clics**. **Primer clic** → marca l'inici de la porta imantat a la paret més propera (`rDoorPlacement.current.anchor = { wall, s }`). **Segon clic** → fixa el final (l'amplada) projectat sobre la **mateixa paret** i crea la porta (`addDoor`). Amb grid **i el "snap grid" actiu** (`rGridSnap`), cada extrem s'imanta a la línia de graella més propera al llarg de l'eix dominant de la paret (`snapSToGrid`); si el snap està desactivat, la porta es col·loca lliure. No hi ha límit de mida ni control `+/−` (deprecats: `rDoorWidthCells` i `doorPlacementAt` queden sense ús).
- **Col·locació obligada**: en tancar-se una sala nova amb l'eina Parets, s'obre automàticament el **mode de col·locació de porta** (`rDoorPlacement`). Sense inici marcat, la previsualització (`rDoorPreview`) és un **punt** imantat a la paret; amb l'inici marcat, és el **segment** de porta de l'inici al cursor projectat. **Segon clic → col·loca i surt**; **Maj+2n clic → col·loca i continua** (per posar-ne més); **Esc → desfà el primer clic si n'hi ha, si no omet**. El rètol d'ajuda (amb l'amplada en peus quan hi ha inici) es pinta a `renderDoorDraft` (espai pantalla, `useRafLoop` després de `renderWallDraft`).
- **Gestió**: menú contextual de sala → "🚪 Afegir porta" (`startDoorPlacement`, activa l'eina Parets en mode porta, permet més d'una porta per sala). Amb l'eina Parets, **clic dret sobre una porta l'elimina** (`removeDoor`, la paret es tanca de nou). `pruneDoors` (cridat a `redetectRooms`) fa caure soles les portes que perden la seva paret (Backspace, eliminar sala, Esc de cadena...).
- **Render** (`renderWalls`): el traç sòlid de paret usa les parets efectives (el forat es veu de veritat) i cada porta es marca amb un **rectangle de traç gruixut del mateix daurat que les parets** (`drawDoorMark`) muntat sobre la paret: **oberta → buit per dins; tancada → interior pintat**. En hover es ressalta (traç brillant + halo). Només al DM.
- **Sync**: camp pesat `doors` a `STATE`/`STRUCT`; persisteix a la sessió. El jugador les usa (parets efectives al drag i a la llum) però no les dibuixa.

### Il·luminació de sales fosques (llum per token de jugador)
- **Model**: cada token de jugador **visible** emet llum dins del seu radi de visió (`Player.visionFt`, peus; per defecte `DEFAULT_VISION_FT = 30`, `0` = sense llum; el DM l'edita al desplegable del `PlayersPanel` via `setPlayerVision`). Com `speed`, viatja dins l'array `players` sense camps de sync nous. **Radi efectiu = `visionFt/5 − 1` casella (mínim 1)** — es veu una mica menys que la visió nominal. La condició **cegat (`blinded`)** força el radi al mínim (**1 casella, 5 ft**) mentre dura.
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
- **Moviment vorejant les parets (forma d'L)** (`rMovePath`, `computePath` a `src/lib/rooms/pathing.ts`): amb grid+parets, en deixar anar es calcula el **camí real** (Dijkstra amb predecessors, mateixes regles que `computeReachableCells`) de l'origen del drag al destí i es desa a `rMovePath[id]` com a llista de punts. el camí es **suavitza amb Chaikin** (`smoothPath`, corba natural en lloc d'escala esglaonada) i `renderPlayerTokens` (branca jugador) el recorre a **velocitat de creuer constant** (`PATH_CRUISE` × mida de casella per frame) amb **frenada suau** al final (`PATH_BRAKE`, ease-out); `pts` inclou l'origen i acaba exacte al destí. La **llum no talla per sales fosques que el token no travessa**. Els moviments d'1 casella no desen camí → LERP recte de sempre. Sense grid/parets, o si origen i destí són adjacents, no es desa camí → LERP recte de sempre. També s'aplica a la resta de pantalles via `TOKEN_RELAY` (veure sota): cada pantalla recalcula el camí des de la posició antiga (`_setMovePath` a `PlayerView`; un eco del relay del propi token, origen==destí, és no-op i no esborra el camí ja fixat). El handler de `STATE` del jugador conserva la posició local del token arrossegat perquè un broadcast del DM no el faci saltar enrere.
- **Relay a la resta de pantalles de jugador** (`TOKEN_RELAY`): quan el DM rep un `TOKEN_MOVE` vàlid (BC o WS, handlers a `DMView.tsx`), després d'actualitzar `rPos`/`setPos` reenvia un missatge **`TOKEN_RELAY { id, x, y }`** (per BC i WS) amb només el token mogut. **S'envia sempre** (també en combat) i **abans** del `STATE`, perquè cada pantalla pugui calcular el camí en L des de la posició antiga abans que el `STATE` (en combat) reajusti `rPos`. La pantalla de jugador el **fusiona** dins `rPos` (`rPos.current = { ...rPos.current, [id]: {x,y} }`) sense reemplaçar la resta de posicions ni tocar cap altre camp. Això és clau: **no s'ha de reenviar un `STATE` complet** aquí — reemplaçar tot `rPos` feia desaparèixer els enemics (les posicions PSD que el client tenia quedaven sobreescrites) i incloure la càmera resetejava el zoom del client a cada moviment. Amb el merge d'un sol token no es toca ni la càmera ni la resta de tokens/sales. Si la pantalla que rep està arrossegant el mateix token, conserva la seva posició local (no salta a mig drag). El mateix `TOKEN_RELAY` (amb la posició autoritzada) s'usa per fer tornar enrere un token bloquejat (`canMove === false`) sense resetejar-li el zoom.
- **Límit de moviment per velocitat** (`Player.speed`, peus; per defecte `DEFAULT_SPEED_FT = 30`): el drag des de `/player` clampa el centre del token a un rang de `maxCells = floor(speed/5)` caselles al voltant de la casella d'origen del drag. **La regió abastable és un cercle** (distància euclidiana: `dc² + dr² ≤ (maxCells + 0.5)²`), és a dir un **disc rasteritzat** com les taules de cercles pixel-art — la diagonal costa el seu valor real (~7 ft = √2·5). El clamp (`onPointerMove` a `usePlayerTokenDrag.ts`) camina la casella cap endins fins entrar al disc reduint primer l'eix dominant (així la casella final és sempre una de les pintades i segueix la direcció del punter). Les caselles abastables es pinten en groc suau durant el drag amb perímetre esglaonat (`renderMoveRange` a `render/grid.ts`, cridada al tick del jugador **després de `renderRooms`** perquè el groc es vegi sobre la foscor de les sales; mateixa condició `inRange` que el clamp perquè pintura i límit coincideixin). Amb parets dibuixades, el disc queda a més restringit a les caselles amb camí transitable (`MoveRange.reach`, veure "Col·lisions de moviment amb parets"). El DM edita la velocitat al `PlayersPanel` (`setPlayerSpeed`) i **no** té cap límit en moure tokens. `speed` viatja dins l'array `players` (STRUCT/STATE/sessió), sense camps de sync nous.
- **Bloqueig a 0 de vida** (`Player.hp`): amb `hpMax > 0 && hp <= 0` el jugador **no pot moure el token** (ni començar el drag ni validar el `TOKEN_MOVE` al DM) fins que recuperi vida. **El DM sempre pot** (el seu drag no passa per aquesta via).
- **Bloqueig de moviment per jugador** (`Player.canMove`, absent → `true`): amb `canMove === false` el hit-test de `usePlayerTokenDrag` ignora el token (no es pot ni començar el drag des de `/player`). A més, si arriba un `TOKEN_MOVE` d'un token bloquejat (BC o WS, handlers a `DMView.tsx`), el DM no només el descarta sinó que **reenvia l'estat** (`_broadcastState({})`) perquè la posició autoritzada torni al jugador a l'instant — així un client que encara no hagués rebut el bloqueig no deixa el token mogut fins al següent broadcast. El DM el commuta al desplegable de configuració del `PlayersPanel` (`setPlayerCanMove`); la targeta mostra 🔒. Com `speed`, viatja dins `players` sense camps de sync nous.

### Panell de jugadors (`src/components/dm/PlayersPanel.tsx`)
- Targetes a **una columna** (amplada completa del sidebar), apilades verticalment.
- Cada targeta (`PlayerCard`): capçalera (color, nom editable, 🔒 si `canMove === false`, ✕ eliminar) + fila d'HP gran (botons −/+ de 32px amb clic dret ±10, vida a 24px) + botó d'engranatge.
- L'engranatge desplega una **secció de configuració** enganxada sota la targeta amb animació suau (truc CSS `grid-template-rows: 0fr→1fr`, sense mesurar alçades): vida actual, vida màxima, velocitat (peus + equivalència en caselles), visió a les fosques (peus; radi de llum a les sales fosques) i toggle de moviment des de la pantalla de jugador. Només un desplegable obert alhora (`openConfigId`).

### Sistema per torns (iniciativa) — barra inferior
- **Estat**: `TurnState` (`types/index.ts`) `{ active, order, turnIndex, round, activeRemainingFt }`. Mirall `rTurn` (`useDMRefs.ts`), estat React `turn` (`DMView.tsx`). El DM és la font de veritat; viatja al jugador dins `STATE`/`STRUCT` (camp lleuger `turn`, sempre enviat) i persisteix a la sessió (save/load).
- **Component**: `TurnTracker` (`src/components/dm/TurnTracker.tsx`) — barra flotant a baix al centre del `stageRef`. Inactiu: botó "⚔️ Iniciar torns" que obre un popover de selecció (tots els jugadors s'afegeixen automàticament; es trien enemics PSD/lib visibles i **grups** llegits de `rTokenGroups`). Actiu: badge de ronda + fila de chips en ordre de torn + botó "⏭ Ronda" + "✕".
- **Ordre** (`startTurnCombat` a `DMView.tsx`): `order` = ids plans `[...jugadors, ...selecció]` amb dedup (els grups s'expandeixen als seus tokens en iniciar; l'ordre no guarda referències a grups perquè `rTokenGroups` és efímer).
- **Passar torn** (`advanceTurn`): clic al chip **actiu** de la barra. En tancar la volta (`turnIndex` supera l'últim) → `round++` i `turnIndex=0`. Cada token, en agafar el torn, reinicia `activeRemainingFt` a la seva velocitat (`_budgetFor`: `Player.speed` per `pl_*`, sentinella gran per enemics). Botó "⏭ Ronda" (`advanceRound`): salta els que queden i comença ronda nova.
- **Distintiu**: aro **daurat sòlid** al token actiu (`drawActiveTurnRing` a `render/tokens.ts`), pintat a **les tres** famílies de tokens — `renderPlayerTokens`, `renderEnemyTokens` (PSD, `_activeId === en.id`, numèric) i `renderLibEnemyTokens` (`_activeId === \`lib_${en.id}\``) — perquè al mapa es vegi a qui li toca moure i no calgui mirar la barra d'iniciativa. No es pinta si el token està derrotat o pràcticament invisible (`enAlpha > 0.3`). Coherent amb el groc però diferent de l'aro de "ressaltar enemics" i del blau de selecció.
- **Límit de moviment per torn** (extensió de `usePlayerTokenDrag`): amb combat actiu, des de `/player` només es pot **agafar** el token del torn actiu, i el disc de moviment usa `activeRemainingFt` en lloc de la velocitat sencera (es va encongint drag a drag: p. ex. 15 ft → mou 5 → queden 10). El DM valida cada `TOKEN_MOVE` (`handlePlayerTokenMove`): comprova bloqueig manual (`canMove`), que sigui el token actiu i que el cost no superi el saldo (mateixa mètrica de disc: `cost = ceil(hypot(dc,dr) − 0.5)` caselles × 5 ft); si el supera, rebot amb `TOKEN_RELAY`. En aplicar, descompta el saldo i propaga amb `_broadcastState` (perquè el disc del jugador s'encongeixi). **El DM mou sense límits** (el seu drag no passa per aquesta via). Sense grid no hi ha límit (com el clamp existent).
- **Recuperar un torn anterior**: clic dret sobre un token **no actiu** de la barra → "↩ Recuperar el seu torn" (`recoverTurn`). Torna `turnIndex` a aquell token amb el saldo de peus que li quedava (`TurnState.remaining`, mapa de saldos desat en deixar cada torn; es neteja a cada ronda nova).
- **Desfer moviment (Ctrl+Z)**: `rMoveHistory` (DM-only, es reinicia a cada canvi de torn via `_applyTurn`) apila `{ id, from, spentFt }` a cada moviment de combat (`handlePlayerTokenMove`). `undoTokenMove` restaura la posició i retorna els peus. **Encaminat per eina** a `useKeyboardHandlers`: amb l'eina de selecció (`rDrawTool === 'none'`) el Ctrl+Z fa `undoTokenMove`; amb qualsevol eina de dibuix fa `undoStroke` (cadascú el seu, no es barregen).
- **Editar l'ordre**: botó **⚙** a la barra activa un mode edició on els chips es poden **arrossegar** (HTML5 drag) per reordenar `order` (`reorderTurn`, que manté actiu el mateix token recalculant `turnIndex`). En mode edició, clicar el chip actiu no passa torn.
- **Acabar combat**: el botó ✕ demana **confirmació** ("Finalitzar? Sí/No") per evitar clics accidentals.

### Càmera compartida — independent de la mida i el format de finestra (`src/lib/camera.ts`)
- **Problema que resol**: la càmera es sincronitzava com `{ zoom, panOffset }` amb `panOffset` en **píxels de pantalla del DM**, i cada pantalla hi aplicava després la seva pròpia escala d'ajust `min(W/mw, H/mh)`. Amb finestres de mida o format diferents, el mateix `panOffset` desplaçava una quantitat de mapa diferent i el rectangle visible depenia del format: en fer zoom, **cada pantalla retallava per un costat diferent**. El DM tenia contingut a la vora de la seva pantalla i els jugadors no el veien, sense cap indici.
- **Model**: el que viatja és `cam: CamRect { cx, cy, w, h }` — el **rectangle de MAPA** que enquadra el DM. Camp lleuger de `STATE`/`STRUCT` (4 números, s'envia sempre). `zoom`/`panOffset` es continuen enviant **només per compatibilitat amb clients antics**.
- **DM** (`useRafLoop` escriu `rDmCam` cada frame; `_currentCam()` a `useDMActions` el recalcula **al moment d'enviar**): `viewRect()` a partir de `rZoom`/`rPanOffset` — **mai** de `dmLocalZoom`/`dmLocalPan` (vista privada) ni de la càmera de la cinemàtica, que són locals. Després `clampCamToMap()`: no es demana a les altres pantalles que reservin espai per als marges buits del DM (amb formats molt diferents això empetitia molt el mapa a l'altra banda); la **mida** del rectangle es conserva i només es desplaça cap endins, així que tot el contingut de mapa que veu el DM hi continua sent.
  - ⚠️ **No llegir `rDmCam` directament dins del missatge**: el tick l'escriu un cop per frame i les interaccions (roda, pan) broadcastegen **síncronament dins del seu handler**, o sigui que s'enviaria l'enquadrament del frame ANTERIOR. Com que després d'una roda de zoom no arriba cap més missatge, el jugador es quedava un pas de zoom enrere per sempre (~12% d'enquadrament). Sempre `_currentCam()`.
- **Jugador** (`PlayerView`): desa `cam` a `rCam` i **cada frame** el tradueix al seu `{zoom, pan}` amb `camToView()` (regla **contain**: `sc = min(W/cam.w, H/cam.h)`), escrivint-lo a `rZoom`/`rPanOffset` perquè la resta del codi (LERP i hit-test del drag de tokens) el llegeixi com sempre. Com que es recalcula cada frame amb la mida REAL d'ara, **girar la tablet o canviar de mida reenquadra tot sol** sense esperar cap missatge. Si el DM és antic i no envia `cam`, es cau al model vell.
- **Garantia**: amb la regla contain, **cap pantalla no veu mai menys que el DM**; una de format diferent veu **més** mapa als costats. Verificat sobre 1210 combinacions de mapa/finestra/zoom/pan.
- **El DM redimensiona**: el tick detecta el canvi de `W×H` i rebroadcasteja (throttle 120ms amb reintent: si es descarta l'enviament, `prevWH` NO s'actualitza i el frame següent hi torna, així la mida final sempre arriba).
- **HUD 🖥 (`CanvasHUD` → `ScreensChip`)**: les pantalles de jugador reporten la seva mida amb `VIEWPORT {id,w,h}` (en connectar, en redimensionar i cada 15s de heartbeat); el DM les desa a `rPlayerScreens` i oblida les que fa >50s que no diuen res. El xip mostra quantes n'hi ha i, al tooltip, quant de mapa veu **de més** cadascuna (`extraSeen`). El format de l'enquadrament es mostreja cada 700ms a l'estat `camAr` — **no llegir `rDmCam` durant el render** (és una ref que escriu el tick; el HUD no es refrescaria).

### Vista privada DM
- `Maj+scroll/drag` (toggle `rShiftPanToggle`): zoom i pan locals, **no** sincronitzats al jugador (no entren a `cam`)
- Refs: `dmLocalPan`, `dmLocalZoom` — animació de retorn suau (`dmPrivateReturnAnim`)

### Opacitat del fons (només DM)
- Control lliscant al `BottomControls` (sota el zoom) que abaixa l'**opacitat del mapa de fons NOMÉS a la pantalla del DM** (ajuda per veure clar sales/tokens/màgies quan hi ha molta informació). `rBgDmOpacity` (default 1) → el tick de `useRafLoop` fa `media.style.opacity`. Com que el fons és un element DOM darrere del canvas, abaixar-lo dim només la imatge del mapa; els overlays del canvas (sales, tokens, spells, dibuix) es mantenen nítids. **No es sincronitza**: els jugadors veuen sempre el fons opac.

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
| Codi nou penjat de `struct` | Apareix UI de PSD en un mapa només amb imatge (o a l'inrevés) | Usar `psdStruct` (o `!struct.synthetic`) per al que és exclusiu del PSD; `struct` només vol dir "hi ha mapa" |
| Sincronitzar càmera en píxels de pantalla | Els jugadors veuen un tros de mapa diferent del DM segons la mida/format de finestra | Enviar `cam` (coords de mapa) i traduir-lo a cada pantalla amb `camToView` |
| Llegir `rDmCam` dins del missatge en lloc de `_currentCam()` | El jugador es queda un pas de zoom/pan enrere | El ref l'escriu el tick un cop per frame; els handlers d'interacció envien abans del frame següent |
