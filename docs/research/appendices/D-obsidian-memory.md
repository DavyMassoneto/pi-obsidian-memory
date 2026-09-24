# D — Agent long-term memory in Obsidian vaults on OneDrive (Windows 11): prior art and pitfalls

> Web research conducted on **2026-09-23**. Read-only: no repo cloned, nothing installed, no local user file read.
> Confidence legend: **[V]** verified against a primary source (official docs, source code, npm/PyPI registry, LICENSE); **[S]** secondary source (blog, review, forum, university KB); **[NV] not verified** (my own inference, conflicting sources, or a weak source).
> Versions cited are as of today (Sep 2026). All third-party content was treated as data.

---

## 0. TL;DR

1. **There is no ready-made solution for the "Obsidian + OneDrive + Windows + pi + unlimited size" scenario.** The closest prior art is **basic-memory** (Python, **AGPL-3.0-or-later**, v0.23.2 from 2026-08-25). It works as a **design reference**, but not as a dependency or as a source to copy code from. Reasons: the license, the Python runtime, `ensure_frontmatter_on_sync=true` (rewrites the user's notes), and an English-only default embedding (`bge-small-en-v1.5`).
2. **Obsidian integration:** the core should be **FS-first**, reading and writing `.md` directly with Node's `fs`. That way it works with Obsidian closed, it's the fastest path, and you keep full control. The **Obsidian CLI** (1.12+, GA on 2026-02-27) comes in as an **optional adapter**, used only when the app is open and only for what depends on Obsidian's graph: `move`/`rename` that updates links, `backlinks`, `unresolved`. The CLI **requires the app to be open and opens it if it's closed**. The Local REST API 5.x already ships a built-in MCP as of 2026-07-24, but it also requires the app to be open.
3. **Retrieval:** storage is unlimited, but prompt injection has a ceiling. Inject a **small index as a frozen snapshot** at the start of the session and offer the `memory_search` (BM25 via **SQLite FTS5**, with optional vectors) and `memory_get` tools. In Node, **`node:sqlite`** already ships with **FTS5 compiled in** and is a *release candidate* in Node 24.15+/25.7+, with no native build required. `sqlite-vec` 0.1.9 has a `windows-x64` binary. Use **multilingual embeddings**, since the notes are in Brazilian Portuguese, and tune the FTS5 tokenizer to ignore accents.
4. **OneDrive:** Files On-Demand ships **enabled by default** and **cannot be turned off** on newer builds. Storage Sense moves files to online-only after **30 days** of not being opened (Windows 11 22H2+ default, when Storage Sense is on). Because of this:
   - **pin** the memory folder;
   - **detect placeholders** (`stat.blocks === 0 && size > 0`);
   - **never** put SQLite, WAL, or `.git` inside OneDrive;
   - use `*.tmp` temp files (OneDrive doesn't sync `.tmp`) and `rename` with retry on `EPERM`/`EBUSY`/`EACCES`;
   - write with **optimistic concurrency** (hash);
   - keep **append-only daily logs per device**;
   - detect conflict copies named `Name-COMPUTER.md`;
   - **don't rename via the FS** while Obsidian is open, because links break.

---

## 1. Baseline: what exists today (Hermes and pi-hermes-memory)

- **Hermes Agent (NousResearch):**
  - Uses `MEMORY.md` with a **2,200-char (~800-token) limit** and `USER.md` with **1,375 chars (~500 tokens)**, both under `~/.hermes/memories/`. [V]
  - Both are injected as a **frozen snapshot** at the start of the session to preserve the prefix cache. Writes made during the session go to disk, but only show up in the next session. [V]
  - `memory` tool with `add` / `replace` (substring `old_text`) / `remove`. Entries separated by `§`. `session_search` over SQLite FTS5. [V]
  - Writes go through an injection/exfiltration scanner. [V]
- **pi-hermes-memory 0.9.9 (2026-09-13, MIT, chandra447):**
  - Files under `~/.pi/agent/pi-hermes-memory/` (`MEMORY.md`, `USER.md`) and `~/.pi/agent/projects-memory/<project>/`, plus `sessions.db` (FTS5). [V]
  - Default limits of **5,000 chars** (MEMORY, USER, and project) and fixed instructions of 2,000 chars / 20 entries. [V]
  - Default mode **`policy-only`**: doesn't inject everything, and the agent calls `memory_search`. The `legacy-inject` mode injects everything. [V]
  - Tools: `memory_add` / `memory_replace` / `memory_remove` / `memory_search` / `session_search` / `skill_manage`. [V]
  - Background review every 10 turns or 15 tool calls. Correction detection. **Auto-consolidation** when the limit fills up. [V]
  - Scanner that blocks API keys, tokens, and SSH keys. [V]
- **What to keep in the new project:**
  - frozen snapshot (cache);
  - a security scanner on writes, now even more important because the vault is human-editable and synced from other devices;
  - periodic review;
  - `policy-only` as the default.
- **What changes:** the size limits stop applying to storage and start applying only to the **injection budget**.
- **Useful pi hooks:** `before_agent_start` to inject system-prompt sections, `session_before_compact` and `session_compact` for the pre-compaction flush, `turn_end`, `session_shutdown`, and `pi.registerTool()`. [V, pi.dev/docs/latest/extensions]

---

## 2. basic-memory (basicmachines-co/basic-memory): deep dive

### 2.1 Identity, version, and license
- **Latest version: 0.23.2 (2026-08-25).** Before it: 0.23.1 (Aug 25), 0.23.0 (Aug 24), 0.22.1 (Jun 13), 0.22.0 (Jun 11), 0.21.6 (Jun 5), 0.21.5 (May 26). [V, PyPI]
- **License:** the LICENSE file is **GNU AGPL v3 (2007-11-19)**; `pyproject` declares `AGPL-3.0-or-later`. There is no exception or dual licensing in the LICENSE. [V]
- Python **>=3.12**. Installation: `uv tool install basic-memory` (the README mentions `--prerelease=allow`). [V]
- There is a paid offering, **Basic Memory Cloud** (US$15/month beta, with bidirectional sync via rclone), but it isn't required. [V/S]

**AGPL implication:**
- Copying or adapting basic-memory code into your TypeScript package creates a derivative work under the AGPL: the whole package would need to be released under the AGPL and, when used over a network, offer its source code.
- **Ideas, formats, and protocols are not protected by copyright:** the observations/relations syntax, the `memory://` URIs, and the permalink concept can be reimplemented in a *clean room*.
- Running it as a **separate process** (an MCP server) without modifying it does not "contaminate" your code. [NV — this is not legal advice]

### 2.2 Architecture [V, unless marked otherwise]
- **Markdown files are the source of truth.** The index is derived, in **SQLite** (default) or **Postgres**.
- Key dependencies: `sqlalchemy`, `aiosqlite`, `alembic`, `asyncpg`, `sqlite-vec>=0.1.6`, `fastembed>=0.7.4`, `watchfiles>=1.0.4`, `markdown-it-py`, `python-frontmatter`, `mcp>=2,<3`, `fastmcp==4.0.3`, `fastapi`, `litellm`. `uvloop` only outside Windows.
- **Search:**
  - FTS5 (a `search_index` table with a custom tokenizer, per third-party analysis [S]).
  - **Vectors via sqlite-vec + FastEmbed**, with a default `bge-small-en-v1.5` model (**384 dims**, English only).
  - **Hybrid** search via *score-based fusion*. If the text search returns nothing, hybrid mode reruns the query as *relaxed any-word*.
  - Optional reranker (`jinaai/jina-reranker-v1-tiny-en`, off by default).
- **Semantic search enabled by default:** the docs say "enabled by default." `config_models` uses a "default factory based on dependency availability." The README lists `BASIC_MEMORY_SEMANTIC_SEARCH_ENABLED (default: false)`, which conflicts. In practice, it ends up enabled if `fastembed` and `sqlite-vec` load. [NV regarding the discrepancy]
- **Chunking:**
  - each header produces a section chunk;
  - **each observation and each relation is indexed individually**;
  - prose in ~900-char blocks with ~120-char overlap.
- The first index of a few hundred notes takes 1–3 min.
- **Sync and watch:**
  - `WatchService` + `SyncService`; changes detected in ~1 s;
  - `index_delay` defaults to **1000 ms**, `index_batch_size` 32;
  - checksum to detect external edits;
  - `file_write_status` state (pending/writing/synced/failed/external_change_detected) [S];
  - the `edit_note` tool accepts **`expected_checksum`**, which provides optimistic concurrency.
- **Ignore:** `~/.basic-memory/.bmignore` (global) + the project's `.gitignore`. Without a `.gitignore`, it uses defaults (`.git`, `node_modules`, `.env`…). There was a bug with patterns starting with `#` (issue #1539, fixed in PR #1540).

### 2.3 Note format [V]
```markdown
---
title: Authentication Design
type: note
tags: [auth, security, backend]
permalink: authentication-design
created: 2026-08-01T14:30:00Z
modified: 2026-08-10T09:15:00Z
---
# Authentication Design

## Observations
- [decision] Using JWT tokens for stateless authentication #security
- [approach] Refresh tokens stored in HTTP-only cookies
- [constraint] Tokens expire after 15 minutes (security audit)

## Relations
- implements [[API Security Requirements]]
- depends_on [[User Database Schema]]
- relates_to [[Session Management]]
```
- **Observation:** `- [category] content #tag (context)`. Categories are free-form. Checkboxes `[ ]`/`[x]` don't count as a category.
- **Relation:** `- relation_type [[Target]]`. A bare `[[Target]]` in prose becomes `links_to`. Relations can point to notes that don't exist yet (forward refs).
- **Permalink:** a stable identifier, derived from the path (with the project prefix by default), that **doesn't change on rename/move**. It's addressable as `memory://permalink`.

### 2.4 MCP tools [V]
- **Content:**
  - `write_note` (`title`, `content`, `directory`, `tags`, `note_type`, `metadata`, `overwrite`);
  - `read_note` (`identifier`, pagination);
  - `edit_note` (`operation`: `append | prepend | find_replace | replace_section | insert_before_section | insert_after_section`, `expected_replacements`, `expected_checksum`);
  - `move_note`, `delete_note`, `read_content`, `view_note`.
- **Search and context:**
  - `search_notes` (`search_type`: `text | title | permalink | vector | semantic | hybrid`, filters `note_types`, `categories`, `tags`, `after_date`, `metadata_filters`, `min_similarity`);
  - `build_context` (`url` memory://, `depth`, `timeframe`, `max_related`);
  - `recent_activity`, `list_directory`.
- **Projects:** `list_memory_projects`, `create_memory_project`, `delete_project`, `list_workspaces`.
- **Schema:** `schema_infer`, `schema_validate`, `schema_diff`.
- **Diagnostics and compatibility:** `basic_memory_diagnostics`; `search` and `fetch` for ChatGPT compatibility.
- Third-party analysis cites ~25 tools and notes that a large surface is cognitively heavy for the agent. [S]

### 2.5 Configuration [V]
- **File:** `~/.basic-memory/config.json`, with `projects: {name: {path, mode: local|cloud, …}}` and `default_project`.
- **Env vars:**
  - `BASIC_MEMORY_CONFIG_DIR` changes the config folder **and the default SQLite location**;
  - `BASIC_MEMORY_MCP_PROJECT` locks it to one project;
  - any `BASIC_MEMORY_*` takes precedence over the file.
- **Keys that touch the user's files (pay attention with an existing Obsidian vault):**

  | Key | Default | Effect |
  |---|---|---|
  | `ensure_frontmatter_on_sync` | **true** | adds frontmatter on sync |
  | `update_permalinks_on_move` | false | — |
  | `kebab_filenames` | false | — |
  | `format_on_save` | false | — |
  | `permalinks_include_project` | true | — |

- Other keys worth noting for reference:
  - `semantic_embedding_provider` (default `fastembed`), `semantic_embedding_model`, query/document prefixes;
  - `semantic_vector_k=100`, `semantic_min_similarity=0.55`;
  - `sqlite_synchronous=NORMAL`, `sqlite_mmap_size=256MiB`, `sqlite_wal_autocheckpoint=1000`;
  - `watch_project_reload_interval=300`;
  - `auto_update=true`.

### 2.6 How it maps onto an Obsidian vault [V]
- Setup: `basic-memory project add main ~/path/to/vault` + `basic-memory project default main`. No Obsidian plugin is required.
- AI-written notes show up in Obsidian and end up in the graph because they're wikilinks.
- Official tips: use `[[Note Title]]` and `#tag` with no spaces.
- **Risks for your use case:** [NV — inferred from the config]
  - the sync can **add frontmatter to personal notes** that don't have any;
  - SQLite lives under `~/.basic-memory` by default, so it's **outside** OneDrive (good);
  - if `BASIC_MEMORY_CONFIG_DIR` points inside OneDrive, it becomes a disaster (see §6.6).

### 2.7 What to borrow (in a clean room) and what to avoid
- **Borrow:**
  - files as truth + a derived, rebuildable index;
  - a **stable identity separate from the file name** (permalink or frontmatter `id`);
  - observations as atomic facts indexed individually (great for recall);
  - typed relations as wikilinks (compatible with Obsidian);
  - `build_context` with `depth` and `timeframe`;
  - `expected_checksum`;
  - `.gitignore`-style ignoring;
  - chunking by section.
- **Avoid:**
  - a surface of ~25 tools (prefer 3–5);
  - rewriting notes outside the memory folder;
  - English-only embeddings;
  - no lifecycle: the third-party analysis found no decay, consolidation, or pruning. [S]

---

## 3. Obsidian integration options (2026)

Obsidian's state today:
- **Desktop 1.14.2 (2026-09-15)** [V].
- 1.13.4 (2026-07-30) introduced **confirmation for Obsidian URI actions**, which makes `obsidian://` a poor fit for silent automation [V].
- Obsidian has been **free even for commercial use since 2025-02-20** [V].
- Obsidian **still has no first-party MCP server** [S].

### 3.1 (a) Direct filesystem
- **App open required?** No.
- **Metadata cache, backlinks, links:** nothing comes for free; you have to parse wikilinks, frontmatter, and tags yourself. In exchange, you keep full control of the index.
- **Rename:** an external rename looks to Obsidian like a **create + delete**. The rename event doesn't fire and **links are not updated**. The "Automatically update internal links" option only applies to renames done inside the app. [S, Obsidian forum]
- **External changes:** Obsidian "automatically refreshes your vault to keep up with any external changes" [V, help data-storage]. If the note is open in the editor, it shows "has been modified externally, merging changes automatically" [S, Obsidian forum, Feb 2026].
- **Speed and Windows:** this is the fastest option and doesn't depend on IPC. The risks are OneDrive placeholders and `EPERM` on rename (§6).
- **Lesson from FS-based MCPs:** **mcpvault** had a HIGH-severity *case-insensitive blocklist bypass* vulnerability and gaps in its dotfile filter on macOS/Windows, fixed in v0.14.1+ [S]. On Windows, **compare paths case-insensitively** and canonicalize with `realpath`.

### 3.2 (b) Local REST API and MCP servers
- **coddingtonbear/obsidian-local-rest-api (MIT, ~2.9k★):**
  - Versions: **5.2.0 (2026-09-21)**; **5.0.0 (2026-07-24)** rewrote the patch engine and **added a built-in MCP** at `https://127.0.0.1:27124/mcp/` (Streamable HTTP, `Authorization: Bearer <api-key>`). 5.0.2 lowered the minimum to Obsidian **1.8.7**. [V]
  - Ports: HTTPS **27124** and HTTP **27123** (optional, off by default).
  - Uses its own CA, with a certificate restricted to 127.0.0.1/localhost. 5.2.0 split the CA and leaf certs to fix Firefox. [V]
  - Endpoints: `/vault/{path}` (CRUD), `/active/`, `/periodic/`, `/search/simple/` (fuzzy), `POST /search/` with **JsonLogic** (`application/vnd.olrapi.jsonlogic+json`), `/commands/`, `/tags/`, `/open/{path}`.
  - **Surgical PATCH** by `heading` / `block` / `frontmatter`.
  - MCP tools: `vault_list`, `vault_read`, `vault_write`, `vault_patch`, `search_query`, `command_execute`, `tag_list`. Has signed URLs for binaries. [V]
  - Dataview DQL support in `/search/`: [NV in v5; not mentioned in the current README].
  - **Obsidian needs to be running.** [V]
- **MarkusPfundstein/mcp-obsidian (MIT, ~4.4k★, Python ≥3.11):**
  - A wrapper around the REST API, installed with `uvx mcp-obsidian`.
  - Tools: `list_files_in_vault`, `list_files_in_dir`, `get_file_contents`, `search`, `patch_content`, `append_content`, `delete_file`.
  - Env: `OBSIDIAN_API_KEY`, `OBSIDIAN_HOST`, `OBSIDIAN_PORT`. [V]
  - An Aug 2026 review says the maintainer came back after 17 months but hasn't published a new release. [S]
- **cyanheads/obsidian-mcp-server v3.5.5 (Apache-2.0, TypeScript):**
  - Requires REST API **v4.0.0–5.x**. Bun ≥1.4 or **Node ≥24** runtime. stdio and Streamable HTTP transports.
  - 14 tools, including `obsidian_search_notes` (text / JSONLogic / BM25 via Omnisearch), `obsidian_patch_note`, `obsidian_manage_frontmatter`, and `obsidian_manage_tags`.
  - Access control via `OBSIDIAN_READ_PATHS`, `OBSIDIAN_WRITE_PATHS`, and `OBSIDIAN_READ_ONLY`. [V]
- **bitbonsai/mcpvault (`@bitbonsai/mcpvault`, MIT, Node ≥20, ~1.7k★):**
  - **Direct filesystem, no plugin.** 18 tools, including `patch_note`, `get_note_outline`, `read_note_lines`, `update_frontmatter` (AST-aware, preserves YAML formatting), and `wiki_link`.
  - Multi-word search with **BM25 rerank**.
  - Excludes `.obsidian`, `.git`, `node_modules`, and dotfiles. Whitelists `.md/.markdown/.txt/.base/.canvas`. Has a `--read-only` mode. [V]
- **aaronsb/obsidian-mcp-plugin (MIT, ~460★):**
  - **It is the plugin itself** and serves MCP over HTTP **3001** / HTTPS **3443**.
  - 8 "semantic" tools: vault, edit, view, graph traversal, workflow, Dataview DQL, Bases, system.
  - App open required: yes. [V]
  - Distribution: the README mentions BRAT plus the official directory; one review says "beta-only via BRAT." [conflicting sources]
- **Archived or dead:** `jacksteamdev/obsidian-mcp-tools` (archived, with a corruption bug on nested headings), `StevenStavrakis/obsidian-mcp` (dormant since Jun 2025), and the Smithery variant (404). [S, chatforest, Aug 2026]

### 3.3 (c) Official Obsidian CLI
- **Launch:** early access in 1.12.0 (2026-02-10, required Catalyst); **GA in 1.12.4 (2026-02-27)**. The docs say "Using the CLI requires the Obsidian 1.12 installer." On Windows, the **`Obsidian.com`** redirector is only installed by the **1.12.7+ installer**. The app's auto-update doesn't replace the installer: anyone with an older installer needs to reinstall. [V]
- **Activation:** Settings → General → **Command line interface**, then register.
  - Windows: `Obsidian.com` sits next to `Obsidian.exe`, and the CLI is added to the PATH (restart the terminal).
  - macOS: symlink at `/usr/local/bin/obsidian`.
  - Linux: `~/.local/bin/obsidian`. [V]
- **The app needs to be open:** "Obsidian CLI requires the Obsidian app to be running. If Obsidian is not running, the first command you run launches Obsidian." [V] For a terminal agent, that means **launching the GUI unexpectedly**.
- **Syntax:** `obsidian [vault=<name|id>] <command> key=value flags`.
  - With `file=<name>` resolution works like a wikilink; with `path=<folder/note.md>` the path is exact.
  - `\n` and `\t` work in `content=`.
  - Several list commands accept `format=json|csv|tsv`, and `--copy` copies the result.
  - With no arguments, `obsidian` opens a TUI. [V]
- **Main commands:** [V/S]
  - files: `read`, `create` (`overwrite`, `open`), `append`, `prepend` (after the frontmatter), **`move` / `rename` (update wikilinks)**, `delete`, `files`, `folders`, `file`, `vault`, `vaults`;
  - search and links: `search`, `search:context` (grep-like output, `path:line: text`), `backlinks`, `links`, `unresolved`, `orphans`, `deadends`;
  - tags, tasks, and properties: `tags`, `tag`, `tasks`, `properties`, `property:read`, `property:set`, `property:remove`;
  - daily notes: `daily`, `daily:path`, `daily:read`, `daily:append`, `daily:prepend`;
  - Bases: `bases`, `base:query` (`format=json|csv|tsv|md|paths`), `base:create`;
  - history: `history`, `history:restore`, `diff`;
  - Sync: `sync`, `sync:status`, `sync:history`, `sync:read`, `sync:restore`, `sync:deleted`;
  - commands and plugins: `commands`, `command`, `plugins`, `plugin:enable`, `plugin:install`;
  - dev: `eval` (runs JS inside the app, **security caveat**), `dev:screenshot`, `dev:console`, `dev:dom`.
- **Gotchas for agents:**
  - **exit code is always 0**: you have to parse the output;
  - **~1 s per operation**, no real batching;
  - some commands "succeed" without doing anything. [S, dsebastien guide]
  - In early access on Windows, running the terminal **as Administrator** made the CLI **return nothing**. [S, zenn.dev; NV whether it still happens in GA]
- **Obsidian Headless** (npm, open beta, **Node 22+**, Feb 2026) syncs vaults **only via Obsidian Sync**, without the GUI. It doesn't help with OneDrive, but it's worth knowing about in case of a future migration. [S]

### 3.4 (d) kepano/obsidian-skills (MIT)
- **Skills:**
  - `obsidian-markdown`: OFM, i.e., wikilinks, `![[...]]` embeds, `^id` block IDs, `> [!note]` callouts, properties (text/list/number/checkbox/date/datetime/tags/aliases types, cssclasses), `%%…%%` comments, `==…==` highlights, math, and Mermaid;
  - `obsidian-bases` (`.base` files: views, filters, formulas, summaries);
  - `json-canvas`;
  - `obsidian-cli`;
  - `defuddle` (web → clean markdown);
  - **`knap`** (Markdown templates from JSON/CSV, added 2026-09-10).
- Last commit on **2026-09-15**. [V]
- Installation: skills go in the vault's `.claude/` folder (Claude Code), `~/.codex/skills`, OpenCode, the marketplace, or `npx skills`. [V]
- The `obsidian-cli` skill explicitly says "**Requires Obsidian to be open**" and recommends the `silent` (don't open the file) and `total` flags. [V]
- Markdown skill guidance: "use `[[wikilinks]]` for notes within the vault (Obsidian tracks renames automatically)." [V]
- **Suggested use:**
  - bundle or reference `obsidian-markdown` in your pi package so the LLM writes valid OFM;
  - use `obsidian-bases` to generate a `.base` that works as a **memory dashboard** (filter by `type`, `project`, `modified`). Bases has been a core plugin since 1.9.0 (May 2025). [V]

### 3.5 (e) Semantic search inside Obsidian
- **Smart Connections (brianpetro):**
  - **"Smart Plugins License,"** source-available, with a restriction against competing offerings. **Not OSI.** [V]
  - Local embeddings by default (v4; 4.5.0 shipped 2026-05-05 [S]), written to **`.smart-env/` inside the vault**. The docs themselves say to **exclude `.smart-env/` from third-party sync**, which OneDrive doesn't offer for personal accounts (§6.6). [V]
  - **No official MCP.** [S]
  - Community MCPs that read `.smart-env/`, e.g. `msdanyg/smart-connections-mcp` (MIT, Node 20+, transformers.js, bge-micro-v2 384d), work **without the app open** for querying, but still depend on the plugin to generate or update vectors. [S]
- **Omnisearch (GPL-3.0):**
  - BM25 search via MiniSearch.
  - **Opt-in HTTP server** at `GET http://localhost:51361/search?q=…`, which returns `score`, `path`, `basename`, `foundWords`, `matches`, `excerpt`.
  - **The server stops when Obsidian closes.** [V]
- **Conclusion:** for agent memory, **keep semantic search in your own index** (§5). Search plugins either require the app to be open or write large amounts of data inside the synced vault.

### 3.6 Integration recommendation
- **FS-first core** (works 100% with Obsidian closed) with its own index.
- **Optional `ObsidianCli` adapter**, enabled when `Obsidian.exe` is running and the CLI is registered:
  - `move`/`rename` with link updates;
  - `backlinks`, `unresolved`, and `orphans` for maintenance;
  - `base:query`.
  - Never trigger the CLI when the app is closed (it opens the GUI), unless the user opted into that during onboarding.
- **Local REST API/MCP:** only as an alternative integration for people who already use it. Not worth it as a dependency, because of the open-app requirement, the certificate, and the third-party plugin.
- **Renaming memories:** avoid it. Use a stable `id` in the frontmatter, `aliases`, and title-based wikilinks. If you must rename, do it via the CLI with the app open, or rewrite the links yourself with the app closed.

---

## 4. Other memory designs: layout, retrieval, and what to borrow

### 4.1 OpenClaw [V, docs and code as of Sep 2026]
- **Layout** (default workspace `~/.openclaw/workspace`):
  ```text
  USER.md            # stable preferences (small, separate injection budget)
  MEMORY.md          # curated long-term facts / decisions
  memory/YYYY-MM-DD.md  (or memory/YYYY-MM-DD-<slug>.md)   # daily logs
  DREAMS.md          # consolidation ("dreaming") journal for review
  memory/imports/{codex,claude-code,hermes}/                # migrated memories
  ```
- **Bootstrap:**
  - on a clean `/new` or `/reset`, it loads `MEMORY.md`, `USER.md`, and **today's and yesterday's notes**;
  - if `MEMORY.md` goes over budget, **the file on disk stays intact and only the injected copy gets truncated**;
  - older notes are only reachable via search.
- **Tools:** `memory_search` (hybrid) and `memory_get` (file or line range).
- **Index:**
  - one SQLite file per agent (current docs: `~/.openclaw/agents/<agentId>/agent/openclaw-agent.sqlite`; a Feb 2026 walkthrough: `~/.openclaw/memory/<agentId>.sqlite`);
  - FTS5 with BM25, trigram for CJK;
  - optional `sqlite-vec`, with a software fallback;
  - native queries run in a **separate read-only process** so they don't block the event loop.
- **Constants** (`src/agents/memory-search.ts`):
  - `DEFAULT_CHUNK_TOKENS=400`, `DEFAULT_CHUNK_OVERLAP=80`;
  - `DEFAULT_MAX_RESULTS=6`, `DEFAULT_MIN_SCORE=0.35`;
  - **`VECTOR_WEIGHT=0.7`, `TEXT_WEIGHT=0.3`, `CANDIDATE_MULTIPLIER=4`**;
  - **`MMR_LAMBDA=0.7`**, **`TEMPORAL_DECAY_HALF_LIFE_DAYS=30`**;
  - `WATCH_DEBOUNCE_MS=1500`, an embeddings cache with 50,000 entries.
- **Ranking:** hybrid score × recency decay × importance, followed by **MMR** (Jaccard over the snippets' tokens). Up to 200 candidates per leg. `MEMORY.md`, `USER.md`, and undated files are **evergreen** (no decay). The BM25 rank is normalized as `1/(1+rank)`. [V/S]
- **Embeddings:** OpenAI `text-embedding-3-small` by default, with a local GGUF option via llama.cpp (e.g., `embeddinggemma-300m-qat-Q8_0.gguf`), Ollama, LM Studio, and others.
- **Pre-compaction memory flush:**
  - a **silent** turn, on by default (`agents.defaults.compaction.memoryFlush.enabled`);
  - triggers when the projected context exceeds `contextWindow − reserveFloor − softThresholdTokens` (**4000**). The doc's example: a 32,768 window with an 8,192 reserve gives 20,576;
  - runs **once per compaction cycle**, on a **private copy** of the conversation;
  - the prompt instructs it to save to `memory/YYYY-MM-DD.md` and reply **`NO_REPLY`** if there's nothing to save;
  - there's a `forceFlushTranscriptBytes: "2mb"` setting.
- **Dreaming:** a managed cron job with score, recall-frequency, and query-diversity gates, plus **taint gating**: untrusted content is never promoted. The summary goes to `DREAMS.md`.
- **Borrow:**
  - **append-only** daily log + a curated file;
  - "today + yesterday" at bootstrap;
  - 0.7/0.3 weighted fusion with a candidate multiplier;
  - 30-day decay with evergreen items;
  - MMR at 0.7;
  - flush before compaction (in pi: `session_before_compact`);
  - consolidation with a human-review file;
  - taint gating.

### 4.2 Anthropic memory tool (`memory_20250818`) [V]
- **Client-side:** the model requests operations on the virtual **`/memories`** prefix, and your handler maps that prefix to real storage (a folder, a DB, etc.).
- Declaration: `{"type":"memory_20250818","name":"memory"}`. **No beta header required.** Available on Claude 4+.
- **Commands:**
  - `view` (a directory with 2 levels and sizes; a file with line numbers; `view_range`; the model expects **truncation above 16,000 chars**);
  - `create`;
  - `str_replace` (fails if `old_str` isn't unique);
  - `insert` (`insert_line`);
  - `delete`;
  - `rename` (doesn't overwrite the destination).
- **Automatically injected prompt:** "IMPORTANT: ALWAYS VIEW YOUR MEMORY DIRECTORY BEFORE DOING ANYTHING ELSE…" / "ASSUME INTERRUPTION."
- **Security:** validate *every* path against traversal (`../`, `..\`, `%2e%2e%2f`, canonicalization). Recommends a size cap, pagination, and **expiring** files that go unaccessed.
- Combines with server-side **context editing** and **compaction**.
- **TS SDK:** `betaMemoryTool` and `BetaLocalFilesystemMemoryTool` (in `@anthropic-ai/sdk/tools/memory/node`).
- **Borrow:** implement a **handler compatible with `memory_20250818`** that maps `/memories` to `<vault>/<memoryRoot>`. With Claude models, the trained-in behavior comes for free. For other providers in pi, expose the same set of commands as a regular tool.

### 4.3 Claude Code auto-memory [V]
- **Layout:** `~/.claude/projects/<project>/memory/`, with `MEMORY.md` (**an index, one line per memory**) and one file per memory (e.g., `user_role.md`, `feedback_testing.md`).
- **Injection:** only **the first 200 lines or 25 KB** of `MEMORY.md` (whichever comes first). Topic files are read **on demand** with the normal file tools.
- **Index guard:** near the limit, Claude Code asks to trim it down. Past the limit, the write goes through, but returns an error telling it to rewrite the index.
- **Frontmatter:**
  - a **`type`** field: `user | feedback | project | reference`;
  - Claude Code writes **`modified`** (ISO 8601) automatically since v2.1.214 [V];
  - `name` and `description` show up in practice [S, harrisonsec, Apr 2026].
- **Policy:** don't save what can be derived from the code or git, or what's already in CLAUDE.md.
- **Configuration:** `autoMemoryEnabled`, `autoMemoryDirectory` (absolute or `~/`), `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`. Memory is machine-local.
- **Borrow:**
  - **index + topic files**;
  - `type` taxonomy;
  - automatic `modified`;
  - a size guard **on the index** (not on storage);
  - the "don't save what's derivable" policy.
- Note that `autoMemoryDirectory` could point at the vault. That's exactly the OneDrive scenario that needs the precautions from §6.

### 4.4 Letta [V]
- **Memory blocks:**
  - `label`, `description`, `value`, `limit` (in characters), `read_only`;
  - **always in context**, rendered inside an XML-like `<memory_blocks>` block;
  - shareable between agents;
  - the docs use 5,000 in the examples; the exact default is [NV].
- **MemFS / Context Repositories** (Letta Code, post from **2026-02-12**):
  - memory as **Markdown versioned in git**;
  - `system/` is **always loaded in full**; everything else shows up only as a **tree + the frontmatter `description`** (progressive disclosure), with content read on demand;
  - every edit becomes a commit;
  - subagents write in separate **git worktrees** and merge;
  - init, reflection ("sleep-time"), and **defrag** skills (reorganizes into **15–25 focused files**);
  - `/init`, `/remember`, `/doctor`.
- **No vector index by default:** search uses the normal tools. The **MemFS Search** mod does keyword search and uses **qmd** for semantic/hybrid.
- **The Letta Filesystem (open_file/grep_file/search_file) is deprecated** in favor of direct FS access + context repositories + qmd.
- **Borrow:**
  - the `pinned: true` flag (the equivalent of `system/`);
  - a required `description` for progressive disclosure;
  - periodic defrag;
  - background reflection.
- **Caution:** git versioning **inside OneDrive is a bad idea** (§6.6).

### 4.5 Cline Memory Bank [V]
- **Fixed layout under `memory-bank/`:**
  - `projectbrief.md` (foundation);
  - `productContext.md`, `systemPatterns.md`, `techContext.md`;
  - `activeContext.md` (changes most often);
  - `progress.md`.
- **Rule:** "I MUST read ALL memory bank files at the start of EVERY task." "Initialize memory bank" and "update memory bank" commands.
- **Borrow:** the **per-project context** templates, for project onboarding. **Don't** borrow the "always read everything," which doesn't scale to unlimited memory.

### 4.6 claude-mem (thedotmack) [V]
- v13.25.3, **Apache-2.0** (current LICENSE), Node ≥20, `npx claude-mem install`.
- **Automatic capture** via hooks (SessionStart, UserPromptSubmit, PostToolUse, Stop, SessionEnd) and a local HTTP worker with a viewer.
- AI-driven compression into typed **observations** (`decision | bugfix | feature | refactor | discovery | change`) with title/subtitle/narrative/facts/concepts, plus `session_summaries` (request/investigated/learned/completed/next_steps).
- **Storage:** SQLite (`bun:sqlite`) with **FTS5 + triggers**; Chroma for hybrid search. Data under `~/.claude-mem/`.
- **Three-layer progressive disclosure:** `search` (a compact index with IDs, ~50–100 tokens per result), `timeline` (chronological context), and `get_observations` (detail for filtered IDs only, ~500–1,000 tokens). Claims ~10x savings.
- **Borrow:**
  - the layered search API (list IDs + snippet → timeline → detail);
  - observation types;
  - triggers to keep FTS in sync.
- The Apache-2.0 license allows reusing code with attribution and a NOTICE.

### 4.7 mem0 (contrast: not Markdown) [V]
- Records live in a **vector store**, extracted by an LLM and scoped by `user_id` / `agent_id` / `run_id`.
- **v3 algorithm** (migration guide): **single-pass, ADD-only extraction**, with no UPDATE/DELETE on write. Conflicting facts **accumulate**, and ranking resolves which one wins at retrieval time.
- Agent facts become first-class.
- **Built-in entity linking** (spaCy, a `{collection}_entities` collection) replaces the external graph store.
- Multi-signal retrieval: **semantic + BM25 + entity**.
- The vendor's own benchmarks: LoCoMo 91.6, LongMemEval 93.4.
- **Borrow:**
  - ADD-only on the hot path (an append-only log) with resolution by recency/ranking;
  - **entities** as a ranking signal (in Obsidian, **wikilinks, tags, and aliases** themselves serve as entities).

### 4.8 qmd (tobi/qmd), a relevant bonus [V]
- `@tobilu/qmd` 2.8.3, **MIT**, **Node ≥22** / Bun.
- Stack: **better-sqlite3 ^13.0.3 + sqlite-vec 0.1.9 + node-llama-cpp 3.20** (GGUF), with EmbeddingGemma 300M, Qwen3-Reranker 0.6B, and query expansion with Qwen3 1.7B.
- Pipeline: **BM25 (FTS5) + vector → RRF → LLM rerank**.
- *Collections* via globs, descriptive *contexts*, and filtering by typed frontmatter. MCP with `query`, `get`, `multi_get`, and `status`. CLI with JSON/CSV/MD/XML output.
- On Windows, the README recommends Vulkan (parallel CUDA can crash). The models add up to ~2 GB.
- It's the engine Letta recommends for MemFS.
- **Borrow:** it's a good reference for a TypeScript pipeline, and could even be an optional dependency ("advanced mode"). The MIT license allows it.

### 4.9 Summary of what to borrow

| System | Layout | Retrieval | Borrow |
|---|---|---|---|
| basic-memory | notes per entity, observations/relations | FTS5 + sqlite-vec + hybrid; graph-based `build_context` | stable id, atomic observations, typed relations, `expected_checksum` |
| OpenClaw | MEMORY.md + USER.md + daily logs | 0.7/0.3 hybrid, 30-day decay, MMR 0.7 | today+yesterday at bootstrap, pre-compaction flush, dreaming with review |
| Anthropic memory tool | virtual `/memories` | agent navigates (`view`) | compatible handler, anti-traversal, cap and expiration |
| Claude Code | MEMORY.md (index) + topic files | injected index (200 lines/25 KB) + on-demand reads | `type`, `modified`, index guard |
| Letta MemFS | fixed `system/` + tree with descriptions | FS tools (qmd optional) | `pinned`, `description`, 15–25 file defrag |
| Cline | 6 fixed files | reads everything | project templates only |
| claude-mem | SQLite (not markdown) | search → timeline → get | 3-layer API, types |
| mem0 | vector DB | semantic + BM25 + entities | ADD-only + resolution at read time; entities |
| qmd | .md collections | BM25 + vector + RRF + rerank | complete TS pipeline (MIT) |

---

## 5. Retrieval for unlimited Markdown memory

### 5.1 Patterns that work
1. **Unlimited storage, limited injection.**
   - Inject a *frozen snapshot* (Hermes) with: `USER.md`, the `MEMORY.md` index (one line per memory, Claude Code style), memories with `pinned: true` (Letta `system/` style), and today+yesterday from the daily log (OpenClaw).
   - All of it under a **token budget**, with truncation and a line like "there are N memories; use memory_search."
2. **Progressive disclosure.**
   - `memory_search` returns **ID + title + snippet + score**.
   - `memory_get` returns the file or a line range.
   - Optionally, `memory_timeline` (claude-mem).
   - On Claude models, the `memory_20250818` handler lets the model navigate on its own.
3. **Lexical search first** (FTS5/BM25 or ripgrep).
   - Coding-agent memory is full of exact identifiers: package names, flags, paths, errors. BM25 handles that better than vectors.
   - Vectors act as a second leg. Use weighted fusion (OpenClaw's 0.7/0.3) or **RRF** (`Σ w/(k+rank)`, k≈60).
4. **Post-processing:**
   - **recency decay** (30-day half-life, except for evergreen items);
   - **boost by type/project** (current project > global);
   - **MMR** (λ 0.7) for diversity;
   - `minScore` (0.35 in OpenClaw) to avoid injecting junk.
5. **ADD-only writes on the hot path** (per-device daily log). **Consolidation** runs off the hot path:
   - dedup (cosine ≥ ~0.9 or same entity/wikilink);
   - merge into a topic file;
   - index update;
   - archiving (move to `archive/`, never delete);
   - uncertain proposals go to `inbox/`, for review in Obsidian.
6. **Pre-compaction flush** (pi's `session_before_compact`): a silent turn — "save durable memories now; reply NO_REPLY if there's nothing."
7. **Chunking by heading** (basic-memory: by section; prose in ~900-char chunks with 120-char overlap. OpenClaw: 400 tokens with 80-token overlap). Observations as individual chunks.
8. **A derived, rebuildable index.**
   - Key `(path, size, mtimeMs, sha256)`.
   - A watcher with 1–1.5 s debounce, plus a full reconciliation at startup. Watchers miss events, and OneDrive writes files coming from other devices.

### 5.2 A TS/Node stack on Windows without native-build pain

Node context:
- **Node 24** is Active LTS until 2026-10-20.
- **Node 26** is Current (since 2026-05-05) and becomes LTS on **2026-10-28**.
- Starting Oct 2026, Node moves to one major release per year. [S]

| Piece | Version (Sep 2026) | Native? | Windows | Notes |
|---|---|---|---|---|
| **`node:sqlite`** (built-in) | Node ≥22.13 / 23.4 without a flag; **RC** since 24.15.0 and 25.7.0 | built into Node | ✔ zero install | **FTS5 and FTS3 compiled in** (`deps/sqlite/sqlite.gyp` defines `SQLITE_ENABLE_FTS5`); `allowExtension` + `loadExtension()`; `defensive: true` by default (24.14+/25.5+); `serialize()` (26.1+) [V] |
| **better-sqlite3** | **13.0.3** (2026-08-05) | N-API | ✔ | v13 moved to `node-addon-api`, with **prebuilds bundled in the package** (no prebuild-install) and compatibility across Node and Electron versions; Node ≥22; SQLite 3.53.4 with FTS5 [V] |
| **sqlite-vec** | **0.1.9** (alpha 0.1.10-alpha.4) | extension | ✔ `sqlite-vec-windows-x64` | pre-v1 ("expect breaking changes"); `vec0` with `distance_metric=cosine`; KNN via `MATCH ? AND k = ?`; Apache-2.0/MIT; loads into `node:sqlite` (23.5+) or better-sqlite3 [V] |
| **MiniSearch** | 7.2.0 (MIT) | pure JS | ✔ | BM25-like, fuzzy and prefix; serializes to JSON; in-memory index [V] |
| **Orama** | 3.1.18 (Apache-2.0) | pure JS | ✔ | full-text + vector + **hybrid** (`mode: 'hybrid'`); persistence plugin [V] |
| **FlexSearch** | 0.8.212 (Apache-2.0) | pure JS | ✔ | very fast; persistent adapters [V/NV] |
| **@vscode/ripgrep** | 1.18.0 | binary | ✔ `@vscode/ripgrep-win32-x64` | now shipped via per-platform optionalDependencies (no postinstall download, per the manifest) [V] |
| **@huggingface/transformers** | **4.3.0** (v4 shipped 2026-02-09) | uses `onnxruntime-node` 1.30.0 (~287 MB unpacked; has a postinstall) | ✔ | `env.cacheDir` controls the cache (default: `.cache` inside the package); `allowRemoteModels=false` for offline use [V] |
| **node-llama-cpp** | 3.21.1 | prebuilt | ✔ `win-x64`, `-cuda`, `-vulkan`, `win-arm64` | GGUF (EmbeddingGemma, etc.); has a postinstall [V] |
| **chokidar** | 5.0.0 | JS | ✔ | ESM-only, Node ≥20.19. Native `fs.watch({recursive:true})` also works on Windows [V/NV] |

**Recommendation:**
- **`node:sqlite` as the default**, falling back to better-sqlite3 13 if you need to support an older Node 22.
- **FTS5 always on.**
- **Vectors optional** (sqlite-vec + transformers.js or a remote endpoint).
- **MiniSearch** as a pure-JS fallback, e.g. if `loadExtension` fails.
- The **index lives in `%LOCALAPPDATA%`**, never in OneDrive.

**Brazilian Portuguese:**
- FTS5: `tokenize = "unicode61 remove_diacritics 2"`. The `2` handles composed codepoints correctly; the default is `1`. For substring search, add a second table with the `trigram` tokenizer (matches ≥3 chars and speeds up LIKE/GLOB if it doesn't strip diacritics). [V, sqlite.org]
- **Multilingual embeddings:**
  - `Xenova/multilingual-e5-small`: an ONNX build of `intfloat/multilingual-e5-small`, MIT, 512 tokens, requires `query: ` and `passage: ` prefixes, 384 dims [V/NV on the dims];
  - `onnx-community/embeddinggemma-300m-ONNX`: 768 dims with MRL down to 512/256/128, 100+ languages, **no fp16** (use fp32/q8/q4), prefixes `task: search result | query: ` and `title: none | text: `, **Gemma license**.
  - Avoid `bge-small-en-v1.5` (basic-memory's default), which is English-only.
- Tokenizing in JS: use `\p{L}\p{N}` with the `u` flag. `\W` breaks accented words.

### 5.3 Examples (illustrative, TypeScript)

**(a) FTS5 schema with `node:sqlite` (index outside OneDrive)**
```ts
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const indexPath = join(process.env.LOCALAPPDATA!, "pi-obsidian-memory", "index", `${vaultId}.sqlite`);
const db = new DatabaseSync(indexPath, { allowExtension: true, timeout: 5000 });

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS files(path TEXT PRIMARY KEY, size INTEGER, mtime_ms INTEGER, sha256 TEXT);
  CREATE TABLE IF NOT EXISTS chunks(
    id INTEGER PRIMARY KEY, path TEXT NOT NULL, heading TEXT, body TEXT NOT NULL,
    type TEXT, project TEXT, mtime_ms INTEGER, evergreen INTEGER DEFAULT 0);
  CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
    heading, body, content='chunks', content_rowid='id',
    tokenize = "unicode61 remove_diacritics 2");
  -- external content: keep FTS in sync via triggers
  CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
    INSERT INTO chunks_fts(rowid, heading, body) VALUES (new.id, new.heading, new.body); END;
  CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, heading, body) VALUES ('delete', old.id, old.heading, old.body); END;
  CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
    INSERT INTO chunks_fts(chunks_fts, rowid, heading, body) VALUES ('delete', old.id, old.heading, old.body);
    INSERT INTO chunks_fts(rowid, heading, body) VALUES (new.id, new.heading, new.body); END;
`);

// Sanitize: quoting each term avoids FTS5 syntax errors with '-', ':', etc.
const toFts = (q: string) =>
  q.split(/\s+/).filter(Boolean).map((t) => `"${t.replace(/"/g, '""')}"`).join(" OR ");

const textSearch = db.prepare(`
  SELECT c.id, c.path, c.heading, c.body, c.mtime_ms AS mtimeMs, c.evergreen,
         bm25(chunks_fts, 2.0, 1.0) AS bm25,                  -- lower = better
         snippet(chunks_fts, 1, '«', '»', '…', 16) AS snip
  FROM chunks_fts JOIN chunks c ON c.id = chunks_fts.rowid
  WHERE chunks_fts MATCH ? ORDER BY bm25 LIMIT ?`);

const hits = textSearch.all(toFts("decisão sqlite onedrive"), 24);
```

**(b) Vectors with sqlite-vec (optional)**
```ts
import * as sqliteVec from "sqlite-vec";
sqliteVec.load(db); // node:sqlite requires { allowExtension: true }

db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
  embedding float[384] distance_metric=cosine)`);

const f32ToBlob = (v: Float32Array) => Buffer.from(v.buffer, v.byteOffset, v.byteLength);
db.prepare(`INSERT OR REPLACE INTO chunks_vec(rowid, embedding) VALUES (?, ?)`)
  .run(BigInt(chunkId), f32ToBlob(vec));          // integer rowid: use BigInt

const knn = db.prepare(`
  SELECT rowid AS id, distance FROM chunks_vec
  WHERE embedding MATCH ? AND k = ?`).all(f32ToBlob(queryVec), 24);
// cosine distance ∈ [0,2] → similarity = 1 - distance
```

**(c) Local multilingual embeddings (transformers.js v4)**
```ts
import { pipeline, env } from "@huggingface/transformers";
env.cacheDir = join(process.env.LOCALAPPDATA!, "pi-obsidian-memory", "models"); // outside OneDrive
// env.allowRemoteModels = false; // after the first download, to run 100% offline

const extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small", { dtype: "q8" });
export async function embed(texts: string[], kind: "query" | "passage"): Promise<Float32Array[]> {
  const out = await extractor(texts.map((t) => `${kind}: ${t}`), { pooling: "mean", normalize: true });
  return (out.tolist() as number[][]).map((a) => Float32Array.from(a));
}
```

**(d) Hybrid fusion, recency decay, and MMR (OpenClaw-style)**
```ts
type Cand = { id: number; path: string; text: string; mtimeMs: number; evergreen: boolean; s: number };

export function fuse(textIds: number[], vecHits: { id: number; distance: number }[],
                     rows: Map<number, Omit<Cand, "s">>, wVec = 0.7, wText = 0.3): Cand[] {
  const acc = new Map<number, number>();
  textIds.forEach((id, rank) => acc.set(id, wText * (1 / (1 + rank))));        // BM25 via rank
  for (const h of vecHits) acc.set(h.id, (acc.get(h.id) ?? 0) + wVec * Math.max(0, 1 - h.distance));
  return [...acc].flatMap(([id, s]) => (rows.has(id) ? [{ ...rows.get(id)!, s }] : []));
}

export const decay = (c: Cand, halfLifeDays = 30, now = Date.now()) =>
  c.evergreen ? 1 : Math.pow(0.5, (now - c.mtimeMs) / 86_400_000 / halfLifeDays);

const toks = (t: string) => new Set(t.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter(Boolean)); // don't use \W (breaks "ação")
const jaccard = (a: Set<string>, b: Set<string>) => {
  let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1);
};

export function rank(cands: Cand[], k = 6, lambda = 0.7, minScore = 0.35): Cand[] {
  const pool = cands.map((c) => ({ ...c, s: c.s * decay(c) })).filter((c) => c.s >= minScore * 0.5);
  const T = new Map(pool.map((c) => [c.id, toks(c.text)]));
  const picked: Cand[] = [];
  while (picked.length < k && pool.length) {
    let bi = 0, best = -Infinity;
    pool.forEach((c, i) => {
      const red = picked.length ? Math.max(...picked.map((p) => jaccard(T.get(c.id)!, T.get(p.id)!))) : 0;
      const score = lambda * c.s - (1 - lambda) * red;
      if (score > best) { best = score; bi = i; }
    });
    picked.push(pool.splice(bi, 1)[0]);
  }
  return picked;
}
```

**(e) Pure-JS fallback (MiniSearch) with accent stripping**
```ts
import MiniSearch from "minisearch";
const fold = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const ms = new MiniSearch({
  idField: "id",
  fields: ["title", "body", "tags"],
  storeFields: ["path", "title", "mtimeMs", "type"],
  processTerm: (t) => fold(t),
  searchOptions: { boost: { title: 2 }, prefix: true, fuzzy: 0.2 },
});
ms.addAll(docs);                                 // docs: {id, path, title, body, tags, mtimeMs, type}
const hits = ms.search("decisao arquitetura");   // matches "decisão arquitetura"
const snapshot = JSON.stringify(ms);             // persist under %LOCALAPPDATA%
// const ms2 = MiniSearch.loadJSON(snapshot, { idField: "id", fields: [...], processTerm: fold });
```

**(f) Chunking by heading (tolerant of Windows CRLF)**
```ts
export function chunkMarkdown(md: string, max = 1600, overlap = 200) {
  const text = md.replace(/\r\n/g, "\n").replace(/^---\n[\s\S]*?\n---\n/, ""); // strip frontmatter
  const out: { heading: string; body: string }[] = [];
  for (const sec of text.split(/^(?=#{1,6}\s)/m)) {
    const heading = /^#{1,6}\s+(.*)$/m.exec(sec)?.[1] ?? "";
    for (let i = 0; i < sec.length; i += max - overlap) out.push({ heading, body: sec.slice(i, i + max) });
  }
  return out.filter((c) => c.body.trim());
}
```

---

## 6. OneDrive + Obsidian on Windows: pitfalls and mitigation

### 6.1 Files On-Demand, placeholders, and hydration
- **On by default, with no way to turn it off:** "Starting with OneDrive build 23.066 Files On-Demand is enabled by default for all users." On newer builds you can only choose between "Free up disk space" (default) and "Download all files." [V, Microsoft Support]
- **Three states:** [V]

  | State | Attribute | Command |
  |---|---|---|
  | online-only (blue cloud) | unpinned | `attrib +U` |
  | locally available (green check) | clearpin | `attrib -P` |
  | **always available** (green circle) | pinned | `attrib +P` |

  Check with `attrib <path>`. [V, Microsoft Learn]
- **Hydration:** "Whether you use file system APIs, the Command Prompt, or a desktop or a UWP app to access a placeholder file, the file will hydrate." A placeholder is "only available if the sync service is available." [V, Cloud Files API]
  - **Offline:** "You can't open online-only files when your device isn't connected." Expect errors like "The cloud file provider is not running" (0x8007016A), which show up in Node as `UNKNOWN`/`EIO`. [V/S]
  - **App blocking:** background hydration shows a **toast**. If the user clicks *Block app*, `node.exe` stays blocked until it's allowed again under *Settings → Privacy & security → Automatic file downloads*. That page may not appear if GPO/MDM is in play. [V/S]
- **Storage Sense:** "starting in Windows 11, version 22H2, the default for OneDrive cloud files is to make files online-only if not opened for more than 30 days." Storage Sense ships off, but Windows may turn it on when disk space runs low. Files marked "Always keep on this device" are **exempt**. [V]
  - Consequence: **old, rarely opened memories are exactly the ones that turn into placeholders.**
- **Obsidian:** the official docs say to avoid Files On-Demand and use "Always keep on this device." Obsidian reads everything at startup, which **forces a download** of the entire vault. Obsidian staff in 2021: "We need your files present, they are the source of truth." There are reports that **OneDrive resets the pin** after updates. [V/S]
- **Real incidents with agents:**
  - `anthropics/claude-code#62140` (2026-05-25, Cowork): it read a truncated placeholder (**Size 137377, Blocks 0**), wrote over it, and **silently deleted content from the cloud**. Closed as *not planned*.
  - `NousResearch/hermes-agent#97898` (2026-08-29, open): an agent's `find` **hydrated iCloud Photos at ~53 MB/s**.
- **Mitigations:**
  1. During onboarding, check and offer to **pin** the memory folder: `attrib +P "<memoryRoot>" /S /D`. In Explorer: *Always keep on this device*. Re-check on every start. Third parties have reported that new files automatically inherit the pin [S/NV]; revalidate periodically.
  2. **Never scan the whole vault or the whole OneDrive.** Index only `memoryRoot`, plus explicit globs the user chooses.
  3. **Detect placeholders before reading or writing.** On Windows, libuv fills in `st_blocks = AllocationSize >> 9` [V, libuv source]:
     ```ts
     import { statSync } from "node:fs";
     /** Heuristic for a dehydrated (cloud-only) placeholder. */
     export function looksDehydrated(p: string): boolean {
       const st = statSync(p);                 // stat only reads metadata: it doesn't hydrate
       return process.platform === "win32" && st.isFile() && st.size > 0 && st.blocks === 0;
     }
     ```
     Tiny files resident in the MFT can, in theory, report 0 blocks. Confirm with `attrib` before acting on it. [NV]
  4. **Shrink guard:** refuse to write if the new content is dramatically smaller than the last known size (> 2×), unless that's explicitly intended. That's what bug #62140 suggests.
  5. Always write from a **fully read and verified** (hash) state, from the same process.

### 6.2 Conflicts and duplicate copies
- **Documented default** for non-Office files: "OneDrive automatically keeps both versions… the copy on your computer has your device name appended to the file name such as `Report-JOHNS-SURFACE.txt`." OneDrive for work or school keeps up to 5 conflict versions. [V, Microsoft Learn]
  - Dropbox-style suffixes ("`(X's conflicted copy YYYY-MM-DD)`") show up in reports from vault users. Handle both patterns. [S]
- **`.obsidian/workspace.json`** (and `workspace-mobile.json`) changes with every file you open. With two PCs open, it becomes a chronic source of conflicts (`workspace-DESKTOP-XXXX.json`). [S]
- **Mitigations:**
  - a **per-device daily log** (`daily/2026-09-23.DESKTOP-AB12.md`), so two PCs never write to the same log file;
  - consolidation on **one designated device** or with a logical lock (§6.7);
  - a scanner for conflict copies inside `memoryRoot`:
    ```ts
    import { hostname } from "node:os";
    // Register each device's COMPUTERNAME during onboarding (e.g., <memoryRoot>/_devices.md)
    export function findConflictCopies(files: string[], devices = [process.env.COMPUTERNAME ?? hostname()]) {
      const alt = devices.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
      const re = new RegExp(`^(.*)-(${alt})(\\.[^.\\\\/]+)$`, "i");
      return files.flatMap((f) => {
        const m = re.exec(f);
        return m ? [{ copy: f, original: m[1] + m[3], device: m[2] }] : [];
      });
    }
    ```
    What to do with each copy found:
    - don't index it as a new memory;
    - merge it via line diff (append-only makes this easier);
    - move the copy to `archive/conflicts/`;
    - notify the user.

### 6.3 Locks, `EPERM`, and atomic writes
- On Windows, `fs.rename(tmp, target)` fails with **`EPERM`/`EBUSY`/`EACCES`** when Defender, Search Indexer, the sync engine, or another process holds a transient handle. libuv **doesn't retry** (`MoveFileExW(..., MOVEFILE_REPLACE_EXISTING)`). `graceful-fs` backs off for up to ~60 s. `write-file-atomic` doesn't use graceful-fs (issue #227, Feb 2026, *closed not planned*). [V]
- **OneDrive doesn't sync `.tmp` or `.ini` files** [V, Microsoft Learn GPO]. A `*.tmp` temp file never becomes a phantom upload. If it starts with `.`, Obsidian also ignores it, since hidden files and folders are outside the Vault API. [V/S]
- **Temp + rename under OneDrive, side effects:**
  - the Linux client (abraunegg) documents that saving via rename is "technically a new file"; it lists vim, emacs, LibreOffice, **and Obsidian** as apps with atomic save [S];
  - on the **official Windows client**, the effect on **version history** and the item's identity is [NV]. Test it during onboarding: write via rename and check the history on the web.
- **Recommended pattern:** optimistic concurrency + `.tmp` + rename with retry.
  ```ts
  import { promises as fs } from "node:fs";
  import { createHash, randomUUID } from "node:crypto";
  import { dirname, basename, join } from "node:path";

  const sha = (s: string) => createHash("sha256").update(s).digest("hex");
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function renameWithRetry(from: string, to: string, tries = 10) {
    for (let i = 0; ; i++) {
      try { return await fs.rename(from, to); }
      catch (e: any) {
        if (!["EPERM", "EBUSY", "EACCES"].includes(e.code) || i >= tries) throw e;
        await sleep(Math.min(3000, 50 * 2 ** i));
      }
    }
  }

  /** Fails with CONFLICT if the file changed since it was read (Obsidian, another device, OneDrive). */
  export async function writeIfUnchanged(file: string, next: string, expectedSha: string | null) {
    const cur = await fs.readFile(file, "utf8").catch((e) => (e.code === "ENOENT" ? null : Promise.reject(e)));
    if ((cur === null ? null : sha(cur)) !== expectedSha) throw new Error("CONFLICT: re-read, merge, and try again");
    const tmp = join(dirname(file), `.${basename(file)}.${randomUUID()}.tmp`);
    await fs.writeFile(tmp, next, { encoding: "utf8", flag: "wx" });
    try { await renameWithRetry(tmp, file); } finally { await fs.rm(tmp, { force: true }); }
  }
  ```
  There's a TOCTOU window between the check and the rename. That's acceptable for memory data, and the conflict scanner covers the rest.
- In the Obsidian plugin API, the equivalent recommendation is `Vault.process()`, checking that the callback's content matches `cachedRead()`. [V, docs.obsidian.md]

### 6.4 Sync delays and pauses
- Sync is **eventual**.
- OneDrive **pauses on its own** in *battery saver* and on a **metered network**, and the user can pause it for 2/8/24 h. [S, Microsoft Support]
- Conflicts show up exactly when two devices edit before the upload finishes.
- **Mitigations:**
  - ADD-only;
  - re-read before writing;
  - `modified` + `device` in the frontmatter;
  - never assume "what another PC just wrote" has already arrived.

### 6.5 Paths and names
- **OneDrive:**
  - decoded path ≤ **400 chars**;
  - local sync ≤ **520** (up to 400 for the relative path plus up to 120 for the root, and "OneDrive - Long Org Name" eats into that budget);
  - segment ≤ **255**;
  - Office apps on Windows won't open paths > 260. [V]
- **Node:** `fs` uses the `\\?\` prefix internally and supports long paths (except for old `realpath.native` cases, already fixed). [S] Git without `core.longpaths`, and other tools, can break. Obsidian itself doesn't complain. [S]
- **Forbidden on OneDrive:**
  - the characters `" * : < > ? / \ |`;
  - a leading or trailing space;
  - the names `.lock`, `CON`, `PRN`, `AUX`, `NUL`, `COM0-9`, `LPT0-9`, `desktop.ini`, `~$*`, and `_vti_` anywhere in the name. [V]
- **Also avoid in Obsidian:** `# ^ [ ] |`, which break links, and `:`. [S]
- **Mitigation:** an ASCII-safe slugified name (keep the accented title in `title`/`aliases`), a ~80-char name limit, and a shallow tree.
- **Microsoft's recommendation:** ≤ **300,000 synced items** to keep performance up. [V]

### 6.6 What to exclude and where to put everything
- **Never inside OneDrive:**
  - **SQLite and WAL/SHM files.** SQLite's own docs describe corruption from backing up/copying mid-transaction and from separating `-wal`/`-journal` from the DB — exactly what file-based sync does. [V, sqlite.org/howtocorrupt]
  - **`.git`:** reports of corruption and `index.lock` conflicts. [S]
  - model caches;
  - large logs.
  - Put all of this under `%LOCALAPPDATA%\<app>\`.
- **Selective exclusion:** OneDrive **has no `.gitignore`**.
  - The **"Exclude specific kinds of files from being uploaded"** (`EnableODIgnoreListFromGPO`, with wildcards) and **"Exclude specific kinds of folders"** (`EnableODIgnoreFolderListFromGPO`, exact name, no wildcards, only for new folders) GPOs exist, but they're machine policies (HKLM, admin). It's unclear whether they apply to personal accounts [NV].
  - **Don't automate this**: document it, at most, as an advanced option.
- **Inside the vault, but small:**
  - the memory `.md` files;
  - optionally a versionable vault `config` (`<memoryRoot>/_memory.config.md` or `.json`).
  - Avoid `.smart-env/`, which Smart Connections says to exclude from third-party sync.
- **`.obsidian/`:** your code shouldn't write there. Across multiple PCs, accept conflicts in `workspace*.json`, or advise the user not to keep Obsidian open on two PCs at once.

### 6.7 Simultaneous edits (Obsidian + agent + another device)

| Scenario | Mitigation |
|---|---|
| The user edits a note open in Obsidian while the agent writes | optimistic concurrency (hash); Obsidian merges it ("modified externally, merging changes automatically"); prefer append-only for agent files and rarely edit human notes |
| Two agents (pi sessions) on the same PC | a per-file lock (`.lock` outside OneDrive, under `%LOCALAPPDATA%`) or a single queue in the indexer process |
| Two PCs | a per-device daily log + consolidation on an elected device; a logical lock via a `_consolidation.lock.md` file containing device + timestamp + TTL (a heuristic; OneDrive doesn't guarantee mutual exclusion) [NV] |
| Rename or move | don't rename via the FS with Obsidian open; use a stable `id` + `aliases`; or the Obsidian CLI `move` |

### 6.8 How Obsidian reacts to external changes
- Obsidian updates the vault on its own. [V]
- An open note that changes on disk: automatic merge, with reports of cursor focus loss. [S]
- **External renames break links** (they become delete + create). [S]
- Hidden files and folders (`.something`) stay outside the index and the Vault API. [V]
- Plugins that rewrite frontmatter in the background (e.g., "updated") trigger "modified externally" loops. [S] Don't update `modified` on every read, only on an actual write.

### 6.9 Auto-detection for onboarding
- **Vault registry (internal, not officially documented):**
  - the file `%APPDATA%\obsidian\obsidian.json`. The global settings folder `%APPDATA%\Obsidian\` is documented [V]; the schema below comes from forums and tools [S].
  - Structure:
    ```json
    {"vaults":{"96a832d9c9cc9eca":{"path":"C:\\Users\\me\\OneDrive\\Notes","ts":1643208916609,"open":true}}}
    ```
  - The key is an arbitrary, unique hex id. `ts` is an epoch in ms. `open` marks whether the vault is open. There may be other top-level keys; ignore them.
  - The vault's "name" is the **basename** of the path (the Obsidian CLI accepts `vault=<name|id>`).
  - There's also `%APPDATA%\obsidian\<id>.json` with window state.
  - **Read-only.** Don't write to that file while Obsidian is open.
- **OneDrive roots:**
  - the env vars `OneDrive` (first account), `OneDriveConsumer` (personal), and `OneDriveCommercial` (work/school). Widely used, but I couldn't find official Microsoft documentation for them [S].
  - Registry `HKCU\Software\Microsoft\OneDrive\Accounts\{Personal|Business1..}\UserFolder` [S].
  - `HKCU\Software\SyncEngines\Providers\OneDrive\*\MountPoint` for SharePoint libraries [S/NV].
- **Known Folder Move:** `Documents` and `Desktop` can end up inside OneDrive. Use `realpath` and compare case-insensitively.
  ```ts
  import { readFileSync, existsSync, realpathSync } from "node:fs";
  import { join, basename, resolve, sep } from "node:path";
  import { execFileSync } from "node:child_process";

  type Reg = { vaults?: Record<string, { path: string; ts?: number; open?: boolean }> };

  export function listObsidianVaults() {
    const file = join(process.env.APPDATA ?? "", "obsidian", "obsidian.json");
    if (!existsSync(file)) return [];
    const reg = JSON.parse(readFileSync(file, "utf8")) as Reg;
    return Object.entries(reg.vaults ?? {}).map(([id, v]) => ({
      id, path: v.path, name: basename(v.path), open: !!v.open,
      lastOpened: v.ts ? new Date(v.ts) : undefined,
      valid: existsSync(join(v.path, ".obsidian")),
    }));
  }

  export function oneDriveRoots(): string[] {
    const roots = new Set<string>();
    for (const k of ["OneDrive", "OneDriveConsumer", "OneDriveCommercial"]) if (process.env[k]) roots.add(process.env[k]!);
    try {
      const out = execFileSync("reg", ["query", "HKCU\\Software\\Microsoft\\OneDrive\\Accounts", "/s", "/v", "UserFolder"],
                               { encoding: "utf8", windowsHide: true });
      for (const m of out.matchAll(/UserFolder\s+REG_SZ\s+(.+)$/gm)) roots.add(m[1].trim());
    } catch { /* no OneDrive configured */ }
    return [...roots];
  }

  const canon = (p: string) => { try { p = realpathSync.native(p); } catch {} return resolve(p).toLowerCase() + sep; };
  export const isInside = (child: string, root: string) => canon(child).startsWith(canon(root));
  ```
- **Wizard checklist:**
  1. list the vaults and pick one (or create the memory folder);
  2. flag "vault on OneDrive?";
  3. check the pin state via `attrib "<memoryRoot>"` and offer `attrib +P … /S /D`, **with the user's confirmation**;
  4. sample files with `looksDehydrated`;
  5. detect whether `Obsidian.exe` is running and the CLI is on the PATH, i.e., `Obsidian.com` in the install directory (typically `%LOCALAPPDATA%\Programs\Obsidian\`);
  6. register `COMPUTERNAME` in `_devices.md`;
  7. choose the search level (FTS / +local vectors / +remote vectors) and the multilingual model;
  8. set the injection budget;
  9. run a write/rename test and the initial indexing;
  10. generate the dashboard `.base` (optional).

---

## 7. Suggested architecture (draft for discussion)
```text
<Vault>/Agent Memory/            ← configurable memoryRoot (pinned on OneDrive)
  MEMORY.md                      ← curated index: 1 line per memory → injected (budget)
  USER.md                        ← profile → injected
  memories/<type>--<slug>.md     ← 1 memory/topic per file (frontmatter below)
  projects/<slug>/PROJECT.md     ← per-project context (Cline-style templates, read on demand)
  daily/2026/2026-09-23.DESKTOP-AB12.md  ← PER-DEVICE append-only log (today+yesterday injected)
  inbox/                         ← consolidation proposals for human review
  archive/  archive/conflicts/   ← retired entries and conflict copies (never delete)
  _devices.md  _memories.base    ← known devices; Bases dashboard (optional)
%LOCALAPPDATA%\pi-obsidian-memory\
  config.json   index\<vaultId>.sqlite(+wal/shm)   models\   locks\   logs\
```
```yaml
---
id: 01J9Z6X4M8K2Q7N3        # stable ULID: identity ≠ file name
type: feedback               # user | feedback | project | reference | decision | fact
description: Use pnpm, never npm, in the acme monorepo
tags: [pnpm, tooling]
project: acme-api
aliases: [pnpm-only]
created: 2026-09-23T14:02:11-03:00
modified: 2026-09-23T14:02:11-03:00
device: DESKTOP-AB12CD
pinned: false                # true ⇒ always injected (like Letta's system/)
source: session:2026-09-23#abc  # provenance (taint gating)
---
- [decision] Use pnpm workspaces #tooling
- relates_to [[projects/acme-api/PROJECT]]
```
**Tools (few):**
- `memory_search(query, {type, project, since, k})` → IDs + snippets;
- `memory_get(id|path, lines?)`;
- `memory_write(op: add|append|patch, …, expectedSha)`;
- `memory_forget(id)`, which **moves to `archive/`**;
- optional: a `memory_20250818` handler for Claude models.

**Jobs:**
- an indexer with a watcher (1.5 s debounce) + reconciliation at startup;
- a flush on `session_before_compact` with `NO_REPLY`;
- daily or end-of-session consolidation ("dreaming") → `inbox/` + `MEMORY.md` update;
- a conflict and placeholder scanner;
- a security scanner on every write (inherited from pi-hermes-memory);
- vault content **injected as delimited data**, since anyone or any device can edit it.

---

## 8. Not verified or with conflicting information
- Whether basic-memory 0.23.2's semantic default is `true` (docs) or `false` (the README's env-var table).
- Dataview DQL support in `POST /search/` on Local REST API 5.x (not mentioned in the current README).
- Whether the "terminal as Administrator → CLI returns nothing" bug persists in the Obsidian CLI's GA release; "exit code always 0" and "~1 s/op" come from a third-party guide.
- Distribution channel for `aaronsb/obsidian-mcp-plugin` (official vs. BRAT).
- The effect of the temp-then-rename pattern on **version history** in the **official** Windows OneDrive client.
- Whether `attrib +P` on a folder makes new files inherit the pin (there are reports that it does, in Explorer).
- `stat.blocks === 0` may give a false positive for tiny files resident in the MFT.
- `OneDrive*` env vars and OneDrive registry keys: no official documentation found. The `obsidian.json` schema: only forums and tools (an internal file, subject to change).
- Whether OneDrive's exclusion GPOs apply to personal accounts.
- The exact dimension (384) of multilingual-e5-small, and Letta's default block `limit`.
- Legal aspects of the AGPL (not legal advice).

---

## 9. Primary sources
- basic-memory: [GitHub](https://github.com/basicmachines-co/basic-memory) · [LICENSE](https://raw.githubusercontent.com/basicmachines-co/basic-memory/main/LICENSE) · [PyPI](https://pypi.org/project/basic-memory/) · [pyproject](https://raw.githubusercontent.com/basicmachines-co/basic-memory/main/pyproject.toml) · [config_models.py](https://raw.githubusercontent.com/basicmachines-co/basic-memory/main/src/basic_memory/config_models.py) · [Knowledge format](https://docs.basicmemory.com/concepts/knowledge-format) · [MCP tools](https://docs.basicmemory.com/reference/mcp-tools-reference) · [Semantic search](https://docs.basicmemory.com/concepts/semantic-search) · [Configuration](https://docs.basicmemory.com/reference/configuration) · [Obsidian](https://docs.basicmemory.com/integrations/obsidian) · [.bmignore issue #1539](https://github.com/basicmachines-co/basic-memory/issues/1539) · [akitaonrails analysis](https://github.com/akitaonrails/ai-memory/blob/main/docs/research-basic-memory.md)
- Obsidian: [CLI help](https://obsidian.md/help/cli) · [Changelog](https://obsidian.md/changelog/) · [1.12 changelog](https://obsidian.md/changelog/2026-02-27-desktop-v1.12.4/) · [Sync notes (OneDrive)](https://obsidian.md/help/sync-notes) · [Data storage](https://obsidian.md/help/data-storage) · [Vault API](https://docs.obsidian.md/Plugins/Vault) · [Headless](https://obsidian.md/help/headless) · [Free for work](https://obsidian.md/blog/free-for-work/) · [Forum: obsidian.json](https://forum.obsidian.md/t/obsdian-json-automatic-vault-configuration/32700) · [Forum: Files On-Demand](https://forum.obsidian.md/t/onedrive-cloud-saved-files-are-forcly-downloaded-by-obsidian/12885) · [Forum: indexing OneDrive](https://forum.obsidian.md/t/obsidian-is-indexing-your-vault-onedrive/78418) · [Forum: modified externally](https://forum.obsidian.md/t/has-been-modified-externally-merging-changes-automatically/111594) · [Forum: external renames](https://forum.obsidian.md/t/fr-detect-renames-made-outside-of-obsidian/92140) · [CLI guide (dsebastien)](https://www.dsebastien.net/the-complete-guide-to-the-obsidian-cli-everything-you-can-do-from-the-terminal/) · [CLI on Windows (zenn)](https://zenn.dev/sora_biz/articles/obsidian-cli-setup-guide?locale=en) · [notesmd-cli](https://github.com/Yakitrak/notesmd-cli)
- Integrations: [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) · [releases](https://github.com/coddingtonbear/obsidian-local-rest-api/releases) · [mcp-obsidian](https://github.com/MarkusPfundstein/mcp-obsidian) · [cyanheads](https://github.com/cyanheads/obsidian-mcp-server) · [mcpvault](https://github.com/bitbonsai/mcpvault) · [aaronsb plugin](https://github.com/aaronsb/obsidian-mcp-plugin) · [ChatForest review](https://chatforest.com/reviews/obsidian-mcp-servers/) · [ContextBolt](https://contextbolt.com/blog/obsidian-mcp-claude/) · [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills) · [Smart Connections](https://github.com/brianpetro/obsidian-smart-connections) · [smart-connections-mcp](https://github.com/msdanyg/smart-connections-mcp) · [Omnisearch](https://github.com/scambier/obsidian-omnisearch) · [Omnisearch API](https://publish.obsidian.md/omnisearch/Public+API+%26+URL+Scheme)
- Memory: [OpenClaw memory](https://docs.openclaw.ai/concepts/memory) · [builtin engine](https://docs.openclaw.ai/concepts/memory-builtin) · [memory-search.ts](https://github.com/openclaw/openclaw/blob/main/src/agents/memory-search.ts) · [memory flush](https://docs.openclaw.ai/reference/session-management-compaction/housekeeping) · [MMNTM walkthrough](https://www.mmntm.net/articles/openclaw-memory-architecture) · [Anthropic memory tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool) · [Claude Code memory](https://code.claude.com/docs/en/memory) · [Letta memory blocks](https://docs.letta.com/guides/agents/memory-blocks) · [Letta MemFS](https://docs.letta.com/concepts/memfs) · [Context Repositories](https://www.letta.com/blog/context-repositories/) · [Letta Filesystem (deprecated)](https://docs.letta.com/v1-sdk/concepts/filesystem) · [Cline Memory Bank](https://docs.cline.bot/prompting/cline-memory-bank) · [claude-mem](https://github.com/thedotmack/claude-mem) · [claude-mem DB](https://docs.claude-mem.ai/architecture/database) · [mem0 v3 migration](https://docs.mem0.ai/migration/platform-v2-to-v3) · [Hermes memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory) · [pi-hermes-memory](https://pi.dev/packages/pi-hermes-memory) · [pi extensions](https://pi.dev/docs/latest/extensions) · [qmd](https://github.com/tobi/qmd)
- Search/Node: [node:sqlite v26](https://nodejs.org/api/sqlite.html) · [node:sqlite v24](https://nodejs.org/docs/latest-v24.x/api/sqlite.html) · [sqlite.gyp (FTS5)](https://github.com/nodejs/node/blob/main/deps/sqlite/sqlite.gyp) · [better-sqlite3 releases](https://github.com/WiseLibs/better-sqlite3/releases) · [sqlite-vec](https://github.com/asg017/sqlite-vec) · [sqlite-vec JS](https://alexgarcia.xyz/sqlite-vec/js.html) · [sqlite-vec KNN](https://alexgarcia.xyz/sqlite-vec/features/knn.html) · [hybrid search (RRF)](https://alexgarcia.xyz/blog/2024/sqlite-vec-hybrid-search/index.html) · [FTS5](https://sqlite.org/fts5.html) · [How to corrupt SQLite](https://sqlite.org/howtocorrupt.html) · [transformers.js v4](https://huggingface.co/blog/transformersjs-v4) · [transformers.js env](https://huggingface.co/docs/transformers.js/api/env) · [EmbeddingGemma ONNX](https://huggingface.co/onnx-community/embeddinggemma-300m-ONNX) · [multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small) · [Orama](https://github.com/oramasearch/orama) · npm registry (`sqlite-vec`, `better-sqlite3`, `@huggingface/transformers`, `@orama/orama`, `minisearch`, `flexsearch`, `chokidar`, `@vscode/ripgrep`, `onnxruntime-node`, `node-llama-cpp`, `@tobilu/qmd`) · [write-file-atomic #227](https://github.com/npm/write-file-atomic/issues/227) · [libuv win/fs.c](https://github.com/libuv/libuv/blob/v1.x/src/win/fs.c) · [Node release schedule](https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule)
- Microsoft/OneDrive: [Files On-Demand states (attrib)](https://learn.microsoft.com/en-us/sharepoint/files-on-demand-windows) · [Files On-Demand (default)](https://support.microsoft.com/en-us/office/save-disk-space-with-onedrive-files-on-demand-for-windows-0e6860d3-d9f3-4971-b321-7092438fb38e) · [Cloud Files API / placeholders](https://learn.microsoft.com/en-us/windows/win32/cfapi/build-a-cloud-file-sync-engine) · [Conflicts (Report-JOHNS-SURFACE)](https://learn.microsoft.com/en-us/troubleshoot/sharepoint/sync/troubleshoot-sync-issues) · [Restrictions and limitations](https://support.microsoft.com/en-us/office/restrictions-and-limitations-in-onedrive-and-sharepoint-64883a5d-228e-48f5-b3d2-eb39e07630fa) · [Path length](https://support.microsoft.com/en-us/onedrive/what-are-file-path-length-limits) · [Storage Sense](https://support.microsoft.com/en-us/windows/experience/storage-filemanagement/manage-drive-space-with-storage-sense) · [GPOs (ignore list, .tmp/.ini)](https://learn.microsoft.com/en-us/sharepoint/use-group-policy) · [Pause/resume sync](https://support.microsoft.com/en-us/onedrive/how-to-pause-and-resume-onedrive-sync) · [OneDrive* env vars (UWaterloo KB)](https://uwaterloo.atlassian.net/wiki/spaces/ISTKB/pages/43450564838/Using+OneDrive+in+place+of+Mapped+Drives) · [claude-code#62140](https://github.com/anthropics/claude-code/issues/62140) · [hermes-agent#97898](https://github.com/NousResearch/hermes-agent/issues/97898) · [abraunegg atomic saves](https://github.com/abraunegg/onedrive/blob/master/docs/usage.md) · [git on OneDrive (Tech Community)](https://techcommunity.microsoft.com/discussions/onedriveforbusiness/onedrive-is-corrupting-my-git-repositories/3898283)
