# Changelog

## Unreleased

- Replace target-shaped connector run progress and run-wide retry hints with opaque source execution scopes, operation-level outcomes, typed continuous frontier/backfill synchronization state, and explicit failed/cancelled invocation outcomes.
- Clarify, without breaking the existing contract, that weekly connector schedules use ISO-8601 weekday numbering (`1` = Monday through `7` = Sunday).
