# Démarrage en 5 minutes

## 1. Cloner et installer

```bash
git clone <url> gestion-locative
cd gestion-locative
corepack enable
pnpm install
```

## 2. Variables d'environnement

```bash
cp .env.example .env
```

Éditer `.env` et **remplacer impérativement** :

- `JWT_SECRET` → chaîne aléatoire ≥ 64 caractères (`openssl rand -hex 64`)
- `POSTGRES_PASSWORD` → mot de passe Postgres
- `MINIO_ROOT_PASSWORD` et `S3_SECRET_KEY` → même valeur, mot de passe MinIO

## 3. Démarrer l'infrastructure

```bash
pnpm infra:up
```

Vérifier que les 3 services tournent :

```bash
docker compose -f infra/docker-compose.yml ps
```

Vous devriez voir `gl-postgres`, `gl-redis`, `gl-minio` en `running`/`healthy`.

## 4. Initialiser la base

```bash
pnpm db:generate   # Génère le client Prisma
pnpm db:push       # Crée les tables (en dev)
pnpm db:seed       # Crée l'admin et les templates email
```

## 5. Lancer l'application

```bash
pnpm dev
```

Ouvrir http://localhost:5173 et se connecter avec `admin@local` / `admin`.

## En cas de souci

| Problème | Solution |
|---|---|
| `port 5432 already in use` | Un autre Postgres tourne, arrêter ou changer le port dans `docker-compose.yml` |
| `Cannot find module '@gl/db'` | Lancer `pnpm install` puis `pnpm db:generate` |
| MinIO refuse l'upload | Vérifier que les buckets sont créés : http://localhost:9001 |
| Login impossible | Re-seeder : `pnpm db:seed` |
| Reset complet | `pnpm infra:reset && pnpm db:push && pnpm db:seed` |

## Accès depuis un autre PC du LAN

L'API et le frontend écoutent sur `0.0.0.0`, donc accessibles depuis le réseau local. Sur les machines clientes, ouvrir :

- http://<IP-du-serveur>:5173 (frontend dev)

Pour la prod auto-hébergée avec Caddy + HTTPS sur le LAN, voir `infra/README.md`.
