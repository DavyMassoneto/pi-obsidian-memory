# OPEN-QUESTIONS — pi-obsidian-memory

> The project's question log. **Rule:** an open 🔴 question blocks the approval of requirements and specs.
> The **2026-09-23** interview was done with Claude Code's question tool, in 12 rounds, from the script in [research/06-open-questions.md](research/06-open-questions.md).
> Status: ✅ resolved · ⏭️ superseded · 🔴 open and blocking.

**Status:** ✅ **every question answered.** Nothing pending.
When new doubts come up during the spec phase, record them here with the next free ID (Q-N6 onwards).

## ⚠️ Decisions that departed from the recommendation (read before specifying)

| ID | User's decision | The recommendation was | Consequence for the spec |
|---|---|---|---|
| Q-N3 | "Don't forget" **without a limit** | Priority + warning | Always goes into the prompt in full; the ~3k token budget only applies to the **rest** of the summary |
| Q-B7/G6 | **English** everywhere: notes, search and correction detector | Notes in pt-BR, bilingual detection | The original's stop-words and correction patterns can be reused. Corrections typed in Portuguese do **not** trigger the regex detector; the periodic review done by the model catches them |
| Q-G4 | Project identified by a **manual map** (folder → project) | Git root | An unregistered folder = global memory only. `/memory-init` does the registration. The spec defines whether subfolders count as the same project |
| Q-E2 | **The agent may rename and move** memories | Only the user, through Obsidian | Requirement: when renaming, the agent rewrites the vault's `[[links]]` (Obsidian does not update links for renames done outside it). References by id do not break |
| Q-C3 | **Semantic search already in v1** (text + local embeddings) | Text in v1, semantic in v2 | English embedding model downloaded once to `~/.pi/agent/<package>/`, outside OneDrive. Choosing the model and the vector storage → spec/ADR |
| Q-D5 | **Secrets allowed** | Block | Becomes the option `secretPolicy: allow \| mask \| block`, defaulting to `allow`. Accepted risk: a saved secret goes to the configured sync (e.g. the OneDrive cloud) and may enter the prompt. The blocking of prompt injection and invisible unicode **stays** (it was not asked) |
| Q-H5 | **Logs + local statistics** | Logs only | Local usage summary (memories, searches, injected tokens). Nothing leaves the machine |
| Q-F3/F5/E3/E1 | **No Obsidian CLI** in v1 | Optional CLI | With Q-E2, every link fix is done by the agent itself |
| Q-H1 | **Node ≥ 24** | Node ≥ 22.13 | Can use `node:sqlite` and recent APIs without polyfills. See P-11 |
| Q-M6 | **Public** repository (default branch `dev`) | Private until npm | Everything committed is public: do not version personal data, machine paths or real memories (tests use fictional vaults) |

## Resolved: process (the SPEC system, i.e. how this project is documented)

| ID | Question | Resolution |
|---|---|---|
| Q-M1 | Method | ✅ **OpenSpec + a `docs/` layer + our own question gate** (`/interview` + this file + rules in `AGENTS.md`) |
| Q-M2 | Where the project docs live | ✅ **In the repository** (`docs/` + `openspec/`). The user's correction: do not mix the **spec system** with the **memory system** (the product). The vaults only hold memories |
| Q-M3 | Implementing agent | ✅ **pi** |
| Q-M4 | Repository location | ✅ A local folder outside any sync (`.git` gets corrupted in a synced folder) |
| Q-M5 | Branch flow | ✅ **Git Flow** with **git-flow-next**, configuration versioned in `.gitflow`. Branches: `main` (releases, `vX.Y.Z` tags), `dev` (integration), `feature/*` (product functionality only: OpenSpec changes), `chore/*` (organization, tooling and process, including F0), `bugfix/*`, `release/*`, `hotfix/*`. No direct commits to `main` or `dev`. The organization merges done as `feature/*` after v0.0.1 were redone as a single `chore/project-organization`; the earlier ones stayed, because they are part of the published release |
| Q-M6 | GitHub | ✅ **Public** repository, default branch **`dev`**, managed with the GitHub CLI (`gh`). npm publishing comes later |

## Resolved: the product (the MEMORY system)

### Strategy and scope

| ID | Question | Resolution |
|---|---|---|
| Q-01 | Reusing pi-hermes-memory | ✅ **A new package reusing modules** (MIT; keep the copyright notices of Chandra Teja and Nous Research) |
| Q-02 | Format in the vault | ✅ **Native to Obsidian, with an index and an established standard** (templates per type). Only **learnings and important points**, never a log of everything |
| Q-03 | Already using pi-hermes-memory? | ✅ No, so there is no import |
| Q-A1 | Hosts in v1 | ✅ **pi only**, with an agnostic core |
| Q-A2 | Memory types | ✅ Two layers, detailed below (open to additions) |
| Q-N5 | What counts as a learning | ✅ **Only what changes future behavior:** a preference, pattern, decision, lesson, "don't forget". Never temporary state, a session narrative or what is already in the code or in git |

**GLOBAL layer** (about the user):
- how to address them and their preferences;
- code patterns they always use;
- global learnings.

**PROJECT layer:**
- what it is and how it works;
- patterns specific to the project;
- decisions;
- references;
- tasks in progress;
- "don't forget".

### Vaults, organization and access

| ID | Question | Resolution |
|---|---|---|
| Q-B1 | How many vaults | ✅ **One global vault + one vault per project** |
| Q-B1a | Global vault | ✅ **Dedicated** (e.g. `<vaults-root>/Agent-Global/`); the user's personal vaults stay untouched |
| Q-N2 | Where the project vaults live | ✅ `<vaults-root>/Projects/<project>/`, with a configurable root (inside or outside OneDrive) |
| Q-B8 | How a project vault is born | ✅ **`/memory-init`**, offered in the first session in an unregistered folder: it creates the vault (standard structure) or picks an existing one and writes the map to the config |
| Q-G4 | Project identity | ✅ **Manual map** folder → project (see ⚠️) |
| Q-G7 | Global or project | ✅ The agent classifies: about the user → global; the rest → project; when in doubt, project. A pattern repeated in 2 or more projects → it proposes a promotion |
| Q-B3/B4 | Notes that are not memories | ✅ It does **not** read or write outside the memory vaults |
| Q-B5/N4 | Templates and fields | ✅ **The agent proposes** the templates (`_standard/templates/`) in `/memory-setup` and `/memory-init`; the user approves and edits them in Obsidian. Base fields: `id`, `type`, `description`, `tags`, `project`, `created`, `modified`, `source`, `pinned` |
| Q-B6/N1 | Links | ✅ `[[wikilinks]]` **inside** the vault; **across vaults**, a reference by id (e.g. `global:typescript-standards`) resolved by the agent, with an optional `obsidian://` link |
| Q-B7/G6 | Language | ✅ **English** (see ⚠️) |
| Q-E2 | Renaming and moving | ✅ **The agent may**, rewriting the links (see ⚠️) |
| Q-G5 | Skills and fixed rules | ✅ **In the vaults:** global skills in the global vault, project skills in the project vault. Fixed rules become "Don't forget" (project) and preferences (global) |
| Q-T1 | Tasks in progress | ✅ One living **"In progress"** note per project, updated at the end of each session |

### Prompt, search and data

| ID | Question | Resolution |
|---|---|---|
| Q-C1 | What goes into the prompt | ✅ A summary **frozen at the start of the session**: global (profile, patterns, index) + project (short vision, patterns, "In progress", **"Don't forget" always**, index). The rest comes through search |
| Q-C2 | Budget | ✅ ~3k tokens, configurable. "Don't forget" stays outside the budget (Q-N3) |
| Q-N3 | "Don't forget" | ✅ **No limit** (see ⚠️) |
| Q-C3 | Search | ✅ **Text + semantic already in v1**, with local embeddings (see ⚠️) |
| Q-C4 | Index | ✅ **Local**, in `~/.pi/agent/<package>/index/`, rebuildable from the vaults |
| Q-C5 | `session_search` | ✅ **Yes**, with a local index; nothing goes to the vaults |
| Q-D1 | OneDrive pinning | ✅ Yes, **with confirmation**, revalidated at every start. **Only when `sync.provider = onedrive`** (Q-N7) |
| Q-D2 | How many PCs write | ✅ Only this PC (the change check before writing stays) |
| Q-D3 | Deletion | ✅ Never delete: **move to `archive/`** |
| Q-D4 | Backup | ✅ An **export command** (.zip) always; with OneDrive, also its version history. Without OneDrive, continuous backup is up to the user (document it in onboarding) |
| Q-D5 | Secrets | ✅ **Allowed** by default, configurable (see ⚠️) |
| Q-D6 | Another sync | ✅ In the user's case, only OneDrive. In the product: at most one synchronizer per vault (warn during onboarding) |
| Q-D7 | Plugins that rewrite files | ✅ **Clean vaults:** `/memory-init` creates the vault without those plugins |

### OneDrive (optional)

| ID | Question | Resolution |
|---|---|---|
| Q-N6 | Is OneDrive mandatory? | ✅ **No.** The vaults can live in any folder; OneDrive is only for whoever wants it. The core cannot depend on it |
| Q-N7 | How to turn on the OneDrive protections | ✅ **Detect and confirm.** If the vault is inside a OneDrive folder, `/memory-setup` and `/memory-init` warn and, with confirmation, turn on the protections (pinning, cloud-only files, conflict copies). Outside it, they stay off. Config: `sync.provider = none \| onedrive` |

### Configuration, onboarding and automation

| ID | Question | Resolution |
|---|---|---|
| Q-F1 | Where the config lives | ✅ **Local** (`~/.pi/agent/<package>/config.json`: paths, folder → project → vault map, budget) + **templates inside each vault** |
| Q-F2 | Global onboarding | ✅ **Interactive `/memory-setup`:** suggested in the first session without a config, re-runnable, with a non-interactive mode through environment variables |
| Q-F3/F5/E3/E1 | v1 features | ✅ **Auto-detection** of vaults and OneDrive (read-only) · **`/memory-doctor`** · **`.base` dashboard** · ❌ Obsidian CLI |
| Q-F4 | Exposed options | ✅ The 4 groups: Locations · Content · Retrieval · Automation and safety |
| Q-G1 | When to save | ✅ **Automatic and curated**, following the templates. Triggers: corrections and preferences, periodic review (~10 turns), before compaction |
| Q-G3 | Consolidation | ✅ The agent **proposes in `inbox/`**, and the user approves in Obsidian |
| Q-H5 | Product telemetry | ✅ **Logs + local statistics**; nothing leaves the machine |

### Engineering

| ID | Question | Resolution |
|---|---|---|
| Q-H1 | Minimum Node | ✅ **Node ≥ 24** |
| Q-H2 | Tests | ✅ **vitest**, integration tests with temporary vaults, **CI on Windows** |
| Q-H3 | Distribution | ✅ **npm** (keyword `pi-package`) + `pi install npm:<package>` |
| Q-H4 | Platforms | ✅ **Windows first**, core portable to macOS and Linux later |
| Q-H6 | Lint and formatting | ✅ **Biome** (exact version in `package.json`), in `npm run lint` and in CI; no ESLint or Prettier. Style: no semicolons, double quotes, 120-column lines, imports sorted in three groups separated by a blank line (Node, npm packages, project files). Limits: files up to 200 lines and functions up to 30, not counting blank lines (tests only have the file limit). Forbidden: `any`, `unknown`, type assertions (`as const` is fine) and index signatures, including `Record<string, T>`. The last two are blocked by GritQL plugins in `biome/`. External data is validated with TypeBox. A comment only when it explains a why |
| Q-H7 | File organization | ✅ **Every module is a folder** (e.g. `scripts/release/plan/`), with the logic and one file per kind of thing: types in `types.ts`; top-level values that are not functions in `constants.ts`; TypeBox schemas in `schemas.ts`; error classes in `errors.ts`; styling (pi's theme and color libraries) in `styles.ts`. The tests mirror the folders (`tests/release/plan/plan.test.ts`). The file-kind rules apply to the code, not to the tests. Biome blocks them with GritQL plugins in `biome/` and with `noRestrictedImports` (the `Type` builder only in schemas) |
| Q-H8 | Barrels and imports | ✅ **Every code folder has an `index.ts`** with only `export *` (the folder's files and the subfolders' `index.ts`). Import from the same folder: the file itself (`./x.ts`); from another folder: the highest barrel in reach (`../index.ts`); `../../` is forbidden in any file. Tests import through `#scripts` (a Node subpath import). Top-level functions use `function`, because of the barrels' circular imports. The release entry point is `scripts/release/run.ts`, outside the barrels. Biome blocks the imports and the content of the `index.ts` files; `tests/barrels.test.ts` checks that every folder has one |
| Q-H9 | Ternaries and defaults | ✅ **Forbidden**, in the code and in the tests: ternaries, `??`, `\|\|` that returns a value and default values in parameters or destructuring (Biome blocks them); needlessly optional data is not allowed either. Each case becomes an `if` with explicit returns, and missing required data becomes an error, never an invented value. Consequences for the release: `package-lock.json` and `tagprefix` are required. (The flags' `default:` came back in Q-H10) |
| Q-H10 | Exact types at the boundary | ✅ **Forbidden** (Biome blocks them, in the code and in the tests): comparisons with `undefined`/`null` and manual boolean conversions. External data (argv, command output, regex, JSON) goes once through a TypeBox schema (`parseValue`); an operation that can fail returns an explicit result (`{ succeeded, output }`); a check returns a list of problems. The flags got `default: false` back in `parseArgs` and `--bump` went back to `auto` (git-cliff's own default): a default that is part of the CLI definition is necessary; what is forbidden is a default hidden in the logic |
| Q-H11 | Repository language | ✅ **English everywhere in the repository:** code, messages, tests, docs, specs, commit messages, branch names and file names. The conversation with the user stays in Brazilian Portuguese. The commits released in v0.0.1 keep their original messages, so the v0.0.1 section of the CHANGELOG lists them as they are |

### Publishing and versioning

| ID | Question | Resolution |
|---|---|---|
| Q-R1 | Name on npm | ✅ `pi-obsidian-memory` (no scope) |
| Q-R2 | License | ✅ **MIT**. The copyright notices of the code reused from pi-hermes-memory come in with that code |
| Q-R3 | Versioning | ✅ **Automatic from the Conventional Commits, with Git Flow intact:** `npm run release` calculates the version and runs `git flow release`; the tag publishes to npm through Trusted Publishing ([ADR 0001](decisions/0001-automatic-versioning-and-npm-publishing.md)) |
| Q-R4 | AI attribution in commits | ✅ **Forbidden:** no `Co-Authored-By` and no mention of AI in commits, merges, tags or PRs |
| Q-R5 | CI | ✅ **`ci.yml` on Windows**, on every push to the Git Flow branches and on every PR: Biome, types, tests and `openspec validate --all --strict` |
| Q-R6 | Who can publish to npm | ✅ **Only GitHub Actions** (Trusted Publishing from `release.yml`); token publishing is blocked (`mfa=publish`) |

## Superseded

| Item | Reason |
|---|---|
| Q-A4 (importing from pi-hermes-memory) | ⏭️ The user does not use the original |
| Q-B2 (name of the memory folder inside a vault) | ⏭️ The vaults are dedicated |
| Q-G2 (saving before compaction) | ✅ Included in Q-G1 |
| Daily log per device (study) | ⏭️ Dropped: no raw log (Q-02); only one PC (Q-D2) |
| Memory in a folder of the user's personal vault (study) | ⏭️ Replaced by dedicated vaults |

## Points to check in practice (F0 spikes, with authorization)

Points P-1 to P-10 are in [research/06-open-questions.md § Points to check](research/06-open-questions.md#points-to-check). P-1 to P-4 only apply in OneDrive mode:
- OneDrive pinning and version history;
- placeholder detection and the frequency of `EPERM`;
- the format of `obsidian.json` and Obsidian's merge;
- pi-hermes-memory's cut points;
- prompt templates in pi and `ctx.reload()`.

New points:

| # | Point | Why it matters |
|---|---|---|
| P-11 | This machine has **two pi installations**, both on v0.87.1: WinGet's `pi.exe` and the npm package on fnm's Node 24. With fnm active (PowerShell 7 and 5.1), the npm one wins. Confirm which runtime the extension runs on and whether `node:sqlite` is available in both | Q-H1, Q-C4 |
| P-12 | Cost and time of the local English embeddings on Windows (download, RAM, initial indexing) | Q-C3 |
