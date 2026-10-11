# Vault format

How memory is organized inside a vault (global or project). Decided with the user on 2026-10-04.

The format and resource operations below exist today. Automated synchronization, templates in the vault,
Don't forget injection, and commands such as `/memory-doctor` are target behaviour, not registered features.
Only `memory_add` is currently a pi tool; see [ROADMAP.md](ROADMAP.md).

## Layout

- One folder per subject. Each folder holds short notes, one point per note.
- Subjects nest with no depth limit. Where a note goes:
  1. From general to specific: `typescript/testing/`, not `testing/typescript/`, for testing in TypeScript.
  2. Reuse before creating: the LLM walks the existing tree and uses the path that already covers the subject.
  3. When two paths make sense, the LLM asks the user.
- Splitting a folder that grew too much is up to the user, or suggested by `/memory-doctor`.
- Every folder has an `index.md` listing its subfolders and its notes (with type and don't forget mark), so the LLM can
  walk down the tree level by level. `memory_add` and completed lifecycle operations refresh affected indexes;
  manual edits to them are overwritten. The primitive create/update APIs leave refresh to their caller.
  - Links use the full path from the vault root, since every folder has an `index.md` and the same statement can
    exist in two folders.
  - Subjects and notes are sorted alphabetically, ignoring case; empty sections are left out.
  - The root index is titled with the vault name and has an `## Archive` section when `archive/` exists. `archive/`
    has its own indexes, in the same format.
  - Invalid or unreadable notes and problematic folders are listed under `## Needs fixing`, with their problems.
    Names or parent paths that cannot be represented faithfully as wikilinks use literal non-clickable text instead.
    Folder problems are labeled `Folder`.
  - Refresh includes logical and resolved physical folders and their ancestors, up to the root, without rewriting
    the same resolved index destination twice. Lifecycle also refreshes the physical parent of the removed original.
  - Valid dot-prefixed `.md` notes remain ordinary notes and appear in indexes. Actual temporary files are excluded.
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

- Every read and write is checked to stay inside the vault folder, which must exist (it is never created implicitly).
  - Folder and file names are checked first: `/` between folders, no absolute path, drive letter, empty part, `.` or
    `..`, and the same name rules as a statement.
  - A new memory goes in a subject folder: never hidden (`.name`), never `archive/` or `_templates/` at the root
    (archiving goes through the lifecycle). This policy applies to both logical and resolved physical destinations.
  - The vault and every folder component must be directories. Missing, non-directory and unreadable locations
    produce distinct refusals.
  - Links inside the vault (symbolic links, junctions) are followed only when their real path is inside the real
    path of the vault; a link that leads outside or does not resolve (missing target, loop) is refused.
  - Limit: links are checked right before each read or write, not atomically with it. A folder replaced by a link to
    the outside between the check and the use is not caught.
- Creation writes a complete hidden temporary file (`.<name>.md.tmp-<id>`) and publishes it with an exclusive hard
  link. It never replaces an occupied exact destination. Hard-link support is required; there is no silent fallback
  to partial-content creation. Existing-name refusals carry the actual disk statement, including alias names/casing.
- Name checks ignore case. Concurrent case-equivalent publication depends on native filesystem name equivalence:
  ordinary case-insensitive NTFS is tested; case-sensitive directories have no atomic case-folded uniqueness promise.
- Updates and generated index replacement rename a complete temporary file over the validated resolved target,
  preserving permitted internal alias entries. This is not a durability guarantee across power loss.
- Updates and original removals compare the content hash immediately before mutation. A detected edit is a conflict,
  but comparison and rename/removal are separate operations: an edit in that remaining window may be replaced or
  removed. Hash checks are not compare-and-swap transactions, and link checks are not atomic confinement.
- Temporary-file cleanup is attempted after publication. A successful publication remains successful if cleanup
  fails, with maintenance diagnostics; a primary failure stays primary if cleanup also fails. A temporary may remain.
- A successful note write or completed lifecycle movement remains success when only index maintenance fails, with
  warnings retaining the cause. A warning means an index may be stale, not that the note should be saved again.
- Lifecycle preflight reduces refusals but cannot guarantee later steps will succeed. The order is archived copy,
  successor if any, then removal of the checked resolved original. A later failure reports already-published notes
  and an observed original state (`present`, `missing` or `unknown`), not proof of preserved original content.
  Published copies are not deleted in a hash-based rollback because that could delete a concurrent user edit.
  This is not an atomic multi-file operation: failures/crashes can leave partial state, directories and duplicates.
  Archiving through a file alias removes its resolved target, so retained aliases to it become dangling links.

## Changes made outside the system

The user edits the vault in Obsidian, and a sync tool such as OneDrive brings changes from other machines. The vault
is the source of truth; the search index lives outside it, one per machine, and can be rebuilt at any time.

- At session start and before each search, every `.md` in the vault is compared with the index: new files, deleted
  files, moved files (the same `id` at a new path) and changed files (size or date differ, then the content hash is
  compared).
- Only content that really changed is indexed again and gets a new embedding. A date-only change (sync tools do this)
  costs nothing, and a move only updates the path.
- The `index.md` of every folder touched by those changes is regenerated, with the folders above it.
- A new note without valid frontmatter (created blank in Obsidian) stays out of search and is listed under
  `## Needs fixing`. `/memory-doctor` offers to complete it (a new `id`, asking the type) and applies it only after the
  user confirms.
- The same `id` in two files (a copied note, a sync conflict copy) is flagged, and `/memory-doctor` points it out.
- A file that cannot be read right now (cloud-only, still syncing, locked) keeps its previous index entry and is
  retried at the next check.
- A note already loaded in the conversation that changes is added again, marked as replacing the earlier one.

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
  - Reading reports every problem at once: frontmatter (YAML included), name and body together. A note that breaks
    any rule (including a limit lowered later) is still read: its content comes back with the problems, and its folder
    index lists it under `Needs fixing`. Only a file without a closed `---` frontmatter block cannot be read at all.
- The body is kept exactly as written: indentation, blank lines and trailing spaces included. Writing puts one blank
  line after the closing `---` and appends one newline after the body (a body that already ends with newlines keeps
  them all). Reading removes only that blank line and that appended newline. Line endings are read as LF.

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

The frontmatter holds only the fields above, each once, each a single text value in its own format (`dontForget` is
the literal `true`, or left out). Any YAML presentation works: block or flow style, quoted names, comments, values
folded over several lines. Numbers, `false`, lists, sets of fields, empty values, aliases (`*name`), tags
(`!!timestamp`, `!custom`), unknown and repeated fields are problems that name the field; the note is still read and
listed under `Needs fixing`.

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

Tasks and TODOs, session logs, and anything the code or git history already records.

Secrets (keys, passwords, tokens) are memory: the vault is the user's own safe, so they are saved like any other note,
with no masking or blocking.
