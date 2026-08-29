# Proof & Perk Loyalty Program

A deliberately small full-stack implementation of the supplied loyalty-program assessment. Members register, submit receipt files, track validation, and receive one voucher for every approved receipt. Administrators review the receipt queue and approve or reject submissions.

## Stack

- React + Vite frontend
- Node.js + Express REST API
- PostgreSQL with `pg` and an explicit SQL schema
- Bearer-token authentication with JWT; passwords hashed with bcrypt
- Multer local file storage (5 MB maximum; JPG, PNG, WEBP, and PDF)

## Docker Compose quick start

Docker Compose is the recommended container workflow for this assessment. It starts PostgreSQL, applies the schema, creates or updates the administrator, and then starts the application.

```bash
cp .env.example .env
# Replace JWT_SECRET, ADMIN_PASSWORD, and POSTGRES_PASSWORD before starting.
docker compose up --build -d
docker compose ps
```

Open `http://localhost:3000` (or the `APP_PORT` configured in `.env`). View logs with `docker compose logs -f app` and stop the stack with `docker compose down`. PostgreSQL data and uploaded receipts remain in named volumes. To deliberately erase both, use `docker compose down --volumes`.

The application image uses a multi-stage build, contains only production dependencies at runtime, runs as a non-root user, and includes a health check. Compose waits for PostgreSQL to become healthy and for the one-shot schema/admin setup service to finish before starting the app.

Docker Swarm is intentionally not included. It would add deployment complexity without helping this single-instance assessment, and the accepted local receipt storage is not safe to replicate across Swarm nodes. A real multi-node deployment should first move receipts to object storage and PostgreSQL to a managed/external service, then use orchestrator secrets and rolling-update policies.

## Setup

Prerequisites: Node.js 20+, npm, and PostgreSQL 14+.

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

## Tests

```bash
npm test
npm run build
```

The tests cover receipt input validation and the critical approval transaction: approve creates one voucher, repeated approval is rejected, rejection creates none, and missing/invalid decisions are controlled errors. The database schema also enforces unique voucher source receipts and unique order IDs per member.

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

AI assistance was used to interpret the assessment, scaffold the implementation, review edge cases, and create tests/documentation. The design decisions and resulting code should be reviewed and understood by the submitter before the follow-up interview.
