# B — "Documentation-first / spec-driven" workflows and context engineering patterns for coding agents (pi + Claude Code)

> Research conducted on **2026-09-23**. Scope: workflows, practices, and *context engineering* patterns (the large toolkits — Spec Kit, OpenSpec, Kiro, BMAD, Agent OS, Task Master — are covered by another researcher and appear here only in passing).
>
> Conventions:
> - **illustrative example** = text/structure written by me, in my own words, inspired by the source (not a copy).
> - **unverified** = I could not confirm this in a primary source.
> - Dates in YYYY-MM-DD format. Versions noted when found.
> - All third-party content has been paraphrased; prompts appear as a "gist" (summary of intent), not verbatim.

---

## Contents

0. [Executive summary](#0-executive-summary)
1. [Anthropic — official guides](#1-anthropic--official-guides)
2. [obra/superpowers](#2-obrasuperpowers-jesse-vincent)
3. [GSD — Get Shit Done](#3-gsd--get-shit-done)
4. [HumanLayer — ACE / RPI → QRSPI](#4-humanlayer--advanced-context-engineering-rpi--qrspi)
5. [Harper Reed — "My LLM codegen workflow atm"](#5-harper-reed--my-llm-codegen-workflow-atm)
6. [Context Engineering template / PRP](#6-context-engineering-template--prp)
7. [AGENTS.md (+ how pi and Claude Code load context)](#7-agentsmd-open-standard--loading-in-pi-and-claude-code)
8. [Cline Memory Bank](#8-cline-memory-bank)
9. [Supporting formats (ADR/MADR, EARS, decision log, open questions, llms.txt, others)](#9-supporting-formats)
10. [Criticism and evidence](#10-criticism-and-evidence)
11. [Synthesis: recurring patterns (practical checklist)](#11-synthesis-recurring-patterns--practical-checklist)
12. [Application sketch for pi + Claude Code](#12-application-sketch-for-pi--claude-code)
13. [Consolidated sources](#13-consolidated-sources)

---

## 0. Executive summary

All sources converge on the same core:

1. **Context is a scarce resource that degrades** (*context rot*). What needs to survive between sessions must live in **version-controlled files** (spec, plan, state, decisions), not in the conversation.
2. **Before coding, the agent interviews** the human (one question at a time, or in rounds with a recommended answer), and the result becomes a **short spec** with out-of-scope items, decisions, open questions, and an end-to-end verification criterion.
3. **Implementation happens in a fresh context**, based on a **plan with small, verifiable, checkbox tasks**, one task/feature at a time.
4. A **state/progress file + git** allows resuming without "memory" (the agent re-reads the state, the log, and the next task).
5. **Executable verification** (tests, E2E, TDD) and **review by a separate agent** replace optimistic self-assessment.

Anthropic makes this official: interview via `AskUserQuestion` → `SPEC.md` → fresh session; explore → plan → implement → commit with *plan mode*; a short `CLAUDE.md` (< 200 lines); for long tasks, an *initializer agent* + `feature_list.json` (only the `passes` field changes) + `claude-progress.txt` + `init.sh` + git, one feature at a time. **Superpowers** (v6.4.1, 2026-09-18; runs on pi via `pi install git:github.com/obra/superpowers`) imposes a *hard gate*: brainstorming → approved design doc → plan with 2–5 min tasks in TDD → execution with a *ledger*. **GSD** (today GSD Core v1.14.0; GSD 2 is a CLI built on the **Pi SDK**) formalizes `PROJECT/REQUIREMENTS/ROADMAP/STATE` + `CONTEXT/PLAN` per phase, with executors in a clean context. **HumanLayer** found that RPI with ~1,000-line plans fails because humans don't read them; in 2026 it migrated to **QRSPI**: questions → "blind" research → ~200-line *design discussion* (the main review point) → outline → plan → vertical slices → read the code. **Harper Reed** and **PRP** are lightweight variants (`spec.md` → `prompt_plan.md` → `todo.md`; `INITIAL.md` → PRP → execution). **Cline Memory Bank** and **AGENTS.md** cover project memory — but the evidence (ETH Zurich, 2026: LLM-generated files don't help or make things worse, and all of them cost ~20% more tokens; Thoughtworks: "agent instruction bloat" under Caution) calls for minimal, human-written files containing only what can't be inferred from the code.

The criticisms (Böckeler, Thoughtworks, Marmelab, Kent Beck) say heavyweight SDD turns into *waterfall with markdown*: double review, a false sense of control, *spec drift*. 2026 studies indicate a large spec gain on weaker models and high-risk domains, and a small gain on simple tasks with strong models. **Recommendation:** size the process to the problem (trivial → direct; small → mini-design in chat; feature → spec + plan; critical project/system → phases, ADRs, traceability), review artifacts **short and early**, and keep reading the code.

### Quick map

| Approach | Main artifacts | (a) Questions before coding | (b) Guidance between sessions | Weight |
|---|---|---|---|---|
| Anthropic best practices | `CLAUDE.md`, `SPEC.md`, plan (plan mode) | Interview with `AskUserQuestion`; plan mode | CLAUDE.md + auto memory + spec/plan on disk + fresh session | Light |
| Anthropic long-running harness | `feature_list.json`, `claude-progress.txt`, `init.sh`, git | Initial spec (`app_spec.txt`) written beforehand | "Get your bearings" routine + git log + progress | Medium |
| Superpowers | `docs/superpowers/specs/…-design.md`, `…/plans/…md`, ledger `progress.md` | Brainstorming with hard gate, 1 question/message | Spec + plan + ledger + commits per task | Medium/high |
| GSD | `.planning/{PROJECT,REQUIREMENTS,ROADMAP,STATE}.md`, phases with `CONTEXT/PLAN/SUMMARY` | new-project (deep questioning), discuss-phase, spec-phase | `STATE.md` < 100 lines, `HANDOFF.json`, executors in a fresh context | High |
| HumanLayer RPI/QRSPI | `thoughts/shared/{research,plans,handoffs}` | Questions only about what the code doesn't answer; design discussion | Intentional compaction to file; handoff/resume | Medium |
| Harper Reed | `spec.md`, `prompt_plan.md`, `todo.md` | "One question at a time" until the spec is done | Checked-off checklists + commits | Light |
| PRP | `INITIAL.md`, `PRPs/*.md` | Weak (the human writes INITIAL.md; the PRP researches) | Self-contained PRP + tiered validation | Medium |
| AGENTS.md | `AGENTS.md` (nestable) | — | Persistent instructions loaded at the start | Light |
| Cline Memory Bank | 6 files in `memory-bank/` | Plan mode | Read ALL files at the start of every task | Medium |

---

## 1. Anthropic — official guides

### 1.1 Claude Code — *Best practices* (official docs, 2026)

- **Source:** <https://code.claude.com/docs/en/best-practices> (the original post from Apr/2025, `anthropic.com/engineering/claude-code-best-practices`, now redirects with HTTP 308 to this page). Consulted on 2026-09-23; the page carries no date.
- **Core premise:** the context window is the most important resource; performance drops as it fills up (the model "forgets" older instructions and makes more mistakes).

#### The "let Claude interview you" technique → `SPEC.md` → fresh session

- For larger features: start with a minimal prompt and ask Claude to **interview you using the `AskUserQuestion` tool**, covering technical implementation, UI/UX, edge cases, concerns, and tradeoffs, **avoiding obvious questions** and digging into the hard parts; once everything is covered, it writes the complete spec to `SPEC.md`.
- With the spec ready, **start a fresh session to implement**: a clean context, focused only on implementation, with the written spec as a reference.
- The most useful specs are **self-contained**: they name files and interfaces, state **what's out of scope**, and end with an **end-to-end verification step**. Time spent making the spec precise pays off more than time spent watching the implementation.

```text
# Interview prompt — illustrative example (English paraphrase of the doc's pattern)
I want to build <short description>. Interview me in detail using the AskUserQuestion tool.
Cover technical implementation, UI/UX, edge cases, risks, and tradeoffs.
Don't ask the obvious; focus on the hard parts I might not have considered.
Keep going until we've covered everything, then write the complete specification to SPEC.md.
```

```markdown
<!-- SPEC.md — illustrative example following the doc's recommendations -->
# SPEC: <feature>
status: draft            # draft | approved (date + who approved)
## Goal and context
## Scope
### In scope
### Out of scope
## Requirements (R-01, R-02, …)
## Interfaces and files involved (paths, signatures, contracts)
## Decisions (link to ADRs when applicable)
## Open questions (must be empty before implementing)
## Edge cases
## End-to-end verification (command/script that proves the feature works)
```

#### Explore → Plan → Implement → Commit (with *plan mode*)

1. **Explore** in plan mode: `Shift+Tab` until "plan mode on" appears, or `claude --permission-mode plan`, or prefix a single prompt with `/plan`. Claude reads files and responds without editing.
2. **Plan:** ask for a detailed plan; `Ctrl+G` opens the plan in your editor so you can edit it before proceeding.
3. **Implement:** when approving the plan you choose: "yes + auto mode", "yes, approve edits manually", or "no, keep planning". With `showClearContextOnPlanAccept` enabled, the option to **approve and clear the planning context** appears (a fresh context for implementing).
4. **Commit:** descriptive message + PR.

- Plan mode has a cost: if you can **describe the diff in one sentence, skip the plan**. It's worth it when there's uncertainty about the approach, changes across several files, or unfamiliar code.
- Useful settings (permission modes / settings docs): `permissions.defaultMode: "plan"` in `.claude/settings.json` to always start in plan mode; `plansDirectory` sets where plans are written (**default value unverified**).

#### `CLAUDE.md` and memory (docs "How Claude remembers your project")

- Read at the start of every session; no mandatory format; **short and readable** — target **< 200 lines per file**. Line-by-line test: "would removing this make Claude get it wrong?" If not, cut it. A bloated `CLAUDE.md` makes Claude ignore instructions. `/doctor` suggests cuts for what's derivable from the code.
- **Include:** commands Claude can't guess; style that differs from the default; how to run tests; repo etiquette (branches, PRs); specific architectural decisions; environment quirks; *gotchas*.
- **Exclude:** what can be inferred by reading the code; standard language conventions; detailed API documentation (link it instead); information that changes frequently; tutorials; file-by-file descriptions; platitudes ("write clean code").
- **Locations** (broadest to most specific, concatenated): managed policy (on Windows `C:\Program Files\ClaudeCode\CLAUDE.md`) → `~/.claude/CLAUDE.md` → `./CLAUDE.md` or `./.claude/CLAUDE.md` → `./CLAUDE.local.md` (personal, in `.gitignore`). Loaded from the cwd upward at startup; subdirectory `CLAUDE.md` files load **on demand** when Claude reads files there.
- `@path/file` imports other files (relative to the importing file; up to 4 hops). **Import doesn't save context** — everything loads at startup.
- `.claude/rules/*.md` with `paths:` frontmatter loads rules **only when** Claude touches files matching the pattern (a good way to keep the main file short).
- Block HTML comments (`<!-- -->`) are stripped before injection (notes for humans at no token cost).
- The root `CLAUDE.md` **survives `/compact`** (it's re-read from disk). You can give compaction instructions, e.g.: "when compacting, preserve the list of modified files and the test commands".
- **Auto memory:** Claude keeps a `MEMORY.md` (index) + per-topic files per repository; the first **200 lines or 25 KB** load into every session.
- `/init` generates an initial `CLAUDE.md`; with `CLAUDE_CODE_NEW_INIT=1`, `/init` becomes an interactive flow that explores the code with a subagent, **asks follow-up questions**, and shows a proposal before writing.
- **Hooks** for what must always happen: `CLAUDE.md` is advisory; hooks are deterministic.

#### Verification

- Give Claude an **executable check** (tests, build, linter, a script that compares output, a screenshot). Without a check, "looks done" is the only signal.
- "Gate" levels: ask for it right in the prompt; a `/goal` condition on the session (an evaluator re-checks every turn); a **Stop hook** as a deterministic gate (Claude Code ends the turn after 8 consecutive blocks); a **verifier subagent** in a fresh context (review the diff against `PLAN.md`: every requirement implemented, edge cases with a test, nothing out of scope).
- Careful: a reviewer instructed to find problems always finds something → ask only for **correctness or requirements** gaps; everything else is optional (avoids over-engineering).
- Ask for **evidence** (test output, the command that was run, a screenshot), not assertions.

#### Session management and failure patterns

- `Esc` interrupts; `Esc+Esc`/`/rewind` restores the conversation and/or code to a checkpoint or resumes from a point; `/clear` between unrelated tasks; after **two failed fixes on the same problem**, `/clear` and restart with a better prompt; `/compact <instructions>`; `/btw` for questions that shouldn't enter the history; **subagents for investigation** (keep the main context clean); checkpoints **don't replace git**; `claude --continue` / `--resume`, `/rename` to treat sessions like branches.
- Named anti-patterns: the "kitchen sink" session (mixed-up tasks), fixing repeatedly, an overspecified `CLAUDE.md`, the "trust-then-verify" gap, endless exploration.

**(a) Questions before coding:** interview with `AskUserQuestion`; plan mode (no editing until approved); interactive `/init`.
**(b) Guidance between sessions:** `CLAUDE.md` + auto memory + `SPEC.md`/plan on disk + named sessions + git.
**Pros:** official, lightweight, compatible with any stack; good balance between human gates and autonomy. **Cons:** it's a set of practices, not a process — the discipline (keeping spec/state up to date, skipping the plan when trivial) is on you; `AskUserQuestion` and plan mode are Claude Code features (on pi you need an extension/prompt).

### 1.2 "Effective context engineering for AI agents" (2025-09-29)

- **Source:** <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents> — Applied AI team (Prithvi Rajasekaran, Ethan Dixon, Carly Ryan, Jeremy Hadfield, and collaborators).
- **Definition:** context engineering is curating and maintaining the optimal set of tokens during inference (system prompt, tools, external data, history) — an evolution of prompt engineering for multi-turn agents.
- **Context rot / attention budget:** performance drops with context size (pairwise relationships grow ~n²); treat context as a finite resource with diminishing marginal returns. Master rule: **the smallest set of high-signal tokens** that maximizes the outcome.
- **System prompt at the "right altitude":** neither fragile hard-coded logic nor vagueness that presumes shared context; clear sections (XML/Markdown).
- **Tools:** few, without overlap, self-explanatory. **Examples:** few and canonical, instead of lists of edge cases.
- **"Just in time" retrieval** (paths, queries, links loaded on demand) + **hybrid strategy** — Claude Code loads `CLAUDE.md` upfront and uses glob/grep for the rest.
- **Long-horizon techniques:**
  - **Compaction:** summarize the history near the limit and restart; balance *recall* vs *precision*; the safest approach is clearing raw tool results that have already been processed.
  - **Structured note-taking / agentic memory:** the agent writes persistent notes outside the window (e.g., `NOTES.md`, a to-do list) and re-reads them — the example of the agent playing Pokémon that kept accurate counts across thousands of steps.
  - **Sub-agents:** explore with a clean context and return condensed summaries (~1,000–2,000 tokens) to the coordinator.
- **Matching technique to task:** compaction for long exchanges; notes for iterative development; multi-agent for complex research.

**Practical implication for your workflow:** the "state file" (STATE/progress/NOTES) is the official form of *structured note-taking*; `AGENTS.md`/`CLAUDE.md` = the preloaded part; linked `docs/` = just-in-time.

### 1.3 "Effective harnesses for long-running agents" (2025-11-26)

- **Source:** <https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents> — Justin Young (+ collaborators). Code: <https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding>.
- **Problem:** the agent works in discrete sessions and each session starts with no memory — like engineers working shifts with no handoff. Typical failures: trying to do everything at once (*one-shot*), declaring victory early, leaving the repo broken, marking a feature done without testing it, not knowing how to run the app.
- **Two-part solution:**
  1. **Initializer agent** (first session, its own prompt): reads the spec (`app_spec.txt`), creates a **feature list in JSON** (in the example, ≥ 200 items, all initially failing), creates `init.sh`, `claude-progress.txt`, the directory structure, and makes the **initial commit**.
  2. **Coding agent** (every following session): incremental progress, **one feature at a time**, leaves the environment clean (ready to merge), commits with a descriptive message, and updates the progress.
- **Why JSON and not Markdown:** the model is less prone to rewriting/mangling JSON. The rule is to edit **only the `passes` field**; emphatic instructions forbid removing/editing/reordering/merging tests.

```json
// feature_list.json — illustrative example. Fields from the article: category, description, steps, passes.
// ("id" was added by me for traceability.)
[
  {
    "id": "F-012",
    "category": "functional",
    "description": "User exports the monthly report as CSV",
    "steps": [
      "Open the reports screen",
      "Select the month 2026-08",
      "Click 'Export CSV'",
      "Verify the file has a header and one line per entry"
    ],
    "passes": false
  }
]
```

```text
# claude-progress.txt — illustrative example
## Session 2026-09-23 #7
Done: F-010, F-011 (passes=true; verified with browser automation)
In progress: F-012 (CSV export) — missing UTF-8 BOM for Excel
Blockers: none
Next: finish F-012; then F-013 (filter by category)
How to run: ./init.sh (API :8080, web :3000)
```

- **Start-of-session routine** (the article shows the agent "getting its bearings"): `pwd` → read `claude-progress.txt` and `git log` → read the feature list and choose the **highest-priority feature still failing** → run `init.sh` → **basic E2E test** (the quickstart says to re-test 1–2 already-passing features to catch regressions **before** new work) → implement → verify → mark `passes` → commit → update progress → end clean.
- **Tests:** with browser automation tools (Puppeteer MCP in the article) the agent found bugs invisible in the code; cited limitation: it couldn't see native browser modals.

| Failure | Fix in the initializer | Fix in the coding agent |
|---|---|---|
| Declares victory early | Comprehensive feature list | Read the list at the start; one feature at a time |
| Leaves state broken/unrecorded | Git repo + progress notes | Start by reading progress and running tests; end with commit + update |
| Marks a feature without testing | Feature list | E2E self-verification; only mark after testing |
| Doesn't know how to run the app | `init.sh` | Read/run `init.sh` at the start |

- **Future work cited:** whether a generalist agent beats a multi-agent architecture (test, QA, cleanup agents); generalizing beyond web apps.

### 1.4 "Harness design for long-running application development" (2026-03-24)

- **Source:** <https://www.anthropic.com/engineering/harness-design-long-running-apps> — Prithvi Rajasekaran (Anthropic Labs).
- **3-agent architecture (inspired by GANs):**
  - **Planner:** expands a 1–4 sentence prompt into an ambitious product spec, focused on **product context and high-level technical design**, and **not** on implementation details (premature technical detail causes cascading errors).
  - **Generator:** implements feature by feature against the spec.
  - **Evaluator:** using Playwright MCP, interacts with the live page and scores it against predefined criteria.
- **Sprint contract:** before each sprint the generator proposes what it will build and **how success will be measured**; the evaluator reviews it and both iterate until they agree — a bridge between the user story and a testable implementation.
- **Communication via files** (one agent writes, the other reads and responds).
- **Context reset vs compaction:** a full reset eliminated "context anxiety" (the model ending early) on Sonnet 4.5; compaction didn't fix it. With **Opus 4.6** they removed sprints and per-sprint evaluation — leaving planner + generator + a single evaluation at the end.
- **Lessons:** start with the simplest solution and only add complexity when necessary; **every component of the harness encodes an assumption about what the model can't do** — re-evaluate with every new model. Separating the generator from the evaluator matters because agents overestimate their own work.

**(a)** In long-running harnesses, questions happen **beforehand** (human spec or planner) and via a *sprint contract* (agreeing on criteria before building). **(b)** Guidance = files (feature list, progress, specs, contracts) + git + a reorientation routine + context resets.
**Pros:** concrete, tested patterns; "rewrite-proof" JSON; focus on E2E verification. **Cons:** optimized for greenfield full-stack web apps; high cost in time and tokens (secondary summaries of the 2026 article cite ~4 h and ~US$124 for a sample app — **unverified in the primary source**); a giant feature list can turn into a "frozen spec".

---

## 2. obra/superpowers (Jesse Vincent)

- **Source:** <https://github.com/obra/superpowers> — **v6.4.1 (2026-09-18)**, ~290k stars. Release notes: v6.3.0 (2026-08-12) scaled brainstorming "ceremony" to the complexity; v6.2.0 (2026-07-23) created a per-plan workspace at `.superpowers/sdd/<plan-basename>/`; v6.4.1 rebuilt `executing-plans` as cheaper inline execution.
- **Platforms:** Claude Code (official marketplace: `/plugin install superpowers@claude-plugins-official`, or `obra/superpowers-marketplace`), Codex, Cursor, Gemini CLI, Copilot CLI, OpenCode, **Pi**, Qwen Code, Factory Droid, and others.
- **On pi:** `pi install git:github.com/obra/superpowers` (or `pi -e /local/path`). According to the README, the Pi package loads the skills natively and injects the `using-superpowers` bootstrap **at startup and after compaction**. The pi.dev catalog has community ports/derivatives (`pi-superpowers`, `pi-superpowers-plus` — more opinionated, can block "ship" commands until verification passes —, `superpowers-zh`, `@weiping/pi-superpowers`, `pi-supergsd`, `@teelicht/pi-superagents`, etc.; **unaudited**).
- **Philosophy:** always TDD; systematic rather than ad hoc; reduce complexity; **evidence before assertion**. Skills trigger automatically — they're treated as mandatory flows, not suggestions.

**Workflow:** `brainstorming` → `using-git-worktrees` → `writing-plans` → `subagent-driven-development` **or** `executing-plans` → `test-driven-development` → `requesting-code-review` → `finishing-a-development-branch`.

### 2.1 `brainstorming` (idea → approved design)

- **Hard gate:** no code, scaffold, dependency, or implementation action before the approval of the chosen path is complete.
- **Initial classification (v6.3+):**
  - **Spike** (feasibility question): proposes a short probe, asks for approval, investigates cheaply, reports back. No design doc.
  - **Bounded** (small change to an existing flow): clarifying questions → short design **in chat** → explicit approval → implement. No spec or plan on file.
  - **Architectural** (new project/subsystem): the full process below. If hidden complexity turns up midway, it **escalates category** immediately.
- **Architectural process:** explore context (files, docs, recent commits) → reflect the understanding back and ask for correction → **one question per message**, preferably **multiple choice** → propose **2–3 approaches with tradeoffs** and a recommendation → present the design **in sections** (architecture, components, data flow, error handling, tests), each sized to its complexity (from a few sentences to ~200–300 words), **asking after each section whether it's right** → relentless YAGNI → write the spec to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` and **commit** → **self-review** (placeholders/TBD, contradictions, scope too big for one plan, ambiguous requirements) → **the user reviews the spec** → only then `writing-plans` (no other implementation skill).
- A project with several independent subsystems → decompose into sub-projects first. A "visual companion" (browser mockups) is offered only when a question would benefit from a visual.

```markdown
<!-- docs/superpowers/specs/2026-09-23-csv-export-design.md — illustrative example -->
# Design: CSV report export
Date: 2026-09-23 · Status: approved by the user on 2026-09-23
## Understanding (what the user wants and why)
## Approaches considered (A/B/C with tradeoffs) → chosen: B (reason)
## Architecture
## Components (responsibility of each)
## Data flow
## Error handling
## Test strategy
## Out of scope (YAGNI)
```

### 2.2 `writing-plans` (design → executable plan)

- Assumes an executor that is **competent, with zero context on the code, and with questionable taste in tests** → the plan needs to be explicit.
- **2–5 minute** tasks, with **real code** (no "TBD", "add validation"); **file map before the tasks**; one plan per subsystem; each plan produces software that is testable on its own.
- Mandatory header: title; a note for agents indicating the mandatory execution sub-skill; **Goal** (1 sentence); **Architecture** (2–3 sentences); **Tech Stack**; **Spec** (path to the design); **Global Constraints**; **Review Focus** (the ~5 classes of input/failure most likely to go uncovered — v6.4).
- Each task: **Files** (create/modify/test), **Interfaces** (signatures consumed and produced — this is where the neighboring task learns the contract), **Steps** with checkboxes in the TDD cycle.
- Saved to `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`; self-review (spec coverage, type consistency, Review Focus with tests) before handoff.

```markdown
<!-- docs/superpowers/plans/2026-09-23-csv-export.md — illustrative example -->
# CSV export — Implementation plan
> For agents: execute with the indicated execution skill (subagent-driven or inline).
Goal: allow exporting the monthly report as CSV.
Architecture: a pure service generates the rows; the endpoint streams the file; the UI only triggers the download.
Tech Stack: Node 22, Fastify, Vitest.
Spec: docs/superpowers/specs/2026-09-23-csv-export-design.md
Global Constraints: UTF-8 with BOM; ';' separator (pt-BR).
Review Focus: months with no entries; negative values; accented characters; files > 50k lines; timezone.

## File structure
- src/reports/csv.ts (new) — serialization
- src/routes/reports.ts (modify) — endpoint

### Task 1: serialize entries
Files: Create src/reports/csv.ts · Test tests/reports/csv.test.ts
Interfaces: produces `toCsv(rows: Lancamento[]): string`
- [ ] Write a failing test (a month with 2 entries, one with an accented character)
- [ ] Run `npx vitest run tests/reports/csv.test.ts` and see it FAIL for the right reason
- [ ] Implement the minimum
- [ ] Run again and see it PASS (whole suite green)
- [ ] Commit: "feat(reports): serialize entries to CSV"
```

### 2.3 Execution: `subagent-driven-development` vs `executing-plans`

- **Subagent-driven:** a **new implementer subagent per task** → **spec-conformance** review + **quality** review per task → a final review of the whole branch. The subagent **doesn't read the whole plan** (a script extracts the task's brief). A **ledger** `progress.md` in the workspace records completions, fix rounds, and decisions ("rulings") — it's the recovery map for when the controller's context is lost (the commits it cites exist in git). Implementer status: `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, `BLOCKED`. Up to 5 fix rounds with a *circuit breaker*.
- **Executing-plans (inline, cheaper):** reads the plan and spec (the **spec is the authority**), does an upfront scan for conflicts and logs decisions, executes all tasks without asking "can I continue?", keeps the ledger in a file (not in conversation memory), **every deviation goes into the ledger**; it only stops for irreversible actions, security-sensitive ones, effects outside the worktree, or an irreparably broken plan; final review and fixes for critical findings.
- **`test-driven-development`:** "Iron Law" — no production code without a failing test first; code written before the test gets **deleted**; a test that passes on the first try is a red flag; exceptions (throwaway prototype, generated code, config) only with the human.
- **`verification-before-completion`:** identify the command that proves the claim → run it now → read the output and exit code → check it → only then assert, with evidence. "Should work"/"probably passes" are red flags.

**(a) Questions:** brainstorming is the most explicit gate in the ecosystem (1 question/message, multiple choice, per-section validation + review of the written spec). **(b) Guidance:** spec + plan versioned in `docs/superpowers/`, ledger on file, dedicated worktree, commit per task, bootstrap reinjected after compaction (on pi).
**Pros:** strong discipline (TDD, evidence, independent review); scalable ceremony (spike/bounded/architectural); portable (includes pi). **Cons:** very opinionated ("mandatory" skills can clash with your workflow); subagent-driven is expensive in tokens; plans with complete code get long (there's public discussion about efficiency — issue #512, content **unverified**); the `docs/superpowers/` folder is a framework convention (configurable per user preference, according to the skill).

**Sources:** repo and skills at `skills/brainstorming`, `skills/writing-plans`, `skills/subagent-driven-development`, `skills/executing-plans`, `skills/test-driven-development`, `skills/verification-before-completion`; `RELEASE-NOTES.md`; catalog <https://pi.dev/packages?name=superpowers>.

---

## 3. GSD — Get Shit Done

- **History:** created by TÂCHES (`glittercowboy`) as a meta-prompting/context engineering/SDD system for Claude Code; the repo migrated to `gsd-build/get-shit-done`, which was **archived on 2026-06-26**. It continues as:
  - **GSD Core** — <https://github.com/open-gsd/gsd-core> — **v1.14.0 (2026-09-14)**, ~9.8k stars, MIT, `npx @opengsd/gsd-core@latest`. Runtimes: Claude Code, OpenCode, Codex, Copilot, Cursor, Windsurf, Kimi CLI, Kilo, Antigravity (**pi does not appear** on the list). It has documentation in **pt-BR** (`docs/pt-BR/`).
  - **GSD 2 / gsd-pi** — <https://github.com/open-gsd/gsd-pi> — **v1.20.1**; its own CLI **built on the Pi SDK** (`npx @opengsd/gsd-pi@latest`), state in `.gsd/`, milestone → slice → task hierarchy, an "auto mode" that creates **a fresh session per unit of work** with only the necessary artifacts pre-injected, crash recovery, and stuck-loop detection.
  - Community ports for pi: `pi-gsd` (`pi install npm:pi-gsd`), `yurifrl/pi-gsd-core`, etc. (**unaudited**).
- **Commands:** in the original they were `/gsd:…`; in GSD Core they are `/gsd-…`.

### 3.1 Loop and main commands (GSD Core)

Loop per phase: **discuss → plan → execute → verify → ship**.

```text
/gsd-new-project → /gsd-discuss-phase 1 → /gsd-plan-phase 1 → /gsd-execute-phase 1 → /gsd-verify-work 1 → /gsd-ship 1 → (next phase)
End of milestone: /gsd-audit-milestone → /gsd-complete-milestone → /gsd-new-milestone
Brownfield: /gsd-onboard or /gsd-map-codebase · Ad hoc: /gsd-quick · Resuming: /gsd-progress, /gsd-next, /gsd-pause-work, /gsd-resume-work
Other: /gsd-spec-phase (Socratic questioning → phase SPEC), /gsd-explore, /gsd-spike, /gsd-sketch, /gsd-debug, /gsd-ingest-docs (imports existing ADRs/PRDs/SPECs), /gsd-health
```

### 3.2 Files created

```text
.planning/
├── PROJECT.md          # vision, scope, core value (always loaded)
├── REQUIREMENTS.md     # requirements with IDs: v1 (committed), v2 (future), out of scope
├── ROADMAP.md          # phases and status
├── STATE.md            # < 100 lines: current position, decisions (D-01…), blockers, continuity
├── config.json         # workflow toggles, model profile
├── MILESTONES.md       # completed-milestones file
├── HANDOFF.json        # structured pause/resume (/gsd-pause-work)
├── codebase/           # brownfield mapping
├── research/  spikes/  sketches/  quick/  debug/  todos/
└── phases/
    └── 01-authentication/
        ├── 01-CONTEXT.md         # decisions from the discuss-phase
        ├── 01-RESEARCH.md
        ├── 01-01-PLAN.md         # atomic plan (2–3 tasks)
        ├── 01-01-SUMMARY.md      # outcome + decisions
        ├── 01-VERIFICATION.md
        └── 01-UAT.md
```

- **`STATE.md`** — a digest (not a dead file) with a **< 100 line** limit: reference to the project, current position (phase/plan/status/progress bar), metrics, accumulated context (recent decisions, pending items, blockers), and **session continuity** (last session, where it left off, resume file). **It's the first step of every workflow** and is updated after every significant action; resolved decisions/blockers get pruned.
- **`CONTEXT.md` (discuss-phase)** — answers "what's locked in and what's flexible?":

```markdown
<!-- .planning/phases/02-reports/02-CONTEXT.md — illustrative example -->
## Phase boundary
Delivers: monthly reports and CSV export. Does NOT include: dashboards, PDF.
## Implementation decisions
- Card layout, not a timeline
- Network failure: 3 retries and then a visible error
## At the agent's discretion (Claude's Discretion)
- Internal component names; CSV library
## Specific ideas ("I want it like app X")
## Canonical references (MANDATORY): docs/decisions/0003-formato-moeda.md
## Deferred ideas (outside this phase)
- XLSX export (future phase)
```

- **`PLAN.md`** — frontmatter + XML sections; **2–3 tasks per plan**, sized to **~50% of an executor's context**; a *goal-backward* methodology (objective → observable truths → artifacts → critical links). A *plan-checker* validates it; *source grounding* checks whether the cited symbols (functions, flags) exist in the code before executing.

```xml
<!-- 02-01-PLAN.md — illustrative example -->
---
phase: 02-reports
plan: 01
type: execute          # or tdd
wave: 1
depends_on: []
files_modified: [src/reports/csv.ts, src/routes/reports.ts]
autonomous: true
requirements: [REP-03]
must_haves:
  truths: ["User downloads the CSV for the selected month"]
  artifacts: ["src/reports/csv.ts"]
  key_links: ["route /reports/:mes/csv → toCsv()"]
---
<objective>Export the monthly report as CSV.</objective>
<context>@.planning/PROJECT.md @.planning/phases/02-reports/02-CONTEXT.md</context>
<tasks>
  <task type="auto">
    <name>Serialize entries to CSV</name>
    <files>src/reports/csv.ts, tests/reports/csv.test.ts</files>
    <action>';' separator, UTF-8 with BOM; escape quotes; no new dependency.</action>
    <verify>npx vitest run tests/reports/csv.test.ts</verify>
    <done>Test covers accented characters, negative values, and an empty month; all pass.</done>
  </task>
  <task type="checkpoint:human-verify">
    <name>Open the CSV in Excel and check accented characters</name>
  </task>
</tasks>
<verification>Green suite; manual download works.</verification>
<success_criteria>REP-03 satisfied.</success_criteria>
<output>02-01-SUMMARY.md</output>
```

### 3.3 How it asks questions before coding

- **`/gsd-new-project`**: deep questioning until the vision crystallizes → research agents → requirements scoping (v1/v2/out). Questioning philosophy: **thinking partner, not interrogator** — let the user dump their mental model, follow what excites them, challenge vagueness ("good" means what, exactly?), make it concrete (ask for a step-by-step), offer **2–4 concrete interpretations** via `AskUserQuestion` (with a free-form option), and stop with an explicit gate ("ready to create PROJECT.md?") once it knows **what, why, for whom, and what "done" means**. Avoid mechanical checklists and generic corporate questions.
- **`/gsd-discuss-phase`**: identifies the phase's **gray areas** and asks ~4 questions per area (*discuss* mode), **or** *assumptions* mode: the agent reads the code, formulates assumptions **with evidence**, and asks for confirmation/correction (~2–4 interactions vs ~15–20). The output is a `CONTEXT.md` that the researcher/planner consume without needing to ask again.
- **`/gsd-spec-phase`**: Socratic questioning about deliverables with probes for edge-case coverage and prohibitions.

**(b) Guidance:** a short `STATE.md` always read first; `/clear` between large commands; executors in a **fresh 200k context** (parallel waves) with **atomic commits per task**; `HANDOFF.json` to pause/resume; `/gsd-progress` shows where you are without reloading everything.
**Pros:** the most complete formalization of the cycle (requirements with IDs, traceable decisions, verification/UAT, optional human gates via `checkpoint:*`); very strong against *context rot*; docs in pt-BR; GSD 2 is born in the pi ecosystem. **Cons:** dozens of commands and files (a learning curve, risk of bureaucracy on small tasks — mitigated by `/gsd-quick`); high token consumption (parallel researchers/executors); **project churn** (renames, archiving, GSD Core vs. GSD 2 forks); the de Macedo (2026) study points to vulnerabilities typical of these frameworks (drift, lock-in, extension stability).

**Sources:** <https://github.com/open-gsd/gsd-core> (README, `docs/USER-GUIDE.md`, `docs/COMMANDS.md`, `docs/pt-BR/workflow-discuss-mode.md`, `CHANGELOG.md`); archived repo <https://github.com/gsd-build/get-shit-done> (`agents/gsd-planner.md`, `get-shit-done/templates/{state,context}.md`, `get-shit-done/references/questioning.md`); <https://github.com/open-gsd/gsd-pi>; <https://getshitdone.help/dev/architecture/>.

---

## 4. HumanLayer — Advanced Context Engineering, RPI → QRSPI

### 4.1 "Advanced Context Engineering for Coding Agents" (Dex Horthy, 2025-08-29)

- **Source:** <https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md>
- **Core idea — *frequent intentional compaction*:** design **the entire workflow** around context management, keeping utilization at **~40–60%**. Compacting intentionally means stopping, writing progress to a structured file (end goal, approach, completed steps, current failure/blocker), and restarting a fresh session from it.
- **Research → Plan → Implement (RPI):**
  - **Research:** understand the code, the relevant files, the flow of information, and possible causes/solutions.
  - **Plan:** exact steps, files to edit, how to test/verify each phase.
  - **Implement:** execute phase by phase, compacting status back into the plan.
- **Leverage hierarchy:** a bad line of code is a bad line; a bad line of plan becomes hundreds of bad lines; a bad line of research becomes thousands. → **Concentrate human review on research and plan** (this also serves as the team's "mental alignment").
- **Subagents are about context control** (fetching/summarizing without cluttering the main window).
- **Reported results:** fixes and features on a ~300k LOC Rust codebase (BAML) — e.g., ~35k LOC in ~7 h. **Reported limits:** requires real human engagement; needs someone who's an expert in the codebase (the Parquet-Java case failed); hard problems (race conditions, deep dependencies) remain hard.

```text
thoughts/                 # separate from the code, synced via `humanlayer thoughts sync`
├── shared/               # team
│   ├── research/         # YYYY-MM-DD-ENG-XXXX-description.md
│   ├── plans/
│   ├── handoffs/<ticket>/YYYY-MM-DD_HH-MM-SS_<ticket>_descricao.md
│   ├── tickets/
│   └── prs/
├── <usuario>/            # personal notes
├── global/               # knowledge shared across repositories
└── searchable/           # read-only mirror for search (remove "searchable/" when citing)
```

### 4.2 The prompts (`humanlayer/humanlayer/.claude/commands`)

Files: `research_codebase.md`, `create_plan.md`, `iterate_plan.md`, `implement_plan.md`, `validate_plan.md`, `create_handoff.md`, `resume_handoff.md`, `ralph_research/plan/impl.md`, `oneshot*.md`, `debug.md`, `commit.md`, `describe_pr.md`, `_generic`/`_nt` variants (without thoughts).

- **`/research_codebase` (gist):** role of a **documentarian, not a critic** — describes what exists, without suggesting improvements unless asked. Reads the cited files in full → breaks down the question → fires subagents in parallel (`codebase-locator`, `codebase-analyzer`, `codebase-pattern-finder`, `thoughts-locator`, `thoughts-analyzer`, optionally web) → waits for all of them → synthesizes with `file:line` references → writes a document with frontmatter (`date`, `researcher`, `git_commit`, `branch`, `repository`, `topic`, `tags`, `status`, `last_updated`) and sections: question, summary, detailed findings, code references, architecture, historical context (from `thoughts/`), related research, **open questions**. Follow-ups are appended to the same doc.
- **`/create_plan` (gist):** interactive and skeptical. With no argument, it asks for a ticket/context; reads everything in full; researches with subagents; **presents the understanding and only asks what the code doesn't answer**; proposes a **skeleton of phases and asks for buy-in before adding detail**; writes the plan; iterates with the human. Rule: **no open questions in the final plan**.

```markdown
<!-- thoughts/shared/plans/2026-09-23-ENG-123-export-csv.md — illustrative example of the template -->
# Export CSV — Implementation plan
## Overview
## Current-state analysis (with file:line)
## Desired end state (and how to verify)
## Key findings
## What we will NOT do
## Approach
## Phase 1: <name>
### Necessary changes (file → what changes)
### Success criteria
#### Automated verification
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
#### Manual verification
- [ ] Download the CSV and open it in Excel with no accent issues
## Phase 2: …
## Test strategy · Performance · Migration
## References (ticket, research, similar implementations)
```

- **`/implement_plan` (gist):** reads the whole plan and the checkboxes already marked (trusts them when resuming); follows the **intent**, adapting to reality; if the code diverges from the plan, it **STOPS** and reports in the format *Problem in Phase N: expected / found / why it matters / how should I proceed?*; at the end of each phase it runs the automated checks, **marks checkboxes right in the plan file**, and **pauses for manual human verification** before the next phase.
- **`/create_handoff` + `/resume_handoff`:** a handoff document with tasks and status, 2–3 critical references, recent changes (`file:line`), lessons learned, artifacts produced, prioritized next steps, and notes; the next session runs `/resume_handoff <file>`.

### 4.3 2026 evolution: QRSPI / "CRISPY"

- **Primary source:** Dex Horthy's talk *Everything We Got Wrong About Research-Plan-Implement* — Coding Agents Conference, Computer History Museum, **2026-03-03** (<https://www.youtube.com/watch?v=YwZR6tc7qYg>); summaries in the ZenML LLMOps Database and at alexlavaee.me. The official QRSPI prompts **have not been published**, according to community implementations (e.g., `matanshavit/qrspi`) — **not directly verified**.
- **What went wrong with RPI:**
  - **Instruction budget:** frontier models consistently follow something like ~150–200 instructions; the planning prompt had ~85, and combined with the system prompt and tools, the model **skipped interactive alignment** and went straight to the plan about half the time.
  - **"Magic words":** the flow only worked with specific phrases.
  - **The illusion of reading the plan:** ~1,000-line plans that diverged from the implementation; reviewers ended up reading the plan **and** the code. They admit they went months without reading code and had to rewrite large parts.
  - **Research contaminated** by implementation intent.
- **New flow (8 stages; 5 alignment + 3 execution):** **Questions** (generate research questions) → **Research** (fresh context, **without seeing the ticket**, only facts from the code) → **Design discussion** (~200 lines: current state, desired state, patterns, decisions, open questions — the main point of human review) → **Structure outline** (~2 pages, "like a header file": signatures, new types, phases, test checkpoints) → **Plan** (tactical; the human only spot-checks) → **Work tree** (testable **vertical** slices, not layer by layer) → **Implement** → **PR** (the human **reads the code**).
- **Principles:** < ~40 instructions per stage; flow control in code/orchestration, not in the prompt; keep context **below ~40%** and restart around 60%.

**(a) Questions:** the agent asks **only what the code doesn't answer**; in QRSPI there's an explicit questions stage and a short *design discussion* to align. **(b) Guidance:** intentional compaction to files (`thoughts/`), handoffs, checkboxes in the plan, a fresh context per phase.
**Pros:** the most honest approach about review cost; short artifacts in the right place; great for large brownfield codebases. **Cons:** requires a lot of engagement and expertise; the public tooling (`thoughts`, commands) reflects the 2025 RPI; the official QRSPI isn't public.

---

## 5. Harper Reed — "My LLM codegen workflow atm"

- **Sources:** <https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/> (2025-02-16) and the Claude Code adaptation at <https://harper.blog/2025/05/08/basic-claude-code/> (2025-05-08). I did not find a 2026 update.
- **Greenfield flow:** **Idea honing** (chat with a strong model) → `spec.md` → **Planning** (reasoning model) → `prompt_plan.md` + `todo.md` → **Execution** (Claude/Aider; later Claude Code).

Gist of each prompt (**illustrative examples**, my paraphrase):

```text
[1] Idea honing
Ask me ONE question at a time so we can build a detailed spec together, step by step,
for this idea. Each question should build on my previous answers. Let's iterate and
dig into every relevant detail. Remember: only one question at a time.
Idea: <…>

[2] Wrap-up
Compile everything we discussed into a complete specification, ready for a developer:
requirements, architecture decisions, data handling, error strategy, and test plan.
→ save as spec.md

[3] Planning (TDD version)
Based on the spec, draft a detailed blueprint; break it into small iterative chunks; break
it down again until the steps are the right size (safe, but still moving the project forward). Generate a
series of prompts for a code LLM to implement each step with TDD, incremental progress,
testing early, with no jumps in complexity; each prompt builds on the previous one and ends by
"wiring in" what was done — no orphaned code. Put each prompt in its own block.
→ save as prompt_plan.md   (the non-TDD version just removes the emphasis on tests)

[4] Checklist
Create a todo.md I can use as a checklist. Be thorough.
```

- **In Claude Code (May/2025):** `spec.md` and `prompt_plan.md` at the root; the execution prompt tells it to open `prompt_plan.md`, find the next unfinished prompt, implement it, run tests, commit, and **mark it done**; after that he just types "continue". Guardrails: **TDD** (he became a convert — the model "feeds on" tests), **lint/format** (Ruff, Biome), **pre-commit hooks** (block commits of broken code), a personal `CLAUDE.md` inspired by Jesse Vincent's, commands in `.claude/commands/`.
- **Brownfield:** package the code with repomix and apply prompts per task (code review with line numbers, missing tests, generating issues).
- **Author's caveats:** the risk of going too fast and losing control ("over my skis"); it's a **solo** flow (multiplayer unsolved); a lot of time spent waiting on the model.

**(a)** Explicit and simple: one question at a time until the spec is done. **(b)** `prompt_plan.md`/`todo.md` with checkmarks persist state between calls; commits.
**Pros:** minimal, portable (works the same way on pi, which has no plan mode or to-dos — Mario Zechner recommends exactly PLAN.md/TODO.md). **Cons:** no formal gates, no decisions/ADRs, no mandatory verification beyond what you ask for; the spec tends to freeze (no update mechanism).

---

## 6. Context Engineering template / PRP

### 6.1 `coleam00/context-engineering-intro` (Cole Medin)

- **Source:** <https://github.com/coleam00/context-engineering-intro> (~13.9k stars).

```text
context-engineering-intro/
├── .claude/commands/
│   ├── generate-prp.md       # researches + generates the PRP
│   └── execute-prp.md        # implements from the PRP
├── PRPs/
│   ├── templates/prp_base.md
│   └── <feature>.md          # generated PRPs
├── examples/                 # reference code patterns (critical)
├── CLAUDE.md                 # global rules
├── INITIAL.md                # feature request (template)
└── INITIAL_EXAMPLE.md
```

- **Flow:** rules in `CLAUDE.md` → write `INITIAL.md` → `/generate-prp INITIAL.md` (researches the codebase and docs, builds the PRP with *validation gates*, and gives a **1–10 confidence score** for one-pass success) → `/execute-prp PRPs/<feature>.md` (loads context, plans with a to-do, implements, validates, iterates until it passes).

```markdown
<!-- INITIAL.md — illustrative example -->
## FEATURE
Export of the monthly report as CSV (';' separator, UTF-8 with BOM), triggered from the reports screen.
## EXAMPLES
examples/routes/download-pdf.ts — follow the same streaming pattern
## DOCUMENTATION
<link to the Fastify docs on streams>
## OTHER CONSIDERATIONS
Months with no entries should generate only the header; watch out for negative values.
```

```markdown
<!-- PRPs/export-csv.md — PRP skeleton (paraphrase of prp_base) -->
# PRP: <feature>
## Goal / Why / What
## Success Criteria (measurable checklist)
## All Needed Context
### Documentation and references (list: url|file + why to read it + critical point)
### Current code tree  ·  Desired tree (new files and their responsibility)
### Known gotchas (libraries, repo quirks)
## Implementation Blueprint
### Data models
### Tasks in order (CREATE/MODIFY <file>, pattern to mirror)
### Pseudocode per task (CRITICAL/GOTCHA points)
### Integration points (migrations, config, routes)
## Validation Loop
### Level 1: syntax/style (lint, typecheck)
### Level 2: unit tests (happy path, validation, edge cases)
### Level 3: integration (start the service + real call)
## Final checklist · Anti-patterns to avoid
```

### 6.2 `Wirasm/PRPs-agentic-eng` (Rasmus Widing)

- **Source:** <https://github.com/Wirasm/PRPs-agentic-eng> (branch `development`, ~2.2k stars).
- **Definition:** PRP = **PRD + curated codebase intelligence + agent runbook** — the minimum package for the agent to deliver production code on the first attempt.
- **Current state:** distributed as the `prp-core` plugin/skills (`/plugin marketplace add Wirasm/PRPs-agentic-eng` → `/plugin install prp-core@prp-marketplace`); old commands live in `old-prp-commands/`. Main ones: `/prp-prd` (interactive, phased PRD), `/prp-plan`, `/prp-implement` (through to commit/PR), `/prp-issue`, `/prp-loop` (plan → implement → review with fix cycles), `/prp-orchestrate` (parallel worktrees), `/prp-review`, `/prp-debug`.
- **Note:** the artifacts now live **outside the repository**, in `~/.prp/<project-key>/{prds,plans,reports,reviews,state}` (override via `PRP_HOME`) — if you want documentation versioned alongside the code, you need to redirect this.
- **Sizing suggested by the project:** large feature → PRD → Plan → Implement; medium → straight to Plan → Implement.

**(a) Questions:** weak in Cole Medin's template (the human writes `INITIAL.md`; the generator **researches**, it doesn't interview) — it's worth adding an interview step beforehand; Widing's `/prp-prd` is interactive. **(b) Guidance:** the PRP is self-contained (the execution session doesn't need the history) + tiered validation.
**Pros:** exemplary emphasis on **curated context** (examples, docs, gotchas) and **layered executable validation**. **Cons:** long PRPs (review cost); "one-pass success" encourages heavy front-loading; the confidence score is the model's self-assessment.

---

## 7. AGENTS.md (open standard) + loading in pi and Claude Code

### 7.1 The standard

- **Source:** <https://agents.md/>. It's a "README for agents": plain Markdown, **with no mandatory fields**. Typical sections: overview, build/test commands, code style, testing instructions, security, commit/PR conventions.
- **Nesting (monorepo):** `AGENTS.md` in subpackages; **the one closest to the edited file wins**; the user's explicit prompt overrides everything. Agents try to **run the listed test commands** and fix failures before finishing.
- **Migration:** rename the old file and create a compatibility symlink (e.g., `CLAUDE.md` → `AGENTS.md`) — **but see the Windows caveat below**.
- **Governance/adoption:** OpenAI donated AGENTS.md to the **Agentic AI Foundation (AAIF)**, under the Linux Foundation, created in **Dec/2025** alongside MCP (Anthropic) and goose (Block); the site cites **> 60,000 open source projects**; the AAIF passed 170 members in Apr/2026. Supported in Codex, Jules, Cursor, VS Code/Copilot, Gemini CLI, Aider, pi, Claude Code (natively, see below), etc.
- **Thoughtworks Radar:** AGENTS.md appeared in **Trial** in an earlier edition (it's not in the current one); in Vol. 34 (Apr/2026) the topic was absorbed into **"Curated shared instructions for software teams" — Adopt** (putting `CLAUDE.md`/`AGENTS.md` in service templates and anchoring agents to a *reference application*) and into **"Agent instruction bloat" — Caution** (see §10).

### 7.2 How Claude Code handles AGENTS.md (2026 docs)

- **Native support starting in Claude Code v2.1.277:** by default it reads `AGENTS.md` **only if there is no** `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md` in the cwd or above (user/managed ones and `.claude/rules/` don't count). It loads every `AGENTS.md` and `.claude/AGENTS.md` from the cwd upward at startup, and a subdirectory's when it reads files there. It **does not read** `AGENTS.local.md`, `AGENTS.override.md`, or anything in `.agents/`.
- The **Project instructions** setting (via `/config` or the `pluginConfigs` of the built-in `agents-md@builtin` plugin in user/managed settings): `claude-md-or-agents-md` (default), `claude-md-and-agents-md` (both, CLAUDE.md first), `claude-md`, `managed-only`.
- Unavailable in some sessions (e.g., Bedrock, telemetry disabled, the first session after an upgrade) → in those cases use a `CLAUDE.md` with `@AGENTS.md`.
- **Windows:** prefer the **`@AGENTS.md` import** over a symlink — creating a symlink requires admin/Developer Mode, and git can materialize the symlink as a one-line text file if `core.symlinks` isn't enabled. `/import` (≥ v2.1.213) copies configuration from other agents into Claude Code.

```markdown
<!-- CLAUDE.md that reuses AGENTS.md — illustrative example -->
@AGENTS.md

## Claude Code only
- For new features, use plan mode and the /interview skill before editing code.
```

### 7.3 How pi loads context (pi coding agent)

- **Project status:** pi is maintained by **Earendil Inc.** (repo <https://github.com/earendil-works/pi>, formerly `badlogic/pi-mono`; npm package `@earendil-works/pi-coding-agent`, formerly `@mariozechner/pi-coding-agent`). Most recent release seen: **v0.87.1 (Sep 22; year inferred as 2026 — the page didn't show the year)**.
- **Context files:** `AGENTS.md` (or `CLAUDE.md`) loaded from the **agent directory (global, `~/.pi/agent/`)**, from the **parent directories**, and from the **cwd**, concatenated; `AGENTS.override.md` replaces `AGENTS.md`/`CLAUDE.md` **in the same directory**; `--no-context-files` / `-nc` turns it off. **Unverified:** which one wins if `AGENTS.md` and `CLAUDE.md` coexist in the same directory; whether pi processes `@imports` (the doc doesn't mention it — assume it **doesn't**); and whether it natively loads `AGENTS.md` nested **below** the cwd (there's a community package, `pi-nested-agents-md`, for this, which suggests it isn't native).
- **System prompt:** `SYSTEM.md` replaces the default prompt; `APPEND_SYSTEM.md` appends to it — in `.pi/` (project, takes precedence) or in the agent directory.
- **Skills (Agent Skills standard):** `.agents/skills/` (cwd up to the git root), `~/.agents/skills/`, `~/.pi/agent/skills/`, `.pi/skills/`, and packages; *progressive disclosure* (only name+description in the prompt; content loads when relevant); automatic invocation or `/skill:name`; `disable-model-invocation: true` for manual-only. (Claude Code uses `.claude/skills/` and also follows the agentskills.io standard, but according to the doc it does **not** read `.agents/skills/`.)
- **Prompt templates:** `.pi/prompts/*.md` and `~/.pi/agent/prompts/` → `/file-name`, with `$1`, `$2`, `$@`/`$ARGUMENTS`, `${1:-default}`; `/reload` after editing.
- **Extensions:** `.pi/extensions/` (TypeScript) with events like `session_start`, `before_agent_start`, `tool_call` (can alter/block calls — exact blocking format **unverified**), `context`, `turn_end`; `pi.registerTool`/`registerCommand`. Packages: `pi install npm:<pkg>` / `git:<repo>`.
- **Sessions:** a tree in JSONL; `/tree` (alternatives within the same file), `/fork` (a new session from an earlier message), `/clone`, `/compact [instructions]`, `/new`, `--continue`, `--resume`.
- **Philosophy (Mario Zechner, <https://mariozechner.at/posts/2025-11-30-pi-coding-agent/>, 2025-11-30):** no plan mode, no built-in to-dos, no subagents, no MCP. Instead: **write the plan to a file** (`PLAN.md` with the goal, approach, steps, and progress) and collaborate on it; use **`TODO.md` with checkboxes** (built-in to-do lists confuse the model more than they help, according to him); do **context gathering in its own session that produces an artifact** used later in a fresh session (instead of opaque subagents); full observability of what enters the context. In other words: **pi already presupposes a document-first workflow** — it just doesn't enforce it.
- **Structured questions on pi:** there's no native `AskUserQuestion`; there are community extensions inspired by it (`pi-interview`, `pi-ask-user`, `@juicesharp/rpiv-ask-user-question`, `@nguyenquangthai/pi-ask`) — **unaudited**. Without them, the "one question per message" pattern only works via prompting.
- Plan/handoff packages in the catalog (e.g., `@hank-warren/pi-plan-mode` with durable plan files, `@alexeiled/pi-plan-exec`, `pi-handoff`, `@juicesharp/rpiv-pi` with discover→research→design→plan→implement→validate skills) — **unaudited**.

### 7.4 Evidence on context files

- **Gloaguen et al. (ETH Zurich / LogicStar), "Evaluating AGENTS.md…", arXiv 2602.11988** (v1 2026-02-12, v2 2026-06-23): context files **do not improve** the resolution rate overall and **increase cost by > 20%** (more steps, more reasoning tokens). In the v1 analysis (DAIR.AI summary): developer-written files gave ~+4%; LLM-generated ones, −0.5% to −2%. Instructions are followed well, but **repository overviews don't help**; files are useful for **non-standard practices** (tools, non-obvious conventions). Recommendation: minimal content, only what's missing from the repo; evaluate before "improving".

```markdown
<!-- AGENTS.md — illustrative example, lean, documentation-first oriented -->
# AGENTS.md
## Process rules (mandatory)
- Do NOT edit production code without a spec with `status: approved` in docs/specs/.
- New feature or a change touching > 2 files: first interview the user (one question at a time),
  record the answers in docs/specs/<date>-<topic>.md and the open questions in docs/OPEN-QUESTIONS.md.
- Start of session: read docs/STATE.md, run `git log --oneline -15`, pick up only the next task
  not yet checked off in the plan referenced by STATE.md.
- End of task: run the tests, show the output, check the box in the plan, update STATE.md, commit.
- New architectural decision → an ADR in docs/decisions/ (MADR). Divergence between spec and code → stop and ask.
## Commands
- Tests: `pnpm test` · A single file: `pnpm vitest run <path>` · Types: `pnpm typecheck`
## Project quirks (only what can't be inferred from the code)
- Dates always in America/Sao_Paulo; monetary values in cents (integers).
```

---

## 8. Cline Memory Bank

- **Source:** <https://docs.cline.bot/prompting/cline-memory-bank> (page has no visible date). Custom instructions live in Cline Rules (e.g., `.clinerules/memory-bank.md`) or globally.
- **Premise:** the agent's memory resets between sessions; the Memory Bank is the **only link** to prior work → the instruction says to **read ALL memory bank files at the start of EVERY task**.

```text
memory-bank/
├── projectbrief.md     # foundation: core requirements and goals (shapes all the others)
├── productContext.md   # why it exists, problems it solves, how it should work, UX goals
├── systemPatterns.md   # architecture, technical decisions, patterns, relationships between components
├── techContext.md      # stack, setup, constraints, dependencies
├── activeContext.md    # current focus, recent changes, next steps, active decisions (changes the most)
├── progress.md         # what works, what's left, status, known issues
└── (optional) features/, api/, testing/, deployment/ …
Hierarchy: projectbrief → {productContext, systemPatterns, techContext} → activeContext → progress
```

- **Flows:** *Plan mode* (read the memory bank → if incomplete, create a plan/ask; if complete, check context → strategy → present the approach) and *Act mode* (check the memory bank → update docs → execute → document changes).
- **When to update:** upon discovering new patterns; after significant changes; when the context needs clarification; and when the user says **"update memory bank"** — at that point review **all** files (even ones that haven't changed), focusing on `activeContext.md` and `progress.md`.
- **Trigger commands:** "initialize memory bank", "update memory bank", "follow your custom instructions" (to resume).
- **Full window:** ask for "update memory bank" → new conversation → "follow your custom instructions".
- **Cline's evolutions (2025+):** `/deep-planning` (silent code investigation → targeted questions → `implementation_plan.md` → a clean **new task** to execute); **Focus Chain** (a persistent to-do list that survives resets and is periodically re-read/updated — every ~6 messages, according to Cline); `/newtask` (a handoff that packages up the plan, decisions, files, and next steps); Auto Compact.

```markdown
<!-- memory-bank/activeContext.md — illustrative example -->
# Active context (updated 2026-09-23)
## Current focus: CSV export (spec docs/specs/2026-09-23-export-csv.md, approved)
## Recent changes: serializer done (commit a1b2c3d)
## Next steps: download endpoint; E2E test
## Active decisions: ';' separator and UTF-8 BOM (ADR-0004)
## Open questions: Q-03 (row limit?)
```

**(a)** Plan mode + "if incomplete, ask"; `/deep-planning` asks questions before the plan. **(b)** The memory bank itself (+ Focus Chain / handoffs).
**Pros:** simple, tool-agnostic (it can be used the same way on pi and Claude Code with a rule in `AGENTS.md`); cleanly separates "why/what" (stable) from "now" (volatile). **Cons:** "always read everything" costs context and works against *just-in-time* loading; tends to bloat and go stale (depends on discipline); has no gates, no requirements with IDs, no verification; the evidence on long context files (§7.4, §10) calls for caution — keep the stable files short and read the volatile ones first.

---

## 9. Supporting formats

### 9.1 ADR / MADR (decisions)

- **ADR** = a record of an architectural decision and its rationale; a project's set of ADRs is its **decision log** (<https://adr.github.io/>). Templates: **Nygard (2011)** — Title, Status, Context, Decision, Consequences; **Y-statements**; **MADR**. Tools: `adr-tools`, `log4brains`.
- **MADR 4.0.0 (2024-09-17)** — <https://adr.github.io/madr/>: *full*, *minimal*, and *bare* variants; files at `docs/decisions/NNNN-title-with-dashes.md`; status `proposed | rejected | accepted | deprecated | superseded by ADR-NNNN`.

```markdown
<!-- docs/decisions/0004-separador-csv.md — illustrative example in MADR format -->
---
status: accepted
date: 2026-09-23
decision-makers: <you>
---
# Use ';' as the separator and UTF-8 with BOM in the CSV
## Context and problem statement
Users open the file in pt-BR Excel; the comma is the decimal separator.
## Decision drivers
- Opens correctly in pt-BR Excel · Correct accented characters
## Considered options
1. ',' without BOM  2. ';' with BOM  3. Generate XLSX
## Decision outcome
Option 2, because it opens directly in pt-BR Excel with no configuration.
### Consequences
- Good: zero manual steps. Bad: tools that expect ',' need a parameter.
### Confirmation
An automated test checks the BOM and separator; manual check in Excel (UAT).
## Pros and cons of the options (optional) · More information (links to spec/issue)
```

- **Use with agents:** the agent creates an ADR when a decision from the interview/plan is architectural; the spec references the ADR; `AGENTS.md` says to check `docs/decisions/` before changing anything already decided. Lightweight variants: a single `DECISIONS.md` (GSD 2 uses `.gsd/DECISIONS.md`) or numbered `D-01…` decisions in `STATE.md` (GSD Core, where plans need to reference each decision).

### 9.2 EARS (requirements)

- **Easy Approach to Requirements Syntax** — Alistair Mavin and colleagues (Rolls-Royce), IEEE RE'09 (2009). Adopted by Airbus, Bosch, NASA, Siemens, etc.; **Kiro** (AWS, 2025) uses EARS in its acceptance criteria. Source: <https://en.wikipedia.org/wiki/Easy_Approach_to_Requirements_Syntax>.

```text
# The 5 patterns — illustrative examples (keywords in English; example content translated from Portuguese)
Ubiquitous:        THE system SHALL store monetary values in cents.
Event-driven:      WHEN the user clicks "Export CSV", THE system SHALL generate the file for the selected month.
State-driven:      WHILE an export is in progress, THE system SHALL disable the export button.
Optional feature:  WHERE the Pro plan is active, THE system SHALL allow exporting 12 months at once.
Unwanted behavior: IF the month has no entries, THEN THE system SHALL generate only the header.
Complex:           WHILE offline, WHEN the user requests an export, THE system SHALL queue the request.
```

- **Why it helps with LLMs:** each requirement becomes a testable sentence (trigger → response), easy to map to a test and to review; it reduces the ambiguity that the agent would otherwise "fill in" on its own. No need to be dogmatic: use EARS for acceptance criteria, prose for context.

### 9.3 Open questions log

There's no formal standard; the frameworks converge on: **no blocking question left open when approving the spec/plan** (HumanLayer: no open questions in the final plan; Superpowers: an *ambiguity check* in the self-review; GSD: "Claude's Discretion" + "Deferred Ideas"; QRSPI: open questions in the *design discussion*).

```markdown
<!-- docs/OPEN-QUESTIONS.md — illustrative example -->
| ID   | Question                               | Context/impact            | Options (recommendation ★) | Owner | Status    | Resolution / link        |
|------|----------------------------------------|---------------------------|--------------------------|------|-----------|-------------------------|
| Q-01 | Row limit per export?                  | Endpoint performance      | 10k / 50k★ / no limit    | You  | resolved  | ADR-0005                |
| Q-02 | Include reversed entries?              | Changes totals            | yes / no★                | You  | open 🔴   | blocks R-04             |
| Q-03 | File name with the month spelled out?  | Cosmetic                  | agent's discretion       | —    | delegated | "Discretion" in the spec |
```

Suggested rule: 🔴 (blocking) prevents `status: approved`; non-blocking questions can be explicitly "delegated to the agent".

### 9.4 llms.txt

- Proposed by Jeremy Howard (Sep/2024); **v2 published on 2026-08-10** with learnings from two years of adoption (<https://llmstxt.org/>). The `/llms.txt` file has: an H1 with the name, a blockquote with a summary, optional paragraphs, H2 sections with lists of Markdown links to clean `.md` pages, and an "Optional" section for secondary content. Adopted by docs platforms (e.g., Mintlify generates it automatically; the Claude Code docs expose `code.claude.com/docs/llms.txt`), audited by Lighthouse (according to the site).
- **Use in your workflow:** a *just-in-time* source for external library docs (link it from `AGENTS.md` or the spec instead of pasting documentation). It doesn't replace `AGENTS.md` (which is about **your** repo).

### 9.5 Other patterns worth citing

- **Matt Pocock — `mattpocock/skills`** (~268k stars; `npx skills@latest add mattpocock/skills`): `grill-me` relentlessly interviews you about a plan, treating decisions as a **tree**: each round asks about the entire "frontier" (decisions whose prerequisites are already resolved), **numbered and each with a recommended answer**, and waits for the answers before the next round — a useful counterpoint to "one question at a time" (fewer back-and-forths); `grill-with-docs` updates `CONTEXT.md` and ADRs during the interview; `to-spec`, `to-tickets`, `implement`, `tdd`, `handoff`. Since it follows the Agent Skills standard, it works for both pi and Claude Code.
- **martinfowler.com, Rahul Garg (2026-04-08), "Patterns for Reducing Friction in AI-Assisted Development":** *Knowledge Priming* (curated context with versions, structure, conventions, examples), *Design-First Collaboration* (capabilities → components → interactions → contracts → only then implementation), **Context Anchoring** (a living document with decisions, constraints, and the feature's current state, carried across sessions), *Encoding Team Standards*, *Feedback Flywheel*.
- **SPDD — Structured-Prompt-Driven Development** (Wei Zhang and Jessie Jie Xia, martinfowler.com, 2026-04-28): structured prompts as a versioned artifact (the *REASONS Canvas*: requirements/DoD, entities, approach, structure, operations, standards, safeguards); rule: when reality diverges, **fix the prompt/spec first, then the code**; recommended for standardized/regulated delivery; poor fit for hotfixes, spikes, and scripts.

---

## 10. Criticism and evidence

### 10.1 Birgitta Böckeler — "Understanding Spec-Driven-Development: Kiro, spec-kit, and Tessl" (martinfowler.com, 2025-10-15)

- **Source:** <https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html>
- **Three levels of SDD:** *spec-first* (a well-thought-out spec beforehand, used for the task and then discarded), *spec-anchored* (the spec stays and guides the feature's evolution), *spec-as-source* (the spec is the primary artifact; the human doesn't edit the generated code — Tessl marks files as generated).
- **Observations:** Kiro (requirements → design → tasks, user stories + GIVEN/WHEN/THEN criteria) was a "sledgehammer to crack a nut" on a small bug; spec-kit generated a lot of repetitive, verbose Markdown files — she'd rather review code than review that much Markdown; Tessl showed non-determinism when regenerating from the same spec.
- **Criticisms:** a single workflow for every problem size; a **false sense of control** (the agent ignores instructions or follows them with excessive zeal, e.g., duplicating code); a confusing split between functional and technical specs; an undefined target audience; a parallel with **Model-Driven Development**, which failed from inflexibility **and** non-determinism; the term is suffering semantic diffusion. Conclusion: *spec-first* is worth it; the rest is still questionable (it might be "making things worse while trying to improve them").

### 10.2 Thoughtworks Technology Radar

- **Vol. 33 (Nov/2025):** *Spec-driven development* in **Assess** — interesting, but elaborate and opinionated workflows; long specs that are hard to review; unclear audience for the artifacts; risk of reinforcing heavy upfront-specification antipatterns (waterfall-like); a reminder that detailed hand-crafted AI rules don't scale. (<https://www.thoughtworks.com/radar/techniques/spec-driven-development>)
- **Vol. 34 (Apr/2026):** the SDD technique **left**, and tools entered **Assess**: **GitHub Spec Kit** (caveats: instructions that grow and age, verbosity that raises cognitive load, too many files; experienced engineers get the most value out of it) and **OpenSpec** (a minimal propose → apply → archive flow with spec *deltas*, good for brownfield; re-evaluate whether a dedicated SDD tool is still necessary as models improve). Also: **Context engineering → Adopt**; **Curated shared instructions → Adopt**; **Agent Skills → Trial**; **Progressive context disclosure → Trial**; **Feedback sensors for coding agents → Trial**; **Agent instruction bloat → Caution** (instructions accumulate, conflict, and the model pays less attention to the middle of long contexts — be intentional, add only when necessary, use progressive disclosure); **Codebase cognitive debt → Caution**; **Claude Code → Adopt** (with review discipline and context engineering). *(The label shown is "Caution"; I read it as the old "Hold" ring — my own interpretation.)*

### 10.3 Other notable criticism

- **Marmelab, François Zaninotto — "Spec-Driven Development: The Waterfall Strikes Back" (2025-11-12):** SDD resembles waterfall (massive documentation before the code); agents discover context via text search and **miss existing functions**; "Markdown madness" (verbose prose hiding basic mistakes); systematic bureaucracy (imaginary scenarios, excessive refinements); "fake agile"; **double review** (technical spec + code, because there will still be bugs); false security (agents don't always follow the spec); diminishing returns as the app grows. Alternative: iterate in small steps, breaking complex requirements into simple ones. (<https://marmelab.com/blog/2025/11/12/spec-driven-development-waterfall-strikes-back.html>)
- **Kent Beck, quoted by Martin Fowler (2026-01-08 fragment):** the descriptions of SDD he's seen assume writing the whole spec upfront, as if **nothing were learned during implementation** — which he finds bizarre; Fowler reinforces that the learning cycle from experimentation is essential. (<https://martinfowler.com/fragments/2026-01-08.html>)
- **HumanLayer's self-criticism (2026-03-03):** long plans don't get read; reading the code is non-negotiable; align on short artifacts (§4.3).
- **Böckeler — "Harness engineering for coding agent users" (2026-04-02):** the harness combines **guides** (feedforward: `AGENTS.md`, specs, skills, reference apps) and **sensors** (feedback: tests, linters, type checkers, AI reviews), computational (fast, deterministic) and inferential (slow, non-deterministic); shift quality "to the left"; the human is an implicit harness — aim human input where it matters most; when a problem recurs, improve the guides/sensors. Specs are just one type of guide; without sensors, there's no confidence. (<https://martinfowler.com/articles/harness-engineering.html>)

### 10.4 Empirical evidence (2026)

- **Context files:** see §7.4 (ETH Zurich: no overall gain, +20% cost; human-written > LLM-generated; useful for non-standard practices).
- **Farrag, "The Productivity-Reliability Paradox…", arXiv 2605.01160 (2026-05-01)** + summary in **InfoQ, "When Spec-Driven Development Pays Off" (Nitin Garg, 2026-09-10)**: the paradox — lab studies with +20–56% productivity, but an RCT with **−19%** for experienced developers, and telemetry with **+98% PRs and +91% review time** with no delivery gain. In the pilot: spec discipline gave **~+21 points** to weaker models and **~+2** to strong ones; spec-anchored review took **~48 min vs ~27 min**; the spec **did not increase bug detection** (recall ~0.52 for both), but made findings **attributable to requirements** (81% vs 0%). It recommends spec governance **only where the risk justifies it** (regulated, multi-constraint, long-lived) and skipping it for prototypes, scripts, and tasks the assistant already solves in one pass. *(Numbers via the InfoQ summary; the paper was only read at the abstract level.)*
- **de Macedo, "From Prompt to Process…", arXiv 2606.04967 (2026-06-03):** compares Spec Kit, OpenSpec, BMAD, GSD, Spec Kitty, and Reversa across a 6-dimension taxonomy (specification, context, roles, execution, validation, portability). None covers all 6 well — there's a *trade-off* between **process depth and portability across agents**. Recurring vulnerabilities: **spec-to-code drift**, excessive dependence on generated outputs, unstable community extensions, platform lock-in, **absence of process benchmarks**.
- **Anthropic itself:** skip the plan when the diff fits in one sentence; "look for the simplest solution"; every piece of the harness is a bet about the model's limitations and should be removed as the model improves (§1.4).

### 10.5 A balanced view

- **Consensus:** *lightweight spec-first* and **alignment before coding** are worth it; what's contested is **heavyweight, one-size-fits-all SDD** (many artifacts, long specs, spec-as-source).
- **Where the value shows up:** ambiguous requirements, multi-session work, brownfield codebases full of traps, regulated/high-risk domains, teams (mental alignment), less capable models.
- **Where it turns into waste:** trivial bug fixes, spikes, prototypes, tasks the model gets right on the first try; specs nobody reads; specs that don't get updated (drift) — in these cases the spec turns into a **liability**.
- **Practical mitigations:** **short** artifacts (a ~1–2 page design, not 1,000-line plans); review **early** (understanding/design) and **read the code** at the end; executable **sensors** (TDD/E2E) as the source of truth, not prose; a **living** spec (update it as you learn — "fix the spec first"); drift detection (e.g., a reviewer comparing diff vs. spec; requirement IDs ↔ tests); prune `AGENTS.md`/`CLAUDE.md` regularly.

#### Sizing matrix (a suggestion based on the sources)

| Problem size | Signals | Process | Artifacts |
|---|---|---|---|
| **Trivial** | diff describable in one sentence; < 30 min | Ask directly + test + commit | None (maybe 1 line in STATE) |
| **Small ("bounded")** | 1–3 files; no architectural decision | 3–5 questions → mini-design **in chat** → approval → TDD | Note in STATE/commit; no spec on file |
| **Medium feature** | several files; 1–3 days; some ambiguity | Interview → short `SPEC.md` (≤ 2 pages) → plan with checkbox tasks → **fresh session** implements → review (subagent + human) | spec, plan, ADR if there's a decision, STATE |
| **New project / subsystem** | several subsystems; weeks; multiple sessions | Vision/requirements (IDs, v1/v2/out) → phased roadmap → per phase: discuss → short design → plan → execute in a fresh context → verify/UAT | PROJECT/REQUIREMENTS/ROADMAP/STATE, per-phase CONTEXT/PLAN/SUMMARY, ADRs, handoffs |
| **Critical / regulated / long-lived** | compliance, money, security, audits | Everything above + *spec-anchored* with traceability (requirement ↔ test), review gates, and drift checking | + traceability matrix, EARS, approval log |

**Level up when:** hidden complexity turns up (Superpowers' "upgrade" rule), there's more than one subsystem, a decision is hard to reverse (schema, public API), or the work spans sessions. **Level down when:** you stop reading the artifacts, the spec gets bigger than the code, or review time exceeds the time saved.

---

## 11. Synthesis: recurring patterns — practical checklist

> Each item cites where the pattern appears. Use it as a setup checklist (once) and an execution checklist (per feature).

### A. Foundation (once per repository)
- [ ] **A persistent, short, human-written context file** (`AGENTS.md`; `CLAUDE.md` with `@AGENTS.md` for Claude Code — on Windows, an import instead of a symlink). Only what the agent can't infer: commands, non-obvious conventions, process rules. Target < 100–200 lines. *(Anthropic, AGENTS.md, ETH 2026, Thoughtworks "instruction bloat")*
- [ ] **Explicit process rules** in the context file: "no code without an approved spec", a start/end-of-session routine, where the spec/plan/state/decisions live. *(Superpowers hard gate, GSD, Cline)*
- [ ] **Progressive disclosure:** details in linked `docs/`, `.claude/rules/` with `paths:`, skills — not everything in the main file. *(Anthropic just-in-time, Thoughtworks)*
- [ ] **Ready executable sensors**: a test command, typecheck, lint, E2E; an `init.sh`/script that brings up the environment. *(Anthropic harness, Böckeler)*
- [ ] **Deterministic gates where it matters** (hooks in Claude Code; extensions in pi): e.g., block edits to `src/` without an approved spec; inject `STATE.md` at the start of the session; prevent "done" without green tests. *(Anthropic hooks/Stop hook, pi-superpowers-plus)*

### B. Clarification (before any code)
- [ ] **Classify the size** (trivial / bounded / feature / project / critical) and pick the process from the matrix. *(Superpowers spike/bounded/architectural, Anthropic "skip the plan", Böckeler)*
- [ ] **Explore the code before asking** and only ask what the code doesn't answer. *(HumanLayer create_plan, Superpowers, GSD assumptions mode)*
- [ ] **Structured interview:** one question at a time (Superpowers, Harper Reed) **or** rounds through the "frontier" with a recommended answer (grill-me); prefer multiple choice with a free-form option; dig into edge cases, errors, tradeoffs, not the obvious. *(Anthropic AskUserQuestion, GSD questioning)*
- [ ] **Mirror the understanding back** ("what I understood is…") and ask for correction before designing. *(Superpowers v6.4, GSD)*
- [ ] **Propose 2–3 approaches with tradeoffs** and a recommendation. *(Superpowers)*
- [ ] **Log open questions** in one place; blocking ones prevent approval; anything "at the agent's discretion" is made explicit. *(HumanLayer, GSD Discretion/Deferred, QRSPI)*

### C. Spec as the source of truth (short!)
- [ ] A **self-contained** spec: goal, scope **and out of scope**, requirements with IDs (EARS for acceptance criteria), interfaces/files, decisions, edge cases, **end-to-end verification**. *(Anthropic SPEC.md, GSD REQUIREMENTS, EARS)*
- [ ] **Design-discussion size (~1–2 pages)**, not a 1,000-line plan; this is where reviewing has the most leverage. *(HumanLayer QRSPI, leverage hierarchy)*
- [ ] **Self-review of the spec** (placeholders, contradictions, ambiguity, scope) and **recorded explicit human approval** (`status: approved`, date). *(Superpowers)*
- [ ] **Architectural decisions become an ADR** (MADR), and the spec points to them. *(ADR/MADR, GSD D-01, mattpocock grill-with-docs)*

### D. Plan
- [ ] **A file map before the tasks**; **small, verifiable** tasks (2–5 min in Superpowers; 2–3 tasks per plan in GSD), each with files, interface, a **verification command**, and a "done" criterion, **with a checkbox**. *(Superpowers, GSD XML, HumanLayer)*
- [ ] Testable **vertical slices** instead of horizontal layers. *(QRSPI)*
- [ ] **Success criteria split into automated and manual**; human checkpoints where needed. *(HumanLayer, GSD checkpoint:human-verify)*
- [ ] **No open questions in the final plan**; the plan references the spec and every requirement/decision. *(HumanLayer, GSD coverage gate)*

### E. Execution
- [ ] **A fresh context per phase** (spec in one session, implementation in another; a new executor per plan/task if the budget allows). *(Anthropic, GSD, Superpowers, HumanLayer, Cline /newtask)*
- [ ] **Start-of-session routine:** read the state → `git log` → next unchecked task → bring up the environment + a basic test (catch regressions before new work). *(Anthropic harness)*
- [ ] **One task/feature at a time**; an atomic commit with a descriptive message at the end of each one. *(Anthropic, GSD, Harper Reed)*
- [ ] **TDD** (a failing test first, see it fail for the right reason). *(Superpowers Iron Law, Harper Reed, GSD type tdd)*
- [ ] **Evidence before asserting** (show the command + output). *(Superpowers verification, Anthropic)*
- [ ] **Spec-vs-reality divergence → stop and ask** (expected / found / impact / how to proceed); fix the spec before the code. *(HumanLayer implement_plan, SPDD)*
- [ ] **Keep the window below ~40–60%**; compact **intentionally** to a file instead of relying on auto-compact; `/clear` after two failed fixes. *(HumanLayer, Anthropic)*

### F. Memory and resuming
- [ ] **A short state file** (< 100 lines): where we are, active spec/plan, next action, blockers, recent decisions; updated at the end of every task. *(GSD STATE.md, claude-progress.txt, Cline activeContext/progress)*
- [ ] **Checkboxes right in the plan** as durable progress (and/or a "only `passes` changes" JSON list for very long-running work). *(HumanLayer, Anthropic harness, Harper Reed)*
- [ ] **A written handoff** when pausing (tasks/status, critical references, `file:line` changes, lessons learned, next steps). *(HumanLayer, GSD HANDOFF.json, Cline /newtask)*
- [ ] **Git as memory** (a readable log, commits per task, a branch/worktree per feature). *(all of them)*

### G. Verification and review
- [ ] **A separate reviewer** (subagent/fresh session) comparing the diff against the spec/plan, asking only for correctness/requirements gaps. *(Anthropic, Superpowers, 3-agent harness)*
- [ ] **A human reads the code at the end** (the spec doesn't replace this). *(HumanLayer 2026, Marmelab)*
- [ ] **UAT/manual checks** for what sensors don't cover (UI, spreadsheets, etc.). *(GSD verify-work)*

### H. Maintenance
- [ ] **Prune** `AGENTS.md`/`CLAUDE.md`/memory bank periodically; turn rules that always fail into hooks. *(Anthropic, Thoughtworks)*
- [ ] **Check for drift** between spec and code when closing each feature (update the spec/ADR or archive the spec as historical). *(de Macedo 2026, InfoQ 2026, SPDD)*
- [ ] **Re-evaluate the process with every new model** — remove scaffolding that's no longer needed. *(Anthropic harness 2026, Thoughtworks on OpenSpec)*

---

## 12. Application sketch for pi + Claude Code

> A suggestion for discussion, not validated in use. Goal: **a single set of documents** that both agents read, with the same ritual.

```text
repo/                                         # illustrative example
├── AGENTS.md                 # single source of rules (pi reads it natively; Claude Code too, if there's no CLAUDE.md)
├── CLAUDE.md                 # optional: "@AGENTS.md" + Claude Code extras (Windows: import, not symlink)
├── docs/
│   ├── STATE.md              # < 100 lines; points to active_spec / active_plan / next action
│   ├── OPEN-QUESTIONS.md     # question log (blocking ones prevent approval)
│   ├── specs/2026-09-23-export-csv.md     # status: draft | approved
│   ├── plans/2026-09-23-export-csv.md     # tasks with checkboxes + verification command
│   ├── decisions/0004-separador-csv.md    # MADR
│   └── handoffs/2026-09-23_1830-export-csv.md
├── .pi/prompts/              # /interview, /spec, /plan, /implement, /handoff  (pi templates)
├── .agents/skills/           # skills in the Agent Skills standard (pi reads here)
└── .claude/
    ├── skills/               # copy/equivalent of the skills for Claude Code (it doesn't read .agents/skills)
    └── settings.json         # hooks: SessionStart injects STATE.md; PreToolUse blocks src/ without an approved spec
```

- **Personal global rules:** pi uses `~/.pi/agent/AGENTS.md`; Claude Code uses `~/.claude/CLAUDE.md`. You can keep a single file by putting `@~/.pi/agent/AGENTS.md` in `~/.claude/CLAUDE.md` (imports of user files load without a prompt, according to the docs — **untested**).
- **Per-feature ritual (both agents):** `/interview` (interview → spec draft + OPEN-QUESTIONS) → you review/approve the spec (≤ 2 pages) → `/plan` (plan with checkbox tasks) → **fresh session** `/implement` (one task at a time, TDD, evidence, commit, check the box, update STATE) → review by a subagent/fresh session → you read the diff → ADR/STATE updated.
- **A "no code before the spec" gate in Claude Code** (a `PreToolUse` hook) — **illustrative example, untested**:

```jsonc
// .claude/settings.json (excerpt) — illustrative example
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "node .claude/hooks/spec-gate.mjs" }] }
    ],
    "SessionStart": [
      { "matcher": "startup|resume|clear|compact",
        "hooks": [{ "type": "command", "command": "node -e \"process.stdout.write(require('fs').readFileSync('docs/STATE.md','utf8'))\"" }] }
    ]
  }
}
```

```js
// .claude/hooks/spec-gate.mjs — illustrative example, NOT tested (adjust paths/rules)
import { readFileSync, existsSync } from "node:fs";
const input = JSON.parse(readFileSync(0, "utf8"));                 // hook payload via stdin
const file = String(input.tool_input?.file_path ?? "").replaceAll("\\", "/");
if (!/\/src\//.test(file)) process.exit(0);                          // only protects production code
const state = existsSync("docs/STATE.md") ? readFileSync("docs/STATE.md", "utf8") : "";
const spec = state.match(/^active_spec:\s*(\S+)/m)?.[1];
const ok = spec && existsSync(spec) && /^status:\s*approved/m.test(readFileSync(spec, "utf8"));
if (ok) process.exit(0);
console.error("Blocked: there is no approved spec (docs/STATE.md → active_spec with status: approved). Do the interview/spec first.");
process.exit(2);                                                     // exit 2 = blocks and returns the message to the agent
```

- **On pi**, the equivalent would be an extension at `.pi/extensions/spec-gate.ts` listening to `tool_call` for the write/edit tools (exact blocking format **unverified**), or installing a package that already does gating (e.g., `pi-superpowers-plus`, **unaudited**). A code-free alternative: the rule in `AGENTS.md` + discipline + review.
- **Ready-made frameworks compatible with both:** Superpowers (official plugin for Claude Code; `pi install git:github.com/obra/superpowers`), Matt Pocock's skills (Agent Skills standard), GSD (GSD Core for Claude Code; **GSD 2/gsd-pi** is its own CLI on top of the Pi SDK, not a plugin for your pi — **worth evaluating**).

---

## 13. Consolidated sources

**Anthropic**
- Best practices (docs): <https://code.claude.com/docs/en/best-practices>
- Memory / CLAUDE.md / AGENTS.md: <https://code.claude.com/docs/en/memory>
- Permission modes (plan mode): <https://code.claude.com/docs/en/permission-modes> · Settings: <https://code.claude.com/docs/en/settings-reference> · Hooks: <https://code.claude.com/docs/en/hooks> · Skills: <https://code.claude.com/docs/en/skills>
- Effective context engineering (2025-09-29): <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>
- Effective harnesses for long-running agents (2025-11-26): <https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents>
- Quickstart autonomous-coding: <https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding>
- Harness design for long-running application development (2026-03-24): <https://www.anthropic.com/engineering/harness-design-long-running-apps>

**Frameworks / workflows**
- Superpowers: <https://github.com/obra/superpowers> (skills at `skills/…`, `RELEASE-NOTES.md`); pi catalog: <https://pi.dev/packages?name=superpowers>
- GSD Core: <https://github.com/open-gsd/gsd-core> · archived repo: <https://github.com/gsd-build/get-shit-done> · GSD 2 (Pi SDK): <https://github.com/open-gsd/gsd-pi> · <https://getshitdone.help/dev/architecture/>
- HumanLayer ACE: <https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md> · commands: <https://github.com/humanlayer/humanlayer/tree/main/.claude/commands> · thoughts-locator agent: <https://github.com/humanlayer/humanlayer/blob/main/.claude/agents/thoughts-locator.md>
- QRSPI: talk <https://www.youtube.com/watch?v=YwZR6tc7qYg> · <https://www.zenml.io/llmops-database/evolution-from-rpi-to-crispy-multi-stage-workflow-for-production-coding-agents> · <https://alexlavaee.me/blog/from-rpi-to-qrspi/> · <https://github.com/matanshavit/qrspi>
- Harper Reed: <https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/> · <https://harper.blog/2025/05/08/basic-claude-code/>
- Context engineering / PRP: <https://github.com/coleam00/context-engineering-intro> · <https://github.com/Wirasm/PRPs-agentic-eng>
- Cline: <https://docs.cline.bot/prompting/cline-memory-bank> · <https://docs.cline.bot/features/slash-commands/deep-planning>
- Matt Pocock skills: <https://github.com/mattpocock/skills>

**pi coding agent**
- <https://pi.dev> · <https://pi.dev/docs/latest/configuration> · <https://pi.dev/docs/latest/how-pi-works> · <https://pi.dev/docs/latest/sessions> · <https://pi.dev/docs/latest/skills>
- Prompt templates / extensions: <https://github.com/earendil-works/pi/tree/main/packages/coding-agent/docs>
- Mario Zechner (2025-11-30): <https://mariozechner.at/posts/2025-11-30-pi-coding-agent/>
- Releases: <https://github.com/earendil-works/pi/releases>

**Standards and formats**
- AGENTS.md: <https://agents.md/> · AAIF: <https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation>
- ADR: <https://adr.github.io/> · MADR: <https://adr.github.io/madr/>
- EARS: <https://en.wikipedia.org/wiki/Easy_Approach_to_Requirements_Syntax>
- llms.txt: <https://llmstxt.org/>

**Criticism and evidence**
- Böckeler, SDD tools (2025-10-15): <https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html>
- Böckeler, Harness engineering (2026-04-02): <https://martinfowler.com/articles/harness-engineering.html>
- Fowler, 2026-01-08 fragment (Kent Beck): <https://martinfowler.com/fragments/2026-01-08.html>
- Rahul Garg (2026-04-08): <https://martinfowler.com/articles/reduce-friction-ai/> · SPDD (2026-04-28): <https://martinfowler.com/articles/structured-prompt-driven/>
- Thoughtworks Radar: <https://www.thoughtworks.com/radar/techniques/spec-driven-development> · <https://www.thoughtworks.com/en-us/radar/techniques> · <https://www.thoughtworks.com/en-us/radar/techniques/agent-instruction-bloat> · <https://www.thoughtworks.com/en-us/radar/techniques/context-engineering> · <https://www.thoughtworks.com/en-us/radar/techniques/curated-shared-instructions-for-software-teams> · <https://www.thoughtworks.com/en-us/radar/tools/openspec> · <https://www.thoughtworks.com/en-us/radar/languages-and-frameworks/github-spec-kit> · <https://www.thoughtworks.com/radar/techniques/agents-md>
- Marmelab (2025-11-12): <https://marmelab.com/blog/2025/11/12/spec-driven-development-waterfall-strikes-back.html>
- ETH Zurich, AGENTS.md (arXiv 2602.11988): <https://arxiv.org/abs/2602.11988> · DAIR.AI summary: <https://academy.dair.ai/blog/agents-md-evaluation>
- Farrag (arXiv 2605.01160): <https://arxiv.org/abs/2605.01160> · InfoQ (2026-09-10): <https://www.infoq.com/articles/when-spec-driven-development-pays-off/>
- de Macedo (arXiv 2606.04967): <https://arxiv.org/abs/2606.04967>

### Unverified items (summary)
- The default of `plansDirectory` in Claude Code.
- On pi: precedence between `AGENTS.md` and `CLAUDE.md` in the same directory; support for `@imports`; native loading of `AGENTS.md` nested below the cwd; the exact blocking format in `tool_call`.
- The year of the pi releases (the page didn't show the year; inferred as 2026).
- The official QRSPI prompts (not published, according to community implementations).
- The Farrag study's numbers, read via the InfoQ summary (the paper was only read at the abstract level).
- The content of Superpowers issue #512 (efficiency of brainstorming/writing-plans).
- The community pi packages cited (unaudited).
- The example hooks/extensions in §12 (untested).
