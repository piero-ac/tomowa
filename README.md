# Tomowa API

Tomowa is a backend API for scheduling one-to-one language-exchange sessions.

Users can publish available practice sessions, request sessions created by
other users, approve or decline requests, and manage confirmed bookings. The
project focuses on authorization, transactional workflows, concurrency safety,
and maintainable API design.

## Features

- Supabase JWT authentication
- User profiles
- Session creation, browsing, updating, and cancellation
- Session request approval, decline, and cancellation workflows
- Transactional booking and reopening behavior
- Viewer-aware meeting-link privacy
- Cursor-paginated list endpoints
- PostgreSQL constraints and partial unique indexes
- Unit and integration tests
- OpenAPI 3.1 documentation and Swagger UI
- Password-free demo access with three seeded personas
- Guarded, repeatable demo-data reset tooling
- Local Supabase development environment

## Architecture

```text
Client / Swagger UI
        |
        v
Express REST API
        |
        v
Service layer
        |
        v
Repository layer
        |
        v
Drizzle ORM
        |
        v
Supabase PostgreSQL

Supabase Auth -> JWT verification -> Express authorization
```

The client does not access application tables directly. Express owns the
business rules, authorization, and application database access.

## Technology

- Node.js 24
- TypeScript
- Express
- PostgreSQL
- Supabase Auth and local development stack
- Drizzle ORM and Drizzle Kit
- Zod
- Vitest and Supertest
- OpenAPI 3.1 and Swagger UI

## API documentation

Hosted demo:

- Swagger UI: <https://tomowa.onrender.com/docs/>
- OpenAPI document: <https://tomowa.onrender.com/openapi.json>
- Health check: <https://tomowa.onrender.com/health>

Local development:

- Swagger UI: `http://localhost:3001/docs/`
- OpenAPI document: `http://localhost:3001/openapi.json`
- Health check: `http://localhost:3001/health`

Most API endpoints require a Supabase access token:

```http
Authorization: Bearer <access_token>
```

See [`openapi.yaml`](openapi.yaml) for the complete API contract.

## Hosted demo

Reviewers can use `POST /api/demo/login` to sign in as one of three seeded
personas without knowing or submitting a password. The endpoint returns a
normal short-lived Supabase access token, which can be entered into Swagger's
**Authorize** dialog.

See the [hosted demo guide](docs/demo-guide.md) for the available personas and
suggested API workflows. The personas are starting states, not permission
roles; all three accounts use the same application authorization rules.

## Local development

### Requirements

- Node.js 24
- Docker Desktop
- Supabase CLI

### Installation

Install dependencies from the repository root:

```bash
npm install
```

Create the API environment file:

```bash
cp .env.example .env
```

Start Supabase from the repository root:

```bash
npm run supabase:start
npm run supabase:status
```

Use the local Supabase status output to configure `.env`. Set
`LOCAL_SEED_PASSWORD` to a password used only for the local seeded accounts.
Set `CORS_ALLOWED_ORIGINS` to a comma-separated list of browser origins that
may call the API, such as
`http://localhost:3000,http://127.0.0.1:3000`. Origins must contain only the
scheme, host, and optional port, with no path or trailing slash. An empty list
disables cross-origin browser access while still allowing same-origin and
non-browser requests.

API rate limiting defaults to 300 requests per IP address every 60 seconds.
Configure the window with `RATE_LIMIT_WINDOW_MS` and the request count with
`RATE_LIMIT_MAX_REQUESTS`. `TRUST_PROXY_HOPS` defaults to `0` for direct local
connections and must match the hosting platform's reverse-proxy path in
production so the limiter identifies client IP addresses correctly.

Apply the migrations:

```bash
npm run db:migrate
```

Seed the local database:

```bash
npm run db:seed
```

Start the API:

```bash
npm run dev
```

The API runs at `http://localhost:3001`.

## Testing

Integration tests use the local Supabase environment and reseed it before
running.

Run the complete test suite:

```bash
npm test
```

Run the complete test suite and leave local Supabase populated with the demo
showcase afterward:

```bash
npm run test:demo-ready
```

Run individual test groups:

```bash
npm run test:unit
npm run test:integration
npm run test:coverage
```

Run the API quality checks:

```bash
npm run format:check
npm run openapi:lint
npm run lint
npm run build
npm run test:typecheck
```

## Database migrations

Drizzle is the source of truth for application schema changes.

Generate and apply migrations with:

```bash
npm run db:generate
npm run db:migrate
```

Never run `supabase db reset --linked` against a hosted project. It can delete
the remote project data.

## Demo data reset

The reset command rebuilds only the sessions, requests, and profiles belonging
to the three configured demo users. It reads their existing Supabase Auth IDs
but does not create, delete, or change Auth users or passwords. It also refuses
to run if demo data is connected to a non-demo user.

Reset a local Supabase instance with:

```bash
npm run demo:reset:local
```

`npm test` reseeds the database with the integration-test baseline. Use
`npm run test:demo-ready` when you want to run every test and automatically
restore the richer demo baseline afterward.

For the hosted database, run the interactive wrapper:

```bash
npm run demo:reset:hosted
```

The wrapper asks for confirmation and invisibly reads the hosted connection
string, so the credential is not stored in the repository or shell history.
The target must match the connection hostname. Run the hosted reset manually
when the shared demo needs a clean baseline; it is not part of application
startup or deployment.

## Additional documentation

- [`docs/api.md`](docs/api.md) — API behavior and lifecycle rules
- [`docs/demo-guide.md`](docs/demo-guide.md) — reviewer walkthrough for the
  hosted demo
- [`docs/access-patterns.md`](docs/access-patterns.md) — authorization and
  transaction boundaries
- [`docs/postgres-design.md`](docs/postgres-design.md) — database design and
  constraints

## Project status

The backend is deployed with continuous integration, production-aware CORS and
rate limiting, guarded demo access, automated tests, an OpenAPI contract, and
Swagger UI. Future work is optional maintenance, observability, and incremental
hardening rather than required feature development.
