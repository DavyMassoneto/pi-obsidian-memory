# pi-obsidian-memory

Long-term memory for the [pi coding agent](https://pi.dev), stored in [Obsidian](https://obsidian.md) vaults.

Coding agents forget everything between sessions. This pi package gives pi a memory that you can read and edit in
Obsidian:

- **A global vault about you**: how to address you, your preferences, patterns and lessons.
- **One vault per project**: decisions, facts and rules of that project.
- **Plain Markdown notes**, in folders you choose. Retired notes move to `archive/`; nothing is deleted.

pi uses the memory in three ways: it saves what you ask it to remember, it finds the notes that matter for each
message, and in the background it reviews the conversation and keeps the notes up to date.

Runs on Windows, macOS and Linux, with pi 1.3 or later and Node 22.19 or later.

## Install

```bash
pi install npm:pi-obsidian-memory
```

Restart pi (or run `/reload`). To try it for one session without installing: `pi -e npm:pi-obsidian-memory`.

## What you need

| | For | Without it |
|---|---|---|
| A chat model in pi | Capture and the memory agent | Required |
| `TYPESAFE_API_KEY` ([TypeSafe](https://docs.typesafe.ai)) | Picking the relevant notes per message (Jev) and the shell-edit guard | Relevant notes per message are off; every shell command is refused |
| [Obsidian](https://obsidian.md) | Reading and editing the notes | Optional: the notes are plain Markdown |

Set `TYPESAFE_API_KEY` in your environment, or store it in pi's credentials for the `typesafe` provider. Jev costs
$0.042 per million input tokens (docs.typesafe.ai). Semantic search uses a local model by default, downloaded once
(about 135 MB); no key is needed.

## Get started

1. Run `/memory-setup`. It asks where the global vault goes (a new folder or an existing one), which chat model
   captures memory and which one runs the memory agent (a small, cheap one is enough). Run it again later to open the
   settings screen.
2. In each project folder, run `/memory-init` to give the project its own vault. A folder without one uses the global
   vault only.
3. Talk to pi as usual. Say "remember that…" to save a note. The rest happens on its own.

Both commands need pi's interactive UI. Settings live in `pi-obsidian-memory/config.json` in pi's agent folder,
outside the vaults; you never need to edit it by hand ([all settings](docs/config.md)).

## How it works

- **Don't forget notes.** A note with `dontForget: true` in its frontmatter is loaded in full at the start of every
  session.
- **Relevant notes per message.** For each message, a classifier (Jev) decides whether stored memory helps. If it does,
  the memory agent searches and reads the vaults, and the notes that help are added after your message, within
  `context.budgetChars` (12,000 characters by default).
- **Automatic capture.** As in [pi-hermes-memory](https://github.com/chandra447/pi-hermes-memory), a background
  review saves, updates and archives notes every 10 assistant turns or 15 tool calls, once the session has three user
  messages. What was not reviewed yet is also saved before compaction and when the session ends. It never asks you
  anything; what it is unsure of is not saved.
- **Search by words and meaning.** `memory_search` finds a note even when the words differ.
- **Edits are safe.** pi must read a note before changing it, and a note you edited in Obsidian since is never
  overwritten.

### Tools the agent uses

| Tool | Does |
|---|---|
| `memory_search` | Finds notes in the global vault, the project vault or both |
| `memory_get` | Reads a note, a folder's index, or anything under `archive/` |
| `memory_add` | Saves a new note |
| `memory_update` | Changes a note |
| `memory_archive` | Moves a note to `archive/` |
| `memory_succeed` | Replaces a note with a new one; the two link to each other |

A bundled skill, `obsidian-memory`, teaches the agent where notes go and how to use these tools.

### Commands

| Command | Does |
|---|---|
| `/memory-setup` | First setup; afterwards, the settings screen |
| `/memory-init` | Gives the current project its own vault |
| `/memory-doctor` | Checks the vaults, the config and the models, and reports what is wrong |
| `/memory-export` | Saves both vaults to a new `.zip` |

### Guards

- **Vault guard.** The agent reaches the vaults only through the memory tools. pi's file tools (`read`, `write`,
  `edit`, `grep`, `find`, `ls`) and shell commands that name a vault path are refused. You and Obsidian are not
  affected.
- **Shell-edit guard.** Before every `bash` or `powershell` call, Jev checks whether the command edits a file (a
  redirect, an in-place edit, inline code, a script that writes, a copy or download, a hardlink). If it does, the call
  is refused and the agent is told to use `edit` or `write`. When Jev cannot answer, the call is refused.

### Dashboard

Each vault gets a `Memory.base` file with views of all notes, Don't forget notes and the archive. Your edits to it are
kept.

## Privacy

- Capture and the memory agent send conversation and note content to the chat model you choose.
- Jev sends your messages, candidate notes and shell commands to TypeSafe.
- Semantic search runs locally by default; choosing OpenAI or Google sends note content and queries to them.
- `/memory-setup` warns about each of these before saving.
- Notes are saved as written: no masking. The config file never holds a key.

## Known limits

- Path case: compared ignoring case on Windows and macOS, and with case on Linux, whatever the volume.
- Reading a vault through a path the shell builds indirectly (variables, globs, scripts), tools of other extensions,
  and foreground subagents are not blocked by the vault guard.
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

`npm run test:e2e` runs one test per feature with the real Haiku (`cc/claude-haiku-5-5`) through OmniRoute
(`pi-omniroute-sync`) and the real Jev. It reads `OMNIROUTE_URL`, `OMNIROUTE_API_KEY` and `TYPESAFE_API_KEY` from the
environment. CI runs it on Windows, and runs lint, typecheck and `npm test` on Windows, macOS and Linux.

Releases are automatic: every squash merge into `main` that holds a `feat` or `fix` commit bumps the version, rewrites
`CHANGELOG.md` and publishes to npm.

More: [vision](docs/VISION.md), [roadmap](docs/ROADMAP.md), [note format](docs/vault-format.md),
[config](docs/config.md).

## License

[MIT](LICENSE)
