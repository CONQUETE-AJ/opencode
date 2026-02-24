# Plan de Simplification - Terminal Data Analysis / Data Science

## 1. Objectif

Créer une version spécialisée de ce fork pour le terminal uniquement, sans scope enterprise, orientée data analyse et data science, avec une architecture modulaire pour simplifier les mises à jour depuis `dev` upstream.

## 2. État actuel (mise à jour)

- [x] Branche de travail `feature/cleaning` créée.
- [x] Flux racine recentré sur `packages/opencode` (terminal-first).
- [x] Workspaces réduits au noyau terminal: `opencode`, `plugin`, `script`, `sdk`, `util`.
- [x] Pipeline `turbo.json` recentré sur les tâches terminal.
- [x] Politique README appliquée: un seul `README.md` conservé et mis à jour.
- [x] Règles de gouvernance ajoutées dans `AGENTS.md` (`README.md` + boucle `lessons.md`).
- [~] Build terminal: script prêt, mais exécution bloquée localement par Bun `1.3.2` (requis `1.3.9`).

## 3. Principes directeurs

- Garder un noyau minimal et stable dans `packages/opencode`.
- Isoler chaque capacité data dans un module indépendant.
- Préférer des interfaces claires entre `core`, `cli`, `providers`, `data`.
- Éviter les couplages forts avec les couches non terminales.
- Préserver des diffs petits et ciblés pour faciliter les merges upstream.

## 4. Plan d'exécution

### Phase 0 - Baseline et garde-fous

- [ ] Créer un tag/point de référence avant suppression définitive.
- [ ] Documenter la stratégie de merge upstream (fréquence, règles de conflit).
- [~] Vérifier les commandes minimales terminales.
- [x] `typecheck` terminal validé.
- [x] `test:terminal` validé.
- [ ] `build` à revalider après upgrade Bun vers `1.3.9`.

### Phase 1 - Réduction du scope monorepo

- [x] Mettre à jour les scripts racine pour privilégier le flux terminal.
- [x] Retirer du flux par défaut les packages non nécessaires.
- [x] Nettoyer `turbo.json` pour ne garder que les pipelines utiles au terminal.
- [x] Conserver temporairement les packages hors scope en mode désactivé.

### Phase 2 - Modularisation interne (prochaine étape)

- [ ] Poser une structure modulaire explicite dans `packages/opencode/src`.
  Explication: créer un découpage clair des responsabilités pour réduire les effets de bord et simplifier les évolutions.
  Livrable attendu: arborescence cible validée et utilisée par les nouveaux développements.

- [ ] `core` (orchestration, session, config, permissions).
  Explication: concentrer ici le socle stable qui pilote l'application, indépendant des cas d'usage data spécifiques.
  Livrable attendu: règles de session/config/permissions centralisées dans un module unique.

- [ ] `data` (sources, profiling, transformations, stats).
  Explication: isoler la logique data pour pouvoir itérer rapidement sur les features data science sans impacter le noyau.
  Livrable attendu: fonctions data regroupées dans un module dédié et testable isolément.

- [ ] `providers` (LLM, outils externes, connecteurs).
  Explication: encapsuler les intégrations externes pour éviter la propagation de dépendances dans toute l'application.
  Livrable attendu: points d'entrée provider unifiés et facilement remplaçables.

- [ ] `cli` (commandes, rendu terminal, UX).
  Explication: garder la couche terminal focalisée sur l'expérience utilisateur et la composition des commandes.
  Livrable attendu: CLI mince qui délègue la logique métier aux modules `core` et `data`.

- [ ] Remplacer progressivement les imports transverses par des contrats d'interface.
  Explication: réduire le couplage direct entre modules pour faciliter refactors, tests et maintenance long terme.
  Livrable attendu: dépendances explicites via interfaces, sans appels croisés ad hoc.

- [ ] Déplacer la logique métier data hors de la couche CLI.
  Explication: éviter que la logique d'analyse soit bloquée par des contraintes d'UI terminale.
  Livrable attendu: traitements data réutilisables depuis CLI, scripts et futures API internes.

### Phase 3 - Verticale Data Analysis / Data Science

- [ ] Ajouter ingestion: CSV, JSON, Parquet, SQL.
- [ ] Ajouter profiling dataset: types, nulls, distributions, outliers simples.
- [ ] Ajouter transformations reproductibles: filtre, map, agrégation, join.
- [ ] Ajouter un système de run traçable: inputs, paramètres, outputs, logs.
- [ ] Préparer un bridge Python optionnel (`pandas`/`polars`/`scikit-learn`).

### Phase 4 - Nettoyage final et docs

- [x] Supprimer définitivement les packages hors scope terminal.
- [x] Packages retirés: `app`, `desktop`, `web`, `enterprise`, `slack`, `console`, `containers`, `docs`, `extensions`, `function`, `identity`, `ui`.
- [x] Mettre à jour `README.md` pour refléter le positionnement terminal data.
- [x] Conserver un seul README à la racine.
- [x] Ajouter et maintenir `lessons.md` + `lesson.md` (pointeur).
- [ ] Ajouter un guide "architecture modulaire du fork" (règles de contribution).
- [ ] Ajouter un changelog de divergence avec l'upstream.

## 5. Critères de succès

- Les commandes terminales essentielles tournent sans dépendance web/desktop/enterprise.
- La structure du code permet d'ajouter une feature data sans modifier le noyau CLI.
- Les modules data peuvent être testés de façon isolée.
- Le diff avec upstream reste lisible et segmenté par modules.

## 6. Risques et mitigation

- Risque: casser des dépendances implicites entre packages.
- Mitigation: suppression en 2 temps (désactivation puis suppression).
- Risque: fork difficile à resynchroniser.
- Mitigation: changements petits, modulaires, et journalisés par domaine.

## 7. Prochain jalon recommandé

- Démarrer la Phase 2 en créant le squelette `core`/`data`/`providers`/`cli` sans changer le comportement fonctionnel.
