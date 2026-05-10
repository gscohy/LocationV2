# Setup Supabase

## Dev local (Supabase CLI)

### Prérequis
- Docker Desktop (déjà installé)
- Supabase CLI : https://supabase.com/docs/guides/cli/getting-started

Sur Windows, installer via `scoop` ou en téléchargeant l'exécutable :
```
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Ou : télécharger `supabase_windows_amd64.tar.gz` depuis https://github.com/supabase/cli/releases

### Démarrage
Dans `C:\Projet\Location` :

```
supabase start
```

Au premier lancement (5-10 min) Supabase télécharge ses images Docker et démarre l'ensemble :
- Postgres : port 54322
- API REST/PostgREST : port 54321
- Studio (UI) : http://localhost:54323
- Auth : intégré dans l'API
- Storage : intégré dans l'API
- Inbucket (email de test) : http://localhost:54324

À la fin, vous verrez un récap avec les URLs et les clés API à mettre dans le `.env` du frontend.

### Migrations
Les fichiers SQL dans `supabase/migrations/` sont automatiquement appliqués au démarrage.

Pour créer une nouvelle migration :
```
supabase migration new nom_de_la_migration
```

Pour appliquer manuellement :
```
supabase db reset
```

### Créer un user de test

Dans Studio (http://localhost:54323) :
1. Authentication → Users → Invite
2. Saisir email + mot de passe
3. L'utilisateur est créé, le profile est créé automatiquement par le trigger

Ou via la CLI :
```
supabase db psql -c "INSERT INTO auth.users (instance_id, id, email, encrypted_password, email_confirmed_at, raw_user_meta_data) VALUES ('00000000-0000-0000-0000-000000000000', uuid_generate_v4(), 'admin@local.test', crypt('admin', gen_salt('bf')), NOW(), '{\"nom\":\"Admin\",\"prenom\":\"Test\",\"role\":\"ADMIN\"}')"
```

## Production (Supabase cloud)

### Création du projet
1. https://supabase.com → Sign in → New project
2. Choisir nom (`gestion-locative-prod`), mot de passe BDD, région (Frankfurt pour la France)
3. Attendre la création (~2 min)

### Application des migrations
Lier le projet local au projet cloud :
```
supabase link --project-ref <votre-project-ref>
```

Puis pousser les migrations :
```
supabase db push
```

### Variables d'environnement à récupérer
Dans Supabase Studio → Project Settings → API :
- `Project URL` → `VITE_SUPABASE_URL`
- `anon public key` → `VITE_SUPABASE_ANON_KEY`

À mettre dans Vercel (Settings → Environment Variables).

### Création du premier user admin
Authentication → Users → Invite User → saisir votre email
Le mot de passe sera défini via le mail de confirmation.

## Buckets Storage

Créer dans Supabase Studio → Storage :
- `documents` (privé)
- `quittances` (privé)
- `diagnostics` (privé)

Les policies de storage seront configurées via SQL (à venir).
