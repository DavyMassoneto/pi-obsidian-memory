---
name: project-map
description: Map of pi-obsidian-memory — areas and owners, interfaces between layers, build/test/run, pitfalls. Load before working in any area.
---

# Project map

## Areas

| Owner | Paths (src + mirrored tests/) | Purpose |
| --- | --- | --- |
| nucleo | `src/domain`, `src/shared`, `tests/domain` | Pure rules (note, config incl. `disclosures.ts`, `legacy-config.ts`, `vault-access/`, names, vault-path, `path-platform/`, capture (validation), `observation-ledger/` (chunks, ledger, cutoff, render), `om/presence.ts`, lifecycle, catalogs, `*/dont-forget.ts`, `vault-diagnosis`, `vault-assets`); generic result types |
| cofre | `src/services/vault`, `tests/services/vault` | Notes on disk: read/write/archive/relocate/list, bootstrap, catalog, folder indexes, `inspect-folder.ts`; seams `domain-rules.ts`, `folder-listing.ts`, `catalog/dont-forget.ts` |
| indice | `src/services/{search-index,embeddings}` + tests | SQLite search index, reconcile/recovery, embedding providers; seams `search-index/{inspection,dont-forget,ranking}.ts` |
| ponte | `src/services/{config,llm,decision-model,clock,id,observation-ledger}`, `src/services/index.ts` + tests | Config I/O (`config/vault-access.ts` seam), LLM (`llm/domain-rules.ts` seam, `llm/observe.ts`, `llm/capture.ts`), decision model (`laya.ts`, `jev.ts`), clock (`nowMs`, `localTimestamp`), ids, observation ledger (`observation-ledger/domain-rules.ts` seam) |
| maestro | `src/usecases` (incl. `registration/`, `check-vault-access/`, `load-dont-forget/`, `memory-change/`, `semantic*/`, `capture-memory/`, `observe-session/`, `compact-session/`, `load-memory-map/`, `relevant-memory/`, `operation-context/`, `settings/`, `check-shell-edit/`, `diagnose-memory/`, `export-memory/`, `search-memory/`, `archive-memory/`, `succeed-memory/`, `update-memory/`, `complete-blank-memory/`), `src/pi` (incl. `registrar.ts`, `vault-guard/`, `shell-edit-guard/`, `paths/platform.ts`, `memory-{add,setup,init,settings,search,get,update,archive,succeed,doctor,export}`, `memory-block`, `semantic`, `change-report`, `registration-report`, `memory-session`, `session-start`, `context`, `completion`, `observation-cycle`, `relevant-memory`), `tests/usecases`, `tests/pi` | Operation flows; pi tools/events/commands, vault guard, shell-edit guard, extension entry (`src/pi/extension.ts`) |
| cartografo | `.pi/skills/project-map/SKILL.md` | Keeps this map |

Unowned (orchestrator only; owners ask): `biome/`, `biome.json`, `package.json`, `tsconfig.json`, `vitest.config.ts`,
`docs/`, `README.md`, `AGENTS.md`, `skills/obsidian-memory/SKILL.md` (shipped skill).

## Test helpers (`tests/helpers/`, one file per topic)

- nucleo: `config.ts`, `config-change.ts`, `candidate-scores.ts`, `settings.ts`, `types.ts` (only `LimitsInput`, used by config.ts), `registration.ts` (used by tests/services/config), `observation-ledger.ts` (nucleo's ledger, records, cutoff rules)
- cofre: `vault.ts` (`keepGoing`, `nestedAliasVault`, `allowing`), `vault-catalog.ts`, `vault-exact.ts`, `vault-diagnosis.ts`, `folder-listing.ts`, `locked-file-contents.ts`, `windows-file-handle.ts`, `blocked-write.ts`, `note.ts`, `limits.ts`, `temp-folder.ts`
- indice: `search-index.ts`, `search-catalog.ts`, `search-vectors.ts`, `embeddings.ts`, `embedding-benchmark.ts`
- ponte: `llm.ts`, `decision-model.ts`, `laya-live.ts`, `gate-fixtures.ts`, `threshold-measurement.ts`, `threshold-report.ts`, `relevance-{fixtures,notes}.ts` (feed the threshold measurement)
- maestro: `check-vault-access.ts`, `compact-session.ts`, `diagnose-memory.ts`, `export-memory.ts`, `export-on-host.ts`, `memory.ts`, `memory-change.ts`, `memory-read.ts`, `operation-context.ts`, `registration-usecases.ts`, `search-memory.ts`, `session.ts`, `synchronize-memory.ts`, `capture-memory.ts` (phase 2 usecase only), `relevant-fixtures.ts`, `relevant-memory.ts`, `pi-{prompt,responses,smoke,text,model-registry}.ts`, `session-entries.ts`, `settings-screen.ts`, `shell-edit*.ts`, `test-platform.ts`, `download-source.ts`, `win32-config.ts`, `e2e-*.ts` (e2e worlds; the observation cycle ones are `e2e-observation-cycle.ts` and `e2e-compaction-trigger.ts`), `index.ts` (barrel)
- Owners are by topic (verify the first lines of a helper before editing it). `tests/helpers/memory.test.ts` is a test file in helpers, not exported by the barrel.
- Test projects (`vitest.config.ts`, `maxWorkers: 8`): `unit` (`tests/**/*.test.ts`, minus `*.model.test.ts` and `tests/e2e/**`, 30 s); `model` (`*.model.test.ts`, 600 s, `npm run test:model`, real models, only when asked); `e2e` (`tests/e2e/**/*.e2e.test.ts` minus Laya, `fileParallelism: false`, real Haiku through OmniRoute via `pi-omniroute-sync` and Jev, with `OMNIROUTE_URL`, `OMNIROUTE_API_KEY` and `TYPESAFE_API_KEY` from the environment, run by CI on windows-latest); `e2e-laya` (`*.laya.e2e.test.ts`, `fileParallelism: false`, Laya, only on request).
- Shared helpers (`note`, `temp-folder`, `settings`, `config`, `index`) are used across areas: others request additions via the orchestrator.

## Interfaces

- Ladder: pi → usecases → services → domain, each imports only the layer below; `shared` is importable by all and imports
  no layer (`biome/layer-*.grit`).
- Seam: usecases reach domain rules only through `#src/services` re-exports, never `#src/domain` directly. Re-export-only seam files (one `export ... from "#src/domain"` each): `services/vault/{domain-rules,folder-listing}.ts`, `services/vault/catalog/dont-forget.ts`, `services/search-index/{inspection,dont-forget,ranking}.ts`, `services/llm/domain-rules.ts`, `services/observation-ledger/domain-rules.ts`, `services/shell-edit/domain-rules.ts`, `services/config/vault-access.ts`.
- Vault guard (`src/pi/vault-guard`, maestro): `accessRequestsOf` maps read/write/edit/grep/find/ls/bash/powershell to requests (file, tree, listing, command); each goes to `checkVaultAccess`. A refusal blocks the tool call with its problems joined.
- Shell-edit guard (`src/pi/shell-edit-guard`, maestro): `onShellToolCall`, registered after the vault guard; calls `checkShellEdit` (usecases).
- Aliases (`package.json` `imports`): `#src/<layer-or-folder>` → `./src/<x>/index.ts` (`#src/domain`, `#src/services`,
  `#src/usecases`, `#src/shared`); `#test-helpers` → `tests/helpers/index.ts`.
- Barrels: every `index.ts` only has `export * from "./x.ts"` / `"./folder/index.ts"` (`biome/index-reexports-only.grit`).
  Another layer is imported through its layer barrel (`#src/services`, never `#src/services/vault`); another folder in the same
  layer through `#src/<folder>`; same folder via `./file.ts`; no `../../` (`biome/highest-barrel-*.grit`,
  `barrel-imports.grit`, `no-deep-relative-import.grit`). A new service export needs a line in the service folder's
  index.ts (and `src/services/index.ts` for a new service: ponte adds it).
- Seams, usecase → services (from imports in `src/usecases`):
  - add-memory: config (`readConfig`/`targetVault`), vault (`readNote`, `refreshIndexes`, create), clock (`today`), id (`newNoteId`).
  - get-memory: vault (`inspectVaultFile`, `observeVaultPath`). list-memory: vault (`readFolderIndex`).
  - registration (`registration/{propose,prepare-init,check}.ts` new): config (`readConfigSnapshot`, `writeConfig`, `canonicalizeRegistration`, `proposeInit`, `checkConfigSnapshot`), vault (`ensureVaultAssets`).
  - resolve-memory: config snapshot + canonicalization, `targetVault`.
  - synchronize-memory: vault (`inspectVaultFile`, `observeVaultPath`, `refreshFolders`) + search-index (`reconcileCatalog`, `applyIndexChanges`, `readIndexInventory`).
  - session, operation-context: shared flow pieces used by the above.
- Services consume domain types (note, catalog entry, config snapshot, `MemoryDraftSchema`, `MemoryScopeSchema`, `ListedNoteSchema` (`domain/memory-agent`));
  results use `#src/shared` result types (`{ succeeded, output | problems }`).
- Observation cycle: pi `src/pi/observation-cycle` (hooks, runtime, `records.ts` maps `SessionEntry` to records) calls usecases `observe-session` (`observeChunk`, `cycleSettings`) and `compact-session`, which call `services/llm/observe.ts` and `services/observation-ledger`. `load-memory-map` feeds the compaction summary. Model calls with `thinking` go through `src/pi/completion`.
- pi: `src/pi/{memory-add,paths,memory-setup,memory-init,session-start,registration-report,memory-session,context}` and `src/pi/registrar.ts` call usecases only.

## Build / test / run

- `npm test` (vitest project `unit`); `npm run test:model` (project `model`, 600 s, only when asked);
  e2e: `npx vitest run --project e2e` (only when asked; one at a time on the machine);
  `npm run lint` (`biome check .`); `npm run typecheck` (`tsc --noEmit`); `npm run format` (`biome check --write .`).
- One file: `npx vitest run --project unit tests/services/vault/save.test.ts` (add `-t "name"` for one test).
- Conventions: `tests/` mirrors `src/`; real disk in temp folders (`useTempFolder`), never the user's vaults/config. No mocks,
  fakes, `vi.fn`, or simulation in any test (AGENTS.md Tests section); unprovable parts are recorded as gaps. TDD red → green → refactor.
- CI (`.github/workflows/ci.yml`): lint, typecheck, `npm test` on windows-latest, ubuntu-latest, macos-latest, Node 22.19.0.
  Release (`release.yml`): on push to main, after CI, git-cliff (`cliff.toml`) computes the next 0.x version from the
  squash commit (header plus one commit per body line) and regenerates `CHANGELOG.md`; then tag, npm publish via
  trusted publishing and a GitHub release. Only docs/test/chore... items: no release.

## Pitfalls — Biome rules (`biome/*.grit`)

- No ternary (`no-ternary`); no default values for params/destructuring (`no-default-values`); no `??`/`||` fallbacks (`no-fallback`).
- No `unknown` (`no-unknown`); no index signatures or `Record<string, T>` (`no-index-signature`).
- No `=== undefined/null` comparisons (`no-nullish-comparison`); no `!!x`/`Boolean(x)`/`=== true` (`no-manual-boolean`).
- No inline object types or inline function types: name them in `types.ts` (`no-inline-object-type`, `no-inline-function-type`).
- File roles: types/interfaces only in `types.ts`; top-level values in `constants.ts` (TypeBox schemas in `schemas.ts`);
  error classes in `errors.ts`; styling/colors in `styles.ts`.
- Top-level functions must be `function name() {}` declarations, not arrow consts (`top-level-functions`, circular barrels).

## Pitfalls — stated in docs

- Windows `rename` replaces the destination; check/use windows remain in update, removal and link checks, and are documented
  limits (docs/REVISAO-DE-CODIGO.md: item on `writeAtomically`; closing "Limites já documentados": size/mtime reuse,
  check/use windows, lease without cross-process coordination).
- Persistence can succeed with warnings when index/cleanup maintenance fails; warnings do not mean "save again".
- Index file path: use `indexFileFor` (`services/search-index/.../location.ts`), the only convention; the index is
  rebuildable from notes (REVISAO-DE-CODIGO.md, 2026-10-12 round, finding 3).
- Folder maintenance must re-check every fully enumerated physical folder on each sync (REVISAO-DE-CODIGO.md, findings 1-2).
- `src/domain/config/problems.ts` was removed; do not import it.
- Old incomplete configs are invalid at runtime, never silently migrated; /memory-setup repairs them. Exception: a config with only a legacy `capture` group is upgraded in memory by `upgradeLegacyConfig` (`src/domain/config/legacy-config.ts`) to `observer` and `compaction` (in memory, via `readConfigInspection`).
- Every roadmap milestone ends with `npm test`, lint and typecheck passing on all CI OSes, and updates the README Status (ROADMAP intro).
- Only one e2e run may happen at a time on the machine (shared pi/Laya state); never start a second in parallel.
- Platform is passed down, never read inside the domain: `hostPathPlatform` (`src/pi/paths/platform.ts`) picks the `PathPlatform`
  (`win32 | darwin | linux`, `src/domain/path-platform/`) and the pi layer passes it to domain code. Case is ignored on win32 and
  darwin, kept on linux. POSIX namespace paths (`/proc/self/fd`, `/dev/fd`, `/proc/<pid>/root`) always refuse.
- Observation cycle (`src/domain/observation-ledger`, `src/pi/observation-cycle`): chunks are observed on `turn_end`/`agent_start`; the session holds the state in custom entries `obsidian-memory-observations`, `obsidian-memory-resume` and `obsidian-memory-compaction`. Ledger ranges are read from `ctx.sessionManager.getBranch()`, never from memory. Compaction never uses pi's `firstKeptEntryId`; it uses the ledger's snapped cutoff.
- Capture is removed in phase 1: only `memory_add` saves (`src/usecases/capture-memory` is kept for phase 2).

## Pitfalls — working in parallel

- Other owners edit and test the same working tree at the same time. Mutation checks (temporarily breaking code to
  see a test fail) must back up to a file named with your agent name inside the repo-ignored `tmp/`, never a shared
  `/tmp/x.bak`, and restore immediately; confirm with `git diff -- <file>` afterwards. Never use git stash/checkout.
- Test files hold only `describe`/`it`: any helper function or fixture builder goes to `tests/helpers/<topic>.ts`,
  exported via `#test-helpers` (checked by grep `^function` in `*.test.ts`; currently no matches).
- Every logic module under `src/` needs a mirrored `tests/` file (re-export-only seam files excluded).
- Usecases never import `#src/domain` directly (grep-verified): add a re-export seam in `src/services` first.
- Lint/typecheck errors in files you don't own may be another owner's work in progress: report, don't fix.

## Pitfalls — runtime

- Worktrees have no dev dependencies on this machine (measured: `npm config get omit` is `dev`). Run `npm ci --include=dev` in the worktree before lint or tests; without it, Node resolves `@biomejs`/`vitest` from the parent repo and e2e cannot find `pi`.

- pi supports Node >= 22.19 and loads the extension through jiti; CI pins Node 22.19.0. Subpath aliases must be valid
  there: use `#src/<layer>`, never `#/`.
- pi 1.3.0: `before_agent_start` is a union on `messageType`; `"user"` has `prompt`, `"custom"` starts have no prompt. Guard on `messageType` (`src/pi/relevant-memory/runtime.ts`).
- TypeBox error texts must be built from error data, not from `messages`.
- Lockfile was regenerated with Node 24 npm (after pi 1.3.0 bump).
- Background usecases take a `MemoryOperationContext` (`src/usecases/operation-context`): `signal` and a session `stamp`; they refuse with `cancelled` or `stale-session` once aborted or stale.

## Definition of done (every item)

1. Targeted tests written first (red), then passing (green); `npm run lint` and `npm run typecheck` clean.
2. `revisor` returns APPROVED on the diff; CHANGES REQUIRED goes back to the same owner.
3. Before marking a ROADMAP item done: full `npm test` passes on the affected platforms; e2e runs only when asked.

## Docs

- `docs/VISION.md`: product and numbered decisions. `docs/ROADMAP.md`: only what is still open (implemented items are removed; history is in git).
- `docs/config.md`: config file, every key and default. `docs/vault-format.md`: note, folder, template and lifecycle format.
- `docs/REVISAO-DE-CODIGO.md`: code review rounds, findings, documented limits.
