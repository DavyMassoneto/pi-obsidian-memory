# Vault format

How memory is organized inside a vault (global or project). Decided with the user on 2026-10-04.

## Layout

- One folder per subject. Each folder holds short notes, one point per note.
- Subjects nest with no depth limit. Where a note goes:
  1. From general to specific: `typescript/testing/`, not `testing/typescript/`, for testing in TypeScript.
  2. Reuse before creating: the LLM walks the existing tree and uses the path that already covers the subject.
  3. When two paths make sense, the LLM asks the user.
- Splitting a folder that grew too much is up to the user, or suggested by `/memory-doctor`.
- Every folder has an `index.md` listing its subfolders and its notes (with type and don't forget mark), so the LLM can
  walk down the tree level by level. The memory system regenerates it on every write; manual edits to it are
  overwritten.

```markdown
# typescript

## Subjects
- [[typescript/testing/index|testing]]

## Notes
- [[No ternaries]] · rule
- [[Strict mode always on]] · rule · don't forget
```

## Templates

- The memory system writes every note from templates defined in its code, so notes are always valid.
- A copy of each template lives in the vault, for the user to create notes by hand with Obsidian's Templates plugin.
- Retired notes move to `archive/`; nothing is deleted.

```text
vault/
├── pnpm/
│   ├── Use pnpm, never npm.md
│   └── CI installs with frozen lockfile.md
└── typescript/
    └── No ternaries.md
```

## Notes

- Short and direct, so the LLM loads only what it needs.
- The file name is the statement: reading the name tells exactly what the note says.
- New information about the same point updates that note. A new point in the same subject is a new note in that folder.
- The frontmatter `type` says what kind of memory the note is.
- Size limit: the body has at most 1,000 characters by default, configurable by the user.
  - Written by the LLM: over the limit, the write is refused and the LLM splits the point into smaller notes.
  - Edited by the user in Obsidian: accepted; `/memory-doctor` lists the notes over the limit.

## Frontmatter

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

| Field | When | What |
|---|---|---|
| `id` | always | ULID: stable identity that survives renames |
| `type` | always | one of the types below |
| `created` | always | day the memory was born (`YYYY-MM-DD`) |
| `updated` | always | day the memory last changed (`YYYY-MM-DD`); file dates are not trusted, sync tools change them |
| `dontForget` | only when `true` | see Don't forget |
| `archived` | only in `archive/` | day the note was archived (`YYYY-MM-DD`) |

No `tags` (the folders already group notes), no `source`, no `schemaVersion` until the format first changes.

## Types

| Type | What it is | Example |
|---|---|---|
| `rule` | How to do things: a user preference or a project convention | `pnpm/Use pnpm, never npm.md` |
| `procedure` | Steps to do something in this project | `release/How to publish a release.md` |
| `constraint` | A limit imposed from outside (platform, deadline, client) | `platform/Must run on Windows.md` |
| `fact` | How things are, about the user or the project | `profile/User talks in Brazilian Portuguese.md` |
| `issue` | A known problem that is still open, with its workaround | `deps/Lib X drops events on reload.md` |
| `question` | Something still undecided or unknown | `search/Local or remote embeddings.md` |
| `decision` | A choice that was made, with its why | `search/Chose SQLite FTS5 over a vector DB.md` |
| `lesson` | Something learned from a mistake or a bug | `windows/git is not on PATH in PowerShell.md` |
| `goal` | A committed objective for the future | `search/v1 ships semantic search.md` |
| `risk` | A problem that may happen | `sync/OneDrive may corrupt SQLite.md` |
| `idea` | A possibility not committed to yet | `hosts/Support hosts other than pi.md` |
| `reference` | Where to find something external | `pi/pi extension docs are in node_modules.md` |

- The list is closed. A new type is added only with the user's approval.
- When unsure which type fits, or whether something is memory at all, the LLM asks the user.

## Lifecycle

When a memory moves on in its cycle, the old note goes to `archive/` (same subject path) and a new note is born,
linking back to it with a `[[wikilink]]`. The history stays: you can see what it used to be.

```text
search/Local or remote embeddings.md   →   archive/search/Local or remote embeddings.md   (question)
                                           search/Chose local embeddings.md               (decision)
```

| From | To | When |
|---|---|---|
| `question` | `decision` | the question is answered |
| `idea` | `goal` | the idea is committed to |
| `risk` | `issue` | the risk happens |
| `issue` | `lesson` | the issue is solved |
| any | `archive/` only | it stops being true, with no successor |

## Don't forget

- Any note can be marked with `dontForget: true` in its frontmatter. It keeps its subject folder and its type.
- Every marked note is injected in full (name and body) at session start, outside the summary budget, so it never
  depends on the LLM choosing to open it.
- A note in `archive/` is no longer injected.

## Not memory

Tasks and TODOs, session logs, secrets, and anything the code or git history already records.
