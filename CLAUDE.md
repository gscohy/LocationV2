# CLAUDE.md - Contexte projet pour Claude Code

> Projet : application web de gestion locative immobilière personnelle.
> Repartir from scratch sur les specs + schema. Le frontend est à coder.

## Etat du projet

### Ce qui est deja fait (specs + design)
- docs/CAHIER-DES-CHARGES-V2.md : cahier des charges exhaustif (27 sections)
- docs/ARCHITECTURE-SUPABASE.md : architecture cible
- docs/DEPLOY-VERCEL-SUPABASE.md : guide deploiement
- docs/DIAGNOSTIC.md : analyse de la v1 (https://github.com/gscohy/LOC) qui montre quoi NE PAS refaire
- supabase/migrations/ : SQL Postgres complet (tables + RLS policies)
- supabase/functions/ : Edge Functions squelettes (Deno) pour generation PDF quittance + loyers mensuels
- supabase/config.toml : config Supabase CLI pour dev local
- supabase/seed.sql : indices IRL initiaux
- packages/shared/src/schemas/ : schemas Zod (validation cote front, source de verite)
- vercel.json + .env.local.example : prets pour deploiement

### Ce qui est a faire (code)
1. Initialiser le frontend React + Vite + TypeScript dans apps/web/
2. Implementer les pages : auth, dashboard, proprietaires, biens, locataires, garants, contrats, loyers, paiements, quittances
3. Utiliser @supabase/supabase-js pour parler a Supabase (BDD + Auth + Storage + Edge Functions)
4. Composants UI style shadcn/ui (Radix + Tailwind)
5. TanStack Router (routes file-based) + TanStack Query v5
6. Forms : react-hook-form + Zod resolver (schemas dans packages/shared)
7. Lancer Supabase local via `supabase start`, deployer en prod via `supabase db push`
8. Deployer le frontend sur Vercel

## Stack imposee

- React 18 + Vite 5 + TypeScript strict
- TanStack Router + TanStack Query v5
- Tailwind CSS 3 + shadcn/ui (composants Radix reecrits)
- react-hook-form + Zod
- @supabase/supabase-js
- date-fns, lucide-react, sonner (toasts)
- Monorepo pnpm + Turborepo

## Conventions

- Langue : francais (UI, commentaires, doc)
- TypeScript strict : pas de `any`, pas de `// @ts-ignore`
- Validation : schemas Zod dans packages/shared (source unique frontend + edge functions)
- Style : Prettier (.prettierrc.json), 100 cols, single quotes, trailing commas
- Commits : Conventional Commits (feat:, fix:, refactor:, docs:, chore:)
- Imports : sans extension `.js`
- Routing frontend : TanStack Router file-based (routes/_app.<page>.tsx)
- Data fetching : useQuery / useMutation
- Securite : RLS Postgres (policies deja ecrites dans supabase/migrations/)

## Premiere session Claude Code suggeree

Demandez par exemple :
1. "Lis docs/CAHIER-DES-CHARGES-V2.md et docs/ARCHITECTURE-SUPABASE.md"
2. "Initialise le monorepo pnpm + Turborepo, et apps/web avec Vite + React + TypeScript + Tailwind + TanStack Router/Query + shadcn/ui"
3. "Cree le client Supabase singleton dans apps/web/src/lib/supabase.ts"
4. "Cree la page de login avec Supabase Auth"
5. "Cree le module Proprietaires bout-en-bout : page liste + dialog creation, en utilisant le schema Zod dans packages/shared"
6. "Continue avec Biens, Locataires, Garants, Contrats..."

## References

- Doc Supabase : https://supabase.com/docs
- Cahier des charges : voir docs/CAHIER-DES-CHARGES-V2.md (toutes les regles metier)
- Lois francaises baux : 6 juillet 1989, ALUR 24 mars 2014, ELAN 23 novembre 2018
