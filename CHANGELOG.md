# Changelog

## Unreleased

- Add exact `connectorRunId` filtering to the workspace-scoped raw-source list;
  records match any persisted occurrence even when a later run is the latest.
- Add a bounded workspace connector overview contract and typed client with
  sanitized current health, latest-run, action, and cooldown projections.
- Expose strict, sanitized connector-run lifecycle counts for provider intake,
  destination normalization, and sourcing outcomes through run-list and trigger
  responses.
- Add workspace-scoped `sourcing.rawRecords.list` with cursor keyset pagination and sanitized raw-record summary rows.
- Replace target-shaped connector run progress and run-wide retry hints with opaque source execution scopes, operation-level outcomes, typed continuous frontier/backfill synchronization state, and explicit failed/cancelled invocation outcomes.
- Clarify, without breaking the existing contract, that weekly connector schedules use ISO-8601 weekday numbering (`1` = Monday through `7` = Sunday).
