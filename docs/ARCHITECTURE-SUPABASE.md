# Architecture Supabase + Vercel

> Migration de l'architecture self-hosted (NestJS + Postgres + MinIO) vers une architecture cloud serverless gratuite.

## Vue d'ensemble

```
┌──────────────────┐                    ┌────────────────────────────┐
│                  │                    │     Supabase (cloud)        │
│   Vercel         │                    │  ┌─────────────────────┐   │
│   (Frontend)     │ ◄──── HTTPS ────► │  │ Auth (GoTrue)       │   │
│                  │   (PostgREST/     │  │ Postgres + RLS      │   │
│   React + Vite   │    GraphQL/       │  │ Storage (S3)         │   │
│   TanStack Query │    REST/RPC)      │  │ Edge Functions (Deno)│   │
│                  │                    │  │ Realtime             │   │
└──────────────────┘                    │  │ pg_cron              │   │
                                        │  └─────────────────────┘   │
                                        └────────────────────────────┘
```

## Ce qu'on supprime

- ❌ NestJS (apps/api) → remplacé par Supabase + Edge Functions
- ❌ MinIO → remplacé par Supabase Storage
- ❌ Notre auth JWT maison → remplacée par Supabase Auth
- ❌ Redis + BullMQ → remplacés par pg_cron + Edge Functions
- ❌ Caddy → Vercel HTTPS automatique
- ❌ La plupart des controllers/services NestJS → RLS policies + RPC functions

## Ce qu'on garde

- ✅ Le schéma de données Prisma (porté en SQL Supabase)
- ✅ Le frontend React + Vite + TanStack Query + shadcn UI
- ✅ Les schémas Zod (validation client uniquement maintenant)
- ✅ Le cahier des charges et la logique métier
- ✅ Docker Compose pour le dev local (via Supabase CLI)

## Sécurité : Row-Level Security (RLS)

Au lieu de vérifier les permissions dans le code backend, **PostgreSQL le fait directement**. Chaque table a des policies qui définissent qui peut lire/écrire/supprimer.

Exemple : la table `biens` a une policy "tu ne vois que tes propres biens" :

```sql
CREATE POLICY "biens_select_own"
  ON biens FOR SELECT
  USING (
    id IN (
      SELECT bien_id FROM bien_proprietaires bp
      JOIN proprietaires p ON p.id = bp.proprietaire_id
      WHERE p.owner_user_id = auth.uid()
    )
  );
```

Avantages :
- Impossible de faire fuiter des données par bug applicatif
- Le frontend peut requêter directement, on ne peut pas tricher
- Code backend réduit de ~70%

## Modes de fonctionnement

### Dev local (gratuit, offline)
```
Supabase CLI lance localement (via Docker) :
- Postgres
- Auth (GoTrue)
- Storage
- Edge Functions runtime
- Studio (UI BDD)

Frontend Vite dev server pointe vers http://localhost:54321
```

### Production (gratuit, public)
```
Supabase cloud (free tier 500 MB BDD, 1 GB storage, 50K MAU)
Vercel (free tier 100 GB bandwidth, build illimités)
```

## Migration des fonctionnalités

| Fonctionnalité v1 | v2 Supabase |
|---|---|
| Login JWT custom | `supabase.auth.signInWithPassword()` |
| GET /api/biens | `supabase.from('biens').select()` (RLS filtre) |
| POST /api/biens | `supabase.from('biens').insert()` |
| Upload document | `supabase.storage.from('documents').upload()` |
| Signed URL | `supabase.storage.from('documents').createSignedUrl(key, 3600)` |
| Génération PDF quittance | Edge Function `generate-quittance` |
| Génération mensuelle loyers | pg_cron + SQL function `generate_monthly_loyers()` |
| Calcul fiscalité 2044 | Edge Function `compute-fiscalite-2044` |
| Calcul IRL | Edge Function `apply-irl-revision` |
| Envoi mail | Edge Function appelant Resend / SendGrid |

## Limites du free tier Supabase

| Ressource | Free | Pour info |
|---|---|---|
| Postgres | 500 MB | ~5 000 biens / 50 000 loyers |
| Storage | 1 GB | ~500 quittances PDF + 200 photos |
| Bandwidth | 5 GB/mois | Largement suffisant |
| Edge Functions | 500 K invocations/mois | OK |
| Auth | 50 K MAU | OK |
| Backups | 7 jours rétention | OK |

Si on dépasse un jour : pro tier à 25$/mois.

## Limites du free tier Vercel

| Ressource | Free |
|---|---|
| Bandwidth | 100 GB/mois |
| Builds | Illimités |
| Functions | 100 K invocations/mois |
| Cron jobs | 1 par jour gratuit |

Pour un usage personnel, on est très loin des limites.

## Plan de migration (étapes)

### Étape 1 — Setup (faisable maintenant)
- Installer Supabase CLI
- Créer un projet Supabase cloud
- Importer le schéma SQL généré
- Lancer Supabase localement

### Étape 2 — Frontend
- Installer `@supabase/supabase-js`
- Créer un client Supabase singleton
- Remplacer la page Login par Supabase Auth
- Migrer une feature pilote (Propriétaires) en pur Supabase
- Valider l'approche

### Étape 3 — Migration progressive
- Migrer feature par feature : Biens, Locataires, Garants, Contrats…
- Chaque feature : remplacer les calls axios par Supabase client
- Supprimer le service NestJS correspondant

### Étape 4 — Edge Functions
- Génération PDF quittance (Deno + jsPDF ou pdf-lib)
- Calcul IRL et génération du courrier
- Calcul fiscalité 2044 + export

### Étape 5 — pg_cron
- Job mensuel : génération automatique des loyers
- Job quotidien : recalcul des statuts (RETARD, IMPAYE)
- Job mensuel : alertes pré-expiration diagnostics

### Étape 6 — Déploiement
- Push GitHub → Vercel détecte → déploie
- URL publique HTTPS automatique
- Supabase déjà en prod

### Étape 7 — Décommissionnement
- Suppression de apps/api (NestJS)
- Suppression de MinIO du docker-compose
- Mise à jour de la doc

## Risques et limites

1. **Vendor lock-in** Supabase : leur API n'est pas standard. Si on quitte, il faut réécrire l'auth et le storage. La BDD reste portable (Postgres standard).
2. **Latence** : free tier peut avoir des cold starts (Edge Functions endormies)
3. **Limite 500 MB BDD** : si vous gérez beaucoup de biens (>5 000), il faudra passer en pro
4. **Pas de WebSocket persistant** sur Vercel : utiliser Supabase Realtime à la place
5. **Cron Vercel limité** : seulement 1 job/jour en gratuit (sinon utiliser pg_cron Supabase, illimité)

## Décision

**On y va.** Pour un usage personnel avec quelques biens, c'est de loin la meilleure solution :
- Aucun coût
- Aucune maintenance d'infra
- Backups automatiques
- HTTPS et CDN gratuits
- Code backend réduit drastiquement
