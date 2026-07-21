# Tomowa

Tomowa is a language exchange session platform.

## Stack

- Next.js
- TypeScript
- Express
- Drizzle ORM
- Supabase Auth
- Supabase PostgresSQL
- Amazon S3

## Status

In development.

## Local development

### Requirements

- Node.js
- Docker Desktop
- Supabase CLI

### Setup

From the repository root, install dependencies:

```bash
npm install
```

Configure the API:

```bash
cd apps/api
cp .env.example .env
```

Start the local Supabase services:

```bash
npm run supabase:start
```

Display the local URLs and credentials:

```bash
npm run supabase:status
```

Copy the local database URL, Supabase URL, and publishable key into `apps/api/.env`.

Apply the database migrations:

```bash
npm run db:migrate
```

Start the API:

```bash
npm run dev
```

The API runs at:

```text
http://localhost:3001
```

Test the health endpoint:

```bash
curl http://localhost:3001/health
```

The expected response is:

```json
{
  "status": "ok",
  "service": "tomowa-api"
}
```

### Stop local services

```bash
npm run supabase:stop
```

### Important safety note

Never run the following command against the production project:

```bash
supabase db reset --linked
```

It deletes data from the linked remote database.
