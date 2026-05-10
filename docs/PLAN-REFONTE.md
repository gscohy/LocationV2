# Plan de refonte — Application de gestion locative v2

## Objectifs

1. **Robustesse** : architecture en couches, tests automatisés, types stricts bout-en-bout.
2. **Maintenabilité long terme** : monorepo typé, conventions strictes, documentation à jour.
3. **Auto-hébergement** : tourne sur votre PC/serveur local en une commande Docker, sans dépendance cloud payante.
4. **Périmètre fonctionnel complet** : tout le cahier des charges, y compris IRL, diagnostics, simulation de revente.
5. **Stockage fichier fiable** : MinIO local (S3-compatible), accès via signed URLs, plus de pertes au redéploiement.

## Stack technique

| Couche | Choix | Raison |
|---|---|---|
| Backend | **NestJS** + TypeScript | Architecture en modules imposée, DI native, guards/pipes/interceptors, écosystème mature |
| ORM | **Prisma 5** | On garde — excellent typage, migrations, studio |
| BDD | **PostgreSQL 16** (Docker) | Robuste, transactions, JSONB pour métadonnées flexibles |
| Cache / Jobs | **Redis 7** + BullMQ | File de jobs pour mails, PDFs, rappels |
| Stockage objets | **MinIO** (S3-compatible) | Auto-hébergé, signed URLs, fini Google Drive |
| Frontend | **React 18 + Vite 5** | On garde — productif et rapide |
| Routing | **TanStack Router** | Routes typées, code-splitting auto |
| Data fetching | **TanStack Query v5** | Migration depuis React Query v3 |
| UI kit | **shadcn/ui** + Radix + Tailwind | Composants accessibles, propres, modifiables |
| Forms | **react-hook-form + Zod** | On garde |
| PDF | **@react-pdf/renderer** | Templates JSX (vs pdfkit impératif) |
| Mail | **Nodemailer** + queue Redis | On garde, asynchrone |
| Tests | **Vitest** + **Playwright** | Unitaires + e2e |
| Reverse proxy | **Caddy** | HTTPS auto en LAN, simple à configurer |
| Orchestration | **Docker Compose** | Une commande pour tout démarrer |
| CI | **GitHub Actions** | Lint, typecheck, tests, build |

## Architecture — monorepo

```
gestion-locative/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/        # Un dossier par module métier
│   │   │   │   ├── proprietaires/
│   │   │   │   │   ├── proprietaires.controller.ts
│   │   │   │   │   ├── proprietaires.service.ts
│   │   │   │   │   ├── proprietaires.module.ts
│   │   │   │   │   └── dto/
│   │   │   │   ├── biens/
│   │   │   │   ├── locataires/
│   │   │   │   ├── garants/
│   │   │   │   ├── contrats/
│   │   │   │   ├── loyers/
│   │   │   │   ├── paiements/
│   │   │   │   ├── quittances/
│   │   │   │   ├── charges/
│   │   │   │   ├── prets/
│   │   │   │   ├── fiscalite/
│   │   │   │   ├── irl/
│   │   │   │   ├── diagnostics/
│   │   │   │   ├── rappels/
│   │   │   │   ├── documents/
│   │   │   │   ├── notifications/
│   │   │   │   └── auth/
│   │   │   ├── jobs/           # CRON : génération loyers, rappels, alertes
│   │   │   ├── common/         # guards, pipes, decorators, filters
│   │   │   ├── infrastructure/ # PrismaService, S3Service, MailService, PdfService
│   │   │   └── main.ts
│   │   └── test/
│   └── web/                    # React/Vite frontend
│       ├── src/
│       │   ├── features/       # Un dossier par feature
│       │   │   ├── proprietaires/
│       │   │   ├── biens/
│       │   │   └── ...
│       │   ├── components/     # ui (shadcn) + layout
│       │   ├── lib/            # api client, utils
│       │   ├── routes/         # TanStack Router
│       │   └── main.tsx
│       └── test/
├── packages/
│   ├── db/                     # Schéma Prisma + migrations + seeds
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   └── package.json
│   ├── shared/                 # Schémas Zod partagés api ↔ web
│   │   └── src/
│   │       ├── schemas/
│   │       └── types.ts
│   └── config/                 # tsconfig, eslint, prettier partagés
├── infra/
│   ├── docker-compose.yml      # Postgres + Redis + MinIO + Caddy
│   ├── docker-compose.dev.yml  # services seuls (sans api/web) pour dev
│   ├── Caddyfile
│   └── .env.example
├── docs/
│   ├── DIAGNOSTIC.md
│   ├── PLAN-REFONTE.md
│   ├── SCHEMA-V2.md
│   ├── ARCHITECTURE.md
│   └── MIGRATION.md
├── scripts/
│   └── migrate-from-v1.ts      # Migration des données depuis l'ancienne BDD
├── package.json                # workspace root
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

## Modèle de données — corrections principales

### Suppressions

- `Bien.documents` (JSON), `Bien.photos` (JSON)
- `Locataire.documents` (JSON)
- `Garant.documents` (JSON)
- `Contrat.documents` (JSON)
- `Charge.facture` (URL libre)

→ Tout passe par la table `Document` unique, avec `storageKey` (clé MinIO) et signed URL pour la visualisation.

### Modifications

- `Document` gagne : `storageKey`, `bucket`, `checksum`, `uploadedById`. Validation `mimeType` côté serveur (magic-number).
- `User.role` typé enum : `ADMIN | GESTIONNAIRE | LECTEUR` (au lieu de String).
- Statuts typés en enum : `Loyer.statut`, `Bien.statut`, `Contrat.statut`, `PretImmobilier.statut`.

### Nouvelles entités

- **`Diagnostic`** : type (`DPE`, `PLOMB`, `AMIANTE`, `ELEC`, `GAZ`, `ERP`, `AUDIT_ENERGETIQUE`), `dateRealisation`, `dateExpiration`, `documentId`, `bienId`. Job CRON crée des notifications à J-90, J-30 de l'expiration.
- **`IndiceIRL`** : `trimestre` (1-4), `annee`, `valeur`. Référentiel des indices INSEE.
- **`RevisionLoyer`** : `contratId`, `dateApplication`, `ancienLoyer`, `nouveauLoyer`, `indiceReferenceTrimestre`, `indiceReferenceAnnee`, `indiceRevisionTrimestre`, `indiceRevisionAnnee`, `courrierDocumentId`. Application IRL avec traçabilité.
- **`EtatLieux`** : `contratId`, `type` (`ENTREE | SORTIE`), `date`, `documentId`, `signe`. Distinct du contrat lui-même.
- **`Notification`** : `userId`, `type`, `titre`, `message`, `lue`, `lien`, `payload`, `createdAt`. Pour alertes fin de bail, IRL, retards, diags.
- **`PaiementVentilation`** (optionnelle) : permet à un même paiement de couvrir plusieurs loyers (cas CAF qui paie 3 mois à la fois).

## Plan de migration

### Phase 0 — Fondations (1-2 jours)

- [x] Diagnostic + plan documentés
- [ ] Monorepo initialisé (pnpm + Turborepo)
- [ ] Docker Compose avec Postgres + Redis + MinIO + Caddy
- [ ] Schéma Prisma v2 finalisé
- [ ] Squelettes apps/api (NestJS) + apps/web (Vite)
- [ ] CI GitHub Actions (lint, typecheck, tests)
- [ ] README et guide de démarrage

### Phase 1 — Socle applicatif (1 semaine)

- Module `auth` : login, refresh, RBAC réel via guards
- Module `users` : CRUD utilisateurs, rôles
- Module `documents` : upload S3 (MinIO), signed URLs, vérification magic-number
- Module `proprietaires` : CRUD complet + tests
- Frontend : layout, login, page propriétaires, design system (shadcn) initialisé

### Phase 2 — Biens et contrats (1 semaine)

- Modules `biens` (avec lots, photos, règlement intérieur)
- Module `locataires` + `garants`
- Module `contrats` (avec multi-locataires, état des lieux séparés)
- Frontend : pages correspondantes

### Phase 3 — Cœur financier (1-2 semaines)

- Module `loyers` : génération mensuelle automatique (job CRON)
- Module `paiements` : paiements partiels, multi-payeurs, multi-dates, ventilation
- Module `quittances` : génération PDF (@react-pdf), envoi mail asynchrone (BullMQ)
- Module `rappels` : J+5, J+15, J+30, mise en demeure
- Frontend : tableau de bord financier

### Phase 4 — Charges, prêts, fiscalité (1 semaine)

- Module `charges` : ponctuelles + récurrentes, catégorisation
- Module `prets` : import XLS, échéancier, intérêts/capital pour 2044
- Module `fiscalite` : calcul revenu net foncier, export PDF 2044
- Frontend : tableaux et graphiques

### Phase 5 — Modules avancés (1-2 semaines)

- Module `irl` : import indices INSEE, calcul automatique, génération courrier
- Module `diagnostics` : suivi DPE/plomb/amiante/etc., alertes expiration
- Module `notifications` : centre de notifications + envoi email
- Calendrier consolidé (fin de bail, IRL, échéances, diags)
- Calcul rentabilité brute / nette / nette-nette
- Suivi vacance locative
- Simulation de revente (plus-value, scénario PDF)
- Frontend : dashboard enrichi

### Phase 6 — Migration et polish (1 semaine)

- Script `scripts/migrate-from-v1.ts` : lit la BDD Postgres existante, télécharge les fichiers (legacy JSON + Document + uploads disque), upload MinIO, recrée tout proprement
- Tests Playwright sur les flux critiques
- Documentation utilisateur
- Backup automatique BDD + MinIO

## Conventions

- **Commits** : Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`...)
- **Branches** : `main` (prod), `dev` (intégration), `feat/<module>-<description>`
- **Code review** : self-review systématique via PR sur `dev`
- **Lint/format** : ESLint + Prettier en CI, hook pre-commit (husky + lint-staged)
- **Tests** : Vitest pour unitaires (modules métier), Playwright pour e2e (flux critiques)
- **Types** : `strict: true` partout, pas de `any`, pas de `// @ts-ignore`

## Décisions techniques notables

1. **Pourquoi NestJS plutôt que rester sur Express ?** Architecture imposée par le framework (modules/services/controllers), DI native qui facilite les tests, écosystème complet (validation, RBAC, queues, swagger, websockets) sans dépendances tierces à choisir une à une. La courbe d'apprentissage est compensée par le gain de structure sur un projet de cette taille.

2. **Pourquoi MinIO plutôt qu'un dossier disque ?** Compatible API S3 (donc migration facile vers R2/Backblaze plus tard si besoin), signed URLs natifs (pas d'exposition directe des fichiers), versioning, gestion concurrente. Tourne dans un container Docker, pas plus complexe qu'un dossier mais bien plus robuste.

3. **Pourquoi Redis ?** Indispensable pour les jobs asynchrones (génération PDF lourde, envoi mails) afin de ne pas bloquer la requête HTTP. Aussi utile pour cache léger.

4. **Pourquoi un monorepo ?** Permet de partager les schémas Zod entre backend et frontend (validation cohérente bout-en-bout, types dérivés automatiquement) et de scripts de migration / outils dans un seul `pnpm install`.
