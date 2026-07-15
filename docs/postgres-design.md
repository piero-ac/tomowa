# Tomowa PostgreSQL Design

## Purpose

This document defines the PostgreSQL database design for Tomowa.

The schema is derived from:

- `docs/api.md`
- `docs/access-patterns.md`

Tomowa uses:

```text
Express
    ↓
Drizzle ORM
    ↓
Supabase PostgreSQL
```

Supabase is used as the PostgreSQL host and authentication provider.

The Express API owns:

- Business logic
- Authorization
- Database access
- Session management
- S3 upload coordination

The frontend must not query application tables directly.

---

# Database Ownership

Tomowa uses Supabase for:

```text
Supabase Auth
Supabase-hosted PostgreSQL
```

Tomowa does not use the Supabase Data API for application database access.

Application data flows through:

```text
Next.js
    ↓
Express API
    ↓
Drizzle ORM
    ↓
PostgreSQL
```

The Drizzle schema is the source of truth for application tables.

Drizzle Kit is used to generate and apply migrations.

---

# Core Tables

The MVP requires two application tables:

1. `sessions`
2. `session_attendees`

A future S3 upload flow will store the S3 object key on the `sessions` table.

---

# Sessions Table

The `sessions` table represents an online language exchange session.

## Columns

| Column            | PostgreSQL Type | Nullable | Description                                |
| ----------------- | --------------- | -------: | ------------------------------------------ |
| `id`              | `uuid`          |       No | Primary key                                |
| `organizer_id`    | `uuid`          |       No | Supabase Auth user ID of the organizer     |
| `title`           | `text`          |       No | Session title                              |
| `target_language` | `text`          |       No | Language participants want to practice     |
| `help_language`   | `text`          |       No | Language participants can use for support  |
| `starts_at`       | `timestamptz`   |       No | Scheduled start time                       |
| `capacity`        | `integer`       |       No | Maximum number of attendees                |
| `meeting_link`    | `text`          |       No | Private external meeting URL               |
| `image_key`       | `text`          |      Yes | S3 object key for the optional cover image |
| `description`     | `text`          |       No | Session details                            |
| `created_at`      | `timestamptz`   |       No | Creation timestamp                         |
| `updated_at`      | `timestamptz`   |       No | Last update timestamp                      |

## Drizzle Schema

```ts
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const sessions = pgTable("sessions", {
	id: uuid("id").defaultRandom().primaryKey(),

	organizerId: uuid("organizer_id").notNull(),

	title: text("title").notNull(),

	targetLanguage: text("target_language").notNull(),

	helpLanguage: text("help_language").notNull(),

	startsAt: timestamp("starts_at", {
		withTimezone: true,
	}).notNull(),

	capacity: integer("capacity").notNull(),

	meetingLink: text("meeting_link").notNull(),

	imageKey: text("image_key"),

	description: text("description").notNull(),

	createdAt: timestamp("created_at", {
		withTimezone: true,
	})
		.defaultNow()
		.notNull(),

	updatedAt: timestamp("updated_at", {
		withTimezone: true,
	})
		.defaultNow()
		.notNull(),
});

export type InsertSession = typeof sessions.$inferInsert;
export type SelectSession = typeof sessions.$inferSelect;
```

---

# Organizer Identity

`organizer_id` stores the authenticated Supabase Auth user ID.

It is intentionally not defined as a foreign key to:

```text
auth.users.id
```

## Reason

Supabase Auth is an external identity system from the perspective of the application domain.

The Express authentication middleware verifies the Supabase JWT and extracts the authenticated user ID.

The backend then assigns:

```text
organizerId = authenticatedUser.id
```

The client must never provide a trusted organizer ID directly.

Avoiding a foreign key to `auth.users` keeps the application schema less coupled to Supabase Auth and makes a future authentication-provider migration easier.

---

# Session Attendees Table

The `session_attendees` table represents users who have joined sessions.

It should be added when RSVP functionality is implemented.

## Columns

| Column       | PostgreSQL Type | Nullable | Description           |
| ------------ | --------------- | -------: | --------------------- |
| `session_id` | `uuid`          |       No | Session being joined  |
| `user_id`    | `uuid`          |       No | Supabase Auth user ID |
| `joined_at`  | `timestamptz`   |       No | Time the user joined  |

## Primary Key

Use a composite primary key:

```text
(session_id, user_id)
```

This guarantees that the same user cannot join one session more than once.

## Foreign Key

```text
session_attendees.session_id
    ↓
sessions.id
```

Use:

```text
ON DELETE CASCADE
```

When a session is deleted, its attendee records should be deleted automatically.

## Planned Drizzle Schema

```ts
import { primaryKey, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const sessionAttendees = pgTable(
	"session_attendees",
	{
		sessionId: uuid("session_id")
			.notNull()
			.references(() => sessions.id, {
				onDelete: "cascade",
			}),

		userId: uuid("user_id").notNull(),

		joinedAt: timestamp("joined_at", {
			withTimezone: true,
		})
			.defaultNow()
			.notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.sessionId, table.userId],
		}),
	],
);
```

The precise Drizzle syntax should be verified against the installed Drizzle version when this table is implemented.

---

# Relationships

```text
sessions
──────────────────────────
id PK
organizer_id
title
starts_at
capacity
...

       1
       │
       │
       ▼
       many

session_attendees
──────────────────────────
session_id PK, FK
user_id PK
joined_at
```

A session can have many attendees.

A user can attend many sessions.

This forms a many-to-many relationship between authenticated users and sessions, represented by `session_attendees`.

---

# Attendee Count

The MVP should not store a separate `attendee_count` column initially.

The current attendee count can be derived from:

```sql
SELECT COUNT(*)
FROM session_attendees
WHERE session_id = $1;
```

## Reason

Storing an attendee count would duplicate information and require every join and leave operation to update both:

```text
session_attendees
sessions.attendee_count
```

Deriving the count avoids synchronization bugs.

If performance later becomes a real concern, a cached attendee count can be introduced through a migration.

---

# Meeting Link Privacy

The meeting link is stored on the `sessions` row:

```text
sessions.meeting_link
```

It must not be returned automatically in every API response.

The Express service layer determines whether the authenticated user may see it.

The user may view the meeting link when:

```text
user.id === session.organizerId
```

or when a matching attendee record exists:

```text
session_attendees.session_id = session.id
AND
session_attendees.user_id = user.id
```

The repository may retrieve the full session row, but the service must create a safe response object that omits `meetingLink` for unauthorized viewers.

---

# Session Image Storage

Session cover images are stored in Amazon S3.

PostgreSQL stores only the object key:

```text
session-images/<userId>/<uuid>.<extension>
```

Example:

```text
session-images/7bc58d22-7c01-4f72-a08d-09be8b24d723/6d9f38be.webp
```

The database must not store:

- Image bytes
- Temporary presigned URLs
- AWS credentials

The `image_key` column is nullable because session images are optional.

## Upload Flow

```text
Frontend
    ↓
Request presigned upload URL from Express
    ↓
Express validates file metadata and ownership
    ↓
Express generates short-lived S3 upload URL
    ↓
Frontend uploads directly to S3
    ↓
Session record stores the resulting object key
```

The MVP supports only one optional image per session.

---

# Indexes

Indexes should support actual API queries rather than being added speculatively.

## Upcoming Sessions

Used by:

```text
GET /api/sessions
```

Query shape:

```sql
SELECT *
FROM sessions
WHERE starts_at >= NOW()
ORDER BY starts_at ASC;
```

Recommended index:

```text
sessions(starts_at)
```

---

## Sessions Created by User

Used by:

```text
GET /api/me/sessions-created
```

Query shape:

```sql
SELECT *
FROM sessions
WHERE organizer_id = $1
ORDER BY starts_at ASC;
```

Recommended composite index:

```text
sessions(organizer_id, starts_at)
```

This index can support both filtering by organizer and ordering by start time.

---

## Sessions Joined by User

Used by:

```text
GET /api/me/sessions-joined
```

Query shape:

```sql
SELECT s.*
FROM session_attendees sa
JOIN sessions s
  ON s.id = sa.session_id
WHERE sa.user_id = $1
ORDER BY s.starts_at ASC;
```

Recommended index:

```text
session_attendees(user_id)
```

The composite primary key already supports lookups beginning with `session_id`.

The additional `user_id` index supports finding every session joined by one user.

---

# Constraints

PostgreSQL should enforce structural data integrity where practical.

## Required Constraints

```text
sessions.id
    PRIMARY KEY

session_attendees(session_id, user_id)
    PRIMARY KEY

session_attendees.session_id
    FOREIGN KEY → sessions.id
    ON DELETE CASCADE
```

## Capacity Validation

At minimum, the service layer should reject:

```text
capacity <= 0
```

A PostgreSQL check constraint may also be added:

```sql
CHECK (capacity > 0)
```

Using both application validation and a database constraint is reasonable because the database constraint protects integrity even if a future code path bypasses the service.

---

# Join Session Transaction

Joining a session involves multiple checks that must remain consistent.

The operation should execute inside a PostgreSQL transaction.

## Required Rules

- Session must exist.
- Organizer cannot join their own session.
- User cannot join twice.
- Attendee count must remain below capacity.

## Conceptual Flow

```text
BEGIN

Lock or safely read the session
Count current attendees
Verify capacity remains
Verify user is not organizer
Insert session_attendees row

COMMIT
```

The composite primary key prevents duplicate joins at the database level.

Concurrency handling for capacity should be designed carefully when the RSVP feature is implemented.

---

# Leave Session

Leaving a session deletes one row from `session_attendees`.

Conceptual query:

```sql
DELETE FROM session_attendees
WHERE session_id = $1
  AND user_id = $2;
```

If no row is deleted, the service should return an appropriate conflict or not-found response.

The organizer is not represented as an attendee and therefore cannot leave their own session.

---

# Update Session

Only the organizer may update a session.

The service must verify:

```text
session.organizerId === authenticatedUserId
```

The update repository method must explicitly refresh:

```text
updated_at
```

The `.defaultNow()` definition only supplies the initial value during insertion. It does not update the timestamp automatically.

When capacity changes, the service must ensure:

```text
new capacity >= current attendee count
```

---

# Delete Session

Only the organizer may delete a session.

Deleting the session should automatically remove associated attendee records through:

```text
ON DELETE CASCADE
```

The associated S3 image object is not deleted automatically by PostgreSQL.

The service should eventually coordinate:

```text
Delete database session
Delete associated S3 object when imageKey exists
```

For MVP implementation, database correctness comes first. S3 cleanup should be added with the image feature.

---

# Pagination

The first implementation may use a simple limit.

Future pagination should prefer cursor-based pagination using:

```text
starts_at
id
```

Example ordering:

```sql
ORDER BY starts_at ASC, id ASC
```

Using the UUID as a secondary value provides stable ordering when multiple sessions share the same start time.

Offset pagination is acceptable for the earliest MVP version but is less suitable as the dataset grows.

---

# Migrations

Drizzle Kit owns application schema migrations.

Workflow:

```text
Edit src/db/schema.ts
    ↓
Generate migration
    ↓
Inspect generated SQL
    ↓
Apply migration
    ↓
Commit schema and migration files
```

Commands:

```bash
npm run db:generate
npm run db:migrate
```

or:

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

Run database commands from:

```text
apps/api
```

Commit:

```text
src/db/schema.ts
drizzle.config.ts
generated migration files
migration metadata
```

Do not commit:

```text
.env
dist/
node_modules/
```

---

# Environment Configuration

The API database connection is configured through:

```env
DATABASE_URL=
```

The value belongs in:

```text
apps/api/.env
```

The real `.env` file must not be committed.

A safe template should be committed as:

```text
apps/api/.env.example
```

---

# Repository Responsibilities

Database queries belong in the repository layer.

Example request flow:

```text
Route
    ↓
Controller
    ↓
Service
    ↓
Repository
    ↓
Drizzle ORM
    ↓
Supabase PostgreSQL
```

Repositories may know about:

- Drizzle
- SQL queries
- Tables
- Joins
- Transactions

Repositories must not know about:

- Express request objects
- HTTP status codes
- Response objects
- Authentication middleware

Business authorization remains in the service layer.

---

# Initial Implementation Status

Currently implemented:

```text
sessions table
Initial Drizzle migration
Supabase PostgreSQL connection
GET /sessions database query
```

Planned next:

```text
POST /sessions
Session validation
Session attendee table
Join and leave operations
Authentication integration
S3 session images
```

---

# Final Design Summary

Tomowa uses a conventional relational design:

```text
sessions
    1
    ↓
    many
session_attendees
```

Key decisions:

- Supabase hosts PostgreSQL and provides authentication.
- Express owns database access and authorization.
- Drizzle defines the schema and executes queries.
- Drizzle Kit manages migrations.
- Auth user IDs are stored as UUID values without foreign keys to `auth.users`.
- Attendee records reference sessions with `ON DELETE CASCADE`.
- Meeting links are protected in the service layer.
- S3 object keys are stored in PostgreSQL.
- Attendee count is derived rather than duplicated.
- Transactions will protect session-capacity rules.
