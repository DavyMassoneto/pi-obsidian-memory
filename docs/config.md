# Config

One local JSON file on the machine, outside the vaults (`~/.pi/agent/pi-obsidian-memory/config.json`). It is
written by `/memory-setup` and `/memory-init` (below). The user changes a setting in the `/memory-setup` screen, or by
asking pi; nobody has to edit the file by hand. Strict reading, repair drafts,
registration proposals and guarded publication are implemented as resources; the two commands and the session-start
notice use them. Preparing settings does not execute models, download anything or look up credentials.

## Complete format

Every key below is required. The chat model names in this example are placeholders: replace both references with an
explicitly chosen available chat model's provider and id. They are not built-in defaults.

```json
{
  "global": { "vault": "C:/Users/me/OneDrive/Obsidian/Global memory" },
  "projects": [
    { "name": "loja", "folder": "D:/Projects/loja", "vault": "C:/Users/me/OneDrive/Obsidian/loja" }
  ],
  "limits": { "maxBodyChars": 1000, "maxStatementChars": 100, "maxNotesPerFolder": 20 },
  "observer": {
    "model": { "provider": "selected-provider", "id": "selected-model" },
    "thinking": "low",
    "chunkTokens": 10000,
    "concurrency": 4
  },
  "compaction": { "atContextTokens": 150000, "tailTokens": 20000, "mapTokens": 2000 },
  "memoryAgent": { "model": { "provider": "selected-provider", "id": "selected-model" } },
  "context": { "budgetChars": 12000 },
  "embeddings": { "provider": "local", "model": "Xenova/multilingual-e5-small" },
  "decisionModel": { "provider": "typesafe", "model": "jev-latest" }
}
```

### Settings and setup defaults

| Setting | Required value | Setup default |
|---|---|---|
| `global.vault` | Absolute vault folder path | User selection; never invented |
| `projects` | Array of `{name, folder, vault}` registrations | Empty array |
| `projects[].name` | Nonblank string, unique ignoring case | User selection |
| `projects[].folder` | Absolute working-folder path, unique ignoring case/separators | User selection |
| `projects[].vault` | Absolute vault folder path | User selection |
| `limits.maxBodyChars` | Positive integer | 1000 |
| `limits.maxStatementChars` | Positive integer | 100 |
| `limits.maxNotesPerFolder` | Positive integer; doctor reporting threshold | 20 |
| `observer.model` | Exactly `{provider, id}`, both nonblank strings | The pi model in use when `/memory-setup` runs, or another chosen from the priced list; changed by re-running it |
| `observer.thinking` | One of `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max` (pi's thinking levels) | `low` |
| `observer.chunkTokens` | Positive integer: tokens of conversation in one observed chunk | 10000 |
| `observer.concurrency` | Positive integer: observers that run at the same time | 4 |
| `compaction.atContextTokens` | Positive integer: context tokens at which memory compacts the session | 150000 |
| `compaction.tailTokens` | Positive integer: tokens of the latest conversation kept word for word | 20000 |
| `compaction.mapTokens` | Positive integer: token budget of the memory map in the compaction block | 2000 |
| `memoryAgent.model` | Exactly `{provider, id}`, both nonblank strings | Chosen in `/memory-setup` from pi's models sorted by price, cheapest first; changed by re-running it |
| `context.budgetChars` | Positive integer; relevant-memory character budget | 12000 |
| `embeddings` | One exact alternative below | Local multilingual E5 |
| `decisionModel` | One exact alternative below | Jev (`typesafe`, `jev-latest`) |
| `decisionModel.gateThreshold` | Optional number from 0 to 1: the gate asks for memory when its probability is above it | Jev 0.5; Laya none |
| `decisionModel.relevanceThreshold` | Optional number from 0 to 1: a note is kept when its probability is at least this | Jev 0.5; Laya none |

The relevant-memory budget limits the notes loaded at session start and the notes added to each message; Don't forget
notes are outside it. The observer runs
with `observer.model` at `observer.thinking`; the memory agent, with `memoryAgent.model`, searches and reads for each
message and at session start. A chat reference is syntactically validated when the config is read; its availability is checked by
`/memory-doctor` and at use.

Embeddings allow only these closed provider/model pairs, with no other fields:

- `{"provider":"local","model":"Xenova/multilingual-e5-small"}`
- `{"provider":"openai","model":"text-embedding-3-small"}`
- `{"provider":"google","model":"gemini-embedding-001"}`

Decision settings allow only:

- Laya: exactly `provider`, `endpoint`, `model`, `maxTokens`, `headMaxTokens`, and optionally `gateThreshold` and
  `relevanceThreshold`. Provider is `laya`, model is
  `multilingual`. `maxTokens` is an integer from 1 to 8192. `headMaxTokens` is a positive integer strictly less than
  `maxTokens` (default 192). Endpoint validation reuses the decision resource's URL policy: HTTP or HTTPS, parsed
  hostname `127.0.0.1` or `[::1]`, pathname `/v1/systemone`, no credentials, query or fragment. `localhost` is not
  accepted. Port may be chosen explicitly. URL normalization follows the existing resource policy.
- Jev: `{"provider":"typesafe","model":"jev-latest"}` and optionally `gateThreshold` and `relevanceThreshold`. No
  endpoint or token-limit fields.

### When the observer and compaction run

The cycle and its defaults follow pi-observational-memory (MIT). Observations live only in the pi session, in
`obsidian-memory-observations` entries; nothing is written to the vaults. Until the next release, the vaults get only
what the user asks to remember.

- **Observer.** It runs at `agent_start` and at each `turn_end`. It cuts the conversation not observed yet into chunks
  of about `observer.chunkTokens` tokens, breaking only where pi can cut, and starts up to `observer.concurrency`
  observers at a time. At the live end of the session it waits for a full chunk. Each observer sends its chunk to
  `observer.model` and saves the dated observations it returns. A failed chunk stays unobserved and is tried again
  at the first `turn_end` or `agent_start` a minute or more later; the user is told `Memory observer failed: <cause>.
  It tries again in a minute.` once per session for each cause. The extension's own hidden messages are not observed,
  nor are shell commands the user ran with `!!` (their output is kept from the model).
- **Trigger.** After each `turn_end`, memory compacts the session when the context has at least
  `compaction.atContextTokens` tokens and the conversation since the last compaction is longer than
  `compaction.tailTokens` by at least `observer.chunkTokens`. Nothing is triggered while pi retries a failed turn.
  When the turn ended with tool results, the run goes on after the compaction with a hidden message, even when the
  compaction fails; only `Compaction cancelled` (Esc) leaves the run stopped. After a failed attempt the trigger waits
  until the conversation since the last compaction gets shorter, or longer by at least `observer.chunkTokens`.
- **Compaction.** Every compaction (this trigger, `/compact` and pi's own) first observes the history that would be
  cut. It then keeps the latest conversation word for word: the cut is placed after a fully observed part, as close
  as it can to `compaction.tailTokens` tokens. The older part is replaced by a block: a short intro, the memory map
  and `## Observations`, one line per observation (`<id>  <text>`).
- **Memory map.** It starts with `## Memory map` and tells the agent to read notes with `memory_get` and find more with
  `memory_search`. Then `### project vault (<name>)` and `### global vault (<name>)`, each with one line per note not
  archived, sorted by path: `` - `<path>` · <type> ``, plus ` · don't forget` when marked. It fits in
  `compaction.mapTokens` tokens; the line `<N> more notes are not listed; memory_search finds them.` follows when
  notes were left out. A vault that cannot be read gets `Could not read the <vault> vault: <problems>.`, and with no
  notes the map says `The vaults hold no notes yet.`
- **When it cannot.** With no fully observed part yet, pi compacts on its own and the user is told `Memory had no
  observations for the start of this session yet, so pi compacted it on its own.` When memory cannot build its block,
  pi compacts on its own and the user is told `Memory could not build the compaction block, so pi compacted the session
  on its own: <cause>`. When a compaction the trigger started fails, for example pi answers `Nothing to compact
  (session too small)`, nothing is compacted and the user is told `Memory could not compact the session: <cause>`,
  followed by `The run goes on.` when the run resumes. With no config or an invalid one,
  nothing is observed and pi compacts on its own. Esc during a compaction stops it and its observers.

**Old configs.** A file that still has a `capture` group and no `observer` group is read as if it had the new groups,
with no action by the user and no repair notice, and the file is not rewritten; the settings screen writes the new
shape the next time it saves. `observer` gets `capture.model` and the defaults above (`thinking` `low`), `compaction`
is added with the defaults above when it is missing, and every other `capture` key is dropped. Without a valid
`capture.model`, the observer model is reported missing, and `/memory-setup` repairs it.

### Running the decision model

Laya and Jev are classifiers: they answer typed questions with a yes/no probability. They never search and never
generate text. For each user message the decision model is asked two kinds of question, and the memory agent (the chat
model in `memoryAgent.model`) does the searching and reading in between:

1. **Gate:** "does this message need stored memory?" If the probability is not above the gate cutoff, nothing is added
   and the memory agent is not started.
2. **Relevance:** after the memory agent has read some notes, the decision model is asked, for each candidate note,
   "does this note help answer the message?" Notes at or above the relevance cutoff are added, best first, within
   `context.budgetChars`. One question per note, sent in a single batch.

A note that cannot be scored (a failed or invalid answer for that note) is dropped on its own, and the user is told
once per session "could not score N of M notes"; the message fails as a whole only when every note fails. A truncated
Laya answer is a valid score, taken on the start of the text. If the decision model is unavailable, nothing is added for
that message, the user is told once per session, and no other model takes its place. The per-message step has no time limit.

Cutoffs: a value set in `/memory-setup` overrides the default for its provider.

| | Gate | Relevance | Source |
|---|---|---|---|
| Jev | 0.5 | 0.5 | TypeSafe's cookbooks give 0.5 as a starting point |
| Laya | none | none | the measurement does not support a default: the gate scored at chance and the relevance signal is weak (see [decision-thresholds.md](decision-thresholds.md)) |

**Jev is the default** and works from the TypeSafe starting values 0.5/0.5, with `TYPESAFE_API_KEY` set. **Laya is an
optional local choice that needs explicit cutoffs**: with a Laya config and no cutoffs, per-message memory is off and
each session says so, until you set both cutoffs (`decisionModel.gateThreshold` and `decisionModel.relevanceThreshold`)
in the `/memory-setup` screen: nothing is added, no model is asked, and the user is told once per session which cutoff is missing. No
value is invented. `/memory-doctor` lists both cutoffs and where each comes from (config, TypeSafe
starting value or missing).

Laya (local; Apache-2.0, not gated, weights downloaded on first load):

1. `pip install "laya[serve]"` (Python 3.10 or later).
2. Start it bound to the loopback address: `LAYA_HOST=127.0.0.1 LAYA_PORT=8000 laya-serve`. Without `LAYA_HOST` it
   binds to `0.0.0.0` with no authentication. If loading hangs, add `USE_TF=0`.
3. Do not set `LAYA_JEV_STRICT`: the server then omits the field naming the model that answered, and every answer is
   rejected.
4. The config's `model` must be `multilingual`. When checking an answer, the server's own alias for that model in the
   routing reason is also accepted.

What laya-serve receives: each question carries its text in the `instructions` field. Only the gate question is sent
with the answer labels `{"true":"A","false":"B"}`; the relevance questions are sent without labels (plain `noul` separated
better in the measurement). Relevance questions for one message go to the batch endpoint, `POST <endpoint>/batch`, up to 64
states at a time. A server too old for these fields answers 422; the doctor shows the server's detail.

`/memory-doctor` makes one real call to the endpoint, with the real gate question, and reports whether Laya answered
and, if not, the cause.

Jev (TypeSafe System One, by API):

- The API key is `TYPESAFE_API_KEY` in the environment (or pi's credentials for the `typesafe` provider); it is never
  in `config.json`. `/memory-doctor` checks pi's registry and the key, without a live call.
- `jev-latest` is an alias; the API answers with the versioned id (for example `jev-1.13.0`), and that answer is
  accepted for `jev-latest`.
- Price: input $0.042 per million tokens ($42 per billion), output free (docs.typesafe.ai, `models.md`, 2026; see
  `.pi/research/laya-jev.md`). pi's catalog shows cost 0, which is not the real price.

There is no `schemaVersion`, secret/key field, arbitrary provider options bag or persistent consent setting. Credentials
for remote execution come from pi or the environment, never from this file. No credential lookup occurs when
reading, repairing, proposing or publishing configuration.

## Commands

Both commands work only with a UI: without one they ask nothing and write nothing. Vaults are never copied, moved or deleted.

`/memory-setup` has two modes. With no config, or an invalid one, it runs the first setup and writes the config with
every key. Once the config is valid, it opens the settings screen.

**First setup and repair:**

- It asks for the observer model and the memory-agent model, each from a list of pi's available chat models with their
  price per million input and output tokens. For the observer, the model in use in pi comes first, marked, and is the
  default (an empty answer or Escape takes it), as the original roadmap says. For the memory agent, a small
  configurable model, the list is sorted by price, cheapest first, and nothing is defaulted: with no answer nothing is
  written. On a repair the model already in the file comes first, marked as current, and an empty answer or Escape
  keeps it. With no model available and none in the file, setup is refused.
- It asks to create a new vault or attach an existing folder, and for the vault path. Create refuses a non-empty
  folder or a file; attach refuses a missing folder or a file.

**Settings screen (valid config):** one line per setting with its current value, opened with a select; Done or Escape
leaves. Each choice is written at once and the screen shows the new value. The lines are: `Observer model`,
`Observer thinking` (one of the seven levels), `Observe every` (chunk tokens), `Observers at a time`, `Compact at`
(context tokens), `Verbatim tail` (tokens), `Memory map` (tokens), memory-agent model, decision model (Jev, or Laya with its endpoint), gate cutoff, relevance cutoff (a number from 0 to 1, or `none`), embeddings
provider, context budget, the three limits, the global vault, and the projects (change
their vault to an existing folder, or remove them from the memory; nothing is deleted). Switching between Jev and Laya
clears the cutoffs. Choosing Jev or a remote embeddings provider shows its warning. A value the schema refuses is
not written, and the reason is shown. Changes apply on the next use: the observer, compaction, relevant memory and
search read the config each time. Only the Don't forget notes and session-start notes already loaded into the conversation's memory block wait
for the next session or `/reload`, and the notice says so for the global vault and project changes.
- An invalid config is repaired: every valid value is kept, and one list names each missing key and each value that
  could not be kept. A file that is not valid JSON is replaced only after the user confirms.
- Before writing, it shows the warnings that apply (below): chat models always; Jev when selected; remote embeddings
  when selected, as a plain warning with no question.
- Re-run with another path points the config to that vault; the old vault is left as it was. Every note template is
  written to `_templates/` of the vault; templates already there are kept.

`/memory-init` registers the working folder as a project:

- With no valid global setup it refuses and offers `/memory-setup`; with an unreadable config file it refuses and names
  the cause, without that offer.
- The name defaults to the folder name and must be unique ignoring case; a taken name is asked again.
- The vault is created, with `_templates/`, when missing. In an already registered folder the name stays and only the
  vault is repointed; the old vault is left as it was.

Both refuse a vault equal to, inside or containing another registered vault, whatever layer. A config with
such an overlap, or the same vault twice, is invalid.

At session start (startup, new, resume and fork, not reload; only with a UI): no config shows a notice offering
`/memory-setup`; an invalid config shows every problem at once and nothing from the file is used; a file that cannot
be read shows a warning naming the cause.

## Strict reading and explicit repair

- Every key is always written, defaults included, so every value in effect is visible. Missing, invalid or unknown
  fields at any level invalidate the entire file. Reading returns all actionable problems, not a partial config.
  Diagnostics are collected per field, not truncated to the schema library's error-count limit.
- No file means memory is not configured. An old file containing only registration and the two original limits is
  now invalid. Apart from the old `capture` group (see Old configs), there is no silent runtime migration and no
  runtime defaulting. Reading never changes file bytes.
- Repair is separate from reading. `inspectConfigForRepair(text)` returns a draft, not permission to use any of its
  values at runtime. It keeps independently valid settings, including individual chat `provider`/`id`, limits,
  observer and compaction settings, budget and registration fields. Unknown fields are discarded and named. Invalid/missing fields are
  reported even when a setup default can fill them.
- Repair fills known non-chat defaults. A retained embedding provider gets its supported model when that model is
  absent/invalid; a retained `typesafe` decision provider gets `jev-latest` without Laya-only fields. Recognized but
  contradictory provider/model or token-limit choices remain visible and must be corrected, not silently switched.
  Registration conflicts retain every involved entry for correction, rather than choosing a first winner.
- `prepareSetupDefaults(model)` is setup-only. An explicitly supplied valid selected chat model supplies both initial
  chat references; no production provider/id is hardcoded. Passing `null` leaves both unresolved. Repair never
  invents the current chat model. `/memory-setup` offers pi's model in use as the observer default, asks for the memory-agent model, or
  refuses if a model is unresolved.
- Malformed JSON cannot be salvaged and is marked as requiring explicit replacement confirmation. Drafts carry
  problems and replacement metadata; these are not config keys. Setup proposals serialize only the complete settings
  and registrations and refuse unresolved values. Publication validates again and checks the expected snapshot hash.
- Setup proposals change only the global vault registration. Init proposals add a project or repoint the most
  specific matching project, retaining its original working-folder mapping. Both preserve all settings. Repointing
  does not copy, move or delete the old vault. Registration usecases create missing target assets without replacing
  existing templates or dashboard edits.
  Preparation creates nothing. Failed bootstrap or publication retains created assets and reports progress,
  not rollback. A session lease serializes local registration; external hash/path check-use windows remain. Cancellation
  stops before the next resource write, not one already started; successful config publication remains success.
- Vault paths must not be equal or nested across registrations; the global and project layers must not mix. Resource
  validation also checks physical aliases and keeps configuration/index infrastructure outside vaults.
- A vault is named after its folder (`.../Global memory` is "Global memory").

## Warnings

`/memory-setup` shows one warning before writing, with a line for each that applies: the observer and the memory
agent send conversation and note content to the chosen chat models (always); TypeSafe receives user messages and candidate
notes when Jev is selected; remote embeddings providers receive note content, **secrets included**, and queries.
The warning is plain: nothing is asked, and setup continues. A remote provider already in the config is an explicit selection and is never replaced by a
local provider; it is used without any question at runtime. The local model (~135 MB) is downloaded when needed,
without asking, into `pi-obsidian-memory/models` beside `config.json`. If semantic search is off or unavailable,
search uses words only (with a status line), never another provider. API keys come from pi's model registry;
`/memory-doctor` checks embeddings without network. Jev is used without any runtime question; if unavailable,
per-message memory is off, never replaced by another model. An unavailable Laya service is diagnosed by
`/memory-doctor`, never silently replaced or installed.

## Which project a folder belongs to

pi runs in a folder; the project is the registered one whose folder contains it.

| pi runs in | Project |
|---|---|
| `D:/Projects/loja` | `loja` (exact folder) |
| `D:/Projects/loja/src/api` | `loja` (inside it) |
| `D:/Projects/loja/admin/src` | `loja-admin`, when it is registered too: the most specific folder wins |
| `d:\projects\LOJA\` | `loja`: case, separators and a trailing separator do not matter |
| `D:/Projects/lojas` | none: starting with the same letters is not being inside |
| `D:/Downloads` | none: only global memory |
