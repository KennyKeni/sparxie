# Releasing

## Scoped Package Bootstrap

The maintained package is `@sparxie/sdk`. The former unscoped `sparxie`
identity remains available during the fleet migration and is deprecated only
after every maintained consumer has moved.

Before the first scoped release, authenticate an npm organization maintainer
and configure Trusted Publishing:

```sh
mise install
pnpm install
pnpm lint
pnpm test
pnpm build
pnpm pack --dry-run
npm login
pnpm dlx npm@11.16.0 trust github @sparxie/sdk \
  --repo KennyKeni/sparxie \
  --file publish.yml \
  --allow-publish \
  -y
```

Installation, checks, and packing use pnpm. Registry authentication and
package-settings changes stay on the npm CLI; publication is performed only by
the tag-triggered GitHub workflow through Trusted Publishing OIDC. If npm
requires the package to exist before a trust relationship can be created, stop
at the human gate rather than publishing from a developer machine.

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

Tagged GitHub Actions releases publish with npm provenance.
