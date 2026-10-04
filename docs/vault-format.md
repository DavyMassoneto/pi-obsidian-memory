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
  - Links use the full path from the vault root, since every folder has an `index.md` and the same statement can
    exist in two folders.
  - Subjects and notes are sorted alphabetically, ignoring case; empty sections are left out.
  - The root index is titled with the vault name and has an `## Archive` section when `archive/` exists. `archive/`
    has its own indexes, in the same format.
  - Invalid notes are listed under `## Needs fixing`, with their problems, so they never vanish from the map.
  - Writing a note refreshes the index of its folder and of every folder above it, up to the root.
  - Not subjects: hidden folders (`.obsidian/`), and at the vault root `archive/` and `_templates/`. Below the root,
    folders with those names are ordinary subjects.
  - `index` (any case) is reserved: no note can have it as its statement.

```markdown
# typescript

## Subjects

- [[typescript/testing/index|testing]]

## Notes

- [[typescript/No ternaries|No ternaries]] · rule
- [[typescript/Strict mode always on|Strict mode always on]] · rule · don't forget
```

## Writing

- A new note is refused when a note with the same name already exists in the folder, in any case (Windows does not
  tell `Use pnpm` from `use pnpm`).
- A note is only updated if it did not change on disk since it was read (content hash). If the user edited it in
  Obsidian in the meantime, the update is refused as a conflict and the user's edit stays.
- Every write goes to a hidden temporary file in the same folder (`.<name>.md.tmp-<id>`) and is then renamed over the
  note, so a crash never leaves a half-written note. The temporary file lives for milliseconds and is always removed.
- A note that cannot be written (read-only, locked) is refused with the reason; the note stays as it was.
- Archiving or succeeding a note touches several files, with no journal. Everything is checked before anything is
  written (the note did not change, the names are free, the new notes are valid), so the usual refusals change
  nothing. Then the order is: archived copy, successor, and only last the original is removed. A crash in the middle
  can only leave the same note in two places, never lose one; `/memory-doctor` finds duplicate ids.

## Templates

- The memory system writes every note from templates defined in its code, so notes are always valid.
- A copy of each template lives in the vault, in `_templates/`, for the user to create notes by hand with Obsidian's
  Templates plugin.
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
- Characters are counted as people count them: one per visible character, so an emoji or an accented letter is one.
- Name (the statement): at most 100 characters by default, configurable. It must be a valid file name on Windows and
  must not break Obsidian links: no `< > : " / \ | ? * [ ] # ^`, no control characters, no Windows reserved name
  (`CON`, `NUL`, `COM1`…), no leading or trailing space, no trailing dot.
- Body: never empty, even when the name says it all, so the LLM always records the detail. At most 1,000 characters by
  default, configurable.
- An invalid note is refused with every reason; nothing is fixed silently.
  - Written by the LLM: the write is refused and the LLM rewrites the note or splits it into smaller notes.
  - Edited by the user in Obsidian: accepted; `/memory-doctor` lists the notes with problems.

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
| `replaces` | only in a successor | link to the archived note it replaces (`"[[archive/search/Old]]"`) |
| `replacedBy` | only in a replaced note | link to its successor (`"[[search/New]]"`) |

No `tags` (the folders already group notes), no `source`, no `schemaVersion` until the format first changes.

A field that is not in this table makes the note invalid; `/memory-doctor` lists invalid notes.

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

When a memory moves on in its cycle, the old note goes to `archive/` (same subject path) and a new note is born. The
new note links to the old one with `replaces`, the old one links forward with `replacedBy`, so the history stays and
the LLM sees it without depending on Obsidian's backlinks. The archived note gets `archived: <today>` and keeps
everything else; the new note is born today.

Updating a note in place is different: it is for the same point getting more detail, while it is still true. A
successor is for a point that stopped being true or was resolved, even when the type stays the same (a `fact` replaced
by a newer `fact`).

```text
search/Local or remote embeddings.md   →   archive/search/Local or remote embeddings.md   (question)
                                           search/Chose local embeddings.md               (decision)
```

Any type can become any other type: there is no fixed path. A question may become a decision, an issue or an idea; a
risk may become an issue or a lesson. A note can also go to `archive/` with no successor, when it stops being true.

## Don't forget

- Any note can be marked with `dontForget: true` in its frontmatter. It keeps its subject folder and its type.
- Every marked note is injected in full (name and body) at session start, outside the summary budget, so it never
  depends on the LLM choosing to open it.
- A note in `archive/` is no longer injected.

## Not memory

Tasks and TODOs, session logs, secrets, and anything the code or git history already records.
