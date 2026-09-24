# 05 — Proposal: what we are going to reuse

> **Draft for discussion.** Nothing here is decided. Each choice has a question ID in [06-open-questions.md](06-open-questions.md), and the ★ marks the recommendation.
> The proposal has two parts:
> - **(1) methodology**, which applies to all your projects;
> - **(2) the memory project** itself.

---

## Part 1 — Methodology: how we will document so the LLM doesn't get lost

### 1.1 Possible tracks (decision **Q-M1**)

| Track | What it is | When to choose it |
|---|---|---|
| **A ★ OpenSpec + project layer + our own question gate** | OpenSpec handles specs and changes (runs on pi and on Claude Code). `docs/` holds vision, requirements, ADRs, STATE and questions. An `/interview` prompt and a rule in `AGENTS.md` create the "ask before" gate | You want to reuse a mature, lightweight tool with short artifacts, which is what the evidence favors |
| **B Spec Kit + project layer** | Spec Kit does the gating on its own: `clarify` with up to 5 questions recorded in the spec, checklists that block `implement`, `analyze` and `converge`. `constitution.md` holds your rules | You want **the tool itself** to enforce "ask and check before" and you accept more markdown to review |
| **C Superpowers** | End-to-end discipline: brainstorming with a hard gate → plan with TDD → execution with a ledger | You prefer an opinionated, ready-made flow focused on execution with TDD |
| **D Our own 100% kit** | Just `docs/` + 4 prompts (`/interview`, `/spec`, `/plan`, `/implement`), Harper Reed + GSD style | Zero dependency, full control; you maintain everything |

**Why ★A:**
1. Official support for pi and for Claude Code with a single `openspec init --tools claude,pi`.
2. Runs on Node, no Python.
3. Has **living** specs: the system's behavior accumulates in `openspec/specs/`, which serves a long-running system like the memory one well.
4. Thoughtworks rated it well for being lightweight.

The gap it has, the lack of a question gate, costs us about 30 lines, borrowing the *clarifications* format from Spec Kit and the hard gate from Superpowers.
**Don't install two SDD toolkits at the same time**: they create two sources of truth.

### 1.2 Global layer (all your projects)

```markdown
<!-- ~/.pi/agent/AGENTS.md  — and, in Claude Code, ~/.claude/CLAUDE.md containing: @~/.pi/agent/AGENTS.md (untested import) -->
# Personal rules (all projects)
- New project or non-trivial feature: research → interview → document → approve BEFORE any code.
- Every feature is configurable (key, default, validation) and appears in a configuration onboarding.
- Questions: one at a time, with options and your recommendation. Log answers in docs/OPEN-QUESTIONS.md.
- Language: pt-BR. Explain with code (trees, snippets, commands).
```

### 1.3 Structure of each project (track A)

```text
<project>/
├── AGENTS.md                      # ≤ 60 lines: rules + commands (pi and Claude Code read natively)
├── CLAUDE.md                      # optional: "@AGENTS.md" + extras only for Claude Code
├── docs/
│   ├── STATE.md                   # < 100 lines: phase, active change, next action, blockers
│   ├── OPEN-QUESTIONS.md          # Q-xx; 🔴 open blocks approval
│   ├── 00-vision.md               # problem, goal, users, OUT of scope, success metrics
│   ├── 01-requirements.md         # REQ-xx in EARS; v1 / v2 / out; config + onboarding per requirement
│   ├── 02-architecture.md         # ≤ 2 pages; diagrams; points to the ADRs
│   ├── 03-roadmap.md              # phases F0..Fn; each phase becomes one or more OpenSpec changes
│   ├── decisions/0001-*.md        # ADRs (MADR 4.0)
│   ├── research/                  # THIS study (00..06 + appendices)
│   └── handoffs/                  # handoff notes when pausing partway through something
├── openspec/
│   ├── config.yaml                # context + rules (below)
│   ├── specs/…                    # current behavior, source of truth
│   └── changes/<id>/…             # proposal · design · tasks · delta specs → archive/YYYY-MM-DD-<id>/
├── .pi/prompts/interview.md       # /interview in pi
├── .claude/commands/interview.md  # /interview in Claude Code (same file)
└── .claude/settings.json          # optional: hook that blocks Edit/Write in src/ when a 🔴 question is open
```

### 1.4 The "glue" files (our part)

**The memory project's `AGENTS.md`**, which translates your rules into verifiable instructions:

```markdown
# AGENTS.md — pi-obsidian-memory (working name)
## Where we are
Read docs/STATE.md before anything else: it points to the phase, the active change and the next action.
## Process rules (mandatory)
1. No production code without: change approved in OpenSpec AND no 🔴 open question in docs/OPEN-QUESTIONS.md.
2. A doubt that affects scope, observable behavior, on-disk format or user data → ask
   (one at a time, options + recommendation) and log it in docs/OPEN-QUESTIONS.md. Don't assume.
3. Every requirement declares (a) its configuration — key, default, validation — and (b) its onboarding step (/memory-setup).
4. A decision that's hard to reverse (on-disk format, tools API, data location) → ADR in docs/decisions/.
5. Reality diverged from the spec → STOP: expected / found / impact / how to proceed? The spec comes before the code.
6. End of task: run the tests and SHOW the output; check the checkbox; update docs/STATE.md; commit.
## Data safety (OneDrive)
- Never write SQLite, locks, recovery temp files or .git inside the vault/OneDrive.
- Never overwrite a vault note without a full read + hash. Never delete: move to archive/.
## Commands
- (fill in at F1: tests, typecheck, lint)
```

**`/interview`**, a prompt template that works the same way in pi (`.pi/prompts/`) and in Claude Code (`.claude/commands/`):

```markdown
---
description: Discovery interview before any spec or code
---
Topic: $ARGUMENTS
1. BEFORE asking, read docs/STATE.md, docs/OPEN-QUESTIONS.md, the relevant docs and the code.
   Don't ask what you can find out by reading.
2. ONE question per message, with 2–4 options, short pros and cons and your recommendation (★). Accept a free-form answer.
3. Order: blockers (🔴) > hard to reverse > the rest. Skip the obvious; dig deeper where I hesitate.
4. After each answer, update the line in docs/OPEN-QUESTIONS.md (status + resolution).
   Architectural decision → ADR draft.
5. When done (or when I say "that's enough"): summarize the decisions, list what's still 🔴 and propose
   the next artifact. Do NOT write code.
```

**`openspec/config.yaml`**, with the rules injected into all OpenSpec planning:

```yaml
schema: spec-driven
context: |
  pi extension (TypeScript/ESM) that writes the agent's memory to Obsidian vault(s) on OneDrive (Windows 11).
  Project docs in docs/ (vision, requirements, ADRs, STATE, OPEN-QUESTIONS); research in docs/research/.
rules:
  proposal:
    - List "Open questions". If there is a 🔴 question tied to this change in docs/OPEN-QUESTIONS.md, STOP and ask.
    - Declare the new configuration keys (name, default, validation) and the onboarding step affected.
  specs:
    - Requirements with SHALL/MUST and at least one WHEN/THEN scenario; cite the REQ-xx from docs/01-requirements.md.
  design:
    - Every write to the vault uses a full read + hash + shrink guard; SQLite and locks never on OneDrive.
  tasks:
    - Each task fits in one session and comes with a verification command (e.g., npx vitest run <file>).
```

### 1.5 The ritual

```text
ONCE PER PROJECT
  research (this study) → /interview vision → 00-vision · 01-requirements · 02-architecture · 03-roadmap · ADRs → YOU APPROVE

PER PHASE / FEATURE
  /opsx:explore → /interview <topic> (if there's a 🔴) → /opsx:propose → YOU REVIEW AND APPROVE
  → NEW SESSION → /opsx:apply (1 task at a time · TDD · shows the output · checkbox · STATE) → YOU READ THE DIFF
  → /opsx:verify (expanded profile) → /opsx:archive
  (in pi the commands use hyphens: /opsx-propose, /opsx-apply…)

ALWAYS
  context above ~60% or a phase change → update STATE (or handoff) → new session
```

---

## Part 2 — The memory project: what to reuse

### 2.1 The decision that defines all the others: the vault format (**Q-02**)

| Format | How it looks in Obsidian | Consequence |
|---|---|---|
| **Keep the pi-hermes-memory format** (single `MEMORY.md`, entries separated by `§`, metadata in an HTML comment) | One large file per scope, not very navigable, no links or properties. Every write rewrites the entire file, which causes more conflicts on OneDrive | Favors the **fork** (the tests remain valid) |
| **★ Obsidian's native format** (`MEMORY.md` index + one note per memory with frontmatter, a stable `id`, wikilinks and a per-device daily log) | Navigable, searchable, can link to your notes and build a dashboard with Bases | Favors a **new package** that reuses modules |

### 2.2 Reuse strategy (**Q-01**)

**★ New package, Obsidian-first, reusing modules from pi-hermes-memory** (MIT, keeping the copyright notices from Chandra Teja and Nous Research). The reasons:

1. The layer we would have to rewrite anyway is exactly the one that conflicts with OneDrive and with the native format:
   - single-file persistence;
   - hard links;
   - recovery snapshots;
   - SQLite lock in the parent folder;
   - native `better-sqlite3`.
2. The package's "brain" is modular and reusable: prompts, review protocol, correction detector, flush, scanner and session search.
3. The upstream publishes releases every week, and a deep fork would diverge quickly.
4. Whatever is generic can be **contributed back**, such as the Windows fixes (#245/#247, `split('/')`) and the configurable prompts (#229).

The alternative is the **fork with refactor**, if the answer to Q-02 is "keep the `§` format". Details in [03](03-pi-hermes-memory-anatomy.md#three-reuse-paths).

### 2.3 Module-by-module map (★ new package)

| Source | Module | Decision | Reason |
|---|---|---|---|
| pi-hermes-memory | `store/content-scanner.ts` | ♻️ **Reuse** | Blocks prompt injection and secrets. It matters even more because the vault is edited by humans and by other devices |
| pi-hermes-memory | `constants.ts`: policy, tool descriptions, review, flush and correction prompts | ♻️ **Reuse and adapt** | Adapt for pt-BR and for the vault (wikilinks, lean notes) and make it configurable (#229) |
| pi-hermes-memory | `tools/*`: names and semantics of `memory_add/replace/remove/search` | ♻️ **Reuse the API** | Continuity for whoever uses the original. Add a stable `id` (substring becomes ambiguous at scale) and `memory_get` |
| pi-hermes-memory | `prompt-context.ts` (`policy-only`) | ♻️ Reuse the idea | Stable policy in the system prompt, cache-friendly |
| pi-hermes-memory | `legacy-inject` mode | ❌ Drop | Not viable without limits. Instead: **active recall with a budget** on the `context` event (idea from PR #216) |
| pi-hermes-memory | `handlers/background-review.ts` + `review-memory-ops.ts` (operations JSON) | ♻️ **Reuse** | This is the learning engine. Use `reviewRecentMessages` so as not to send the whole branch |
| pi-hermes-memory | `handlers/correction-detector.ts` | ♻️ Reuse and adapt | Patterns in pt-BR, configurable |
| pi-hermes-memory | `handlers/session-flush.ts` | ♻️ Reuse | Flush before compaction and at shutdown |
| pi-hermes-memory | `store/fts-query.ts`, `schema.ts`, `sqlite-memory-store.ts` | 🔧 Adapt | pt-BR stop-words; `unicode61 remove_diacritics 2` tokenizer; a "vault" dimension; **`node:sqlite`** instead of `better-sqlite3` (the @pify/memory model) |
| pi-hermes-memory | `store/db.ts` | 🔧 Adapt | Explicit and **local** `dbPath`; index rebuildable from the vault |
| pi-hermes-memory | `store/session-indexer.ts` + `session-search*` | ♻️ Reuse and fix | Fix `cwd.split('/')` on Windows; keep the local index |
| pi-hermes-memory | `store/memory-store.ts` (persistence) | 🔁 **Replace** | With `VaultBackend`: one note per memory, hash, `.tmp` + rename with retry, shrink guard, no hard links, placeholder and conflict-copy detection |
| pi-hermes-memory | `markdown-mutation-lock.ts`, `atomic-lock-coordinator.ts` | 🔁 Replace | Simple local locks, without the PowerShell probe on load (#245) |
| pi-hermes-memory | `auto-consolidate.ts` (triggered by limit overflow) | 🔁 Replace | Consolidation and dedup **outside the flow**, with proposals in `inbox/` for you to review in Obsidian |
| pi-hermes-memory | `config.ts` (JSON read once, silent fallback) | 🔁 **Rewrite** | Versioned schema (TypeBox), visible errors, atomic write, machine config vs. vault config |
| pi-hermes-memory | `/memory-interview` | ♻️ Reuse | Becomes the "profile" step of onboarding |
| pi-hermes-memory | `skill-store.ts`, `standing-instructions.ts` | ❓ Decide (Q-G5) | Skills and standing rules in the vault or local? |
| pi-hermes-memory | Migrations (`extension-root`, `project-memory`) | ❌ Drop | Instead: optional **import** of existing memories (Q-A4) |
| **new** | `/memory-setup` (wizard) + `/memory-doctor` | 🆕 | `ctx.ui.select/input/confirm` + `ctx.reload()`; wizard checklist in [04](04-obsidian-onedrive-memory.md#auto-detection-for-onboarding) |
| basic-memory (ideas, AGPL) | stable id, atomic facts, `[[wikilink]]` relations, `expected_checksum` | 💡 Reimplement the idea | Don't copy code (AGPL) |
| OpenClaw | Daily log + today/yesterday at the start, flush with `NO_REPLY`, hybrid ranking + decay + MMR | 💡 Ideas and constants | Retrieval for unlimited memory |
| Claude Code auto-memory / Letta | 1-line-per-memory index; `type`; `pinned`; `description` | 💡 Format | Progressive disclosure |
| @tenchi4u/pi-obsidian-memory (MIT) | Vault path config, notes for Windows, snapshot budget | 🔍 Read before starting | It's the closest precedent |
| kepano/obsidian-skills (MIT) | `obsidian-markdown` skill (+ `obsidian-bases`) | ♻️ Package or reference | Makes the LLM write valid Obsidian Markdown; `.base` dashboard of memories |

### 2.4 Target architecture (draft)

```text
pi ── extension ─┬─ tools: memory_add · memory_search · memory_get · memory_update · memory_forget (+ session_search, skill_manage?)
                ├─ events: session_start · before_agent_start (stable policy) · context (active recall with budget)
                │           turn_end (review) · session_before_compact (flush) · session_shutdown
                ├─ core: scanner · IDs · dedupe · ranking (BM25 + decay [+ vector]) · consolidation → inbox/
                ├─ VaultBackend (FS-first): hash · tmp+rename with retry · shrink guard · placeholders · conflicts
                │     └─► <Vault>/Agent Memory/**.md        ← ONLY Markdown on OneDrive
                ├─ Index (node:sqlite FTS5 pt-BR) ─► ~/.pi/agent/<package>/index/   ← local (Q-C4)
                ├─ Config (versioned schema) ─► ~/.pi/agent/<package>/config.json (+ optional: preferences in the vault)
                └─ Onboarding: /memory-setup · /memory-doctor · (profile step = /memory-interview)
[optional] Obsidian CLI adapter (app open): move/rename with link updates, backlinks
[optional] Claude Code: MCP server or skill on top of the same core
```

### 2.5 Roadmap (draft: becomes `docs/03-roadmap.md` after the answers)

| Phase | Deliverable | Code? |
|---|---|---|
| **F0 Discovery** | Answers from [06](06-open-questions.md) → vision, requirements (EARS), architecture, ADRs. Two disposable *spikes*, only with your authorization: **(a)** read the pi-hermes-memory code locally to confirm the cut points; **(b)** test real OneDrive in a test folder (placeholder, rename, conflict, version history) | No (the spikes are thrown away) |
| **F1 Skeleton + config + minimal onboarding** | pi package, config schema, `/memory-setup` (vault + folder + pin), `/memory-doctor` | Yes |
| **F2 Safe VaultBackend** | Note format, safe reads and writes, placeholders, conflicts, tests with a temporary vault | Yes |
| **F3 Tools + index** | `memory_add/search/get/update/forget`, FTS5 pt-BR, policy, scanner | Yes |
| **F4 Automation** | Review, correction in pt-BR, flush, active recall with a budget | Yes |
| **F5 Obsidian and maintenance** | Consolidation (`inbox/`), `.base` dashboard, optional CLI adapter, import from pi-hermes-memory | Yes |
| **F6 Optional** | Multilingual vectors; exposure to Claude Code (MCP/skill) | Yes |

### 2.6 Revised kickoff prompt (a version of your original prompt)

```text
Project: long-term memory for pi reusing pi-hermes-memory, writing to Obsidian vault(s)
on my OneDrive, without the current limits, 100% configurable and with configuration onboarding.

Rules (non-negotiable):
1. No code before: research logged, 🔴 questions answered in docs/OPEN-QUESTIONS.md and spec approved.
2. Every requirement declares its configuration and its onboarding step.
3. docs/STATE.md says where we are; update it at the end of each step. New session each phase.

Already researched: docs/research/ (study from 2026-09-23). Read README.md, 03, 04 and 05 before anything else.

Current step: F0 — DISCOVERY.
- Interview me using docs/research/06-open-questions.md as the script: one question at a time, with options and
  your recommendation; skip what I've already answered; dig deeper where I hesitate.
- Log every answer in docs/OPEN-QUESTIONS.md and every hard-to-reverse decision as an ADR in docs/decisions/.
- At the end, propose docs/00-vision.md, 01-requirements.md (EARS; v1/v2/out), 02-architecture.md and 03-roadmap.md,
  and STOP for my approval. Don't write code.
```
