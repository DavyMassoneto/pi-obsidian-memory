# AGENTS.md — pi-obsidian-memory

A pi extension (TypeScript) that stores the agent's long-term memory in Obsidian vaults, in any folder.
**OneDrive is optional.** There are two kinds of vault: one **GLOBAL** (learnings about the user) and one per **PROJECT**.
The reused base is pi-hermes-memory (MIT).

## Language
- Talk to the user in Brazilian Portuguese.
- Everything written to the repository is in English: code, messages, tests, docs, specs, commit messages, branch names and file names.

## Where we are
Read `docs/STATE.md` before anything else: it has the current phase, the next action and the blockers.
- Questions and decisions: `docs/OPEN-QUESTIONS.md`
- Research: `docs/research/`
- Decisions that are hard to reverse: `docs/decisions/`

## Do not confuse
- The **SPEC system** is how THIS project is documented (`docs/`, `openspec/`). It lives in the repository.
- The **MEMORY system** is the product we are building. Its data lives in the Obsidian vaults.

## Process rules (mandatory)
1. No production code unless both hold: an approved OpenSpec change AND no open 🔴 question in `docs/OPEN-QUESTIONS.md`.
2. A doubt that affects scope, observable behavior, on-disk format or user data → ask
   (one question at a time, with options and your recommendation) and record it in `docs/OPEN-QUESTIONS.md`. Do not assume.
3. Every requirement declares (a) its configuration (key, default, validation) and (b) its onboarding step (`/memory-setup` or `/memory-init`).
4. A decision that is hard to reverse (on-disk format, tool API, data location) → an ADR in `docs/decisions/` (MADR).
5. If reality diverges from the spec, STOP and report: expected, found, impact, how to proceed. The spec is fixed before the code.
6. At the end of each task: run the tests and SHOW the output; tick the checkbox; update `docs/STATE.md`; commit **on the task branch** (`feature/` or `chore/`).

## Flow (in pi the commands use a hyphen; in Claude Code, a colon)
- A new doubt → `/interview <topic>`.
- Per change: `/opsx-explore` → `/opsx-propose` → user approval → **new session** → `/opsx-apply` → `/opsx-archive`.
- Context above ~60% or a phase change → update `docs/STATE.md` and start a new session.

## Git Flow (mandatory, with git-flow-next; the configuration is in `.gitflow`)
- `main` = releases only (every merge has a `vX.Y.Z` tag). `dev` = integration. **Never commit directly to `main` or `dev`.**
- All work starts on a branch taken from `dev`, and its type says what it is:
  - `feature/` is **only** product functionality: each OpenSpec change is a feature (`git flow feature start <name>`);
  - `chore/` is organization, tooling and process, including the F0 documents (`git flow chore start <name>`). Calling organization a feature is wrong;
  - an organization effort that is not finished stays on the same `chore/` branch: do not open another branch for its next step;
  - names in kebab-case, for example `chore/f0-vision-requirements`.
- A branch that is done **and approved by the user**: `git flow feature finish <name>` or `git flow chore finish <name>`, which merges into `dev` with `--no-ff` and deletes the branch. Then `git push origin dev`.
  - If the user asks for a PR review: `git push -u origin <type>/<name>` + `gh pr create --base dev`.
- Release (**only when the user asks**): `npm run release -- --dry-run` to check, then `npm run release`.
  - git-cliff calculates the version and the changelog (rules in `cliff.toml`), and `scripts/release/` orchestrates `git flow release start/finish`, the `vX.Y.Z` tag and the push.
  - The script asks for confirmation. `--yes` skips the question and may only be used with the user's explicit authorization.
  - The tag triggers the npm publication (`.github/workflows/release.yml`). Details in `docs/decisions/0001-automatic-versioning-and-npm-publishing.md`.
- Urgent production fix: `git flow hotfix start X.Y.Z` (from `main`) → `git flow hotfix finish X.Y.Z`.
- SemVer versioning; the first functional release is `0.1.0`.
- Commit messages **must** follow Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`…; `!` or `BREAKING CHANGE:` for breaking changes), because the automatic versioning depends on it.
- **Never** add co-author trailers (`Co-Authored-By`) or any mention of AI to commits, merges, tags or PRs.

## Data safety
- **OneDrive is optional**, and the core cannot depend on it. The OneDrive protections (pinning, cloud-only files, conflict copies) only run with `sync.provider = onedrive`, detected and confirmed during onboarding.
- Never write SQLite, locks, temporary files or `.git` inside the vaults. This always applies, and it is critical in a synced folder.
- Never overwrite a vault note without a full read + hash. Never delete: move to `archive/`.
- The agent only reads and writes inside the memory vaults. Nothing outside them, such as the user's personal vaults.

## Code (TypeScript)
Biome blocks automatically, in `npm run lint` and in CI (configuration in `biome.json`, plugins in `biome/`):
- code that is not formatted (no semicolons, 120-column lines);
- imports out of order or outside the groups: Node, npm packages and project files, separated by a blank line;
- files longer than 200 lines and functions longer than 30, not counting blank lines. Tests only have the file limit, because `describe()` counts as a function;
- `any`, `unknown`, type assertions (`x as T`, `<T>x`, `x!`; `as const` is fine) and index signatures, including `Record<string, T>` and `{ [K in string]: T }`. A `Record` with fixed keys is fine;
- ternaries, `??`, `||` that returns a value (`x || "text"`) and default values in parameters or destructuring, in any file. Each case is handled with `if` and explicit returns. `||` in a condition (`if (!a || !b)`) is still fine;
- comparisons with `undefined` or `null` (`=== undefined`, `!= null`, `typeof x === "undefined"`) and manual boolean conversions (`=== true`, `!!x`, `Boolean(x)`), in any file.

Values arrive with their exact type; nothing is fixed afterwards:
- external data (command-line arguments, command output, regex groups, JSON) goes once through `parseValue`, with a TypeBox schema, and comes out typed;
- an operation that can fail returns an explicit result (`{ succeeded: true, output }` or `{ succeeded: false }`), never `undefined`; a check returns the list of problems, empty when everything is fine;
- a value used while the module loads (a schema, a list in `constants.ts`) only depends on files of its own folder: through the barrel, the other module may not have loaded yet.

Every module is a folder (e.g. `scripts/release/plan/`), with the logic (`plan.ts` and others, such as `steps.ts`) and one file for each kind of thing. The tests mirror the folders (`tests/release/plan/plan.test.ts`). Biome does not check the folders, but in the code (not in the tests) it blocks anything outside the right file:
- types and interfaces → `types.ts`;
- top-level values that are not functions (text, number, regex, list, object, `Map`…) → `constants.ts`;
- TypeBox schemas → `schemas.ts`. The `Type` builder is only imported there; in the other files, use `import type`;
- error classes (extending `Error`) → `errors.ts`;
- styling (pi's `theme.fg`, `theme.bold`… and color libraries such as `chalk`) → `styles.ts`.

Every code folder has an `index.ts` (barrel) that only does `export *` of the folder's files and of the subfolders' `index.ts`. Imports follow the barrels:
- from the same folder: the file itself (`./constants.ts`), never its own `./index.ts`;
- from another folder: always the highest barrel in reach, `../index.ts`;
- `../../` is forbidden in any file. The tests import the code through the `#scripts` alias (the `imports` field of `package.json`, pointing to `scripts/index.ts`) and the helpers through `../helpers.ts`;
- top-level functions are declared with `function`, never as arrow functions: the barrels create circular imports, and only `function` declarations already exist when the module starts running;
- the only file that runs something when loaded is the entry point `scripts/release/run.ts` (`npm run release`), and no barrel re-exports it.

Biome blocks `../../`, imports outside the barrels, an `index.ts` with anything other than `export *` and top-level arrow functions. It cannot see whether an `index.ts` exists: `tests/barrels.test.ts` does, and fails when a code folder has no `index.ts` or the index does not re-export everything in the folder.

These also apply, even where Biome cannot catch them:
- Defaults only where they are part of the definition: a flag declared in `parseArgs` (absent = `false`) or the default of the tool that receives the value (`--bump auto` is git-cliff's). Never in the logic: no field or file treated as "if it exists" when the flow needs it. Missing required data becomes an explicit error, never an invented value.
- The schemas are TypeBox (`typebox`, the same as pi); never a cast.
- A comment only when it explains a why that the code does not show. JSDoc that repeats the name is forbidden: prefer descriptive names.
- Never turn a rule off with `biome-ignore`. If a rule looks wrong for a case, ask the user.

## Commands
- Lint, formatting and imports (Biome): `npm run lint`. To fix what can be fixed automatically: `npm run format`
- Types (strict TypeScript): `npm run typecheck`
- Tests (vitest): `npm test`
- Release: `npm run release -- --dry-run` / `npm run release` (see Git Flow above)
