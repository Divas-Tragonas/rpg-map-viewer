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

## Lot B — Tokens (render i interacció)

Decisions de l'usuari: ombra al centre de la cel·la (la figura la trepitja); fix mínim a `useDMActions` (radi ↔ posició dels jugadors); el «submenú» és `ContextMenuOverlay`; la tasca 4 queda per després.

- [x] 1. Halos: jerarquia (v4.79 amb claudàtors; a la v4.80 tornen a ser tres anells, veure Ronda 2)
- [x] 2. Centroide: ombra i peus de la figura al centre de la cel·la; figura centrada pel seu contingut real (bbox alfa, per sprite); ombra dels discos concèntrica
- [x] 2b. `sizeAllTokens` / reset d'AutoSize compensen la posició dels jugadors (cantonada + R)
- [x] 3a. Hit-test únic (`lib/render/token-geom.ts`) en ordre z visual; el seleccionat es pinta i es clica a sobre
- [x] 3b. Tokens apilats: s'obren en passar-hi per sobre (offset visual, animat al rAF), tolerància `TOKEN_STACK_TOL`
- [ ] 4. Colors i textures del grup — **ajornat** per l'usuari
- [x] 5. Menú del token (`ContextMenuOverlay`) al costat del token, centrat verticalment i dins la pantalla
- [x] Verificació: tsc + lint + captures (1, 2 apilats, 5 junts, vora, zoom)
- [x] CHANGELOG + APP_VERSION + docs

### Ronda 2 (v4.80, comentaris del DM)
- [x] Halos: tornen a ser tres anells (selecció blava discontínua de sempre), cadascun al seu carril a distància fixa de l'ombra/vora
- [x] Peus i ombra una mica per sota del centre de la casella (`FOOT_DROP` 0,3·R)
- [x] Salt en canviar la mida d'un jugador (pantalla de jugador: LERP de la cantonada) corregit
- [x] Ventall: espera de 0,4 s i augment del token assenyalat
- [x] Menú: Dades, Conjurs, Estats, Parla, Nivell

### Fora d'abast (anotat, no tocat)
- El menú no segueix el token si canvia de mida (capsa del moment d'obrir-lo).
- `usePlayerTokenDrag` (pantalla de jugador) té el seu propi hit-test circular: no fa servir el nou `token-geom` (no agafa el cap de les figuretes).
- La selecció per marquee (`useMouseHandlers`, `inside(...)`) llegeix els centres a mà; funciona, però podria passar per `tokenSlots(R, false)`.
- `selectAndArmDrag` afegeix el token a la selecció múltiple encara que només n'hi hagi un de seleccionat (clic a A i després a B → tots dos seleccionats). Comportament previ; revisar si és volgut.
- Les figuretes es pinten en ordre d'array, no per Y: en una vista 3/4, la de més avall hauria de tapar la de dalt. Canviar-ho també canviaria l'ordre z del hit-test.
- Al tàctil no hi ha hover: el ventall dels apilats no s'obre (es podria obrir amb un toc llarg).
