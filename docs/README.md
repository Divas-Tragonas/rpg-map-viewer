# Documentació tècnica

Índex de la documentació de l'RPG Map Viewer. Per començar, llegeix el [README](../README.md);
les regles de treball (git, versions, API) són a [CLAUDE.md](../CLAUDE.md).

## Per on començar

1. **Entendre com és per dins** → [arquitectura.md](arquitectura.md) (stack, rutes, estructura de fitxers, bucle de render, patró state ↔ ref).
2. **Entendre com parlen el DM i els jugadors** → [sincronitzacio.md](sincronitzacio.md).
3. **Tocar alguna cosa concreta** → busca-ho a la taula de sota i llegeix només aquell fitxer.

## Quin fitxer toca

| Si toques… | Llegeix | Què hi trobaràs |
|---|---|---|
| El bucle de render, `FrameContext`, refs del DM, constants | [arquitectura.md](arquitectura.md) | Stack, rutes, estructura de fitxers, render phases, patró state ↔ ref |
| `BroadcastChannel`, WebSocket, càmera, pantalla de jugador | [sincronitzacio.md](sincronitzacio.md) | Missatges DM ↔ jugador, dieta del `STATE`, càmera compartida, mòbil, wiki |
| Barra superior, lateral, eines, menús, dreceres, estil visual | [ui-dm.md](ui-dm.md) | Modes Preparar/Jugar, desfer únic, menú del token, sistema visual |
| Tokens, estats, torns, moviment, enemics | [tokens-i-combat.md](tokens-i-combat.md) | Condicions, iniciativa, moviment des del jugador, rètol de torn |
| Mapa, parets, sales, portes, llums, desat | [mapa-sales-llum.md](mapa-sales-llum.md) | Sales fosques, il·luminació, col·lisions, desat automàtic |
| App Píxel, missions, llocs | [pixel-i-missions.md](pixel-i-missions.md) | Sprites, mapes de caselles, missions de Cony Cirera |
| Màgies, zones màgiques, cinemàtiques de boss | [efectes-i-cinematiques.md](efectes-i-cinematiques.md) | Bola de foc, raigs, grimoris, zones, cinemàtiques |
| Diàlegs, fitxes, Expositor, Revelador de text | [dialegs-i-fitxes.md](dialegs-i-fitxes.md) | Guió, XP, panell «Mostrar als jugadors» |
| Mòduls de la història, diari de la sessió, panell Història | [historia-i-moduls.md](historia-i-moduls.md) | Format del paquet, de Notion a l'app i del diari a Notion |
| Millores en curs, decisions pendents per lots | [millores.md](millores.md) | Checklists dels lots i prompts de la API pendents |
| Qualsevol cosa, abans de donar-la per acabada | [errors-comuns.md](errors-comuns.md) | Trampes ja trobades i com evitar-les |

Fora de `docs/`: [api-spec.txt](../api-spec.txt) (contracte amb la API, font de veritat compartida) i
[CHANGELOG.md](../CHANGELOG.md) (historial de versions).

## Convencions

- Les referències creuades entre fitxers («veure «Modes Preparar · Jugar»») són el **títol de la secció**:
  cerca'l amb `grep -rn "Modes Preparar" docs/`.
- Quan afegeixis o canviïs una funcionalitat, actualitza **el fitxer de `docs/` de la seva àrea**
  (no pas un de nou a l'arrel) i, si és una trampa nova, afegeix-la a [errors-comuns.md](errors-comuns.md).
- Una àrea nova sense fitxer propi: afegeix una secció al més proper i una fila a la taula d'aquí.
