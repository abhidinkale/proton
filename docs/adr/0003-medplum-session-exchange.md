# ADR 0003 — Medplum tokens are exchanged through the identity provider, not re-verified locally

- **Status:** accepted
- **Date:** 2026-10-24
- **Phase:** 2 (one authenticated API client)

## Context

The web client signs clinicians in against Medplum (OIDC) and then calls the Proton
API, which is a separate deployment with its own HMAC-signed session tokens. Until
now the two systems never met: the browser held a Medplum access token, the API
accepted only Proton tokens (or, in synthetic mode, an unauthenticated development
persona). Outside synthetic mode every clinical call was a 401.

Phase 2 required a bridge. Two options were on the table:

1. **Verify the Medplum JWT locally** — fetch the JWKS, validate RS256 signature,
   `iss`, `aud`, `exp`, then use the claims. Fast, no per-login round trip.
2. **Delegate to the identity provider** — call Medplum's `GET /auth/me` with the
   bearer token and accept the response as the authoritative identity.

## Decision

Use option 2, implemented in `apps/api/middleware/medplumExchange.js`.

`POST /api/auth/exchange` accepts a Medplum access token, calls
`${MEDPLUM_ORIGIN}/auth/me` with a 5-second timeout, and maps the returned
`Practitioner` to a Proton actor:

- `actorId`: `usr-medplum-<practitioner id>`
- `actorRole`: `physician`
- `actorName`: `HumanName.text` or assembled prefix/given/family
- `tenantId`: `PROTON_DEFAULT_TENANT_ID` (default `org-default`)
- `npi`: first identifier whose system matches `npi`

Only `Practitioner` resources are accepted. `Patient`, service accounts, and
inactive practitioners are refused. The resulting Proton session is valid for 12
hours and records `mfaVerified: false` / `mfaMethod: 'medplum_oidc'`, because the
API has no evidence of the IdP's assurance level and must not claim one.

## Why not local JWKS verification

- **One verification implementation.** JWKS caching, key rotation, clock skew,
  audience matching, and algorithm confusion are easy to get subtly wrong. The
  IdP already does all of it correctly. We only need the answer at sign-in.
- **Revocation.** A locally verified JWT remains valid until `exp`. `/auth/me`
  reflects current account state (disabled practitioner, deleted account), which
  matters for a clinical system.
- **Operational simplicity.** No JWKS cache to warm, no key-rotation outage mode,
  no extra dependency. One extra round trip per login is acceptable.
- **Fail-closed by construction.** Network failure, timeout, non-2xx, unreadable
  body, and wrong resource type each map to a distinct error; none of them issue
  a session. The access token is never logged or echoed.

The cost is availability: if Medplum is down, no new Proton sessions can be
created. That is the correct trade-off — a clinician should not receive a fresh
clinical credential from an identity provider we cannot currently reach. Existing
sessions continue until their own expiry/inactivity window.

## Consequences

- `MEDPLUM_BASE_URL` becomes required in production for authentication, not only
  for FHIR persistence. It may be configured as an origin or a `/fhir/R4` base;
  the module normalises both.
- The exchange endpoint is rate-limited with the same limiter as login
  (10/minute/IP).
- Local development keeps `/api/auth/login` with synthetic accounts while
  `PROTON_SYNTHETIC_MODE` is enabled. In production those accounts are disabled
  and this exchange is the only path to a session.
- Client side: `src/lib/sessionToken.ts` owns the Proton credential;
  `src/lib/api.ts` attaches it to every API request and converts an authenticated
  401 into one `proton:session-expired` event. There is deliberately **no**
  automatic 401 retry: replaying a clinician's signed write is worse than asking
  them to sign in again.
- Known gap: the doctor profile is still mirrored in `localStorage`, and the
  Proton token is stored alongside it for tab continuity. Role and tenant are
  read from the signed token server-side, never from storage, so a storage
  compromise cannot escalate privileges — but moving to an httpOnly cookie
  session remains the Phase 10 hardening item.
