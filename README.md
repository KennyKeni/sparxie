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

## Development

```sh
pnpm install
pnpm test
pnpm lint
pnpm build
```

## Releases

Releases publish from version tags that match `package.json`, such as `v0.7.2`.
