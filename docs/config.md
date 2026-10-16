# Config

One local JSON file on the machine, outside the vaults (`~/.pi/agent/pi-obsidian-memory/config.json`). The user can
edit it by hand, or write it with `/memory-setup` and `/memory-init` (below). Strict reading, repair drafts,
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
  "capture": {
    "model": { "provider": "selected-provider", "id": "selected-model" },
    "when": "after-each-turn"
  },
  "memoryAgent": { "model": { "provider": "selected-provider", "id": "selected-model" } },
  "context": { "budgetChars": 12000 },
  "embeddings": { "provider": "local", "model": "Xenova/multilingual-e5-small" },
  "decisionModel": {
    "provider": "laya",
    "endpoint": "http://127.0.0.1:8000/v1/systemone",
    "model": "multilingual",
    "maxTokens": 8192,
    "headMaxTokens": 192
  }
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
| `limits.maxNotesPerFolder` | Positive integer; future doctor reporting threshold | 20 |
| `capture.model` | Exactly `{provider, id}`, both nonblank strings | Explicit selected chat model supplied at setup |
| `capture.when` | `after-each-turn`, `on-compaction`, or `at-session-end` | `after-each-turn` |
| `memoryAgent.model` | Exactly `{provider, id}`, both nonblank strings | Explicit selected chat model supplied at setup |
| `context.budgetChars` | Positive integer; future optional relevant-memory character budget | 12000 |
| `embeddings` | One exact alternative below | Local multilingual E5 |
| `decisionModel` | One exact alternative below | Laya with the values shown above |

The optional relevant-memory budget does not limit Don't forget notes in the target context behavior. These settings
are configuration choices, not proof that capture, retrieval, doctor or any configured model currently runs. A chat
reference is syntactically validated here; model availability is a separate future runtime check.

Embeddings allow only these closed provider/model pairs, with no other fields:

- `{"provider":"local","model":"Xenova/multilingual-e5-small"}`
- `{"provider":"openai","model":"text-embedding-3-small"}`
- `{"provider":"google","model":"gemini-embedding-001"}`

Decision settings allow only:

- Laya: exactly `provider`, `endpoint`, `model`, `maxTokens`, `headMaxTokens`. Provider is `laya`, model is
  `multilingual`. `maxTokens` is an integer from 1 to 8192. `headMaxTokens` is a positive integer strictly less than
  `maxTokens` (default 192). Endpoint validation reuses the decision resource's URL policy: HTTP or HTTPS, parsed
  hostname `127.0.0.1` or `[::1]`, pathname `/v1/systemone`, no credentials, query or fragment. `localhost` is not
  accepted. Port may be chosen explicitly. URL normalization follows the existing resource policy.
- Jev: exactly `{"provider":"typesafe","model":"jev-latest"}`. No endpoint or token-limit fields.

There is no `schemaVersion`, secret/key field, arbitrary provider options bag or persistent consent setting. Credentials
for future remote execution come from pi or the environment, never from this file. No credential lookup occurs when
reading, repairing, proposing or publishing configuration.

## Commands

Both commands work only with a UI: without one they ask nothing and write nothing. Vaults are never copied, moved or deleted.

`/memory-setup` writes the config with every key:

- The chat model for `capture.model` and `memoryAgent.model` defaults to pi's current model. A valid model already in
  the file is never overwritten. When a reference is missing and pi has no current model, the user picks from pi's
  available models; with none available, setup is refused.
- It asks to create a new vault or attach an existing folder, and for the vault path. Create refuses a non-empty
  folder or a file; attach refuses a missing folder or a file. Re-run, it offers the current vault (an empty answer
  keeps it) and attaches it by default.
- An invalid config is repaired: every valid value is kept, and one list names each missing key and each value that
  could not be kept. A file that is not valid JSON is replaced only after the user confirms.
- Before writing, the user confirms the disclosures that apply (below): chat models always; Jev when selected; remote
  embeddings when selected. Declining changes nothing.
- Re-run with another path points the config to that vault; the old vault is left as it was. Every note template is
  written to `_templates/` of the vault; templates already there are kept.

`/memory-init` registers the working folder as a project:

- With no valid global setup it refuses and offers `/memory-setup`; with an unreadable config file it refuses and names
  the cause, without that offer.
- The name defaults to the folder name and must be unique ignoring case; a taken name is asked again.
- The vault is created, with `_templates/`, when missing. In an already registered folder the name stays and only the
  vault is repointed; the old vault is left as it was.

Both refuse a vault equal to, inside or containing another registered vault, whatever layer. A hand-edited config with
such an overlap, or the same vault twice, is invalid.

At session start (startup, new, resume and fork, not reload; only with a UI): no config shows a notice offering
`/memory-setup`; an invalid config shows every problem at once and nothing from the file is used; a file that cannot
be read shows a warning naming the cause.

## Strict reading and explicit repair

- Every key is always written, defaults included, so every value in effect is visible. Missing, invalid or unknown
  fields at any level invalidate the entire file. Reading returns all actionable problems, not a partial config.
  Diagnostics are collected per field, not truncated to the schema library's error-count limit.
- No file means memory is not configured. An old file containing only registration and the two original limits is
  now invalid. There is no silent runtime migration and no runtime defaulting. Reading never changes file bytes.
- Repair is separate from reading. `inspectConfigForRepair(text)` returns a draft, not permission to use any of its
  values at runtime. It keeps independently valid settings, including individual chat `provider`/`id`, limits,
  schedule, budget and registration fields. Unknown fields are discarded and named. Invalid/missing fields are
  reported even when a setup default can fill them.
- Repair fills known non-chat defaults. A retained embedding provider gets its supported model when that model is
  absent/invalid; a retained `typesafe` decision provider gets `jev-latest` without Laya-only fields. Recognized but
  contradictory provider/model or token-limit choices remain visible and must be corrected, not silently switched.
  Registration conflicts retain every involved entry for correction, rather than choosing a first winner.
- `prepareSetupDefaults(model)` is setup-only. An explicitly supplied valid selected chat model supplies both initial
  chat references; no production provider/id is hardcoded. Passing `null` leaves both unresolved. Repair never
  invents the current chat model. `/memory-setup` supplies pi's current model, asks for a selection or refuses if a
  model is unresolved; it retains valid existing model siblings rather than overwriting them with the selected model.
- Malformed JSON cannot be salvaged and is marked as requiring explicit replacement confirmation. Drafts carry
  problems and replacement metadata; these are not config keys. Setup proposals serialize only the complete settings
  and registrations and refuse unresolved values. Publication validates again and checks the expected snapshot hash.
- Setup proposals change only the global vault registration. Init proposals add a project or repoint the most
  specific matching project, retaining its original working-folder mapping. Both preserve all settings. Repointing
  does not copy, move or delete the old vault. Registration usecases create missing target assets without replacing
  existing templates or dashboard edits. Setup requires disclosure confirmation, which `/memory-setup` collects.
  Preparation creates nothing. Failed bootstrap or publication retains created assets and reports progress,
  not rollback. A session lease serializes local registration; external hash/path check-use windows remain. Cancellation
  stops before the next resource write, not one already started; successful config publication remains success.
- Vault paths must not be equal or nested across registrations; the global and project layers must not mix. Resource
  validation also checks physical aliases and keeps configuration/index infrastructure outside vaults.
- A vault is named after its folder (`.../Global memory` is "Global memory").

## Disclosure

`/memory-setup` shows one confirmation before writing, with a line for each that applies: capture and the memory agent
send conversation and note content to the chosen chat model (always); TypeSafe receives user messages and candidate
notes when Jev is selected; remote embeddings providers receive note content, **secrets included**, and queries.
Declining cancels the change. A hand-edited remote configuration is explicit selection and is never replaced by a
local provider. Before the first semantic use in a runtime, pi asks once to confirm sending note content and queries
to the remote embeddings provider. The local model (~135 MB) is downloaded only after a confirmation, once per
runtime, into `pi-obsidian-memory/models` beside `config.json`; consent is never a side effect of creating defaults.
With no UI or a declined confirmation, search uses words only (with a status line), never another provider. API keys
come from pi's model registry; `/memory-doctor` checks embeddings without network. Jev's startup disclosure is
planned with milestone 6. An unavailable Laya service must be diagnosed rather than silently replaced or installed.

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
