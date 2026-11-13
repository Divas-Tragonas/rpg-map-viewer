# Paquets de decorat en pixel art (`assets/decor-packs/`)

Objectes i decorat nous per als mapes que va passar el propietari a la v5.23 (`Downloads.zip`),
**sencers**: fulls, fitxers solts, guies, mostres i GIF, amb els noms de fitxer originals (només
s'han canviat els noms de les carpetes de dalt i s'ha tret un nivell de carpeta repetit al Tiny
Dungeon). **No es serveixen**: no són a `public/`.

**A l'app (v5.24)**: `scripts/decor-packs.py` en treu la tria al full `public/sprites/decor_packs.png`
i a `src/lib/tilemap/packs.ts` (paleta de Caselles: Objectes → Cofres, Gerres, Bosc; Botí → Objectes
petits; Decorat → Gerres trencades). **La mida del píxel no es toca**: l'art va a 1× i, si és més
petit que la casella de 48 px, queda al mig amb aire al voltant. Mides de l'art: Gentle Forest
(objectes de 32 px, arbres de 80×96), gerres i cofres en cel·les de 32 px, Tiny Dungeon de 16 px.
Una peça nova: afegir-la **al final** de `PIECES` del script i tornar-lo a executar.

⚠️ **Llicències (el repositori és públic).** El propietari va decidir pujar-los sencers igualment,
com els `fx-packs/` i els sprites Oryx. Abans de publicar l'app fora de la colla, revisar-ho:
- **Tiny Dungeon Items Pack** (Pixel-Deck, `tiny-dungeon-items/README.txt`): ús personal i comercial,
  es poden modificar; **no es pot redistribuir el paquet sencer sense canvis** ni revendre'l.
  Crèdit opcional: «Pixel Art Assets by Pixel-Deck.com».
- **Gentle Forest, Treasure Chests, Breakable Pots** (Seliel the Shaper, sèrie Mana Seed): el `.zip`
  no porta llicència. Comprovar les condicions a la pàgina de l'autor (itch.io `seliel-the-shaper`).
  Gentle Forest és la descàrrega gratuïta ($0): tres paletes, v01 «rabite forest», v02 «jungle of
  illusion», v03 «moonlight forest».

| Carpeta | Paquet original | Què hi ha |
|---|---|---|
| `gentle-forest/` | 19.07a – Gentle Forest 3.0a ($0 palettes) | Bosc: herba, camins, aigua, penya-segats, soques, troncs, roques, matolls, flors, arbres de 80×96, cascada i espurnes d'aigua animades; tres paletes (v01–v03) i còpies ja ampliades a 48 px (`48x48 resize/`) |
| `treasure-chests/` | 19.07c – Treasure Chests 1.2a | Cofres de 32 px: 5 models × 3 colors, tancats i oberts (files alternes) |
| `breakable-pots/` | 20.05b – Breakable Pots 1.1a | Gerres (graella de 16 px, petites i grans) i els trossos quan es trenquen: `breakable pots.png` amb quatre colors i un full per a cada color (gris, vermell, blanc, groc) |
| `oryx-style/` | Art propi (v5.26), `scripts/oryx-style-props.py` | 150 peces de 48 px (taules llargues 144×48, llits 48×96) dibuixades per codi a l'estil Oryx (48 px natius, detall d'1 px, tons plans; `preview.png` les ensenya al costat de les de l'autor): mobles, caixes, bótes, sacs, gerros, cofres grans, monedes i tresor, i (v5.30) runa, brutícia i el cau de goblins. `pieces.json` és la llista (id, etiqueta, grup) que llegeix `decor-packs.py`. **GENERAT: no editar a mà.** Sense restriccions de llicència (no és de cap paquet) |
| `tiny-dungeon-items/` | Tiny Dungeon Items Pack – 16×16 (Pixel-Deck) | 32 objectes solts de 16 px: armes, pocions, claus, monedes, gemma, torxa, espelma, llanterna, bóta, caixa, cofre, calavera, ossos, trampa, corda, bolet… (`title.png` és la portada) |

## `gentle-forest/`

| Fitxer | Mida |
|---|---|
| `gentle forest readme.txt` | txt |
| `48x48 resize/gentle animations (48x48 resize) v01.png` | 288×624 |
| `48x48 resize/gentle animations (48x48 resize) v02.png` | 288×624 |
| `48x48 resize/gentle animations (48x48 resize) v03.png` | 288×624 |
| `48x48 resize/gentle forest (48x48 resize) v01.png` | 768×768 |
| `48x48 resize/gentle forest (48x48 resize) v02.png` | 768×768 |
| `48x48 resize/gentle forest (48x48 resize) v03.png` | 768×768 |
| `48x48 resize/gentle forest MV help.txt` | txt |
| `gentle animations/gentle animations help.txt` | txt |
| `gentle animations/gentle water sparkles A v01.png` | 48×48 |
| `gentle animations/gentle water sparkles A v02.png` | 48×48 |
| `gentle animations/gentle water sparkles A v03.png` | 48×48 |
| `gentle animations/gentle waterfall A v01.png` | 96×160 |
| `gentle animations/gentle waterfall A v02.png` | 96×160 |
| `gentle animations/gentle waterfall A v03.png` | 96×160 |
| `gentle sheets/gentle 32x32 v01.png` | 128×32 |
| `gentle sheets/gentle 32x32 v02.png` | 128×32 |
| `gentle sheets/gentle 32x32 v03.png` | 128×32 |
| `gentle sheets/gentle forest v01.png` | 256×256 |
| `gentle sheets/gentle forest v02.png` | 256×256 |
| `gentle sheets/gentle forest v03.png` | 256×256 |
| `gentle sheets/gentle trees 80x96 v01.png` | 160×96 |
| `gentle sheets/gentle trees 80x96 v02.png` | 160×96 |
| `gentle sheets/gentle trees 80x96 v03.png` | 160×96 |
| `map samples/animated sample 1.gif` | GIF (mostra animada) |
| `map samples/animated sample 2.gif` | GIF (mostra animada) |
| `map samples/sample 1.png` | 801×695 |
| `tree wall/about the tree wall.txt` | txt |
| `tree wall/gentle tree wall, canopy only.png` | 768×512 |
| `tree wall/gentle tree wall.png` | 768×512 |
| `tree wall/tree wall autotile guide.png` | 779×522 |
| `usage guides/cliffsamples.png` | 565×185 |
| `usage guides/stairsamples.png` | 430×367 |
| `usage guides/watersamples.png` | 460×174 |

## `treasure-chests/`

| Fitxer | Mida |
|---|---|
| `treasure chests.png` | 160×192 |

## `breakable-pots/`

| Fitxer | Mida |
|---|---|
| `breakable pots (gray).png` | 128×128 |
| `breakable pots (red).png` | 128×128 |
| `breakable pots (white).png` | 128×128 |
| `breakable pots (yellow).png` | 128×128 |
| `breakable pots.png` | 128×128 |

## `tiny-dungeon-items/`

| Fitxer | Mida |
|---|---|
| `README.txt` | txt |
| `ancient-book.png` | 16×16 |
| `barrel.png` | 16×16 |
| `battle-axe.png` | 16×16 |
| `bear-trap.png` | 16×16 |
| `blue-mana-potion.png` | 16×16 |
| `bomb.png` | 16×16 |
| `bone-pile.png` | 16×16 |
| `candle.png` | 16×16 |
| `coin-pile.png` | 16×16 |
| `dagger.png` | 16×16 |
| `gemstone.png` | 16×16 |
| `gold-coin.png` | 16×16 |
| `gold-key.png` | 16×16 |
| `green-poison-potion.png` | 16×16 |
| `iron-sword.png` | 16×16 |
| `lantern.png` | 16×16 |
| `magic-scroll.png` | 16×16 |
| `magic-staff.png` | 16×16 |
| `mushroom.png` | 16×16 |
| `old-key.png` | 16×16 |
| `purple-mystery-potion.png` | 16×16 |
| `red health potion.png` | 16×16 |
| `rope.png` | 16×16 |
| `round-shield.png` | 16×16 |
| `rusty-sword.png` | 16×16 |
| `skeleton-key.png` | 16×16 |
| `skull-shield.png` | 16×16 |
| `skull.png` | 16×16 |
| `title.png` | 256×256 |
| `torch.png` | 16×16 |
| `treasure-chest.png` | 16×16 |
| `wooden-bow.png` | 16×16 |
| `wooden-crate.png` | 16×16 |
