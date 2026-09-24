# Research C: pi coding agent and pi-hermes-memory

> Basis for a new package that **reuses pi-hermes-memory**, but writes memory to **Obsidian vaults inside OneDrive (Windows)**, with **no size limits**, with **everything configurable**, and an **onboarding/configuration flow**.

- **Research date:** 2026-09-23
- **Method:** reading code and docs via WebFetch (raw.githubusercontent.com, api.github.com, registry.npmjs.org, pi.dev, official docs). Nothing was cloned, installed, or run.
- **Snapshots read:**
  - `chandra447/pi-hermes-memory`, branch `main` = commit `71ce9f0` ("chore: bump version to 0.9.9 (#240)", 2026-09-13), i.e. **v0.9.9**
  - `earendil-works/pi`, branch `main` (latest release **v0.87.1**, published 2026-09-22T19:43Z)
  - `NousResearch/hermes-agent`, branch `main` (last push on 2026-09-23)
- **Conventions:**
  - `≈L123` indicates an **approximate** line number. The extractor sometimes misaligns numbering, so use the function or constant name as an anchor.
  - Code snippets are short and come from MIT-licensed repositories; attribution is in the links.
  - Items marked **(unverified)** were not confirmed against a primary source.

---

## 0. Executive summary

| Topic | Finding |
|---|---|
| Platform | pi is now `@earendil-works/pi-coding-agent` (CLI `pi`), in the `earendil-works/pi` monorepo. The old `badlogic/pi-mono` redirects there. MIT license. Current version: 0.87.1. |
| Base package license | **MIT**, "Copyright (c) 2025 Chandra Teja". It is a port of Hermes Agent, which is also **MIT** ("Copyright (c) 2025 Nous Research"). Reuse is free as long as the copyright and license notices are preserved. |
| Where it writes | Global memory in `~/.pi/agent/pi-hermes-memory/` (`MEMORY.md`, `USER.md`, `failures.md`, `STANDING.md`, `skills/`, `sessions.db`). Per-project memory in `~/.pi/agent/projects-memory/<project>/`. Config in `~/.pi/agent/hermes-memory-config.json`. |
| Format | One Markdown file per "target", with entries separated by `"\n§\n"`. Each entry carries metadata in an HTML comment: `<!-- created=…, last=…, project64=… -->`. SQLite (FTS5 trigram) is a search **mirror**; Markdown is the source of truth. |
| Limits | The default is 5,000 characters for memory, user, and project, and double that for failure. In the default `policy-only` mode these limits **are no longer applied** to writes (`capEnforced = memoryMode !== "policy-only"`, since #218). They still apply in `legacy-inject` mode. `STANDING.md` has a fixed limit of 20 entries / 2,000 characters. |
| Tools | `memory_add`, `memory_replace`, `memory_remove` (targets `memory`, `user`, `project`, `failure`), `memory_search` (SQLite FTS5), `session_search` (FTS5 "legacy" variant, or "anchors" over JSONL), and `skill_manage`. |
| Injection | In `before_agent_start` (on every user prompt) the package concatenates onto the system prompt. **`policy-only` default:** only a *policy* text, with no memory content, and the model must call `memory_search`. **`legacy-inject`:** a "frozen" snapshot of MEMORY/USER, plus a project block and recent failures. The *standing instructions* are always included. |
| Seams | **There is no storage interface/adapter.** `MemoryStore`, `SkillStore`, `StandingInstructions`, and `DatabaseManager` are concrete classes that use `node:fs` and `better-sqlite3` directly. Paths come from `paths.ts`, `project.ts`, and `index.ts`. The `MemoryBackend`/`MemoryOrchestrator` from the ROADMAP (v0.5) was **never implemented**. |
| OneDrive pitfalls | If `memoryDir` points to OneDrive, the following go along with it: `sessions.db` (WAL), `.tmp-*`, `.recovery-*`, hard links (`fs.link`), **and** `.pi-hermes-locks.sqlite`, which is written to the **parent** folder of the memory directory. There is no way to point `projectsMemoryDir` outside `~/.pi/agent` without changing code. |
| Onboarding | Today only `/memory-interview` exists, which sends a prompt to the LLM to fill in `USER.md`. There is no configuration wizard. pi offers `ctx.ui.select/input/confirm/editor/custom` and `ctx.reload()`, which are enough to build one. |

---

## Part 1: the pi coding agent (platform)

### 1.1 What pi is (identity and versions)

- **Current npm package:** `@earendil-works/pi-coding-agent` ("Coding agent CLI with read, bash, edit, write tools and session management"). The binary is `pi` (`dist/cli.js`).
  - dist-tags: `latest` = **0.87.1**, `legacy-node20` = 0.74.2.
  - First version with the new scope: 0.74.0.
  - Source: https://registry.npmjs.org/@earendil-works/pi-coding-agent
- **Recent releases** (https://api.github.com/repos/earendil-works/pi/releases):
  - v0.87.1: 2026-09-22
  - v0.87.0: 2026-09-21
  - v0.86.1: 2026-09-20
  - v0.86.0: 2026-09-19
  - v0.85.1: 2026-09-05
- **Repository:** https://github.com/earendil-works/pi. Querying `api.github.com/repos/badlogic/pi-mono` returns `earendil-works/pi`, i.e., a redirect.
  - "AI agent toolkit: unified LLM API, agent loop, TUI, coding agent CLI". MIT, about 108.6k stars.
- **Authorship:** created by Mario Zechner (`badlogic`). npm maintainers: `badlogic`, `mitsuhiko` (Armin Ronacher), and `rwachtler`.
  - The transfer to Earendil Works and the rename `@mariozechner/*` → `@earendil-works/*` starting from 0.74.0 happened in May 2026 according to Wikipedia **(date not verified against a primary source)**.
- **Pitch** (https://pi.dev):
  - Minimal, extensible harness: extensions, skills, prompt templates, themes, and packages.
  - More than 15 providers via `@earendil-works/pi-ai`.
  - Tree-structured session history, with branching.
  - Automatic compaction.
  - Modes: interactive (TUI), print/JSON, RPC, and SDK.
- **Deliberate core omissions** (pi.dev): no MCP, no sub-agents, no plan mode, no permission popups, no built-in to-dos, no background bash. All of that is left to extensions and packages, which explains the large ecosystem in Part 4.
- **Installation:** `curl -fsSL https://pi.dev/install.sh | sh` or `npm install -g --ignore-scripts @earendil-works/pi-coding-agent`.

### 1.2 Packages (`pi install`, manifest, conventions)

Source: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md

- **Definition:** a package is a plain directory or an npm package. It can contain **extensions, skills, prompt templates, and themes**, either through conventional directories or through explicit declaration in `package.json` (the `pi` key). It can have its own runtime dependencies.
- **Installation:**
  ```bash
  pi install npm:@example/pi-tools@1.0.0      # npm version (pinned)
  pi install git:github.com/example/pi-tools@v1 # git tag/commit (pinned)
  pi install ./local-package                   # local path
  pi install -l npm:...                        # project scope → .pi/settings.json
  pi -e ./my-extension.ts                    # loads only for this run (no install)
  ```
  - The default scope is the user's, stored in `~/.pi/agent/settings.json` (the `packages` key).
  - Other commands: `pi list`, `pi remove <source>`, `pi update --extensions`, `pi config` (enable/disable resources).
- **Where it lives on disk** (`src/core/package-manager.ts`, ≈L2330 and ≈L2360):
  - npm, user: `<agentDir>/npm/node_modules/<name>`
  - npm, project: `<cwd>/.pi/npm/node_modules/<name>`
  - git, user: `<agentDir>/git`
  - git, project: `<cwd>/.pi/git`
  - The `npm install` for git packages does **not** use `--ignore-scripts`, so install scripts do run. This matters for native dependencies like `better-sqlite3`.
- **Manifest** (example from the docs):
  ```json
  {
    "name": "my-pi-package",
    "keywords": ["pi-package"],
    "pi": {
      "extensions": ["./src/extension.ts"],
      "skills": ["./resources/skills"],
      "prompts": ["./resources/prompts/*.md"],
      "themes": ["./resources/themes/*.json"]
    }
  }
  ```
  - The `pi-package` keyword makes the package eligible for the https://pi.dev/packages gallery.
  - The optional fields `pi.image` and `pi.video` serve as a preview.
  - Without a manifest, pi discovers the `extensions/`, `skills/`, `prompts/`, and `themes/` directories.
- **Dependencies:**
  - pi packages must declare `peerDependencies` with range `"*"` and must **not** be bundled: `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`, `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, and `typebox`.
  - Note: pi-hermes-memory uses `>=0.80.6` in its peers and puts `@earendil-works/pi-tui` in `dependencies`, which diverges from the recommendation.
- **Settings filter:** the entry in `packages` can be an object `{ source, extensions: [...], skills: [], prompts: [...] }`. Omitting a key loads everything, `[]` loads nothing, and `!pattern` excludes.
- **Trust:** project packages are only installed and loaded once *project trust* is resolved. Context files (AGENTS.md) do not require trust.
- **Gallery:** on 2026-09-23, https://pi.dev/packages listed **5,723 packages** pulled from npm by keyword, with filtering by type and sorting by downloads, date, or name.

### 1.3 Extension API (TypeScript)

Sources:
- https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md
- https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts

#### Definition and loading

- An extension is a module with `export default function (pi: ExtensionAPI)`, sync or async. pi awaits async factories.
- **Loading:**
  - from `~/.pi/agent/extensions/` and `.pi/extensions/` (direct `.ts`/`.js` files, or subfolders with `index.ts`/`index.js`);
  - from paths declared in settings (`extensions`);
  - from packages;
  - via `pi --extension ./x.ts`.
- TypeScript is loaded with **jiti**, with no build step.
- **Lifecycle rule:** do **not** start processes, sockets, watchers, or timers in the factory, because some invocations load extensions without a session. Start resources in `session_start` (or in the tool/command that needs them) and close them in an idempotent `session_shutdown`.

Minimal example from the docs (extensions.md):
```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("hello", {
    description: "Show a greeting",
    handler: async (name, ctx) => {
      ctx.ui.notify(`Hello, ${name || "world"}!`, "info");
    },
  });
}
```

#### Integration points (table from the docs)

| Capability | API |
|---|---|
| Observe or modify the lifecycle | `pi.on()`. Returns an unsubscribe function. |
| Tool callable by the model | `pi.registerTool()` |
| `/` command | `pi.registerCommand()` |
| CLI shortcut or flag | `pi.registerShortcut()`, `pi.registerFlag()` / `pi.getFlag()` |
| Messages | `pi.sendUserMessage()`, `pi.sendMessage()` (custom message, `deliverAs: steer / followUp / nextTurn`) |
| Session data outside the model's context | `pi.appendEntry()` |
| Active tools, model, and thinking | `pi.setActiveTools()`, `pi.getActiveTools()`, `pi.setModel()`, `pi.setThinkingLevel()` |
| Model provider | `pi.registerProvider()` |
| External process | `pi.exec(cmd, args, opts)` |
| Communication between extensions | `pi.events` |

#### Events (`pi.on`), extracted from `types.ts`

| Group | Events, and what the handler can return |
|---|---|
| Resources and trust | `project_trust`; `resources_discover` returns `{ skillPaths?, promptPaths?, themePaths? }` |
| Session | `session_start` (reason: `startup / reload / new / resume / fork`), `session_info_changed`, `session_before_switch`, `session_before_fork`, `session_before_compact` (can return `{ cancel }` or provide `compaction`), `session_compact`, `session_compact_failed`, `session_before_tree`, `session_tree`, `session_shutdown` (reason: `quit / reload / new / resume / fork`) |
| Context and provider | `context` and `context_with_system` (return `{ messages }`, a transformation valid only for that request), `before_provider_request`, `before_provider_headers`, `after_provider_response` |
| Agent | `before_agent_start` (returns `{ systemPrompt?, message? }`), `agent_start`, `agent_end`, `agent_before_settle` (can chain entries and `continue: true`), `agent_settled` |
| Turn and messages | `turn_start`, `turn_end` (same as `agent_before_settle`), `message_start`, `message_update`, `message_end` (can replace the finalized message) |
| Tools | `tool_call` (can mutate input or block), `tool_result` (chained composition), `tool_execution_start / update / end` |
| Other | `input` (returns `continue / transform / handled`), `user_bash`, `model_select`, `thinking_level_select`, `ui_prompt_start / end`, `cache_warming_decision` |

- **Concurrency:** handlers run in load and registration order. pi-hermes-memory relies on this: the `session_shutdown` handler that closes the DB is registered last. Tool calls from the same message can run in parallel.
- **Errors:** pi reports the handler's error and continues. A failure in a `tool_call` handler blocks the tool (fail-safe).

#### Registering tools (schema format)

- Parameters use a **TypeBox** schema.
- The result needs `content` (visible to the model) and `details` (for rendering and state reconstruction).
- `throw` produces an error result. `executionMode: "sequential"` is for shared mutable state.
- For tools that mutate files, the docs recommend `withFileMutationQueue()`.

Official example (`examples/extensions/hello.ts`, https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/hello.ts):
```ts
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const helloTool = defineTool({
  name: "hello",
  label: "Hello",
  description: "A simple greeting tool",
  parameters: Type.Object({ name: Type.String({ description: "Name to greet" }) }),
  async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
    return { content: [{ type: "text", text: `Hello, ${params.name}!` }], details: { greeted: params.name } };
  },
});
export default function (pi: ExtensionAPI) { pi.registerTool(helloTool); }
```

`ToolDefinition` fields (types.ts):
- `name`, `label`, `description`
- `promptSnippet?` and `promptGuidelines?`, which pi injects into the system prompt
- `parameters`, `prepareArguments?`, `executionMode?`
- `execute(toolCallId, params, signal, onUpdate, ctx)`
- `renderCall?` and `renderResult?`, with pi-tui components

#### Slash commands

`pi.registerCommand(name, { description?, getArgumentCompletions?, handler(args: string, ctx: ExtensionCommandContext) })`.

`ExtensionCommandContext` adds operations that can **only** be called from inside commands, at risk of deadlock if called in lifecycle handlers:
- `waitForIdle()`
- `reload()`
- `newSession()`, `fork()`, `navigateTree()`, `switchSession()`
- `getSystemPromptOptions()`

#### Injecting or modifying the system prompt and context

- **`before_agent_start`** receives `prompt`, `systemPrompt` (rendered), and `systemPromptOptions` (structured, with `sections: Record<string,string>`, `contextFiles`, `skills`, `selectedTools`, `appendSystemPrompt`…).
  - The docs **prefer mutating sections**. Returning `{ systemPrompt }` (or using `forceSystemPrompt`) **replaces the entire prompt for that run**.
  - The result also accepts `{ message }`, which injects a custom message.
- Official example with sections (`examples/extensions/prompt-customizer.ts`, https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/prompt-customizer.ts):
  ```ts
  pi.on("before_agent_start", (event) => {
    const guidance = buildToolGuidance(event.systemPromptOptions);
    if (guidance) event.systemPromptOptions.sections.tool_guidance = guidance;
    else delete event.systemPromptOptions.sections.tool_guidance;
  });
  ```
- **Default prompt section order** (`src/core/system-prompt.ts`):
  1. `preamble`
  2. `tools`
  3. `rules`
  4. `docs`
  5. `addendum`
  6. `project_context`: AGENTS.md rendered as `<project_instructions path="…">…</project_instructions>`
  7. `skills`: name, description, and path; included only if there is a `read`/`bash` tool
  8. `cwd`
- **`context`:** transforms the request's messages without touching the system prompt, and pi restores the state afterward. It's the natural point for **per-turn retrieval** without invalidating the system prompt's prefix cache.
- **Cache:** changes to tools or the prompt mid-session become deltas in the transcript. Providers that can't represent them receive a full checkpoint, which can invalidate the cached prefix.

#### UI for interactive prompts (onboarding)

`ExtensionUIContext` (types.ts):
```ts
select(title: string, options: string[], opts?): Promise<string | undefined>;
confirm(title: string, message: string, opts?): Promise<boolean>;
input(title: string, placeholder?: string, opts?): Promise<string | undefined>;
editor(title: string, prefill?: string): Promise<string | undefined>;
notify(message: string, type?: "info" | "warning" | "error"): void;
setStatus(key, text); setWidget(key, lines, opts); setTitle(t); setWorkingMessage(m);
custom<T>(factory: (tui, theme, keybindings, done) => Component, options?): Promise<T>;
setEditorText(t); getEditorText(); pasteToEditor(t); /* + themes, footer/header, autocomplete */
```

- **Modes:**
  - In **interactive** mode (TUI) everything works.
  - In **RPC**, dialogs and notifications are forwarded to the client, but **not** custom components.
  - **JSON/print** have no UI.
- **Guards:** use `ctx.hasUI` for dialogs (interactive and RPC) and `ctx.mode === "tui"` for `ctx.ui.custom()`.
- **Useful official examples:**
  - `question.ts`: select with a free-text option, built with `ctx.ui.custom` and pi-tui's `Editor`
  - `questionnaire.ts`: `questionnaire` tool with multiple questions and tabs
  - `qna.ts`, `send-user-message.ts`
  - All at https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions
- pi-hermes-memory itself uses `ctx.ui.select` in `/learn-memory-tool` (≈L12):
  ```ts
  const section = await ctx.ui.select("Pi Hermes Memory Guide", ["📦 What Gets Saved", "🔧 Tools Available", /* … */], {});
  if (!section) return;
  ```

#### ExtensionContext (every handler and tool)

- `cwd`, `mode`, `hasUI`, `ui`
- `sessionManager` (read-only; `getBranch()`, `getSessionFile()`…)
- `modelRegistry`, `model`, `signal`
- `isIdle()`, `abort()`, `shutdown()`, `compact()`, `getContextUsage()`, `getSystemPrompt()`
- For nested model calls, the docs suggest `ctx.modelRegistry.streamSimple()`.

#### Where settings and state live

Agent directory: `~/.pi/agent`, overridden by `PI_CODING_AGENT_DIR`. Source: `docs/configuration.md`.

| Path | Content |
|---|---|
| `settings.json` | user settings, `packages`, `extensions`, `skills`, `prompts`, `themes`, `enableSkillCommands`, `sessionDir`… |
| `auth.json`, `models.json`, `keybindings.json` | credentials, models, and shortcuts |
| `AGENTS.md` (or `AGENTS.override.md` / `CLAUDE.md`) | the user's global instructions |
| `SYSTEM.md` / `APPEND_SYSTEM.md` | replaces / appends to the system prompt |
| `extensions/`, `skills/`, `prompts/`, `themes/` | user resources |
| `npm/`, `git/` | installed packages |
| `sessions/` | JSONL sessions (id/parentId tree), grouped by cwd. Overridden by `--session-dir`, `PI_CODING_AGENT_SESSION_DIR`, or `sessionDir`. |

In the project, `.pi/` contains `settings.json`, `SYSTEM.md`, `APPEND_SYSTEM.md`, `extensions/`, `skills/`, `prompts/`, and `themes/`. Project settings override the user's, and resource lists are combined.

**Extension state:**

| State type | Where to store it |
|---|---|
| State that follows the active branch | the tool result's `details` |
| Durable data outside the model's context | `pi.appendEntry()` |
| Content that goes to the model | `pi.sendMessage()` |
| Data across sessions | **external storage** (this is what pi-hermes-memory does) |

#### Discovering AGENTS.md and skills

- **Context files:** `AGENTS.override.md`, `AGENTS.md`, `AGENTS.MD`, `CLAUDE.md`, and `CLAUDE.MD`, read from the agent directory, the cwd, and **all parent directories**. An `AGENTS.override.md` only replaces the one in the same folder.
- **Skills** (Agent Skills standard; https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md):
  - `SKILL.md` with frontmatter `name` (lowercase, digits, and hyphens, up to 64) and `description` (up to 1024). Optional: `license`, `compatibility`, `metadata`, `allowed-tools`, `disable-model-invocation`.
  - Discovered in:
    - `~/.pi/agent/skills`
    - `.pi/skills`
    - `~/.agents/skills`
    - `.agents/skills` (walking up to the repo root)
    - packages and settings
    - the `resources_discover` event → `skillPaths`
  - **Progressive disclosure:** the prompt only receives the name, description, and path; the model reads `SKILL.md` on demand. The `/skill:name` command forces loading.

#### Windows notes (docs/windows.md)

- The bash tool uses Git Bash by default (or `shellPath`).
- There is an optional `powershell` tool.
- In JSON, backslashes must be escaped (doubled).

### 1.4 Blocks for onboarding (own draft, **untested**)

```ts
// SKETCH: combines real pi APIs (registerCommand, ctx.ui.*, ctx.reload)
pi.registerCommand("vault-memory-setup", {
  description: "Configure Obsidian vault(s) for memory",
  handler: async (_args, ctx) => {
    if (!ctx.hasUI) return ctx.ui.notify("Use in interactive mode", "warning");
    const vaults = await detectVaults();            // e.g.: folders with .obsidian/ under %OneDrive%
    const choice = await ctx.ui.select("Main vault", [...vaults, "Other path…"]);
    if (!choice) return;
    const vault = choice === "Other path…" ? await ctx.ui.input("Vault path", "C:\\Users\\…\\OneDrive\\Vault") : choice;
    const folder = (await ctx.ui.input("Memory folder inside the vault", "Agent Memory")) ?? "Agent Memory";
    if (!(await ctx.ui.confirm("Confirm", `Write memory to ${vault}\\${folder}?`))) return;
    await writeConfigAtomically({ vaults: [{ path: vault, folder }] });
    await ctx.reload(); // re-runs the factories: the new config takes effect without restarting pi
  },
});
// In session_start: if there's no config and ctx.hasUI, just notify "/vault-memory-setup".
// ctx.reload() is exclusive to commands.
```

---

## Part 2: pi-hermes-memory (the base to reuse)

### 2.1 Identity

| Item | Value |
|---|---|
| npm | `pi-hermes-memory`. https://www.npmjs.com/package/pi-hermes-memory · https://pi.dev/packages/pi-hermes-memory |
| Repo | https://github.com/chandra447/pi-hermes-memory. Created on 2026-04-23, last push on 2026-09-14, 456 stars, 111 forks, 24 open issues (as of 2026-09-23). Topics: context-engineering, harness, memory, pi. |
| Author | chandra447 (Chandra Teja, per the LICENSE) |
| License | **MIT**, "Copyright (c) 2025 Chandra Teja". The README states the code was ported from Hermes Agent, which is MIT, "Copyright (c) 2025 Nous Research". |
| Version | **0.9.9**, published on **2026-09-13** (commit `71ce9f0`). More than 50 versions since 0.1.0. The CHANGELOG only has headers up to **[0.9.4] (2026-08-08)**; what came after is under "[Unreleased]". |
| Downloads | Per the npm API: **21,582** between 2026-08-23 and 2026-09-21, and **3,817** between 2026-09-15 and 2026-09-21. pi.dev shows "27K/month · 5,497/week", with a different window or methodology **(unverified)**. |
| Runtime | `"type": "module"`, `"main": "src/index.ts"`, manifest `"pi": { "extensions": ["./src/index.ts"] }`. The TS source is loaded via jiti; issue #246 measures the import at about 2.1 s. |
| Dependencies | `better-sqlite3 ^13.0.3` (native), `@earendil-works/pi-tui ^0.80.2`, `strip-ansi 7.2.0`. Peers: `@earendil-works/pi-ai >=0.80.6` and `@earendil-works/pi-coding-agent >=0.80.6`. Dev: `tsx`, `typebox`, `typescript ^6`. |
| Tests | The description mentions "732 tests". There are about 50 `tests/**/*.test.ts` files using `node:test` via `npx tsx --test`, one process per file (`tests/run-all.sh`). CI (`.github/workflows/ci.yml`) runs **only on ubuntu-latest** with Node 22: `check`, `check:min-sdk`, `test`, and `lint` (the latter is `git diff --exit-code`). **There is no Windows CI.** |

### 2.2 Architecture in one page

```
factory (index.ts, synchronous)
 ├─ loadConfig()  ← ~/.pi/agent/hermes-memory-config.json (read once)
 ├─ globalDir = config.memoryDir ?? ~/.pi/agent/pi-hermes-memory
 ├─ MemoryStore(global) · SkillStore · DatabaseManager(globalDir → sessions.db) · StandingInstructions
 ├─ createMemoryInitializer(): migration → Markdown→SQLite sync → store.loadFromDisk() → prune → session backfill
 │
 ├─ on session_start      → STANDING.md; ensureMemoryReady (if not lazy); project skills context
 ├─ on resources_discover → skillPaths = [<globalDir>/skills, <project>/skills]
 ├─ on before_agent_start → systemPrompt += buildPromptContext(...)   (policy OR legacy blocks) + standing
 ├─ tools: memory_add/replace/remove · memory_search · session_search · skill_manage
 ├─ on turn_end/message_end → background review (every 10 turns or 15 tool calls; non-blocking)
 ├─ on message_end + turn_end → correction detector (regex → LLM → saves)
 ├─ on session_before_compact → flush (awaited, up to 60 s)
 ├─ on message_end → incremental session indexing into SQLite
 └─ on session_shutdown   → flush (10 s) → indexes final session → closes DB (wal_checkpoint TRUNCATE)
```

### 2.3 File-by-file map

**Root and tooling**

| File | Purpose |
|---|---|
| `package.json` | pi manifest, deps, scripts (`check`, `check:min-sdk`, `check:production`, `test`) |
| `README.md` | Usage docs: tools, commands, config, storage layout, limitations |
| `CHANGELOG.md` | History. #218 (cap bypass in policy-only), #121 (standing), and #227 (per-scope fingerprint) are under "[Unreleased]". |
| `PLAN.md` | The v0.1 plan with the "Hermes Source File Reference Map" (Hermes → TS files) |
| `AGENTS.md` | Instructions for agents developing the repo. **Outdated:** it still says "No SQLite" and `~/.pi/agent/memory/`. |
| `docs/ROADMAP.md` | Competitive analysis vs. Hermes and roadmap. Plans `MemoryOrchestrator`/`MemoryBackend`/`ExternalSync` (v0.5), **not implemented**. |
| `docs/0.x/*` | PLAN, TASKS, and TEST-PLAN for each version |
| `docs/PUBLISHING.md` | Publishing process |
| `docs/mermaid/*.mmd`, `docs/images/*` | Diagrams. Partly outdated: they still show `pi.exec("pi -p")` as the main path. |
| `scripts/*.mjs` | `ensure-dev` (blocks dev scripts in the published package), `check-min-sdk`, `check-production-install`, `benchmark-memory-startup` |
| `tests/run-all.sh`, `tests/**` | `node:test` suite: store, tools, handlers, integration |
| `.github/workflows/{ci,publish}.yml` | CI (ubuntu) and publishing |
| `.claude/agents/semble-search.md`, `.ralph/*` | The author's own dev tooling (Claude Code subagent, "ralph loop" state) |

**`src/` (core)**

| File | Purpose |
|---|---|
| `index.ts` (≈422 lines) | Entry point: loads config, resolves directories, instantiates the stores, registers events, tools, and commands, and handles shutdown order |
| `config.ts` | `DEFAULT_CONFIG`, `DEFAULT_CONFIG_PATH` (`<AGENT_ROOT>/hermes-memory-config.json`), and `loadConfig()`, which validates the type of each key and falls back to defaults on any error |
| `constants.ts` (≈313 lines, about 25 KB) | Delimiter, limits, file names, **all the prompts** (full/compact policy, tool descriptions, review, flush, consolidation, correction, skill, interview), and correction patterns |
| `types.ts` | `MemoryConfig` (all keys), `MemoryResult`, `MemoryMutationOperation`, `MemoryCategory`, skill types, and `getMessageText()` |
| `paths.ts` | `AGENT_ROOT` (respects `PI_CODING_AGENT_DIR`), `expandHome`, `normalizeConfiguredMemoryDir`, `normalizeProjectsMemoryDir` (restrictive), and `resolveProjectsRoot` |
| `project.ts` | `detectProject()`: project name = basename of the git root (worktrees share it) or of the cwd. Directory = `<projectsRoot>/<name>`. `detectProjectSkills()`. |
| `project-context.ts` | Helpers to resolve the `projectStore` and `projectName` refs |
| `prompt-context.ts` | `resolveMemoryPolicyPrompt()` (full, compact, custom, or none) and `buildPromptContext()` (policy-only vs. legacy, plus standing) |
| `memory-initialization.ts` | `createMemoryInitializer()` (lazy or eager init, active-work tracking, `close()`) and `withMemoryInitialization()`, which wraps `registerTool` and `registerCommand` |
| `extension-root-migration.ts` | Migrates `~/.pi/agent/memory` → `~/.pi/agent/pi-hermes-memory`, including `sessions.db`, `-wal`, and `-shm`, with staging and a sentinel |
| `project-memory-migration.ts` | Migrates the old `~/.pi/agent/<project>/` layout to `projects-memory/` |
| `lifecycle-timing.ts` | `measureLifecycle*` (opt-in timing) |
| `auto-consolidation-warning.ts` | Decides whether to warn when auto-consolidation fails |

**`src/store/` (persistence)**

| File | Purpose |
|---|---|
| `memory-store.ts` (about 50 KB) | **`MemoryStore`**: CRUD per target (memory, user, failure), dedupe, metadata, limits and overflow, snapshot, block rendering, **atomic write with hard link/rename**, recovery snapshots, external-edit detection (fingerprint), and an atomic mutation plan |
| `markdown-mutation-lock.ts` | Cross-process lock per Markdown file via `AtomicLockCoordinator`, written to `<parent of the memory directory>/.pi-hermes-locks.sqlite` |
| `atomic-lock-coordinator.ts` | SQLite locks (`BEGIN IMMEDIATE`) with a lease, `staleMs`, live-PID check, and an "incarnation probe" (uses PowerShell on Windows; see issues #245 and #247) |
| `canonical-storage-path.ts` | Canonicalizes paths by resolving symlinks (`realpathSync.native`) |
| `content-scanner.ts` | `scanContent()` and `scanSecrets()`: injection, exfiltration, invisible unicode, and secrets |
| `memory-lookup.ts` | `normalizeMemoryLookupText()`: accepts `old_text` pasted from formatted search results |
| `db.ts` (about 41 KB) | **`DatabaseManager`**: opens `<memoryDir>/sessions.db` with WAL, a 5 s busy_timeout, async `quick_check`, corruption recovery (rebuild from the readable rows), stats, and `close()` with a checkpoint |
| `schema.ts` | Tables `extension_metadata`, `sessions`, `session_files`, `messages`, `message_fts` (FTS5 trigram), `memories`, `memory_fts` (FTS5 trigram), triggers, and indexes |
| `sqlite-native.ts` | `better-sqlite3` loader: detects an ABI mismatch and tries `npm rebuild` via `spawnSync`. Falls back to `bun:sqlite` on Bun. |
| `sqlite-memory-store.ts` (about 36 KB) | SQLite mirror of memory: `reconcileMarkdownMemoryScope`, `reconcileMarkdownFailureScopes` (fingerprints `mdsync:v1:`), `searchMemories` (FTS5 bm25 with LIKE fallback), `syncMemoryEntry`, and `getRecentFailures`. **"Markdown is the source of truth."** |
| `fts-query.ts` | Normalizes natural-language queries for FTS5. The stop-word list is **English only**. |
| `session-parser.ts` | Parses pi's session JSONL |
| `session-indexer.ts` | Indexes sessions and messages (no tool results; messages truncated at 100 KiB), incremental backfill (up to 50 files per round), retention, and pruning |
| `session-search.ts` | FTS5 search over `message_fts` (the "legacy" variant) |
| `session-anchor-search.ts` | The "anchors" variant: scans the JSONL directly, without SQLite, from a Markdown-formatted request (`from/to/cwd/limit`, `all/any/exclude`), and returns `path:start-end` |
| `skill-store.ts` (about 35 KB) | **`SkillStore`**: `skills/<slug>/SKILL.md`, global or per project, frontmatter, sections (When to use, Procedure, Pitfalls, Verification), Jaccard similarity, and legacy migration |
| `skill-utils.ts` | slugify and similarity |
| `standing-instructions.ts` | **`StandingInstructions`**: `STANDING.md`, one rule per line, up to 20 entries / 2,000 characters, scan, `<standing-instructions>` rendering. Writes are human-only (`/memory-pin`). |
| `recovery-maintenance.ts` | Per-session scan of `.recovery-*` and `.retired-*` artifacts from dormant stores |

**`src/tools/`**

| File | Purpose |
|---|---|
| `memory-tool.ts` | `memory_add`, `memory_replace`, `memory_remove`, with sync or reconcile to SQLite after each write |
| `memory-search-tool.ts` | `memory_search` |
| `session-search-tool.ts` | `session_search` in the legacy and anchors variants |
| `skill-tool.ts` | `skill_manage` |
| `shared-output-view.ts`, `tool-result-views.ts` | TUI rendering of results |

**`src/handlers/`**

| File | Purpose |
|---|---|
| `background-review.ts` | Learning loop: `turn_end` with a threshold, non-blocking review (direct or subprocess) |
| `review-memory-ops.ts` | Direct transport (`completeSimple` from `@earendil-works/pi-ai/compat`), model chain and fallbacks, parsing of the `{"operations":[…]}` JSON (including when the response arrives only on the thinking channel), and `applyReviewOperations` |
| `pi-child-process.ts`, `child-process-watchdog.mjs` | Subprocess `pi -p --no-session --no-extensions -e <its own extension + childExtensionPaths + auth adapters> @<prompt file>`, with a process-tree watchdog and retry without overrides |
| `session-flush.ts` | Flush on `session_before_compact` (awaited) and on `session_shutdown` |
| `correction-detector.ts` | Detects user corrections via regex and saves them immediately |
| `auto-consolidate.ts` | `triggerConsolidation()`, with a lock at `~/.pi/agent/pi-hermes-memory/.consolidation-locks/locks.sqlite`, and the `/memory-consolidate` command |
| `sync-markdown-memories.ts` | Markdown → SQLite reconciliation (initial, and `/memory-sync-markdown`) |
| `session-backfill.ts`, `session-live-index.ts`, `index-sessions.ts` | Limited startup backfill, live indexing (`message_end`), and `/memory-index-sessions` |
| `insights.ts` | `/memory-insights` |
| `interview.ts` | `/memory-interview` |
| `skills-command.ts` | `/memory-skills`, a `ctx.ui.custom` modal built with pi-tui |
| `learn-memory.ts` | `/learn-memory-tool`, a menu built with `ctx.ui.select` |
| `preview-context.ts` | `/memory-preview-context` |
| `standing-pin.ts` | `/memory-pin [list / remove n / clear / <text>]` |
| `switch-project.ts` | `/memory-switch-project`: lists project memories |
| `message-parts.ts` | Message-part utilities |

### 2.4 Where memory is written, how paths are resolved, and the format

**Agent root** (`src/paths.ts`, ≈L5-10):
```ts
export const AGENT_ROOT = resolveAgentRoot();
export function resolveAgentRoot(env = process.env): string {
  const configured = env.PI_CODING_AGENT_DIR?.trim();
  return configured ? path.resolve(expandHome(configured)) : path.join(os.homedir(), ".pi", "agent");
}
```

**Global directory** (`src/index.ts`, factory ≈L89-100). `memoryDir` can come from the config as an absolute path, `~`, or relative to `AGENT_ROOT`:
```ts
const legacyGlobalDir = path.join(agentRoot, "memory");
const defaultGlobalDir = path.join(agentRoot, "pi-hermes-memory");
const configuredMemoryDir = config.memoryDir?.trim();
const globalDir = !configuredMemoryDir || pointsToLegacyMemoryDir ? defaultGlobalDir : configuredMemoryDir;
```

**Per-target files** (`src/store/memory-store.ts`, `pathFor()` ≈L86-90):
```ts
if (target === "user") return path.join(this.memoryDir, USER_FILE);          // USER.md
if (target === "failure") return path.join(this.memoryDir, "failures.md");
return path.join(this.memoryDir, MEMORY_FILE);                                // MEMORY.md
```
- The tool's `project` target is the `memory` target of a **second** `MemoryStore`, whose `memoryDir` is the project directory (`createProjectStore()` in index.ts).
- This store is rebound on every `ctx.cwd`, via `bindProjectFromCwd()` in `session_start` and in each tool's `execute`.

**Project** (`src/project.ts`, `detectProject()` ≈L92-116):
- `memoryDir = <AGENT_ROOT>/<projectsMemoryDir>/<name>`, defaulting to `projects-memory`.
- The name is the basename of the git root. Linked worktrees share the same identity. There is a bridge to the old cwd-derived name.
- `cwd == home` means "no project".
- `normalizeProjectsMemoryDir()` (paths.ts ≈L34-57) **rejects** any absolute path outside `AGENT_ROOT` and requires **a single segment**. So today there is no way to send project memory to OneDrive via config.

**Constants** (`src/constants.ts` ≈L1-70):
```ts
export const ENTRY_DELIMITER = "\n§\n";           // same as Hermes
export const DEFAULT_MEMORY_CHAR_LIMIT = 5000;    // "Character limits (not tokens — model-independent)"
export const DEFAULT_USER_CHAR_LIMIT = 5000;
export const DEFAULT_PROJECT_CHAR_LIMIT = 5000;
export const MEMORY_FILE = "MEMORY.md"; export const USER_FILE = "USER.md"; export const STANDING_FILE = "STANDING.md";
export const STANDING_MAX_ENTRIES = 20; export const STANDING_MAX_CHARS = 2000;
```

**Per-entry metadata** (`encodeEntry()`, memory-store.ts ≈L532):
```ts
return `${text} <!-- created=${created}, last=${lastReferenced}${projectMetadata} -->`; // project64=<base64url>
```
- `decodeEntry()` parses the comment via regex. Entries without metadata are assumed to be from "today".
- In failures, the text is prefixed with `[category]` and parts such as `— Failed: … — Tool state: … — Corrected to: …` (`buildFailureMemoryText`).

**Illustrative** example of `MEMORY.md`, built from the rules above (not a real file):
```md
Project uses pnpm, not npm <!-- created=2026-09-01, last=2026-09-20 -->
§
CI requires --frozen-lockfile <!-- created=2026-09-02, last=2026-09-02 -->
```

**Reading and writing** (memory-store.ts):
- **`loadFromDisk()`** (≈L148-166):
  - `mkdir -p`
  - for each target: `readFileState()`, which does `split(ENTRY_DELIMITER)`, `trim`, `filter`, and dedupe via a `Set`, and computes a SHA fingerprint
  - captures the **snapshot** (MEMORY and USER without metadata) for `legacy-inject` mode
- **`runTargetMutation()`:** takes the lock (`withMarkdownMutationLock`), applies the mutation, checks that the on-disk fingerprint hasn't changed, and if it has, retries up to 2 times (`ExternalMemoryWriteConflict`). Only afterward does it call the observer, which reconciles SQLite.
- **`saveToDisk()`** (≈L766+). Algorithm:
  1. `mkdtemp(<dir>/.tmp-XXXX)` and writes `write.tmp`.
  2. Re-reads the target and compares the fingerprint.
  3. Prunes recovery files.
  4. Publishes:
     - if the file doesn't exist: `fs.link(tmp, target)`, i.e. a **hard link**;
     - if there was a recent snapshot (1 h): `fs.rename(tmp, target)`;
     - otherwise: `rename(target → .MEMORY.md.recovery-<ts>-<uuid>)`, then `fs.link(tmp, target)`, and re-verifies.
  5. On conflict, creates `.<file>.conflict-local-<ts>-<uuid>` and rolls back.
  6. Cleans up the temp file and verifies the published fingerprint.
  - Retention: `RECOVERY_MAX_COUNT=32`, `RECOVERY_MAX_BYTES=64 MiB`, conflict and retired files kept for 30 days.
  - Artifacts in the memory directory: `.tmp-*/`, `.MEMORY.md.recovery-*`, `.*.retired-*`, `.*.conflict-local-*`.

**Other files and directories written:**

| Path | What it is |
|---|---|
| `<globalDir>/sessions.db` (+ `-wal`, `-shm`) | `new DatabaseManager(globalDir)` in index.ts ≈L117. Pragmas: `journal_mode=WAL`, `busy_timeout=5000`, `wal_autocheckpoint=1000`, `journal_size_limit=5 MiB`, `foreign_keys=ON`. |
| `<parent of the memory directory>/.pi-hermes-locks.sqlite` | markdown-mutation-lock.ts ≈L14-15: `const coordinatorDir = path.dirname(path.dirname(identity));` and then `AtomicLockCoordinator.shared(path.join(coordinatorDir, ".pi-hermes-locks.sqlite"))`. On a default install this yields `~/.pi/agent/.pi-hermes-locks.sqlite` and `~/.pi/agent/projects-memory/.pi-hermes-locks.sqlite`. |
| `~/.pi/agent/pi-hermes-memory/.consolidation-locks/locks.sqlite` | Fixed under `AGENT_ROOT` (does not follow `memoryDir`). Overridable via the `PI_HERMES_CONSOLIDATION_LOCK_DIR` env var. |
| `<globalDir>/skills/<slug>/SKILL.md` and `<project>/skills/<slug>/SKILL.md` | Skills, exposed to pi via `resources_discover` |
| `<globalDir>/STANDING.md`, `<globalDir>/.skills-migrated-to-extension-storage` | Standing instructions and a migration sentinel |
| `~/.pi/agent/hermes-memory-config.json` | Config |
| `~/.pi/agent/sessions/**.jsonl` | **Read** from pi's sessions for indexing |

### 2.5 Size limits: constants, where they're applied, and what happens

Enforcement (memory-store.ts ≈L114-121):
```ts
private charLimit(target) {
  if (target === "failure") return this.config.memoryCharLimit * 2;
  return target === "user" ? this.config.userCharLimit : this.config.memoryCharLimit;
}
private get capEnforced(): boolean { return this.config.memoryMode !== "policy-only"; }
```

Check in `_add()` (≈L246-257). There are equivalent checks in `replaceUnlocked()` and `applyMutationPlan()`:
```ts
const newTotal = [...entries, encoded].join(ENTRY_DELIMITER).length;
if (this.capEnforced && newTotal > limit) {
  this.overflowSince[target] ??= Date.now();
  if (strategy === "fifo-evict") return this.fifoEvictAndAdd(/* … */);
  return this.memoryFullError(target, content.length);
}
```

**Overflow strategy** (config `memoryOverflowStrategy`, only in `legacy-inject`):
- **`reject`:** returns the error "Memory at X/Y chars. Adding this entry (N chars) would exceed the limit. Replace or remove existing entries first…", along with the list of entries.
- **`fifo-evict`:** removes the oldest entries until it fits, and returns `evicted_entries`.
- **`auto-consolidate`** (default):
  - `addWithConsolidation()` waits `overflowGraceMs` (180 s) to give the user a chance to consolidate manually;
  - it then calls the injected consolidator (`store.setConsolidator(...)` in index.ts);
  - the consolidator runs, under lock, either a direct LLM call with a JSON of operations and `requireShrink`, or a `pi -p`;
  - it then reloads from disk and retries once.

**Table of all limits found:**

| Limit | Value | Configurable? | Where |
|---|---|---|---|
| MEMORY.md, USER.md, project | 5,000 characters each | yes: `memoryCharLimit`, `userCharLimit`, `projectCharLimit` | constants.ts, config.ts, `charLimit()`. **Only applied in `legacy-inject`.** |
| failures.md | 2 × memoryCharLimit | indirect | `charLimit()` |
| STANDING.md | 20 entries / 2,000 characters | **no** (constants) | `standing-instructions.ts` `add()` |
| Indexed session message | 100 KiB | no | `DEFAULT_MAX_MESSAGE_CONTENT_LENGTH` |
| `memory_search` | default 10, max 20 results | per call | memory-search-tool.ts |
| `session_search` (legacy) | limit 1-20 (default 10); snippet 1,200 (max 4,000); output up to 50 KiB | per call | session-search-tool.ts |
| Injected failures | 5 entries, up to 7 days | yes: `failureInjection*` | only in `legacy-inject` |
| Startup backfill | 50 files per round | no | session-indexer.ts |
| Session retention | 0 (off) | yes: `sessionRetentionDays` | config |
| Recovery, retired, conflict | 32 files / 64 MiB / 7 to 30 days | no | memory-store.ts |

> **Important:** in the default `policy-only` mode, the Markdown caps **do not** apply. The CHANGELOG, under "[Unreleased]" item #218, says SQLite is the "query authority" and that add, replace, and atomic plans can exceed the limit "without triggering automatic consolidation." The limits still show up as `usage: "NN% — X/Y chars"` in responses (`successResponse`).

### 2.6 Tools exposed to the LLM

| Tool | Parameters (TypeBox) | Behavior |
|---|---|---|
| `memory_add` | `target` ∈ {memory, user, project, failure}; `content`; `category?` ∈ {failure, correction, insight, preference, convention, tool-quirk}; `failure_reason?` | Scans and checks for an exact duplicate (ignoring metadata). Writes to Markdown and then syncs or reconciles SQLite. `failure` becomes `addFailure()` with the `[category]` prefix. |
| `memory_replace` | `target`; `old_text` (substring); `content` | Requires **exactly one** match. Refuses if the new content omits lines from a multi-line entry (`validateWholeEntryReplacement`). Preserves `created` and updates `last`. |
| `memory_remove` | `target`; `old_text` | Requires **exactly one** match (except for failure copies in different scopes) |
| `memory_search` | `query`; `project?`; `target?` ∈ {memory, user, failure, project}; `category?`; `limit?` | FTS5 trigram, ordered by bm25 and then `last_referenced`, with a LIKE fallback for short CJK text or stop-words only. Labels each item with the `[target=…]` required by replace and remove. |
| `session_search` (legacy) | `query`; `project?`; `role?` ∈ {user, assistant}; `limit?` (1-20); `snippetChars?` (≤4000) | FTS5 over `messages` |
| `session_search` (anchors, opt-in) | `markdown` (a request with `from/to/cwd/limit`, `all/any/exclude`) | Scans the JSONL and returns `file:lines` anchors |
| `skill_manage` | `action` ∈ {create, view, patch, update, edit, delete}; `name?`; `skill_id?`; `description?`; `scope?` ∈ {global, project}; `section?`; `content?`; `when_to_use?`; `procedure_steps?[]`; `pitfalls?[]`; `verification_steps?[]` | CRUD for `SKILL.md`, with a mandatory scope on `create` and a similarity check |

Schema excerpt (`src/tools/memory-tool.ts`, `registerActionTool("add", …)`):
```ts
const target = StringEnum(["memory", "user", "project", "failure"] as const, { description: "Memory scope. …" });
Type.Object({
  target,
  content: Type.String({ description: "Entry content to save." }),
  category: Type.Optional(category),
  failure_reason: Type.Optional(Type.String({ description: "Why a failure occurred." })),
})
```
- Every tool receives the same base description (`MEMORY_TOOL_DESCRIPTION`: when to save, priorities, what **not** to save, and the meaning of each target).
- `promptSnippet` and `promptGuidelines` say, for example, that the tool should be used proactively for corrections and preferences, and not for temporary state or TODOs.
- Result: `{ content: [{ type: "text", text }], details: MemoryResult }`. If the SQLite sync fails, a "Saved to Markdown, but SQLite search sync failed…" warning is included.

### 2.7 How and when memory enters the prompt

`src/index.ts` (≈L217-225) runs **on every prompt**, in `before_agent_start`:
```ts
pi.on("before_agent_start", async (event, _ctx) => {
  const promptContext = await buildPromptContext(config, store, projectStoreRef(), projectNameRef(), standingStore);
  if (promptContext) return { systemPrompt: event.systemPrompt + "\n\n" + promptContext };
});
```

`src/prompt-context.ts` (≈L33-55):
```ts
const standingBlock = standing?.formatForSystemPrompt() ?? "";
if (config.memoryMode === "policy-only") {
  return [resolveMemoryPolicyPrompt(config), standingBlock].filter(Boolean).join("\n\n");
}
// legacy-inject: store.formatForSystemPrompt() + projectStore.formatProjectBlock(name) + standing
```

- **`policy-only` (default since v0.7):**
  - Injects `<memory-policy>…</memory-policy>` plus `<available-memory-tools>`. The text explains that memory is **not** loaded into the prompt and that `memory_search` must be used, describes targets, filters, categories, and a search guide, asks that results be treated as context rather than instructions, and gives guidance on using skills.
  - `memoryPolicyStyle`: `full`, `compact`, `custom` (text from `memoryPolicyCustomText`), or `none`.
  - The text is constant, which is friendly to the prefix cache.
  - No memory content goes into the prompt.
- **`legacy-inject`:**
  - Blocks `MEMORY (your personal notes) [NN% — X/Y chars]` and `USER PROFILE (who the user is) […]`, coming from the **snapshot** captured in `loadFromDisk()`.
  - Plus `PROJECT MEMORY: <name>`, which is **live** because it uses `this.memoryEntries`.
  - Plus `RECENT FAILURES & LESSONS` (up to 5, from up to 7 days).
  - Everything wrapped by `fenceBlock()` in `<memory-context>` with a notice that it is persistent memory and "NOT new user input".
  - **Nuance found in the code:** the snapshot is rebuilt whenever `loadFromDisk()` runs again, for example after an auto-consolidation. The project and failure blocks change after writes. So the "frozen" nature really only holds for MEMORY and USER, and mid-session writes can invalidate the cache **(inferred from the code, not measured)**.
- **Standing instructions:** the `<standing-instructions>` block is **always** appended last, including in `policy-only` and with policy `none`. Only humans write to it, via `/memory-pin`.

### 2.8 Triggers, nudges, background review, and transport

- **Background review** (`handlers/background-review.ts`):
  - `message_end` counts user messages.
  - `turn_end` counts agent turns and tool calls.
  - Fires when `turnsSinceReview >= nudgeInterval` (10) **or** `toolCallsSinceReview >= nudgeToolCalls` (15), and only once there have already been **3 or more user messages**. One review at a time.
  - It is fire-and-forget (non-blocking).
  - Sends the entire branch (`ctx.sessionManager.getBranch()`), or the last N messages if `reviewRecentMessages > 0`.
  - Notifies "💾 Memory auto-reviewed and updated".
  ```ts
  const turnThresholdMet = turnsSinceReview >= config.nudgeInterval;
  const toolCallThresholdMet = toolCallsSinceReview >= config.nudgeToolCalls;
  if (!turnThresholdMet && !toolCallThresholdMet) return;
  if (userTurnCount < 3) return;
  ```
- **Transport** (`reviewTransport`):
  - **`direct`** (default): `completeSimple` with the session's model or `llmModelOverride`, a `llmFallbackModels` chain, and `llmThinkingOverride`. The model replies with **JSON** `{"operations":[{action,target,content,old_text,category,failure_reason}]}`. There is a recovery path for when the response comes out on the thinking channel; in that case only non-final adds are accepted.
  - **`subprocess`:** `pi -p --no-session --no-extensions -e <extension> @prompt`, where the child uses its own memory tools.
  - `direct` falls back to `subprocess` on failure.
  - The prompts come from `constants.ts`: `DIRECT_REVIEW_SYSTEM_PROMPT`, `COMBINED_REVIEW_PROMPT`, `DIRECT_FLUSH_SYSTEM_PROMPT`, `DIRECT_CONSOLIDATION_SYSTEM_PROMPT`, `DIRECT_CORRECTION_SYSTEM_PROMPT`.
  - The review does **not** create skills ("Do NOT create or modify skills").
  - **These prompts are not configurable.** Issue #229 asks for `review.customInstructions`, precisely to cooperate with an Obsidian vault or an external wiki.
- **Correction detector** (`handlers/correction-detector.ts`):
  - `message_end` flags the user's message.
  - Check order: *negative* patterns (`^no worries`…) first, then *strong* (`don't do that`, `^I said`…), then *weak* (`^no,`, `^actually,`…) combined with a *directive word* (`use`, `run`, `install`…).
  - On `turn_end` it runs the LLM (direct or subprocess, with a 30 s timeout) and also saves a `[correction]` failure.
  - Limited to one correction every 3 turns. Notifies "🔧 Correction detected — memory updated".
  - All patterns can be overridden via config (`correction*Patterns`, `correctionDirectiveWords`), but they are in English.
- **Session flush** (`handlers/session-flush.ts`):
  - `session_before_compact`: **awaited** up to `flushCompactTimeoutMs` (60 s), only if there have been 6 or more user messages (`flushMinTurns`).
  - `session_shutdown`: a fixed 10 s limit; skipped when `reason === "reload"`.
- **Auto-consolidation:** only runs when a write exceeds the cap, i.e., only in `legacy-inject`. There is also the manual `/memory-consolidate` command.

### 2.9 Session search and indexing

- **Indexing:**
  - on shutdown, the active session;
  - live, on `message_end` (`scheduleLiveSessionIndex`);
  - on startup, a limited backfill (50 files, newest to oldest, by stat only);
  - manually, via `/memory-index-sessions`.
- **Tables:** `sessions`, `session_files`, `messages` (user, assistant, and system roles; **no tool results**), and `message_fts` (FTS5 `tokenize='trigram'`).
- **Retention:** optional (`sessionRetentionDays`). Ephemeral review sessions are pruned.
- **⚠️ Possible bug on Windows (inferred, not tested):** `session-indexer.ts` (≈L27 and ≈L165) derives the project with `project: header.cwd.split('/').pop() ?? header.cwd`. With a cwd of `C:\Users\…\proj` there is no `/`, so the "project" becomes the entire path. This diverges from `detectProject()`, which uses the basename.

### 2.10 Security: content scanner

`src/store/content-scanner.ts` is ported from Hermes's `_MEMORY_THREAT_PATTERNS`, `_INVISIBLE_CHARS`, and `_scan_memory_content`, with secret patterns coming from "pk-pi-hermes-evolve". It blocks the write, returning an error to the tool, when it finds:

| Category | Examples |
|---|---|
| Invisible unicode | U+200B-U+200D, U+2060, U+FEFF, U+202A-U+202E |
| Threat patterns | `ignore (previous|all…) instructions`, `you are now`, `do not tell the user`, `system prompt override`, `disregard … rules`, `curl/wget … $KEY/TOKEN…`, `cat … .env/.netrc/.npmrc…`, `authorized_keys`, `~/.ssh` |
| Secrets | `sk-ant-api…`, `sk-or-v1-…`, `sk-…`, `AKIA…`, `ghp_`, `ghu_`, `xoxb-`, `xapp-`, `ntn_`, `Bearer …`, `-----BEGIN … PRIVATE KEY-----` blocks, env variable names (`ANTHROPIC_API_KEY`, `DATABASE_URL`…), and assignments like `password=`, `secret=`, `token=` |

```ts
if (pattern.test(content)) {
  return `Blocked: content matches threat pattern '${id}'. Memory entries may be surfaced …`;
}
```

The scanner is applied to memory, user, project, failure, skills, and `STANDING.md`.

### 2.11 Configuration (`~/.pi/agent/hermes-memory-config.json`)

- The file is read **once** in the factory (`loadConfig()`).
- Each key is validated by type. Unknown keys are ignored.
- **Any parse error silently falls back to the defaults** (config.ts ≈L218-221).
- There is no config writing, UI, or versioning.

| Key | Default | Note |
|---|---|---|
| `memoryMode` | `policy-only` | or `legacy-inject` |
| `memoryPolicyStyle` / `memoryPolicyCustomText` | `full` / — | `full`, `compact`, `custom`, or `none` |
| `memoryCharLimit` / `userCharLimit` / `projectCharLimit` | 5000 each | caps (legacy only) |
| `memoryOverflowStrategy` / `autoConsolidate` / `overflowGraceMs` | `auto-consolidate` / true / 180000 | `autoConsolidate` is a legacy alias |
| `memoryDir` | `~/.pi/agent/pi-hermes-memory` | absolute, `~`, or relative to `AGENT_ROOT` |
| `projectsMemoryDir` | `projects-memory` | **one segment, under `AGENT_ROOT`** |
| `lazyInitialization` | false | only applies in policy-only |
| `reviewEnabled` / `reviewTransport` / `nudgeInterval` / `nudgeToolCalls` / `reviewRecentMessages` | true / `direct` / 10 / 15 / 0 | |
| `flushOnCompact` / `flushOnShutdown` / `flushMinTurns` / `flushRecentMessages` / `flushCompactTimeoutMs` | true / true / 6 / 0 / 60000 | |
| `correctionDetection` and `correctionStrongPatterns` / `WeakPatterns` / `NegativePatterns` / `DirectiveWords` | true / defaults | regex as a string |
| `failureInjectionEnabled` / `MaxAgeDays` / `MaxEntries` | true / 7 / 5 | legacy only |
| `consolidationTimeoutMs` / `autoConsolidationWarnOnFailure` | 180000 / true | |
| `standingInstructionsEnabled` | true | |
| `sessionSearch.variant` | `legacy` | or `anchors` |
| `sessionRetentionDays` / `quickCheckOnOpen` | 0 / true | |
| `llmModelOverride` (string or array) / `llmFallbackModels` / `llmThinkingOverride` / `childExtensionPaths` | — | aliases: `llmModelFallbacks`, `fallbackModels` |

**Environment variables:**
- `PI_CODING_AGENT_DIR`
- `PI_CODING_AGENT_SESSION_DIR` (CHANGELOG 0.7.21)
- `PI_HERMES_CONSOLIDATION_LOCK_DIR`
- `PI_HERMES_CONSOLIDATION_LOCK_WAIT_MS`

### 2.12 Commands and the "onboarding" that already exists

| Command | Function |
|---|---|
| `/memory-insights` | Shows memory and the profile |
| `/memory-skills` | Skill manager (TUI modal) |
| `/memory-consolidate` | Manual consolidation |
| `/memory-interview` | **Profile** onboarding (not configuration) |
| `/memory-switch-project` | Lists project memories |
| `/memory-index-sessions` | Imports old sessions |
| `/memory-sync-markdown` | Reconciles Markdown → SQLite |
| `/memory-preview-context` | Shows what gets injected |
| `/memory-pin` | Standing instructions |
| `/learn-memory-tool` | Interactive guide (select) |

`/memory-interview` (`handlers/interview.ts`) is the only onboarding:
```ts
pi.registerCommand("memory-interview", {
  description: "Answer a few questions to pre-fill your user profile …",
  handler: async (_args, ctx) => {
    // (warns via ctx.ui.notify if USER.md already has entries)
    await ctx.waitForIdle();
    pi.sendUserMessage(INTERVIEW_PROMPT); // the LLM asks 7 items, one at a time, and saves each answer with memory_add(target:"user")
  },
});
```

### 2.13 Open issues and PRs relevant to the new project (as of 2026-09-23)

| # | Type | Subject | Why it matters |
|---|---|---|---|
| #229 | issue | `review.customInstructions` for cooperating with external stores, citing a "pi-llm-wiki" vault and lean entries with `[[wikilink]]` | This is exactly the Obsidian use case. The report shows memory growing from 4,709 to 11,247 characters in one day. |
| #175 | PR | Optional semantic search via **qmd** (`@tobilu/qmd`) with an FTS5 fallback | Local semantic retrieval over Markdown |
| #216 | PR | Opt-in "active recall" at session start: up to 3 leads injected in `before_agent_start` | Retrieval-based injection model |
| #245 / #247 | issue / PR | The lock coordinator's "incarnation" probe opens `powershell.exe` on load (about 515 ms, always times out on Windows) | Startup penalty **on Windows** |
| #211 | issue | Auto-consolidation fails to resolve the child CLI on Windows (standalone OMP) | Subprocess on Windows |
| #246 | issue | The TS entry point costs about 2.1 s to import; proposes shipping a `dist/` build | Startup |
| #238 | PR | Limit `session_search` snippets (UTF-16 truncation) | |

### 2.14 SEAMS: what to change for the three goals

#### Verdict on storage

- **There is no storage interface or adapter.** Persistence is hardcoded across four concrete classes:
  - `MemoryStore`: `node:fs/promises` with `mkdir`, `readFile`, `writeFile`, `mkdtemp`, `link`, `rename`, `unlink`, `rm`, and `lstat`
  - `SkillStore`: fs
  - `StandingInstructions`: fs
  - `DatabaseManager`: `better-sqlite3`
- Paths are decided in `paths.ts`, `project.ts`, `index.ts`, `markdown-mutation-lock.ts`, `auto-consolidate.ts`, and `sync-markdown-memories.ts`.
- **The only injection points that exist:**
  - `MemoryStore.setConsolidator()` and `setMutationObserver()`
  - the `ProjectStoreRef` / `ProjectNameRef` refs
  - `withMemoryInitialization()`
  - `config.memoryDir`
  - `memoryPolicyStyle: "custom"` (swaps the policy text without touching the code)
- **A natural cut for a `MemoryBackend`:** separate the business logic that operates on `entries[]` (`_add`, `replaceUnlocked`, `removeUnlocked`, `applyMutationPlan`, dedupe, metadata, scan) from persistence (`resolveStoragePath`, `readFileState`, `saveToDisk`, `pruneRecoveryFiles`, `maintainRecoveryFiles`, `getStorageIdentity`, and the lock). The existing tests (`tests/store/memory-store.test.ts`, about 93 KB) serve as a safety net.

#### (a) Writing inside one or more Obsidian vaults in OneDrive

**What can be done with config alone today:**
- `"memoryDir": "C:/Users/<you>/OneDrive/<Vault>/Agent Memory"`.
- **Side effect:** the following also go into the vault: `sessions.db`, `-wal`, and `-shm`, the `.tmp-*`, `.recovery-*`, `.retired-*`, and `.conflict-local-*` files, `skills/`, `STANDING.md`, **and** `.pi-hermes-locks.sqlite` at the **vault root**, which is the parent of "Agent Memory".
- **Project memory stays in `~/.pi/agent/projects-memory/`.**

**Required changes, file by file:**

| File / function | Change |
|---|---|
| `config.ts` (`DEFAULT_CONFIG`, `loadConfig`) and `types.ts` (`MemoryConfig`) | New keys: `vaults[]` ({id, path, folder}), routing rules (target, project, or cwd glob → vault/folder), `indexDir` and `lockDir` **outside** OneDrive, and format options. Keep `memoryDir` for compatibility. Replace the silent fallback with visible errors. |
| `paths.ts` (`normalizeProjectsMemoryDir`, `resolveProjectsRoot`) | Allow an absolute root, or one root per vault |
| `project.ts` (`detectProject`, `detectProjectSkills`) | Map project → vault/folder instead of `<AGENT_ROOT>/projects-memory/<name>` |
| `index.ts` (factory: `globalDir`, `legacyGlobalDir`, `shouldMigrateExtensionRoot`, `new MemoryStore`, `new SkillStore`, `new DatabaseManager(globalDir)`, `new StandingInstructions(...)`, `createProjectStore`, `bindProjectFromCwd`) | Instantiate backends per vault; **separate the DB path** from the memory path; disable legacy migrations in vault mode |
| `store/memory-store.ts` (`memoryDir`, `pathFor`, `resolveStoragePath`, `loadFromDisk`, `readFileState`, `saveToDisk`, `restoreDisplacedFile`, `rollbackPublishedFile`, `recoveryPathFor`, `pruneRecoveryFiles`, `retireRecoveryFile`, `preserveConflictFile`, `maintainRecoveryFiles`) | Extract a `MemoryBackend`. Optionally an "Obsidian-native" format, such as one note per memory with frontmatter (id, target, category, project, created, updated, tags). Avoid hard links on OneDrive. |
| `store/markdown-mutation-lock.ts` (`acquireMarkdownMutationLock`) | The lock DB is currently written to `dirname(dirname(file))`; it should go to a local `lockDir` |
| `store/db.ts` (`DatabaseManager`) | Accept an explicit `dbPath`, e.g. under `%LOCALAPPDATA%` or `~/.pi/agent/...`, rebuildable from the vault |
| `handlers/sync-markdown-memories.ts` (`syncMarkdownMemoriesToSqlite`, `scanProjectDirs`, `migrateThenSyncMarkdownMemories`), `store/recovery-maintenance.ts` (`listMemoryStoreDirs`) | Iterate over the backend's scopes and vaults instead of scanning `globalDir` and `projects-memory/` |
| `store/sqlite-memory-store.ts` (reconcile and search) | Add a `vault` dimension and change the `MDSYNC_METADATA_KEY_PREFIX` prefix if the parser changes |
| `store/skill-store.ts`, `store/standing-instructions.ts` | Decide whether skills and STANDING go into the vault. Skills in the vault are interesting, because pi discovers them via `resources_discover`. |
| `extension-root-migration.ts`, `project-memory-migration.ts`, `SkillStore.migrateLegacySkills()` | Skip in vault mode |
| `handlers/switch-project.ts`, `insights.ts`, `preview-context.ts` | Show the active vault and path |
| `store/session-indexer.ts` (`header.cwd.split('/')`) | Use `path.basename` or `detectProject` (Windows) |
| `constants.ts` (prompts) | Vault-aware policy and review: wikilinks, lean notes. The policy can be swapped via `memoryPolicyStyle:"custom"`; the review prompts require code changes (see issue #229). |

**OneDrive and Windows risks to handle:**

| Risk | Source | Suggested mitigation |
|---|---|---|
| SQLite (`sessions.db` with WAL/SHM, and the two `locks.sqlite` files) in a synced folder: corruption or conflict copies | `DatabaseManager(globalDir)` and the lock DB in the parent of the memory directory | Keep indexes and locks always on local disk; the vault holds only Markdown |
| `fs.link` (hard link) and `rename` with OneDrive holding handles, or "Files On-Demand" (placeholder) files. Only `ENOENT` and `EEXIST` are handled; `EPERM`/`EBUSY` become errors. | `saveToDisk()` | A dedicated backend with retry and backoff for `EPERM`/`EBUSY`, temp write + rename with a fallback, no hard links **(OneDrive behavior unverified)** |
| `.tmp-*` and `.recovery-*` (full copies, up to 32 files / 64 MiB each) getting synced | `saveToDisk()` / `pruneRecoveryFiles()` | Keep recovery in a local directory, or rely on OneDrive's own version history |
| OneDrive conflict copies (e.g., `MEMORY-<PC>.md`) are ignored by the loader | `pathFor()` only reads the canonical name | Detect and warn in `/…-doctor` or during onboarding |
| Obsidian (or plugins like Linter) editing the file while it's being written | Fingerprinting and `ExternalMemoryWriteConflict` already exist (up to 2 retries) | Prefer append-only notes or one note per memory to reduce conflicts |
| Files with a leading dot don't show up in Obsidian, but OneDrive still syncs them | known Obsidian behavior **(not verified here)** | Same as above |
| PowerShell opened by the lock coordinator at startup | #245 / #247 | Use a fork with PR #247, or simplify the locks |
| No Windows CI; native `better-sqlite3` (rebuilt via `npm rebuild` with `spawnSync` on an ABI mismatch) | `sqlite-native.ts`, `ci.yml` | Add Windows CI; evaluate the built-in `node:sqlite` (used by `@pify/memory`) |

#### (b) Removing size limits

- **This is already almost the default behavior.** In `policy-only`, `capEnforced` is false, and add, replace, and the mutation plan are not blocked (#218).
- **To eliminate the limits for good:**
  - remove or neutralize `charLimit()`, `capEnforced`, and the limit branches in `_add()`, `replaceUnlocked()`, and `applyMutationPlan()`;
  - remove `memoryFullError()`, `fifoEvictAndAdd()`, the consolidation retry in `addWithConsolidation()`, `overflowSince`, and the grace period;
  - remove `store.setConsolidator(...)` and `configureProjectStore` in index.ts, and the automatic `triggerConsolidation()` path;
  - remove the `memoryCharLimit`, `userCharLimit`, `projectCharLimit`, `memoryOverflowStrategy`, `overflowGraceMs`, and `autoConsolidate` keys;
  - replace the `usage: NN% — X/Y` in `successResponse()` and `renderBlock()` with simple counts.
- **Caution:** "unlimited" needs an explicit representation (`null` or a flag). `memoryCharLimit: 0` in `legacy-inject` **blocks every add** (`newTotal > 0`), and JSON doesn't accept `Infinity`.
- **Fixed limits that remain:**
  - `STANDING_MAX_ENTRIES` and `STANDING_MAX_CHARS` (constants)
  - search limits (20 results, 4,000-character snippets, 50 KiB)
  - 100 KiB per indexed message
  - 50 files per backfill
  - Decide which of these should become configurable.

**What breaks or degrades without limits:**

1. **`legacy-inject` becomes impractical.** The package injects everything on every prompt, which bloats context and cost. Any reload or write that changes the blocks (project and failures are "live") invalidates the prefix cache.
   - Path forward: stay in `policy-only` and use **retrieval**, i.e., the `memory_search` tool plus a token-budgeted *active recall*, as in PR #216 (in `before_agent_start` or the `context` event).
2. **Recall quality becomes dependent on search.** Today it's FTS5 trigram, with English-only stop-words and no semantics (memory in Portuguese loses precision). With many items, the top results (10 to 20) get noisy.
   - Path forward: qmd or embeddings (PR #175), filters by vault, project, and category, and boosting by `last_referenced`.
3. **Unchecked growth.** The review writes "generous" entries (#229); dedupe only catches identical text; auto-consolidation never fires.
   - Semantic dedupe or periodic merging, aging, and archiving are needed.
4. **Substring operations (`old_text`) become ambiguous** ("Multiple entries matched") as volume grows. Stable per-memory IDs are missing.
5. **O(n) cost per write.** Each mutation re-reads the entire file, rewrites everything, and creates a full recovery snapshot. Large files mean more sync churn on OneDrive and a higher chance of conflicts. One note per memory, or append-only, fixes this.
6. **LLM-based consolidation**, if kept, sends the entire store into the prompt and blows the context with large stores. It would need to be done in batches or by cluster.
7. **Background review also grows:** it sends the entire branch every 10 turns. This is already a cost today; `reviewRecentMessages` helps.

#### (c) Making everything configurable and building an onboarding flow

**What exists today:**
- A single JSON file, read once, with no writing, no schema, and a silent fallback.
- No setup command.
- `/memory-interview` only fills in the user's profile via the LLM.

**What to build:**
1. **A versioned config schema** (TypeBox, already a dependency). A loader that **reports** errors via `ctx.ui.notify` in `session_start`, and an atomic writer.
2. **Machine config** (absolute paths vary per PC) outside OneDrive, e.g. `~/.pi/agent/<package>-config.json`. Optionally a `vault.json` inside the vault for preferences that apply across all machines.
3. **A `/…-setup` command** with `ctx.ui.select`, `input`, and `confirm` (or `ctx.ui.custom` for a form). Steps:
   - detect OneDrive (the `OneDrive`, `OneDriveConsumer`, and `OneDriveCommercial` variables on Windows **(unverified)**);
   - detect vaults (folders with `.obsidian/` and the `%APPDATA%\obsidian\obsidian.json` registry **(unverified)**);
   - choose a folder and routing rules;
   - validate the write;
   - preview it (reusing `/memory-preview-context`);
   - save it and call `ctx.reload()`.
4. **Auto-trigger:** in `session_start`, if there is no config and `ctx.hasUI`, notify or offer the setup.
5. **Make configurable:** the review, flush, correction, and consolidation prompts (#229), the fixed limits, the Portuguese correction patterns, and the Portuguese stop-words.
6. **Inspiration from Hermes:** providers' `get_config_schema()` feeds `hermes memory setup`, a *schema-driven* setup (Part 3.7).

#### Reuse paths (trade-offs)

| Option | Pros | Cons |
|---|---|---|
| **Fork with a refactor** (extract `MemoryBackend`, a "vault" backend) | Reuses the 732 tests, review, correction, flush, scanner, search, and skills. MIT allows it. | The code is large (about 1 MB published) and coupled; it requires tracking an active upstream |
| **New package reusing modules** (`content-scanner`, `fts-query`, `schema`, `session-indexer/parser`, `review-memory-ops`, `pi-child-process`) | Clean, Obsidian-first design; legacy and migrations can be dropped | More work; loses the ready-made integration |
| **Contribute upstream** (a backend interface and `customInstructions`) | Benefits both sides; the author responds to issues quickly | Depends on acceptance; turnaround time is uncertain |

---

## Part 3: the origin: Hermes Agent's memory (Nous Research)

Sources:
- Repo: https://github.com/NousResearch/hermes-agent (MIT, "Copyright (c) 2025 Nous Research"; created on 2025-07-22; about 248k stars)
- Memory docs: https://hermes-agent.nousresearch.com/docs/user-guide/features/memory
- Code: https://github.com/NousResearch/hermes-agent/blob/main/tools/memory_tool.py

### 3.1 Limited memory: MEMORY.md and USER.md

- Files in `~/.hermes/memories/` (`HERMES_HOME/memories`):
  - `MEMORY.md`: agent notes, **2,200 characters** (about 800 tokens)
  - `USER.md`: user profile, **1,375 characters** (about 500 tokens)
- Delimiter: `§`.
- **Config** (`cli-config.yaml.example`, `memory:` section): `memory_enabled`, `user_profile_enabled`, `memory_char_limit: 2200`, `user_char_limit: 1375`, `nudge_interval: 10` ("every N user turns", 0 disables it), and `write_approval` (configuration docs).
  - Note: issue #16831 ("Configurable memory character limit (currently hardcoded at 2,200)") was closed as *not_planned* on 2026-06-10, but the current config example exposes the keys.
- **Rationale:**
  - Curated, **limited** memory keeps the system prompt small and forces curation.
  - The limits are measured in characters because that's model-independent (the config example uses about 2.75 characters per token).
  - **There is no auto-compaction.** On overflow, the tool returns an error with the current entries and the agent must consolidate within the same turn.

### 3.2 The `memory` tool

- **One** tool, `memory`, with `target` ∈ {`memory`, `user`}.
- Single-operation format: `action` ∈ {add, replace, remove}, `content` (or the `new_text` alias), `old_text` (a substring that **locates** the entry; `replace` overwrites the entire entry).
- **Batch format:** `operations: [{action, content?, old_text?}]`, applied atomically, with the limit checked **only on the final result**. This allows removing and adding in a single call to make room.
- The description instructs saving to memory only facts useful in **every** session. Task-specific learnings go into **skills** (`skill_manage`), which only load when relevant.
- Scans for injection, exfiltration, and invisible unicode, and rejects exact duplicates.

### 3.3 Frozen snapshot and the prefix cache

- The `memory_tool.py` docstring and the docs say the same thing: both files enter the system prompt as a **snapshot frozen at the start of the session**.
- Mid-session writes go straight to disk, but do **not** change the prompt until the next session.
- The stated reason is to **preserve the LLM's prefix cache** (predictable cost and latency in long sessions).

### 3.4 session_search (SQLite FTS5)

Source: https://github.com/NousResearch/hermes-agent/blob/main/tools/session_search_tool.py

- Searches the SQLite session database (`~/.hermes/state.db`) with FTS5.
- **No LLM calls:** returns real messages.
- Four formats inferred from the arguments: discovery (query, with dedupe across parent/child session *lineage*), scroll, read, and browse.
- Discovery has a default limit of 3 (max 10).

### 3.5 Skills from experience

Source: https://hermes-agent.nousresearch.com/docs/user-guide/features/skills

- The agent creates and updates skills with `skill_manage` when it solves a non-trivial workflow, recovers from errors, or receives corrections.
- Skills live in `~/.hermes/skills/` following the agentskills.io standard (`SKILL.md` with procedure, pitfalls, verification, and `references/`, `templates/`, `scripts/`, `examples/` subfolders), with *progressive disclosure*.
- `skills.write_approval: true` puts writes into staging for human approval.
- Hermes's background review includes a skills prompt (`_SKILL_REVIEW_PROMPT`, per pi-hermes-memory's PLAN.md).

### 3.6 External memory provider plugin

Sources:
- https://hermes-agent.nousresearch.com/docs/developer-guide/memory-provider-plugin/
- https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/memory-providers.md

- ABC `MemoryProvider` in `agent/memory_provider.py`. The plugin lives in `plugins/memory/<name>/` (`__init__.py`, `plugin.yaml`, `README.md`).
- **Required:** `name`, `is_available()` (no network), `initialize(session_id, **kw)`, `get_tool_schemas()`, `handle_tool_call()`, `get_config_schema()`, `save_config(values, hermes_home)`.
- **Optional hooks:**

| Hook | Function |
|---|---|
| `system_prompt_block()` | static provider information |
| `prefetch(query)` | context retrieved before the API call |
| `queue_prefetch(query)` | pre-warming for the next turn |
| `sync_turn(user, assistant, …)` | persist the conversation; **must be non-blocking** |
| `on_session_end(messages)` | extraction or final flush |
| `on_pre_compress(messages)` | save insights before discarding; there is an optional checkpoint contract |
| `on_memory_write(action, target, content)` | mirror writes to the backend |
| `shutdown()` | close connections |

- **Rule:** **only one** external provider active at a time, always **alongside** the built-in memory, never in place of it.
- Setup via `hermes memory setup / status / off`, or `memory.provider` in `config.yaml`.
- Providers: Honcho, OpenViking, Mem0, Hindsight, Holographic, RetainDB, ByteRover, Supermemory, Memori. **None target Obsidian.**

### 3.7 What pi-hermes-memory kept, changed, or dropped

| Aspect | Hermes | pi-hermes-memory (v0.9.9) | Status |
|---|---|---|---|
| Files and delimiter | MEMORY.md and USER.md, `§` | The same, plus `failures.md`, `STANDING.md`, and a project MEMORY.md | **Kept and expanded** |
| Limits | 2,200 / 1,375 (config) | 5,000 / 5,000 / 5,000 (v0.1 used 2,200/1,375); **ignored in policy-only** | **Changed** |
| No auto-compaction (error) | yes | `reject`, `fifo-evict`, and `auto-consolidate` strategies (the latter is the default; only applies in legacy) | **Changed** |
| Tool | one `memory` tool with `action` and batched `operations` | three tools (`memory_add`, `memory_replace`, `memory_remove`) plus `memory_search`. **The batch is not exposed to the LLM**; it only exists internally (`applyMutationPlan`). | **Changed** |
| Targets | memory, user | plus `project` and `failure` with 6 categories | **Expanded** |
| Injection | frozen snapshot **always** in the prompt | `policy-only` default (no content, the model searches); the snapshot only exists in `legacy-inject` | **Changed** (the main design difference) |
| Fencing | `build_memory_context_block()` | `<memory-context>` with a notice | **Kept** |
| Scanner | threat patterns and invisible unicode | the same, plus about 20 secret patterns | **Kept and expanded** |
| Background review | an agent thread or fork with memory and skill prompts; nudge every N user turns | direct `completeSimple` (JSON of operations) or `pi -p`; nudge by agent turns **or** tool calls; **does not create skills** | **Changed** |
| Flush | `flush_memories()` and `flush_min_turns` | `session_before_compact` and `session_shutdown`, with `flushMinTurns=6` | **Kept** |
| session_search | FTS5 with lineage, scroll, and read, no LLM | **trigram** FTS5 with snippets (legacy), or anchors over JSONL; also indexes live | **Changed** |
| Memory search | none (memory is always in the prompt) | SQLite mirror `memories` + `memory_fts` and `memory_search` | **New** |
| Skills | `skill_manage`, `~/.hermes/skills`, `write_approval` | `skill_manage` with pi's native SKILL.md and global or project scope; no approval | **Kept and adapted** |
| Correction detection, failure memory, aging (created/last), standing instructions, per-project memory | — | present | **New** |
| External provider (`MemoryProvider`) | present | planned (`MemoryOrchestrator`/`ExternalSync`, v0.5) and **not implemented** | **Dropped or deferred** |
| `write_approval` and the `memory_enabled`/`user_profile_enabled` toggles | present | not found **(absence not exhaustively verified)** | **Dropped** |

---

## Part 4: related pi packages

Sources: npm registry search for the `pi-package` keyword plus a term (https://registry.npmjs.org/-/v1/search?text=keywords:pi-package%20<term>) and the https://pi.dev/packages page. Dates and versions are from the registry as of 2026-09-23. The "author" column shows the npm *publisher*. The license is shown only when it was checked.

### 4.1 Memory and Obsidian (the most relevant)

| Package | Author | Version, date | Description (1 line) | Reuse? |
|---|---|---|---|---|
| [@tenchi4u/pi-obsidian-memory](https://github.com/the-matt-moo/pi-obsidian-memory) | tenchi4u | 0.1.0, 2026-08-26 | Memory in the vault (`$OBSIDIAN_PATH/pi/`: MEMORY.md, SCRATCHPAD.md, `daily/`), `PI_MEMORY_DIR`/`OBSIDIAN_PATH` env vars, **Windows notes**, qmd search, "stable" vs. "per-turn" snapshot with a 16K-character budget. MIT. | ⭐ **Strong reference** for configuring the vault path and for injection budgets |
| [pi-memory](https://github.com/jayzeng/pi-memory) | jayzeng | 0.4.2, 2026-08-11 | Memory with daily logs, long-term storage, and a scratchpad, plus semantic search via qmd. MIT. | Reference (qmd) |
| [@pify/memory](https://github.com/pifydev/memory) | hypnguyen1209 | 0.11.1, 2026-09-23 | Two-layer plain Markdown, **FTS5 via `node:sqlite`** (no native module), secret scanning, cache-stable injection. MIT. | ⭐ An idea for avoiding `better-sqlite3` on Windows |
| [common-memory-core](https://github.com/Mr-remon219/common-memory) | mr_remon | 0.4.3, 2026-09-15 | "User-owned Markdown memory" with durable maintenance, pi integration, and MCP. MIT. | Reference |
| [@zosmaai/pi-llm-wiki](https://github.com/zosmaai/pi-llm-wiki) | arjun-zosma | 0.12.2, 2026-09-11 | Self-maintained LLM wiki (Karpathy pattern), **Obsidian-compatible vault**, qmd, MCP. MIT. | This is the vault cited in issue #229 as a complementary layer to hermes |
| [pi-persistent-intelligence](https://github.com/Mont3ll/pi-persistent-intelligence) | mont3ll | 0.16.0, 2026-09-05 | "Governed" memory (L1/L2/L3, patches), session search, **optional** Obsidian integration; canonical storage in JSONL. MIT (npm). | Governance ideas |
| [pi-vault-mind](https://github.com/kylebrodeur/pi-vault-mind) | kylebrodeur | 0.16.36, 2026-08-30 | Passive Obsidian vault extension: `@agent` markers, subagents, LanceDB (vector, FTS, and graph). MIT. | Heavy; marker ideas |
| [@fancyrobot/agent-vault](https://github.com/TheFancyRobot/agent-vault) | sincspecv | 0.5.3, 2026-08-03 | Project memory in an Obsidian-compatible vault, with MCP. MIT; peers still on `@mariozechner/*`. | Reference (possibly outdated) |
| [knapsack-pi](https://github.com/acidsugarx/knapsack) | acidsugarx | 0.3.2, 2026-07-22 | Token reduction and persistent memory in Obsidian | Not inspected |
| [pi-obsidian-capture](https://github.com/Wormh0-le/pi-obsidian-capture) | wormh01e | 0.1.2, 2026-09-05 | Captures finished conversations into Obsidian | Capture idea |
| [@bacnh85/pi-obsidian](https://github.com/bacnh85/pi-extensions) | bacnh85 | 0.8.18, 2026-09-23 | Vault tools via the **Obsidian CLI**. MIT. | CLI-based access instead of fs |
| [@sfroment/pi-obsidian](https://github.com/sfroment/pi-obsidian) | sfroment | 1.0.14, 2026-09-16 | Typed tool over the Obsidian CLI. **GPL-3.0** | ⚠️ License incompatible for incorporating into MIT code |
| [pi-obsidian-cli](https://github.com/frNNcs/pi-obsidian-cli), [@capyup/pi-obsidian](https://github.com/capyup/pi-obsidian), [pi-obsidian-rest](https://github.com/mooreceipts/pi-obsidian-rest), [pi-obsidian-vault](https://github.com/itscool2b/pi-obsidian-vault) | various | 2026 | CLI and Local REST API wrappers, and human-approved access | Access alternatives |
| [@henryqw/pi-memory](https://github.com/HenryQW/pi-harness), [@samfp/pi-memory](https://github.com/samfoy/pi-memory), [pi-memory-md](https://github.com/VandeeFeng/pi-memory-md), [open-zk-kb](https://github.com/mrosnerr/open-zk-kb), [pi-observational-memory](https://github.com/elpapi42/pi-observational-memory), [@mem0/pi-agent-plugin](https://github.com/mem0ai/mem0), [pi-honcho](https://github.com/giuseppecrj/pi-honcho), [@luxusai/pi-hindsight](https://github.com/luxus/pi-hindsight) | various | 2026 | Other memory implementations: capped Markdown, Letta-like, Zettelkasten, observational, Mem0, Honcho, Hindsight | Comparison |
| hermes-memory forks: [@schovest/pi-hermes-memory](https://github.com/schovest/pi-package-mono), [@efrembaraldo/gsd-pi-hermes-memory](https://github.com/efrembaraldo/gsd-pi-hermes-memory) (MIT), GitHub forks (Arteiimis, podledges, Coder-Sang, Noir-Lime), and [jamiefutch/pi-hermes-memory-cleanup](https://github.com/jamiefutch/pi-hermes-memory-cleanup) | various | 2026 | Forks and utilities | Fork precedents (content not inspected) |

### 4.2 Spec-driven development

| Package | Author | Description | Note |
|---|---|---|---|
| [pi-sdd-extension](https://github.com/yswtrue/pi-sdd-extension) | GitHub Actions (yswtrue) | SDD workflow for pi. MIT. | |
| [@ifi/pi-spec](https://github.com/ifiokjr/oh-pi) | ifiokjr | Native spec-kit with `/spec` | |
| [pi-spec-builder](https://github.com/lleontor705/pi-spec-builder) | luisito15 | SDD and architecture planning | |
| [@mjasnikovs/pi-task](https://github.com/mjasnikovs/pi-task) | mjasnikovs | Deterministic planning and spec orchestration | Quite active (0.42.x) |
| [forte-spec](https://github.com/fortezhuo/forte-spec) | forte.zhuo | Forte-Spec + OpenSpec + Superpowers | |
| [@the-agency/pi-spec-kit](https://github.com/JoshMock/the-agency), [@cleepi/sdd](https://github.com/honzanemecek/cleepi), [@capyup/pi-specs](https://github.com/capyup/pi-specs), [@abianbiya/speclet and specflow](https://github.com/abianbiya/skills), [pi-gsd](https://github.com/fulgidus/pi-gsd), [pi-zense](https://github.com/zurge-co/pi-zense) | various | SDD variants (Spec Kit, GSD, single-file specs) | |

### 4.3 Plan mode and to-do

| Package | Author | Description | Note |
|---|---|---|---|
| `examples/extensions/plan-mode` (official) | earendil-works | Claude Code-style plan mode, `/plan`, read-only | ⭐ Official starting point |
| [@narumitw/pi-plan-mode](https://github.com/narumiruna/pi-extensions) | narumitw | Codex-style read-only `/plan` | |
| [@hank-warren/pi-plan-mode](https://github.com/hank-warren/pi-extensions) | hank-warren | Durable file-based plan that survives compaction | Persisted plan (pairs well with a vault) |
| [@plannotator/pi-extension](https://github.com/backnotprop/plannotator) | backnotprop | Interactive plan review with annotations | |
| [@alexeiled/pi-plan-exec](https://github.com/alexei-led/pi-plan-exec) | alexeiled | Markdown plan executed in isolation and resumable | |
| `examples/extensions/todo.ts` (official) | earendil-works | Todo tool and `/todos` with persisted state | ⭐ Reference for state in `details` |
| [@juicesharp/rpiv-todo](https://github.com/juicesharp/rpiv-mono) | juicesharp | Live overlay todo (about 159K/month on pi.dev) | |
| [@getpipher/armory-todo](https://github.com/getpipher/armory-todo), [pi-todo](https://github.com/mrg2400xx/pi-todo) | rz1989 / mrg2400xx | Global cross-session TODO; persistent per-project tracker | |

### 4.4 Subagents

| Package | Author | Description | Note |
|---|---|---|---|
| `examples/extensions/subagent` (official) | earendil-works | Delegation with isolated context windows | ⭐ Reference |
| [pi-subagents](https://github.com/nicobailon/pi-subagents) | nicopreme | Delegation and multi-agent workflows (about 455K/month). MIT. | Most popular |
| [@narumitw/pi-subagents](https://github.com/narumiruna/pi-extensions), [@agwab/pi-subagent](https://github.com/AgwaB/pi-subagent), [@pi-archimedes/subagent](https://github.com/danielcherubini/pi-archimedes), [@melihmucuk/pi-crew](https://www.npmjs.com/package/@melihmucuk/pi-crew) | various | Async jobs, minimal runtime, TUI streaming, and cost | |

### 4.5 Questionnaires and interviews (useful for onboarding)

| Package | Author | Description | Note |
|---|---|---|---|
| `examples/extensions/questionnaire.ts` and `question.ts` (official) | earendil-works | `questionnaire` tool (tabs, multiple questions) and `question` (select plus free text), built with `ctx.ui.custom` | ⭐ UI foundation for the wizard |
| [@juicesharp/rpiv-ask-user-question](https://github.com/juicesharp/rpiv-mono) | juicesharp | Structured questionnaire that the model applies (about 204K/month). MIT. | Direct reuse as a dependency |
| [pi-interview](https://github.com/nicobailon/pi-interview-tool) | nicopreme | Interactive interview form. MIT. | |
| [@firstpick/pi-extension-grill-me](https://github.com/Firstp1ck/pi-coding-agent-forge) | firstpick | Questionnaire-guided design interview, with persistence tooling | Persisted interview |
| [@dreki-gg/pi-questionnaire](https://github.com/jalbarrang/pi-questionnaire), [@dohmboy64bit/pi-qwizard](https://github.com/DohmBoy64Bit/pi-qwizard), [pi-grill-wizard](https://github.com/erazemkos/pi-grill-wizard), [pi-ask-popup](https://github.com/derangga/pi-extensions) | various | Multi-step wizards with validation | |

---

## 5. Unverified items and caveats

- **Line numbers** are approximate (the extractor misaligns numbering). Reliable anchors are function and constant names.
- **pi.dev download figures** (27K/month, 5,497/week) differ from the npm API (21,582 / 3,817). Methodology unknown.
- **The date of pi's rename** to `@earendil-works` (May 2026) comes from Wikipedia and was not confirmed against a primary source.
- **OneDrive behavior** with hard links, "Files On-Demand" placeholders, and `EPERM`/`EBUSY` locks during upload: these are risks to test empirically; they were not verified.
- **Obsidian:** that it ignores files with a leading dot, and the `%APPDATA%\obsidian\obsidian.json` path as the vault registry, are general knowledge not confirmed in this research. The same applies to the `OneDrive`, `OneDriveConsumer`, and `OneDriveCommercial` variables.
- **The `split('/')` bug in session-indexer:** inferred from reading the code, not reproduced.
- **A partially mutable "frozen snapshot" in `legacy-inject`:** inferred from the code, not measured.
- **READMEs** for @tenchi4u/pi-obsidian-memory and pi-persistent-intelligence were only read in summary. The latter's license in its README was not confirmed (npm says MIT). The other packages in Part 4 were not inspected beyond their metadata.
- **The Hermes docs:** state that the limits are configurable, and issue #16831 was closed as *not_planned*. The current config example has the keys, but the code that reads them was not checked.

## 6. Main sources

**pi-hermes-memory**
- https://github.com/chandra447/pi-hermes-memory. Files read via `raw.githubusercontent.com/chandra447/pi-hermes-memory/main/…`: `package.json`, `src/index.ts`, `src/config.ts`, `src/constants.ts`, `src/types.ts`, `src/paths.ts`, `src/project.ts`, `src/prompt-context.ts`, `src/memory-initialization.ts`, `src/store/*`, `src/tools/*`, `src/handlers/*`, `README.md`, `CHANGELOG.md`, `PLAN.md`, `AGENTS.md`, `docs/ROADMAP.md`, `docs/mermaid/*`, `tests/run-all.sh`, `.github/workflows/ci.yml`, and `LICENSE`
- File tree: https://api.github.com/repos/chandra447/pi-hermes-memory/git/trees/main?recursive=1
- Commits: https://api.github.com/repos/chandra447/pi-hermes-memory/commits
- Issues and PRs: #175, #216, #229, #245, #246, #247, #211, #238, #218 (via the CHANGELOG), #121
- npm and downloads: https://registry.npmjs.org/pi-hermes-memory · https://api.npmjs.org/downloads/point/last-month/pi-hermes-memory · https://pi.dev/packages/pi-hermes-memory

**pi**
- https://pi.dev · https://pi.dev/packages
- https://github.com/earendil-works/pi
- Docs: `packages/coding-agent/docs/{extensions,packages,settings,configuration,skills,sessions,windows}.md`
- Code: `src/core/extensions/types.ts`, `src/core/system-prompt.ts`, `src/core/package-manager.ts`
- Examples: `examples/extensions/{hello,prompt-customizer,question,questionnaire,README}`
- https://registry.npmjs.org/@earendil-works/pi-coding-agent · https://api.github.com/repos/earendil-works/pi/releases

**Hermes Agent**
- https://github.com/NousResearch/hermes-agent
- Code: `tools/memory_tool.py`, `tools/session_search_tool.py`, `cli-config.yaml.example`
- Docs: `website/docs/user-guide/features/memory.md`, `…/memory-providers.md`, `…/developer-guide/memory-provider-plugin.md`
- https://hermes-agent.nousresearch.com/docs/user-guide/features/skills · https://hermes-agent.nousresearch.com/docs/user-guide/configuration
- Issue #16831

**npm registry (Part 4)**
- `https://registry.npmjs.org/-/v1/search?text=keywords:pi-package%20{memory,obsidian,spec,plan,subagent,todo,questionnaire%20interview}`
- `https://registry.npmjs.org/<package>/latest` for the checked licenses
