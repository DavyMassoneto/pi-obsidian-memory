# 06 — Open questions and points to check (F0 phase script)

> This is the script for the `/interview` of the discovery phase. When the project exists, it becomes `docs/OPEN-QUESTIONS.md`.
> Legend:
> - 🔴 **blocks** approval of the requirements;
> - 🟡 you can accept the recommendation (★) and revisit it later.
>
> Shortcut: answer the 🔴 ones and say "I accept the ★ for the 🟡 ones".

## M — Process

| ID | Question | Why it matters | Options (★ recommendation) | |
|---|---|---|---|---|
| Q-M1 | Which methodology track? | Defines the commands and the docs structure | **A ★ OpenSpec + project layer + our own gate** · B Spec Kit · C Superpowers · D our own 100% kit ([05 §1.1](05-reuse-proposal.md#11-possible-tracks-decision-q-m1)) | 🔴 |
| Q-M2 | Where do the project docs live? | They need to be versioned together with the code and stay accessible to the agent | **★ `docs/` in the repository** (with a link-note in the vault, if you want) · inside the vault | 🔴 |
| Q-M3 | Which agent implements it? | Affects prompts, hooks and gates | **★ pi** (it's the package's host) · Claude Code · alternating between both | 🔴 |
| Q-M4 | Project name, folder and license | `.git` **cannot** live on OneDrive (it corrupts) | Working name `pi-obsidian-memory`; **★ folder `D:\Projects\…`** (outside OneDrive); **★ MIT** (compatible with the base) | 🟡 |

## Strategy

| ID | Question | Why it matters | Options (★) | |
|---|---|---|---|---|
| Q-01 | How to reuse pi-hermes-memory? | Defines the effort and the relationship with upstream | **★ new package reusing modules** · fork with refactor · contribute upstream ([03](03-pi-hermes-memory-anatomy.md#three-reuse-paths)) | 🔴 |
| Q-02 | Which format in the vault? | It's the most expensive decision to reverse, because it dictates the data format | **★ Obsidian native** (index + 1 note per memory + frontmatter + daily log) · keep `MEMORY.md` with `§` | 🔴 |
| Q-03 | Are you already using pi-hermes-memory today (do you have saved memories)? | Defines whether we need import/migration | yes / no | 🔴 |

## A — Scope

| ID | Question | Why it matters | Options (★) | |
|---|---|---|---|---|
| Q-A1 | Which hosts in v1? | v1 scope | **★ pi only, with an agnostic core** · pi + Claude Code already in v1 | 🔴 |
| Q-A2 | What memory types exist? | They become the frontmatter's `type`, the folders and the search | Proposal: `user`, `feedback` (preferences/corrections), `project`, `decision`, `reference`, `lesson` (failures), daily log. Add or remove any? | 🔴 |
| Q-A3 | Does "no limit" mean unlimited storage **and** a configurable injection budget? | The real limit today is what reaches the model ([03](03-pi-hermes-memory-anatomy.md#its-limit-what-it-actually-is)) | **★ yes** · another interpretation | 🟡 |
| Q-A4 | Import the existing memories from pi-hermes-memory? | Continuity | **★ `/memory-import` command** (reads `~/.pi/agent/pi-hermes-memory`) · no | 🟡 |

## B — Vaults and organization

| ID | Question | Why it matters | Options (★) | |
|---|---|---|---|---|
| Q-B1 | One vault or several? | Routing and config | **★ 1 vault + root folder in v1**, with multi-vault planned in the config (per-project routing) · several from v1 on | 🔴 |
| Q-B2 | Root folder name in the vault | Organization | **★ `Agent Memory/`** · another one | 🟡 |
| Q-B3 | Can the agent **read** your notes outside the memory folder? | Privacy and search noise | **★ not in v1** · read-only for folders on an allow list · yes | 🔴 |
| Q-B4 | Can the agent **write** outside the memory folder? | Risk to your notes | **★ never** | 🔴 |
| Q-B5 | Frontmatter fields ([04](04-obsidian-onedrive-memory.md#draft-layout-inside-the-vault-for-discussion)) | Search, dashboard and conflicts | **★ 04's proposal** (`id`, `type`, `description`, `tags`, `project`, `created`, `modified`, `device`, `pinned`, `source`) | 🟡 |
| Q-B6 | Link memories to each other and to the project notes with `[[wikilinks]]`? | Graph in Obsidian | **★ yes, inside the memory folder** · also for your notes | 🟡 |
| Q-B7 | Language of the memories | Tokenizer, stop-words, embeddings | **★ pt-BR** (accent-insensitive search) · mixed pt/en | 🟡 |

## C — Retrieval and injection

| ID | Question | Why it matters | Options (★) | |
|---|---|---|---|---|
| Q-C1 | What goes **automatically** into the prompt? | Cost, cache and quality | **★ `USER.md` + index + `pinned` + today/yesterday daily log (with a budget) + on-demand search** · just the policy, like today · everything | 🔴 |
| Q-C2 | Default injection budget | Cost per session | **★ ~3k tokens, configurable** | 🟡 |
| Q-C3 | Search in v1 | Complexity vs. quality | **★ lexical FTS5 pt-BR in v1**; local multilingual vectors in v2 · vectors already in v1 · remote API | 🟡 |
| Q-C4 | Where do the index, locks and machine config live | **Always outside OneDrive** | **★ `~/.pi/agent/<package>/`** (pi convention) · `%LOCALAPPDATA%\<package>\` | 🟡 |
| Q-C5 | Keep `session_search` (search over pi's session history)? | Useful, but it's another index | **★ yes, local index** · not in v1 | 🟡 |

## D — OneDrive and data safety

| ID | Question | Why it matters | Options (★) | |
|---|---|---|---|---|
| Q-D1 | Can onboarding **pin** the memory folder ("Always keep on this device", `attrib +P`)? | Avoids placeholders, which have already caused data loss (claude-code#62140) | **★ yes, with your confirmation**, revalidating on every startup · no, just warn | 🔴 |
| Q-D2 | How many devices will write to the memory? | Conflict strategy | 1 PC · **2+ PCs → ★ per-device daily log + consolidation on a single device** | 🔴 |
| Q-D3 | Deletion policy | Nothing can disappear without a trace | **★ never delete: move to `archive/`** | 🔴 |
| Q-D4 | Backup and versioning of the memories | Recovery | **★ OneDrive version history + on-demand export** · git on a copy outside OneDrive | 🟡 |
| Q-D5 | Secrets detected on write | Security | **★ block**, like today · mask and save | 🟡 |
| Q-D6 | Do you use **another sync** on the same vault (Obsidian Sync, git, Syncthing)? | Two syncs on the same vault cause conflicts | free-form answer | 🔴 |
| Q-D7 | Are there Obsidian plugins that rewrite files in the background (Linter, Templater, "update modified")? | "Modified externally" loops and conflicts with the agent's writes | free-form answer | 🟡 |

## E — Integration with the Obsidian app

| ID | Question | Why it matters | Options (★) | |
|---|---|---|---|---|
| Q-E1 | Use the Obsidian CLI (requires the app to be open)? | Renames that update links, backlinks | **★ optional in v2** · in v1 · never | 🟡 |
| Q-E2 | Rename or move memories? | External rename breaks links | **★ avoid it: stable `id` + `aliases`** | 🟡 |
| Q-E3 | Generate a `.base` dashboard of the memories during onboarding? | Visibility | **★ yes, optional** | 🟡 |

## F — Configuration and onboarding

| ID | Question | Why it matters | Options (★) | |
|---|---|---|---|---|
| Q-F1 | Where does the configuration live? | Paths change from PC to PC; preferences apply to all of them | **★ local machine config + optional preferences in the vault** · local only · vault only | 🔴 |
| Q-F2 | What does onboarding look like? | It's your requirement | **★ interactive `/memory-setup`** (a warning on the 1st session without config), re-runnable, with a non-interactive mode via env/flags | 🔴 |
| Q-F3 | Auto-detect vaults and OneDrive? | Less typing and fewer errors | **★ yes, read-only** (`%APPDATA%\obsidian\obsidian.json` + OneDrive environment variables and registry) | 🟡 |
| Q-F4 | Which options to expose in v1? | Config surface | Proposal: vault, folder, types, injection mode + budget, search level, OneDrive pin, device, review (on/off, frequency), consolidation, scanner, language, customizable prompts | 🔴 |
| Q-F5 | `/memory-doctor` in v1? | Diagnoses placeholders, pin, conflicts and paths | **★ yes** | 🟡 |

## G — Automatic behavior

| ID | Question | Why it matters | Options (★) | |
|---|---|---|---|---|
| Q-G1 | Background review (saving on its own) | Token cost vs. rich memory | **★ keep it** (every 10 turns / 15 tool calls, only recent messages) · less often · off by default | 🟡 |
| Q-G2 | Flush before compaction | Don't lose what compaction would discard | **★ yes** | 🟡 |
| Q-G3 | Consolidation and deduplication | Unlimited memory grows unchecked | **★ automatic, but as proposals in `inbox/` for you to approve** · fully automatic · manual | 🔴 |
| Q-G4 | How to identify the "project" | Route the project memory | **★ git root** (like today) · configurable name · folder → project map | 🟡 |
| Q-G5 | Do skills (`skill_manage`) and standing rules (`STANDING`) go into the vault? | pi discovers skills by folder | **★ skills in the vault** (`Agent Memory/skills/`), standing rules local · everything local · no skills in v1 | 🟡 |
| Q-G6 | Correction detector in pt-BR | Today the patterns are English-only | **★ yes, with configurable patterns** | 🟡 |

## H — Engineering

| ID | Question | Why it matters | Options (★) | |
|---|---|---|---|---|
| Q-H1 | Minimum Node version | `node:sqlite` avoids a native build | **★ ≥ 22.13** (ideally 24 LTS) | 🟡 |
| Q-H2 | Tests | Safety net | **★ vitest + temporary vault + CI on Windows** | 🟡 |
| Q-H3 | Distribution | Installation | **★ npm + `pi install npm:<package>`** | 🟡 |
| Q-H4 | Platforms | Test scope | **★ Windows first, cross-platform core** | 🟡 |
| Q-H5 | Logs and telemetry | Privacy | **★ local logs, no telemetry** | 🟡 |

---

## Points to check before the code (F0 spikes, only with authorization)

Things the research **couldn't confirm** and that change decisions:

| # | Point | How to check | Affects |
|---|---|---|---|
| P-1 | Does `attrib +P` on a folder make **new** files inherit the pin? Does OneDrive undo the pin after updates? | Test folder on OneDrive; create files; `attrib` | Q-D1 |
| P-2 | Does `.tmp` + `rename` preserve OneDrive's **version history**? | Write 3 versions via rename; check the history on the web | Q-D4, VaultBackend |
| P-3 | Does the `stat.blocks === 0` heuristic detect a placeholder without a false positive on a tiny file? | Free up space for test files of varying sizes; `fs.stat` | VaultBackend |
| P-4 | Real frequency of `EPERM`/`EBUSY` on rename with OneDrive + Defender | Loop of 1,000 writes | Retry/backoff |
| P-5 | Does the format of your `%APPDATA%\obsidian\obsidian.json` match what's expected? | Read it (read-only) | Q-F3 |
| P-6 | How does Obsidian react to an open note changed from outside (merge and cursor)? | Edit with the app open | Q-D7 |
| P-7 | Do pi-hermes-memory's cut points match appendix C (and does the `split('/')` bug on Windows exist)? | Read the code locally (read-only clone) and run the tests | Q-01 |
| P-8 | Do prompt templates with `$ARGUMENTS` work the same way in pi and in Claude Code? | Create `/interview` and test on both | Q-M1 |
| P-9 | Does `@~/.pi/agent/AGENTS.md` inside `~/.claude/CLAUDE.md` import the global rules? | Test in Claude Code | Global layer |
| P-10 | Does `ctx.reload()` apply the new config without restarting pi? | Minimal test extension | Q-F2 |
