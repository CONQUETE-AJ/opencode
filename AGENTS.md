- To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE.
- The default branch in this repo is `dev`.
- Local `main` ref may not exist; use `dev` or `origin/dev` for diffs.
- This repository is a fork; keep changes modular so upstream updates stay easy to integrate.
- Always keep `README.md` updated when behavior, scope, architecture, or developer commands change.
- Keep `lesson.md` as a pointer to `lessons.md` so both names stay discoverable.
- Maintain `lessons.md` using this Self-Improvement Loop:
  - After ANY correction from the user: update `lessons.md` with the pattern.
  - Write rules for yourself that prevent the same mistake.
  - Ruthlessly iterate on these lessons until mistake rate drops.
  - Review lessons at session start for the relevant project.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Prefer single word variable names where possible
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream

### Naming

Prefer single word names for variables and functions. Only use multiple words if necessary.

```ts
// Good
const foo = 1
function journal(dir: string) {}

// Bad
const fooBar = 1
function prepareJournal(dir: string) {}
```

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root (guard: `do-not-run-tests-from-root`); run from package dirs like `packages/opencode`.





AGENTS.MD
Objectif : faire évoluer l’app rapidement sans dette technique, sans casser l’existant, et avec une qualité production.
***Règles d’or (non négociables)
1) No artifacts
Ne pas créer de fichiers/artefacts inutiles (scripts temporaires, dumps, docs redondantes, etc.).
Si un fichier est ajouté, il doit avoir une utilité durable.
2) Less code > more code
Préférer une solution simple, lisible, et minimale.
Supprimer le code mort plutôt que le contourner.
3) Rewrite > add
Réécrire/améliorer les composants existants plutôt que d’en créer de nouveaux.
Ajouter un nouveau composant uniquement si cela réduit la complexité globale.
4) Flag obsolete
Si un fichier devient obsolète : le signaler et proposer sa suppression.
Garder une codebase légère.
5) Avoid race conditions at all costs
Pas d’effets de bord concurrents, pas de double requêtes silencieuses, pas de state incohérent.
Toujours gérer : annulation (abort), idempotence, retries, locks si nécessaire.
6) Comments only if necessary
Commenter uniquement ce qui n’est pas évident (why > what).
Aucun commentaire “bruit”.
7) Modulaire & collaboratif
Découper en modules clairs (responsabilités nettes).
Une feature ne doit jamais casser le reste du système.
Préférer des interfaces stables, des contrats explicites.
8) Meaningful logs (value only)
Ajouter des logs seulement s’ils aident à diagnostiquer en prod.
Logs structurés quand pertinent (contexte, ids, timing, erreurs).
Pas de spam.
9) Think production-first
Chaque changement doit être “ship-ready”.
Gestion d’erreurs propre, timeouts, validations, fallback si nécessaire.
Pas de “TODO” oubliés, pas de hacks temporaires.
10) README.md toujours à jour
Toute modif fonctionnelle/architecture/config doit être reflétée dans le README.
***Stack & conventions projet
Python (Backend)
Toujours utiliser uv pour la gestion des packages et l’exécution.
Pas de dépendances inutiles.
Front-end
Pas de phrase inutile dans l'application / Pas de phrase explicative.
Sur la home, les boutons de collections doivent rester visibles sans style encadre (pas de pill, pas de carte).
Sur la home, les blocs post-hero restent frameless (pas de conteneur carte/cadre autour de Piece signature, Best-sellers, Bande confiance).
***Workflow de dev (obligatoire)
1) Toujours lancer l’app via start.sh
start.sh démarre backend + frontend.

2) Travail avec un workflow git propre
Commit à chaque changement atomique avec un message clair.
5) Avant de conclure une PR / livraison
Nettoyer les fichiers inutiles.
Mettre à jour le README si nécessaire.
***Mets à jour un lesson.md, que tu dois consulter. Au fil du projet, mets à jour lesson.md, sur les erreurs à ne pas faire et les reussites.
