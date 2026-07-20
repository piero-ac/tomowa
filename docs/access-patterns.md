# Tomowa Access Patterns

## Purpose

This document defines the MVP reads, writes, authorization checks, and
transaction boundaries that drive Tomowa's PostgreSQL and API design.

Tomowa supports one-to-one language-practice scheduling. A session is an
available time owned by one user. Other users submit requests, and the owner
may approve exactly one requester.

## Core entities

1. **Profile** — application-facing data for one Supabase Auth user.
2. **Session** — one available one-to-one practice time.
3. **Session request** — a request and its approval lifecycle.

There is no `session_attendees` table in the MVP. The approved
`session_requests` row identifies the practice partner.

## Access-pattern summary

| Endpoint | Access pattern |
| --- | --- |
| `POST /sessions` | Create an open session owned by current user |
| `GET /sessions` | List upcoming open sessions |
| `GET /sessions/:sessionId` | Get one session with viewer-aware fields |
| `PATCH /sessions/:sessionId` | Update an owned open session |
| `DELETE /sessions/:sessionId` | Delete or cancel an owned session |
| `POST /sessions/:sessionId/requests` | Request an open session |
| `POST /sessions/:sessionId/requests/:requestId/approve` | Approve one request atomically |
| `POST /sessions/:sessionId/requests/:requestId/decline` | Decline one pending request |
| `POST /sessions/:sessionId/requests/:requestId/cancel` | Cancel a request or booking |
| `GET /me/profile` | Get current user's profile |
| `PATCH /me/profile` | Update current user's profile |
| `GET /me/sessions-created` | List sessions owned by current user |
| `GET /me/session-requests` | List requests made by current user |
| `GET /me/sessions-booked` | List confirmed sessions for current user |

## 1. Provision profile after signup

Trigger:

```text
AFTER INSERT ON auth.users
```

Reads:

```text
auth.users.id
selected raw_user_meta_data fields
```

Writes:

```text
one profiles row
```

Rules:

- `profiles.id` equals `auth.users.id`.
- Profile provisioning is idempotent by primary key.
- Optional or malformed user metadata must not prevent signup.
- The trigger function uses `SECURITY DEFINER`, an explicit safe search path,
  and schema-qualified names.

## 2. Create session

Inputs:

```text
authenticated user ID
validated session form data
```

Writes:

```text
one sessions row with owner_id = authenticated user ID
```

Rules:

- Start time is in the future.
- Duration is within the supported range.
- Status starts as `open`.
- Owner ID, status, and timestamps are not trusted client fields.
- Session capacity is always one and is not stored.

## 3. Browse upcoming sessions

Reads:

```text
many sessions
owner profile summary
```

Filtering:

```text
status = open
starts_at >= current timestamp
```

Ordering:

```text
starts_at ASC, id ASC
```

Meeting links are never selected or returned by this query.

## 4. View one session

Reads:

```text
one session
owner profile summary
approved request for viewer, if one exists
```

Meeting-link rule:

```text
include when viewer.id = session.owner_id
OR when an approved request exists for
   session_id = session.id AND requester_id = viewer.id
```

Otherwise the meeting link is omitted.

## 5. Update session

Reads:

```text
one session by id
```

Writes:

```text
session fields and updated_at
```

Rules:

- Caller must be the owner.
- Repository update is constrained by both `id` and `owner_id`.
- A booked session's `starts_at` cannot be changed.
- Status transitions do not use this generic update path.

## 6. Delete or cancel session

Rules:

- Caller must be the owner.
- An open session with no request history may be hard-deleted.
- A session with request history should become `cancelled` instead of being
  deleted.
- Cancelling a session cancels pending or approved requests in the same
  transaction.

Retaining session and request rows preserves meaningful history.

## 7. Request a session

Reads:

```text
session
active request for session and requester
```

Writes:

```text
one pending session_requests row
```

Rules:

- Session exists, is `open`, and starts in the future.
- Requester is not the session owner.
- Requester has no existing active request for that session.
- Several different users may have pending requests for the same session.
- The database uniqueness rule is the final duplicate-request guard.

## 8. Approve request

This operation must execute in a PostgreSQL transaction.

Reads and locks:

```text
session
selected session request
other pending requests for the session
```

Transaction:

```text
BEGIN

Verify caller owns the session
Verify session is open and in the future
Verify selected request belongs to the session and is pending
Set selected request to approved and responded_at = now()
Set every other pending request for the session to declined
Set session status to booked and refresh updated_at

COMMIT
```

The database must enforce at most one approved request per session. A
concurrent uniqueness failure becomes `409 Conflict`.

## 9. Decline request

Rules:

- Caller owns the associated session.
- Request is currently `pending`.
- Change status to `declined` and set `responded_at`.
- Session remains `open`.

## 10. Cancel pending request

Rules:

- Caller is the requester.
- Request is currently `pending`.
- Change status to `cancelled`.
- Retain the row for history.

## 11. Cancel approved booking

This operation is transactional.

Rules:

- Caller is the session owner or approved requester.
- Request is currently `approved`.
- If the owner cancels the whole session, mark both the session and approved
  request `cancelled`.
- If the requester cancels before the start time, mark the request `cancelled`
  and return the session to `open`.
- Requests declined during the original approval remain declined. New requests
  may be submitted after the session reopens.

## 12. Get or update my profile

Filtering:

```text
profiles.id = authenticated user ID
```

Rules:

- Users may edit only the approved profile fields.
- IDs and timestamps are server-controlled.
- Username uniqueness is enforced by the database if usernames are enabled.

## 13. List sessions I created

Filtering:

```text
sessions.owner_id = authenticated user ID
```

Ordering:

```text
starts_at ASC, id ASC
```

The owner view may include request counts and pending request summaries.

## 14. List requests I made

Reads:

```text
session_requests
JOIN sessions
JOIN owner profiles
```

Filtering:

```text
session_requests.requester_id = authenticated user ID
```

## 15. List booked sessions

Return sessions where the current user is either:

```text
sessions.owner_id = authenticated user ID
```

or has:

```text
session_requests.requester_id = authenticated user ID
AND session_requests.status = approved
```

This response may include the meeting link.

## Required indexes and constraints

### Profiles

- Primary key on `id`.
- Optional unique index on normalized username.

### Sessions

- Primary key on `id`.
- Index on `(status, starts_at, id)` for browsing open sessions.
- Index on `(owner_id, starts_at, id)` for owner listings.
- Check constraint requiring a positive duration.

### Session requests

- Primary key on `id`.
- Foreign key on `session_id`.
- Foreign key on `requester_id`.
- Index on `(session_id, status)` for owner request queues.
- Index on `(requester_id, created_at)` for requester history.
- Partial unique index allowing at most one approved request per session.
- Uniqueness rule preventing duplicate active requests by the same requester.

## MVP scope guardrails

Included:

- Public profiles required for scheduling context
- One-to-one session availability
- Multiple pending requests
- Owner approval or decline
- Exactly one approved requester
- Cancellation with retained history
- Owner and requester session views
- Meeting-link privacy

Not included:

- Group sessions or capacity
- Direct messages
- Reviews or ratings
- Notifications
- Payments
- Recurring-session generation
- Calendar integrations
- Automatic matching or recommendations
- Enforcement of overlapping availability across sessions

## Final MVP requirements

```text
Create a profile automatically after signup
Create and browse one-to-one session times
Request an open session
Approve exactly one requester
Automatically decline competing pending requests
Cancel requests and bookings
List owned, requested, and booked sessions
Protect meeting links
Retain request history
Enforce authorization and concurrency rules
```
