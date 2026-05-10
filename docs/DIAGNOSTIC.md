# Diagnostic du projet existant (gscohy/LOC)

> Analyse réalisée le 2026-05-10 sur la base du dépôt https://github.com/gscohy/LOC

## Stack actuelle

| Couche | Technologies |
|---|---|
| Backend | Node.js, Express 4, TypeScript, Prisma 5, JWT, Multer, Nodemailer, PDFKit |
| Frontend | React 18, Vite 5, TypeScript, Tailwind, React Query v3, React Router 6, react-hook-form, Zod |
| Base | PostgreSQL (Neon ou Supabase) |
| Stockage fichiers | Disque local + Google Drive (workaround) |
| Déploiement | Render / Railway |

**Volumétrie**

- Backend : ~15 000 lignes TypeScript
- Frontend : ~36 000 lignes TypeScript / TSX
- 39 pages React, 60 composants
- 20 fichiers de routes Express, dont plusieurs > 800 lignes

## Ce qui est solide (à conserver)

1. **Cahier des charges métier** : périmètre mature et bien pensé (paiements multi-payeurs, IRL, indivision avec quote-parts, simulation de revente, fiscalité 2044).
2. **Modèle de données central** : entités correctement identifiées (`Bien`, `Contrat`, `Locataire`, `Garant`, `Loyer`, `Paiement`, `Quittance`, `Charge`, `PretImmobilier`, `EcheancePret`) avec les bonnes tables de jointure (`BienProprietaire.quotePart`, `ContratLocataire`, `LocataireGarant`).
3. **Choix Prisma + PostgreSQL** : pertinent pour la persistance.
4. **Validation Zod** : bon réflexe, à conserver.
5. **Structure feature-based du frontend** : un dossier par module métier.

## Ce qui doit être refait

### 1. Architecture backend : pas de couche service

Toute la logique métier (validation, accès BDD, calculs, génération PDF, envoi mail) vit dans les route handlers Express. Conséquences :

- Code non testable (les routes ne sont pas isolables)
- Logique métier dupliquée entre routes proches
- Fichiers monstrueux : `loyers.ts` (1147 lignes), `fiscalite.ts` (1194 lignes), `quittances.ts` (927 lignes), `emails.ts` (873 lignes), `paiements.ts` (867 lignes)
- Difficile à faire évoluer sans régression

### 2. Multiples instanciations de PrismaClient

12 fichiers de routes créent leur propre `new PrismaClient()` au lieu d'utiliser un singleton. **Risque d'épuisement du pool de connexions** en production sous charge.

### 3. Doublons de routes

`biens.ts` + `biens-details.ts`, `contrats.ts` + `contrats-details.ts`, `loyers.ts` + `loyers-generation.ts` sont montés sur le même chemin `/api/...`. Trace de patches successifs sans refactoring.

### 4. Stockage des fichiers cassé (le problème "preuves de travaux non visualisables")

**Trois mécanismes incohérents coexistent** :

- Une table `Document` propre (`chemin`, `type`, `categorie`, `typeDoc`)
- Des champs JSON `documents` et `photos` sur `Bien`, `Locataire`, `Garant`, `Contrat` (commentés "legacy" mais encore utilisés)
- Des uploads disque locaux séparés pour `charges` (sous-dossier `factures`) et `documents` (sous-dossier `documents`)

Sur Render/Railway, le **système de fichiers est éphémère** : à chaque redéploiement, les fichiers uploadés sont perdus. D'où la tentative d'intégration Google Drive en rustine. Conséquence directe : les preuves de travaux saisies en BDD ne sont plus accessibles.

### 5. Code mort partout (UI/UX)

Pages dupliquées non nettoyées :

- `BiensPage`, `BiensPageFixed`, `BiensPageSimple`, `BiensPageComplete`, `TestBienDetailsPage`
- `ContratsPage` + `ContratsPageNew`
- `LocatairesPage` + `LocatairesPageComplete`

Pages de test routées en production : `/test-documents`, `/debug-documents`, `/simple-upload`, `/drop-test`, `/diagnostic`.

### 6. Sécurité approximative

- JWT secret par défaut codé en dur en fallback (`'your-secret-key'`)
- Multer accepte le `mimetype` envoyé par le client (falsifiable, pas de vérification magic-number)
- Rôles définis en BDD (`ADMIN`, `GESTIONNAIRE`, `LECTEUR`) mais le middleware ne les enforce quasiment pas
- Pas d'antivirus / sandbox sur les fichiers uploadés
- Pas de tests automatisés (zéro `.test.ts` / `.spec.ts`)

### 7. Stack legacy par endroits

- React Query v3 (TanStack Query v5 maintenant, API très différente)
- Pas de typed router
- Types frontend dupliqués manuellement par rapport aux schémas Zod backend

### 8. Fonctionnalités manquantes par rapport au cahier des charges

- Indexation IRL automatique avec courrier généré
- Simulation de revente (plus-value, frais notaire, scénario de sortie)
- Calcul de rentabilité (brute, nette, nette-nette)
- Calendrier d'alertes consolidé (fin de bail, IRL, échéance crédit, assurance)
- **Gestion des diagnostics** (DPE, plomb, amiante, électricité, gaz, ERP, audit énergétique) avec dates de validité et alertes d'expiration

## Conclusion

Le projet est **partiellement fonctionnel** et porte une **vraie valeur métier** dans son cahier des charges et son modèle de données central. Les défauts sont structurels (architecture, sécurité, stockage) et trop nombreux pour être corrigés par refactoring incrémental. La refonte from-scratch en réutilisant le modèle de données et la logique métier est le bon choix.
