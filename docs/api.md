# Tomowa API

## Overview

Tomowa exposes a REST API built with **Express.js** and **TypeScript**.

Authentication is handled by **Amazon Cognito**.

The backend verifies the Cognito JWT on protected routes and uses the authenticated user's `sub` as the user identifier throughout the application.

Base URL

```
/api
```

---

# Authentication

All endpoints require authentication unless explicitly stated otherwise.

Protected routes expect:

```
Authorization: Bearer <access_token>
```

After the JWT is verified, the authenticated user ID is available as:

```ts
req.user.id;
```

---

# Authorization Rules

| Action            | Permission                   |
| ----------------- | ---------------------------- |
| Browse sessions   | Any authenticated user       |
| View session      | Any authenticated user       |
| Create session    | Any authenticated user       |
| Edit session      | Organizer only               |
| Delete session    | Organizer only               |
| Join session      | Any authenticated user       |
| Leave session     | Joined attendee              |
| View meeting link | Organizer or joined attendee |

---

# Session Model

```ts
interface Session {
	sessionId: string;
	organizerId: string;
	title: string;
	targetLanguage: string;
	helpLanguage: string;
	startsAt: string;
	capacity: number;
	attendeeCount: number;
	meetingLink: string;
	description?: string;
	createdAt: string;
	updatedAt: string;
}
```

---

# Endpoints

---

## POST /api/sessions

Create a new session.

Authentication:

- Required

### Request

```json
{
	"title": "Japanese Conversation",
	"targetLanguage": "Japanese",
	"helpLanguage": "English",
	"startsAt": "2026-08-15T18:00:00Z",
	"capacity": 4,
	"meetingLink": "https://meet.google.com/example",
	"description": "Practice speaking Japanese."
}
```

### Response

**201 Created**

```json
{
	"sessionId": "sess_123"
}
```

---

## GET /api/sessions

Browse all upcoming sessions.

Authentication:

- Required

### Query Parameters

| Parameter | Description       |
| --------- | ----------------- |
| limit     | Number of results |
| cursor    | Pagination cursor |

### Response

```json
{
	"items": [],
	"nextCursor": null
}
```

Meeting links are **never** returned from this endpoint.

---

## GET /api/sessions/:sessionId

View a session.

Authentication:

- Required

### Response

```json
{
	"sessionId": "sess_123",
	"organizerId": "user_123",
	"title": "Japanese Conversation",
	"targetLanguage": "Japanese",
	"helpLanguage": "English",
	"startsAt": "2026-08-15T18:00:00Z",
	"capacity": 4,
	"attendeeCount": 2,
	"description": "Practice speaking Japanese.",
	"viewerStatus": "joined"
}
```

If the authenticated user is either:

- organizer
- joined attendee

the response additionally includes:

```json
{
	"meetingLink": "https://meet.google.com/example"
}
```

---

## PUT /api/sessions/:sessionId

Update an existing session.

Authentication:

- Required

Authorization:

- Organizer only

### Request

Same schema as session creation.

### Response

```json
{
	"success": true
}
```

---

## DELETE /api/sessions/:sessionId

Delete a session.

Authentication:

- Required

Authorization:

- Organizer only

### Response

```json
{
	"success": true
}
```

---

## POST /api/sessions/:sessionId/join

Join a session.

Authentication:

- Required

### Rules

- Cannot join twice.
- Cannot exceed session capacity.
- Organizer cannot join their own session.

### Response

```json
{
	"success": true
}
```

---

## DELETE /api/sessions/:sessionId/join

Leave a session.

Authentication:

- Required

### Response

```json
{
	"success": true
}
```

---

## GET /api/me/sessions-created

Returns every session created by the authenticated user.

Authentication:

- Required

### Response

```json
{
	"items": []
}
```

---

## GET /api/me/sessions-joined

Returns every session the authenticated user has joined.

Authentication:

- Required

### Response

```json
{
	"items": []
}
```

---

# Error Responses

## 400 Bad Request

Request validation failed.

```json
{
	"message": "Validation failed."
}
```

---

## 401 Unauthorized

Missing or invalid access token.

```json
{
	"message": "Unauthorized."
}
```

---

## 403 Forbidden

Authenticated but lacks permission.

```json
{
	"message": "Forbidden."
}
```

---

## 404 Not Found

Requested resource does not exist.

```json
{
	"message": "Session not found."
}
```

---

## 409 Conflict

Business rule violation.

Examples:

- Session is full
- User already joined
- Organizer attempting to join own session

```json
{
	"message": "Session is already full."
}
```

---

## 500 Internal Server Error

Unexpected server error.

```json
{
	"message": "Internal server error."
}
```
