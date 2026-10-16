---
name: project-map
description: Map of pi-obsidian-memory — areas and owners, interfaces between layers, build/test/run, pitfalls. Load before working in any area.
---

# Project map

## Areas

| Owner | Paths (src + mirrored tests/) | Purpose |
| --- | --- | --- |
| nucleo | `src/domain`, `src/shared`, `tests/domain` | Pure rules (note, config incl. `disclosures.ts`, names, vault-path, capture, lifecycle, catalogs, `*/dont-forget.ts`); generic result types |
| cofre | `src/services/vault`, `tests/services/vault` | Notes on disk: read/write/archive/relocate/list, bootstrap, catalog, folder indexes, `inspect-folder.ts` |
| indice | `src/services/{search-index,embeddings}` + tests | SQLite search index, reconcile/recovery, embedding providers; `search-index/inspection.ts` (domain re-export seam) |
| ponte | `src/services/{config,llm,decision-model,clock,id}`, `src/services/index.ts` + tests | Config I/O, LLM, decision model, clock, ids |
| maestro | `src/usecases` (incl. `registration/{propose,prepare-init,check}.ts`), `src/pi` (incl. `registrar.ts`, `memory-setup`, `memory-init`, `session-start`, `registration-report`, `memory-session`, `context`), `tests/usecases`, `tests/pi` | Operation flows; pi tools/events/commands, extension entry (`src/pi/extension.ts`) |
| cartografo | `.pi/skills/project-map/SKILL.md` | Keeps this map |

Unowned (orchestrator only; owners ask): `biome/`, `biome.json`, `package.json`, `tsconfig.json`, `vitest.config.ts`,
`docs/`, `README.md`, `AGENTS.md`, `skills/obsidian-memory/SKILL.md` (shipped skill).

## Test helpers (`tests/helpers/`, one file per topic)

- nucleo: `config.ts`, `settings.ts`, `types.ts` (only `LimitsInput`, used by config.ts)
- cofre: `vault.ts` (`keepGoing`, `nestedAliasVault`, `allowing`), `vault-catalog.ts` (`anInspectedFile`, `aCatalogFailure`, `aVaultCatalogEntry`), `vault-exact.ts`, `windows-file-handle.ts`, `note.ts`, `limits.ts`, `temp-folder.ts`
- indice: `search-index.ts`, `search-catalog.ts`, `embeddings.ts`
- ponte: `llm.ts`, `decision-model.ts`, `registration.ts` (used by tests/services/config)
- maestro: `memory.ts`, `memory.test.ts`, `memory-read.ts`, `registration-usecases.ts`, `session.ts`, `synchronize-memory.ts`, `pi.ts`, `pi-context.ts`, `pi-registration.ts`, `index.ts` (barrel)
- Shared helpers (`note`, `temp-folder`, `settings`, `config`, `index`) are used across areas: others request additions via the orchestrator.

## Interfaces

- Ladder: pi → usecases → services → domain, each imports only the layer below; `shared` is importable by all and imports
  no layer (`biome/layer-*.grit`).
- Seam: usecases reach domain rules only through `#src/services` re-exports, never `#src/domain` directly.
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
- Services consume domain types (note, catalog entry, config snapshot, `MemoryDraftSchema`, `MemoryScopeSchema`);
  results use `#src/shared` result types (`{ succeeded, output | problems }`).
- pi: `src/pi/{memory-add,claude-code,paths,memory-setup,memory-init,session-start,registration-report,memory-session,context}` and `src/pi/registrar.ts` call usecases only; `src/pi/claude-code` sets `CLAUDE_CODE_DISABLE_AUTO_MEMORY`.

## Build / test / run

- `npm test` (vitest project `unit`: `tests/**/*.test.ts` minus `*.smoke.test.ts`); `npm run test:pi` (project `pi`, real pi
  smoke, 30 s timeout; only when the orchestrator asks); `npm run lint` (`biome check .`); `npm run typecheck`
  (`tsc --noEmit`); `npm run format` (`biome check --write .`).
- One file: `npx vitest run --project unit tests/services/vault/save.test.ts` (add `-t "name"` for one test).
- Conventions: `tests/` mirrors `src/`; real disk in temp folders (`useTempFolder`), never a mocked filesystem or the user's
  vaults/config; mock only pi (fake pi), the LLM (`vi.mock`), the clock (`vi.setSystemTime`). TDD red → green → refactor.

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
- Persistence can succeed with warnings when index/cleanup maintenance fails; warnings do not mean "save again"
  (docs/ROADMAP.md, Current state).
- Index file path: use `indexFileFor` (`services/search-index/.../location.ts`), the only convention; the index is
  rebuildable from notes (REVISAO-DE-CODIGO.md, 2026-10-12 round, finding 3).
- Folder maintenance must re-check every fully enumerated physical folder on each sync (REVISAO-DE-CODIGO.md, findings 1-2).
- `src/domain/config/problems.ts` was removed; do not import it.
- Old incomplete configs are invalid at runtime, never silently migrated; setup-only defaults need an explicit chat model (ROADMAP Current state).
- Update/archive/succeed exist but are not reachable by any tool; search is not wired (ROADMAP Current state).
- Every roadmap milestone ends with `npm test`, lint, typecheck and `test:pi` passing on Windows, and updates the README Status (ROADMAP intro).

## Pitfalls — working in parallel

- Other owners edit and test the same working tree at the same time. Mutation checks (temporarily breaking code to
  see a test fail) must back up to a file named with your agent name inside the repo-ignored `tmp/`, never a shared
  `/tmp/x.bak`, and restore immediately; confirm with `git diff -- <file>` afterwards. Never use git stash/checkout.
- Test files hold only `describe`/`it`: any helper function or fixture builder goes to `tests/helpers/<topic>.ts`,
  exported via `#test-helpers` (checked by grep `^function` in `*.test.ts`).
- Lint/typecheck errors in files you don't own may be another owner's work in progress: report, don't fix.

## Pitfalls — runtime

- pi supports Node >= 22.19 and loads the extension through jiti; the real `pi` here runs on Node 22 (first `node`
  on PATH). Subpath aliases must be valid there: use `#src/<layer>`, never `#/`. `npm run test:pi` must pass on the
  default PATH node.

## Definition of done (every item)

1. Targeted tests written first (red), then passing (green); `npm run lint` and `npm run typecheck` clean.
2. `revisor` returns APPROVED on the diff; CHANGES REQUIRED goes back to the same owner.
3. Before marking a ROADMAP item done: full `npm test` passes; at milestone end also `npm run test:pi`.

## Docs

- `docs/VISION.md`: product and numbered decisions. `docs/ROADMAP.md`: current state, milestones 0-8, done criteria; mark completed items.
- `docs/config.md`: config file, every key and default. `docs/vault-format.md`: note, folder, template and lifecycle format.
- `docs/REVISAO-DE-CODIGO.md`: code review rounds, findings, documented limits.
