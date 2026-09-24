# 02 — Comparison, evidence, and how much process to use

> Versions and star counts were read on 2026-09-23. Sources in appendices [A](appendices/A-sdd-toolkits.md) and [B](appendices/B-sdd-workflows.md).

## Comparison table

| Tool / workflow | Weight | pi | Claude Code | Questions before code | Context between sessions | License · version |
|---|---|---|---|---|---|---|
| **GitHub Spec Kit** | Medium-high | ✅ official (`.pi/prompts`) | ✅ skills | ⭐⭐⭐ `[NEEDS CLARIFICATION]` (≤3) + `clarify` (≤5, one at a time, recorded in the spec) + checklist blocks `implement` | `constitution.md` + `specs/NNN/` + `[X]` in `tasks.md` + `converge` | MIT · v1.0.10 |
| **OpenSpec** | Low | ✅ official (v1.2+) | ✅ | ⭐ `explore` (never codes); `propose` only asks if the ambiguity is relevant | injected `config.yaml` + living `specs/` + dated `archive/` + `status --json` | MIT · v1.13.1 |
| **Superpowers** | Medium | ✅ `pi install git:…` | ✅ plugin | ⭐⭐⭐ Hard gate + 1 question per message + section-by-section approval | Versioned spec + plan + `progress.md` ledger | MIT · v6.4.x |
| **GSD Core** | High | ⚠️ only on the `next` branch | ✅ | ⭐⭐ `new-project` + `discuss-phase` (locked-in decisions vs. agent's discretion) | `STATE.md` (<100 lines) + `HANDOFF.json` + `resume-work` | MIT · v1.14.0 |
| **BMAD** | High (scales with the task since 6.12) | ✅ `--tools pi` | ✅ | ⭐⭐ Elicitation, guided PRD, gaps become open questions | `_bmad-output/` + `sprint-status.yaml` | MIT+TM · v6.12 |
| **Kiro** | Medium | ❌ | ❌ | ⭐⭐ Phase-by-phase approval + *Analyze Requirements* | Steering + specs | Proprietary |
| **cc-sdd** (Kiro-like) | Medium | ❌ | ✅ | ⭐⭐ `discovery` + phase-by-phase validation | `.kiro/steering` + `spec.json` | MIT · v3.0.2 |
| **Agent OS** v3 | Low-medium | ❌ | ✅ | ⭐ `/shape-spec` in plan mode | Standards + specs | MIT · v3.0.0 |
| **Task Master** | Medium | ❌ (CLI via shell) | ✅ MCP | Weak (depends on the PRD) | `tasks.json` + `next` | MIT+Commons Clause · stalled |
| **Anthropic (official practices)** | Light | ✅ (it's just prompts + files) | ✅ native | ⭐⭐ Interview with `AskUserQuestion` → `SPEC.md` → new session | `CLAUDE.md`/`AGENTS.md` + spec + git | — |
| **Harper Reed** | Minimal | ✅ | ✅ | ⭐⭐ "One question at a time" until the spec is done | `prompt_plan.md` + `todo.md` with checkboxes | — |
| **HumanLayer RPI/QRSPI** | Medium | ✅ (prompts) | ✅ | ⭐⭐ Only asks what the code can't answer; ~200-line design | `thoughts/` + handoffs + checkboxes in the plan | — |

⭐ = strength of the "ask before" mechanism.

## What the evidence says (2025–2026)

| Source | Finding | Implication for us |
|---|---|---|
| **ETH Zurich** (arXiv 2602.11988, 2026) | Context files (AGENTS.md) **do not improve** overall success and **cost more than 20% extra**. A general repository overview doesn't help; specific instructions are followed | A **minimal** `AGENTS.md`, written by us, with only rules and what can't be inferred from the code |
| **InfoQ / Farrag** (Sep/2026) | A spec gave **+21 points** to weaker models and **+2** to strong ones. Review with a spec: **48 min vs. 27 min**. **Didn't find more bugs** (recall ~0.52 for both), but made **81%** of findings traceable to requirements (vs. 0%) | The gain is in **alignment and traceability**, not in "finding more bugs". Worth it where there's ambiguity, multiple sessions, and risk, which is our case (data on OneDrive) |
| **Scott Logic** (Nov/2025, Spec Kit pre-1.0) | 2,577 lines of markdown for 689 lines of code; 3.5 h of review vs. 24 min in iterative mode | Heavy process on a small task **doesn't pay off**. Keep artifacts short |
| **HumanLayer** (self-critique, Mar/2026) | Plans of ~1,000 lines **don't get read**. The review point should be a ~200-line design. **Reading the code is still mandatory** | Review early and short; the spec doesn't replace reading the diff |
| **Thoughtworks Radar** (Apr/2026) | Context engineering in **Adopt**; Spec Kit and OpenSpec in **Assess**; "agent instruction bloat" in **Caution** | Adopt the patterns; treat the tools as optional; prune instructions |
| **Böckeler** (martinfowler.com, Oct/2025) | Three levels: *spec-first* (worth it), *spec-anchored*, *spec-as-source* (questionable). Critique: a false sense of control and a single flow for every problem size | Spec-first always; spec-anchored only for what's durable (system behavior) |
| **Marmelab / Kent Beck** | "Waterfall with markdown": assumes nothing gets learned during implementation | A **living** spec: when reality diverges, fix the spec first, then the code |

## How much process to use: sizing matrix

| Size | Signals | Process | Artifacts |
|---|---|---|---|
| **Trivial** | The diff fits in one sentence | Ask directly + test + commit | None |
| **Small** | 1–3 files, no architectural decision | 3–5 questions → mini-design in chat → approval → TDD | Note in STATE/commit |
| **Feature** | Several files, some ambiguity | Interview → short spec (≤ 2 pages) → plan with checkboxes → **a new session** implements → review | spec, plan, ADR if there's a decision, STATE |
| **New project** ← *the memory one* | Several subsystems, several sessions, hard-to-reverse decisions | Research → vision → requirements (IDs, v1/v2/out) → architecture + ADRs → roadmap in phases → per phase: interview → spec → plan → execution → verification | Everything above + project roadmap and STATE |
| **Critical / user data** ← *partly ours* (risk of deleting notes on OneDrive) | Data loss, security | Add requirement ↔ test traceability and drift checking | + tests that cite the requirement (`R-07`) |

**Level up when:** hidden complexity shows up, the decision is hard to reverse (file format, tools API), or the work spans multiple sessions.
**Level down when:** you stop reading the artifacts, the spec gets bigger than the code, or the review costs more than it saves.

## Anti-patterns cited by multiple sources

- A bloated `AGENTS.md`/`CLAUDE.md`, or one generated by an LLM, that describes the repository instead of giving rules.
- A long spec that nobody reads; a 1,000-line plan.
- "Trust, then verify": the agent says "done" without showing the test output.
- A "kitchen sink" session: mixed-up tasks and context usage above 60%.
- Two SDD toolkits active in the same repository, with conflicting sources of truth.
- Fixing the code without updating the spec (drift).
