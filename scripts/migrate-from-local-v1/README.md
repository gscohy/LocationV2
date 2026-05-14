# Migration des données loc_local → Supabase v2

Script de migration en deux étapes : **discover** (inspection lecture seule) puis **migrate** (import effectif).

## Setup (à faire une seule fois)

1. Ouvre un terminal dans ce dossier :
   ```powershell
   cd c:\Site\LocationV2\scripts\migrate-from-local-v1
   ```

2. Installe les dépendances :
   ```powershell
   npx.cmd --yes pnpm@9.12.0 install
   ```

3. Copie `.env.example` en `.env` et remplis les 4 variables :
   ```powershell
   copy .env.example .env
   notepad .env
   ```

   - **LOCAL_DB_URL** : chaîne de connexion vers ta base locale (celle ouverte dans DBeaver).
     Format : `postgresql://USER:PASSWORD@localhost:5432/loc_local`
   - **SUPABASE_URL** : déjà rempli (`https://yrlczclebqycmyazsjzj.supabase.co`)
   - **SUPABASE_SERVICE_ROLE_KEY** : à récupérer sur https://supabase.com/dashboard/project/yrlczclebqycmyazsjzj/settings/api → bouton « Reveal » sur la ligne `service_role` (en haut). ⚠️ Cette clé donne tous les droits, à révoquer après la migration.
   - **SUPABASE_OWNER_USER_ID** : à récupérer sur https://supabase.com/dashboard/project/yrlczclebqycmyazsjzj/auth/users → clique sur ton user → copie l'UID (UUID format).

## Étape 1 — Discover (lecture seule)

```powershell
npm run discover > sortie-discover.txt
```

Ouvre `sortie-discover.txt` et colle son contenu dans le chat avec Claude. Cette étape ne touche à rien, elle inspecte juste ta base pour adapter le script de migration.

## Étape 2 — Migration

**Toujours commencer par un dry-run** (lit les données locales, transforme, mais **n'écrit rien** dans Supabase) :

```powershell
node migrate.mjs --dry-run
```

Tu verras pour chaque table un échantillon de la 1re ligne transformée. Inspecte-le, et si quelque chose te paraît anormal, signale-le avant l'apply.

**Quand le dry-run a l'air OK**, lance la vraie migration :

```powershell
node migrate.mjs --apply
```

### Options

- `--tables=proprietaires,biens,loyers` : ne traite que certaines tables (utile pour reprendre une migration interrompue)
- `--resume` : recharge le mapping depuis `.mapping.json` (créé après chaque table OK) — permet de relancer sans dupliquer

### Après une migration réussie

1. Ouvre l'app (http://localhost:3000) et vérifie que les données sont visibles
2. **Ré-uploade les signatures** propriétaires via Paramètres → fiche propriétaire (les chemins fichier locaux ne sont pas transférés)
3. **Révoque la SUPABASE_SERVICE_ROLE_KEY** :
   https://supabase.com/dashboard/project/yrlczclebqycmyazsjzj/settings/api → bouton « Reset »
4. Supprime le `.env` ou retire au moins la `SUPABASE_SERVICE_ROLE_KEY`

### Tables NON migrées

`contrat_historique`, `echeances_prets`, `email_templates`, `lots`, `playing_with_neon`, `settings`, `users`, `documents` (fichiers locaux).

Si tu veux quand même une de ces tables, dis-le moi et j'ajouterai le mapping.
