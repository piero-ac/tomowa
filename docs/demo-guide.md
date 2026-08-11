# Tomowa hosted demo

Tomowa is a backend API for arranging one-to-one language-exchange sessions.
The hosted demo exposes the complete API through Swagger UI and provides three
shared personas so reviewers can explore the workflows without account setup.

## Links

- Swagger UI: <https://tomowa.onrender.com/docs/>
- OpenAPI document: <https://tomowa.onrender.com/openapi.json>
- Health check: <https://tomowa.onrender.com/health>

The free hosted service may need a short time to wake up before the first
request completes.

## Sign in

1. Open Swagger UI.
2. Run `POST /api/demo/login` with one of the roles below.
3. Copy the returned `accessToken` value.
4. Select **Authorize** at the top of Swagger UI.
5. Paste the token itself into the bearer-auth field and authorize.
6. Call `GET /api/me/profile` to confirm the active persona.

No password is accepted by the demo-login endpoint. The server holds the demo
account credentials and exchanges them with Supabase Auth for a normal,
short-lived access token.

## Personas

| Role        | Starting point                                                        |
| ----------- | --------------------------------------------------------------------- |
| `owner`     | Owns open and booked sessions, including one with pending requests.   |
| `requester` | Has pending and approved requests, and owns one open session.         |
| `other`     | Has pending and declined requests for privacy and conflict scenarios. |

These labels select demo accounts; they are not application roles. Every
persona can create sessions, request another user's session, and manage the
resources they own.

## Suggested walkthrough

### 1. Inspect the starting state

Sign in as `owner`, then call:

- `GET /api/me/profile`
- `GET /api/me/sessions-created`
- `GET /api/me/sessions-booked`

The responses demonstrate profile mapping, cursor pagination, aggregate
request counts, and meeting-link privacy.

### 2. Review and approve a request

As `owner`:

1. Use `GET /api/me/sessions-created` and find **Choose a Language Practice
   Partner**.
2. Copy its `sessionId`.
3. Call `GET /api/sessions/{sessionId}/requests`.
4. Approve one pending request with
   `POST /api/sessions/{sessionId}/requests/{requestId}/approve`.

The session becomes booked atomically, the selected request becomes approved,
and the competing pending request becomes declined.

### 3. Cancel and reopen a booking

Sign in as the persona whose request was approved. Use
`GET /api/me/session-requests` to find the approved request, then call
`POST /api/sessions/{sessionId}/requests/{requestId}/cancel`.

The approved request is cancelled and the booked session reopens in the same
transaction. The private meeting link is no longer exposed to that requester.

### 4. Create a new workflow

1. Create a future session with `POST /api/sessions`.
2. Sign in as another persona and create a request for that session.
3. Sign back in as its owner and approve or decline the request.
4. Inspect the result through the `/api/me/*` list endpoints.

### 5. Verify authorization

As `other`, try to update a session owned by `owner`. The API should return
`403 Forbidden`. Try reading a booked session as an unrelated user and confirm
that its `meetingLink` is `null`.

## Shared-demo notes

- Demo state is shared, so another reviewer may have changed a starting
  scenario. You can create a fresh session or try another persona if needed.
- The baseline is reset manually and periodically.
- Session links use non-functional `example.test` URLs.
- Do not enter personal or sensitive information.
- Treat access tokens like passwords and do not share them.

For the complete endpoint contract, request bodies, responses, and error
definitions, use Swagger UI or [`openapi.yaml`](../openapi.yaml).
