# Roadmap

What is still pending. [VISION.md](VISION.md), [config.md](config.md) and [vault-format.md](vault-format.md)
describe the target behaviour; the README says what works today. Everything already built is in git history.

Every milestone:

- starts by checking whether pi-hermes-memory already does it, and reuses only what is needed (VISION 1);
- is built test first, layer by layer (AGENTS.md), with one folder per topic;
- adds its settings to [config.md](config.md) with their defaults, and `/memory-setup` writes them;
- ends with `npm test`, `npm run lint`, `npm run typecheck` and `npm run test:pi` passing on Windows (VISION 14);
- ends with the README saying what works, and with every text the LLM or the user sees naming only commands
  and tools that exist.

## Settled behaviour

- **Vault access (VISION 12, as written).** The LLM never reads or writes a vault file except through the memory
  tools, whatever route it takes: pi's file tools and bash (paths written out or reached indirectly). Blocking pi's file tools is one part of this, not all of it. Commands the
  user runs, and edits in Obsidian, are not the LLM and stay free.

## Milestones

### 2. Memory the agent can read (vault access only)

- **Goal:** the LLM can reach the vaults only through the memory tools.
- **Scope:**
  - Vault access only through the memory system (VISION 12, Settled behaviour):
    - pi's file tools and shell commands that write a vault path out (in any case, with either separator, relative to
      the working folder) are refused, and each refusal names `memory_search` and `memory_get`;
    - files outside the vaults stay reachable as before;
    - the routes the user accepted on 2026-10-17 (below) stay open.
- **Done when:**
  - a test proves that reading and writing a vault file through each guarded route is refused and that the file on
    disk is unchanged;
  - the same routes still read and write a file outside the vaults;
  - the shell-edit guard (next milestone) refuses hardlink creation.
- **Decided by the user (2026-10-17).** Hardlink creation through the shell is refused by the shell-edit guard
  below. Reading a vault through a path the shell builds indirectly, tools of other installed extensions, and
  foreground subagents (which load no extensions; background ones load this extension) are accepted as they are.
  Claude Code through pi-claude-bridge is outside this package.
- **Today** the guard blocks pi's file tools (`read`, `write`, `edit`,
  `grep`, `find`, `ls`), `bash`/`powershell` commands that write a vault path out (any case, separator, `~`, `$HOME`,
  `%USERPROFILE%`, Git Bash drive forms, relative to the working folder), junctions, symlinks, device paths and
  loopback shares into a vault (compared by file identity).
  `grep`/`find` are refused from any folder above a vault. The config file, the search index and the model cache are
  not guarded, so the LLM can read and edit them.
  Raw device paths (`\\.\C:`) are refused for the file tools. In commands, shares named by host name or IPv6, volume
  GUID paths, 8.3 short names, and commands acting on a parent folder of a vault (for example
  deleting `~/.pi/agent`) are not recognised. With no valid config no vault is known, so nothing is refused. Tools the guard does not know
  pass. Evidence for the routes an extension cannot close is in `.pi/research/vault-guard.md`.

### Shell-edit guard (Jev)

- **Goal (user rule):** the shell never edits files; files are created or changed only with the `edit` and `write`
  tools. Deleting, moving and renaming stay allowed, and so do lint, formatters, git, npm and test runners.
- **Scope:**
  - [ ] before every `bash`/`powershell` call, Jev (`jev-latest`) gets the command, the working folder and the text
    of the scripts it runs, and answers narrow yes/no questions in one request: redirection into a file, in-place
    edit, inline code that writes a file, a script that writes a file, a file created by copy or download, and a
    hardlink created;
  - [ ] any answer at or above its measured cutoff refuses the call, naming the question and pointing to
    `edit`/`write`; when Jev cannot answer, the call is refused with the cause;
  - [ ] cutoffs measured on labelled commands, split into fit and check groups, with the results documented.
- **Done when:** the labelled check group shows each question separating, and the guard refuses the edits and lets
  the allowed runs through in tests.

### 4. Automatic capture (judgement still unproven)

- **Goal:** memory grows from the conversation, without the user asking.
- **Scope:**
  - [ ] It follows the types and the Not memory list, and writes notes in English (VISION 7). Secrets are saved like any
    note (VISION 11).
- **Done when:**
  - [ ] tasks, TODOs and session logs are not saved; a stated secret is saved as written.
  - These judgement items (Not memory list, English, tasks and session logs not saved, secrets saved as written) need
    a real model to prove; no test does.

## Where each VISION decision still lands

| Decision | Pending |
|---|---|
| 1 Reuse | every milestone (checked first) |
| 7 Language | 4: captured notes in English |
| 11 Secrets | 4 proves a secret is saved as written |
| 12 Vault access | Shell-edit guard (Jev) |
| 14 Platform | every milestone (Windows smoke test) |

## Later / not planned

- Session transcripts or "in progress" notes in the vault: VISION, Not in scope.
- Saving skills to the vaults: VISION, Not in scope.
- Hosts other than pi: VISION 14, not for now.
- Searching past pi sessions: VISION, not for now.
- Platforms other than Windows: Windows first; others are not tested until the user asks.
- Consolidation or an approval step: ruled out by the user (memory is written directly, with full detail).
- Masking or blocking secrets: VISION 11 rules it out.
- Checking links at the same moment as the read or write: a known limit in vault-format Writing.
- `schemaVersion` and format migrations: only when the format first changes.
- New note types: only with the user's approval.
- Copying or moving notes between vaults, importing or restoring from an export.
