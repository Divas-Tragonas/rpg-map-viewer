# RPG Map Viewer — Instruccions per a Claude Projects

## Repositori
- **GitHub:** https://github.com/Divas-Tragonas/rpg-map-viewer
- **Directori local:** `C:\Users\david\Desktop\rpg-map-viewer-v2_7\`
- **Fitxers principals:** `rpg-map-viewer-v2_7.html` · `CLAUDE.md`

---

## Regles obligatòries en CADA canvi

### 1. Actualitzar la versió (dins l'HTML)
Cada canvi incrementa el número de versió menor (v2.7 → v2.8 → v2.9...).
Cal actualitzar-lo a **tres llocs** dins el fitxer HTML:

```
<title>RPG Map Viewer vX.Y</title>          ← dins <head>
// Versió: vX.Y                              ← comentari dins <script>
<!-- Versió actual del fitxer: vX.Y -->      ← comentari inicial del fitxer
```

### 2. Pujar a GitHub
Després de cada canvi, sempre:

```bash
cd ~/Desktop/rpg-map-viewer-v2_7
git add rpg-map-viewer-v2_7.html
git commit -m "vX.Y — Títol del canvi"
git push
```

Si el CLAUDE.md del repo també canvia, afegir-lo al commit:
```bash
git add rpg-map-viewer-v2_7.html CLAUDE.md
```

### 3. Missatge de commit — format
```
vX.Y — Resum breu (una línia)

- Canvi 1
- Canvi 2
- Canvi 3

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

El resum ha de ser **títols curts**, sense explicacions llargues.

---

## Què és aquest projecte

App HTML autocontinguda (un sol fitxer, sense build) per a sessions de rol de taula.
Dues finestres: **DM** (Dungeon Master) i **Jugador**, sincronitzades via `BroadcastChannel`.

**Funcionalitats principals:**
- Import de `.psd` per gestionar capes (zones, enemics, extras)
- Tokens d'enemics i jugadors arrossegables
- Zones d'ocultació amb fade animat (jugador) / toggle (DM)
- Zones màgiques pintades amb textures procedurals (foc, gel, aigua, verí, llamp, màgia)
- Hechizos animats: fireball, lightning, magic_beam
- Eina de dibuix amb historial i undo
- Grid configurable amb calibració visual
- Condicions D&D 5e per token
- Vista privada del DM (Ctrl+scroll)
- Expositor de campanya integrat (iframe en base64)

**Stack:** React 18 CDN + Babel Standalone + Canvas 2D API

---

## Arquitectura clau

| Element | Detall |
|---|---|
| Render | RAF loop → `tick()` → render phases a nivell de mòdul |
| Sync DM→Jugador | `BroadcastChannel` ('rpg_map_sync_v18') |
| State | `useState` + `useRef` mirall per a cada valor |
| Imatges | Canvas elements extrets del PSD, cacheats com data-URLs |
| Textures | Funcions procedurals: `txFBM`, `txWorley`, `txRidgedFBM`... |

**Render phases (ordre):**
`renderZoneOverlays` → `renderExtras` → `renderPaintedZones` → `renderShapePreview` → `advanceStrokeAnim` → `renderSpells` → `renderEnemyTokens` → `renderPlayerTokens` → `renderGrid` → `renderGridCalib` → `renderDMPointer`

**Per afegir una render phase nova:**
1. Definir `function renderX(ctx, fc)` a nivell de mòdul (mai dins `useEffect`)
2. Afegir els refs necessaris a `fc{}` dins `tick()`
3. Cridar `renderX(ctx, fc)` a `tick()` en l'ordre correcte

---

## Fitxer de referència tècnica completa
El `CLAUDE.md` del repositori conté la documentació tècnica completa (patró state→ref, BroadcastChannel, errors comuns, etc.).
Llegir-lo sempre abans de fer canvis complexos.

---

## Workflow típic d'una sessió

```
1. Llegir CLAUDE.md del repo si el canvi és complex
2. Editar rpg-map-viewer-v2_7.html
3. Actualitzar versió (títol + comentari script + comentari inicial)
4. git add + git commit (format: "vX.Y — Títol") + git push
5. Si cal, actualitzar CLAUDE.md del repo i fer-ho al mateix commit
```
