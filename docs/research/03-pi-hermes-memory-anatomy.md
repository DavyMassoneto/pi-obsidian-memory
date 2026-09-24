# 03 — Anatomy of pi-hermes-memory (the base we want to reuse)

> A reading of the `chandra447/pi-hermes-memory` **v0.9.9** (2026-09-13) and pi **v0.87.1** (2026-09-22) source code, done on 2026-09-23 via the web, without installing or running anything.
> File-by-file map, excerpts with line numbers, relevant issues and sources: [appendix C](appendices/C-pi-hermes-memory.md).

## Fact sheet

| Item | Value |
|---|---|
| License | **MIT** (© 2025 Chandra Teja). It's a port of Hermes Agent, also MIT (© 2025 Nous Research). **Code can be reused, as long as both copyright notices are kept.** |
| Popularity | ~456★, ~21,600 downloads/month on npm, more than 50 versions since Apr/2026, active upstream |
| Runtime | pi extension in TypeScript loaded via jiti; `better-sqlite3` **native**; tests with `node:test` (the description mentions 732) |
| CI | **Ubuntu only**, no CI on Windows |
| Platform | pi is now `@earendil-works/pi-coding-agent` (repository `earendil-works/pi`, MIT, ~108k★); the old `badlogic/pi-mono` redirects there |

## How it works today

```text
~/.pi/agent/
├── hermes-memory-config.json            ← config (read once; if invalid, falls back to defaults WITHOUT warning)
├── pi-hermes-memory/                    ← global memory
│   ├── MEMORY.md   USER.md   failures.md   STANDING.md
│   ├── skills/<slug>/SKILL.md
│   ├── sessions.db (+ -wal, -shm)       ← SQLite: search mirror (FTS5 trigram) + session index
│   └── .tmp-*/  .MEMORY.md.recovery-*   ← atomic writes and recovery snapshots (up to 32 / 64 MiB)
├── projects-memory/<repo-name>/MEMORY.md   ← per-project memory (name = basename of the git root)
└── .pi-hermes-locks.sqlite              ← cross-process lock, written in the PARENT of the memory folder
```

```md
<!-- MEMORY.md — format (illustrative): one entry per block, separated by "\n§\n" -->
Project uses pnpm, not npm <!-- created=2026-09-01, last=2026-09-20 -->
§
CI requires --frozen-lockfile <!-- created=2026-09-02, last=2026-09-02 -->
```

Markdown is the source of truth and SQLite is a derived index. This principle **is worth keeping**.

### Tools exposed to the model

| Tool | What it does |
|---|---|
| `memory_add` | `target` ∈ {memory, user, project, failure}; security scanner; exact dedupe |
| `memory_replace` / `memory_remove` | Finds the entry by **substring** (`old_text`) and requires exactly 1 match |
| `memory_search` | FTS5 trigram + bm25; stop-words **English only** |
| `session_search` | Searches pi's session history (JSONL indexed in SQLite) |
| `skill_manage` | CRUD for `SKILL.md` (global or per-project) |

### How memory enters the prompt

```ts
// src/index.ts (≈L217) — runs on every user prompt
pi.on("before_agent_start", async (event) => {
  const ctx = await buildPromptContext(config, store, projectStoreRef(), projectNameRef(), standingStore);
  if (ctx) return { systemPrompt: event.systemPrompt + "\n\n" + ctx };
});
```

- **`policy-only` (default since v0.7):** injects **instructions only**, no memory content. The model has to call `memory_search`. It's stable and prompt-cache-friendly.
- **`legacy-inject`:** injects a snapshot of `MEMORY.md`/`USER.md`, the project block, and recent failures, as in the original Hermes.
- **`STANDING.md`:** rules pinned by you with `/memory-pin`, always injected; limit of 20 entries / 2,000 chars.

### What saves memory automatically

| Mechanism | When it triggers | How |
|---|---|---|
| **Background review** | Every 10 turns or 15 tool calls (with at least 3 messages from you) | Calls the LLM, which returns JSON `{"operations":[…]}`; the package applies the operations |
| **Correction detector** | Phrases like "don't do that" or "actually, use…" | Regex **English only** → LLM → saves |
| **Flush** | Before compaction (waits up to 60 s) and at shutdown (up to 10 s) | — |
| **Content scanner** | Every write | Blocks prompt injection, invisible unicode, and secrets (`sk-…`, `ghp_…`, private keys…) |

## "Its limit": what it actually is

| Limit | Value | Enforced? |
|---|---|---|
| MEMORY / USER / project | 5,000 chars each (failures: 10,000) | **Only in `legacy-inject`.** In `policy-only` (default), `capEnforced = false` since #218: writes go through, and the "NN% used" is purely informational |
| STANDING.md | 20 entries / 2,000 chars | Yes (constant in the code) |
| Search | up to 20 results; snippets up to 4,000 chars | Yes, per call |

**Conclusion:** in the default mode, the **storage** limit barely exists anymore. The real limit is different: **how much of the memory reaches the model**. In `policy-only`, only what the search returns gets through, and the search is lexical and tuned for English.

Removing limits, therefore, is mostly about **improving retrieval**:
- search that understands Brazilian Portuguese;
- an "active recall" with a token budget;
- stable IDs;
- consolidation.

Deleting constants is the small part.

## What breaks if we just point `memoryDir` at the vault

Today you can configure `"memoryDir": "C:/Users/<you>/OneDrive/<Vault>/Agent Memory"`. **Not recommended.** This would bring into OneDrive:

- `sessions.db` with WAL/SHM. SQLite inside a synced folder **corrupts**, according to SQLite's own documentation;
- `.pi-hermes-locks.sqlite` in the **vault root** (the parent folder);
- `.tmp-*`, `.recovery-*` (full copies of the file), and **hard links** (`fs.link`), which interact poorly with OneDrive placeholders and locks. Only `ENOENT`/`EEXIST` are handled; `EPERM`/`EBUSY` become errors.

In addition:
- **per-project** memory can't move out of `~/.pi/agent` without changing code, because `projectsMemoryDir` only accepts a single segment under `AGENT_ROOT`;
- OneDrive **conflict copies** (`MEMORY-DESKTOP-XXXX.md`) would be silently ignored.

## Cut points (seams)

**There's no storage interface.** `MemoryStore`, `SkillStore`, `StandingInstructions`, and `DatabaseManager` use `node:fs`/`better-sqlite3` directly. The `MemoryBackend`/`MemoryOrchestrator` planned in the ROADMAP (v0.5) was never implemented.

The natural seam is to separate the **logic over `entries[]`** from **persistence**:

```ts
// SKETCH (not project code): the missing interface
interface MemoryBackend {
  read(scope: Scope): Promise<{ entries: Entry[]; fingerprint: string }>;
  write(scope: Scope, next: Entry[], expectedFingerprint: string): Promise<void>; // CONFLICT if changed
  list(): Promise<Scope[]>;                    // global, user, project X, …
  watch?(onChange: (s: Scope) => void): () => void;
}
// Today: all of this is inside MemoryStore (loadFromDisk/readFileState/saveToDisk/prune…)
// After: FileBackend (current)  +  ObsidianVaultBackend (new)
```

Files that need to change for each goal (per-function detail in appendix C, §2.14):

| Goal | Files |
|---|---|
| **Vault(s) on OneDrive** | `config.ts`, `types.ts`, `paths.ts`, `project.ts`, `index.ts`, `store/memory-store.ts`, `store/markdown-mutation-lock.ts`, `store/db.ts`, `handlers/sync-markdown-memories.ts`, `store/sqlite-memory-store.ts`, migrations |
| **No limits** | `memory-store.ts` (`charLimit`, `capEnforced`, `fifoEvictAndAdd`, `addWithConsolidation`), `index.ts` (consolidator), config (limit keys). Careful: `memoryCharLimit: 0` **blocks everything**; "unlimited" needs an explicit `null` |
| **Configurable + onboarding** | `config.ts` rewritten (versioned TypeBox schema, visible errors, atomic writer); new setup command with `ctx.ui.select/input/confirm` + `ctx.reload()`; configurable prompts (issue #229) |
| **Windows** | Lock probe opens PowerShell on load (~515 ms, #245/#247); likely bug in `header.cwd.split('/')` in `session-indexer.ts` (inferred); no Windows CI |

## The platform: what pi offers the new project

```ts
// Extension skeleton (real pi APIs; logic is a sketch)
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_e, ctx) => { /* open local index; if there's no config → ctx.ui.notify("/memory-setup") */ });
  pi.on("before_agent_start", (e) => { e.systemPromptOptions.sections.memory_policy = POLICY; }); // stable → cache
  pi.on("context", async (e) => { /* per-turn active recall WITHOUT touching the system prompt */ });
  pi.on("session_before_compact", async () => { /* flush: write out whatever is durable before compacting */ });
  pi.on("session_shutdown", async () => { /* close index (idempotent) */ });
  pi.registerTool(memoryAddTool);                 // schema TypeBox; result { content, details }
  pi.registerCommand("memory-setup", { handler: async (_a, ctx) => {
    const vault = await ctx.ui.select("Vault", detectedVaults);   // + input, confirm, editor, custom
    /* validate, write config atomically */ await ctx.reload();    // applies without restarting pi
  }});
}
```

- **Useful events:** `session_start`, `before_agent_start` (mutate sections), **`context`** (transform messages only for that request, without invalidating the system prompt cache), `session_before_compact`, `turn_end`, `tool_call` (block or alter calls), `session_shutdown`, `resources_discover` (expose skill folders).
- **pi's rule:** don't open watchers, DBs, or timers in the extension factory. Do that in `session_start` and close it in `session_shutdown`.
- **UI:** `ctx.hasUI` indicates whether dialogs are available (TUI/RPC). There are official examples `question.ts` and `questionnaire.ts`, which serve as a base for the wizard.

## pi packages that have already tried something similar

| Package | Why look at it |
|---|---|
| **@tenchi4u/pi-obsidian-memory** (MIT) | Memory in the vault (`$OBSIDIAN_PATH/pi/`), Windows notes, "stable" vs "per-turn" snapshot with a ~16K char budget. **The closest reference** |
| **@pify/memory** (MIT) | FTS5 via built-in **`node:sqlite`**, no native module, which avoids the pain of `better-sqlite3` on Windows |
| **@zosmaai/pi-llm-wiki** (MIT) | LLM-maintained wiki in an Obsidian-compatible vault (cited in issue #229) |
| **pi-memory** (jayzeng), **common-memory-core** | Daily logs + qmd; "user" Markdown memory |
| **@bacnh85/pi-obsidian** (MIT) | Vault access via Obsidian CLI |
| @sfroment/pi-obsidian | ⚠️ **GPL-3.0**: do not incorporate into MIT code |

Upstream issues and PRs that show demand for the same path:
- **#229:** customizable review instructions to cooperate with an Obsidian vault;
- **#216:** active recall at session start;
- **#175:** semantic search via qmd.

## Three reuse paths

| Path | Pros | Cons |
|---|---|---|
| **1. Fork + refactor** (extract `MemoryBackend`, create a vault backend) | Inherits tests, review, correction, flush, scanner, search, and skills | Large, coupled code; upstream is active, so the fork diverges fast; carries legacy baggage (migrations, hard links, recovery) |
| **2. New "Obsidian-first" package reusing modules** (scanner, fts-query, review protocol, prompts, session-indexer) | Clean design: one note per memory, stable IDs, local index; no legacy | More work; loses the ready-made integration |
| **3. Contribute upstream** (backend interface + configurable prompts) and publish the vault backend as a package | Benefits both sides; demand already exists (#229) | Depends on the maintainer's acceptance and timeline |

The recommendation and the module-by-module map are in [05-reuse-proposal.md](05-reuse-proposal.md).
