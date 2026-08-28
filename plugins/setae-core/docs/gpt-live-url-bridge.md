# SETAE GPT-Live URL Bridge

## Purpose

ChatGPT Live cannot call connected apps or custom actions, but it can use web
search. The URL bridge lets a user paste one short-lived setup prompt into a
normal ChatGPT conversation and then use GPT-Live in that same conversation.
It does not use the OpenAI API.

The profile screen is the only place where a session can be issued, rotated, or
disabled. The full capability URL is returned once.

## User flow

1. Open `プロフィール > GPT-Live連携`.
2. Select read-only or read-and-write access.
3. Select one hour, 24 hours, or seven days.
4. Issue a session and copy the one-time setup prompt.
5. Send the prompt as text in ChatGPT, then start GPT-Live in that conversation.
6. Disable or reissue the session from SETAE when finished.

Reissuing immediately invalidates the previous URL.

## URL surface

All routes use exact `GET` requests under:

```text
https://setae.net/live/{short-lived-capability-token}
```

Available reads:

```text
GET /live/{token}
GET /live/{token}/animals?q={query}&scope=active&page=1&per_page=20
GET /live/{token}/animal/{id}?history=15
```

Writes are always staged:

```text
GET /live/{token}/prepare?kind=record&id=123&type=feed&date=2026-07-23
GET /live/{token}/prepare?kind=update&id=123&expected_version={version}&name=P023
```

`prepare` validates ownership, values, archive state, and version but does not
change husbandry data. It returns an opaque ticket valid for five minutes.
Only after explicit user confirmation may ChatGPT retrieve:

```text
GET /live/{token}/commit/{ticket}
```

Commit tickets are bound to the user and Live session, are one-time and
idempotent, and retain a replay result for one hour. A per-ticket lock prevents
concurrent duplicate writes.

## Allowed changes

- Feed, molt, pairing, observation, and growth records
- Name
- Gender
- Husbandry status
- Encyclopedia species ID or a free-form species name
- Archive state

The bridge does not expose deletion, ownership transfer, account, billing, or
credential operations.

## Security properties

- HTTPS is mandatory outside local development.
- Session secrets are stored only as keyed hashes.
- Session mapping contains only an opaque session ID and WordPress user ID.
- Sessions expire after one hour, 24 hours, or seven days.
- The full URL and setup prompt are shown once.
- Read-only sessions cannot create confirmation tickets.
- Writes require a five-minute confirmation ticket.
- Record writes use stable request IDs to prevent duplicates.
- Animal edits require the latest version value.
- Responses use `no-store`, `noindex`, `no-referrer`, and a restrictive CSP.
- Rate limits apply to issuance, authentication, and URL retrieval.
- The latest 50 session and commit events are retained in the user's audit meta.

## Server logging

The capability token is part of the URL. WordPress does not write it to plugin
logs, but a reverse proxy, CDN, WAF, or web server may log the request path.
Production infrastructure should redact `/live/` paths or write them to a
restricted, short-retention log.

For nginx, use a dedicated location or a map-based log format that records only
`/live/[redacted]` for these requests. Do not place the standard `$request` or
`$request_uri` value containing the token in public analytics.

## Verification

Verify on each supported ChatGPT surface:

1. Exact status URL retrieval
2. Search with Japanese and Latin names
3. Detail and record history retrieval
4. `prepare` makes no data change
5. Commit only after spoken confirmation
6. Repeated commit does not duplicate a record
7. Expired tickets return `410`
8. Reissued and disabled session URLs return `401`
9. Read-only sessions return `403` for `prepare`
10. Free and paid GPT-Live behavior on web, iOS, and Android

GPT-Live web search is not a documented arbitrary HTTP client. This bridge must
be treated as a compatibility path and tested again when OpenAI changes Live or
Search behavior.
