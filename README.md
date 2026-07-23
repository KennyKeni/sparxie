# sparxie

Shared TypeScript contracts, validators, and HTTP client for Valedictorian tools.

## Install

```sh
pnpm add sparxie
```

## Usage

```ts
import {
  createHttpValedictorianClient,
  defaultValedictorianApiBaseUrl,
} from 'sparxie'

const client = createHttpValedictorianClient({
  baseUrl: defaultValedictorianApiBaseUrl,
})

const workspace = client.forWorkspace('workspace-id')
const applications = await workspace.applications.list()

console.log(applications.items)
```

## Connector authentication

Connector create, update, and status DTOs carry secret references and auth metadata only. Plaintext credential values stay behind workspace write-only secret endpoints and are not returned by normal connector reads.

## Connector-declared settings

Workspace clients can read sanitized installed connector descriptors and query
only the dynamic option sources declared by those descriptors:

```ts
const descriptors = await workspace.connectors.descriptors.list()
const descriptor = await workspace.connectors.descriptors.get(
  'jobright.resolver',
  '0.13.0',
)
const locationSource = descriptor.dynamicOptions!.sources.find(
  (source) => source.id === 'jobright.location',
)!

const controller = new AbortController()
const result = await workspace.connectors.options.query({
  connectorInstanceId: 'jobright-session',
  body: {
    sourceId: 'jobright.location',
    operation: { kind: 'search', search: 'New York', limit: 20 },
    dependencies: { country: 'US' },
  },
  expectedIdentity: {
    connectorId: descriptor.connectorId,
    connectorVersion: descriptor.connectorVersion,
    filterSchemaVersion: descriptor.filterSchema!.version,
    catalogVersion: descriptor.dynamicOptions!.version,
    sourceVersion: locationSource.version,
  },
}, { signal: controller.signal })

void descriptors
void result
```

Descriptor schemas and option catalogs are closed, finite declarative data.
They never include credentials, auth grants, provider routes, modules, or
executable callbacks. The query body contains only the declared source,
operation, and dependencies; connector release identities are checked locally
against the response but are not serialized. Aborting the signal cancels the
transport request, while a server-returned `cancelled` status remains a normal
settled result.

## Connector overview

Connector management views can fetch a bounded workspace page without issuing
per-connector inspect and run-history requests:

```ts
const page = await workspace.connectors.overview.list({
  enabled: true,
  severity: 'warning',
  limit: 50,
})
```

Pages use opaque cursor continuation in stable UTF-8 bytewise connector-id
order. `enabled`, `severity`, and `status` filters are conjunctive and must stay
unchanged when continuing with `nextCursor`. The response intentionally has no
total or offset, so backends can fetch a connector page and its latest run in
work proportional to that page rather than run-history size.

Rows contain connector identity and enabled state, existing public health and
action projections, a compact latest-run summary when present, and only the
public `retryAt` for cooldowns. They exclude credentials, auth/session data,
configuration and filters, execution-scope and retry internals, raw provider
payloads, and runner or deployment state. Existing connector inspect and
run-list methods remain available for detail views.

The compact run's required nullable `cancellationKind` is `user_skipped` only
when a cancelled run represents an explicit user skip; otherwise it is `null`.
It does not expose the full run's free-form cancellation reason or internal
codes.

Each overview row is an atomic projection. Unambiguous run-backed health uses
this precedence and must agree in both directions with `latestRun`:

| Latest run signal | Required health status |
| --- | --- |
| No latest run | `never_run` |
| Queued, in progress | `queued` |
| Running with newest frontier advancing | `checking_newest` |
| Otherwise running with historical backfill advancing | `backfilling` |
| Otherwise running with pending resolutions | `resolving` |
| Running before another progress signal is visible | `checking_newest` |
| Caught up, boundary exhausted, or source exhausted | Matching outcome |
| Cooling down with public `retryAt` | `cooling_down` |
| Cancelled with `cancellationKind: null`, or failed | Matching run status |
| Cancelled with `cancellationKind: user_skipped` | `skipped` |

`authentication_required` with an auth action and generic `blocked` with at
least one `captcha`, `configuration`, `manual_review`, or `rate_limit` action
are independent overlays: current blockers may change after the latest run, so
those states may replace a derived run-backed state. Those non-auth actions do
not conversely force blocked health. A yielded/skipped run remains intentionally
ambiguous. A cooldown is present exactly when the row presents matching
cooling-down health and run outcome.

## Capture → Job → Opportunity → Application

The workspace client exposes the four lifecycle aggregates directly. There is
no compatibility `sourcing` namespace.

```ts
const created = await workspace.captures.create({
  evidenceMode: 'reported',
  adapter: { id: 'valedictorian-cli', kind: 'cli', version: '1.0.0' },
  observedAt: new Date().toISOString(),
  providerRecordId: 'opening-448',
  providerSchema: 'job-opening/v1',
  payload: { employer: 'Northstar Robotics', title: 'Controls Intern' },
  evidence: [],
})
```

A Capture preserves observed evidence and its immutable Evidence mode.
Corrections, removals, and restores create attributable history revisions. A
Job owns UUIDv7 identity, canonical fact and availability revisions, normalized
external identities, and exact Capture/evidence references. An Opportunity
references its Job and owns only workspace evaluation, rank, cutoff,
disposition, and override state.

An Application references both its Opportunity and Job. Promotion copies a
stable pursuit snapshot containing company, role, source, term/timing,
location/work-mode, and initial destination/link facts. Later Job revisions do
not rewrite an active pursuit. `applications.refreshSnapshot` performs an
explicit revision and lets callers preserve company, source, and link edits;
those three edit categories also have dedicated commands.

`captures.promoteToJob`, `jobs.promoteToOpportunity`, and
`opportunities.promoteToApplication` are idempotent and accept bounded
idempotency keys. Structural failures use the closed lifecycle blocker codes;
policy outcomes use typed warnings. Warning overrides require actor, warning
codes, and rationale. Removal commands require an explicit dependent-handling
choice and return typed affected or blocking lineage.

## Error contracts

`sparxie` owns the public error-body shapes, failure-kind taxonomy, validators,
and typed HTTP/transport/protocol classification used by Valedictorian clients.
Capability error codes remain endpoint-specific discriminated unions; this
package does not introduce a global enum of every domain error code.

Validated non-2xx responses become `ValedictorianHttpError` (or a capability
subclass). No-response fetch failures become `ValedictorianTransportError`.
Malformed, noncanonical, or status-inconsistent contracted responses become
`ValedictorianProtocolError`. Unknown or unvalidated error payloads fail closed
to a safe generic HTTP failure with no raw body text in `message` or serialized
diagnostics. Connector schedule failures use the closed schedule error codes with
canonical bodies, statuses, and `ConnectorScheduleHttpError` mapping. Connector
create conflicts use the closed `already_configured` body with
`ConnectorCreateHttpError` mapping.

The one shared internal contract is strict and fixed:
`{ code: 'internal_error', message: 'An unexpected error occurred.', requestId }`
at status `500` with kind `internal`. `requestId` is required and schema-validated.
Both generic clients preserve this validated body and identity; a noncanonical
message, invalid or missing identity, extra key, or wrong status is a protocol
failure. No other unknown response may contribute a request identity or diagnostic
text to a client error.

`ValedictorianSourceHttpClient` validates a closed contract selected for each
source-service operation and throws `SourceIngestionHttpError` with validated
`code`, `body`, `status`, `kind`, optional authoritative `retryAfter`, and optional
shared internal `requestId`. Source error codes remain grouped by access, browse,
CareerSource, SourceSchedule/run request, SourceRun/evidence/JobSnapshot, probe and
extraction, ConfidenceRule attachment, and service infrastructure contracts; they
are not added to a package-wide domain error enum. Malformed input/query contracts
use `400`, semantic validation uses `422`, authentication and authorization use
`401` and `403`, missing state uses `404`, conflicts use `409`, and the declared
infrastructure contracts use `429` and `503`. Only `source_rate_limited` and
`source_unavailable` authorize parsing `Retry-After`.

`requestRun` accepts an optional JSON body, but a declared JSON body with invalid
syntax uses the endpoint-specific `invalid_run_request` contract at `400`.

Probe `not-ready`, a missing SourceSchedule represented by `schedule: null`,
SourceRun request/admission results, and persisted SourceRun lifecycle statuses are
successful DTOs rather than thrown failures. The source client also covers the
dashboard detail routes for EvidenceBundle artifacts, JobSnapshots, effective
ConfidenceRules, and ConfidenceRule attachment writes using their exported strict
response schemas.

UI presentation choices (toast, banner, field placement) and backend
implementation exception types are outside Sparxie ownership. Consumers map the
typed failures into local presentation or logging without rendering untrusted
server text.

## Development

```sh
pnpm install
pnpm test
pnpm lint
pnpm build
```

## Releases

Releases publish from version tags that match `package.json`, such as `v0.7.5`.
