# Tomowa DynamoDB Design

## Purpose

This document defines the DynamoDB table design for Tomowa.

The design is derived from:

1. `docs/api.md`
2. `docs/access-patterns.md`

Tomowa uses DynamoDB from an access-pattern-first perspective, not a relational schema-first perspective.

---

# Table Strategy

Tomowa uses a **single DynamoDB table**.

Table name:

```text
TomowaTable
```

Reason:

Tomowa has a small, tightly related domain:

- Sessions
- RSVP records

Both entities revolve around the same core access pattern: users creating and joining sessions.

A single-table design keeps related data close together and allows efficient session-centered reads and writes.

---

# Primary Key

The table uses a composite primary key.

```text
PK: string
SK: string
```

## Key Meaning

| Attribute | Meaning                                   |
| --------- | ----------------------------------------- |
| `PK`      | Groups related items together             |
| `SK`      | Identifies the item type within the group |

---

# Item Types

Tomowa stores two main item types:

1. Session item
2. RSVP item

---

# Session Item

A session item stores the main information about one language exchange session.

## Key Shape

```text
PK = SESSION#<sessionId>
SK = SESSION
```

## Example

```json
{
	"PK": "SESSION#sess_123",
	"SK": "SESSION",

	"entityType": "SESSION",

	"sessionId": "sess_123",
	"organizerId": "user_123",

	"title": "Japanese Conversation Practice",
	"targetLanguage": "Japanese",
	"helpLanguage": "English",
	"difficulty": "Intermediate",

	"startsAt": "2026-08-15T18:00:00Z",

	"capacity": 4,
	"attendeeCount": 2,

	"meetingLink": "https://meet.google.com/example",
	"description": "Practice Japanese conversation with English support.",

	"status": "OPEN",

	"createdAt": "2026-07-06T21:00:00Z",
	"updatedAt": "2026-07-06T21:00:00Z",

	"GSI1PK": "SESSION_STATUS#OPEN",
	"GSI1SK": "STARTS_AT#2026-08-15T18:00:00Z#SESSION#sess_123",

	"GSI2PK": "ORGANIZER#user_123",
	"GSI2SK": "STARTS_AT#2026-08-15T18:00:00Z#SESSION#sess_123"
}
```

---

# RSVP Item

An RSVP item represents one user joining one session.

## Key Shape

```text
PK = SESSION#<sessionId>
SK = RSVP#USER#<userId>
```

## Example

```json
{
	"PK": "SESSION#sess_123",
	"SK": "RSVP#USER#user_456",

	"entityType": "RSVP",

	"sessionId": "sess_123",
	"userId": "user_456",

	"joinedAt": "2026-07-06T22:00:00Z",

	"sessionStartsAt": "2026-08-15T18:00:00Z",
	"sessionTitle": "Japanese Conversation Practice",
	"targetLanguage": "Japanese",
	"helpLanguage": "English",
	"difficulty": "Intermediate",

	"GSI3PK": "USER#user_456",
	"GSI3SK": "STARTS_AT#2026-08-15T18:00:00Z#SESSION#sess_123"
}
```

## Denormalization Decision

The RSVP item stores a small session summary:

- `sessionStartsAt`
- `sessionTitle`
- `targetLanguage`
- `helpLanguage`
- `difficulty`

Reason:

`GET /api/me/sessions-joined` can return joined sessions without making one read per session.

This is intentional DynamoDB denormalization.

For MVP, if a session title or time changes, the backend should update the session item. Updating denormalized RSVP summaries can be handled simply or deferred depending on implementation complexity.

---

# Global Secondary Indexes

Tomowa uses three GSIs.

---

## GSI1: Browse Upcoming Sessions

Used by:

```text
GET /api/sessions
```

Purpose:

```text
List upcoming open sessions ordered by start time.
```

Index keys:

```text
GSI1PK
GSI1SK
```

Session item values:

```text
GSI1PK = SESSION_STATUS#OPEN
GSI1SK = STARTS_AT#<startsAt>#SESSION#<sessionId>
```

Query:

```text
GSI1PK = SESSION_STATUS#OPEN
GSI1SK >= STARTS_AT#<currentTimestamp>
```

Sort order:

```text
Soonest sessions first
```

Notes:

- Only session items are written to this index.
- RSVP items do not need `GSI1PK` or `GSI1SK`.
- Meeting links must not be returned from browse responses.

---

## GSI2: Sessions Created By Me

Used by:

```text
GET /api/me/sessions-created
```

Purpose:

```text
List sessions created by the authenticated user.
```

Index keys:

```text
GSI2PK
GSI2SK
```

Session item values:

```text
GSI2PK = ORGANIZER#<organizerId>
GSI2SK = STARTS_AT#<startsAt>#SESSION#<sessionId>
```

Query:

```text
GSI2PK = ORGANIZER#<authenticatedUserId>
```

Sort order:

```text
By session start time
```

Notes:

- Only session items are written to this index.
- This supports dashboard views for sessions the user created.

---

## GSI3: Sessions Joined By Me

Used by:

```text
GET /api/me/sessions-joined
```

Purpose:

```text
List sessions joined by the authenticated user.
```

Index keys:

```text
GSI3PK
GSI3SK
```

RSVP item values:

```text
GSI3PK = USER#<userId>
GSI3SK = STARTS_AT#<sessionStartsAt>#SESSION#<sessionId>
```

Query:

```text
GSI3PK = USER#<authenticatedUserId>
```

Sort order:

```text
By session start time
```

Notes:

- Only RSVP items are written to this index.
- RSVP items include denormalized session summary fields to avoid N+1 reads.

---

# Access Pattern Mapping

## Create Session

Endpoint:

```text
POST /api/sessions
```

Operation:

```text
PutItem
```

Item:

```text
Session item
```

Condition:

```text
attribute_not_exists(PK)
```

Writes:

```text
PK = SESSION#<sessionId>
SK = SESSION
```

Also writes GSI attributes:

```text
GSI1PK / GSI1SK
GSI2PK / GSI2SK
```

---

## Browse Upcoming Sessions

Endpoint:

```text
GET /api/sessions
```

Operation:

```text
Query GSI1
```

Key condition:

```text
GSI1PK = SESSION_STATUS#OPEN
GSI1SK >= STARTS_AT#<currentTimestamp>
```

Returns:

```text
Session items
```

Service-layer response removes:

```text
meetingLink
```

---

## View Session

Endpoint:

```text
GET /api/sessions/:sessionId
```

Operations:

```text
GetItem Session
GetItem RSVP for current user
```

Session key:

```text
PK = SESSION#<sessionId>
SK = SESSION
```

RSVP key:

```text
PK = SESSION#<sessionId>
SK = RSVP#USER#<authenticatedUserId>
```

Authorization:

```text
Return meetingLink only if:
  session.organizerId === authenticatedUserId
  OR RSVP item exists
```

---

## Update Session

Endpoint:

```text
PUT /api/sessions/:sessionId
```

Operations:

```text
GetItem Session
UpdateItem Session
```

Session key:

```text
PK = SESSION#<sessionId>
SK = SESSION
```

Authorization:

```text
Only update if session.organizerId === authenticatedUserId
```

Conditions:

```text
capacity >= attendeeCount
```

Updates:

```text
Session fields
updatedAt
GSI1SK if startsAt changes
GSI2SK if startsAt changes
```

Notes:

If `startsAt`, `title`, or language fields change, RSVP denormalized summaries may become stale.

MVP options:

1. Allow updates only while attendeeCount is 0.
2. Update the session item only and accept stale joined-dashboard summaries.
3. Query RSVP items and update summaries.

Recommended MVP decision:

```text
Allow updates, update the main Session item, and keep RSVP summary updates as a future improvement unless implementation remains simple.
```

---

## Delete Session

Endpoint:

```text
DELETE /api/sessions/:sessionId
```

Recommended MVP operation:

```text
Soft delete
```

Instead of physically deleting the session, update:

```text
status = DELETED
```

And remove or change browse index values:

```text
GSI1PK = SESSION_STATUS#DELETED
```

Authorization:

```text
Only organizer can delete.
```

Reason:

DynamoDB does not cascade deletes.

Soft delete avoids needing to immediately delete all RSVP items.

Joined-session dashboards can ignore or label deleted sessions.

---

## Join Session

Endpoint:

```text
POST /api/sessions/:sessionId/join
```

Operation:

```text
TransactWriteItems
```

Transaction steps:

1. Update Session item:
   - Increment `attendeeCount` by 1
   - Only if session is open
   - Only if attendeeCount < capacity
   - Only if organizerId is not authenticated user

2. Put RSVP item:
   - Only if RSVP item does not already exist

Session update key:

```text
PK = SESSION#<sessionId>
SK = SESSION
```

RSVP put key:

```text
PK = SESSION#<sessionId>
SK = RSVP#USER#<authenticatedUserId>
```

Conditions:

```text
Session exists
status = OPEN
attendeeCount < capacity
organizerId <> authenticatedUserId
attribute_not_exists(RSVP PK/SK)
```

Writes:

```text
RSVP item
Updated attendeeCount
GSI3PK / GSI3SK on RSVP item
```

Reason:

A transaction prevents:

- duplicate RSVPs
- overbooking
- incorrect attendee counts

---

## Leave Session

Endpoint:

```text
DELETE /api/sessions/:sessionId/join
```

Operation:

```text
TransactWriteItems
```

Transaction steps:

1. Delete RSVP item:
   - Only if RSVP exists

2. Update Session item:
   - Decrement `attendeeCount` by 1
   - Only if attendeeCount > 0

RSVP delete key:

```text
PK = SESSION#<sessionId>
SK = RSVP#USER#<authenticatedUserId>
```

Session update key:

```text
PK = SESSION#<sessionId>
SK = SESSION
```

Conditions:

```text
RSVP exists
attendeeCount > 0
```

Reason:

A transaction keeps RSVP records and attendee counts consistent.

---

## List Sessions Created By Me

Endpoint:

```text
GET /api/me/sessions-created
```

Operation:

```text
Query GSI2
```

Key condition:

```text
GSI2PK = ORGANIZER#<authenticatedUserId>
```

Returns:

```text
Session items
```

Service-layer response may include meetingLink because the user is the organizer.

---

## List Sessions Joined By Me

Endpoint:

```text
GET /api/me/sessions-joined
```

Operation:

```text
Query GSI3
```

Key condition:

```text
GSI3PK = USER#<authenticatedUserId>
```

Returns:

```text
RSVP items with denormalized session summaries
```

Service-layer response:

```text
Return joined session summaries.
Do not include meetingLink from RSVP items.
If the user opens a specific session page, GET /api/sessions/:sessionId decides whether to include meetingLink.
```

---

# Meeting Link Authorization

The meeting link is stored only on the Session item.

It is not stored on RSVP items.

This avoids duplicating sensitive data.

Rules:

```text
Browse sessions:
  Never return meetingLink

View session:
  Return meetingLink only if organizer or attendee

Created sessions dashboard:
  Organizer may see meetingLink if needed

Joined sessions dashboard:
  Do not include meetingLink unless specifically needed
```

Authorization is enforced in the Express service layer, not by DynamoDB projection expressions.

---

# URL Validation

Meeting links should be validated before storage.

MVP validation rules:

```text
Must be a valid URL
Must use HTTPS
Must belong to an allowed meeting provider
```

Example allowed hosts:

```text
meet.google.com
zoom.us
us02web.zoom.us
discord.gg
discord.com
teams.microsoft.com
```

Google Safe Browsing or similar malicious URL scanning is out of scope for MVP and may be listed as a future improvement.

---

# CDK Table Requirements

The CDK stack should create:

```text
DynamoDB table with:
- Partition key: PK
- Sort key: SK
- Billing mode: PAY_PER_REQUEST
- Removal policy suitable for development
- Point-in-time recovery optional for MVP
```

Indexes:

```text
GSI1
- Partition key: GSI1PK
- Sort key: GSI1SK

GSI2
- Partition key: GSI2PK
- Sort key: GSI2SK

GSI3
- Partition key: GSI3PK
- Sort key: GSI3SK
```

Recommended development removal policy:

```text
DESTROY
```

Recommended production removal policy:

```text
RETAIN
```

For this portfolio project, `DESTROY` is acceptable during active development.

---

# IAM Requirements

The Express API task role should have access to this table only.

Required DynamoDB actions:

```text
dynamodb:GetItem
dynamodb:PutItem
dynamodb:UpdateItem
dynamodb:DeleteItem
dynamodb:Query
dynamodb:TransactWriteItems
```

Resource scope:

```text
TomowaTable
TomowaTable indexes
```

Avoid broad permissions like:

```text
dynamodb:*
```

---

# Final Design Summary

Tomowa uses:

```text
One DynamoDB table
Two item types
Three GSIs
Service-layer authorization
DynamoDB transactions for RSVP correctness
Soft delete for sessions
```

Primary key:

```text
PK = SESSION#<sessionId>
SK = SESSION
SK = RSVP#USER#<userId>
```

GSIs:

```text
GSI1 = browse upcoming sessions
GSI2 = sessions created by me
GSI3 = sessions joined by me
```

This design supports the MVP access patterns while keeping the system small enough to complete in 2–3 weeks.
