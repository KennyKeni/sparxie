# sparxie Agent Instructions

`sparxie` is the public Valedictorian contract package. It owns API paths, DTO/types, error shapes, validators, and the typed HTTP client used by the app, CLI, and compatible backends.

## Contract Rules

- Keep root client APIs workspace-neutral.
- Put workspace-scoped APIs behind `client.forWorkspace(workspaceId)`.
- Do not add `setWorkspace`, `currentWorkspace`, or any active/current workspace state.
- Contract changes must stay compatible with local and cloud backend implementations where features overlap.

## Checks

- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `npm pack --dry-run`

## Releases

- Do not publish `sparxie` from a local machine. Do not run `npm publish`,
  `pnpm publish`, or any equivalent direct registry publish command except as a
  dry run.
- Publishing is owned by GitHub Actions. Land the contract change, update
  `package.json`, push the commit, then create and push the matching release tag
  so the `Publish` workflow performs verification, packing, provenance, npm
  publish, and dist-tag handling.
- `package.json` version must match the release tag exactly as `vX.Y.Z` or the matching prerelease form.
- The tag-triggered publish workflow owns npm publishing and dist-tag handling.
- Release `sparxie` before updating app or CLI consumers that depend on new shared contract behavior.
