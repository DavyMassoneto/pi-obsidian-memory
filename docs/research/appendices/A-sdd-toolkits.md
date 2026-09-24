# A — Ready-made SDD (Spec-Driven Development) toolkits for coding agents

**Snapshot as of 2026-09-23 — focused on use with pi (pi.dev) and Claude Code, solo dev, small TypeScript plugin/extension**

---

## 0. How to read this report

- **Research date:** 2026-09-23. GitHub star counts were read via `api.github.com` on this date (approximate values). Versions and release dates come from the GitHub releases API or each product's official changelog.
- **Method:** reading READMEs, templates, and prompts via `raw.githubusercontent.com`, the GitHub API, official documentation sites, and critical articles. Nothing was installed, cloned, or run.
- **Reliability:** the pages were read by an automated extractor. The most important claims (question limits, file paths, gates) were **reconfirmed with a literal quote** from the source file. Where that wasn't possible, I marked it **"not verified"**.
- **"Illustrative example"** = content written by me to show the artifact's *shape*. It is **not** text copied from the templates. The fictitious feature used in every example is "save a memory note": a `/remember <text>` command from a TypeScript extension that stores short notes for the agent to consult in future sessions.
- Technical terms were kept in English.

### Summary

1. Executive summary
2. Comparison table
3. Context: pi and Claude Code as "hosts" + SDD taxonomy
4. Toolkits
   - 4.1 GitHub Spec Kit
   - 4.2 OpenSpec (OPSX)
   - 4.3 Kiro (AWS): specs + steering
   - 4.4 BMAD Method
   - 4.5 Agent OS
   - 4.6 Claude Task Master
   - 4.7 cc-sdd (summarized)
   - 4.8 Tessl (summarized)
   - 4.9 Other notable tools in 2026: Superpowers, GSD Core, gstack, Conductor, pi-sdd-kit, etc.
5. Cross-cutting criticism of SDD (2025-2026)
6. Recommendations for your scenario
7. Reusable mechanisms, in case you build your own flow
8. Unverified items
9. Consolidated sources

---

## 1. Executive summary

- The ecosystem matured and changed a lot in 2026:
  - **Spec Kit** reached **v1.0** on 2026-08-21. The steps are now "skills" (`/speckit-specify`), a new `/speckit-converge` step was added, and extra processes appeared (bug and assess).
  - **OpenSpec** reached **v1.0** on 2026-01-26 with the **OPSX** flow (`/opsx:*`), based on "actions, not phases". The legacy `/openspec:proposal|apply|archive` commands were removed.
  - **BMAD** is at **v6.12**. v7 is already in preview on `main`, distributed via `npx skills add`.
  - **Agent OS v3** dropped the spec/tasks/implementation pipeline and became a *standards* system + `/shape-spec` in plan mode.
  - **Task Master** slowed down: last release on 2026-03-31, and the company's focus shifted to Hamster.
- **pi support.** Three toolkits support pi **officially**:
  - Spec Kit: `--integration pi` generates `.pi/prompts/speckit.*.md`.
  - OpenSpec: `--tools pi` generates `.pi/skills` + `.pi/prompts`, since v1.2.0.
  - BMAD: `--tools pi` installs into `.agents/skills`, a folder pi reads.

  Among the "others," **Superpowers** also supports pi (`pi install git:github.com/obra/superpowers`), and so does **GSD Core** (via the `--pi` flag, documented on the `next` branch). Not supporting pi: Kiro (closed product), Agent OS (Claude Code only), Task Master (no pi profile, but the CLI is usable by any agent with a shell), and cc-sdd.
- **Questions before code.** The most explicit mechanisms:
  - Spec Kit: `[NEEDS CLARIFICATION]` (at most 3 in specify) + `/speckit-clarify` (at most 5 questions, **one at a time**, with a recommended option, answers recorded in `## Clarifications` in the spec itself). An incomplete checklist makes `/speckit-implement` stop and ask.
  - Superpowers: brainstorming *hard gate*, one question per message, preference for multiple choice, and section-by-section approval.
  - Kiro: per-phase approval gates + "Analyze Requirements".
  - OpenSpec: the lightest, with `/opsx:explore` as a thinking partner, but no rigid gate ("enablers, not gates").
- **Context across sessions.** All of them persist to version-controllable files:
  - constitution/steering/config with project context;
  - a folder per feature or change;
  - task checklists.

  The best "resume" mechanisms are: `openspec status/instructions --json` (N/M progress), BMAD's `sprint-status.yaml`, GSD's `STATE.md`/`HANDOFF.json` + `/gsd-resume-work`, and Superpowers' *ledger*.
- **Recurring criticisms:**
  - too much markdown to review (Scott Logic measured ~2.5k lines of markdown per feature with pre-1.0 Spec Kit, and a flow ~10x slower);
  - "reinvented waterfall";
  - *spec drift* with no automatic fix;
  - token cost (BMAD);
  - a "sledgehammer to crack a nut" for small tasks.

  The 2026 trend is to **scale the ceremony to the size of the task**: BMAD 6.12 Build, Superpowers 6.3, Kiro Quick Spec, Spec Kit's "shorter path," and OpenSpec's `core` profile.
- **For your case** (solo, TS plugin, pi + Claude Code), the main recommendation is **OpenSpec**. The alternative, if you want formal clarification gates, is **Spec Kit**. **Superpowers** is worth using as a discipline reference for "ask before." Details in section 6.

---

## 2. Comparison table

| Tool | Weight/overhead | Supported agents (pi?) | How it asks questions before coding | How it keeps context across sessions | License | Version/date |
|---|---|---|---|---|---|---|
| **GitHub Spec Kit** | Medium-high. The "full path" has 9 steps; the "shorter path" has 5. | ~40-50 integrations. Claude via `.claude/skills` (`/speckit-*`). **Official pi** via `.pi/prompts` (`/speckit.*`). Also has `omp` (Oh My Pi) and `generic`. | `[NEEDS CLARIFICATION]` (at most 3) in specify; `/speckit-clarify` (up to 5 questions, one at a time, with a recommendation, recorded in the spec); checklist blocks implement; analyze is read-only. | `.specify/memory/constitution.md`, read on every command; `.specify/feature.json` (active feature); `specs/NNN-*/`; `[X]` in `tasks.md`; `/speckit-converge` adds missing tasks. | MIT | v1.0.10 (2026-09-22) |
| **OpenSpec** | Low. `core` profile: propose → apply → archive. | 30+ tools. Claude (`/opsx:*`). **Official pi** since v1.2.0 (`.pi/skills`, `.pi/prompts`, `/opsx-*`). Oh My Pi. Neutral target `.agents/skills`. | `/opsx:explore` (reads code, asks questions, never writes code); propose asks when there's material ambiguity; *Open Questions* section in the design; no rigid gate. | `openspec/config.yaml` (`context` injected into every planning request); `specs/` as the source of truth; `changes/<id>/`; dated `archive/`; `openspec status/instructions --json`. | MIT | v1.13.1 (2026-09-17) |
| **Kiro (AWS)** | Medium (3 documents + gates). Quick Spec reduces this. | Kiro only (IDE/CLI/Web). Doesn't run in pi or Claude Code; the markdown format is portable. | Per-phase approval gate; *Analyze Requirements* (questions about conflicts and ambiguities); Quick Spec asks before generating. | Steering (`product.md`, `tech.md`, `structure.md` + inclusion modes); `#spec` provider; task status; "Sync Files". | Proprietary (free tier + plans from US$20 to US$200/month) | IDE 1.1 (2026-09-14); CLI 2.22.0 (2026-09-16) |
| **BMAD Method** | High (personas, PRD, architecture, epics). v6.12 scales the ceremony. | 48 platforms. Claude (`.claude/skills`). **pi** via `--tools pi` (installs into `.agents/skills`). | forge-idea, brainstorming, advanced elicitation; PRD on a "coaching path"; open questions in the SPEC; `bmad-build` requires plan approval when there are gaps. | `_bmad-output/` + `sprint-status.yaml` (recommended next action); `bmad-help`; project context block. | MIT + trademark | v6.12.0 (2026-09-04); v7 in preview |
| **Agent OS** | Low-medium (focused on *standards*). | Claude Code (commands). Other agents only by referencing the markdown manually. pi: no. | `/shape-spec` in plan mode with AskUserQuestion, one question at a time; `/plan-product`; interview in `/discover-standards`. | `agent-os/standards/` + `index.yml`; `agent-os/product/`; `agent-os/specs/<date-slug>/`. | MIT | v3.0.0 (2026-01-20) |
| **Task Master** | Medium (PRD → task JSON; requires an API key or the Claude Code/Codex provider). | 14 rule profiles, no pi. MCP. The CLI works for any agent with a shell. | Weak: depends on PRD quality; `research` and `analyze-complexity`; no formal clarification step. | `tasks.json` + `next` + dependencies + per-branch tags + logs via `update-subtask`. | MIT + Commons Clause | v0.43.1 (2026-03-31), little activity |
| **cc-sdd** | Medium (Kiro-style + validations). | 8 agents (Claude and Codex stable). pi: no. | `/kiro-discovery`; per-phase gates; `/kiro-validate-gap`, `/kiro-validate-design`, `/kiro-validate-impl`. | `.kiro/steering/`, `spec.json`, `brief.md`/`roadmap.md`. | MIT | v3.0.2 (2026-04-13) |
| **Tessl** (SDD tile) | Light tile; the platform framework is in closed beta. | MCP-capable agents (Claude Code, Cursor). pi: not verified. | `spec-before-code` and `one-question-at-a-time` rules + `requirement-gathering` skill. | `.spec.md` with `targets` + `[@test]` links, in `.tessl/`. | MIT tile; commercial platform | tile 2.0.1 |
| **Superpowers** | Medium. Scales with task size; the subagent mode costs more. | Many harnesses. Claude (plugin). **pi** (`pi install git:github.com/obra/superpowers`). | Brainstorming with a *hard gate*; one question per message, preferably multiple choice; 2-3 approaches; section-by-section approval. | `docs/superpowers/specs/` and `docs/superpowers/plans/`; ledger `.superpowers/sdd/<plan>/progress.md`. | MIT | v6.4.1 (2026-09-19) |
| **GSD Core** | High (phases, subagents, many artifacts). | ~17 runtimes. Claude. **pi** via `--pi` (extension; documented on the `next` branch). | `/gsd-new-project` (questions); `/gsd-discuss-phase` ("lock in preferences"). | `.planning/STATE.md`, `HANDOFF.json`, `/gsd-resume-work`, `/gsd-progress`. | MIT | v1.14.0 (2026-09-14) |

---

## 3. Context: pi and Claude Code as "hosts" + taxonomy

### 3.1 How pi loads instructions (relevant to "does it support pi?")

- **What pi is today:** the `@earendil-works/pi-coding-agent` package, repository `earendil-works/pi` (formerly `badlogic/pi-mono`), maintained by Earendil Inc. with Mario Zechner. Sources: [pi.dev](https://pi.dev/) and Spec Kit's pi integration code, which points to this npm package.
- **Prompt templates:** every `.md` file in a user's or project's prompts directory becomes a slash command (`/name`), with `$ARGUMENTS`, `$1`, `${1:-default}`. The toolkits use `.pi/prompts/`. Source: [pi docs – prompt templates](https://pi.dev/docs/latest/prompt-templates).
- **Skills (Agent Skills / `SKILL.md` standard):** `~/.pi/agent/skills/`, `.pi/skills/`, and also `~/.agents/skills/` and `.agents/skills/`, discovered from the cwd up to the git root. Invoked via `/skill:name` or loaded automatically. Sources: [pi docs – skills](https://pi.dev/docs/latest/skills) and [earendil-works/pi skills.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md).
- **Context:** supports `AGENTS.md` (and `SYSTEM.md`). Source: [pi.dev](https://pi.dev/).
- **Intentional gaps:** no native *plan mode*, *sub-agents*, MCP, or *permission popups*; all of that comes via extensions/packages. Examples in the catalog: `@narumitw/pi-plan-mode` and `@juicesharp/rpiv-todo`. The catalog listed 5,723 packages. Sources: [pi.dev](https://pi.dev/) and [pi.dev/packages](https://pi.dev/packages).
- **Practical implication:** toolkits that depend on **MCP** degrade in pi (Task Master in MCP mode, Spec Kit's `taskstoissues`, Tessl). The same is true for those that depend on **subagents** (cc-sdd's `/kiro-impl`, GSD, Superpowers' `subagent-driven-development`) and on **plan mode + AskUserQuestion** (Agent OS). In those cases you need complementary packages or an "inline" mode.

### 3.2 Useful taxonomy (Birgitta Böckeler, Thoughtworks, 2025-10-15)

- **Spec-first:** the spec is written before the code and discarded afterward.
- **Spec-anchored:** the spec persists and evolves together with the feature.
- **Spec-as-source:** humans edit only the spec; the code is "generated".
- Where each tool fits:
  - Spec Kit: in practice, spec-first per feature (the guide itself asks you to decide "how the specs age").
  - OpenSpec: spec-anchored (deltas are merged into `openspec/specs/`).
  - Tessl: pursues spec-as-source.

Source: [martinfowler.com – Understanding SDD: Kiro, spec-kit, and Tessl](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html).

---

## 4. Toolkits

### 4.1 GitHub Spec Kit (`github/spec-kit`)

#### Identity and maturity
- **Maintainer:** GitHub. Created by Den Delimarsky and John Lam on 2025-08-21. Manfred Riem has been the *lead maintainer* since 2026-01-22. There are 270+ contributors.
- **License:** MIT.
- **Numbers:** ~138k stars and ~12.4k forks.
- **Version:** latest **v1.0.10 (2026-09-22)**. **v1.0.0 shipped on 2026-08-21**, on its 1-year anniversary. The release pace is nearly daily.
- **Requirements:** Python 3.11+, `uv`. Runs on Linux, macOS, and Windows, with bash, PowerShell, and Python scripts. v1.0.2 fixed UTF-8 on Windows PowerShell.
- **Timeline:**
  - Feb-Apr/2026: extension system, presets, registry-based integrations, and workflow engine;
  - Jun-Jul/2026: first-party extensions `bug` (v0.9.5) and `assess` (v0.13.0);
  - Aug/2026: 1.0 with 38 integrations, 157 community extensions, and 33 presets.

#### Agents and pi
- **Number of integrations:** the docs cite 38 in 1.0 and "50+" on the reference page; the current catalog has 45 entries.
- **Claude Code:** key `claude`, skills mode, files at `.claude/skills/speckit-<cmd>/SKILL.md`, invoked as `/speckit-<cmd>`.
- **pi (official):** key `pi`, files at `.pi/prompts/speckit.<cmd>.md` (markdown format, arguments via `$ARGUMENTS`), invoked as `/speckit.<cmd>`. The integration declares `multi_install_safe = True` and `requires_cli: True`.
  - Official note: pi has no native MCP, so `taskstoissues` doesn't work as expected.
- **Also available:** `omp` (Oh My Pi → `.omp/commands`) and `generic` (any agent: `--integration-options="--commands-dir <dir>"`, with `--skills` for a skills layout).
- **Multi-install:** `specify integration install <key>`. "Multi-install safe" integrations coexist.

#### Installation and init
```bash
uv tool install specify-cli
specify init my-plugin --integration claude      # new project
cd my-plugin
specify integration install pi                   # adds pi (both multi-install safe)

# existing project (brownfield), at the root, after committing/stashing:
specify init --here --force --integration claude

# maintenance
specify self upgrade
specify integration upgrade claude
specify extension add bug      # optional bug-fixing process
specify extension add assess   # optional idea-assessment process
```
Other CLI subcommands: `check`, `extension`, `preset`, `workflow`, `integration`, `artifact`, `upgrade`.

#### Workflow (current names; on pi use `.` instead of `-`, e.g. `/speckit.specify`)
- **Shorter path:** `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement` → `/speckit-converge`.
- **Full path (with quality gates):**
  1. `/speckit-constitution`: project principles (once).
  2. `/speckit-specify <what and why>`: creates `specs/NNN-slug/spec.md` + `checklists/requirements.md`.
  3. `/speckit-clarify`: resolves ambiguities. **Run before plan.**
  4. `/speckit-plan <stack/architecture>`: `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`.
  5. `/speckit-checklist <domain>`: requirement-quality checklists ("unit tests for English").
  6. `/speckit-tasks`: `tasks.md`.
  7. `/speckit-analyze`: cross-artifact consistency (read-only).
  8. `/speckit-implement`: runs the tasks and marks `[X]`.
  9. `/speckit-converge`: compares code against artifacts and adds missing tasks.
  - Extra: `/speckit-taskstoissues` (requires the GitHub MCP).
- **Official recommendation:** invoke one step at a time and review the result before the next.

#### Folder structure
```text
my-plugin/
├── .specify/
│   ├── memory/
│   │   └── constitution.md          # read "live" by every command
│   ├── scripts/{bash,powershell,python}/   # create-new-feature, setup-plan, setup-tasks,
│   │                                        # check-prerequisites, resolve-template, common
│   ├── templates/                   # spec/plan/tasks/checklist/constitution (local overrides)
│   ├── init-options.json            # e.g.: "sequential" (NNN) or "timestamp" numbering
│   ├── feature.json                 # path of the active feature (to resume)
│   └── extensions.yml               # extensions' before_*/after_* hooks
├── specs/
│   └── 001-save-memory-note/
│       ├── spec.md
│       ├── checklists/requirements.md   (+ ux.md, api.md, security.md…)
│       ├── plan.md
│       ├── research.md
│       ├── data-model.md
│       ├── quickstart.md
│       ├── contracts/
│       └── tasks.md
├── .claude/skills/speckit-*/SKILL.md    # claude integration
└── .pi/prompts/speckit.*.md             # pi integration
```
- The spec directory name and the git branch name are independent. Branching is optional, via a hook or the `git` extension.

#### Artifact contents (template sections)
- **`constitution.md`:**
  - `# [PROJECT_NAME] Constitution`;
  - `## Core Principles` with 5 placeholder principles;
  - two free-form sections (constraints; process/quality gates);
  - `## Governance`;
  - a footer with Version / Ratified / Last Amended (semantic versioning).
  - Since 1.0 the constitution **is no longer propagated** into the templates: it's read at runtime. The old behavior comes back via the `constitution-sync` preset.
- **`spec.md`:**
  - header: Feature Branch, Created, Status, Input;
  - `User Scenarios & Testing` (*mandatory*): user stories prioritized P1/P2/P3, each with "Why this priority", "Independent Test", and Given/When/Then "Acceptance Scenarios"; plus `Edge Cases`;
  - `Requirements` (*mandatory*): `FR-###` with `[NEEDS CLARIFICATION: …]` markers; `Key Entities`;
  - `Success Criteria` (*mandatory*): measurable, technology-agnostic `SC-###`;
  - `Assumptions`;
  - `## Clarifications` / `### Session YYYY-MM-DD` is created by clarify.
- **`plan.md`:**
  - Summary;
  - **Technical Context** (Language/Version, Primary Dependencies, Storage, Testing, Target Platform, Project Type, Performance Goals, Constraints, Scale/Scope; each field can be left as "NEEDS CLARIFICATION");
  - **Constitution Check** (gate before Phase 0 and rechecked after Phase 1);
  - Project Structure (layouts: single / web / mobile+API);
  - **Complexity Tracking** (justifies constitution violations).
- **`tasks.md`:**
  - format `- [ ] T001 [P] [US1] Description with file path` (`[P]` = parallelizable);
  - phases: Setup → Foundational (blocking) → one phase per user story (with an independent-test Checkpoint) → Polish;
  - "Dependencies & Execution Order," "Parallel Opportunities," and "Implementation Strategy" sections (MVP first).
- **Checklists (`checklists/<domain>.md`):**
  - items `- [ ] CHK001 - <question about requirement quality>? [Dimension, Spec §X.Y | Gap | Ambiguity]`;
  - forbid implementation-test language ("Verify", "Click").

#### Illustrative example — `specs/001-save-memory-note/spec.md` (summarized)
```markdown
# Feature Specification: Save memory note

**Feature Branch**: `001-save-memory-note`   **Created**: 2026-09-23   **Status**: Draft
**Input**: "I want a /remember command that stores a short note for the agent to use in future sessions"

## Clarifications
### Session 2026-09-23
- Q: Are notes global to the user or per project? → A: Per project
- Q: Maximum note length? → A: 500 characters

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a note (Priority: P1)
As a dev, I want to save a short note with `/remember` so it stays available after the session ends.
**Why this priority**: without persistence there is no memory across sessions (it's the MVP).
**Independent Test**: save a note, restart the agent, and see the note in the listing.
**Acceptance Scenarios**:
1. **Given** a project with no notes, **When** I run `/remember "use pnpm"`, **Then** the note appears in the next session.
2. **Given** an empty text, **When** I run `/remember ""`, **Then** I get an error and nothing is saved.

### Edge Cases
- Storage without write permission → clear error, existing notes untouched.
- Note identical to an existing one → [NEEDS CLARIFICATION: deduplicate, warn, or save again?]

## Requirements *(mandatory)*
- **FR-001**: The system MUST persist each note with an identifier, text, and creation date.
- **FR-002**: The system MUST reject notes that are empty or longer than 500 characters.
- **FR-003**: The system MUST NOT alter or delete existing notes when saving a new one.
### Key Entities
- **Memory note**: identifier, text, creation date, tags (optional).

## Success Criteria *(mandatory)*
- **SC-001**: 100% of saved notes appear after restarting the agent.
- **SC-002**: Saving a note takes less than 200 ms as perceived by the user.

## Assumptions
- Single-user use, with no sync across machines.
```
Note that the Spec Kit spec is "technology-agnostic." Paths like `memory/notes.jsonl` and the choice of JSONL belong in `plan.md` and `data-model.md`, not here.

#### Illustrative example — `tasks.md` (summarized)
```markdown
# Tasks: Save memory note

## Phase 1: Setup
- [ ] T001 Create `src/memory/` and `tests/memory/`
- [ ] T002 [P] Configure vitest in `vitest.config.ts`

## Phase 2: Foundational
- [ ] T003 Define the `MemoryNote` type in `src/memory/types.ts`

## Phase 3: User Story 1 - Save a note (P1) — MVP
- [ ] T004 [P] [US1] Validation tests (empty, >500) in `tests/memory/validate.test.ts`
- [ ] T005 [P] [US1] Append-only write test in `tests/memory/store.test.ts`
- [ ] T006 [US1] Implement `validateNote()` in `src/memory/validate.ts`
- [ ] T007 [US1] Implement `appendNote()` in `src/memory/store.ts` (depends on T003)
- [ ] T008 [US1] Register the `/remember` command in `src/index.ts`
**Checkpoint**: US1 works and is independently testable

## Phase N: Polish & Cross-Cutting Concerns
- [ ] T009 [P] Document `/remember` in the README
```

#### How it asks questions before coding (literally verified in the prompts)
- **`/speckit-specify`:**
  - "Make informed guesses based on context and industry standards";
  - uses `[NEEDS CLARIFICATION]` only when the choice significantly impacts scope or UX, **with a limit of 3 markers**;
  - presents up to 3 questions (Q1-Q3) with suggested options in a table;
  - generates `checklists/requirements.md` and validates the spec in up to 3 passes.
- **`/speckit-clarify`** (run before plan):
  - scans a taxonomy of 9 categories: scope, data, UX, NFR, integrations, edge cases, constraints, terminology, and completion signals;
  - asks **at most 5 questions**, "EXACTLY ONE question at a time";
  - uses multiple choice with "**Recommended:** Option X" or a short answer;
  - records each answer in `## Clarifications` → `### Session YYYY-MM-DD` as `- Q: … → A: …` and folds the decision into the right section of the spec, saving after each answer;
  - the user can end it with "done".
- **`/speckit-plan`:** "NEEDS CLARIFICATION" fields in the Technical Context turn into research in Phase 0 (`research.md`). The Constitution Check is a gate.
- **`/speckit-checklist`:** asks up to 3 context questions (at most 5) before generating.
- **`/speckit-implement`:** if any checklist has unchecked items, it **stops and asks** whether to proceed.
- **`/speckit-analyze`:** read-only. Runs 6 passes (duplication, ambiguity, underspecification, constitution alignment, coverage gaps, inconsistency) with CRITICAL, HIGH, MEDIUM, or LOW severity. Does not apply fixes automatically.

#### How it keeps the agent on track across sessions
- **Constitution** at `.specify/memory/constitution.md`, read on every command.
- **`.specify/feature.json`** stores the path of the active feature, so the following commands know which `specs/NNN-*` to work on.
- **Per-feature artifacts** in `specs/`.
- **`[X]` checkboxes** in `tasks.md`: implement marks each completed task. I found no explicit instruction to "skip already-marked tasks" when resuming; the state is implicit in the file (not verified).
- **`/speckit-converge`:** only appends `## Phase N: Convergence` to `tasks.md`. It never edits the spec or plan, never renumbers tasks, and leaves the file byte-for-byte identical if there are no gaps.
- **Caveat:** Spec Kit does **not** maintain a "living spec" of the whole system. The brownfield guide says there's no automatic discovery of existing code and asks you to decide how specs age (immutable records, living contracts, or reconciliation).
- **Note (inference):** the current `scripts/bash` folder no longer has the "update agent context" script that existed in 0.x versions, and the integrations code doesn't generate AGENTS.md/CLAUDE.md. To keep the agent oriented, point to `.specify/memory/constitution.md` and `specs/` yourself in `AGENTS.md`/`CLAUDE.md`.

#### Strengths
- The market's most explicit clarification and consistency gates: clarify, checklist, analyze, and converge.
- Huge adoption.
- Official support for pi and Claude Code in the same repository.
- Windows scripts.
- Customization via presets and extensions.

#### Weaknesses and criticism
- Verbosity and review overhead:
  - Scott Logic (Nov/2025, pre-1.0) measured 2,577 lines of markdown for 689 lines of code, 33 min 30 s of agent time, and 3.5 h of review, versus 8 min with the iterative method ("~10x");
  - Böckeler: "tedious to review"; the workflow doesn't adapt to the size of the problem;
  - Thoughtworks: "lengthy spec files that are hard to review".
- Weak brownfield support (no system mapping).
- Per-feature specs tend to drift from the code over time. `converge` only covers the current feature.
- Dependency on Python/`uv`.
- High version churn: near-daily releases in Sep/2026.

#### Fit for a solo dev (small TS plugin)
- **Good if** you want exactly "no code before the questions are answered": use the full path with clarify and checklist.
- **Heavy** for small changes. Use the shorter path, or just specify → clarify → plan → tasks.

#### Sources
- [API repo](https://api.github.com/repos/github/spec-kit) · [releases](https://api.github.com/repos/github/spec-kit/releases) · [README](https://raw.githubusercontent.com/github/spec-kit/main/README.md)
- [Docs](https://github.github.io/spec-kit/) · [Quickstart](https://github.github.io/spec-kit/quickstart.html) · [Integrations](https://github.github.io/spec-kit/reference/integrations.html) · [Reference overview](https://github.github.io/spec-kit/reference/overview.html) · [Existing projects](https://github.github.io/spec-kit/guides/existing-projects.html)
- [upgrade.md](https://raw.githubusercontent.com/github/spec-kit/main/docs/upgrade.md) · [history.md](https://raw.githubusercontent.com/github/spec-kit/main/docs/history.md)
- Templates: [spec](https://raw.githubusercontent.com/github/spec-kit/main/templates/spec-template.md), [plan](https://raw.githubusercontent.com/github/spec-kit/main/templates/plan-template.md), [tasks](https://raw.githubusercontent.com/github/spec-kit/main/templates/tasks-template.md), [constitution](https://raw.githubusercontent.com/github/spec-kit/main/templates/constitution-template.md)
- Commands: [specify](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/specify.md), [clarify](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/clarify.md), [plan](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/plan.md), [checklist](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/checklist.md), [analyze](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/analyze.md), [implement](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/implement.md), [converge](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/converge.md), [constitution](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/constitution.md), [taskstoissues](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/taskstoissues.md)
- Integrations: [pi](https://raw.githubusercontent.com/github/spec-kit/main/src/specify_cli/integrations/pi/__init__.py), [base.py](https://raw.githubusercontent.com/github/spec-kit/main/src/specify_cli/integrations/base.py), [catalog.json](https://raw.githubusercontent.com/github/spec-kit/main/integrations/catalog.json) · [scripts/bash](https://github.com/github/spec-kit/tree/main/scripts/bash)
- Criticism: [Scott Logic](https://blog.scottlogic.com/2025/11/26/putting-spec-kit-through-its-paces-radical-idea-or-reinvented-waterfall.html) · [Böckeler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)

---

### 4.2 OpenSpec (`Fission-AI/OpenSpec`) — the OPSX flow

#### Identity and maturity
- **Maintainer:** Fission AI, founded by Tabish Bidiwale (Sydney). The company is in Y Combinator W26, according to LinkedIn/YC search results.
- **License:** MIT, no paid tiers.
- **Numbers:** ~70k stars and ~4.8k forks.
- **Version:** **v1.13.1 (2026-09-17)**. **v1.0.0 shipped on 2026-01-26**; releases are weekly.
- **Installation:** Node ≥ 20.19.0; npm `@fission-ai/openspec` (also brew, pnpm, bun).
- **Telemetry:** anonymous and opt-out (`openspec config set telemetry.enabled false`).
- **Thoughtworks Radar (Apr/2026):** OpenSpec in **Assess**, described as lightweight, delta-based, suited to existing systems, "iterative and tool agnostic".

#### What changed in 1.x (OPSX)
- **v1.0.0:**
  - `/opsx:*` replaces `/openspec:proposal|apply|archive` (removed);
  - skills (`.claude/skills/…`) replace per-tool files;
  - `openspec/AGENTS.md`, `project.md`, `CLAUDE.md`, and `.cursorrules` **are no longer generated**;
  - `project.md` becomes `openspec/config.yaml` (manual migration).
- **"Actions, not phases" philosophy:** the artifacts form a dependency graph (proposal → specs → design → tasks → apply → archive). The dependencies are "enablers, not gates": you can go back and update artifacts mid-implementation.
- **v1.2.0 (2026-02-23):** profiles (`core` vs expanded), one-step `/opsx:propose`, **Pi support**, and Kiro.
- **v1.6.0 (2026-07-10):** `/opsx:update` and Oh My Pi support.
- **Later:** `openspec show --diff` and `status --all` (1.11), findings reports (1.12), warnings in apply when delta specs are missing (1.13).
- **Customizable schemas:** `openspec schema init|fork|validate`.
- **"Stores" (beta):** cross-repository planning.

#### Agents and pi
- **Coverage:** 30+ tools. Each one gets skills (`SKILL.md`) and, when there's an adapter, commands too.

| Tool ID | Skills | Commands | Invocation |
|---|---|---|---|
| `claude` | `.claude/skills/openspec-*/SKILL.md` | `.claude/commands/opsx/<id>.md` | `/opsx:propose` |
| **`pi`** | `.pi/skills/openspec-*/SKILL.md` | `.pi/prompts/opsx-<id>.md` | `/opsx-propose` |
| `oh-my-pi` | `.omp/skills/openspec-*/SKILL.md` | `.omp/commands/opsx-<id>.md` | `/opsx-propose` |
| `agents` (neutral) | `.agents/skills/openspec-*/SKILL.md` | — | `/openspec-propose` |

- **Agent-agnostic:** the CLI has an "agent contract" with stable `--json` output, which lets any agent with a shell drive the flow.

#### Installation and init
```bash
npm install -g @fission-ai/openspec@latest
cd my-plugin
openspec init --tools claude,pi      # creates openspec/{specs,changes,config.yaml} + skills/commands
openspec config profile              # optional: enables the expanded profile
openspec update                      # regenerates skills after an upgrade or profile change
```

#### Workflow (`core` profile)
1. `/opsx:explore`: think together, without writing code.
2. `/opsx:propose <name>`: creates the change and all the planning artifacts (proposal, specs, design, tasks).
3. Review and edit the artifacts. `/opsx:update` revises the plan while keeping it coherent.
4. `/opsx:apply`: implements the tasks and marks `- [x]`.
5. `/opsx:sync`: optional, merges the delta specs into the main specs before archiving.
6. `/opsx:archive`: merges the deltas and moves to `changes/archive/YYYY-MM-DD-<name>/`.

- **Expanded profile:** `/opsx:new` (scaffold only), `/opsx:continue` (one artifact at a time, showing what got unblocked), `/opsx:ff` (fast-forward), `/opsx:verify` (implementation vs. artifacts), `/opsx:bulk-archive`, `/opsx:onboard` (guided tour on a real, small change).
- **CLI useful for resuming and debugging:**
  - `openspec list`, `show [--diff]`, `view` (dashboard), `validate [--all] [--archived]`;
  - `status --change <id> [--json]`, `instructions <artifact|apply> --change <id> --json`;
  - `archive`, `new change`, `doctor`.

#### Folder structure
```text
my-plugin/
├── openspec/
│   ├── config.yaml                  # schema + context (injected into every planning request, 50KB limit) + per-artifact rules
│   ├── schemas/                     # (optional) custom schemas
│   ├── specs/                       # SOURCE OF TRUTH (current behavior)
│   │   └── memory-notes/spec.md
│   └── changes/
│       ├── add-memory-note/         # change in progress
│       │   ├── .openspec.yaml       # change metadata
│       │   ├── proposal.md
│       │   ├── design.md
│       │   ├── tasks.md
│       │   └── specs/memory-notes/spec.md   # DELTA spec
│       └── archive/
│           └── 2026-09-23-add-memory-note/  # full history
├── .claude/skills/openspec-*/SKILL.md  (+ .claude/commands/opsx/)
└── .pi/skills/openspec-*/SKILL.md      (+ .pi/prompts/opsx-*.md)
```

#### Artifact contents (standard `spec-driven` schema)
- **`proposal.md`:** `## Why`, `## What Changes`, `## Capabilities` (`### New Capabilities` / `### Modified Capabilities`, each item becomes `specs/<capability>/spec.md`), and `## Impact`.
  - A change with no capability (refactor, docs) needs `skip_specs: true` in `.openspec.yaml`.
- **Delta spec:**
  - `## Purpose` (only for a new capability);
  - `## ADDED | MODIFIED | REMOVED | RENAMED Requirements`;
  - `### Requirement: <name>` with SHALL/MUST (RFC 2119);
  - at least one `#### Scenario:` (exactly 4 `#`) with **WHEN/THEN**;
  - MODIFIED must carry the full requirement, not a partial one;
  - specs describe behavior, not implementation.
- **`design.md`:** Context, Goals / Non-Goals, Decisions (with alternatives), Risks / Trade-offs, and, when applicable, a Migration Plan and **Open Questions** ("only genuinely deferrable unknowns"). Optional for simple changes.
- **`tasks.md`:** `# Tasks` → `## 1. <Group>` → `- [ ] 1.1 …`, with a verification method per task and "one session per task when possible". Only `x`/`X` counts as done.
- **`config.yaml`:** `schema`, `context` (stack, conventions), and per-artifact `rules` (e.g. "specs: use Given/When/Then").

#### Illustrative example — change `add-memory-note`
```markdown
<!-- openspec/changes/add-memory-note/proposal.md -->
# Proposal
## Why
The agent loses decisions across sessions; we need to explicitly record short notes.
## What Changes
- New `/remember <text>` command that persists the note in the project.
- Length validation (1-500 characters).
## Capabilities
### New Capabilities
- `memory-notes`: recording and persisting per-project memory notes
### Modified Capabilities
- (none)
## Impact
- New `src/memory/` module; data file `memory/notes.jsonl`; no new dependencies.
```
```markdown
<!-- openspec/changes/add-memory-note/specs/memory-notes/spec.md -->
## Purpose
Let the user record short notes that persist across the agent's sessions.

## ADDED Requirements
### Requirement: Save note
The system SHALL persist the note with an identifier, text, and creation date when the user runs `/remember`.

#### Scenario: Valid note
- **WHEN** the user runs `/remember "use pnpm"`
- **THEN** the note is written and appears in the listing in the next session

#### Scenario: Empty note
- **WHEN** the user runs `/remember ""`
- **THEN** the system refuses with an error message and nothing is written
```
```markdown
<!-- openspec/changes/add-memory-note/tasks.md -->
# Tasks
## 1. Model and validation
- [ ] 1.1 Create the `MemoryNote` type (verify: `tsc --noEmit`)
- [ ] 1.2 Implement `validateNote()` with tests for empty and >500 (verify: `vitest run`)
## 2. Persistence and command
- [ ] 2.1 Implement append-only `appendNote()` in JSONL (verify: test with two writes)
- [ ] 2.2 Register `/remember` (verify: manual run in pi and in Claude Code)
```
When you run `/opsx:archive`, the "Save note" requirement is merged into `openspec/specs/memory-notes/spec.md` and the folder moves to `archive/2026-09-23-add-memory-note/`.

#### How it asks questions before coding (literally verified)
- **`/opsx:explore`:** "thinking partner". Asks clarifying questions, reads and searches the code, compares options and trade-offs, draws diagrams, and **never writes code**. Recommends bringing problems, not solutions.
- **`/opsx:propose`:** "If the request contains ambiguity that would materially affect scope, externally observable behavior, compatibility, or acceptance criteria, ask the user before creating the change." Ends with "Do NOT implement the change…".
- **`/opsx:apply`:** "If task is ambiguous, pause and ask before implementing". If the implementation reveals a design flaw, it suggests updating the artifacts.
- **Limitation:** there's no formal gate equivalent to Spec Kit's clarify. You can enforce this with `rules` in `config.yaml` and the habit of always starting with `/opsx:explore`.

#### How it keeps the agent on track across sessions
- **`config.yaml`:** the `context` is "actively injected into every OpenSpec planning request".
- **`openspec/specs/`:** the source of truth, which grows with every archive.
- **Change folder with state:**
  - `openspec status --change X --json` reports which artifacts are ready or blocked;
  - `openspec instructions apply --json` returns the context files, the "N/M tasks complete" progress, and the state (blocked, ready, all_done).
  - apply "can be invoked anytime… after partial implementation," which makes it the resume mechanism.
- **Dated history** in `archive/`.

#### Strengths
- Lightweight.
- Designed for brownfield: "You write specs only for what you're about to change". Specs accumulate over time.
- Deltas make what's changing clear.
- Native support for pi and Claude Code.
- CLI with robust JSON output.
- Very active.

#### Weaknesses and criticism
- No automatic spec↔code reconciliation (manual *drift*), noted in 2026 comparisons.
- Overkill for trivial fixes.
- Strict delta format (`####`, full MODIFIED).
- No strong "questions answered" gate.
- Telemetry (opt-out).

#### Fit for a solo dev (TS plugin)
- **Excellent.** It's the best weight-to-benefit balance for anyone using pi and Claude Code in the same repository.

#### Sources
- [API](https://api.github.com/repos/Fission-AI/OpenSpec) · [releases](https://api.github.com/repos/Fission-AI/OpenSpec/releases) · [v1.0.0](https://github.com/Fission-AI/OpenSpec/releases/tag/v1.0.0) · [v1.2.0](https://github.com/Fission-AI/OpenSpec/releases/tag/v1.2.0) · [v1.6.0](https://github.com/Fission-AI/OpenSpec/releases/tag/v1.6.0)
- [README](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/README.md)
- Docs: [supported-tools](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/supported-tools.md), [opsx](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/opsx.md), [concepts](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/concepts.md), [explore](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/explore.md), [cli](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/cli.md), [existing-projects](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/existing-projects.md), [migration-guide](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/migration-guide.md), [getting-started](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/getting-started.md), [installation](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/installation.md), [agent-contract](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/agent-contract.md)
- Schema and templates: [schema.yaml](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/schema.yaml), [proposal](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/templates/proposal.md), [spec](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/templates/spec.md), [design](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/templates/design.md), [tasks](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/templates/tasks.md)
- Skills: [propose.ts](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/src/core/templates/workflows/propose.ts), [apply-change.ts](https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/src/core/templates/workflows/apply-change.ts)
- [Thoughtworks Radar – OpenSpec](https://www.thoughtworks.com/en-us/radar/tools/openspec) · [YC – OpenSpec](https://www.ycombinator.com/companies/openspec) · [Tabish Bidiwale (GitHub)](https://github.com/TabishB)

---

### 4.3 Kiro (AWS) — specs + steering

#### Identity and maturity
- **Product:** proprietary, from AWS, launched on 2025-07-14. Surfaces: **IDE** (based on Code OSS; IDE 1.1 on 2026-09-14), **CLI** (2.22.0 on 2026-09-16), and **Web** (GA on 2026-09-01).
- **Pricing:** Free (50 credits), Pro US$20, Pro+ US$40, Pro Max US$100, Power US$200, and Enterprise. Extra credits cost US$0.04 each.
- **Specs** live in `.kiro/specs/` and are shared across surfaces: you can start in the CLI and continue in the IDE.

#### Agents and pi
- **Only Kiro itself** runs the flow. pi and Claude Code **don't** run it natively.
- The format (markdown under `.kiro/`) is portable: **cc-sdd** (4.7) replicates the structure for other agents.
- Kiro recognizes `AGENTS.md`.

#### Workflow
- **Feature Spec:** choose **Requirements-First** or **Design-First**.
  1. Generate `requirements.md`.
  2. **Review and approve.**
  3. Generate `design.md`.
  4. **Approve.**
  5. Generate `tasks.md`.
  6. Execute: individual tasks or "all". Kiro builds a dependency graph and runs "waves" of independent tasks.
- **Quick Spec:** asks clarifying questions up front (scope, constraints, edge cases) and generates the 3 artifacts **with no gates**. Page updated on 2026-08-04.
- **Bugfix Spec:** `bugfix.md` with *Current Behavior (Defect)*, *Expected Behavior (Correct)*, and *Unchanged Behavior (Regression Prevention)* → `design.md` (root cause) → `tasks.md` with property-based tests.
- **Analyze Requirements:**
  - reasons across requirements to find inconsistencies, ambiguities, conflicting constraints, unstated assumptions, and missing edge cases;
  - **asks questions** in chat with suggested fixes and updates `requirements.md` as you answer;
  - takes "minutes, not seconds". Page updated on 2026-09-02.
- **Maintenance:** "Refine" on the design and "Sync Files" on `tasks.md` (automatically marks tasks already done).

#### Folder structure
```text
.kiro/
├── steering/                 # project memory (workspace)
│   ├── product.md            # purpose, users, goals
│   ├── tech.md               # frameworks, libs, constraints
│   └── structure.md          # file organization and patterns
└── specs/
    └── save-memory-note/
        ├── requirements.md   # (or bugfix.md)
        ├── design.md
        └── tasks.md
~/.kiro/steering/             # global steering (the workspace takes precedence)
```

#### Artifact contents
- **`requirements.md`:** `# Requirements Document`, `## Introduction`, `## Requirements`, `### Requirement N`, `**User Story:** As a …, I want …, so that …`, and *Acceptance Criteria* numbered in **EARS**.
- **EARS** (Easy Approach to Requirements Syntax; Alistair Mavin et al., Rolls-Royce, RE'09) has 5 patterns:
  - ubiquitous: "THE SYSTEM SHALL …";
  - event-driven: `WHEN … THE SYSTEM SHALL …`;
  - state-driven: `WHILE …`;
  - unwanted behavior: `IF … THEN …`;
  - optional feature: `WHERE …`.
  - Kiro documents the form `WHEN [condition/event] THE SYSTEM SHALL [expected behavior]`.
- **`design.md`:** architecture, sequence diagrams, components and interfaces, data models, error handling, and test strategy. For TypeScript, it generates interfaces. The exact section titles weren't literally verified.
- **`tasks.md`:** `# Implementation Plan`, `- [ ] 1. <task>` with step sub-bullets and `_Requirements: 1.1, 1.5_` traceability.
- **Steering (YAML front matter):**
  - `inclusion: always` (default);
  - `inclusion: fileMatch` with `fileMatchPattern: "components/**/*.tsx"` (accepts a list);
  - `inclusion: manual` (via `#file-name` in chat);
  - `inclusion: auto` with `name` and `description`;
  - file reference: `#[[file:path]]`.

#### Illustrative example
```markdown
<!-- .kiro/specs/save-memory-note/requirements.md -->
# Requirements Document
## Introduction
Command to save short memory notes that persist across sessions.
## Requirements
### Requirement 1
**User Story:** As a dev, I want to save a note with `/remember`, so that the agent can retrieve it in future sessions.
#### Acceptance Criteria
1. WHEN the user runs `/remember <text>` with 1-500 characters THE SYSTEM SHALL persist the note with an id and creation date.
2. IF the text is empty THEN THE SYSTEM SHALL reject the note and display an error message.
3. WHILE the notes file has no write permission THE SYSTEM SHALL preserve the existing notes and report the failure.
```
```markdown
<!-- .kiro/specs/save-memory-note/tasks.md -->
# Implementation Plan
- [ ] 1. Create the note model and validation
  - Define `MemoryNote` and `validateNote()`; length-limit tests
  - _Requirements: 1.1, 1.2_
- [ ] 2. Implement append-only persistence and the `/remember` command
  - _Requirements: 1.1, 1.3_
```

#### Questions before code
- Approval gates between phases (except Quick Spec).
- *Analyze Requirements* (questions about conflicts and ambiguities).
- Quick Spec asks questions before generating.

#### Context across sessions
- Steering loaded automatically according to the inclusion mode.
- `#spec` includes every spec file in a new chat's context.
- Real-time task status in `tasks.md`.
- "Sync Files" to track what was done outside the flow.
- Specs are meant to be version-controlled in git.

#### Strengths
- EARS gives testable requirements.
- Steering with conditional inclusion is a great "project memory" model.
- Bugfix spec with "Unchanged Behavior".
- Analyze Requirements.

#### Weaknesses and criticism
- **Lock-in:** `.kiro/`, Bedrock, and AWS credits ("the spec's value is realized inside Kiro and AWS").
- **Pricing criticism:** the credit model drew a negative reaction from the community.
- **Disproportionate workflow:** Böckeler saw a small bug turn into 4 user stories with 16 acceptance criteria ("sledgehammer to crack a nut").

#### Fit
- **Low** for anyone who wants to stay on pi and Claude Code.
- **High** as a source of ideas (EARS + steering) or via cc-sdd.

#### Sources
- [Specs](https://kiro.dev/docs/specs/) · [Feature Specs](https://kiro.dev/docs/specs/feature-specs/) · [Requirements-First](https://kiro.dev/docs/specs/feature-specs/requirements-first/) · [Quick Spec](https://kiro.dev/docs/specs/quick-spec/) · [Bugfix Specs](https://kiro.dev/docs/specs/bugfix-specs/) · [Analyze Requirements](https://kiro.dev/docs/specs/analyze-requirements/) · [Best practices](https://kiro.dev/docs/specs/best-practices/)
- [Steering](https://kiro.dev/docs/steering/) · [Changelog](https://kiro.dev/changelog/) · [Pricing](https://kiro.dev/pricing/) · [Introducing Kiro](https://kiro.dev/blog/introducing-kiro/)
- [promptz – spec format](https://www.promptz.dev/steering/promptz-steering-kiro-specs) · [codemyspec – Kiro specs (Jun/2026; vendor)](https://codemyspec.com/blog/kiro-specs-explained)
- [EARS (Wikipedia)](https://en.wikipedia.org/wiki/Easy_Approach_to_Requirements_Syntax) · [Böckeler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)

---

### 4.4 BMAD Method (`bmad-code-org/BMAD-METHOD`)

#### Identity and maturity
- **Maintainer:** BMad Code, LLC.
- **License:** MIT, with a trademark notice for "BMad", "BMad Method", and "BMad Core" (see TRADEMARK.md). The GitHub API shows "Other" because of this.
- **Numbers:** ~53k stars.
- **Versions:**
  - **stable: v6.12.0** (GitHub release on 2026-09-04; the changelog says 03/09). Stable v6.0.0 shipped on 2026-02-17.
  - **v7 in preview** on `main`: PR #2768, merged on 2026-09-05 and still unreleased, distributes BMAD as a flat tree of skills via `npx skills add` and plugin marketplaces, and removes the classic npm installer.
  - The docs site appears to reflect `main`, including preview features.
- **Requirements:** Node ≥ 20.12, `uv` (for `bmad-build` and `bmad-build-auto`), Git.
- **High churn:**
  - v6.11 (2026-08-10) renamed `bmad-quick-dev` → `bmad-build` and `bmad-dev-auto` → `bmad-build-auto`, cut the core skills from 14 to 8, and moved config to layered TOML;
  - v6.12 made Build "decide how much ceremony" after investigating, and `persistent_facts` started shipping empty.

#### Agents and pi
- **Stable (v6.12.0):** 48 platform codes, including `claude-code` (`.claude/skills`) and **`pi` (`.agents/skills`)**. pi was added in PR #1854 on 2026-03-08.
- **v7 preview:** `npx skills add` (the Vercel skills CLI, which supports Pi) or Claude Code and Codex plugin marketplaces.

#### Installation
```bash
# stable (v6.x)
npx bmad-method install --directory . --modules bmm --tools claude-code --yes
npx bmad-method install --list-tools        # lists the tools; for pi: --tools pi
# (syntax for several tools in the same flag: not verified)

# v7 preview (main)
npx skills add bmad-code-org/BMAD-METHOD     # then ask the `bmad` skill to run "bmad setup"
# Claude Code: /plugin marketplace add bmad-code-org/bmad-plugins
```

#### Workflow
- **Loop:** Clarify → Plan → Build and verify → Learn and adjust.
- **4 "planning paths"** proportional to size:
  1. **Trivial:** no BMAD.
  2. **One-session:** intent → `bmad-build` → result.
  3. **Epic-sized:** `bmad-spec` → (v7 preview: `bmad-preview-ticketing` → `tickets.toml`) → `bmad-build` per story → `bmad-retrospective`.
  4. **Project-sized:** shared PRD, UX, and architecture → several epic cycles → integration.
- **Skills by phase:**
  - Analysis: `bmad-brainstorming`, `bmad-forge-idea`, `bmad-deep-recon`, `bmad-product-brief`, `bmad-prfaq`.
  - Planning: `bmad-prd`, `bmad-ux` (generates `DESIGN.md` + `EXPERIENCE.md`), `bmad-spec`.
  - Solutioning: `bmad-architecture`, `bmad-create-epics-and-stories`, `bmad-sprint-planning`, `bmad-correct-course`.
  - Implementation: `bmad-build`, `bmad-build-auto`, `bmad-code-review`, `bmad-walkthrough`, `bmad-retrospective`, `bmad-qa-generate-e2e-tests`.
  - Core: `bmad-help` (answers and **recommends the next skill**), `bmad-advanced-elicitation`, `bmad-review`, `bmad-customize`, `bmad-party-mode`.
- **Personas:** Mary (analyst), John (PM), Winston (architect), Amelia (dev), Sally (UX).

#### Folder structure (partially verified)
```text
_bmad/                                   # shared config (layered TOML since 6.11) + scripts
_bmad-output/
├── planning-artifacts/                  # brief, PRD (prds/prd-<name>-<date>/), UX, architecture, epics, specs/spec-<slug>/SPEC.md
└── implementation-artifacts/            # story files, sprint-status.yaml, my-intent.md (build input)
.claude/skills/bmad-*/SKILL.md           # or .agents/skills/ (pi, codex…)
deferred-work.md                         # items deferred by review (exact location not verified)
AGENTS.md                                # <!-- bmad:context --> … <!-- /bmad:context --> block (docs from main)
```

#### Artifact contents
- **`SPEC.md` (`bmad-spec`):**
  - five fields: *Why*, *Capabilities* (each with an intent and a success condition; stable `CAP-N` IDs), *Constraints*, *Non-goals*, and *Success signal*;
  - plus tables, diagrams, and references;
  - "Do not hand-edit it": to change it, run the skill again.
- **PRD:** capabilities grouped by feature, with stable FR IDs and NFRs listed separately. Has a *Create/Update/Validate* mode.
- **Story files:** include an empty `## Plan` section, reserved for the dev agent to fill in.
- **`sprint-status.yaml`:** story status; "show/validate/fix sprint status".

#### Illustrative example — `SPEC.md`
```markdown
# SPEC: Memory notes
## Why
Decisions get lost across the agent's sessions.
## Capabilities
- CAP-1 Save note — intent: record short text; success: the note appears in the next session.
- CAP-2 Reject invalid note — intent: avoid junk; success: empty or >500 characters is refused without writing.
## Constraints
- Local, per-project storage; no new dependencies.
## Non-goals
- Sync across machines; semantic search.
## Success signal
- One week of use with no decisions repeated due to forgetting.
## Open questions
- Deduplicate identical notes?
```

#### Questions before code
- `bmad-forge-idea` tests ideas that are still raw.
- `bmad-brainstorming` and `bmad-advanced-elicitation`.
- `bmad-prd` has two modes:
  - **fast path:** bundles the gaps into 1-2 questions and flags `[ASSUMPTION]`;
  - **coaching path:** section by section, pushing back on weak answers.
- `bmad-spec`: a draft where "every gap becomes an open question," or a guided walk through the 5 fields.
- **`bmad-build`:** investigates and picks the lightest safe path. If there are intent gaps, it writes a plan and **records each gap as an open question to answer before approval**.
- `bmad-sprint-planning`: a readiness gate ("can devs implement without inventing undocumented decisions?").

#### Context across sessions
- Artifacts in `_bmad-output/`.
- `sprint-status.yaml` with a "recommended next action": resume what's in progress → review → start ready stories…
- `bmad-help` recommends the next skill.
- A project context block in `AGENTS.md`, generated by `bmad-project-context`, which "never commits".
- The recommendation is to open a new chat for each `bmad-build`.

#### Strengths
- End-to-end coverage (product → architecture → stories → review).
- Traceability.
- pi support.
- Newer versions scale the ceremony to the size of the task.

#### Weaknesses and criticism
- **Token cost:** issue #511 (Aug/2025) cites files being read repeatedly; 2026 reports mention plan limits being blown through.
- **Learning curve.**
- **"Process multiplier":** reproduces chaos across agents when there's no underlying process (dev.to, Apr/2026).
- **Churn** in naming and distribution (v6.11, v6.12, v7).

#### Fit
- For a small TS plugin, the full flow is overkill.
- You can use just `bmad-build` (one-session) or `bmad-spec` + `bmad-build`.

#### Sources
- [API](https://api.github.com/repos/bmad-code-org/BMAD-METHOD) · [releases](https://api.github.com/repos/bmad-code-org/BMAD-METHOD/releases) · [v6.0.0](https://api.github.com/repos/bmad-code-org/BMAD-METHOD/releases/tags/v6.0.0) · [v6.5.0](https://github.com/bmad-code-org/BMAD-METHOD/releases/tag/v6.5.0)
- [README](https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/main/README.md) · [LICENSE](https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/main/LICENSE) · [CHANGELOG](https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/main/CHANGELOG.md)
- Docs: [home](https://docs.bmad-method.org/), [skills & agents](https://docs.bmad-method.org/reference/skills-and-agents/), [install](https://docs.bmad-method.org/start/install-bmad/), [first change](https://docs.bmad-method.org/start/build-your-first-change/), [planning paths](https://docs.bmad-method.org/plan/choose-a-planning-path/), [requirements/spec](https://docs.bmad-method.org/plan/define-requirements-and-a-specification/), [project context](https://docs.bmad-method.org/existing-codebases/set-and-maintain-project-context/), [stories](https://docs.bmad-method.org/plan/break-work-into-stories-and-track-it/), [build](https://docs.bmad-method.org/build/build-a-change/), [v7 previews](https://docs.bmad-method.org/plan/help-test-v7-previews/)
- [platform-codes.yaml @v6.12.0](https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/v6.12.0/tools/installer/ide/platform-codes.yaml) · [PR #1854 (pi)](https://github.com/bmad-code-org/BMAD-METHOD/pull/1854) · [issue #1853](https://github.com/bmad-code-org/BMAD-METHOD/issues/1853) · [PR #2768 (v7)](https://github.com/bmad-code-org/BMAD-METHOD/pull/2768)
- [issue #511 (tokens)](https://github.com/bmad-code-org/BMAD-METHOD/issues/511) · [third-party issue tracker on 6.12 paths](https://github.com/pasqualtroncone/bmad-issue-tracking/issues/105) · [dev.to – Spec Kit vs BMAD vs OpenSpec (Apr/2026)](https://dev.to/willtorber/spec-kit-vs-bmad-vs-openspec-choosing-an-sdd-framework-in-2026-d3j) · [Reenbit – token cost](https://reenbit.com/bmad-method-token-budget-context-engineering-roi/)

---

### 4.5 Agent OS (`buildermethods/agent-os`)

#### Identity and maturity
- **Maintainer:** Brian Casel (Builder Methods).
- **License:** MIT.
- **Numbers:** ~5.4k stars.
- **Version:** **v3.0.0 (2026-01-20)**. After that there were only script fixes (May/2026) and an "orb setup and resume scripts" commit (2026-08-29). Activity is low.
- **Installation:** the instructions on the site are gated behind an email signup.

#### What changed in v3
- **Refocus on *standards*:** `/discover-standards` and `/inject-standards`, with `index.yml`.
- **Removed:** implementation and orchestration phases, subagent delegation, task breakdown, and spec writing.
- Plan creation moves to the agent's **Plan Mode**, "enriched" by `/shape-spec`.

#### Agents and pi
- The project script copies commands **only to `.claude/commands/agent-os/`**.
- The docs say it works with Cursor, Windsurf, and Codex "since all outputs are markdown," but that requires manual referencing.
- **pi: not officially supported.** The commands depend on plan mode and Claude Code's AskUserQuestion tool. On pi, you'd have to adapt it (plan-mode packages exist).

#### Installation (inferred from the repo's scripts; not verified in the docs, which require an email)
```bash
# base install at ~/agent-os (the script expects this location)
~/agent-os/scripts/project-install.sh [--profile <name>] [--commands-only] [--verbose]
```
- On Windows, the bash script needs Git Bash or WSL.

#### Commands
- `/plan-product`
- `/discover-standards`
- `/index-standards`
- `/inject-standards`
- `/shape-spec`

#### Folder structure
```text
agent-os/
├── product/
│   ├── mission.md        # Problem, Target Users, Solution
│   ├── roadmap.md        # Phase 1: MVP, Phase 2: Post-Launch
│   └── tech-stack.md     # Frontend, Backend, Database, Other
├── standards/
│   ├── index.yml
│   └── <folder>/<standard>.md
└── specs/
    └── 2026-09-23-1430-save-memory-note/
        ├── plan.md        # full plan (Task 1 = "Save spec documentation")
        ├── shape.md       # scope, decisions, conversation context
        ├── standards.md   # full content of the applicable standards
        ├── references.md  # pointers to similar code
        └── visuals/       # mockups/screenshots (optional)
.claude/commands/agent-os/{discover-standards,index-standards,inject-standards,plan-product,shape-spec}.md
```

#### Illustrative example — `shape.md` (summarized)
```markdown
# Shape: save memory note
## Scope
`/remember <text>` command that writes per-project notes.
## Decisions
- Append-only JSONL in `memory/notes.jsonl` (simple, diff-friendly)
- 500-character limit
## Out of scope
- Sync; search
## Standards applied
- typescript/error-handling, testing/vitest
```

#### Questions before code
- **`/shape-spec`:** only runs in plan mode. Uses AskUserQuestion **one question at a time**:
  1. what we're building, with 1-2 follow-ups;
  2. visuals;
  3. reference code;
  4. alignment with the product;
  5. standards confirmation;
  6. plan approval.
- **`/plan-product`:** 7 sequential questions.
- **`/discover-standards`:** an "ask → draft → confirm → create" cycle for each standard.

#### Context across sessions
- Indexed, injectable standards.
- Product docs.
- Persistent spec folder.
- **No** task/state tracking beyond `plan.md`.

#### Strengths
- Great for capturing "tribal knowledge" (standards) in a lean way.

#### Weaknesses
- No longer maintains durable specs or tasks: a Jun/2026 comparison says it "no longer maintains durable specs".
- Centered on Claude Code.
- Low activity.

#### Fit
- A *standards* complement for Claude Code.
- Weak as a complete SDD toolkit, especially on pi.

#### Sources
- [API](https://api.github.com/repos/buildermethods/agent-os) · [releases](https://api.github.com/repos/buildermethods/agent-os/releases) · [README](https://raw.githubusercontent.com/buildermethods/agent-os/main/README.md) · [CHANGELOG](https://raw.githubusercontent.com/buildermethods/agent-os/main/CHANGELOG.md) · [commits](https://github.com/buildermethods/agent-os/commits/main)
- [Site](https://buildermethods.com/agent-os) · [Workflow](https://buildermethods.com/agent-os/workflow) · [Installation (email)](https://buildermethods.com/agent-os/installation)
- Commands: [shape-spec](https://raw.githubusercontent.com/buildermethods/agent-os/main/commands/agent-os/shape-spec.md), [plan-product](https://raw.githubusercontent.com/buildermethods/agent-os/main/commands/agent-os/plan-product.md), [discover-standards](https://raw.githubusercontent.com/buildermethods/agent-os/main/commands/agent-os/discover-standards.md), [inject-standards](https://raw.githubusercontent.com/buildermethods/agent-os/main/commands/agent-os/inject-standards.md) · [project-install.sh](https://raw.githubusercontent.com/buildermethods/agent-os/main/scripts/project-install.sh)
- [codemyspec – 2026 comparison (vendor)](https://codemyspec.com/blog/spec-driven-development)

---

### 4.6 Claude Task Master (`eyaltoledano/claude-task-master`, npm `task-master-ai`)

#### Identity and maturity
- **Maintainer:** Eyal Toledano and team (Wheel Go Fast, Inc.).
- **License:** **MIT + Commons Clause** (prohibits selling the software or paid services based on it).
- **Numbers:** ~28k stars.
- **Version:** latest **v0.43.1 (2026-03-31)**. The latest commits are from Apr/2026 and only touch docs: the task-master.dev URLs were "retired" and the docs moved to tryhamster.com.
- **Status:** the company's focus shifted to **Hamster** (a planning platform). Hamster integration has existed since v0.37.

#### Agents and pi
- **Rule profiles (`src/profiles`):** amp, claude, cline, codex, cursor, gemini, kilo, kiro, opencode, roo, trae, vscode, windsurf, zed. **No pi profile.**
- **Via CLI:** works with any agent that has a shell. On pi this is the natural path, because pi has no native MCP.
- **Via MCP:** `claude mcp add taskmaster-ai -- npx -y task-master-ai`.
- **API key:** requires at least one, unless you use the Claude Code or Codex CLI providers.

#### Installation and workflow
```bash
npm install -g task-master-ai
task-master init --rules claude          # creates .taskmaster/ + editor rules
task-master models                       # configures models/providers
task-master parse-prd .taskmaster/docs/prd.txt
task-master analyze-complexity
task-master expand --all                 # (or --id=5 [--research])
task-master next                         # next task, respecting dependencies
task-master show 5
task-master set-status --id=5 --status=done
task-master update-subtask --id=5.2 --prompt="notes on what was done"
task-master update --from=6 --prompt="change of approach"
task-master add-tag --from-branch        # tags isolate lists per branch/feature
task-master loop                         # v0.41+: Claude Code in a Docker sandbox, 1 task per iteration
```

#### Folder structure
```text
.taskmaster/
├── config.json                  # models/providers, parameters
├── state.json
├── docs/prd.txt                 # (or .md) the PRD
├── tasks/tasks.json             # task "database" (path: not literally verified)
├── reports/                     # complexity report
├── templates/example_prd.txt    # (+ "RPG" variant for complex dependencies)
└── loop-progress.txt            # `loop` progress
```

#### Task format (illustrative example)
```json
{
  "id": 3,
  "title": "Persist memory note",
  "description": "Write append-only notes to the project's notes file",
  "status": "pending",
  "dependencies": [2],
  "priority": "high",
  "details": "Create the directory if missing; use append writes; handle EACCES",
  "testStrategy": "Two consecutive writes followed by a read",
  "subtasks": []
}
```
- Documented fields: id, title, description, status, dependencies, priority, details, testStrategy, subtasks, metadata.
- Documented statuses: pending, done, deferred. Others, like in-progress: not verified.

#### Questions before code
- **Weak.** There's no formal clarification step: quality depends on the PRD, written together with the LLM from the template.
- `research` (with project context and files), `analyze-complexity`, and `expand --research` help, but they don't ask the user questions.

#### Context across sessions
- **Strong on "what to do now":** `tasks.json` with dependencies, `next`, per-branch tags, and timestamped logs via `update-subtask`.
- **Weak on "what and why":** the requirements live in the PRD.

#### Criticism
- Overhead for simple projects.
- API key.
- JSON is bad to review in a PR.
- Non-OSI license.
- Project slowdown.

#### Fit
- **Low** for your goal, which is documentation and questions first.
- Only useful as a "task queue manager".

#### Sources
- [API](https://api.github.com/repos/eyaltoledano/claude-task-master) · [releases](https://api.github.com/repos/eyaltoledano/claude-task-master/releases) · [v0.41.0 (loop)](https://github.com/eyaltoledano/claude-task-master/releases/tag/task-master-ai@0.41.0) · [commits](https://github.com/eyaltoledano/claude-task-master/commits/main)
- [LICENSE](https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/LICENSE) · [README](https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/README.md) · [profiles](https://github.com/eyaltoledano/claude-task-master/tree/main/src/profiles)
- [docs/tutorial.md](https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/docs/tutorial.md) · [docs/configuration.md](https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/docs/configuration.md)
- [docs index](https://docs.task-master.dev/llms.txt) · [task structure](https://docs.task-master.dev/capabilities/task-structure.md) · [PRD](https://docs.task-master.dev/getting-started/quick-start/prd-quick.md) · [installation](https://docs.task-master.dev/getting-started/quick-start/installation.md) · [execute](https://docs.task-master.dev/getting-started/quick-start/execute-quick.md)
- [Hamster – Taskmaster docs](https://tryhamster.com/docs/taskmaster) · [Hamster changelog](https://tryhamster.com/latest/changes/taskmaster)

---

### 4.7 cc-sdd (`gotalab/cc-sdd`) — summarized

- **Identity:** implements the **Kiro-style** flow for other agents. MIT, ~3.7k stars, **v3.0.2 (2026-04-13)**; v3.0.0 (2026-04-09) made Skills mode the primary one. There are commits up to Sep/2026. Supports 14 languages, **including Portuguese**.
- **Agents:** Claude Code and Codex (stable); Cursor, Copilot, Windsurf, OpenCode, Gemini CLI, and Antigravity (beta). **pi: not supported.** I didn't verify whether any target writes to `.agents/skills`, which would let pi read the skills.
- **Installation:** `npx cc-sdd@latest` (default Claude Skills), or `--codex-skills`, `--cursor-skills`, and similar, with `--lang <code>`. The legacy "commands" modes are deprecated.
- **Workflow:**
  1. `/kiro-discovery`: routes the request (extend a spec, implement directly, new spec, or decompose) and writes `brief.md`/`roadmap.md`.
  2. `/kiro-steering` (+ `/kiro-steering-custom`).
  3. `/kiro-spec-init`.
  4. `/kiro-spec-requirements` (EARS).
  5. `/kiro-validate-gap` (optional).
  6. `/kiro-spec-design`: includes a *File Structure Plan* and boundaries between components.
  7. `/kiro-validate-design` (optional).
  8. `/kiro-spec-tasks`: `_Requirements:_` and `_Boundary:_` fields.
  9. `/kiro-impl`: autonomous implementation with a fresh implementer, reviewer, and debugger per task, and TDD.
  10. `/kiro-validate-impl`: GO, NO-GO, or MANUAL_VERIFY_REQUIRED.
  - There's also `/kiro-spec-batch` (multiple specs) and the `kiro-review`, `kiro-debug`, and `kiro-verify-completion` skills.
- **Structure:**
```text
.kiro/
├── steering/{product,tech,structure}.md
├── specs/<feature>/{requirements.md, design.md, tasks.md, spec.json, research.md}
└── settings/templates/        # customizable templates (with built-in checklists)
```
- **Questions and context:**
  - each phase pauses for human review, and `spec.json` stores the phase and approvals (exact fields not verified);
  - `brief.md` persists the scope across sessions;
  - steering works as project memory.
- **Fit:** good for anyone who wants "Kiro on Claude Code". No pi; small community.
- **Sources:** [API](https://api.github.com/repos/gotalab/cc-sdd) · [releases](https://api.github.com/repos/gotalab/cc-sdd/releases) · [v3.0.0](https://github.com/gotalab/cc-sdd/releases/tag/v3.0.0) · [README](https://raw.githubusercontent.com/gotalab/cc-sdd/main/README.md) · [skill-reference](https://raw.githubusercontent.com/gotalab/cc-sdd/main/docs/guides/skill-reference.md) · [spec-driven guide](https://raw.githubusercontent.com/gotalab/cc-sdd/main/docs/guides/spec-driven.md) · [migration-guide](https://raw.githubusercontent.com/gotalab/cc-sdd/main/docs/guides/migration-guide.md)

---

### 4.8 Tessl — summarized

- **Company:** founded by Guy Podjarny (ex-Snyk), with ~US$125M raised.
- **Products:**
  - **Registry** in GA: the "Spec Registry" launched in Sep/2025 and was renamed "Skills Registry" in Jan/2026;
  - the **Tessl Framework** (the *spec-as-source* vision, with code regeneration from the spec) remains in **closed beta**, JavaScript-only and non-deterministic, according to a Jun/2026 review published by a competing vendor.
- **Tile `tessl-labs/spec-driven-development` (v2.0.1, MIT, repo `tesslio/spec-driven-development-tile`):**
  - skills: `requirement-gathering`, `spec-writer`, `spec-verification`, `work-review`;
  - rules: `spec-before-code` ("Never begin implementation without an approved spec"), `one-question-at-a-time`, and the optional `spec-format-compliance`;
  - `.spec.md` specs with YAML front matter (`name`, `description`, `targets` with globs) and `[@test]` links to the tests that verify each requirement;
  - the files go into `.tessl/`;
  - installation: `npx @tessl/cli install tessl-labs/spec-driven-development` (or `tessl init` + `tessl install …`).
- **Agents:** "MCP-compatible agent (Claude Code, Cursor, etc.)". **pi: not verified**, and pi has no native MCP.
- **Fit:** the `[@test]` idea (requirement-to-test traceability) and "one question per message" are reusable. The platform itself is too immature to adopt.
- **Sources:** [Registry tile](https://tessl.io/registry/tessl-labs/spec-driven-development) · [tile repo](https://github.com/tesslio/spec-driven-development-tile) · [tile README](https://raw.githubusercontent.com/tesslio/spec-driven-development-tile/main/README.md) · [codemyspec – Tessl review (Jun/2026; vendor)](https://codemyspec.com/blog/tessl-review) · [Böckeler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)

---

### 4.9 Other notable tools in 2026 (not on the original list)

#### 4.9.1 Superpowers (`obra/superpowers`) — highly relevant to your case
- **Identity:** a methodology + skills library by Jesse Vincent. MIT, **~290k stars**, **v6.4.1 (2026-09-19)**.
- **Agents:** Claude Code (plugin marketplace), Codex, Cursor, Gemini CLI, OpenCode, Antigravity, Devin, Droid, Copilot, and others.
  - **pi:** `pi install git:github.com/obra/superpowers`.
  - The README says pi has native skills, and that "subagent and task-list tools remain optional Pi companion packages".
  - v6.4 introduced a *native inline* execution mode, cheaper than subagents, which is good for pi.
- **Workflow:**
  1. `brainstorming`
  2. `using-git-worktrees`
  3. `writing-plans`
  4. `subagent-driven-development` or `executing-plans`
  5. `test-driven-development`
  6. `requesting-code-review`
  7. `finishing-a-development-branch`
- **Questions before code (literally verified):**
  - *hard gate*: no code, scaffolding, or dependencies before completing the prerequisites of the chosen path;
  - "Only one question per message"; "Prefer multiple choice questions";
  - proposes 2-3 approaches with trade-offs and a recommendation;
  - design in sections with approval on each one ("Present, then stop until you hear yes");
  - three paths (spike, bounded, architectural). When in doubt, it picks the heaviest.
- **Artifacts:**
  - a spec at `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`, with a self-review and a user review;
  - a plan at `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`. The header has the goal, architecture, stack, spec path, and constraints. The 2-5 minute tasks carry exact files, code, commands with expected output, and a commit, and placeholders ("TBD") are forbidden.
- **Context across sessions:**
  - ledger `.superpowers/sdd/<plan>/progress.md`: "Tasks with a `Task <N>: complete` line are DONE — do not redo them";
  - versioned plan and spec;
  - SessionStart hooks load the skills bootstrap.
- **Criticism:** the "mega-orchestrator" can blow through context in long sessions; the subagent mode costs tokens (Pulumi, Apr/Aug 2026).
- **Illustrative example (plan excerpt):**
```markdown
### Task 2: Append-only persistence
**Files:** Create `src/memory/store.ts`; Test `tests/memory/store.test.ts`
- [ ] Write a test that writes two notes and reads both back
- [ ] Run `npx vitest run tests/memory/store.test.ts` → Expected: FAIL (appendNote doesn't exist)
- [ ] Implement `appendNote()` with `fs.appendFile`
- [ ] Run the test → Expected: PASS
- [ ] Commit: `feat(memory): append-only note store`
```
- **Sources:** [API](https://api.github.com/repos/obra/superpowers) · [releases](https://api.github.com/repos/obra/superpowers/releases) · [v6.2.0](https://github.com/obra/superpowers/releases/tag/v6.2.0) · [README](https://raw.githubusercontent.com/obra/superpowers/main/README.md) · [repo](https://github.com/obra/superpowers) · [brainstorming](https://raw.githubusercontent.com/obra/superpowers/main/skills/brainstorming/SKILL.md) · [writing-plans](https://raw.githubusercontent.com/obra/superpowers/main/skills/writing-plans/SKILL.md) · [executing-plans](https://raw.githubusercontent.com/obra/superpowers/main/skills/executing-plans/SKILL.md) · [Pulumi – Superpowers, GSD, gstack](https://www.pulumi.com/blog/claude-code-orchestration-frameworks/)

#### 4.9.2 GSD — "Get Shit Done" → **GSD Core** (`open-gsd/gsd-core`)
- **History:** the original `gsd-build/get-shit-done` repository (~64k stars) was **archived on 2026-06-26**. Development continues as **GSD Core**: MIT, ~9.8k stars, **v1.14.0 (2026-09-14)**, installed with `npx @opengsd/gsd-core@latest`.
- **Runtimes:** Claude Code, OpenCode, Kilo, Codex, Kimi, Copilot, Cursor, Windsurf, Cline, Qwen, Augment, Antigravity, Trae, ZCode, and **pi** (`--pi`, installs an extension into `~/.pi/agent/…`).
  - pi support is documented on the `next` branch; `main` has `pi/gsd.cjs`, but the `main` README doesn't list pi. Support in a stable release: not verified.
- **Loop per phase:** `/gsd-new-project` (questions → research → requirements → roadmap) → `/gsd-discuss-phase N` ("lock in your preferences") → `/gsd-plan-phase N` → `/gsd-execute-phase N` (parallel waves, each executor with fresh context) → `/gsd-verify-work N` (manual UAT) → `/gsd-ship N`.
  - Utilities: `/gsd-progress`, `/gsd-pause-work`, `/gsd-resume-work` ("Full context restoration from last session"), `/gsd-quick`, `/gsd-onboard` (brownfield).
- **Structure:**
```text
.planning/
├── PROJECT.md  REQUIREMENTS.md  ROADMAP.md  STATE.md  config.json  MILESTONES.md  HANDOFF.json
├── research/  reports/  todos/  debug/  spikes/  sketches/  codebase/  onboarding/
└── phases/XX-name/{XX-YY-PLAN.md, XX-YY-SUMMARY.md, CONTEXT.md, RESEARCH.md, VERIFICATION.md}
```
- **Fit:** it's the strongest at "not getting lost" (on-disk state + handoff). On the other hand it's heavy ("ceremony overhead for quick scripts") and went through repository turbulence.
- **Sources:** [original API (archived)](https://api.github.com/repos/glittercowboy/get-shit-done) · [gsd-core repo](https://github.com/open-gsd/gsd-core) · [releases](https://api.github.com/repos/open-gsd/gsd-core/releases) · [USER-GUIDE](https://raw.githubusercontent.com/open-gsd/gsd-core/main/docs/USER-GUIDE.md) · [runtimes (next)](https://raw.githubusercontent.com/open-gsd/gsd-core/next/docs/how-to/install-on-your-runtime.md) · [pi folder](https://github.com/open-gsd/gsd-core/tree/main/pi) · [Pulumi](https://www.pulumi.com/blog/claude-code-orchestration-frameworks/)

#### 4.9.3 Quick mentions
- **gstack (`garrytan/gstack`):**
  - MIT, ~134k stars, created in Mar/2026;
  - 23 "roles" (CEO, eng manager, QA…) for Claude Code, Codex, OpenCode, Cursor, Droid, Kiro, and others; **pi not mentioned**;
  - planning skills (`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/autoplan`) read and write a shared `DESIGN.md`;
  - it's more "review by role" than SDD.
  - Sources: [API](https://api.github.com/repos/garrytan/gstack) · [README](https://raw.githubusercontent.com/garrytan/gstack/main/README.md).
- **Conductor (Google, `gemini-cli-extensions/conductor`):**
  - Apache-2.0, ~3.7k stars; for Antigravity and Claude Code;
  - structure: `conductor/{product.md, product-guidelines.md, tech-stack.md, workflow.md, tracks.md, code_styleguides/}` and `conductor/tracks/<id>/{spec.md, plan.md, metadata.json}`;
  - commands: `/conductor:conductor-setup`, `…-new-track`, `…-implement`, `…-status`, `…-revert`, `…-review`.
  - Sources: [API](https://api.github.com/repos/gemini-cli-extensions/conductor) · [README](https://raw.githubusercontent.com/gemini-cli-extensions/conductor/main/README.md).
- **pi-sdd-kit (`felipefontoura/pi-sdd-kit`):**
  - **pi-native** (`pi install npm:@felipefontoura/pi-sdd-kit`), with 10 `/skill:sdd-*` skills;
  - IDEA → PLAN → PRD → SPEC → TASKS → EXEC → REVIEW pipeline, with gates;
  - EARS, steering in `.ai/steering/`, specs in `.ai/sdd/specs/`, and a `.status` file as the source of truth for approvals;
  - **very immature:** ~29 stars, 10 commits, no releases. More useful as a design reference.
  - Source: [repo](https://github.com/felipefontoura/pi-sdd-kit).
- **spec-kitty:** derived from the Spec Kit style, with kanban and worktrees. MIT, ~1.6k stars. Source: [API](https://api.github.com/repos/Priivacy-ai/spec-kitty).
- **Intent (Augment):** commercial, "living specs". Only mentioned in the [specdriven.com landscape](https://specdriven.com/landscape); not verified.
- **Adjacent (not SDD): Beads (`gastownhall/beads`, formerly `steveyegge/beads`):** a "memory upgrade for your coding agent" (an issue tracker for agents). MIT, ~27k stars, active. Not explored in depth. Source: [API](https://api.github.com/repos/steveyegge/beads).

---

## 5. Cross-cutting criticism of SDD (2025-2026)

1. **Wrong-sized process.** Fixed workflows don't fit problems of different sizes: a small bug turned into 4 stories and 16 criteria in Kiro. **Reviewing markdown can cost more than reviewing code.** The templates give a **false sense of control**, because the agent still ignores instructions. There are parallels with the failure of Model-Driven Development. Source: [Böckeler, 2025-10-15](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html).
2. **Concrete measurement.** With Spec Kit (Copilot + Sonnet 4.5), it took 2,577 lines of markdown, 33 min 30 s of agent time, and 3.5 h of review, versus 8 min of agent time and 24 min of review in iterative mode. Verdict: "not a viable process, at least not in its purest form". Source: [Scott Logic, 2025-11-26](https://blog.scottlogic.com/2025/11/26/putting-spec-kit-through-its-paces-radical-idea-or-reinvented-waterfall.html).
3. **Thoughtworks Technology Radar.** The "Spec-driven development" technique is in **Assess**, with criticism of "elaborate and opinionated" workflows and "lengthy spec files that are hard to review," and the caveat that it might be the "bitter lesson" of hand-written rules that don't scale. OpenSpec entered **Assess** in Apr/2026, rated positively as lightweight and agnostic. Sources: [SDD](https://www.thoughtworks.com/en-us/radar/techniques/spec-driven-development) · [OpenSpec](https://www.thoughtworks.com/en-us/radar/tools/openspec).
4. **Spec drift with no automatic fix.** No framework reconciles spec and code on its own. It's recommended to set aside about 30 min per change to reconcile them. One-line constitution rules fail; it's better to write "don't do X because Y; instead do Z". Source: [dev.to, 2026-04-23](https://dev.to/willtorber/spec-kit-vs-bmad-vs-openspec-choosing-an-sdd-framework-in-2026-d3j).
5. **Token cost and coordination** in multi-agent pipelines (BMAD). Sources: [issue #511](https://github.com/bmad-code-org/BMAD-METHOD/issues/511) · [Reenbit](https://reenbit.com/bmad-method-token-budget-context-engineering-roi/).
6. **2026 market response: scale the ceremony.** Examples: "Build decides how much ceremony" (BMAD 6.12), "scales brainstorming ceremony to task size" (Superpowers 6.3), Quick Spec (Kiro), the shorter path (Spec Kit), and the `core` profile (OpenSpec).

---

## 6. Recommendations for your scenario (solo, small TS plugin, pi + Claude Code)

> What follows is the researcher's opinion, based on the facts above.

### Option 1 (main): **OpenSpec**, `core` profile
- **Why:**
  - official, simultaneous support for pi and Claude Code with a single command (`openspec init --tools claude,pi`);
  - lightweight;
  - brownfield-first;
  - specs accumulate (spec-anchored) and there's history in `archive/`;
  - the JSON CLI makes it easy to resume sessions (`openspec status`);
  - Node, no Python.
- **Gap to cover:** "mandatory clarification". Mitigate with:
  1. a habit: always `/opsx:explore` → `/opsx:propose`;
  2. `rules` in `config.yaml`;
  3. one line in `AGENTS.md` and in `CLAUDE.md`.
- **Illustrative `config.yaml` example:**
```yaml
schema: spec-driven
context: |
  TypeScript extension (ESM, Node 22) for pi and Claude Code. Tests with vitest.
  Structure: src/ (code), tests/ (tests). No new dependencies without justification.
rules:
  proposal:
    - Explicitly list "Open questions"; don't generate design/tasks while any question is unanswered.
  specs:
    - Every requirement uses SHALL/MUST and has at least one WHEN/THEN scenario.
  tasks:
    - Each task states its verification command (e.g., npx vitest run <file>).
```

### Option 2 (formal gates): **Spec Kit** (`--integration claude` + `specify integration install pi`)
- **Choose this if** you want the toolkit itself to enforce:
  - `[NEEDS CLARIFICATION]`;
  - clarify (up to 5 questions, recorded in the spec);
  - a checklist that blocks implement;
  - analyze;
  - converge.
- **Costs:** more markdown, Python/`uv`, and high version churn.
- **Tip:** use the full path only for non-trivial features.

### Discipline complement: **Superpowers**
- The brainstorming step (hard gate, one question per message, section-by-section approval) is the market's best "ask before" mechanism, and it runs on pi.
- **Caution:** installing two active toolkits in the same repository can generate conflicting instructions, e.g. two spec folders and two task flows. If you combine them, define in `AGENTS.md` which one is the source of truth.

### Avoid in this scenario
- **BMAD:** heavy and churny; at most an isolated `bmad-build`.
- **Kiro:** lock-in, and doesn't run on pi or Claude Code.
- **Agent OS:** Claude Code only, and no spec/tasks pipeline.
- **Task Master:** no pi, Commons Clause, slowed down.
- **cc-sdd:** no pi.
- **GSD Core:** heavy and with repository turbulence.
- **Tessl:** MCP and beta.

---

## 7. Reusable mechanisms, in case you build your own flow (AGENTS.md + prompt templates)

| Mechanism | Where it comes from | Why it's worth it |
|---|---|---|
| `[NEEDS CLARIFICATION: …]` with a limit (e.g., 3) + "informed guesses" in `Assumptions` | Spec Kit | Avoids both too many questions and silent assumptions |
| Clarify session: at most 5 questions, **one at a time**, with a recommended option, answers recorded in `## Clarifications` → `### Session <date>` | Spec Kit | The answers survive past the end of the session |
| "Incomplete checklist → stop and ask" gate before implementing | Spec Kit | Turns "no code before" into a verifiable rule |
| Delta specs (ADDED/MODIFIED/REMOVED) + `archive/YYYY-MM-DD-*` | OpenSpec | History of decisions and living specs without rewriting everything |
| Injected `context` + per-artifact `rules` | OpenSpec | Project memory always present |
| EARS (`WHEN/IF/WHILE … SHALL …`) | Kiro/cc-sdd | Testable, unambiguous criteria |
| Steering with conditional inclusion (`fileMatch`) | Kiro | The right context without bloating the prompt |
| `Unchanged Behavior` in bugfix | Kiro | Prevents regressions |
| Hard gate + "one question per message" + section-by-section approval | Superpowers / Tessl | Elicitation discipline |
| Progress ledger ("Task N: complete") | Superpowers | Resuming after compaction |
| `STATE.md` + `HANDOFF.json` + a resume command | GSD Core | Explicit "where I left off" |
| `[@test]` linking a requirement to a test | Tessl | Requirement → verification traceability |
| `converge` (code vs. artifacts, adds missing tasks) | Spec Kit | Fights *drift* at the end of a feature |

---

## 8. Unverified items (or only partially verified)

- **Spec Kit:**
  - there's no explicit instruction to "skip `[X]` tasks" when resuming `/speckit-implement`; the state is implicit;
  - the exact content of `.specify/templates/` in the project wasn't confirmed;
  - the lack of automatic AGENTS.md/CLAUDE.md updates is inferred from the `scripts/bash` folder and from `base.py`.
- **Kiro:**
  - exact section titles of `design.md` (the docs describe the topics);
  - `.kiro/` folders beyond `steering/` and `specs/`;
  - the exact date and volume of the "Spec-driven development" blip on the Radar (the page shows the Assess ring).
- **BMAD:**
  - exact content of `_bmad/`;
  - the `planning-artifacts/` path in 6.12 (confirmed only by a third-party issue tracker);
  - syntax for multiple tools in `--tools`;
  - location of `deferred-work.md`;
  - whether the v7 path (`npx skills add`) is ready for pi.
- **Agent OS:** the official installation instructions require an email; the flow was inferred from `project-install.sh`.
- **Task Master:**
  - the literal path of `.taskmaster/tasks/tasks.json`;
  - statuses beyond pending, done, and deferred.
- **cc-sdd:** target directories for skills per agent; `spec.json` fields; the language code for pt.
- **Tessl:** compatibility with pi.
- **GSD Core:** pi support in a stable release (documented on the `next` branch).
- **Superpowers on pi:** flows with subagents and task-list require complementary packages; the exact behavior wasn't tested.
- **Star counts:** read via the API on 2026-09-23 by an automated extractor; treat them as approximate.

---

## 9. Consolidated sources

**Spec Kit:**
- https://api.github.com/repos/github/spec-kit
- https://api.github.com/repos/github/spec-kit/releases
- https://raw.githubusercontent.com/github/spec-kit/main/README.md
- https://github.github.io/spec-kit/
- https://github.github.io/spec-kit/quickstart.html
- https://github.github.io/spec-kit/reference/integrations.html
- https://github.github.io/spec-kit/reference/overview.html
- https://github.github.io/spec-kit/guides/existing-projects.html
- https://raw.githubusercontent.com/github/spec-kit/main/docs/upgrade.md
- https://raw.githubusercontent.com/github/spec-kit/main/docs/history.md
- https://github.com/github/spec-kit/tree/main/templates
- https://github.com/github/spec-kit/tree/main/templates/commands
- https://raw.githubusercontent.com/github/spec-kit/main/templates/spec-template.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/plan-template.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/tasks-template.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/constitution-template.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/specify.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/clarify.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/plan.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/checklist.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/analyze.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/implement.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/converge.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/constitution.md
- https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/taskstoissues.md
- https://raw.githubusercontent.com/github/spec-kit/main/src/specify_cli/integrations/pi/__init__.py
- https://raw.githubusercontent.com/github/spec-kit/main/src/specify_cli/integrations/base.py
- https://raw.githubusercontent.com/github/spec-kit/main/integrations/catalog.json
- https://github.com/github/spec-kit/tree/main/scripts/bash

**OpenSpec:**
- https://api.github.com/repos/Fission-AI/OpenSpec
- https://api.github.com/repos/Fission-AI/OpenSpec/releases
- https://github.com/Fission-AI/OpenSpec/releases/tag/v1.0.0
- https://github.com/Fission-AI/OpenSpec/releases/tag/v1.2.0
- https://github.com/Fission-AI/OpenSpec/releases/tag/v1.6.0
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/README.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/supported-tools.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/opsx.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/concepts.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/explore.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/cli.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/existing-projects.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/migration-guide.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/getting-started.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/installation.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/agent-contract.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/schema.yaml
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/templates/proposal.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/templates/spec.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/templates/design.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/schemas/spec-driven/templates/tasks.md
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/src/core/templates/workflows/propose.ts
- https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/src/core/templates/workflows/apply-change.ts
- https://www.thoughtworks.com/en-us/radar/tools/openspec
- https://www.ycombinator.com/companies/openspec
- https://github.com/TabishB

**Kiro:**
- https://kiro.dev/docs/specs/
- https://kiro.dev/docs/specs/feature-specs/
- https://kiro.dev/docs/specs/feature-specs/requirements-first/
- https://kiro.dev/docs/specs/quick-spec/
- https://kiro.dev/docs/specs/bugfix-specs/
- https://kiro.dev/docs/specs/analyze-requirements/
- https://kiro.dev/docs/specs/best-practices/
- https://kiro.dev/docs/steering/
- https://kiro.dev/changelog/
- https://kiro.dev/pricing/
- https://kiro.dev/blog/introducing-kiro/
- https://www.promptz.dev/steering/promptz-steering-kiro-specs
- https://codemyspec.com/blog/kiro-specs-explained
- https://en.wikipedia.org/wiki/Easy_Approach_to_Requirements_Syntax

**BMAD:**
- https://api.github.com/repos/bmad-code-org/BMAD-METHOD
- https://api.github.com/repos/bmad-code-org/BMAD-METHOD/releases
- https://api.github.com/repos/bmad-code-org/BMAD-METHOD/releases/tags/v6.0.0
- https://github.com/bmad-code-org/BMAD-METHOD/releases/tag/v6.5.0
- https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/main/README.md
- https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/main/LICENSE
- https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/main/CHANGELOG.md
- https://docs.bmad-method.org/
- https://docs.bmad-method.org/reference/skills-and-agents/
- https://docs.bmad-method.org/start/install-bmad/
- https://docs.bmad-method.org/start/build-your-first-change/
- https://docs.bmad-method.org/plan/choose-a-planning-path/
- https://docs.bmad-method.org/plan/define-requirements-and-a-specification/
- https://docs.bmad-method.org/existing-codebases/set-and-maintain-project-context/
- https://docs.bmad-method.org/plan/break-work-into-stories-and-track-it/
- https://docs.bmad-method.org/build/build-a-change/
- https://docs.bmad-method.org/plan/help-test-v7-previews/
- https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/v6.12.0/tools/installer/ide/platform-codes.yaml
- https://github.com/bmad-code-org/BMAD-METHOD/pull/1854
- https://github.com/bmad-code-org/BMAD-METHOD/issues/1853
- https://github.com/bmad-code-org/BMAD-METHOD/issues/2299
- https://github.com/bmad-code-org/BMAD-METHOD/pull/2768
- https://github.com/bmad-code-org/BMAD-METHOD/issues/511
- https://github.com/pasqualtroncone/bmad-issue-tracking/issues/105
- https://reenbit.com/bmad-method-token-budget-context-engineering-roi/

**Agent OS:**
- https://api.github.com/repos/buildermethods/agent-os
- https://api.github.com/repos/buildermethods/agent-os/releases
- https://raw.githubusercontent.com/buildermethods/agent-os/main/README.md
- https://raw.githubusercontent.com/buildermethods/agent-os/main/CHANGELOG.md
- https://github.com/buildermethods/agent-os/commits/main
- https://buildermethods.com/agent-os
- https://buildermethods.com/agent-os/workflow
- https://buildermethods.com/agent-os/installation
- https://raw.githubusercontent.com/buildermethods/agent-os/main/commands/agent-os/shape-spec.md
- https://raw.githubusercontent.com/buildermethods/agent-os/main/commands/agent-os/plan-product.md
- https://raw.githubusercontent.com/buildermethods/agent-os/main/commands/agent-os/discover-standards.md
- https://raw.githubusercontent.com/buildermethods/agent-os/main/commands/agent-os/inject-standards.md
- https://raw.githubusercontent.com/buildermethods/agent-os/main/scripts/project-install.sh

**Task Master:**
- https://api.github.com/repos/eyaltoledano/claude-task-master
- https://api.github.com/repos/eyaltoledano/claude-task-master/releases
- https://github.com/eyaltoledano/claude-task-master/releases/tag/task-master-ai@0.41.0
- https://github.com/eyaltoledano/claude-task-master/commits/main
- https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/LICENSE
- https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/README.md
- https://github.com/eyaltoledano/claude-task-master/tree/main/src/profiles
- https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/docs/tutorial.md
- https://raw.githubusercontent.com/eyaltoledano/claude-task-master/main/docs/configuration.md
- https://docs.task-master.dev/llms.txt
- https://docs.task-master.dev/capabilities/task-structure.md
- https://docs.task-master.dev/getting-started/quick-start/prd-quick.md
- https://docs.task-master.dev/getting-started/quick-start/installation.md
- https://docs.task-master.dev/getting-started/quick-start/execute-quick.md
- https://tryhamster.com/docs/taskmaster
- https://tryhamster.com/latest/changes/taskmaster

**cc-sdd:**
- https://api.github.com/repos/gotalab/cc-sdd
- https://api.github.com/repos/gotalab/cc-sdd/releases
- https://github.com/gotalab/cc-sdd/releases/tag/v3.0.0
- https://raw.githubusercontent.com/gotalab/cc-sdd/main/README.md
- https://raw.githubusercontent.com/gotalab/cc-sdd/main/docs/guides/skill-reference.md
- https://raw.githubusercontent.com/gotalab/cc-sdd/main/docs/guides/spec-driven.md
- https://raw.githubusercontent.com/gotalab/cc-sdd/main/docs/guides/migration-guide.md

**Tessl:**
- https://tessl.io/registry/tessl-labs/spec-driven-development
- https://github.com/tesslio/spec-driven-development-tile
- https://raw.githubusercontent.com/tesslio/spec-driven-development-tile/main/README.md
- https://codemyspec.com/blog/tessl-review

**Superpowers, GSD, and others:**
- https://api.github.com/repos/obra/superpowers
- https://api.github.com/repos/obra/superpowers/releases
- https://github.com/obra/superpowers/releases/tag/v6.2.0
- https://raw.githubusercontent.com/obra/superpowers/main/README.md
- https://github.com/obra/superpowers
- https://raw.githubusercontent.com/obra/superpowers/main/skills/brainstorming/SKILL.md
- https://raw.githubusercontent.com/obra/superpowers/main/skills/writing-plans/SKILL.md
- https://raw.githubusercontent.com/obra/superpowers/main/skills/executing-plans/SKILL.md
- https://api.github.com/repos/glittercowboy/get-shit-done
- https://github.com/open-gsd/gsd-core
- https://api.github.com/repos/open-gsd/gsd-core/releases
- https://raw.githubusercontent.com/open-gsd/gsd-core/main/docs/USER-GUIDE.md
- https://raw.githubusercontent.com/open-gsd/gsd-core/next/docs/how-to/install-on-your-runtime.md
- https://github.com/open-gsd/gsd-core/tree/main/pi
- https://api.github.com/repos/garrytan/gstack
- https://raw.githubusercontent.com/garrytan/gstack/main/README.md
- https://api.github.com/repos/gemini-cli-extensions/conductor
- https://raw.githubusercontent.com/gemini-cli-extensions/conductor/main/README.md
- https://github.com/felipefontoura/pi-sdd-kit
- https://api.github.com/repos/Priivacy-ai/spec-kitty
- https://api.github.com/repos/steveyegge/beads
- https://specdriven.com/landscape
- https://www.pulumi.com/blog/claude-code-orchestration-frameworks/

**pi:**
- https://pi.dev/
- https://pi.dev/docs/latest/skills
- https://pi.dev/docs/latest/prompt-templates
- https://pi.dev/docs/latest/settings
- https://pi.dev/packages
- https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md
- https://github.com/vercel-labs/skills (via search results: the Vercel skills CLI supports Pi)

**Criticism and comparisons:**
- https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html
- https://blog.scottlogic.com/2025/11/26/putting-spec-kit-through-its-paces-radical-idea-or-reinvented-waterfall.html
- https://www.thoughtworks.com/en-us/radar/techniques/spec-driven-development
- https://dev.to/willtorber/spec-kit-vs-bmad-vs-openspec-choosing-an-sdd-framework-in-2026-d3j
- https://codemyspec.com/blog/openspec-vs-spec-kit (vendor)
- https://codemyspec.com/blog/spec-driven-development (vendor)
