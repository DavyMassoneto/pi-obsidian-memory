# pi-obsidian-memory

Long-term memory for the [pi coding agent](https://pi.dev), stored in [Obsidian](https://obsidian.md) vaults.

Coding agents forget everything between sessions. This extension gives pi durable memory that changes its future
behavior, that you can read and edit in Obsidian, and that lives in any folder you choose. Memory is two layers of
dedicated vaults: one global vault about you (how to address you, preferences, patterns, lessons) and one vault per
project. Notes are plain Markdown, written in English whatever language you speak, and never deleted: retired notes
move to `archive/`. See [docs/VISION.md](docs/VISION.md) for the decisions behind it.

> **Status:** early development (`0.0.1`), Windows first. Requires Node 22.19 or later.

## Install

From git:

```bash
pi install git:github.com/DavyMassoneto/pi-obsidian-memory
```

From a local clone (loaded from that path, not copied; pi does not install its dependencies, so do it first):

```bash
npm install --omit=dev --prefix ./pi-obsidian-memory
pi install ./pi-obsidian-memory
```

Both write the package to `~/.pi/agent/settings.json`; add `--local` to write `.pi/settings.json` instead (pi reads it
only after project trust is granted). You can also add the source yourself:

```json
{
  "packages": ["git:github.com/DavyMassoneto/pi-obsidian-memory"]
}
```

`pi list` shows installed packages. To try it for one run without installing:
`pi -e git:github.com/DavyMassoneto/pi-obsidian-memory`. Pi's own docs cover every option (`docs/packages.md`).

## Quick start

1. `/memory-setup` chooses where the global vault lives (create a new one or attach an existing folder), picks the chat
   model (pi's current model by default), shows the warnings that apply and writes the config.
2. In a project folder, `/memory-init` registers it with its own vault (created when missing). An unregistered folder
   gets the global vault only.

Both commands need pi's UI. Until `/memory-setup` is done there is no memory, and session start says so. The config is
`pi-obsidian-memory/config.json` in the pi agent directory, outside the vaults; every key is described in
[docs/config.md](docs/config.md). Re-running a command points the config to another vault and leaves the old one as it
was.

## What works

### Tools

The LLM uses these; the ones that write act only on your explicit request ("remember this"), and nothing in the prompt
nudges it to save on its own.

| Tool | Does |
|---|---|
| `memory_search` | Finds notes in the global vault, the project vault or both (words and meaning together) |
| `memory_get` | Reads a note in full with its problems, a folder's index, or anything under `archive/` |
| `memory_add` | Saves a new note when you ask to remember something |
| `memory_update` | Changes a note you asked to change; keeps its identity |
| `memory_archive` | Moves a note to `archive/` |
| `memory_succeed` | Replaces a note with a successor; the two link to each other |

`memory_update`, `memory_archive` and `memory_succeed` first need a `memory_get` of the same note in the session, and
refuse a note that changed on disk since (an edit you made in Obsidian is never overwritten). A shipped skill,
`obsidian-memory`, teaches the agent the layout, note types and these rules; it is never written to a vault.

### Commands

| Command | Does |
|---|---|
| `/memory-setup` | Chooses or attaches the global vault and writes the config |
| `/memory-init` | Registers the working folder as a project with its own vault |
| `/memory-doctor` | Reports problems in the vaults and the config; offers to complete blank notes after you confirm |
| `/memory-export` | Writes both vaults to a new `.zip` (never overwrites; refuses a folder inside a vault) |

`/memory-doctor` lists invalid notes, blank notes, duplicate ids, leftover temporary files and folders over the
notes-per-folder limit, then checks the chat model, the embeddings and the decision model. Every other problem is left
as it is on disk.

### Memory in the conversation

- **Don't forget.** Mark a note with `dontForget: true` in its frontmatter. Every such note, in both vaults, is loaded
  in full at session start, with no limit.
- **Relevant memory per message.** On each message, a fast decision model (a classifier that answers yes/no
  probabilities; it never searches or generates) decides whether memory is needed. If so, the memory agent (a chat model)
  searches and reads, the decision model scores each candidate note, and the relevant ones are added after your message. Earlier
  messages are never rewritten, so the prompt cache holds; a loaded note that changed is added again, marked as
  replacing the earlier copy. Session start also loads relevant notes within `context.budgetChars` (12,000 by
  default). The decision model is Jev by default (by API; it needs `TYPESAFE_API_KEY`; $0.042 per million input tokens, per
  docs.typesafe.ai), working from TypeSafe's starting cutoffs (0.5/0.5). Laya, run locally, is an optional choice that
  needs explicit `gateThreshold` and `relevanceThreshold`: it ships none because its gate measured at chance (see
  [decision-thresholds](docs/decision-thresholds.md)), so with Laya and no cutoffs per-message memory is off and each
  session tells you. Setup steps are in [Running the decision model](docs/config.md#running-the-decision-model). If the decision model is unavailable nothing is added and you are told once per session;
  no other model takes over.
- **Automatic capture.** A background review of the conversation saves, updates, archives and succeeds notes, at the
  moment set by `capture.when`: `after-each-turn` (the default), `on-compaction` or `at-session-end`. When it is unsure
  of the vault, the folder, the type or whether something is memory, it asks you; without a UI it saves nothing. Its
  judgement quality is not yet proven against a real model.
- **Semantic search.** `memory_search` fuses words and meaning. The default is a local multilingual model (about
  135 MB), downloaded when needed, without asking; OpenAI and Google are the alternatives. The index lives outside the vaults and is rebuilt from the notes whenever needed.

### Vault guard

The LLM reaches vault files only through the memory tools. The extension refuses `read`, `write`, `edit`, `grep`, `find`
and `ls` on a vault, `bash`/`powershell` commands that write a vault path out, junctions and symlinks into a vault, and
Claude Code sessions whose tools run through pi. It also refuses writes to the memory data folder (config and index).
You, and Obsidian, are not the LLM and stay free.

Some routes cannot be closed from an extension and stay open pending a decision: hardlinks to a vault file, shell
commands that reach a vault indirectly (variables, globs, scripts), the fail-soft path of pi-claude-bridge, tools of
other extensions, and subagent sessions. The details and options are in
[docs/ROADMAP.md](docs/ROADMAP.md#2-memory-the-agent-can-read).

### Dashboard

Setup and init write `Memory.base` at each vault root when it is missing, with views for all notes, Don't forget and
Archive (file name, folder, type, Don't forget, updated). Your edits to it are kept. It only displays.

## Privacy

- Capture and the memory agent send conversation and note content to the chat model you choose.
- Jev, the default decision model, sends your messages and candidate notes to TypeSafe; Laya, the optional local choice, runs on your machine.
- Choosing a remote embeddings provider (OpenAI, Google) sends note content and queries to it.
- `/memory-setup` warns about each of these before writing, as a plain warning with no question; nothing is asked at
  runtime, and no other provider ever takes the place of the one you chose.
- Secrets are saved as written: the vault is yours, with no masking or blocking.
- Credentials come from pi or the environment; `config.json` never holds a key.
- While the extension is active, pi sets `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` for its own process, so Claude Code
  sessions started by pi (pi-claude-bridge) do not keep a second memory.

## Development

Tested with pi `1.3.0` and TypeBox `1.3.27`, pinned as development dependencies. Pi provides both at runtime;
following its package contract, they are wildcard peers, not bundled runtime dependencies.

```bash
npm install
npm run lint
npm run typecheck
npm test              # unit and integration tests
npm run test:pi       # smoke test in the real pi
npm run test:model    # opt-in: real embedding model benchmark
pi -e ./src/pi/extension.ts
```

`npm run test:model` downloads the local embedding model (about 135 MB) to a cache folder outside the repository
(`%LOCALAPPDATA%\pi-obsidian-memory-bench\models`) and is not part of `npm test`. Run `npm run test:pi` before each
release and after updating pi.

The roadmap is in [docs/ROADMAP.md](docs/ROADMAP.md); the note format is in
[docs/vault-format.md](docs/vault-format.md).

## License

[MIT](LICENSE)
