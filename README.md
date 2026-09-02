# Proof & Perk Loyalty Program

A deliberately small full-stack implementation of the supplied loyalty-program assessment. Members register, submit receipt files, track validation, and receive one voucher for every approved receipt. Administrators review the receipt queue and approve or reject submissions.

## Stack

- React + Vite frontend
- Node.js + Express REST API
- PostgreSQL with `pg` and an explicit SQL schema
- Bearer-token authentication with JWT; passwords hashed with bcrypt
- Multer local file storage (5 MB maximum; JPG, PNG, WEBP, and PDF)

## Docker Compose quick start

Docker Compose is the recommended container workflow for this assessment. The repository Makefile wraps the complete local workflow, creates `.env` with generated local secrets when it is missing, and waits for every service to become healthy.

```bash
make
```

Open `http://localhost:3000`. To retrieve the generated local administrator login, inspect service status, follow logs, or stop the stack without deleting data:

```bash
make credentials
make ps
make logs
make down
```

Run `make help` to list every supported command. The equivalent raw Docker Compose workflow is:

```bash
cp .env.example .env
# Replace JWT_SECRET, ADMIN_PASSWORD, and POSTGRES_PASSWORD before starting.
docker compose up --build -d
docker compose ps
```

Open `http://localhost:3000` (or the `APP_PORT` configured in `.env`). View logs with `docker compose logs -f app` and stop the stack with `docker compose down`. PostgreSQL data and uploaded receipts remain in named volumes. To deliberately erase both, use `docker compose down --volumes`.

For the temporary VPS deployment, layer `compose.vps.yaml` over the base file. It attaches only the application container to the existing `memora_public` proxy network under the `antlysis-loyalty-app` alias; PostgreSQL remains on the private Compose network.

```bash
docker compose -f compose.yaml -f compose.vps.yaml up --build -d
```

The deployed assessment is available at [https://antlysis-loyalty.axelyn.com](https://antlysis-loyalty.axelyn.com). Public traffic is served over HTTPS through Cloudflare and the existing Caddy reverse proxy on `vps`; plain HTTP is redirected to HTTPS. TLS terminates at the proxy layer, while the Node.js application remains on the Docker network and PostgreSQL remains private.

The application image uses a multi-stage build, contains only production dependencies at runtime, runs as a non-root user, and includes a health check. Compose waits for PostgreSQL to become healthy and for the one-shot schema/admin setup service to finish before starting the app.

Docker Swarm is intentionally not included. It would add deployment complexity without helping this single-instance assessment, and the accepted local receipt storage is not safe to replicate across Swarm nodes. A real multi-node deployment should first move receipts to object storage and PostgreSQL to a managed/external service, then use orchestrator secrets and rolling-update policies.

## Setup

Prerequisites: Node.js `^20.19.0` or `>=22.12.0` (Node.js 24 recommended), npm, and PostgreSQL 14+.

1. Install packages:

   ```bash
   npm install
   ```

2. Create a PostgreSQL database, copy the environment template, and edit its values:

   ```bash
   createdb loyalty_program
   cp .env.example .env
   ```

   Generate a strong JWT secret, for example with `openssl rand -hex 32`. The upload directory is created automatically.

3. Apply the database schema and create/update the administrator from the `ADMIN_EMAIL` and `ADMIN_PASSWORD` values in `.env`:

   ```bash
   npm run db:schema
   npm run seed:admin
   ```

4. Start both development servers:

   ```bash
   npm run dev
   ```

   Open `http://localhost:5173`. The API runs at `http://localhost:3000`.

For a production-style local run, use `npm run build && npm start`, then open `http://localhost:3000`.

## Database setup, schema, and seed

The authoritative PostgreSQL schema is [`server/db/schema.sql`](server/db/schema.sql). The schema runner reads `DATABASE_URL` from `.env` and applies that file, while the administrator seed reads `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

For a manual local setup:

```bash
createdb loyalty_program
cp .env.example .env
# Set DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, and other required values.
npm run db:schema
npm run seed:admin
```

`npm run db:schema` can be run repeatedly: the schema uses guarded type creation, `CREATE TABLE IF NOT EXISTS`, and `CREATE INDEX IF NOT EXISTS`. This small assessment uses that idempotent schema bootstrap instead of a versioned migration framework, so it does not provide migration history or automatic rollback. A production system should introduce ordered migrations before making incremental schema changes.

`npm run seed:admin` creates the administrator when `ADMIN_EMAIL` is absent, or updates the matching account's role and bcrypt password hash when it already exists. It never stores the configured password as plaintext.

Docker Compose performs both steps automatically through the one-shot `app-init` service before starting the application. To rerun the schema and administrator setup against an existing Docker database:

```bash
make db-setup
# Equivalent: docker compose run --rm app-init
```

## Tests

```bash
make verify
# Equivalent: npm test && npm run build
```

The tests cover receipt input validation and the critical approval transaction: approve creates one voucher, repeated approval is rejected, rejection creates none, and missing/invalid decisions are controlled errors. The database schema also enforces unique voucher source receipts and unique order IDs per member.

## CI/CD and versioning

Pull requests to `main` run the test suite, production web build, and Compose validation. Pushes to `main` also publish an immutable `ghcr.io/aminhaiqal/loyalty-program-assessment:sha-<commit>` image and deploy that exact image to the VPS. The deployment waits for container health, verifies the reported version and commit, and rolls back to the previous image if verification fails.

Normal `main` builds use versions such as `1.0.0-dev.42`. SemVer tags publish version aliases and a GitHub release:

```bash
npm version patch # or minor / major
git push origin main --follow-tags
```

The current version and short commit are visible in the interface. The full deployment identity is also returned by `GET /api/health`.

## Architecture and decisions

The React client only controls navigation and feedback. All authorization, ownership, validation, status transitions, and voucher creation are enforced by the Express API. SQL is kept explicit because the data model is small and this makes the constraints and transaction easy to inspect.

The approval service starts a transaction and locks the receipt row with `SELECT ... FOR UPDATE`. Only `PENDING` receipts may transition. Approval updates the receipt and inserts its voucher before committing. A unique constraint on `vouchers.receipt_id` supplies a second database-level guarantee that a receipt cannot create multiple vouchers, including under concurrent requests. Rejection never calls the voucher insert path.

Receipt files are not exposed through a public static directory. The authenticated download endpoint checks that the requester owns the receipt or is an administrator before serving it. Passwords are bcrypt-hashed, JWTs expire after eight hours, and the API re-reads the account role on each authenticated request.

Local file storage is acceptable for this assessment but is not suitable for horizontally scaled production instances. A production deployment should use object storage, TLS, secret management, rate limiting, malware scanning, refresh-token/session revocation, and managed database migrations.

## REST API

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register with email and/or phone |
| `POST` | `/api/auth/login` | Public | Log in with email or phone |
| `POST` | `/api/auth/logout` | Public | Client-side JWT logout target |
| `GET`, `PUT` | `/api/user/profile` | Member/admin | Read or update profile |
| `GET` | `/api/user/dashboard` | Member/admin | Member counts |
| `GET` | `/api/user/vouchers` | Member/admin | Own vouchers and source orders |
| `GET`, `POST` | `/api/receipts` | Member/admin | Own history or multipart submission |
| `GET` | `/api/receipts/:id/file` | Owner/admin | Protected receipt-file retrieval |
| `GET` | `/api/admin/dashboard` | Admin | Program statistics |
| `GET` | `/api/admin/receipts` | Admin | Validation queue, optionally filtered by status |
| `GET` | `/api/admin/receipts/:id` | Admin | Receipt details |
| `PATCH` | `/api/admin/receipts/:id/decision` | Admin | `APPROVE` or `REJECT` a pending receipt |

Except for registration/login, pass `Authorization: Bearer <token>`. Receipt submission uses multipart fields `receipt`, `orderId`, `purchaseDate`, and `amount`.

## Requirement and edge-case coverage

- A database default and API insert path make every upload `PENDING`.
- Authentication middleware prevents unauthenticated access; role middleware protects all admin routes.
- Receipt and voucher queries are restricted by the authenticated user ID.
- Duplicate email/phone and duplicate per-member order IDs return `409` responses.
- Missing fields, malformed/future dates, non-positive or over-precision amounts, invalid IDs/JSON, invalid file types, and files over 5 MB return controlled `400` responses.
- Missing receipts/files return `404`; cross-account file access returns `403`.
- Reprocessing an approved or rejected receipt returns `409` and cannot issue another voucher.
- Database constraints keep processing fields consistent with status and make each voucher's source receipt unique.

## AI assistance

Estimated contribution: **60% my contribution and 40% AI-assisted work**.

AI was used as a development assistant to break down the assessment requirements, scaffold and refine parts of the implementation, identify edge cases, propose automated tests, and help prepare the README, UAT material, Docker configuration, Makefile, and CI/CD workflow.

My contribution was to write the technical brief, define the product behaviour and priorities, choose and direct the user experience, review and refine the generated work, configure the deployment and domain, execute the UAT scenarios, verify the security and business rules, and make the final engineering decisions. I have reviewed the resulting code and remain responsible for understanding, maintaining, and explaining the implementation.
