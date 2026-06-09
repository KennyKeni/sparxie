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

```sh
npx npm@11.16.0 trust github sparxie \
  --repo KennyKeni/sparxie \
  --file publish.yml \
  --allow-publish \
  -y
```

The `--allow-publish` flag is required so the trusted publisher is allowed to
run `npm publish`. npm `11.13.0` does not include this flag even though the
registry requires it, so use npm `11.16.0` or newer for trust setup.

## Normal Release

```sh
pnpm version patch
git push
git push --tags
```

The tag must be `vX.Y.Z` and match `package.json`.

Tagged GitHub Actions releases publish with npm provenance. The first local publish
uses `--provenance=false` because local shells do not have a GitHub OIDC provider.
