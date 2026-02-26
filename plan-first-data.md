# Data Analysis Agent — Plan d'implémentation

> Un agent opencode spécialisé data analysis.
> Zéro modification du core. Tout repose sur un fichier agent `.md` + une skill + des scripts Python.

---

## Comment ça s'assemble

OpenCode a deux mécanismes complémentaires qu'on utilise ensemble :

**Agent** (fichier `.opencode/agent/<nom>.md`)
= une personnalité. Définit *qui* parle : son comportement, ses permissions, son modèle.
Le frontmatter YAML configure l'agent, le contenu markdown est son system prompt.
Exemples existants : `docs.md`, `translator.md`, `triage.md`.

**Skill** (fichier `.opencode/skills/<nom>/SKILL.md`)
= une boîte à outils. Définit *ce qu'il sait faire* : instructions détaillées,
scripts, références. Le LLM charge la skill quand il en a besoin et accède
aux fichiers du dossier de la skill.

```
L'utilisateur sélectionne l'agent "data"
        │
        ▼
  .opencode/agent/data.md          ← "Tu es un analyste de données"
  (system prompt + config)            + permissions bash/read/write
        │
        ▼
  Le LLM charge la skill             ← via le tool "skill" natif
  "data-analysis" automatiquement
        │
        ▼
  .opencode/skills/data-analysis/
  ├── SKILL.md                      ← instructions détaillées
  ├── scripts/                      ← profile.py, query.py, chart.py
  └── references/                   ← aide-mémoire pandas/SQL
        │
        ▼
  Le LLM exécute les scripts        ← via le tool "bash" natif
  Python et interprète les résultats
```

---

## Arborescence cible

```
.opencode/
├── agent/
│   ├── data.md                             ← NOUVEAU : l'agent data
│   ├── docs.md                             (existant)
│   ├── translator.md                       (existant)
│   └── triage.md                           (existant)
├── skills/
│   └── data-analysis/
│       ├── SKILL.md                        ← NOUVEAU : instructions + workflow
│       ├── scripts/
│       │   ├── setup_env.sh                ← Bootstrap venv Python (uv)
│       │   ├── profile.py                  ← Profiling d'un dataset
│       │   ├── query.py                    ← Requêtes SQL (toutes DB)
│       │   └── chart.py                    ← Génération de graphiques
│       └── references/
│           └── recipes.md                  ← Snippets pandas/polars/SQL
└── opencode.jsonc                          (existant, pas de modif nécessaire)
```

---

## Étape 1 — L'agent : `.opencode/agent/data.md`

Un fichier markdown avec frontmatter, comme les agents existants (`docs.md`, `translator.md`).

```markdown
---
description: Analyse de données, connexion aux DB, profiling, visualisations
color: "#10B981"
---

Tu es un analyste de données expert.

## Ce que tu fais
- Profiler des datasets (CSV, JSON, Parquet, tables SQL)
- Te connecter à des bases de données et exécuter des requêtes
- Transformer et nettoyer des données
- Générer des visualisations
- Résumer tes findings en langage clair

## Comment tu travailles
Tu utilises la skill "data-analysis" qui contient des scripts Python prêts à l'emploi.
Au début de chaque session, charge cette skill.
Tous tes traitements data passent par Python via bash.

## Règles
- Toujours profiler un dataset avant de le transformer
- Vérifier la taille d'un fichier avant de le charger entièrement
- Ne jamais afficher de mots de passe ou credentials
- Demander confirmation avant toute opération destructive (DROP, DELETE, TRUNCATE)
- Résumer les résultats, ne pas dumper des tables brutes de centaines de lignes
```

Le champ `description` est utilisé par opencode pour afficher l'agent dans la liste.
Le champ `color` est optionnel (couleur dans le terminal).
Le contenu markdown devient le system prompt de l'agent.

---

## Étape 2 — La skill : `.opencode/skills/data-analysis/SKILL.md`

C'est ici que vit la logique métier. Le SKILL.md est chargé dans le contexte
du LLM quand il invoque la skill. Il contient :

- Le workflow détaillé (profiler → explorer → transformer → visualiser → conclure)
- La doc d'usage de chaque script (`profile.py`, `query.py`, `chart.py`)
- Les instructions de connexion aux bases de données
- Les conventions de sortie (dossier `output/`, nommage des fichiers)
- Les règles de sécurité

Le SKILL.md a aussi accès à tous les fichiers dans son dossier (`scripts/`, `references/`).
Le LLM peut les lire via `read` et les exécuter via `bash`.

---

## Étape 3 — Bootstrap Python : `scripts/setup_env.sh`

Crée un environnement Python isolé avec `uv` et installe les dépendances.
Le SKILL.md dit au LLM de l'exécuter une fois avant toute opération data.

Dépendances installées :
- **pandas** / **polars** — manipulation de données
- **matplotlib** — graphiques
- **sqlalchemy** — connexion à toute DB relationnelle
- **pyarrow** — lecture de fichiers Parquet
- **psycopg2-binary** — driver PostgreSQL
- **pymysql** — driver MySQL

Le venv est créé dans `.opencode/.venv`. Tous les scripts utilisent ce Python.

---

## Étape 4 — `scripts/profile.py`

Profiling automatique d'un dataset. C'est le premier réflexe de l'agent.

```
Usage :
  python profile.py data.csv
  python profile.py data.parquet
  python profile.py "sqlite:///app.db" --table users
```

Ce qu'il affiche :
- Dimensions (lignes x colonnes)
- Type de chaque colonne
- % de valeurs nulles par colonne
- Stats numériques (min, max, moyenne, médiane, écart-type)
- Top 5 valeurs fréquentes pour les colonnes texte
- Aperçu des premières lignes

---

## Étape 5 — `scripts/query.py`

Exécute des requêtes SQL sur n'importe quelle base de données.
C'est le point d'entrée unique pour toutes les connexions DB.

```
Usage :
  # SQLite (fichier local)
  python query.py "sqlite:///data/app.db" "SELECT * FROM users LIMIT 10"

  # PostgreSQL
  python query.py "$DB_WAREHOUSE" "SELECT count(*) FROM orders"

  # MySQL
  python query.py "mysql+pymysql://user:pass@host/db" "SHOW TABLES"

  # Lister les tables et colonnes (sans requête)
  python query.py "sqlite:///data/app.db" --schema

  # Expliquer le plan d'exécution
  python query.py "$DB_URL" "SELECT ..." --explain
```

Le script utilise SQLAlchemy. Une connection string = toute DB supportée.

---

## Étape 6 — `scripts/chart.py`

Génère des graphiques à partir de données.

```
Usage :
  python chart.py data.csv --type bar --x category --y revenue
  python chart.py data.csv --type scatter --x age --y salary
  python chart.py data.csv --type hist --x price --bins 20
  python chart.py data.csv --type line --x date --y value --output trend.png
```

Types supportés : `bar`, `line`, `scatter`, `hist`, `box`, `heatmap`, `pie`.
Output par défaut : `output/chart_<timestamp>.png`.

---

## Étape 7 — `references/recipes.md`

Aide-mémoire pour le LLM (pas pour l'utilisateur). Contient des snippets
pandas/polars/SQL corrects pour éviter les hallucinations sur la syntaxe :

- Lecture de CSV avec bon encoding/séparateur
- Lecture de Parquet
- Gestion des dates et des types
- Agrégations groupby
- Joins entre DataFrames
- Nettoyage (rename, drop, fillna, astype)
- Patterns SQLAlchemy courants

---

## Connexion aux bases de données

C'est la partie qui mérite le plus d'explication.
Le principe : **tout passe par `query.py` + une connection string SQLAlchemy**.
La question est : d'où vient la connection string ?

### 3 façons de fournir une connexion (du plus simple au plus structuré)

**A) L'utilisateur la donne dans le chat**

```
> Connecte-toi à postgresql://analytics:pass@db.company.com/warehouse
> Quelles sont les 10 dernières commandes ?
```

Le LLM extrait la connection string et la passe à `query.py`.

- Avantage : marche immédiatement, zéro config
- Inconvénient : le mot de passe apparaît dans l'historique du chat

**B) Variables d'environnement (recommandé)**

L'utilisateur configure ses connexions dans son shell ou `.env` :

```bash
export DB_WAREHOUSE="postgresql://analytics:pass@db.company.com/warehouse"
export DB_LOCAL="sqlite:///data/app.db"
```

Le SKILL.md dit au LLM de regarder les variables `DB_*`.
L'utilisateur dit juste :

```
> Montre-moi le schéma de DB_WAREHOUSE
```

Le LLM lance : `python query.py "$DB_WAREHOUSE" --schema`

- Avantage : credentials hors du chat, standard, fonctionne partout
- Inconvénient : l'utilisateur doit les configurer en amont

**C) Fichier `datasources.toml` (le plus structuré)**

Un fichier dans le projet qui déclare toutes les sources disponibles :

```toml
[sources.warehouse]
description = "Base analytics PostgreSQL"
url = "$DB_WAREHOUSE"                   # pointe vers une variable d'env

[sources.local]
description = "SQLite de développement"
url = "sqlite:///data/dev.db"

[sources.exports]
description = "Fichiers CSV d'export"
type = "directory"
path = "./data/exports/"
```

Le SKILL.md dit au LLM : "Au début de la session, lis `datasources.toml`
pour connaître les sources disponibles."

L'utilisateur peut alors dire :
```
> Quelles tables il y a dans "warehouse" ?
> Compare les ventes entre "warehouse" et le fichier exports/q4.csv
```

- Avantage : sources déclarées une fois, le LLM les connaît d'office
- Inconvénient : un fichier de plus à maintenir

### Stratégie du SKILL.md

Le SKILL.md instruit le LLM de chercher les connexions dans cet ordre :
1. `datasources.toml` à la racine du projet → si trouvé, l'utiliser
2. Variables d'environnement `DB_*` → les lister et proposer
3. Sinon → demander la connection string à l'utilisateur

### Sécurité des connexions

Le SKILL.md contient ces règles :
- Ne jamais afficher de mot de passe dans les réponses
- Ne jamais écrire de credentials dans un fichier versionné
- Les `$VARIABLES` sont résolues par le shell, pas par le LLM
- Par défaut seuls les `SELECT` sont exécutés
- `INSERT/UPDATE/DELETE` → demander confirmation
- `DROP/TRUNCATE` → double confirmation

---

## Ordre d'implémentation

```
1. .opencode/agent/data.md           ← L'agent (5 min)
   │
2. .opencode/skills/data-analysis/
   ├── SKILL.md                      ← Les instructions (30 min)
   │
3. ├── scripts/setup_env.sh          ← Le venv Python (10 min)
   │
   ├── scripts/profile.py            ← Profiling (30 min)
   ├── scripts/query.py              ← Requêtes SQL + connexions DB (45 min)
   └── scripts/chart.py              ← Graphiques (30 min)
   │
4. └── references/recipes.md         ← Aide-mémoire (20 min)
   │
5. Test end-to-end                   ← Valider le tout
   → Lancer opencode, sélectionner agent "data"
   → Profiler un CSV
   → Se connecter à un SQLite et requêter
   → Générer un chart
```

---

## Ce qui marche sans toucher au core

| Besoin | Comment ça marche |
|--------|-------------------|
| Analyser un CSV | L'agent lance `python profile.py data.csv` via bash |
| Requêter PostgreSQL | L'agent lance `python query.py "$DB_URL" "SELECT ..."` via bash |
| Requêter SQLite | L'agent lance `python query.py "sqlite:///..." "SELECT ..."` via bash |
| Requêter MySQL | L'agent lance `python query.py "mysql+pymysql://..." "SELECT ..."` via bash |
| Lister les tables d'une DB | L'agent lance `python query.py "$DB_URL" --schema` via bash |
| Générer un graphique | L'agent lance `python chart.py data.csv --type bar ...` via bash |
| Lire un Parquet | L'agent lance du Python ad-hoc via bash |
| Transformer des données | L'agent écrit du Python à la volée et l'exécute via bash |
| Résumer des résultats | Le LLM interprète le stdout et répond en langage naturel |

---

## Limites acceptées (V1)

**Pas de mémoire entre les appels Python** : chaque `bash` est un process isolé.
Si l'agent a besoin de résultats intermédiaires, il passe par des fichiers
dans `output/`. Ce n'est pas un notebook, mais c'est suffisant pour de l'analyse ad-hoc.

**Reconnexion DB à chaque requête** : pas de pool de connexions.
Pour de l'analyse (quelques requêtes ponctuelles), c'est négligeable.

**Pas de sandbox** : les scripts Python ont accès au filesystem.
La sécurité repose sur les instructions du SKILL.md et les permissions opencode.

---

## Évolutions possibles (hors V1)

| Besoin | Solution | Impact core |
|--------|----------|:-----------:|
| State Python persistant (garder un DataFrame entre 2 questions) | MCP server avec REPL Python | aucun |
| Connexion DB persistante avec pooling | MCP server avec pool SQLAlchemy | aucun |
| Sandbox Python | Script qui lance Docker/container | aucun |
| Dashboards interactifs | Script Streamlit/Panel lancé via bash | aucun |
