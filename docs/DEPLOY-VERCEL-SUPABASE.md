# Guide de déploiement Vercel + Supabase

## Étape 1 — Supabase cloud

1. https://supabase.com → New Project
2. Nom : `gestion-locative-prod` (ou votre choix)
3. Mot de passe BDD : générez et **conservez-le**
4. Région : `Frankfurt (EU Central)` pour la France
5. Plan : **Free**

Attendre 2 min que le projet se crée.

## Étape 2 — Appliquer les migrations

Sur votre PC, dans `C:\Projet\Location` :

```
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

Le `project-ref` se trouve dans l'URL Supabase Studio (`https://supabase.com/dashboard/project/XXXX`).

## Étape 3 — Créer les buckets Storage

Dans Supabase Studio → Storage → Create bucket :
- `documents` — Public : ❌
- `quittances` — Public : ❌
- `diagnostics` — Public : ❌

Puis dans SQL Editor, configurer les policies :

```sql
-- Lecture des fichiers : seulement si on est l'uploader ou le propriétaire concerné
CREATE POLICY "users_can_read_own_files"
  ON storage.objects FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Upload : seulement les utilisateurs authentifiés
CREATE POLICY "users_can_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Suppression : seulement par celui qui a uploadé
CREATE POLICY "users_can_delete_own"
  ON storage.objects FOR DELETE
  USING (auth.uid() = owner);
```

## Étape 4 — Créer le premier utilisateur admin

Dans Studio → Authentication → Users → **Invite user**
Saisir votre email. Vous recevrez un mail pour définir le mot de passe.

Après confirmation, son `role` dans `profiles` sera `ADMIN` (par défaut, voir trigger handle_new_user).

## Étape 5 — Déployer les Edge Functions

```
supabase functions deploy generate-quittance
supabase functions deploy generate-monthly-loyers
```

Configurer la variable secrète si nécessaire :
```
supabase secrets set RESEND_API_KEY=re_xxxxxx
```

## Étape 6 — Configurer le CRON (génération mensuelle)

Dans Studio → SQL Editor :

```sql
-- Activer pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Tâche : 1er du mois à 06h, génère les loyers
SELECT cron.schedule(
  'generate-monthly-loyers',
  '0 6 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://<votre-project-ref>.supabase.co/functions/v1/generate-monthly-loyers',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object('force', false)
  );
  $$
);
```

## Étape 7 — Déployer le frontend sur Vercel

### Via l'UI Vercel
1. https://vercel.com → New Project
2. Import GitHub repo (`gscohy/LOC` ou votre fork)
3. Framework Preset : **Other** (Vercel détectera via vercel.json)
4. Root Directory : laisser racine
5. Environment Variables :
   - `VITE_SUPABASE_URL` = `https://<project-ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = clé anon récupérée dans Supabase Studio
6. Deploy

Vercel build votre app et la met en ligne sur `https://<project>.vercel.app` en HTTPS.

### Via CLI Vercel (alternative)

```
npm install -g vercel
vercel login
vercel link
vercel env add VITE_SUPABASE_URL production
vercel env add VITE_SUPABASE_ANON_KEY production
vercel --prod
```

## Étape 8 — Vérifier

Ouvrir l'URL Vercel → Login avec votre user admin → Tester la création d'un propriétaire, d'un bien…

## Mise à jour future

Push sur `main` (ou la branche connectée à Vercel) → déploiement automatique.

Pour les migrations BDD :
```
supabase db push
```

## Coût total

**0 €** tant que vous restez dans les limites des free tiers (largement suffisants pour un usage personnel).
