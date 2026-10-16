# pi-hermes-memory — research notes

Clone: `D:\Projects\_ref\pi-hermes-memory` · commit `24fcd8ad26fc27badb8d7dbaf8034645de07b893` · v0.9.10 · MIT
Entry: `package.json` `"pi": {"extensions": ["./src/index.ts"]}` (package.json:21-23). Single default export `src/index.ts:~100`.
Storage is SQLite FTS5 + Markdown (not Obsidian). Not directly reusable as storage; ideas below.

## 1. Automatic capture
- `turn_end` → background review (`src/handlers/background-review.ts:198`). Counts turns and assistant `toolCall` blocks (`:203-216`). Fires when `turnsSinceReview >= nudgeInterval` (default 10, `constants.ts:26`) OR `toolCallsSinceReview >= nudgeToolCalls` (default 15, `constants.ts:28`), and only if `userTurnCount >= 3` (`background-review.ts:223`). Counters reset on fire (`:225-226`). Skipped if a review is active (`:201`).
- `message_end` counts user messages (`background-review.ts:192-196`).
- Review prompt: `COMBINED_REVIEW_PROMPT` (`src/constants.ts:243`); skills excluded from review (`:256`). Direct-mode system prompt `DIRECT_REVIEW_SYSTEM_PROMPT` (`constants.ts:286`), returns `{"operations":[...]}` JSON (`:296`).
- Flush on compaction and shutdown: `session-flush.ts:158` (message_end), `:277` `session_before_compact`, `:284` `session_shutdown`. Prompt `FLUSH_PROMPT` (`constants.ts:336`), `DIRECT_FLUSH_SYSTEM_PROMPT` (`:300`). Min turns `flushMinTurns`=6 (`constants.ts:27`).
- Correction detection: `correction-detector.ts:143` (message_end flags user text matching `isCorrection`), `:153` (turn_end saves). Prompt `DIRECT_CORRECTION_SYSTEM_PROMPT` (`constants.ts:322`).
- Dedupe: exact-match only — `memory-store.ts:258-266` ("Entry already exists"); write path `:424-436` compares decoded text (+project for failures).
- Safety: `store/content-scanner.ts:7-12` regex threat patterns (prompt injection, role hijack, invisible chars) applied on every write (`memory-store.ts:431`).
- Live session indexing: `index.ts:403` message_end → `scheduleLiveSessionIndex`.

## 2. Injection into context
- `before_agent_start` (`src/index.ts:305-327`), every turn. Appends via `event.systemPromptOptions.appendSystemPrompt` on pi 0.86+ (`:312-318`); fallback returns `systemPrompt` (`:322-324`).
- Content from `buildPromptContext` (`src/prompt-context.ts:33-60`): policy-only mode injects only policy text + standing instructions (default mode); legacy mode injects memory blocks + project block + standing.
- Policy text: `MEMORY_POLICY_PROMPT` (`constants.ts:111`, full) / `_COMPACT` (`:165`); styles full|compact|custom|none (`prompt-context.ts:8-24`).
- Block format: `fenceBlock` wraps in `<memory-context>` with a "NOT new user input" guard (`memory-store.ts:783-791`). Failure block: last N failures within age window (`memory-store.ts:599-608`).
- Budgets: memory/user char limit 5000 each (`constants.ts:14-15`); failures max 5 entries, 7 days (`constants.ts:73-74`); standing instructions max 20 entries / 2000 chars (`constants.ts:107-108`).
- session_start (`index.ts:292`) only loads standing pins, skills, and bind project. Memory is a frozen snapshot per session (`memory-store.ts` `snapshot`).

## 3. Tools and commands
Write tools (`src/tools/memory-tool.ts:417` registerTool, names from `constants.ts:199`):
- `memory_add` — params `content` (string), `category?` (enum failure|correction|insight|preference|convention|tool-quirk), `failure_reason?`, target enum memory|user|project|failure (`memory-tool.ts:454-466`).
- `memory_replace` — `old_text` (substring), `content` (`:468-478`).
- `memory_remove` — `old_text` (`:481`).
- `memory_search` (`memory-search-tool.ts:33-58`): `query`, `project?`, `target?`, `category?`, `limit?` (default 10, max 20).
- `session_search` (`session-search-tool.ts:68,148`): `query`, `project?`, `role?`, `limit?`, `snippetChars?` (markdown variant at `:97`).
- `skill_manage` (`skill-tool.ts:93-109`): name, skill_id, scope, content, procedure_steps, pitfalls, verification_steps, etc.
Commands: `/memory-consolidate` (auto-consolidate.ts:636), `/memory-index-sessions` (index-sessions.ts:16), `/memory-insights` (insights.ts:71), `/memory-interview` (interview.ts:17), `/learn-memory-tool` (learn-memory.ts:8), `/memory-preview-context` (preview-context.ts:33), `/memory-skills` (skills-command.ts:1262), `/memory-pin` (standing-pin.ts:53), `/memory-switch-project` (switch-project.ts:18), `/memory-sync-markdown` (sync-markdown-memories.ts:262).

## 4. LLM calls from the extension
- In-process: `completeSimple` from `@earendil-works/pi-ai/compat` (`review-memory-ops.ts:6`), `complete(` at `:811`. Model = `ctx.model` or config override chain resolved via `ctx.modelRegistry.getAll()` (`review-memory-ops.ts:222-234`, `:759`). Auth via `modelRegistry.getApiKeyAndHeaders` (`:327`); retry with rotated auth (`:835`).
- Subprocess fallback: spawns `pi -p --no-session --model ...` (`src/handlers/pi-child-process.ts:307-325`) with `--no-extensions` (`:278`), `--tools memory_add,memory_replace,memory_remove` (`:293`), `--exclude-tools mcp__*` (`:298`); child marked by env `PI_HERMES_MEMORY_CHILD=1` (`:70`).

## 5. Search and relevance
- Text only, SQLite FTS5 + BM25: `sqlite-memory-store.ts:852-889` (`memory_fts MATCH ?`, `ORDER BY rank_score ASC, last_referenced DESC`). Query sanitising/stop words: `store/fts-query.ts:7-42`, `:100-124`. No embeddings found (`grep` embedding/vector: none).
- No separate LLM relevance step at query time; injection is unconditional (whole snapshot). Usage tracking: `usageHitTrackingEnabled`.

## 6. Skills
- Procedural skills in `SKILL.md` under `<agentRoot>/pi-hermes-memory/skills/<slug>/SKILL.md` (`store/skill-store.ts:4-5`, `:252`). Created at runtime via `skill_manage`; no SKILL.md is shipped in the repo.
- package.json `files` ships only `src`, `scripts`, README, LICENSE, docs (package.json:7-13). No `"skills"` key. Discovery via `resources_discover` hook (`index.ts:88-91`).

## 7. Blocking file access / Claude Code auto-memory
- Not found. Grepped `src` for `tool_call`, `block`, `deny`, `claude`, `auto-memory`: no hits relevant to blocking. Only `pi-claude-auth` in an extension allowlist (`pi-child-process.ts:161`). No `.claude` integration in code (only `.claude/agents/semble-search.md` dev file in repo).

## Unknown / not checked
- Full bodies of review-memory-ops.ts parse/validate logic and memory-store snapshot semantics (not read line-by-line).
- Tests (`tests/`) and docs/0.7 plans were not read.
