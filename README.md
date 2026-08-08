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

With the API running locally:

- Swagger UI: `http://localhost:3001/docs/`
- OpenAPI document: `http://localhost:3001/openapi.json`
- Health check: `http://localhost:3001/health`

Most API endpoints require a Supabase access token:

```http
Authorization: Bearer <access_token>
```

See [`openapi.yaml`](openapi.yaml) for the complete API contract.

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

## Additional documentation

- [`docs/api.md`](docs/api.md) — API behavior and lifecycle rules
- [`docs/access-patterns.md`](docs/access-patterns.md) — authorization and
  transaction boundaries
- [`docs/postgres-design.md`](docs/postgres-design.md) — database design and
  constraints

## Project status

The core backend feature set, automated tests, OpenAPI contract, and Swagger UI
are complete. Continuous integration, production hardening, demo safeguards,
and deployment remain in progress.
