# sparxie

Shared TypeScript contracts, validators, and HTTP client for Valedictorian tools.

## Install

```sh
pnpm add sparxie
npm install sparxie
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

## Sourcing destination provenance

Sourcing finding reads expose projection-owned destination provenance through
`destinationClass`, `destinationUrl`, `intermediaryUrl`, and `usability`.
Projection-capable servers return all four fields. Their relationship to the
compatibility fields is exact:

| Finding kind | `destinationClass` | `destinationUrl` | `intermediaryUrl` | `usability` | `officialUrl` | `sourceUrl` |
| --- | --- | --- | --- | --- | --- | --- |
| Employer or ATS | `employer_or_ats` | Usable employer/ATS URL | Upstream intermediary URL or `null` | `usable` | Same as `destinationUrl` | Same as `intermediaryUrl` |
| Third-party job posting | `third_party_job_posting` | Usable job-specific third-party URL | Upstream intermediary URL or `null` | `usable` | `null` | Same as `destinationUrl` |
| Review-only or unresolved | `null` | `null` | Upstream intermediary URL or `null` | `review_only` | `null` | Same as `intermediaryUrl`; never a usable destination |

The four new read properties are compatibility-optional in TypeScript for the
`0.7.x` migration. An omitted property means the response came from a server
that has not adopted this projection contract; it must not be inferred from
`officialUrl`, `sourceUrl`, or the hostname, and it is distinct from an explicit
`null`. Upgrade servers before requiring the fields in a consumer. Ordinary
finding create, update, decision, and candidate-processing inputs cannot set
these projection-owned properties, and the HTTP client strips them from
untyped mutation payloads.

## Raw sourcing intake

New sourcing producers submit sparse observations through the workspace-scoped
raw intake contract:

```ts
await workspace.sourcing.rawRecords.ingestBatch({
  records: [
    {
      intakeItemId: 'batch-item-1',
      adapter: { id: 'valedictorian-cli', kind: 'cli', version: '0.12.0' },
      observedAt: new Date().toISOString(),
      reportedOrigin: { kind: 'job_board', name: 'LinkedIn' },
      payload: { url: 'https://www.linkedin.com/jobs/view/123' },
    },
  ],
})
```

`adapter` records how data entered Valedictorian; `reportedOrigin` records where
the job was observed. Raw records may omit provider identity and every canonical
job field. Payload and evidence values are JSON-safe and use the exported
`MAX_RAW_SOURCE_*` transport limits. List sanitized raw-record summaries with
`rawRecords.list`, read the immutable record/receipt with `rawRecords.get`,
read normalization and gate outcomes with `rawRecords.normalization.get`, and
request version-targeted reprocessing with `rawRecords.replay`.
`rawRecords.list({ connectorRunId })` matches exact run lineage on any persisted
occurrence, including records whose latest occurrence belongs to a later run.

Every batch record requires a unique opaque `intakeItemId`. Receipts echo that
transient identifier so the typed client can correlate reordered responses,
reject duplicate/missing/unknown items, and validate connector capture against
the matching request without persisting the batch identity.

Connector adapters require a `capture` containing `connectorInstanceId`,
`connectorRunId`, and opaque `executionScopeId`. Compatible servers resolve those references inside the
workspace named by the HTTP route and validate the producer's adapter against
the registered connector with `createBoundRawSourceRecordInputSchema`. A
producer cannot supply a workspace or override the registered adapter lineage.
The accepted capture is returned on the intake occurrence, so repeated runs can
share a deduplicated raw record without conflating their run provenance.

The execution scope is derived by the trusted host. The binding validator equality-checks it with the registered
connector scope; it contains no workspace, account, credential, or session
components. Provider normalization attempts carry that scope, while pure or
generic attempts use `null`. Resolver declarations explicitly state a closed
`scopeRequirement` of `source` or `none`; the bound normalization-result schema
correlates source-scoped attempts with a trusted raw revision and execution
scope. Authentication expiry and rate limiting are
scope-level operation outcomes; transient and permanent record failures remain
item-level outcomes and never leak raw provider responses.

Connector runs report continuous synchronization rather than requested-result
targets. `newestFrontier`, `historicalBackfill`, `pendingResolutionCount`, and
the typed run `outcome` distinguish resumable yields, caught-up state,
cooldowns, required action, and explicit boundary or source exhaustion.
Provider checkpoints stay behind the separate checkpoint endpoint and are not
included in public progress DTOs. A yielded invocation is not synchronization
completion, and `caught_up` is valid only when both frontiers are caught up and
no resolutions are pending.

Invocation lifecycle is explicit: queued/running runs use `in_progress`, failed
runs use `failed`, and cancelled runs use `cancelled`. Completed or skipped
invocations may report the remaining non-in-progress synchronization outcomes
according to backend admission behavior, but cannot masquerade as failure or
cancellation. Run and connector-status warning counts exactly match their
sanitized warning arrays.

Intake receipts and raw-record reads expose the nullable source-entity identity;
promoted canonical-candidate references always identify their source entity.
Gate outcomes are `passed`, `needs_enrichment`, `rejected`, or `failed`.
Canonical candidates use explicit `unknown` employment/seniority and `unclear`
work-mode values instead of nullable enums, while optional structured location
and compensation facts may be `null`.

Canonical finding creation carries `rawRevisionId` and `canonicalCandidateId`
together with typed `destination`, employment type, seniority, location,
compensation, work mode, and posted time. Finding reads expose the same fields
as compatibility-optional properties so existing persisted findings remain
readable. An omitted property identifies a legacy projection; newly projected
facts use explicit `unknown`, `unclear`, or `null` values and must never be
guessed from titles, URLs, or location defaults.

The existing `sourcing.candidates.process` and `sourcing.findings.create`
methods remain wire-compatible for consumers that already produce canonical
data, but are deprecated as producer entry points. Finding reads and lifecycle
operations remain supported. New CLI, connector, manual-entry, and import
producers should use raw intake so normalization evidence and gate decisions are
auditable.

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
canonical bodies, statuses, and `ConnectorScheduleHttpError` mapping.

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
