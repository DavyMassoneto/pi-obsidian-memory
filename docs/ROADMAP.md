# Roadmap

What will be built, in order. [VISION.md](VISION.md), [config.md](config.md) and [vault-format.md](vault-format.md)
describe the target behaviour; the README Status says what works today; this file says what comes next and when each
part is done.

Every milestone:

- starts by checking whether pi-hermes-memory already does it, and reuses only what is needed (VISION 1);
- is built test first, layer by layer (AGENTS.md), with one folder per topic;
- adds its settings to [config.md](config.md) with their defaults, and `/memory-setup` writes them;
- ends with `npm test`, `npm run lint`, `npm run typecheck` and `npm run test:pi` passing on Windows (VISION 14);
- ends with the README Status saying what works, and with every text the LLM or the user sees naming only commands
  and tools that exist.

## Current state

- pi loads the extension and registers `memory_add`, `memory_search`, `memory_get`, `memory_update`, `memory_archive`,
  `memory_succeed`, `/memory-setup` and `/memory-init`. Session start notifies, with a
  UI and not on reload, when there is no config (offers `/memory-setup`), an invalid config (every problem, nothing
  used) or an unreadable file. The real-pi smoke test checks the registrations and the no-config notice.
- One tool, `memory_add`, for explicit requests to remember. It writes a valid note to the global or project vault,
  refuses invalid notes, existing names (in any case) and unregistered projects, and refreshes the folder indexes up to
  the root, including resolved physical ancestors for directory aliases. When the name is taken, it reads the exact
  existing disk statement to show the note. Persistence remains success with warnings if filesystem index/cleanup
  maintenance fails; warnings do not mean the note should be saved again. Refresh propagates programming errors
  rather than disguising them as I/O failures.
- pi sets `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` for its own process.
- The complete product config is read strictly, and a folder is matched to its project. Config resources provide
  snapshots, repair drafts, setting-preserving setup/init proposals and guarded publication. Registration usecases
  prepare settings without writes and bootstrap only the selected global/project target before guarded config-last
  publication, retaining partial asset progress on failure. `/memory-setup` (interactive only; chat model from pi's
  current model or a pick; create or attach; repair; confirmed disclosures; templates) and `/memory-init` (name, vault,
  repoint) drive them, and both refuse overlapping vaults. Setup-only defaults require an explicitly supplied chat
  model; old incomplete files are invalid at runtime, never silently migrated.
- Setup shows the disclosures for chat models, Jev and remote embeddings. Repeating them at startup for hand-edited
  remote settings is not implemented (milestone 1 out of scope).
- Embedding, decision-model and bounded capture/retrieval model resources exist, but these settings do not connect
  them to product operations or prove live-provider/local-inference availability. Later milestones are not
  complete.
- `memory_search` (text; global, project or both; 10 results per vault; archived and invalid-frontmatter notes
  excluded) shows vault, path, type, Don't forget and needs fixing. `memory_get` (vault and path) returns a note in
  full with its problems, a folder's index (`""` is the root), and reads `archive/`. The catalog is synchronized
  before each search and at session start, and the index is rebuilt when missing or corrupt. Warm sync (20
  notes/folder): ~196 ms at 1000 notes, ~960 ms at 5000 (earlier: 470 / 1688 ms).
- Session start adds a memory block as a system prompt section: it says it is only part of the memory, names
  `memory_search` and `memory_get`, and holds every Don't forget note of both vaults in full (with problems for
  name/body issues; invalid-frontmatter notes are not loaded). It is present with no marked notes, absent when the
  config is missing, invalid or unreadable, and never invites saving. The skill `obsidian-memory` ships with the
  package.
- Milestone 2 is not complete: the vault access guard is not built. Nothing stops the LLM from reading or writing vault
  files with pi's file tools, bash or Claude Code sessions started by pi.
- `memory_update`, `memory_archive` and `memory_succeed` (explicit requests only) each need a `memory_get` read of the
  exact vault and path in the same session. The receipt is consumed on success, conflict or partial result, and kept on
  preflight refusals. They refuse a note changed on disk since that read. Update keeps `id` and `created`, sets
  `updated` and never renames; archive moves the note to `archive/` (never deletes); succeed creates the successor and
  links both ways. Paths under `archive/` cannot be changed. A note over a lowered limit can still be archived (the
  archived copy skips note-limit checks). `memory_add` now holds the session lease. Lifecycle reports partial progress
  after late failures; update/removal hash checks and link checks still have check/use windows.
- The text search resource has a private SQLite connection, prepared statements and transactional rowid-linked FTS5
  writes with structured failures. Synchronization populates missing/corrupt catalogs from vault files, retaining
  cached rows under failed coverage and reporting incomplete population separately.
- Guidance names `/memory-setup` when memory is off and `/memory-init` for an unregistered folder, and offers
  `memory_update` for an existing note only when the user asked for a change.
- Frontmatter, name/path, diagnostic, pi response, search-write and lifecycle regression tests now use source-named
  paths. Names live in `domain/names`, paths in `domain/vault-path` and pi paths in `pi/paths`.
- Every module with logic has a test file at its mirrored path. Modules not exported from a layer barrel are tested
  there through real-disk public operations, not exported to tests. Confirmed wiring without a test: re-exports
  (`vault/draft`, `config/registration`, `config/target`, `embeddings/configuration`, `search-index/inspection`),
  prepared SQL lists (`search-index/*statements`) and the one-line `vault/filesystem/hash`.
- A test proves no LLM-facing text names a command or tool that is not registered (`tests/pi/extension.test.ts`).
- Shared temporary-folder and limits fixtures live by topic under `tests/helpers`; no filesystem mocks are used.

## Completed correction work

- [x] Incremental folder-index maintenance: each synchronization computes a per-folder listing fingerprint and
  re-renders `index.md` only when it or the index file's size, dates or file id differ from the last recorded clean render.
  Problem folders are re-checked every sync; a new or rebuilt search index re-checks all; state-table failures fall
  back to re-checking all with a warning. Replaces the full per-sync folder re-check.

- [x] Adversarial review of pending synchronization changes: retry folder maintenance after catalog publication,
  remove stale parent links after empty-folder deletion, and preserve unchanged folder-index files. Synchronization
  now checks every completely enumerated physical folder; this adds reads, without rewriting identical indexes.
  Index filename derivation uses the existing normalized `indexFileFor` contract in one resource-owned module.
  Regression tests were observed failing before the maintenance fixes; no product milestone was completed.

- [x] Independent review of 2026-10-12 resolved: an unrepresentable or failing folder no longer stops the other
  folders' indexes; cancellation is checked before every index write; stable aliases and alias-to-ancestor cycles are
  positive exclusions (plain ELOOP lowers coverage); an index alias is followed only to its own folder's index;
  indexes render from the physical folder; the catalog-entry, reuse and alias-classification rules live in the domain.
  The full-read limit was later resolved by incremental folder-index maintenance (see above).

- [x] Bounded catalog-synchronization usecase: one lease, strict configured scope, per-canonical-root index paths,
  real scan coverage, validation/content fingerprints, exact direct-file aliases, duplicate IDs and affected/missing
  folder-index maintenance. Directory aliases are not recursively duplicated; replaced alias-subtree catalog rows
  are retired explicitly, not reported as deleted notes. Failures retain committed progress; sync does not mint or
  refresh get receipts. Index/database-sidecar links and index-to-note maintenance aliases refuse before writes.
  Same-stat edits and final filesystem check/use races remain; this is not search-tool wiring or milestone completion.

- [x] Bounded exact-read usecase slice: canonical scope/infrastructure validation, raw config-snapshot session binding,
  full closed-frontmatter get receipts and read-only folder-index listing. Invalid closed metadata stays diagnostic,
  not mutation permission. An admitted, current, noncancelled get discards its prior same-path receipt before reading;
  failure requires a new successful get. Folder reads never grant receipts. Changed config requires a fresh stamp;
  missing/unreadable config invalidates the current authority. Reads use one observed config snapshot, not a live watch;
  unchanged config bytes do not detect later root/link retargeting. Existing filesystem check/use limits remain.

- [x] Missing/non-directory paths return refusals; enumeration includes dot-notes, permitted aliases and diagnostic
  entries for refused notes/folders. Unsafe names render without misleading links (review 1, 5, 30, 31, 33, 34).
- [x] Exclusive creation, resolved-target writes, exact existing statements, retained refresh causes and truthful
  saved/partial/maintenance outcomes (2–4, 6, 16, 19, 25, 32). These do not close update/removal races or make lifecycle
  atomic; deterministic cleanup-denial and catastrophic SQLite cleanup coverage remain limited.
- [x] Pure memory rules/factory in domain, resource-owned config I/O, narrowed vault API, named vault contexts and pi
  path ownership, with no cross-resource service imports (7–10, 12–14).
- [x] Private search resource, precise boundary types, exhaustive presentation, shared schema/path definitions,
  rowid-linked transactional FTS and cached Intl/statements (11, 15, 17–18, 20–24, 26).
- [x] Source-named behavioral regressions, shared fixture cleanup, accurate current docs and silent registration
  smoke (27–29). Pi SDK and TypeBox follow the host's wildcard peer contract, with tested development pins 1.0.1 and
  1.3.34. The review's wildcard SDK peer objection is not a defect under that contract. Independent integrated review
  is still an acceptance gate, not implied by these implementation checkmarks.

## Settled behaviour

- **Config growth.** A milestone that adds a setting adds its key to config.md with a default. An existing config
  without the new key is invalid: session start lists the missing key with the fix "run /memory-setup". Re-running
  `/memory-setup` rewrites `config.json`: it keeps every valid value, adds every missing key with its default, and
  names each value it could not keep.
- **Session start until the memory agent exists** (milestone 6) loads only Don't forget notes. Nothing is loaded for a
  part that is not built.
- **Background capture.** Its model (`capture.model`) and when it runs (`capture.when`) are settings. The default model
  is the pi model in use when `/memory-setup` runs. The default moment is `after-each-turn`; the other values are
  `on-compaction` and `at-session-end`.
- **`/memory-init`** creates the vault folder, with `_templates/`, when it is missing.
- **Re-running `/memory-setup`** (and `/memory-init` in a registered folder) only points the config to the new vault.
  The old vault is untouched; nothing is copied or moved.
- **Credentials** for remote models and embedding providers come from pi or the environment. `config.json` never
  holds a key.
- **Tool names** follow `memory_add`: `memory_search`, `memory_get` (milestone 2); `memory_update`, `memory_archive`,
  `memory_succeed` (milestone 3).
- **Vault access (VISION 12, as written).** The LLM never reads or writes a vault file except through the memory
  tools, whatever route it takes: pi's file tools, bash (paths written out or reached indirectly) and Claude Code
  sessions started by pi (pi-claude-bridge). Blocking pi's file tools is one part of this, not all of it. Commands the
  user runs, and edits in Obsidian, are not the LLM and stay free.

## Milestones

### 0. Clean base

- **Goal:** nothing new for the user; the next milestones build on committed, tested, truthful code.
- **Scope:**
  - [x] Commit the note/frontmatter correction work.
  - [x] Each module listed in Current state gets its test at the mirrored path (tests covering it under other names move
    there), or is confirmed as wiring or constants (AGENTS.md, Tests).
  - [x] Texts the LLM or user sees name only commands and tools that exist, and offer what can be done instead:
    - an invalid config points to the config file described in config.md;
    - saving to an unregistered project offers saving to the global vault;
    - a name already taken shows the existing note and asks for a statement that says what is new, since no tool can
      update a note yet.
    - Milestones 1 and 3 restore these texts when the commands and tools exist.
  - [x] The README Status says what works.
- **Out of scope:** new behaviour.
- **Depends on:** nothing.
- **Done when:**
  - the working tree is clean;
  - every module with logic has a test file at its mirrored path;
  - a test proves no LLM-facing text names a command or tool that is not registered;
  - all checks pass.

### 1. Registration

- **Goal:** the user turns memory on from pi, without editing JSON.
- **Scope:** VISION 3 and 13, [config.md](config.md).
  - [x] `/memory-setup` asks where the global vault lives, creates a new dedicated vault or attaches an existing folder,
    and writes the config with every key. Re-run, it follows Settled behaviour (config growth, repoint only). With an
    invalid config it is the repair: it keeps every valid value and names what it could not keep.
  - [x] `/memory-init` registers the working folder as a project. It asks:
    - the name, by default the folder name, unique in any case;
    - the vault, created with `_templates/` when missing.
    In a registered folder it repoints that project. With no global vault it refuses and offers `/memory-setup`.
  - [x] The config rejects a vault used twice, or one vault inside another, so the global and project layers never mix
    (VISION 2). Both commands refuse it, and a hand-edited file with it is invalid.
  - [x] With no config, session start says there is no memory and offers `/memory-setup`. With an invalid config, it
    shows every problem at once and uses nothing from the file.
  - [x] Every vault created or attached gets each note template in `_templates/` (vault-format, Templates); existing
    templates are left as they are.
  - [x] The texts changed in milestone 0 name the commands again.
  - [x] Docs:
    - config.md describes both commands, the repoint rule and the vault overlap rule;
    - VISION 3's "move or switch" is reworded to "point to another vault; the old one is left as it was" (the user's
      decision).
- **Out of scope:** settings of later milestones (each adds its own); copying or moving notes between vaults; repeating
  the remote-provider disclosure at startup for hand-edited settings (config.md, Disclosure), which
  belongs to the first milestone that runs a remote provider (5 for embeddings, 6 for Jev).
- **Depends on:** 0.
- **Done when:**
  - in pi with no config, session start offers `/memory-setup` (smoke test, extending the registered-tool check);
  - after setup, the config holds every key and `memory_add` saves into the chosen vault;
  - a config missing a key gains it, with its default, after re-running setup, and every other value stays the same;
  - after `/memory-init`, a project memory saved from a subfolder lands in the project vault, and an unregistered
    folder saves only to the global vault;
  - `/memory-init` with a missing vault folder creates it with `_templates/`;
  - re-running setup points the config to the new vault, and every file of the old vault is byte-identical;
  - a vault inside another registered vault is refused;
  - every vault created or attached holds every template in `_templates/`.

### 2. Memory the agent can read

- **Goal:** what was saved shapes the next session, and the LLM can search and read further, only through the memory
  tools.
- **Scope:**
  - [x] Session start adds every Don't forget note of the global and the project vault, in full, with no limit
    (VISION 4, vault-format Don't forget). A marked note with problems is included, with its problems. Nothing else is
    loaded (Settled behaviour).
  - [x] Every memory block says it is only part of the memory and that `memory_search` and `memory_get` reach the rest.
    This holds for every block added by any later milestone. The block is added even when no note is marked, so the
    LLM always knows the tools exist. It never invites the LLM to save.
  - [x] `memory_search` (text, VISION 6): one or both vaults. Each result gives the vault, the path, the type, the Don't
    forget mark and whether the note needs fixing.
  - [x] `memory_get` takes a vault and a path:
    - a note comes back in full, with every problem if it breaks any rule;
    - a folder gives its index, so the LLM can walk the tree to place notes (vault-format, Layout);
    - `archive/` paths can be read.
  - [x] Search follows vault-format ("Changes made outside the system"): a note without valid frontmatter stays out of
    search and is listed under `Needs fixing`. This covers a file with no closed frontmatter block (a blank note) and
    a note with any frontmatter problem (a missing or invalid `id`, an unknown or repeated field, a wrong value). A
    note with valid frontmatter whose name or body breaks a rule (for example, a limit lowered later) is searched, and
    its result says it needs fixing. Archived notes are out of search. `memory_get` still reads every note with a
    closed frontmatter block, with all its problems (vault-format, Notes).
  - [x] The index follows the vault: at session start and before each search, new, deleted, moved and changed notes are
    picked up ("Changes made outside the system"). A missing or corrupt index is rebuilt from the notes (VISION 6).
    Writes through the tools update it.
  - Vault access only through the memory system (VISION 12, Settled behaviour):
    - the milestone starts by listing every route the LLM has to the filesystem in a pi session; at least pi's file
      tools (`read`, `write`, `edit`, `grep`, `find`, `ls`), bash, and Claude Code sessions started by pi;
    - every route refuses to read or write a vault file, whether the path is written out (in any case, with either
      separator) or reached indirectly (relative to the working folder, through a variable, glob, link or script);
    - each refusal names `memory_search` and `memory_get`;
    - files outside the vaults stay reachable as before;
    - if a route turns out impossible to close, the milestone stops and reports that route to the user with the
      evidence. VISION 12 is not reworded and the milestone is not done until the user decides.
  - One shipped skill (`obsidian-memory`), never written to a vault (VISION 10). It teaches:
    - the layout and placement rules;
    - the types and Not memory;
    - the read tools;
    - that `memory_add` is only for an explicit request.
    Later milestones update it.
- **Out of scope:** semantic search (5); relevant memories within a budget, memory added per message, and re-adding a
  loaded note that changed (6).
- **Depends on:** 1.
- **Done when:**
  - a note marked `dontForget` in Obsidian is in the next session's context in full, and drops out once archived;
  - the memory block names `memory_search` and `memory_get` and says it is only part of the memory;
  - a search result read with `memory_get` comes back in full;
  - a note with valid frontmatter and a body over a lowered limit is found by search, marked as needing fixing;
  - a note with an unknown frontmatter field stays out of search and is listed under `Needs fixing`. With a body over
    a lowered limit too, `memory_get` on its path returns its content with both problems at once;
  - `memory_get` on a folder returns its index;
  - a note created, edited, moved or deleted in Obsidian is found, updated or gone in the next search;
  - a blank note is listed under `Needs fixing` and stays out of search;
  - deleting the index gives the same search results;
  - for every listed route, a test proves that reading and writing a vault file is refused and that the file on disk
    is unchanged. This covers pi's file tools, bash with the path written out, bash reaching the vault indirectly, and
    a Claude Code session started by pi;
  - the same routes still read and write a file outside the vaults;
  - pi lists the skill, and no vault contains it.
- **Stopped for the user's decision (2026-10-16).** The guard blocks pi's file tools (`read`, `write`, `edit`,
  `grep`, `find`, `ls`), `bash`/`powershell` commands that write a vault path out (any case, separator, `~`, `$HOME`,
  `%USERPROFILE%`, Git Bash drive forms, relative to the working folder), junctions, symlinks, device paths and
  loopback shares into a vault (compared by file identity), and Claude Code sessions whose tools run through pi.
  `grep`/`find` are refused from any folder above a vault. Writing to the memory data folder (config and index) is
  refused, and so is any command naming it (registration changes go through `/memory-setup` and `/memory-init`).
  Raw device paths (`\\.\C:`) are refused for the file tools. In commands, shares named by host name or IPv6, volume
  GUID paths, 8.3 short names, and commands acting on a parent folder of a vault or of the data folder (for example
  deleting `~/.pi/agent`) are not recognised. With no valid config no vault is known, so nothing is refused. Tools the guard does not know pass. Routes that cannot be closed from an extension, with evidence in
  `.pi/research/vault-guard.md`:
  - hardlinks to a vault file placed outside the vault, on every route: a path check cannot see them;
  - shell commands that reach a vault indirectly (variables, globs, scripts, encoded paths): pi has no
    sandbox, and a static check of the command string cannot be complete. Options: run the shell as a separate
    Windows user denied on the vaults (custom `BashOperations`), run it in WSL2/Docker without the vaults, disable the
    shell tools for the LLM, or accept the written-path layer;
  - pi-claude-bridge's fail-soft path, where Claude Code keeps its own tools under `bypassPermissions`. Options:
    `permissions.deny` in the user's Claude Code settings (unverified under bypass), make the bridge fail closed,
    run Claude Code in WSL2, or not use the bridge;
  - tools of other installed extensions (browser, desktop, file watchers): audit and add per-tool rules, deny unknown
    tools by default, or uninstall them;
  - subagent child sessions: whether this extension loads there is unverified.

### 3. Explicit updates and lifecycle

- **Goal:** when the user asks, the agent updates, archives or replaces a memory, preserving history and refusing
  detected edits. The current resource has the update/removal race limits documented in vault-format; this milestone
  must not describe those checks as atomic protection.
- **Scope:**
  - [x] `memory_update`, `memory_archive` and `memory_succeed`, for explicit requests only (VISION 5, 8; vault-format
    Writing and Lifecycle).
  - [x] Each refuses a note not read with `memory_get` in this session, and a note changed on disk since that read.
  - [x] The milestone 0 guidance about an existing note goes back to offering an update.
- **Out of scope:** doing any of it without being asked (4).
- **Depends on:** 2.
- **Done when:**
  - an update keeps the note's identity and sets `updated` to today;
  - an edit made in Obsidian between `memory_get` and the update makes the update a conflict, and the user's edit
    stays;
  - an archived note sits under `archive/` with `archived` set, and is out of search and Don't forget;
  - a successor and its archived note link to each other, whatever the two types;
  - preflight refusals (name taken, not read first) publish nothing; late filesystem failures report partial progress
    and retained copies accurately, and maintenance warnings do not misreport an already-completed movement;
  - the skill covers the new tools, for explicit requests only.

### 4. Automatic capture

- **Goal:** memory grows from the conversation, without the user asking.
- **Scope:**
  - A background process reviews the conversation since its last run. It captures, updates, archives and succeeds
    notes (VISION 5), placing each one by walking the subject tree and using search (vault-format, Layout).
  - It picks the global or the project vault (VISION 2).
  - When unsure of the vault, the folder, the type or whether something is memory, it asks the user through pi's UI.
    Without a UI it saves nothing it is unsure of.
  - It follows the types and the Not memory list, and writes notes in English (VISION 7). Secrets are saved like any
    note (VISION 11).
  - It reaches the vaults only through the memory system, like the main LLM (VISION 12).
  - Settings: `capture.model`, `capture.when` (Settled behaviour).
- **Out of scope:** memory added per message (6).
- **Depends on:** 3.
- **Done when:**
  - a preference stated in conversation becomes a global note, with no memory tool call by the main LLM;
  - new detail on an existing point updates that note instead of adding a new one;
  - a point that stopped being true gets a successor;
  - something saved explicitly with `memory_add` is not saved a second time;
  - tasks, TODOs and session logs are not saved; a stated secret is saved as written;
  - when the vault or the folder is unclear, the user is asked; without a UI nothing is saved;
  - an edit made in Obsidian while capture runs is never overwritten;
  - each `capture.when` value runs capture at that moment, with the configured model;
  - nothing in the main prompt tells the LLM to save.

### 5. Semantic search

- **Goal:** search finds notes by meaning, not only by words.
- **Scope:**
  - Embeddings (VISION 6). Providers:
    - a local model that runs inside the extension with no separate install (the default);
    - OpenAI;
    - Google.
  - Setting: `embeddings` (provider and model). `/memory-setup` warns that a remote provider receives note content,
    secrets included.
  - `memory_search` and capture combine text and embeddings. Only content that changed gets a new embedding.
- **Out of scope:** the decision model and the memory agent (6).
- **Depends on:** 2.
- **Done when:**
  - a query sharing no words with a note still finds it;
  - choosing a remote provider shows the warning;
  - a date-only change or a move creates no new embedding;
  - switching the provider rebuilds the embeddings.

### 6. Context that grows with the conversation

- **Goal:** each user message brings only the memories it needs, and the prompt cache holds.
- **Scope:** the rest of VISION 4.
  - It starts by identifying Laya and Jev: the exact models, how each one is called, and what Laya needs locally. It
    uses their published docs and asks the user only what the docs leave open.
  - At session start, the memory agent also loads memories relevant to the project and folder, within
    `context.budgetChars` (12,000 by default). Don't forget notes do not count against it.
  - On each message, the decision model (`decisionModel`: Laya locally by default, or Jev by API) decides whether
    memory is needed. The memory agent (`memoryAgent.model`, by default the pi model in use at setup) searches and
    reads, and the decision model re-ranks what it found.
  - What is found is added at that point. Earlier messages are never rewritten. A loaded note that changed (Don't
    forget included) is added again, marked as replacing the earlier one.
  - `/memory-setup` warns that Jev sends user messages and candidate notes to TypeSafe.
- **Out of scope:** saving, updating or archiving (that is capture, 4).
- **Depends on:** 5.
- **Done when:**
  - a message that needs no memory adds nothing;
  - a related message adds only the re-ranked notes;
  - earlier messages stay byte-identical;
  - a loaded note edited in Obsidian comes back marked as replacing the earlier one;
  - relevant memory at session start stays within the budget, and Don't forget notes do not count against it;
  - choosing Jev shows the warning.

### 7. `/memory-doctor`

- **Goal:** the user finds and fixes what is wrong in the memory.
- **Scope:** VISION 9 and vault-format.
  - For the global vault and the current project's vault, it lists:
    - invalid notes with every problem;
    - duplicate ids;
    - leftover temporary files;
    - folders above `limits.maxNotesPerFolder` notes (20 by default), suggesting a split.
  - It also shows the config's problems and whether each configured model and embedding provider answers.
  - It offers to complete a blank note (new `id`, asks the type) and applies it only after the user confirms.
- **Out of scope:** any other change. The doctor reports and suggests; it never rewrites, merges, moves or deletes.
- **Depends on:** 2; its provider checks grow with 4–6. It can move earlier when needed.
- **Done when:**
  - a vault with a broken note, a copied note, a blank note, a leftover temporary file and an oversized folder gets
    one report naming all five;
  - completing the blank note changes the file only after confirmation;
  - every other problem is left as it was on disk.

### 8. Dashboard and export

- **Goal:** the user browses the memory in Obsidian and takes it out as one file.
- **Scope:** VISION 9.
  - Dashboard:
    - `Memory.base` at the vault root, written by `/memory-setup` and `/memory-init` when missing; a user's edits to
      it are kept;
    - views: all notes (statement, folder, type, Don't forget, updated), Don't forget, and Archive;
    - it leaves out `_templates/`;
    - vault-format gains a Dashboard section.
  - `/memory-export`:
    - one `.zip` with `global/` and, in a registered project, `project/`, each holding its vault: notes, `archive/`,
      `_templates/`, the dashboard;
    - no hidden folders (`.obsidian/`) and no temporary files;
    - it asks where to save, with the working folder as the default, and never overwrites an existing file.
- **Out of scope:** importing a `.zip`, restoring a vault from an export, merging vaults; the dashboard edits nothing.
- **Depends on:** 1.
- **Done when:**
  - Obsidian opens the dashboard and shows the notes with their type and Don't forget mark, archive apart;
  - the export unpacks to each vault's notes, archive included, and changes nothing in the vaults;
  - exporting twice to the same folder keeps both files.

## Where each VISION decision lands

| Decision | Milestone |
|---|---|
| 1 Reuse | every milestone (checked first) |
| 2 Two layers | done for explicit saves; 1 (projects, no overlapping vaults); 4 (automatic classification) |
| 3 Registration | 1 |
| 4 Context | 2 (Don't forget, partial-memory notice); 6 (the rest) |
| 5 Updates | done (`memory_add`, Claude Code auto-memory off); 2 (read tools); 3 (explicit writes); 4 (background) |
| 6 Search | 2 (text, index); 5 (embeddings) |
| 7 Language | done for explicit saves; 4 |
| 8 Never delete | 3 |
| 9 Commands | 1 (setup, init); 7 (doctor); 8 (dashboard, export) |
| 10 Skills | 2, then updated in each later milestone |
| 11 Secrets | nothing to build: no masking, ever; 4 proves a secret is saved as written |
| 12 Vault access | 2: every route (pi's file tools, bash, Claude Code started by pi); 4 keeps capture inside it |
| 13 Configurable | 1, then each milestone's settings |
| 14 Platform | every milestone (Windows smoke test) |

## Later / not planned

- Session transcripts or "in progress" notes in the vault: VISION, Not in scope.
- Saving skills to the vaults: VISION 10.
- Hosts other than pi: VISION 14, not for now.
- Searching past pi sessions: VISION, not for now.
- Platforms other than Windows: Windows first; others are not tested until the user asks.
- Consolidation or an approval step: VISION 5 rules it out.
- Masking or blocking secrets: VISION 11 rules it out.
- Checking links at the same moment as the read or write: a known limit in vault-format Writing.
- `schemaVersion` and format migrations: only when the format first changes.
- New note types: only with the user's approval.
- Copying or moving notes between vaults, importing or restoring from an export.
