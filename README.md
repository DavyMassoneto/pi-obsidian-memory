# pi-obsidian-memory

Long-term memory for the [pi coding agent](https://pi.dev), stored as Markdown notes in
[Obsidian](https://obsidian.md) vaults.

pi forgets everything when a session ends. With this package it keeps what matters (your preferences, the rules and
decisions of each project, lessons from past mistakes) and brings it back when it helps. You can read and edit every
note in Obsidian.

## Contents

1. [Requirements](#requirements)
2. [Install](#install)
3. [Set up](#set-up)
4. [Coming from pi-observational-memory](#coming-from-pi-observational-memory)
5. [How it works](#how-it-works)
6. [Settings](#settings)
7. [Where things are stored](#where-things-are-stored)
8. [Privacy](#privacy)
9. [Troubleshooting](#troubleshooting)
10. [Known limits](#known-limits)
11. [Development](#development)

## Requirements

| What | Why | Required? |
|---|---|---|
| [pi](https://pi.dev) | Runs the package. Tested with pi 1.3.0. | Yes |
| Node 22.19 or later | pi runs the package on it. | Yes |
| A chat model configured in pi | Turns the conversation into observations for compaction (observer) and finds notes for each message (memory agent). Any model pi can use works; a small, cheap one is enough for the memory agent. | Yes |
| A TypeSafe API key (`TYPESAFE_API_KEY`) | Jev, TypeSafe's classifier, decides which notes help each message and checks shell commands (see [Guards](#guards)). Get a key at [typesafe.ai](https://docs.typesafe.ai). Price: $0.042 per million input tokens. | Strongly recommended |
| [Obsidian](https://obsidian.md) | Reading and editing the notes. | No: notes are plain Markdown |

**Without `TYPESAFE_API_KEY`:** no notes are added to your messages (pi tells you once per session), and every
`bash` or `powershell` call is refused, because the shell-edit guard cannot check it.

### Setting the TypeSafe key

Set the environment variable before starting pi:

```bash
# macOS / Linux (add it to ~/.bashrc or ~/.zshrc to keep it)
export TYPESAFE_API_KEY=your-key
```

```powershell
# Windows (kept for new terminals)
setx TYPESAFE_API_KEY "your-key"
```

The key can also be pi's stored credential for the `typesafe` provider. It is never written to this package's config.

## Install

```bash
pi install npm:pi-obsidian-memory
```

Then restart pi. To try it for one run without installing: `pi -e npm:pi-obsidian-memory`.

`pi list` shows installed packages; `pi update` updates them.

## Set up

1. **Create the global vault.** Run `/memory-setup` in pi. It asks:
   - where the global vault goes: a new folder, or an existing folder (an Obsidian vault you already have works);
   - which chat model runs the observer and the consolidator: they turn the conversation into observations and the
     oldest observations into notes; the model in use is the default;
   - which chat model runs the memory agent; the list is sorted by price, cheapest first.

   It shows what each choice sends where, then writes the config and the vault.
2. **Give each project its own vault.** Open pi in the project folder and run `/memory-init`. A folder without a
   project vault uses the global vault only.
3. **Use pi as usual.** Say "remember that …" to save something at once. The rest is saved on its own as the session
   grows.

Run `/memory-setup` again at any time to open the settings screen. Both commands need pi's interactive mode.

## Coming from pi-observational-memory

This package now observes and compacts the session the way pi-observational-memory does. Both packages compact, and pi
keeps only one compaction, so uninstall pi-observational-memory:

1. Run `pi list` to see its source.
2. Run `pi remove <source>` with that source.
3. Restart pi.

`/memory-doctor` warns while it is still loaded.

To bring what it saved into the vaults, run `/memory-import` in each project, after `/memory-init`. It reads the topic
files and the journey in `.memory/`, saves what is durable memory as notes, and tells you how many files it read and
how many changes it made. The files in `.memory/` are left as they are.

## How it works

### Two vaults

- **Global vault:** about you. How to address you, your preferences, your patterns, lessons that apply everywhere.
- **Project vault:** about one project. Its rules, decisions, facts, open issues.

Each note holds one point. Its file name is the statement (for example `pnpm/Use pnpm, never npm.md`), the body has
the detail, and the frontmatter says what kind of memory it is:

```markdown
---
id: 01JABCDE7XKQ2M9V3RTN8WPZ5F
type: rule
created: 2026-10-04
updated: 2026-10-04
dontForget: true
---

Use pnpm for every install and script. In CI: `pnpm install --frozen-lockfile`.
```

Types: `rule`, `procedure`, `constraint`, `fact`, `issue`, `question`, `decision`, `lesson`, `goal`, `risk`, `idea`,
`reference`. Notes are written in English. They are never deleted: a retired note moves to `archive/`. The full format
is in [docs/vault-format.md](docs/vault-format.md).

### What happens during a session

1. **Session start.** Every note marked `dontForget: true` is loaded into pi's system prompt, in full.
2. **Each message.** Jev decides whether stored memory would help. If yes, the memory agent searches and reads the
   vaults, Jev scores each note it found, and the notes that help are added after your message, within
   `context.budgetChars` (12,000 characters by default). A note you changed since it was loaded is sent again.
3. **Observer and compaction.** After each turn, the observer reads each new stretch of the conversation (10,000
   tokens by default) and writes dated observations into the pi session. When the context reaches 150,000 tokens,
   memory compacts the session: the older part is replaced by a block with the memory map (the names of the notes in
   both vaults) and the observations, and the last 20,000 tokens are kept word for word. `/compact` and pi's own
   compactions use the same block. A run that was compacted while it used tools goes on by itself.
4. **Consolidation.** When the observations kept in the session pass 15,000 tokens, the consolidator turns the oldest
   ones into notes, in the background, until about 10,000 tokens of observations remain: it adds, updates, archives or
   replaces notes in the global or the project vault. It never asks you anything: what it is unsure of is not saved.
   Tasks, progress and history are not memory. They go to the journey, a short dated account of the session that stays
   in the session and opens each compaction block. Observations already consolidated leave the block. The cycle
   follows pi-observational-memory.

You change notes in Obsidian whenever you want. pi must read a note before changing it, and a note you edited since
then is never overwritten.

### Tools the agent uses

| Tool | Does |
|---|---|
| `memory_search` | Finds notes by words and by meaning, in the global vault, the project vault or both |
| `memory_get` | Reads a note, a folder's index, or anything under `archive/` |
| `memory_add` | Saves a new note |
| `memory_update` | Changes a note |
| `memory_archive` | Moves a note to `archive/` |
| `memory_succeed` | Replaces a note with a new one; both link to each other |

The bundled skill `obsidian-memory` teaches the agent where notes go and how to use these tools.

### Commands

| Command | Does |
|---|---|
| `/memory-setup` | First setup; afterwards, the settings screen |
| `/memory-init` | Gives the current project its own vault |
| `/memory-doctor` | Checks the vaults, the config, the models and the keys, and says what is wrong |
| `/memory-export` | Saves both vaults to a new `.zip` |
| `/memory-import` | Saves what pi-observational-memory wrote in `.memory/` as notes |

### Guards

- **Vault guard.** The agent reaches the vaults only through the memory tools. pi's file tools (`read`, `write`,
  `edit`, `grep`, `find`, `ls`) on a vault are refused, and so are shell commands that write a vault path out. You and
  Obsidian are not affected.
- **Shell-edit guard.** Before every `bash` or `powershell` call, Jev checks whether the command edits a file: a
  redirect, an in-place edit, inline code, a script that writes, a copy or download that creates a file, or a
  hardlink. If so, the call is refused and the agent is told to use `edit` or `write`. When Jev cannot answer, the
  call is refused.

### Read-only entry

A second entry, `src/pi/read-only-extension.ts`, is not in the package manifest, so it is never loaded by default. Load
it by path, for example `pi -e <package folder>/src/pi/read-only-extension.ts`, in a session that should read memory
but never change it. It registers:

- the tools `memory_search` and `memory_get`;
- no `/memory-*` command;
- the injection of memory into the prompt (session start and each message);
- the vault guard.

It does not register the other four memory tools, the observation cycle (no observer, no memory compaction, no
consolidator: pi compacts such a session on its own) or the shell-edit guard.

### Shell-edit guard key

Another extension can turn the shell-edit guard off for one session. It emits an event on the pi event bus:

- **Channel:** `pi-obsidian-memory:session-key`.
- **Payload:** `{ shellEditGuard: boolean }`.
- **Default:** the guard is on. Only a payload with `shellEditGuard: false` turns it off; `shellEditGuard: true` turns it
  back on. The last payload wins.
- **Malformed payload:** anything else (no payload, `null`, an object without the key, `"false"`, `0`) leaves the guard on,
  or turns it on again.

The key affects only the shell-edit guard. The vault guard does not change.

### Dashboard

Each vault gets a `Memory.base` file: an Obsidian view of all notes, the Don't forget notes and the archive. Your edits
to it are kept.

## Settings

All settings are changed in the `/memory-setup` screen, or by asking pi. You never need to edit the file.

| Setting | Default | What it does |
|---|---|---|
| Global vault | chosen at setup | Folder of the global vault |
| Projects | none | Each project folder and its vault, added by `/memory-init` |
| Observer model | the model in use at setup | Chat model that turns the conversation into observations |
| `observer.thinking` | low | Thinking level of the observer model |
| `observer.chunkTokens` | 10,000 | Tokens of conversation the observer reads at a time |
| `observer.concurrency` | 4 | Observers that run at the same time |
| `compaction.atContextTokens` | 150,000 | Context tokens at which memory compacts the session |
| `compaction.tailTokens` | 20,000 | Tokens of the latest conversation kept word for word after a compaction |
| `compaction.mapTokens` | 2,000 | Tokens of the memory map in the compaction block |
| Consolidator model | the observer model at setup | Chat model that turns the oldest observations into notes |
| `consolidator.thinking` | medium | Thinking level of the consolidator model |
| `consolidator.atPoolTokens` | 15,000 | Tokens of observations in the session at which the consolidator runs |
| `consolidator.poolTargetTokens` | 10,000 | Tokens of observations left in the session after it runs |
| `consolidator.journeyTokens` | 1,000 | Size of the journey; older parts are shortened past this |
| Memory agent model | chosen at setup | Chat model that searches and reads notes for each message |
| `context.budgetChars` | 12,000 | Characters of relevant notes added at session start and to each message (Don't forget notes do not count) |
| `limits.maxStatementChars` | 100 | Longest note name |
| `limits.maxBodyChars` | 1,000 | Longest note body |
| `limits.maxNotesPerFolder` | 20 | `/memory-doctor` suggests splitting a folder above this |
| Embeddings | local | Model for search by meaning: local (no key), OpenAI (`OPENAI_API_KEY`) or Google (`GEMINI_API_KEY`) |
| Decision model | Jev | Jev (TypeSafe, cutoffs 0.5/0.5) or Laya (local server, you set the cutoffs) |

Every field, the file format and running Laya locally are in [docs/config.md](docs/config.md).

## Where things are stored

| What | Where |
|---|---|
| Notes | The vault folders you chose |
| Settings | `pi-obsidian-memory/config.json` in pi's agent folder (`~/.pi/agent` by default) |
| Search index | `pi-obsidian-memory/index/` in pi's agent folder; rebuilt from the notes when needed |
| Local search model | `pi-obsidian-memory/models/` in pi's agent folder; downloaded once, about 135 MB |

The vaults hold only notes, their `index.md` files, `_templates/` and `Memory.base`, so they can live in any synced
folder (OneDrive, iCloud, Dropbox).

## Privacy

- The observer, the consolidator and the memory agent send conversation and note content to the chat models you choose.
- Observations and the journey are kept in the pi session file, like the conversation.
- Jev sends your messages, candidate notes and shell commands to TypeSafe.
- Search by meaning runs on your machine by default; OpenAI or Google receive note content and queries only if you
  choose them.
- `/memory-setup` shows each of these before it saves.
- Notes are saved as written, without masking. The config file never holds a key.

## Troubleshooting

Run `/memory-doctor` first: it checks the vaults, the config, the models and the keys, and says what is wrong. The only
thing it offers to change is a blank note, after asking you.

| You see | Do |
|---|---|
| "Memory is off" or "Run /memory-setup first" | Run `/memory-setup` |
| "No chat model is available" during setup | Connect a model in pi (`/login`), then run `/memory-setup` again |
| No relevant notes are ever added | Check that `TYPESAFE_API_KEY` is set, then run `/memory-doctor` |
| "Refused: the shell-edit guard could not check this command" | Same: the shell-edit guard needs Jev |
| "Memory observer failed: …" | The text after the colon names the cause, for example a model without a key. It tries again a minute later; `/memory-doctor` checks the observer model |
| "Memory consolidation failed: …" | The text after the colon names the cause. It tries again a minute later; `/memory-doctor` checks the consolidator model |
| "… so pi compacted it on its own" | The observer had not covered the start of the session yet. Nothing to do: it catches up, and the next compaction uses its observations |
| "Memory could not compact the session: …" | The text after the colon names the cause, for example "Nothing to compact (session too small)". Nothing was compacted, and a run the compaction interrupted goes on. Nothing to do: memory tries again once the conversation has grown |
| `No API key found for "<provider>"` in `/memory-doctor` | Log in to that provider in pi (`/login`) or set its key |

## Known limits

- Paths are compared ignoring case on Windows and macOS and with case on Linux, whatever the volume.
- The vault guard does not see a vault path the shell builds indirectly (variables, globs, scripts), tools of other
  extensions, or foreground subagents.
- How well the consolidator judges what to save is checked only by end-to-end scenarios: a stated rule is saved, a
  task is not, and a rule and a secret stated in Portuguese become English notes that keep the secret as written.
- Consolidation starts at the end of a turn. Observations made after the last turn wait for the next one.
- With pi-observational-memory also installed, only one of the two compactions is kept (see
  [Coming from pi-observational-memory](#coming-from-pi-observational-memory)).
- **Index lock.** The search index is shared by every pi session of the same agent folder. Opening, reading and writing
  it wait for a lock while another live process holds it. The wait is synchronous and Esc does not stop it. It ends when
  the other process releases the lock; to end a wait that does not finish, close the pi session that holds the lock or
  end its process. The system then releases the lock: a process that dies never leaves it held, and a reused process ID
  blocks nobody.
- **Process without the lock.** A process that runs the memory without the lock does not see it. A collision with it
  still returns "unavailable" at once instead of waiting.
- **Index corrupted again.** If the index becomes corrupt again while one process keeps a connection to it open and
  another process recovers it, the recovery can fail or be lost. On Windows the swap fails with `EPERM`, and the second
  process's operation returns without that vault. On Linux and macOS the swap succeeds, and the first process writes to
  the old file, already unnamed, and loses those writes until it opens the index again (POSIX `rename` semantics, not
  measured here). The index is rebuilt from the notes, so no note is lost.

## Development

```bash
npm install
npm run lint
npm run typecheck
npm test              # offline: pure tests and tests on a real temporary disk
npm run test:e2e      # the real pi over RPC, through OmniRoute
npm run test:model    # live tests: real models and network
pi -e ./src/pi/extension.ts
```

`npm run test:e2e` runs one test per feature with the real `cc/claude-haiku-5-5` through OmniRoute
(`pi-omniroute-sync`) and the real Jev. It reads `OMNIROUTE_URL`, `OMNIROUTE_API_KEY` and `TYPESAFE_API_KEY` from the
environment. CI runs it on Windows, and lint, typecheck and `npm test` on Windows, macOS and Linux.

Releases are automatic: a push to `main` with a `feat` or `fix` commit bumps the version, rewrites `CHANGELOG.md`,
publishes to npm and creates the GitHub release.

More: [vision](docs/VISION.md), [roadmap](docs/ROADMAP.md), [note format](docs/vault-format.md),
[settings](docs/config.md).

## License

[MIT](LICENSE)
