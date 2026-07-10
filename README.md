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

## Development

```sh
pnpm install
pnpm test
pnpm lint
pnpm build
```

## Releases

Releases publish from version tags that match `package.json`, such as `v0.7.5`.
