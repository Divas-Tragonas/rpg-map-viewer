# RPG Map Viewer

Eina per a Dungeon Masters per gestionar mapes, tokens i jugadors en temps real.
El DM treballa en una pantalla i els jugadors veuen, en una altra (TV, tablet o mòbil), només el que el DM vol ensenyar-los.

**Live:** [https://rpg-map-viewer.vercel.app/](https://rpg-map-viewer.vercel.app/)

---

## Engegar-la

```bash
npm install
npm run dev   # http://localhost:3001
```

Obre `http://localhost:3001/` (DM) i, en una altra finestra o monitor, `http://localhost:3001/player` (jugadors).
Les dues finestres del mateix ordinador es sincronitzen soles; per a una tablet, veure [Tablet o mòbil](#tablet-o-mòbil-a-la-mateixa-wifi).

## Les pantalles

| URL | Per a qui | Què és |
|---|---|---|
| `/` | El DM | Tot el control: mapa, tokens, combat, sales, màgies |
| `/player` | Els jugadors | Només el que el DM mostra: mapa, tokens, torn, fitxa, diàlegs |
| `/admin` | El DM, fora de partida | Back office: enemics, fitxes de personatge (cal API) |
| `/expositor` | Un monitor de recanvi | Visor local d'un fitxer a pantalla completa (res a veure amb l'Expositor del DM) |

## Primer ús en 5 passos

1. **Obre un mapa.** A la pantalla de benvinguda: *Obrir mapa* (imatge o vídeo), *Provar la demo* o una *Missió*. També pots deixar-hi un fitxer a sobre.
2. **Prepara.** Interruptor **Preparar · Jugar** a la barra de dalt. A *Preparar* dibuixes parets, sales fosques, portes i llums, i calibres la graella.
3. **Col·loca les DIVAS i els enemics.** Lateral esquerre → *Escena* (jugadors i enemics) i *Biblioteca* (plantilles per afegir). Clic dret a un token = tota la seva fitxa.
4. **Obre una pantalla de jugador.** Menú **Pantalles** de la barra: obre una finestra al PC o copia l'adreça per a la tablet.
5. **Juga.** Passa a *Jugar*: mou tokens, inicia el combat (barra de torns de baix), llança màgies i, amb **Mostrar als jugadors**, ensenya imatges, text, diàlegs o fitxes. **Ctrl+Z** desfà l'última acció i **?** mostra totes les dreceres.

Tot es desa sol cada 30 s al navegador; el menú **Partida** exporta o carrega una partida.

## Per saber-ne més

- **[`docs/`](docs/README.md)** — documentació tècnica per àrea (arquitectura, sincronització, interfície, combat, sales, píxel, màgies…).
- **[`CHANGELOG.md`](CHANGELOG.md)** — historial de versions.
- **[`CLAUDE.md`](CLAUDE.md)** — regles de treball del repositori (git, versions, canvis a la API).
- **[`api-spec.txt`](api-spec.txt)** — contracte amb la API (`divas_tragonas_api`).

---

## Configuració

### Tablet o mòbil a la mateixa wifi

Setup típic: el PC del DM amb dos monitors (vista DM + vista jugadors) i una tablet
dels jugadors, tots a la mateixa xarxa wifi. La sincronització entre finestres del
mateix PC va per `BroadcastChannel`; cap a la tablet va per WebSocket a través de la
API (`divas_tragonas_api`, endpoint `/sync` al port 3000).

1. **Al PC del DM**: arrencar la API (port 3000) i l'app (`npm run dev`, port 3001).
2. **Trobar la IP LAN del PC** (`ipconfig` a Windows / `ip addr` a Linux), p. ex. `192.168.68.102`.
3. **`next.config.ts` no s'ha de tocar**: `allowedDevOrigins` es calcula sol a partir
   de les IPv4 de les interfícies del PC i inclou els rangs privats habituals
   (`192.168.*.*`, `10.*.*.*`, `172.16–31.*.*`). Next 16 bloqueja l'accés cross-origin
   al dev server i, si l'origen no hi és, la tablet o el mòbil es queden amb una
   pàgina en blanc; abans calia escriure-hi la IP a mà i tornar-la a canviar cada cop
   que el router en donava una de nova.
4. **Monitors del PC**: `http://localhost:3001/` (DM) i `http://localhost:3001/player` (jugadors).
5. **Tablet**: obrir `http://[IP-del-PC]:3001/player` al navegador. No cal buscar la IP: el menú
   **Pantalles** de la barra superior del DM la mostra, amb un botó per copiar-la.

La tablet dedueix automàticament l'adreça del WebSocket a partir de la URL amb què
ha carregat la pàgina — no cal configurar `NEXT_PUBLIC_API_URL` per a l'ús en LAN.
Si la connexió cau (wifi inestable), el client es reconnecta sol cada 2 s i demana
l'estat complet al DM en tornar.

> ⚠️ **Des del mòbil, obre l'adreça del PC del DM (`http://[IP-del-PC]:3001/player`),
> no el desplegament públic de Vercel.** La pàgina de Vercel va per `https` i el PC del
> DM per `http`: el navegador bloqueja la connexió (contingut mixt) i la pantalla es
> queda per sempre a "Esperant al Dungeon Master...". Ara la mateixa pantalla ho diu.

## App Píxel (sprites Oryx «Ultimate Fantasy»)

Interruptor **Clàssica · Píxel** al menú **⋯** de la barra superior (i a la pantalla de benvinguda). L'app Píxel pinta els tokens com a
figuretes animades, té un editor de mapes per caselles i fa servir els gràfics del paquet
Oryx a les màgies i al rètol de torn (també a les pantalles de jugador).

Els fulls del paquet són a `public/sprites/` i cada pantalla els carrega sola: no cal importar res.
Els fulls generats (`uf_heroes_v1/v2.png`, `uf_terrain_themes.png`, `uf_village.png`) surten dels scripts de `scripts/`.
El manifest de noms i posicions (`src/lib/sprites/manifest.ts`) es regenera amb
`python3 scripts/oryx-manifest.py /camí/al/paquet/descomprimit` (Pillow + numpy).
Detall tècnic: [`docs/pixel-i-missions.md`](docs/pixel-i-missions.md).
