# Història: mòduls i diari de la sessió

> El panell **Història** (botó de la rail de la dreta del mapa): el mòdul que es juga, la biblioteca de mòduls
> importats i el diari de la sessió. Part de la documentació tècnica: vegeu [docs/README.md](README.md).

## Per què existeix
Abans: el DM muntava els mapes, jugava, i després explicava a Claude què havia passat perquè actualitzés
Notion (resum de la sessió, estat dels mòduls). Ara hi ha dues peces que tanquen el cercle sense
duplicar res:
- **Mòduls** (Notion → app): la pàgina d'un mòdul de la base **MÒDULS** es converteix en un paquet JSON
  que s'importa a l'app. Mentre es juga, el disparador, els textos per llegir, els enemics i les sortides
  són a un clic.
- **Diari** (app → Notion): l'app anota sola el que passa i en fa el resum, amb un bloc JSON que Claude
  passa a la pàgina de **SESSIONS** de Notion sense preguntar res.

**Notion continua sent on s'escriu la prosa llarga**, però des de la v5.01 el DM també pot crear i editar
mòduls dins l'app amb un formulari (sense JSON ni Claude): `ModuleEditor`. No és un editor de campanya
(res de wiki ni de pàgines): només els camps del paquet.

## On viu cada cosa (⚠️ fora de la partida)
`lib/localStore.ts` (`createJsonStore` + `useJsonStore`) desa a `localStorage`, amb còpia en memòria i
`useSyncExternalStore` (sense error d'hidratació). **No van dins de la partida** (`_buildSessionCore`)
perquè una nit passa per diversos mapes, partides carregades, i `applySessionState`
substitueix tot l'estat de joc. Tampoc viatgen a les pantalles de jugador: és tot DM-only.

| Clau de `localStorage` | Què | Mòdul |
|---|---|---|
| `rpg_modules_v1` | Biblioteca de mòduls (paquets + estat de joc + mòdul actiu) | `lib/modules.ts` |
| `rpg_journal_v1` | Sessió actual + arxiu de les últimes 20 tancades (el resum en markdown) | `lib/journal.ts` |

Si es canvia el format d'un d'aquests, **pujar la versió de la clau** (`_v2`) o fer-ho tolerant a
`revive` (ja ho és: llegeix defensivament i descarta el que no entén). Sense `localStorage` (mode privat)
tot funciona en memòria mentre la pàgina és oberta.

## Mòduls

### Format del paquet (`ModulePack`, `lib/modules.ts`)
Un fitxer `.json` pot contenir un mòdul, una llista o `{ "modules": [...] }`.

| Camp | Tipus | De Notion (base MÒDULS) | Notes |
|---|---|---|---|
| `format` / `version` | `"rpg-module"` / `1` | — | Constants |
| `id` | slug | — | Estable: el mateix en tornar a importar (`slugify(title)` si falta). Les sortides apunten a l'`id` d'un altre mòdul |
| `title` | text (**obligatori**) | Nom | |
| `notionUrl` | url | `url` | Surt al resum de la sessió i com a «Obrir a Notion» |
| `kind` | text | Tipus | Encontre, Viatge, Exploració… |
| `level` / `duration` | nombre / text | Nivell / Durada | |
| `status` | `esborrany` `preparat` `en-joc` `jugat` `descartat` | Estat | Accepta el text de Notion (`✅ Preparat`, `🔄 Jugat en part` → `en-joc`, `🎲 Jugat`…) |
| `quests` | text[] | Missió | |
| `trigger` | text | 🎯 Disparador | |
| `scene` | text[] | 🎬 Escena | Una frase per element |
| `readAloud` | `{id, label, text}[]` | Els `callout 🗣` de la pàgina de sessió | El text que es llegeix en veu alta; **un sol idioma** (el que es vulgui mostrar) |
| `foes` | `{creature, count, name?, hp?, xp?, sprite?, note?}[]` | ⚔️ Estadístiques | Veure «Enemics» |
| `npcs` | `{name, note?}[]` | NPCs i llocs | |
| `dialogs` | `{id, title, script}[]` | — | `script` en **format teatre** de «Diàlegs de personatges» (`Nom: text`, `Narrador: …`) |
| `exits` | `{id, label, text?, to?}[]` | ↪️ Sortides | `to` = `id` d'un altre mòdul |
| `dmNotes` | text | 🟦 Notes DM | Plegat per defecte |

`parseModulePacks` és **tolerant**: ignora el que no entén, arrodoneix `count` a [1, 30], i només
rebutja un mòdul sense `title`. Els errors surten sota el botó d'importar.

### Editor de mòduls (`ModuleEditor.tsx`, `saveModule`)
Pestanya **Mòduls** → **+ Nou mòdul**, o el llapis de cada fila. El formulari té els mateixos camps que el
paquet; el que es desa passa per `parseModulePacks` (mateixa normalització que una importació) i entra a
la biblioteca amb `saveModule(draft, editingId?)`:
- Mòdul nou: `id` = `slugify(títol)`, amb `-2`, `-3`… si ja existeix.
- Edició: l'`id` **no canvia mai** (les sortides `to` dels altres mòduls hi apunten) i es conserva l'estat de joc.
- Els enemics suggereixen plantilles i criatures Oryx (`datalist`); per a un nom lliure cal posar-hi PV i XP.
- Pendent: el format no té encara imatges d'Escena ni cinemàtiques (veure `docs/millores.md` si s'hi afegeix).

### Enemics (`foes`) → biblioteca de l'escena
`templateForFoe` (`hooks/useStory.ts`) tria la plantilla per aquest ordre: **id de plantilla** (`goblin`,
`fum_lhupo`) → **nom exacte** d'una plantilla → **criatura Oryx** pel nom (`skeleton`, `wolf_black`;
llista a `lib/sprites/manifest.ts`) → **genèrica** amb el `hp`/`xp` del paquet i el `sprite` Oryx que
s'indiqui (sense `sprite`, disc de color). `name`, `hp`, `xp` i `sprite` del paquet manen sobre els de la
plantilla. «Col·locar» els deixa al **centre de la vista**, en files de 6 i ajustats a les caselles si hi
ha graella; entren a `rLibEnemies` com qualsevol altre (numeració, XP del combat, estats…).

### Què fa cada botó (`hooks/useStory.ts`)
| Botó | Fa |
|---|---|
| **Llegir** (text) | Obre «Mostrar als jugadors» → pestanya *Text* amb el text a l'editor. El DM el revela quan vol (no es mostra res sol) |
| **Col·locar** (enemics) | Els afegeix a l'escena (un grup o tots) |
| **Parlar** (diàleg) | `dlg.start` amb el repartiment de `matchCast` (cada nom del guió amb el token de l'escena que es diu igual) |
| **Anar-hi** (sortida) | Marca el mòdul com a jugat, fa actiu el de destí (`to`) |
| **Marcar com a jugat** | `status = 'jugat'` |

Obrir un mòdul de la biblioteca el posa **En joc** si era Preparat o Esborrany.

### Generar un paquet des de Notion (instruccions per a Claude)
Quan l'usuari demani «passa el mòdul X (o la sessió N) a paquet»:
1. Llegir la pàgina del mòdul (`notion-fetch`) i, si cal, els de la relació *NPCs i llocs*.
2. Mapejar camp a camp segons la taula de dalt. **No inventar res**: el que Notion no té, es deixa buit
   (`[]` o sense el camp). Una proposta marcada «no confirmada» a Notion va a `dmNotes`, no a `scene`.
3. `id` = `slugify` del títol; **les sortides `to` han d'usar els mateixos `id`** dels altres mòduls de la
   cadena (perquè «Anar-hi» enllaci). Si un mòdul de destí encara no existeix, el `to` surt avisat a la UI.
4. `foes[].creature`: provar primer una plantilla o criatura Oryx que existeixi (`lib/bestiary.ts`,
   `lib/sprites/manifest.ts`); si no n'hi ha, nom lliure + `hp`/`xp`/`sprite` d'una de semblant, i les
   estadístiques completes a `note`.
5. `readAloud`: els `callout 🗣` de la pàgina de sessió, **en un sol idioma** (el que es vol dir als
   jugadors). Un element per bloc, amb una etiqueta curta.
6. Lliurar el JSON al xat perquè l'usuari l'enganxi a **Història → Mòduls → Enganxar JSON**, i **no
   commitejar-lo** si conté text de campanya que no ha de ser al repositori.

## Diari de la sessió

### Què s'anota (`logJournal(kind, text, {data?, star?})`)
Es pot cridar des de qualsevol lloc (no cal cap hook; mai llança). Un mateix text seguit en 3 s no es
repeteix; màxim 1500 entrades (cauen primer les menys importants: les notes i les marcades ★ es conserven).

| `kind` | On s'anota |
|---|---|
| `map` | `useJournalWatchers` (un mapa obert) |
| `room` | `useJournalWatchers`: una sala que passa de no revelada a revelada (no compara si el conjunt de sales ha canviat: escena nova) |
| `combat` | `startTurnCombat` («Comença…») i `finishCombat` («Combat acabat · rondes · derrotats · a terra», amb `data.ended`) |
| `xp` | `confirmXpAward` (repartiment confirmat) |
| `dialog` | `useDialog.start` (només escenes; les frases soltes i els globus no) |
| `cinematic` | `useCinematic.launchBossIntro` (no la previsualització) |
| `text` | `show` de `useSceneShow` (l'Escena mostrada als jugadors) |
| `down` | `useJournalWatchers`: un jugador que passa a derrotat |
| `module` | `useStory`: obrir, col·locar enemics, sortida, jugat |
| `note` | Camp «Nota ràpida» del diari; **tecla N** (`useKeyboardHandlers.onQuickNote`) obre el panell i enfoca el camp |

Cada entrada porta el `module` actiu en aquell moment.

### El resum (`journalToMarkdown`)
Capçalera (data, hora, durada), **Mòduls** (els que han sortit al diari, amb l'estat i l'URL de Notion),
**Cronologia** (checklist `- [x] HH:MM — …`, com el TIMELINE de la pàgina de sessió), **Combats**,
**Experiència**, **Notes del DM** i un **bloc JSON** (`<!-- rpg-session-log -->`) amb mòduls, combats,
XP, notes i la cronologia en línies. Es copia o es descarrega com a `.md` des del diari.
**Tancar la sessió** desa el resum a l'arxiu, el copia i en comença una de nova en blanc.

### Del resum a Notion (instruccions per a Claude)
Quan l'usuari enganxi un resum «Copiar resum»:
1. Llegir el **bloc JSON** (és la font; el markdown és per a humans).
2. **SESSIONS**: crear o actualitzar la pàgina de la sessió (`Name` = `name`; `Tags` = `completed`; relació
   **Mòduls** amb les pàgines de `modules[].notionUrl`). Cos: **TIMELINE** = `timeline`; **RECAP** = una
   síntesi curta escrita a partir de la cronologia i les notes (no inventar res que el diari no digui).
3. **MÒDULS**: per a cada `modules[]` → `Estat`: «🎲 Jugat» si l'estat és *jugat*, «🔄 Jugat en part» si és *en joc*.
4. Les `notes` del DM van a la secció «Notes» de la pàgina, tal qual.

### «Anteriorment…» (recap per als jugadors)
L'estrella ★ de cada entrada la marca; **Anteriorment…** deixa a la caixa de text de l'Escena «Anteriorment…» + una
línia per entrada marcada (`recapText`). El DM el mostra als jugadors com qualsevol text. Sense cap marcada,
el botó és desactivat.

## UI (`StoryPanel`, `ModuleView`, `ModuleLibrary`, `JournalView`)
- Botó **Història** a la rail d'icones de la dreta del mapa (`RightRail`, sempre visible). El panell va a la **dreta del mapa, sota el
  zoom** (el «Mostrar als jugadors» és a l'esquerra: es poden tenir oberts alhora). Tres pestanyes: **Mòdul**
  (l'actiu), **Mòduls** (biblioteca: importar fitxer o enganxar JSON, triar, canviar l'estat, eliminar amb
  confirmació) i **Diari**.
- ⚠️ `zIndex: 11`, **per sota de la barra de torns (12)**: els globus de la barra («Finalitzar el combat?»)
  han de veure's sobre el panell. Amb combat (`avoidTurnBar`) el panell s'acaba on comença la barra
  (`TURN_BAR_GAP`) perquè no li tapi els botons. Al mòbil (`compact`) va sota la barra d'eines horitzontal.
- Els panells llegeixen els magatzems amb `useJsonStore`: res passa per props de la partida.

## Pendent (necessita la API) — Fase 2
Tot l'anterior és **d'un sol dispositiu** (`localStorage`). Per compartir-ho entre dispositius i enllaçar
mòduls amb partides cal API; **no s'ha implementat res al frontend** (regla de `CLAUDE.md`). Proposta:

```
Modifica la API (divas_tragonas_api) per afegir els mòduls i el diari de les sessions.

CANVI 1 — Model Module (nou, app/src/modules/module.model.ts)
  slug: string (únic, índex)        // l'«id» del paquet
  title: string
  status: 'esborrany'|'preparat'|'en-joc'|'jugat'|'descartat'
  playedAt?: Date
  pack: Mixed                        // el JSON del paquet, OPAC (no validar-ne l'estructura interna)
  + timestamps

CANVI 2 — Endpoints (JWT admin, com /sessions)
  GET    /modules          -> [{ slug, title, status, playedAt, updatedAt }]   (200, sense `pack`)
  GET    /modules/:slug    -> Module amb `pack`                                  (200 / 404)
  PUT    /modules/:slug    -> body { title?, status?, playedAt?, pack? }; si no existeix, el crea (upsert)  (200)
  DELETE /modules/:slug    -> 204

CANVI 3 — Model JournalSession (nou)
  name: string, startedAt: Date, endedAt: Date
  markdown: string                   // el resum
  entries: Mixed                     // les entrades, opac
  + timestamps
  GET /journal-sessions (llista sense `entries`), GET /journal-sessions/:id,
  POST /journal-sessions (201), DELETE /journal-sessions/:id (204). JWT admin.

Límit de body: com /sessions (el diari és petit; el paquet de mòdul, uns KB).
Motiu: el frontend desa mòduls i diari a localStorage (un sol dispositiu); amb la API es poden
compartir entre PC i tauleta i servir-los a Claude per actualitzar Notion.
```
Un cop desplegada, el frontend només ha de canviar el `revive`/`update` dels magatzems per sincronitzar
(mateix patró que `useCharacters`: còpia local + cua de canvis). També queda pendent **vincular un mapa
improvisat a un mòdul** («Vincula al mòdul X»): necessita un camp `moduleSlug` a les partides al servidor.
