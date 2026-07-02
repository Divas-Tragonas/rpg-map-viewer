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

Tots els tipus estan definits a `BCMessage` a `src/types/index.ts`.

**Dieta del `STATE`** (`_broadcastState` a `useDMActions.ts`): els camps pesats (`players`, `conditions`, `defeated`, `paintedZones`, `tokenSizeOverride`, `libEnemies`, `psdEnemyOverrides` — poden portar imatges base64) només s'inclouen al missatge quan la seva **referència** ha canviat des de l'últim enviament (`lastSentHeavyRef`). Per això és crític que tota mutació d'aquests valors creï un objecte/array **nou** (mai mutar in place) i que el jugador els tracti com a camps opcionals. Els broadcasts de pan/zoom (compartit i privat) i l'animació de retorn de vista privada van throttled a ~20Hz amb enviament final garantit — el jugador suavitza amb LERP, així que es veu fluid igualment.

**Quan s'afegeix un nou estat sincronitzat**, actualitzar en 3 llocs:
1. `BCStateMessage` o `BCStructMessage` a `types/index.ts`
2. `_broadcastState` a `useDMActions.ts` → missatge `STATE` (si és un camp pesat, afegir-lo a `heavy` i a `_syncHeavySent`)
3. `_sendFullState` → missatge `STRUCT` + handler al jugador

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

### Moviment de tokens des de la pantalla de jugador (`usePlayerTokenDrag`)
- `src/hooks/usePlayerTokenDrag.ts` — drag de tokens al canvas de `/player` amb **pointer events** (ratolí, dit i stylus unificats; `touch-action: none` al canvas + `setPointerCapture`).
- **Només tokens de jugador** (`pl_*`): el hit-test ignora enemics PSD i de biblioteca, i el DM també descarta qualsevol `TOKEN_MOVE` que no comenci per `pl_` (BC i WS).
- Tolerància tàctil més gran amb el dit (`pointerType === 'touch'` → slop 16px vs 4px de ratolí). Un sol drag actiu (es guarda el `pointerId`; la resta de tocs s'ignoren).
- En deixar anar, envia `TOKEN_MOVE` per BC **i** WS. Mentre es arrossega: el token segueix el dit sense LERP (`renderPlayerTokens` snapeja si `rSelectedToken === key`) i el handler de `STATE` del jugador conserva la posició local del token arrossegat perquè un broadcast del DM no el faci saltar enrere.

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
