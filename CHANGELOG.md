# Changelog

## 0.32.0

- Breaking: remove the deprecated sensitive-profile contract — the
  `profileSensitive` API path, `ProfileSensitiveDetails`,
  `ProfileSensitiveDetailsInput`, and `profile.sensitive` on the workspace
  client. Ordinary profile facts stay on the canonical profile and profile
  document surfaces, identity secrets stay on the secrets contract, and no
  compatibility alias or replacement wrapper is provided.

## 0.31.0

- Breaking: remove the unsupported `browser_session` connector auth mode and the
  `sessionKey` auth-reference field from the public connector contract. Connector
  create and update inputs now fail closed on both, with no compatibility alias
  or fallback reader; the supported secret-reference auth modes are unchanged.

## 0.30.0

- Add separately versioned Capture-resolution v2 list, detail, and completion
  transport plus a strict URL-only Job-facts shape. The v1 destination-class
  contracts remain available during the compatibility window.
- Expose optional bounded hidden/closed provider status on resolved v2
  destination projections and completion details without reusing the issue
  channel; v1 read schemas remain strict and reject that field.

## 0.29.0

- Move the maintained SDK identity from the unscoped `sparxie` package to
  `@sparxie/sdk` without changing the public TypeScript contract.

- Add separately versioned Capture resolution projections, opaque
  bidirectional keyset paging, manual completion commands, and supported typed
  HTTP client operations without widening existing Capture or Job responses.
- Add separately versioned workspace Company and Job-assignment contracts with
  capability gating, distinct opaque directory/duplicate/assignment/history
  pages, revision-guarded manual lifecycle commands, canonical merge lookup,
  and fail-closed typed HTTP client operations.

## 0.28.0

- Remove the retired raw-source, canonical-candidate, and sourcing-finding
  compatibility implementation from the shipped package while preserving the
  supported normalization retry outcomes through a clean lifecycle contract.
- Add workspace-scoped installed connector descriptors and trusted dynamic
  option queries with bounded declarative schemas, strict identity validation,
  transport cancellation, and sanitized compatibility errors.
- Add a bounded workspace connector overview contract and typed client with
  sanitized current health, latest-run, action, and cooldown projections.
- Expose strict, sanitized connector-run lifecycle counts for provider intake,
  destination normalization, and sourcing outcomes through run-list and trigger
  responses.
- Replace target-shaped connector run progress and run-wide retry hints with opaque source execution scopes, operation-level outcomes, typed continuous frontier/backfill synchronization state, and explicit failed/cancelled invocation outcomes.
- Clarify, without breaking the existing contract, that weekly connector schedules use ISO-8601 weekday numbering (`1` = Monday through `7` = Sunday).
