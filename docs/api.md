# Tomowa API

## Overview

Tomowa exposes a REST API built with Express and TypeScript.

Tomowa is a one-to-one language-practice scheduling product. A session owner
publishes an available time, other users may request that time, and the owner
approves or declines those requests. Exactly one requester may be approved for
a session.

Supabase provides authentication. The Express API verifies Supabase access-token
JWTs and uses the verified `sub` claim as the application user ID.

Base URL:

```text
/api
```

## Authentication

All endpoints require authentication unless explicitly marked public.

Protected requests must include:

```http
Authorization: Bearer <supabase_access_token>
```

After verification, the authenticated user ID is available as:

```ts
req.user.id;
```

Only permanent authenticated users may participate in the MVP. Anonymous
Supabase users are not accepted.

## Authorization rules

| Action | Permission |
| --- | --- |
| Health check | Public |
| Browse and view sessions | Any authenticated user |
| Create a session | Any authenticated user |
| Edit an open session | Session owner only |
| Delete or cancel a session | Session owner only |
| Request a session | Any authenticated user except its owner |
| Cancel a pending request | Requester only |
| Approve or decline a request | Session owner only |
| Cancel an approved booking | Session owner or approved requester |
| View a meeting link | Session owner or approved requester |
| View or edit a profile | As specified by the profile endpoint |

## Models

### Profile

```ts
interface Profile {
	userId: string;
	displayName: string | null;
	username: string | null;
	bio: string | null;
	avatarKey: string | null;
	nativeLanguage: string | null;
	learningLanguage: string | null;
	timezone: string | null;
	createdAt: string;
	updatedAt: string;
}
```

### Session

Each session represents one available one-to-one practice time.

```ts
type SessionStatus = "open" | "booked" | "completed" | "cancelled";

interface Session {
	sessionId: string;
	ownerId: string;
	title: string;
	targetLanguage: string;
	helpLanguage: string;
	startsAt: string;
	durationMinutes: number;
	status: SessionStatus;
	imageKey: string | null;
	description: string;
	meetingLink?: string;
	createdAt: string;
	updatedAt: string;
}
```

`meetingLink` is omitted unless the viewer is the owner or the approved
requester.

### Session request

```ts
type SessionRequestStatus =
	| "pending"
	| "approved"
	| "declined"
	| "cancelled";

interface SessionRequest {
	requestId: string;
	sessionId: string;
	requesterId: string;
	status: SessionRequestStatus;
	message: string | null;
	createdAt: string;
	respondedAt: string | null;
	updatedAt: string;
}
```

## Session lifecycle

```text
open ────────> booked ────────> completed
  │               │
  └───────────────┴───────────> cancelled
```

- New sessions start as `open`.
- Approving a request changes the session to `booked`.
- A booked session's time cannot be edited.
- An owner may cancel a session.
- If an approved requester cancels the booking before it starts, that request
  becomes `cancelled` and the session returns to `open`.
- Completion may initially be derived from time and later persisted by a job or
  explicit workflow.

## Request lifecycle

```text
pending ─────> approved
   │
   ├─────────> declined
   └─────────> cancelled
```

- Multiple users may have pending requests for one open session.
- A user may not request their own session.
- A user may not have more than one active request for the same session.
- Exactly one request may be approved.
- Approval automatically declines every other pending request.
- Declined and cancelled requests are retained as history.

## Endpoints

The endpoint contract below is the target MVP contract. Some request and profile
endpoints are not implemented yet.

### `GET /health`

Public health check.

### `POST /sessions`

Create an open session. `ownerId` comes from `req.user.id` and must never be
accepted from the client as trusted input.

Request:

```json
{
	"title": "Japanese Conversation",
	"targetLanguage": "Japanese",
	"helpLanguage": "English",
	"startsAt": "2026-08-15T18:00:00Z",
	"durationMinutes": 30,
	"meetingLink": "https://meet.google.com/example",
	"description": "Practice speaking Japanese."
}
```

Response: `201 Created`

```json
{
	"sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### `GET /sessions`

List upcoming sessions. Meeting links are never included.

Query parameters:

| Parameter | Description |
| --- | --- |
| `limit` | Maximum number of results |
| `cursor` | Opaque pagination cursor |

The default browse view returns upcoming `open` sessions ordered by
`startsAt`, then `sessionId`.

### `GET /sessions/:sessionId`

View one session. Include `meetingLink` only when the authenticated viewer is
the owner or approved requester.

### `PATCH /sessions/:sessionId`

Update a session. Owner only.

- An open future session may be edited.
- `startsAt` cannot be changed after the session becomes `booked`.
- Status changes use their dedicated workflows rather than arbitrary patches.

### `DELETE /sessions/:sessionId`

Delete or cancel a session. Owner only.

The implementation may hard-delete an open session with no history. Once a
session has requests, prefer setting its status to `cancelled` so request
history remains meaningful.

### `POST /sessions/:sessionId/requests`

Request an open session.

Request:

```json
{
	"message": "I would like to practice conversational Japanese."
}
```

Rules:

- Session must exist, be open, and be in the future.
- Owner cannot request their own session.
- Requester cannot already have an active request for the session.

Response: `201 Created`

### `POST /sessions/:sessionId/requests/:requestId/approve`

Approve a pending request. Session owner only.

Approval is transactional: approve the selected request, mark the session
`booked`, and decline all other pending requests atomically.

### `POST /sessions/:sessionId/requests/:requestId/decline`

Decline a pending request. Session owner only.

### `POST /sessions/:sessionId/requests/:requestId/cancel`

Cancel a request or approved booking.

- A requester may cancel their own pending request.
- The approved requester or session owner may cancel an approved booking.
- Cancelling an approved booking returns a future session to `open` unless the
  owner cancels the entire session.

### `GET /me/profile`

Return the authenticated user's profile.

### `PATCH /me/profile`

Update editable fields on the authenticated user's profile. Identity and
ownership fields cannot be changed.

### `GET /me/sessions-created`

List sessions owned by the authenticated user, including their request summary.

### `GET /me/session-requests`

List requests made by the authenticated user, joined with session details.

### `GET /me/sessions-booked`

List booked sessions where the authenticated user is either the owner or the
approved requester.

## Error responses

### `400 Bad Request`

Malformed input or validation failure.

### `401 Unauthorized`

Missing, malformed, expired, anonymous, or otherwise invalid access token.

```json
{
	"message": "Authentication required."
}
```

### `403 Forbidden`

The user is authenticated but does not own or control the resource.

### `404 Not Found`

The requested resource does not exist or is intentionally hidden from the
caller.

### `409 Conflict`

A valid request conflicts with current state. Examples include:

- Requesting a session twice
- Requesting one's own session
- Approving a request after another request was approved
- Editing the time of a booked session
- Cancelling a request from an invalid state

### `500 Internal Server Error`

Unexpected server failure. Internal details are not returned to clients.
