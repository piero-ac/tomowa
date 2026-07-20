# Tomowa PostgreSQL Design

## Purpose

This document defines the target MVP PostgreSQL design for Tomowa's one-to-one
language-practice scheduling workflow.

The schema is derived from:

- `docs/api.md`
- `docs/access-patterns.md`

## Architecture and ownership

```text
Next.js
    ↓
Express API
    ↓
Drizzle ORM
    ↓
Supabase PostgreSQL
```

Supabase provides PostgreSQL and Auth. The frontend does not query application
tables directly; Express owns business logic, authorization, and application
database access.

Drizzle is the application-schema and migration source of truth:

- Tables, columns, indexes, and supported constraints are declared in the
  Drizzle schema.
- Drizzle Kit generates and applies migrations.
- PostgreSQL functions, triggers, partial indexes, or other features that need
  custom SQL are committed in the same Drizzle migration history.
- Schema changes are not made manually in the hosted Supabase dashboard.
- The Supabase CLI may run the local services, but it is not a second migration
  owner. Run Drizzle migrations against the local Supabase database after the
  local stack starts.

## Core tables

The target MVP requires:

1. `profiles`
2. `sessions`
3. `session_requests`

There is no `session_attendees` table. The single approved request identifies
the session's practice partner.

## Profiles

`profiles` stores application-facing user data. Its primary key matches the
Supabase Auth user ID.

| Column | Type | Nullable | Description |
| --- | --- | ---: | --- |
| `id` | `uuid` | No | PK and FK to `auth.users.id` |
| `display_name` | `text` | Yes | Public display name |
| `username` | `text` | Yes | Optional unique handle |
| `bio` | `text` | Yes | Short public biography |
| `avatar_key` | `text` | Yes | Object-storage key, not a temporary URL |
| `native_language` | `text` | Yes | Language the user can help with |
| `learning_language` | `text` | Yes | Language the user is practicing |
| `timezone` | `text` | Yes | IANA timezone for display and input |
| `created_at` | `timestamptz` | No | Creation timestamp |
| `updated_at` | `timestamptz` | No | Last application update |

Relationship:

```text
profiles.id → auth.users.id ON DELETE CASCADE
```

Application tables reference `profiles.id`, avoiding repeated direct coupling
to the Auth schema while retaining referential integrity.

### Profile provisioning trigger

An `AFTER INSERT` trigger on `auth.users` inserts the corresponding profile.

Requirements:

- Function is `SECURITY DEFINER`.
- Function has an explicit safe `search_path` and schema-qualified names.
- `profiles.id` is set from `NEW.id`.
- Optional metadata is copied defensively.
- Missing metadata does not fail signup.
- The migration includes both forward creation and any rollback behavior
  required by the migration framework.

The table remains defined in Drizzle. The trigger and function are tracked as
custom SQL in a Drizzle-owned migration.

## Session status

Allowed values:

```text
open
booked
completed
cancelled
```

Use either a PostgreSQL enum declared through Drizzle or a text column with a
database check constraint. The application also validates transitions.

## Sessions

Each row represents one available one-to-one practice time.

| Column | Type | Nullable | Description |
| --- | --- | ---: | --- |
| `id` | `uuid` | No | Primary key |
| `owner_id` | `uuid` | No | FK to `profiles.id` |
| `title` | `text` | No | Session title |
| `target_language` | `text` | No | Language being practiced |
| `help_language` | `text` | No | Shared/support language |
| `starts_at` | `timestamptz` | No | Scheduled start time in UTC |
| `duration_minutes` | `integer` | No | Session duration |
| `status` | enum/text | No | Defaults to `open` |
| `meeting_link` | `text` | No | Private meeting URL |
| `image_key` | `text` | Yes | Optional object-storage key |
| `description` | `text` | No | Session details |
| `created_at` | `timestamptz` | No | Creation timestamp |
| `updated_at` | `timestamptz` | No | Last update timestamp |

Changes from the current implementation:

- Rename `organizer_id` to `owner_id`.
- Remove `capacity`; sessions are always one-to-one.
- Add `duration_minutes`.
- Add lifecycle `status`.
- Add a foreign key from `owner_id` to `profiles.id`.

Recommended relationships:

```text
sessions.owner_id → profiles.id
```

Choose the `ON DELETE` behavior deliberately. For the MVP, `RESTRICT` is safer
than silently deleting historical sessions when a profile is removed. User
deletion should go through an application/admin workflow that first handles
owned records.

## Session request status

Allowed values:

```text
pending
approved
declined
cancelled
```

## Session requests

Each row records one user's request and its decision history.

| Column | Type | Nullable | Description |
| --- | --- | ---: | --- |
| `id` | `uuid` | No | Primary key |
| `session_id` | `uuid` | No | FK to `sessions.id` |
| `requester_id` | `uuid` | No | FK to `profiles.id` |
| `status` | enum/text | No | Defaults to `pending` |
| `message` | `text` | Yes | Optional request note |
| `created_at` | `timestamptz` | No | Request creation time |
| `responded_at` | `timestamptz` | Yes | Owner decision time |
| `updated_at` | `timestamptz` | No | Last state change |

Relationships:

```text
session_requests.session_id → sessions.id ON DELETE CASCADE
session_requests.requester_id → profiles.id
```

Use `RESTRICT` for requester profile deletion until an explicit account-deletion
and anonymization policy is designed.

## Relationships

```text
auth.users
    1
    ↓
    1
profiles
    1 ──────────────── many sessions (owned)
    1 ──────────────── many session_requests (submitted)

sessions
    1
    ↓
    many session_requests
        └── at most one approved row
```

## Constraints

PostgreSQL protects structural integrity even if a future code path bypasses a
service-layer check.

Required constraints:

```text
profiles.id PRIMARY KEY
profiles.id FOREIGN KEY → auth.users.id ON DELETE CASCADE

sessions.id PRIMARY KEY
sessions.owner_id FOREIGN KEY → profiles.id
sessions.duration_minutes > 0

session_requests.id PRIMARY KEY
session_requests.session_id FOREIGN KEY → sessions.id ON DELETE CASCADE
session_requests.requester_id FOREIGN KEY → profiles.id
```

### Exactly one approved requester

Use a partial unique index:

```sql
CREATE UNIQUE INDEX session_requests_one_approved_idx
ON session_requests (session_id)
WHERE status = 'approved';
```

This is the final concurrency guard when two approval attempts race.

### Duplicate active requests

Prevent more than one active request from the same user for the same session:

```sql
CREATE UNIQUE INDEX session_requests_one_active_per_user_idx
ON session_requests (session_id, requester_id)
WHERE status IN ('pending', 'approved');
```

Declined or cancelled history does not prevent a future request if the session
becomes open again.

The rule that an owner cannot request their own session depends on another
table's value and belongs in the transactional service logic.

## Indexes

### Browse open sessions

Query:

```sql
SELECT ...
FROM sessions
WHERE status = 'open'
  AND starts_at >= NOW()
ORDER BY starts_at ASC, id ASC;
```

Index:

```text
sessions(status, starts_at, id)
```

### Sessions owned by one user

```text
sessions(owner_id, starts_at, id)
```

### Requests for a session

```text
session_requests(session_id, status, created_at)
```

### Requests made by one user

```text
session_requests(requester_id, created_at)
```

## Approval transaction

Approving a request is atomic:

```text
BEGIN

Lock session row
Verify caller is owner
Verify session status is open and starts in the future
Lock and verify selected pending request
Approve selected request and set responded_at
Decline all other pending requests and set responded_at
Set session status to booked
Refresh updated_at values

COMMIT
```

The partial unique index prevents two approved rows even under concurrency. A
uniqueness conflict maps to an application `409 Conflict`.

## Cancellation transactions

### Requester cancels a pending request

Update only that request to `cancelled` after checking ownership and state.

### Approved requester cancels

In one transaction:

```text
approved request → cancelled
booked future session → open
```

Previously declined requests remain historical. New requests may be created.

### Owner cancels the session

In one transaction:

```text
session → cancelled
pending or approved requests → cancelled
```

## Meeting-link privacy

The meeting link is stored on `sessions.meeting_link` but omitted from general
queries and response DTOs.

It may be returned only when:

```text
viewer.id = sessions.owner_id
```

or:

```text
session_requests.session_id = sessions.id
AND session_requests.requester_id = viewer.id
AND session_requests.status = approved
```

Do not include `meeting_link` in the repository projection used by the public
session listing.

## Time handling

- Store `starts_at` as `timestamptz`.
- Interpret API timestamps as ISO 8601 values with offsets.
- Store a user's preferred IANA timezone on `profiles` for display and input.
- Store duration explicitly rather than relying on a product-wide constant.
- Cursor pagination uses `(starts_at, id)` for stable ordering.

The MVP does not prevent owners or requesters from creating overlapping
sessions. That rule can be added once product behavior is validated.

## Image storage

Profile avatars and optional session images store object keys, not image bytes,
credentials, or temporary presigned URLs.

Possible key shapes:

```text
profile-images/<userId>/<uuid>.<extension>
session-images/<userId>/<uuid>.<extension>
```

Object cleanup is an application workflow and is not performed automatically by
PostgreSQL foreign keys.

## Migration workflow

Run commands from `apps/api`:

```text
Edit src/db/schema.ts
    ↓
npm run db:generate
    ↓
Inspect generated SQL and metadata
    ↓
Add reviewed custom SQL when needed
    ↓
Apply to local Supabase with npm run db:migrate
    ↓
Reset/recreate locally and verify
    ↓
Commit schema plus migration artifacts
```

Commit:

```text
src/db/schema.ts
drizzle.config.ts
Drizzle-generated SQL
Drizzle migration metadata and snapshots
custom trigger/function/index SQL in migration history
```

Do not use manual hosted-dashboard edits as schema history. Do not alternate
between Drizzle Kit and Supabase CLI migration runners without an explicit
integration design; they maintain different migration histories.

## Repository and service responsibilities

```text
Route
    ↓
Controller
    ↓
Service
    ↓
Repository
    ↓
Drizzle/PostgreSQL
```

Repositories own queries, joins, row locking, and transactions. They do not
depend on Express request or response objects.

Services own state-transition rules and authorization decisions. Sensitive
mutations should also constrain SQL by the authenticated user ID where
practical.

## Current implementation gap

The current code and initial migration still model group sessions with:

```text
organizer_id
capacity
no profile foreign key
no session status
```

The next schema work must migrate that implementation toward this document:

1. Add `profiles` and the Auth provisioning trigger.
2. Replace session capacity with duration and status.
3. Rename organizer ownership consistently if `owner_id` is adopted.
4. Add `session_requests`, indexes, and constraints.
5. Implement transactional request approval and cancellation.

## Final design summary

- Supabase provides Auth and PostgreSQL.
- Express verifies identity and owns application authorization.
- Drizzle is the sole application migration authority.
- Profiles mirror Supabase Auth identities through a provisioning trigger.
- Sessions represent individual one-to-one time slots.
- Multiple users may request a session, but only one request may be approved.
- Transactions and partial unique indexes protect approval concurrency.
- Request history is retained.
- Meeting links are visible only to the owner and approved requester.
