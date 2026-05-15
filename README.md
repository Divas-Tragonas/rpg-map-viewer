# RPG Map Viewer

**[▶ Obrir l'app](https://divas-tragonas.github.io/rpg-map-viewer/rpg-map-viewer-v2_7.html)**

App HTML autocontinguda per a sessions de rol de taula. Dues finestres: **DM** i **Jugador**, sincronitzades en temps real via BroadcastChannel.

---

## Changelog

### v2.11
- Nova opció "Mida" al costat del Snap: ajusta tots els tokens (enemics i jugadors) al 90% de la cel·la del grid
- Els nous tokens de jugador creats amb Mida actiu hereden la mida del grid automàticament
- En re-calibrar el grid amb Mida actiu, es recalcula la mida de tots els tokens
- La mida override es sincronitza al jugador via BroadcastChannel

### v2.10
- Scene Engine: boss reveal cinematogràfic — portrait centrat, títol gran, parallax, impact frame, partícules
- Popup "⚡ Escena" al context menu amb importació d'imatge personalitzada (drag & drop o clic)
- Letterbox, vignette, dim overlay, flash blanc d'impacte + segon flash daurat
- Camera zoom cap al token, suavitzat sense jitter
- ESC per saltar l'escena; sincronització al jugador via BroadcastChannel

### v2.9
- Botons importar imatge i PSD ara side by side i més compactes
- Box d'avisos de capes faltants: es tanca sol als 10s, X centrada
- Expositor sincronitzat al jugador (quan el DM canvia de pestanya, el jugador ho veu)
- Mover zones màgiques: Ctrl+drag amb eina de forma (ja existent, confirmat funcional)
- Stepper de Celda i Línia del grid: salts d'1px i 0.1px, posats un al costat de l'altre
- Token seleccionat: anell blau animat al mapa; clicar token al panell de capes també el selecciona
- Versió visible dins l'app (v2.9); títol de la finestra sense número de versió

### v2.8
- Auto snap de tots els tokens al grid en activar el checkbox Snap
- Auto snap en finalitzar la calibració del grid (si Snap actiu)
- La posició snapped es sincronitza al jugador automàticament

### v2.7
- Versió inicial publicada
