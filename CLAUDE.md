@AGENTS.md

# RPG Map Viewer — CLAUDE.md

> **INSTRUCCIÓ OBLIGATÒRIA:** Llegir aquest fitxer (són les regles de treball) i, del directori
> [`docs/`](docs/README.md), **el fitxer de l'àrea que es toca** abans de fer cap canvi. Mira també
> [`docs/errors-comuns.md`](docs/errors-comuns.md).
> Actualitzar el fitxer de `docs/` corresponent sempre que s'afegeixi o canviï una funcionalitat.

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

**Versió a la pantalla de benvinguda**: la mostra `DMView.tsx` a partir d'`APP_VERSION` (`src/constants/index.ts`); actualitzar-la sempre que pugi la versió al CHANGELOG.

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

> **FORMAT DE LA VERSIÓ: `vMAJOR.MM` amb DOS dígits a la part petita** (`v4.09`, `v4.10`,
> `v4.11`… fins a `v4.99`). **Mai un sol dígit** (`v4.9` és un error: ordena malament i
> obliga a saltar a la v5 al cap de nou canvis). El salt de versió gran (`v5`) es reserva
> per a una fita de debò, no per haver-se quedat sense números.
>
> L'increment normal és de **+0.01** (`v4.09` → `v4.10`). Compte: `v4.9` i `v4.90` no són
> el mateix — sempre dos dígits.

**Abans de cada commit**, actualitzar el `CHANGELOG.md`:
1. Incrementar la versió (`vX.YY` → `vX.YY+1`) i posar-la al títol de l'entrada nova del Changelog
2. Afegir un nou bloc al Changelog amb la versió nova i un resum dels canvis:
   ```markdown
   ### vX.YY+1 — Títol curt del canvi
   - Descripció breu del canvi 1
   - Descripció breu del canvi 2
   ```
3. Actualitzar `APP_VERSION` a `src/constants/index.ts` (surt a la pantalla de benvinguda del DM i del jugador)
4. Incloure el `CHANGELOG.md` al commit

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

## Mapa de la documentació

Una taula més detallada és a [`docs/README.md`](docs/README.md). Resum:

| Àrea | Fitxer |
|---|---|
| Stack, rutes, fitxers, render, state ↔ ref, constants | [`docs/arquitectura.md`](docs/arquitectura.md) |
| BroadcastChannel, WebSocket, càmera, pantalla de jugador | [`docs/sincronitzacio.md`](docs/sincronitzacio.md) |
| Barra, lateral, modes, eines, menús, dreceres, estil visual | [`docs/ui-dm.md`](docs/ui-dm.md) |
| Tokens, estats, torns, moviment, enemics | [`docs/tokens-i-combat.md`](docs/tokens-i-combat.md) |
| Mapa, PSD, parets, sales, portes, llums, desat | [`docs/mapa-sales-llum.md`](docs/mapa-sales-llum.md) |
| App Píxel, missions, llocs | [`docs/pixel-i-missions.md`](docs/pixel-i-missions.md) |
| Màgies, zones màgiques, cinemàtiques de boss | [`docs/efectes-i-cinematiques.md`](docs/efectes-i-cinematiques.md) |
| Diàlegs, fitxes, Expositor, Revelador de text | [`docs/dialegs-i-fitxes.md`](docs/dialegs-i-fitxes.md) |
| Errors comuns a evitar | [`docs/errors-comuns.md`](docs/errors-comuns.md) |
| Contracte amb la API | [`api-spec.txt`](api-spec.txt) |
| Historial de versions | [`CHANGELOG.md`](CHANGELOG.md) |
