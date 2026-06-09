# Releasing

## First Publish

The `sparxie` package name was reported by npm as unpublished on June 7, 2026. Do not publish `0.1.0`; npm never allows reusing the same package/version tuple after unpublish.

For the first publish:

```sh
corepack enable
pnpm install
pnpm lint
pnpm test
pnpm build
npm pack --dry-run
npm login
npm publish --access public --provenance=false
```

After the package exists on npm, configure npm Trusted Publishing for:

- Package: `sparxie`
- Provider: GitHub Actions
- Owner: `KennyKeni`
- Repository: `sparxie`
- Workflow filename: `publish.yml`
- Allowed action: `npm publish`

## Normal Release

```sh
pnpm version patch
git push
git push --tags
```

The tag must be `vX.Y.Z` and match `package.json`.

Tagged GitHub Actions releases publish with npm provenance. The first local publish
uses `--provenance=false` because local shells do not have a GitHub OIDC provider.
