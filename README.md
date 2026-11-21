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
4. [How it works](#how-it-works)
5. [Settings](#settings)
6. [Where things are stored](#where-things-are-stored)
7. [Privacy](#privacy)
8. [Troubleshooting](#troubleshooting)
9. [Known limits](#known-limits)
10. [Development](#development)

## Requirements

| What | Why | Required? |
|---|---|---|
| [pi](https://pi.dev) | Runs the package. Tested with pi 1.3.0. | Yes |
| Node 22.19 or later | pi runs the package on it. | Yes |
| A chat model configured in pi | Saves notes in the background (capture) and finds notes for each message (memory agent). Any model pi can use works; a small, cheap one is enough for the memory agent. | Yes |
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
   - which chat model saves memory (capture); the model in use is the default;
   - which chat model runs the memory agent; the list is sorted by price, cheapest first.

   It shows what each choice sends where, then writes the config and the vault.
2. **Give each project its own vault.** Open pi in the project folder and run `/memory-init`. A folder without a
   project vault uses the global vault only.
3. **Use pi as usual.** Say "remember that …" to save something. The rest happens on its own.

Run `/memory-setup` again at any time to open the settings screen. Both commands need pi's interactive mode.

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
3. **In the background (capture).** Every 10 assistant turns or 15 tool calls, once the session has at least three of
   your messages, a review reads the new part of the conversation and saves, updates, archives or replaces notes. What
   was not reviewed yet is also saved before pi compacts the session and when it ends. Capture never asks you
   anything: what it is unsure of is not saved. The cadence follows
   [pi-hermes-memory](https://github.com/chandra447/pi-hermes-memory).

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

### Guards

- **Vault guard.** The agent reaches the vaults only through the memory tools. pi's file tools (`read`, `write`,
  `edit`, `grep`, `find`, `ls`) on a vault are refused, and so are shell commands that write a vault path out. You and
  Obsidian are not affected.
- **Shell-edit guard.** Before every `bash` or `powershell` call, Jev checks whether the command edits a file: a
  redirect, an in-place edit, inline code, a script that writes, a copy or download that creates a file, or a
  hardlink. If so, the call is refused and the agent is told to use `edit` or `write`. When Jev cannot answer, the
  call is refused.

### Dashboard

Each vault gets a `Memory.base` file: an Obsidian view of all notes, the Don't forget notes and the archive. Your edits
to it are kept.

## Settings

All settings are changed in the `/memory-setup` screen, or by asking pi. You never need to edit the file.

| Setting | Default | What it does |
|---|---|---|
| Global vault | chosen at setup | Folder of the global vault |
| Projects | none | Each project folder and its vault, added by `/memory-init` |
| Capture model | the model in use at setup | Chat model that saves memory |
| Memory agent model | chosen at setup | Chat model that searches and reads notes for each message |
| `capture.nudgeInterval` | 10 | Assistant turns between background reviews |
| `capture.nudgeToolCalls` | 15 | Tool calls between background reviews |
| `capture.flushMinTurns` | 6 | Your messages a session needs before it is saved at compaction or at the end |
| `capture.reviewEnabled` | on | Background review during the session |
| `capture.flushOnCompact` | on | Save before pi compacts the session |
| `capture.flushOnShutdown` | on | Save when the session ends |
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

- Capture and the memory agent send conversation and note content to the chat models you choose.
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
| "Memory capture did not finish: …" | The text after the colon names the cause, for example a model without a key |
| `No API key found for "<provider>"` in `/memory-doctor` | Log in to that provider in pi (`/login`) or set its key |

## Known limits

- Paths are compared ignoring case on Windows and macOS and with case on Linux, whatever the volume.
- The vault guard does not see a vault path the shell builds indirectly (variables, globs, scripts), tools of other
  extensions, or foreground subagents.
- How well capture judges what to save is not yet measured against a real model.

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
