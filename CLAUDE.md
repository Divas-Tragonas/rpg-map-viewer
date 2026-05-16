# RPG Map Viewer — CLAUDE.md

> **INSTRUCCIÓ OBLIGATÒRIA:** Llegir aquest fitxer sencer abans de fer qualsevol canvi.
> Actualitzar aquest CLAUDE.md sempre que s'afegeixi o canviï una funcionalitat.

---

## ⚡ SETUP OBLIGATORI AL INICI DE CADA SESSIÓ

El proxy git de la sessió no té permisos d'escriptura a GitHub. **Fer això abans del primer push:**

```bash
git remote set-url origin https://Divas-Tragonas:TOKEN@github.com/Divas-Tragonas/rpg-map-viewer.git
```

**On trobar el TOKEN** (PAT de Divas-Tragonas, scope `repo`):
```bash
grep -o "github_pat_[A-Za-z0-9_]*" /root/.claude/projects/-home-user-rpg-map-viewer/*.jsonl | head -1
```

Si el push falla amb `Permission denied to devevalles` → és sempre aquest problema.

---

## Versió actual: v2.20

Cada vegada que facis un canvi al codi, actualitza **sempre**:
1. `// Versió: vX.Y` (comentari dins `<script>`, prop del inici)
2. `RPG Map Viewer vX.Y` (string visible dins l'app, a la secció "Sobre")
3. La línia **"Versió actual"** d'aquest CLAUDE.md
4. El `README.md` — afegir entrada al Changelog amb punts breus

Si no actualitzes la versió, el canvi és invàlid.

---

## Git workflow

- **Sempre push directe a `master`** — mai crear branches ni pull requests
- El fitxer principal es diu `rpg-map-viewer.html`
- Commit i push després de cada canvi:
  ```bash
  git add rpg-map-viewer.html CLAUDE.md README.md
  git commit -m "vX.Y — Títol del canvi"
  git push origin master
  ```

---

## Stack

| Element | Detall |
|---|---|
| Format | Un únic fitxer `.html` autocontingut, sense build step |
| UI | React 18 via CDN + Babel Standalone (compila JSX en runtime) |
| Render | Canvas 2D API |
| Fons | Element DOM `<img>` o `<video>` posicionat absolutament darrere del canvas |
| Sync | `BroadcastChannel` — DM envia, Jugador rep |
| PSD | Parser propi (binary, sense dependències) |

---

## Arquitectura general

```
RPGMapViewer (component React)
│
├── State (useState) + Refs mirall (useRef)   →  veure "Patró state↔ref"
├── BroadcastChannel setup (useEffect)        →  DM→Jugador sync
├── RAF render loop (useEffect)               →  tick() + render phases
└── Event handlers (useCallback)             →  zoom, pan, drag, draw...

Fora del component (nivell de mòdul):
├── Constants: CONDITIONS, ELEMENTS, PALETTE, SPELL_TYPES
├── Lookup maps: CONDITIONS_BY_ID, ELEMENTS_BY_ID  (O(1), no Array.find)
├── Token LERP: TOKEN_LERP = 0.07
├── Helpers: drawFlatZone, drawPaintedZone, drawConditionBadges,
│            drawSpellFireball, drawSpellLightning, drawSpellMagicBeam,
│            replayStroke, txFBM, txNoise, txWorley... (textures)
└── Render phases: renderZoneOverlays, renderExtras, renderPaintedZones,
                   renderShapePreview, advanceStrokeAnim, renderSpells,
                   renderEnemyTokens, renderPlayerTokens,
                   renderGrid, renderGridCalib, renderDMPointer
```

---

## Render loop — tick()

`tick()` és una funció minimalista que:

1. Resize del canvas i obtenció del `ctx`
2. Càlcul de `s, v, pp, isDM, media, mw, mh`
3. Animació de retorn vista privada DM
4. Càlcul de `z, pan, sc, ox, oy`
5. Update posició DOM del fons (`prevBgStyle` per evitar thrashing)
6. `if (!s) return` — res a renderitzar sense PSD
7. **Construcció de `fc`** (frame context)
8. `ctx.save() / translate(ox,oy) / scale(sc,sc)`
9. Crida a les render phases (en ordre)
10. `ctx.restore()`
11. `renderGrid / renderGridCalib / renderDMPointer` (espai pantalla)

### Frame Context (fc)

Objecte construït una vegada per frame dins `tick()` i passat a totes les render phases:

```js
const fc = {
  sc, ox, oy, mw, mh, isDM, s, v, pp,
  rLayerImages, rHoveredZone, zoneAnimRef,
  rPaintedZones, rContextMenu, zoneAppearRef, txCache,
  isShapeDrawingRef, shapePointsRef,
  activeStrokeAnim, strokeQueueRef, drawCanvasRef,
  rActiveSpells, setActiveSpells,
  rConditions, rDefeated, rDeathCanvas,
  defeatedAnimRef, invisAlphaRef,
  rEnemyHighlight, rHighlightAlpha, rHighlightLocked, highlightStartRef,
  visualPosRef, rPlayers, rTokenSizeOverride,
  rGridVisible, rGridSize, rGridLineWidth, rGridOriginX, rGridOriginY,
  rGridCalibrating, rGridDmAlpha,
  gridCalibRef, gridCalibCurrRef, gridCalibHoverRef,
  rPointerPos, rSelectedToken,
};
```

---

## Render phases — com afegir-ne una de nova

Les render phases viuen a **nivell de mòdul**, just abans de `function RPGMapViewer()`. Reben `ctx` i `fc`.

```js
function renderFog(ctx, fc) {
  const { sc, ox, oy, isDM, rGridSize } = fc;
  // ...
}
// Cridar-la dins tick(), entre ctx.save() i ctx.restore()
```

**Regles crítiques:**
- Mai definir funcions amb `function` dins un `useEffect` — Babel no les resol
- Sempre destructurar tots els refs usats de `fc` — si no, silentfail sense render
- Si el ref no és a `fc{}`, afegir-lo a l'objecte `fc` de `tick()` i destructurar

---

## Render phases existents

| Funció | Descripció |
|---|---|
| `renderZoneOverlays` | Zones DM/jugador: visibilitat, fade, eye-icon, etiquetes |
| `renderExtras` | Capa "extras" sempre visible sobre el mapa base |
| `renderPaintedZones` | Zones màgiques: textures animades (jugador) / flat (DM) |
| `renderShapePreview` | Preview del shape tool al DM |
| `advanceStrokeAnim` | Reprodueix traços de dibuix al jugador frame a frame |
| `renderSpells` | Animacions de spells: fireball, lightning, magic_beam |
| `renderEnemyTokens` | Tokens enemics: drag, LERP, condicions, derrota, invisibilitat |
| `renderPlayerTokens` | Tokens jugador: LERP, condicions |
| `renderGrid` | Grid overlay (alpha fade al DM, sempre visible al jugador) |
| `renderGridCalib` | Calibració visual del grid (DM) |
| `renderDMPointer` | Cursor del DM visible al jugador |

---

## Patró state ↔ ref

Cada valor d'estat té **dos** contenidors:

```js
const [vis, setVis] = useState({});   // ← React (triggers re-render, UI)
const rVis = useRef({});              // ← ref mirall (lectura O(1) dins tick)
```

**Regla:** Quan modifiques un estat, actualitza sempre `setState` i el `ref` corresponent. Mai usar `useState` dins `tick()`.

L'efecte de sincronització manté els refs al dia (un sol `useEffect` amb totes les deps).

---

## BroadcastChannel — sincronització DM→Jugador

| Tipus missatge | Direcció | Contingut |
|---|---|---|
| `STRUCT` | DM→Jugador | Estat complet (connexió inicial) |
| `STATE` | DM→Jugador | Delta d'estat (interaccions) |
| `BG` | DM→Jugador | Buffer de la imatge/vídeo de fons |
| `STROKE` | DM→Jugador | Traç de dibuix (reproducció animada) |
| `CLEAR_DRAW` | DM→Jugador | Netejar canvas de dibuix |
| `UNDO_DRAW` | DM→Jugador | Desfer + reapplicar historial |
| `POINTER` | DM→Jugador | Posició del cursor DM |
| `SPELL` | DM→Jugador | Inici d'animació de spell |
| `BOSS_INTRO` | DM→Jugador | Cinematica boss reveal |
| `PLAYER_READY` | Jugador→DM | Sol·licita estat complet |

`_broadcastState(extra)` envia `STATE` amb tot l'estat rellevant. Cridar-la sempre que canviï alguna cosa que el jugador hagi de veure.

**Quan s'afegeix un nou estat sincronitzat**, cal actualitzar en 3 llocs:
1. `_broadcastState` → afegir al missatge `STATE`
2. `_sendFullState` → afegir al missatge `STRUCT`
3. Handler del jugador → processar tant `STRUCT` com `STATE`

---

## Funcionalitats principals

### Grid i tokens
- Grid configurable: mida, origen, gruix de línia
- **Snap**: `rGridSnap` — snapa tokens al centre de cel·la en moure i en activar
- **Mida** (`gridAutoSize`): `rTokenSizeOverride` — map `{tokenId: R}` que escala tokens al 90% de la cel·la
  - `sizeAllTokens()` recalcula tots els tokens actuals
  - Nous jugadors hereden la mida si `rGridAutoSize.current` és true
  - Override s'envia via `STATE` i `STRUCT`; render usa `rTokenSizeOverride.current[id] ?? defaultR`

### Tokens enemics
- R calculat: `Math.max(Math.min(en.w, en.h) / 2, 22)` (o override)
- Imatge escalada a `drawW × drawH` on `drawW = hasOverride ? R*2 : en.w`
- Condicions, derrota (animació de desaturació), invisibilitat, highlight

### Tokens jugador
- R per defecte: 22 (o override)
- Posició: `pos[pl_${id}]` — esquina superior-esquerra del quadrat R×R

### Cinematica boss reveal
- `triggerBossIntroRef` → funció per llançar la cinematica
- `BOSS_INTRO` BC message inclou `portraitDataUrl` (JPEG base64, max 600px)
- `SceneImgPicker` component per importar imatge custom al popup de context menu

### PSD Import
- Parser binari a `parsePSDStructure(buffer)`
- Grups esperats: `zones`, `enemies`, `extras`
- Imatges per capa a `rLayerImages.current` (canvas elements)

### Zones màgiques (Painted Zones)
- Polígons amb element: `ELEMENTS` (fire, ice, water, lightning, poison, magic)
- Textures procedurals animades al jugador (`txFBM`, `txWorley`...)

### Spells
- `rActiveSpells.current`: `{id, type, points, startTime}`
- Tipus: `fireball`, `lightning`, `magic_beam`

### Dibuix
- Canvas separat (`drawCanvasRef`), historial per undo
- Traços enviats al jugador com a animació frame a frame

### Vista privada DM
- `Ctrl+scroll/drag`: zoom i pan locals, no sincronitzats
- `dmLocalPan`, `dmLocalZoom` (useRef, no state)

---

## Errors comuns a evitar

| Error | Símptoma | Causa | Fix |
|---|---|---|---|
| Ref no destructurada de `fc` | Render phase no dibuixa res | TypeError silenciós | Afegir al `const { ... } = fc` |
| `function` dins `useEffect` | Tot el canvas en blanc | Babel Standalone no ho resol | Sempre a nivell de mòdul |
| Ref nou no afegit a `fc{}` | `undefined` a la fase | Oblidat a l'objecte `fc` | Afegir a `fc{}` i destructurar |
| `setState` sense ref mirall | UI actualitzada, render no | `tick()` llegeix refs, no state | Actualitzar sempre els dos |
| Nou estat no afegit a STRUCT | Jugador no rep l'estat en connectar | Oblidat a `_sendFullState` | Afegir a STRUCT i al seu handler |
| Versió no actualitzada | Confusió entre versions | — | Actualitzar comentari + app + CLAUDE.md |
