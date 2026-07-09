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

## Development

```sh
pnpm install
pnpm test
pnpm lint
pnpm build
```

## Releases

Releases publish from version tags that match `package.json`, such as `v0.7.2`.
