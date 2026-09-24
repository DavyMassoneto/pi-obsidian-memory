---
status: accepted
date: 2026-09-23
decision-makers: DavyMassoneto
---
# Automatic versioning with Git Flow and npm publishing through Trusted Publishing

## Context and problem

The `pi-obsidian-memory` package is published on npm, and the project follows Git Flow: `main` only receives releases and `dev` is the integration branch. The user wants automatic versioning, without picking the version number by hand.

## Decision drivers

- Keep Git Flow intact (`release/*` → `main` + tag → `dev`), with `--no-ff` merges.
- The version comes from the history, not from a manual choice.
- Publish without a token stored in the repository.
- Few external dependencies.

## Considered options

1. **Our own release command + GitHub Actions triggered by the tag.**
2. **semantic-release:** automatic version, tag and publication on every merge into `main`, through a `dev` → `main` PR.
3. **release-please:** a bot keeps a release PR open against `main`.

## Decision outcome

**Option 1.** You decide **when** to release (`npm run release`), and the **number** comes from the Conventional Commits since the latest `v*` tag.

| Commits since the latest tag | In 0.x | From 1.0 on |
|---|---|---|
| `BREAKING CHANGE:` in the body or `type!:` | minor | major |
| `feat:` | minor | minor |
| `fix:` / `perf:` | patch | patch |
| Only other types (`docs:`, `chore:`…) | nothing, unless `--bump` is used | same |

The version and the changelog come from **git-cliff**, with the rules in `cliff.toml`. `scripts/release/` (TypeScript, run directly by Node 24) only orchestrates Git Flow:
1. checks, without changing anything:
   - git-flow is installed;
   - it runs on `dev`, with a clean tree and no open release;
   - `dev` and `main` match GitHub (through `ls-remote`, without fetching);
   - `package.json` matches the latest tag;
2. calculates the version (`git-cliff --bumped-version`);
3. shows the plan and a changelog preview (`--dry-run` stops here) and asks for confirmation;
4. `git flow release start X.Y.Z`;
5. updates `package.json` and `package-lock.json`, regenerates `CHANGELOG.md` and commits `chore(release): vX.Y.Z`;
6. `git flow release finish X.Y.Z`: merge into `main`, `vX.Y.Z` tag and update of `dev`. Then the script switches the terminal back to `dev`, because finish ends on `main`;
7. `git push --atomic` of `main`, `dev` and the tag.

If a step fails, the script shows what was already done and how to continue or undo it.

The tag triggers `.github/workflows/release.yml`, which:
- checks that the tag matches `package.json` and is on `main`;
- runs the tests;
- publishes to npm through **Trusted Publishing (OIDC)**, which generates the provenance attestation automatically;
- creates the GitHub Release with the changelog section.

### Consequences

- Good: Git Flow does not change. The version and the changelog stay with a mature tool (git-cliff, MIT/Apache-2.0, development only), and our code only orchestrates. `--dry-run` shows the plan first.
- Good: publishing does not use an `NPM_TOKEN` and comes with verifiable provenance.
- Bad: it depends on messages that follow Conventional Commits. Commits outside the convention do not count toward the version.
- Bad: the first publication is manual (`0.0.0`, only to reserve the name), because Trusted Publishing is configured on a package that already exists on npm.
- The `pi-package` keyword and the `pi` manifest in `package.json` come with the first functional version. Until then, the package does not show up in the pi.dev gallery.

### Confirmation

- `npm run release -- --dry-run` shows the version, the steps and the changelog preview without changing anything.
- `npm test` covers the plan, the checks, the version format and the real `cliff.toml` rules, with temporary git repositories.
- The workflow rejects a tag that does not match `package.json` or is not on `main`.

### Revision (2026-09-23)

The first version of the script reimplemented the Conventional Commits parser, the SemVer arithmetic and the changelog, without tests. It was replaced by git-cliff plus the TypeScript orchestration described above.
