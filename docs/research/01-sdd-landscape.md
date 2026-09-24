# 01 — How the community documents things so the LLM "doesn't lose its way"

> Study from 2026-09-23. A synthesis of appendices [A — toolkits](appendices/A-sdd-toolkits.md) and [B — practices and workflows](appendices/B-sdd-workflows.md), which have more detail and all the sources.
> Examples marked as **illustrative** were written by us to show the shape of each artifact; they are not copies of the original templates.

## Short answer

Yes. The movement has a name: **Spec-Driven Development (SDD)**, underpinned by a broader concept, **context engineering**.

- The Thoughtworks Radar (Apr/2026) placed *context engineering* in **Adopt**.
- SDD tools (Spec Kit, OpenSpec) appear in **Assess**.

The central idea is simple: **whatever needs to survive between sessions lives in versioned files, not in the conversation.** The agent interviews you, writes a short spec, and only then implements it. Implementation happens in a new session, one task at a time, leaving a trail in a state file and in git.

## The 7 patterns that repeat across every approach

Toolkit by toolkit, the details change, but the skeleton is the same. Each pattern below shows the shape in code.

### 1. A persistent rules file, short and human-written

pi and Claude Code both read `AGENTS.md` natively.
- **Claude Code:** since v2.1.277, it reads `AGENTS.md` when there is no `CLAUDE.md`. With both present, use `@AGENTS.md` inside `CLAUDE.md`. On Windows, prefer that import over a symlink.
- **pi:** loads `AGENTS.md`/`CLAUDE.md` from `~/.pi/agent/`, from parent directories, and from the cwd.

```markdown
<!-- AGENTS.md — illustrative: only what the agent can NOT infer from the code -->
# AGENTS.md
## Process rules (mandatory)
- Do NOT edit production code without a spec with `status: approved` in docs/specs/.
- New feature or a change touching > 2 files: interview the user first (one question at a time).
- Start of session: read docs/STATE.md, run `git log --oneline -15`, pick up the next unchecked task.
- End of task: run the tests, SHOW the output, check the checkbox, update STATE.md, commit.
- Reality diverged from the spec? STOP and ask. The spec gets fixed before the code.
## Commands
- Tests: `pnpm test` · Types: `pnpm typecheck`
```

> **Evidence:** the ETH Zurich study (arXiv 2602.11988, 2026) found that context files **do not improve** the overall success rate and **cost more than 20% extra** in inference. A general repository overview doesn't help; specific, non-obvious instructions are followed. The lesson is a **minimal file**, written by you, with rules — not a tour of the code.

### 2. Interview before the spec

There are three well-established styles:

| Style | Where it appears | How it works |
|---|---|---|
| **One question at a time** | Harper Reed, Superpowers, Spec Kit `/clarify` | Each question grows out of the previous answer, preferably multiple-choice |
| **Rounds with a recommended answer** | Matt Pocock `grill-me`, GSD | Asks the whole "frontier" of decisions at once, numbered, each with a recommendation |
| **Assumptions with evidence** | GSD (*assumptions mode*), HumanLayer | The agent reads the code, proposes assumptions, and you just confirm or correct them (2 to 4 interactions, versus 15 to 20) |

```text
# Interview prompt — illustrative (paraphrase of Anthropic's pattern)
I want to build <idea>. Interview me in detail (use AskUserQuestion if available).
Cover implementation, UX, edge cases, risks, and tradeoffs. Don't ask the obvious.
One question at a time, with options and your recommendation.
Record every answer. At the end, write the full spec to docs/specs/<topic>.md
and the unresolved questions to docs/OPEN-QUESTIONS.md. Don't write code.
```

### 3. A short spec as the source of truth

Anthropic recommends a **self-contained** spec: named files and interfaces, **explicit out-of-scope**, and an **end-to-end verification step**. For acceptance criteria, the most widely adopted format is EARS, used by Kiro and cc-sdd.

```markdown
<!-- docs/specs/2026-09-23-save-memory.md — illustrative -->
---
status: draft          # draft → approved (date + who approved it)
---
# Save memory to the vault
## Goal · ## In scope · ## Out of scope
## Requirements
- R-01 WHEN the agent calls memory_add THE system SHALL write the note to <vault>/<folder>.
- R-02 IF the file has changed since it was read THEN THE system SHALL abort with CONFLICT.
- R-03 WHILE OneDrive is paused THE system SHALL keep writing locally.
## Interfaces and files (paths, signatures)
## Decisions (→ ADRs) · ## Open questions (EMPTY before approval)
## End-to-end verification: `pnpm test:e2e` + check the note in Obsidian
```

### 4. Open-questions log + decision records

```markdown
<!-- docs/OPEN-QUESTIONS.md — illustrative -->
| ID   | Question                        | Options (★ recommended)      | Blocks? | Status    | Resolution |
|------|---------------------------------|-----------------------------|-----------|-----------|-----------|
| Q-01 | One vault or several?            | 1★ / N via config           | 🔴 yes    | open      |           |
| Q-02 | Name of the memory folder       | "Agent Memory"★ / other     | no        | delegated | at the agent's discretion |
```

Architectural decisions become an **ADR** in MADR 4.0 format (`docs/decisions/NNNN-title.md`): context, options, decision, and consequences. Common rule: **one open 🔴 question blocks spec approval.**

### 5. Plan broken into small tasks, with checkboxes and a verification command

```markdown
<!-- docs/specs/.../plan.md — illustrative (Superpowers/GSD style) -->
Goal: write memories to the vault with safe writes.
Spec: docs/specs/2026-09-23-save-memory.md
### Task 1: write with optimistic concurrency
Files: src/storage/vault-writer.ts · tests/storage/vault-writer.test.ts
- [ ] Write a failing test (hash conflict)          → `pnpm vitest run tests/storage`  (expected: FAIL)
- [ ] Implement the minimum                         → same command (expected: PASS)
- [ ] Commit: "feat(storage): write with expected hash"
```

### 6. State in a file + git + a new session per phase

```markdown
<!-- docs/STATE.md — illustrative (GSD uses < 100 lines) -->
phase: F1-storage · active_spec: docs/specs/2026-09-23-save-memory.md (approved)
active_plan: docs/specs/.../plan.md — 3/7 tasks
next action: Task 4 (OneDrive placeholder detector)
blockers: Q-07 (automatic pin?) waiting on the user
last session: 2026-09-23 18:30 — see docs/handoffs/2026-09-23_1830.md
```

Anthropic describes this for long-running agents like this:
- an *initializer agent* creates `feature_list.json` (the agent may only change the `passes` field), `claude-progress.txt`, and `init.sh`;
- each following session **gets its bearings**: it reads the progress and the `git log`, brings the environment up, runs a basic test, and works **one feature at a time**.

HumanLayer recommends keeping context usage between **40% and 60%**, saving progress to a file and restarting the session.

### 7. Executable verification + deterministic gates

"Looks done" doesn't count. What counts is the test command with its output shown. Instructions in `AGENTS.md` are *advisory*; for "never do X," use a **hook** (Claude Code) or an **extension** (pi).

```jsonc
// .claude/settings.json — illustrative, untested: blocks editing in src/ without an approved spec
{ "hooks": { "PreToolUse": [ { "matcher": "Edit|Write",
    "hooks": [ { "type": "command", "command": "node .claude/hooks/spec-gate.mjs" } ] } ] } }
// spec-gate.mjs reads docs/STATE.md → active_spec → requires "status: approved"; exit 2 = blocks and explains to the agent
```

---

## Ready-made toolkits and workflows: how they're used in practice

### GitHub Spec Kit (v1.0.10 · MIT · Python/uv · pi ✅ · Claude Code ✅)

The most formal about "ask before".

```bash
uv tool install specify-cli
specify init my-project --integration claude
specify integration install pi            # generates .pi/prompts/speckit.*.md
```
```text
Full flow (Claude: /speckit-X · pi: /speckit.X):
constitution → specify → clarify → plan → checklist → tasks → analyze → implement → converge

.specify/memory/constitution.md   ← principles, read by every command
specs/001-save-memory/{spec.md, plan.md, research.md, data-model.md, contracts/, tasks.md, checklists/}
```
- **`specify`:** makes "informed guesses" and leaves at most **3** `[NEEDS CLARIFICATION: …]` markers.
- **`clarify`:** up to **5 questions, one at a time**, each with a recommended option. Answers get recorded in the spec under `## Clarifications → ### Session AAAA-MM-DD`.
- **`implement`:** **stops and asks** if any checklist is incomplete.
- **`converge`:** compares code and artifacts and adds the missing tasks, which fights *drift*.
- **Cost:** a lot of markdown. Scott Logic measured 2,577 lines for one feature, in a version prior to 1.0.

### OpenSpec (v1.13.1 · MIT · Node · pi ✅ · Claude Code ✅)

The lightest one, with "living" specs.

```bash
npm install -g @fission-ai/openspec@latest
openspec init --tools claude,pi           # Claude: /opsx:propose · pi: /opsx-propose
```
```text
/opsx:explore → /opsx:propose <name> → (review) → /opsx:apply → /opsx:archive

openspec/
├── config.yaml                      ← context (injected into every planning step) + rules per artifact
├── specs/<capability>/spec.md       ← SOURCE OF TRUTH (current behavior)
└── changes/<id>/{proposal.md, design.md, tasks.md, specs/<cap>/spec.md (DELTA)}
    changes/archive/2026-09-23-<id>/ ← dated history
```
```markdown
<!-- delta spec — illustrative -->
## ADDED Requirements
### Requirement: Save memory
The system SHALL write the note to the configured vault when the agent calls memory_add.
#### Scenario: file changed by another device
- **WHEN** the current hash differs from the hash that was read
- **THEN** the write is aborted with CONFLICT and nothing is overwritten
```
- `openspec status --change X --json` shows what's ready or blocked, which helps you pick back up.
- **No rigid question gate:** `explore` never writes code, and `propose` only asks if the ambiguity is relevant. This is compensated for with `rules` in `config.yaml`.

### Kiro (AWS) — the format is worth adopting even without the tool (proprietary; doesn't run on pi or Claude Code)

```text
.kiro/steering/{product.md, tech.md, structure.md}   ← project memory; inclusion: always|fileMatch|manual|auto
.kiro/specs/<feature>/{requirements.md (EARS), design.md, tasks.md (_Requirements: 1.1_)}
```
**cc-sdd** replicates this flow for Claude Code and Codex, but doesn't support pi. Three ideas are worth copying: **EARS**, **steering with conditional inclusion**, and the bugfix workflow's "Unchanged Behavior" section.

### Superpowers (obra · v6.4.x · MIT · ~290k★ · pi ✅ · Claude Code ✅)

The best discipline for "ask before".

```bash
pi install git:github.com/obra/superpowers      # pi
# Claude Code: plugin via marketplace (see README)
```
```text
brainstorming → using-git-worktrees → writing-plans → (subagent-driven-development | executing-plans)
→ test-driven-development → requesting-code-review → finishing-a-development-branch

docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md   ← design approved section by section
docs/superpowers/plans/AAAA-MM-DD-<feature>.md       ← 2-to-5-minute tasks, with code, command, and commit
.superpowers/sdd/<plan>/progress.md                 ← ledger: "Task N: complete" = don't redo
```
- **Hard gate:** no code, scaffolding, or dependency before the design is approved.
- **Questions:** one per message, preferably multiple-choice.
- **Approaches:** proposes 2 to 3 with tradeoffs and a recommendation.
- **Classifies the task** as *spike*, *bounded*, or *architectural* and adjusts the ceremony accordingly; when in doubt, it picks the heavier one.

### GSD — "Get Shit Done" (today GSD Core v1.14 · MIT · heavy)

The one that most formalizes the **project** level.

```text
/gsd-new-project → /gsd-discuss-phase N → /gsd-plan-phase N → /gsd-execute-phase N → /gsd-verify-work N → /gsd-ship N
.planning/{PROJECT.md, REQUIREMENTS.md (IDs v1/v2/out), ROADMAP.md, STATE.md (<100 lines), HANDOFF.json}
.planning/phases/01-<name>/{01-CONTEXT.md, 01-01-PLAN.md, 01-01-SUMMARY.md, 01-VERIFICATION.md, 01-UAT.md}
```
- Each phase's `CONTEXT.md` separates three things: **locked-in decisions**, what's left **to the agent's discretion**, and **deferred ideas**.
- The original repository was archived in Jun/2026.
- There's churn: GSD 2 (`gsd-pi`) became its own CLI, built on top of pi's SDK.

### HumanLayer — Research → Plan → Implement (2025) and QRSPI (2026)

```text
thoughts/shared/{research/, plans/, handoffs/}      ← artifacts outside the code
/research_codebase → /create_plan → /implement_plan (checks off boxes in the plan; STOPS if reality diverges)
```
- **Leverage hierarchy:** one bad line of research turns into thousands of bad lines of code. That's why human review goes into the research and the plan.
- **2026 self-critique:** plans of around 1,000 lines **don't get read**.
- **New flow (QRSPI):** questions → "blind" research → **a ~200-line design discussion**, which becomes the main review point → vertical slices → **the human reads the code**.

### Harper Reed — the minimal flow that works with any agent

```text
1. "Ask me ONE question at a time so we can build a detailed spec for this idea…"  → spec.md
2. "Break the spec into small steps and generate one TDD implementation prompt per step" → prompt_plan.md
3. "Create a thorough checklist"                                                    → todo.md
4. Execution: "open prompt_plan.md, do the next unfinished item, test, commit, check it off"
```
Mario Zechner, pi's creator, recommends the same: pi **deliberately does not have** a built-in plan mode or to-do list, and the plan should live in `PLAN.md`/`TODO.md`.

### Others, in one line each

| Name | Artifacts | Note |
|---|---|---|
| **BMAD** (v6.12, pi ✅) | `_bmad-output/`, PRD, `SPEC.md` (Why/Capabilities/Constraints/Non-goals/Success), `sprint-status.yaml` | Comprehensive and with personas; heavy and with churn |
| **Agent OS** v3 | `agent-os/{product,standards,specs}/` | Became "standards + `/shape-spec`"; Claude Code only |
| **Task Master** | PRD → `tasks.json` (`next`, dependencies) | Stalled since Apr/2026; Commons Clause; no pi |
| **PRP** (Cole Medin) | `INITIAL.md` → `/generate-prp` → `PRPs/<feat>.md` → `/execute-prp` | Great at curated context and tiered validation; weak on interviewing |
| **Cline Memory Bank** | `memory-bank/{projectbrief, productContext, systemPatterns, techContext, activeContext, progress}.md` | "Read EVERYTHING at the start": simple, but doesn't scale |
| **Tessl** (tile) | `.spec.md` with `[@test]` links | Good idea: tracing requirement → test |
| **pi-sdd-kit** | `.ai/steering`, `.ai/sdd/specs`, `.status` | Native to pi, but immature (~29★) |

---

## And what changes when the problem is a **project**, not a feature?

Feature-level toolkits (Spec Kit, OpenSpec, Superpowers) assume the project already exists. For a new project with several subsystems, like the memory one, a **project layer** gets added beforehand. It shows up in GSD, in BMAD, and in Anthropic's initializer:

```text
Research (this study) → Vision → Requirements with an ID (v1 / v2 / out) → Short architecture + ADRs
→ Roadmap in phases → [per phase: interview → short spec → plan → a new session implements → verification]
```

The concrete proposal for your case is in [05-reuse-proposal.md](05-reuse-proposal.md).
