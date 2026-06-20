# sparxie

Shared TypeScript contracts, validators, and HTTP client for Valedictorian tools.

## Install

```sh
pnpm add sparxie
```

```sh
npm install sparxie
```

## Usage

```ts
import {
  createHttpValedictorianClient,
  defaultValedictorianApiBaseUrl,
  isApplicationStatus,
} from 'sparxie'

const client = createHttpValedictorianClient({
  baseUrl: defaultValedictorianApiBaseUrl,
})

const workspace = client.forWorkspace('workspace-id')
const actionQueue = await workspace.actionQueue.list({ actionBucket: 'apply_now' })

console.log(isApplicationStatus('submitted'))
console.log(actionQueue.items)
```

## Development

```sh
corepack enable
pnpm install
pnpm lint
pnpm test
pnpm build
npm pack --dry-run
```

## Releases

Releases are published from Git tags.

1. Update `package.json` with the new version.
2. Commit the change.
3. Tag the commit as `vX.Y.Z`, matching the package version exactly.
4. Push the tag.

The `Publish` GitHub Actions workflow verifies, builds, packs, and publishes the package to npm.
