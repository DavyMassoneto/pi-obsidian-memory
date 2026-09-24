# STATE — pi-obsidian-memory

- **Phase:** F0 — Discovery (no code). Configuration ready; next step: vision and requirements.
- **Updated:** 2026-09-24
- **Blockers:** none. Every question is answered in [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md).

## Done
- Pre-project study in [research/](research/README.md).
- Full interview in 12 rounds; every answer is in `OPEN-QUESTIONS.md`. Read the ⚠️ section first, with the decisions that departed from the recommendation.
- Repository with `AGENTS.md`, `docs/` and the `/interview` prompt (in `.pi/prompts/` and `.claude/commands/`).
- **OpenSpec 1.13.1** (global, on fnm's Node 24):
  - initialized for pi and Claude Code, with artifacts in English;
  - `openspec/config.yaml` with the context, the rules and Git Flow;
  - telemetry off.
- **Git Flow** with **git-flow-next 2.0**:
  - `main` (releases) and `dev` (integration);
  - configuration versioned in `.gitflow`;
  - rules in `AGENTS.md`.
- **GitHub:** **public** repository at https://github.com/DavyMassoneto/pi-obsidian-memory, with **`dev`** as the default branch; `main` and `dev` pushed. The GitHub CLI 2.101 is authenticated (use `gh pr create --base dev` when the user asks for a PR).
- **PowerShell 7:** the profile activates fnm, so `node` (v24), `openspec`, `pi`, `gh` and `git flow` are available.
- **npm** (package `pi-obsidian-memory`, MIT, account `davy121`), with automatic publishing set up:
  - `npm run release` calculates the version from the Conventional Commits (git-cliff, rules in `cliff.toml`) and runs Git Flow (`scripts/release/`, in TypeScript, with tests);
  - the `v*` tag on `main` triggers `.github/workflows/release.yml`, which publishes via Trusted Publishing and creates the GitHub Release. Only that workflow can publish;
  - details in [ADR 0001](decisions/0001-automatic-versioning-and-npm-publishing.md).
- **CI** (`.github/workflows/ci.yml`, Windows): runs on every push to the Git Flow branches and on every PR (Biome, types, tests and OpenSpec).
- **Biome** for lint, formatting and imports (`npm run lint` / `npm run format`), with the code rules of `AGENTS.md`: no `;`, limits of 200 lines per file and 30 per function, cognitive complexity up to 15, no `any`, `unknown`, type assertions or index signatures. Every module is a folder, with one file per kind of thing (`types.ts`, `constants.ts`, `schemas.ts`, `errors.ts`, `styles.ts`); the tests mirror the folders. Every code folder has an `index.ts` with only `export *`; another folder is imported through `../index.ts`, and `../../` is forbidden (the tests use `#scripts`).
- **English everywhere in the repository** (code, docs, commits); the conversation with the user stays in Brazilian Portuguese.
- **Quality bar and working style** (Q-H12): readable code; a mature tool instead of a re-implementation; logic covered by tests, and every change verified in practice. Before a non-trivial change, show what was understood and wait for the user's confirmation.

## Key decisions (details in OPEN-QUESTIONS.md)
- **Spec system ≠ memory system.** The project docs live in the repository; the vaults only hold memories.
- **Method and product:** OpenSpec + `docs/` + `/interview`. pi does the implementation. It is a new package, reusing modules from pi-hermes-memory (MIT).
- **Vaults and content:**
  - Obsidian vaults **in any folder**; **OneDrive is optional**, detected and confirmed during onboarding (`sync.provider = none | onedrive`);
  - one dedicated global vault + one per project, registered through a manual map via `/memory-init`;
  - notes **in English**, native to Obsidian, with an index and templates;
  - only learnings and important points.
- **Prompt and search:**
  - global + project summary of ~3k tokens; "Don't forget" always goes in, without a limit;
  - **text + semantic search already in v1**, with local indexes.
- **Data:**
  - the agent only touches the memory vaults, and may rename them while fixing the links;
  - nothing is deleted (it goes to `archive/`);
  - secrets allowed (configurable).
- **Engineering:**
  - Node ≥ 24 · vitest + CI on Windows · Biome · TypeBox for external data · npm + `pi install` · Windows first;
  - **Git Flow**: no direct commits to `main` or `dev`; `feature/` only for product functionality, `chore/` for organization, tooling and process.

## Next action
1. **User:** open **PowerShell 7** in this folder, run `pi` and paste the prompt below.
2. Releases: `npm run release` (only when the user asks). The first functional version will be `0.1.0`.

## Next session prompt (pi)
```text
Read AGENTS.md, docs/STATE.md and docs/OPEN-QUESTIONS.md (start with the ⚠️ section). The research is in docs/research/.
We are in F0: every question has been answered. Do not reopen decisions already made; if a new doubt comes up,
use /interview (one question at a time, with options and a recommendation) and record it in docs/OPEN-QUESTIONS.md.
Follow the Git Flow in AGENTS.md: start with `git flow chore start f0-vision-requirements`.
Propose, in this order, stopping for my approval at each one (one commit per approved document):
1. docs/00-vision.md
2. docs/01-requirements.md: EARS; v1/v2/out; each requirement with its configuration (key, default, validation) and its
   onboarding step (/memory-setup or /memory-init)
3. docs/02-architecture.md (≤ 2 pages) + ADRs in docs/decisions/ for the decisions that are hard to reverse
4. docs/03-roadmap.md: phases; each phase becomes one or more OpenSpec changes (and one Git Flow feature)
Do not write code. At the end, update docs/STATE.md and, with my approval, run
`git flow chore finish f0-vision-requirements` and `git push origin dev`.
```
