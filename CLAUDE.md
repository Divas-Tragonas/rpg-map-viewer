# RPG Map Viewer — CLAUDE.md

> **INSTRUCCIÓ OBLIGATÒRIA:** Llegir aquest fitxer sencer abans de fer qualsevol canvi.
> Actualitzar aquest CLAUDE.md sempre que s'afegeixi o canviï una funcionalitat.

---

## Versió actual: v2.10

Cada vegada que facis un canvi al codi, actualitza **sempre**:
1. `<title>RPG Map Viewer vX.Y</title>` (dins `<head>`)
2. `// Versió: vX.Y` (comentari dins `<script>`, prop del inici)
3. La línia **"Versió actual"** d'aquest CLAUDE.md
4. El `README.md` — afegir entrada al Changelog amb punts breus del que s'ha canviat

Si no actualitzes la versió, el canvi és invàlid.

### Git workflow (obligatori)
- **Sempre push directe a `master`** — mai crear branches ni pull requests
- Commit i push després de cada canvi:
  ```bash
  git add rpg-map-viewer-v2_7.html CLAUDE.md README.md
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

`tick()` és una funció minimalista (~138 línies) que:

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
11. Update `rGridDmAlpha` (inline, necessita `dragRef` local)
12. `renderGrid / renderGridCalib / renderDMPointer` (espai pantalla)

### Frame Context (fc)

Objecte construït una vegada per frame dins `tick()` i passat a totes les render phases:

```js
const fc = {
  // Per-frame computed
  sc, ox, oy, mw, mh, isDM, s, v, pp,
  // Zones
  rLayerImages, rHoveredZone, zoneAnimRef,
  rPaintedZones, rContextMenu, zoneAppearRef, txCache,
  // Drawing tools
  isShapeDrawingRef, shapePointsRef,
  activeStrokeAnim, strokeQueueRef, drawCanvasRef,
  // Spells
  rActiveSpells, setActiveSpells,
  // Enemy tokens
  rConditions, rDefeated, rDeathCanvas,
  defeatedAnimRef, invisAlphaRef,
  rEnemyHighlight, rHighlightAlpha, rHighlightLocked, highlightStartRef,
  visualPosRef,
  // Player tokens
  rPlayers,
  // Grid
  rGridVisible, rGridSize, rGridLineWidth, rGridOriginX, rGridOriginY,
  rGridCalibrating, rGridDmAlpha,
  gridCalibRef, gridCalibCurrRef, gridCalibHoverRef,
  // Pointer
  rPointerPos,
};
```

---

## Render phases — com afegir-ne una de nova

Les render phases viuen a **nivell de mòdul**, just abans de `function RPGMapViewer()`. Reben `ctx` i `fc`. El cos de la funció destrutura el que necessita.

```js
// 1. Definir la funció (nivell de mòdul, abans de RPGMapViewer)
function renderFog(ctx, fc) {
  const { sc, ox, oy, isDM, rGridSize } = fc;
  // ... codi de render ...
}

// 2. Si necessita un ref que no és a fc{}, afegir-lo:
//    a) A fc{} dins tick()
//    b) Al destructuring de la funció

// 3. Cridar-la a tick() en l'ordre correcte
renderFog(ctx, fc);  // dins tick(), entre ctx.save() i ctx.restore()
```

**Regla crítica:** Mai definir funcions amb `function` dins un `useEffect`.
Babel Standalone no les resol correctament en aquest context.

**Regla crítica:** Sempre destructurar tots els refs que s'usen.
Si un ref s'usa al cos però no està al `const { ... } = fc`, llença un error silenciós i la fase no renderitza res.

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

L'efecte de sincronització (un sol `useEffect` amb totes les deps) manté els refs al dia:

```js
useEffect(() => {
  rVis.current = vis;
  // ... tots els altres refs ...
}, [vis, pos, zoom, ...]);
```

**Regla:** Quan modifiques un estat, actualitza sempre `setState` i el `ref` corresponent. Mai usar `useState` dins `tick()`.

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
| `PLAYER_READY` | Jugador→DM | Sol·licita estat complet |

`_broadcastState(extra)` — funció `useCallback` al component. Envia `STATE` amb tot l'estat rellevant. Cridar-la sempre que canviï alguna cosa que el jugador hagi de veure.

---

## Funcionalitats principals

### PSD Import
- Parser binari propi a `parsePSDStructure(buffer)`
- Estructura esperada: grups `zones`, `enemies`, `extras` (validat per `validateStructure`)
- Extreu imatges per capa a `rLayerImages.current` (canvas elements)
- Genera URLs per a la transmissió BC

### Zones (DM/Jugador)
- Visibilitat per zona: `vis[id]` boolean
- Fade animat al jugador: `zoneAnimRef.current[id]` (0→1 / 1→0, LERP 0.07)
- DM veu totes amb indicador visual (eye icon al hover)
- Zones bloquejables: `zonesLocked` evita canvis accidentals

### Tokens enemics
- Definits a l'estructura PSD (grup `enemies`)
- Posició: `pos[id]` — DM arrossega, jugador interpola (TOKEN_LERP)
- Condicions D&D 5e: `conditions[id]` → array d'IDs
- Derrota: `defeated[id]` → animació de desaturació
- Invisibilitat: `invisAlphaRef` (fade alpha)
- Highlight: `enemyHighlight` + `rHighlightAlpha`

### Tokens jugador
- Definits a `players` (array d'objectes `{id, name, color, icon}`)
- Posició: `pos[pl_${id}]`
- Condicions igual que enemics

### Zones màgiques (Painted Zones)
- Polígons amb element assignat: `ELEMENTS` (fire, ice, water, lightning, poison, magic)
- DM: flat color + highlight en context menu
- Jugador: textura procedural animada (`txFBM`, `txWorley`...) amb cache temporal
- `zoneAppearRef` → glow d'aparició

### Spells
- `rActiveSpells.current`: array de `{id, type, points, startTime}`
- Tipus: `fireball`, `lightning`, `magic_beam`
- Durades i colors a `SPELL_DUR` / `SPELL_COL` dins `renderSpells`

### Grid
- Configurable: mida, origen, gruix de línia
- DM: visible només en arrossegar un token (alpha fade via `rGridDmAlpha`)
- Jugador: sempre visible quan activat
- Mode calibració: drag per definir mida de cel·la (`gridCalibRef`)
- Snap: `rGridSnap` (usat en event handlers, no en render)

### Dibuix
- Eina de llapis i goma al DM
- Traços enviats al jugador com a animació frame-a-frame (`STROKE` BC)
- Canvas de dibuix separat (`drawCanvasRef`), compositat sobre el principal
- Historial per a undo

### Vista privada DM
- `Ctrl+scroll/drag`: zoom i pan locals del DM, no sincronitzats
- `dmLocalPan`, `dmLocalZoom` (useRef, no state)
- Animació de retorn en soltar Ctrl: `dmPrivateReturnAnim`

### Expositor
- App secundària embeguda en base64 dins el HTML
- Muntada lazy com a `<iframe>` en primer accés

---

## Constants a nivell de mòdul

Per afegir una condició, element màgic o altre constant:

```js
// Afegir a l'array corresponent — res més a tocar
const CONDITIONS = [
  { id: 'blinded', label: 'Encegat', color: '#aaa', ... },
  // ...
];

const ELEMENTS = [
  { id: 'fire', label: 'Foc', color: '#ff6600', ... },
  // ...
];
```

Els lookup maps `CONDITIONS_BY_ID` i `ELEMENTS_BY_ID` es generen automàticament.

---

## Errors comuns a evitar

| Error | Símptoma | Causa | Fix |
|---|---|---|---|
| Ref no destructurada de `fc` | Render phase no dibuixa res | `ref.current` llença TypeError silenciós | Afegir al `const { ... } = fc` |
| `function` dins `useEffect` | Tot el canvas en blanc | Babel Standalone no ho resol | Sempre a nivell de mòdul |
| Ref nou no afegit a `fc{}` | `undefined` a la fase | Oblidar-lo a l'objecte `fc` de `tick()` | Afegir a `fc{}` i destructurar |
| `setState` sense ref mirall | UI actualitzada, render no | `tick()` llegeix refs, no state | Actualitzar sempre els dos |
| Versió no actualitzada | Confusió entre versions | — | Actualitzar títol + comentari + CLAUDE.md |
