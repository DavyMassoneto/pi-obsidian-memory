---
name: obsidian-memory
description: How to use the Obsidian long-term memory (global and project vaults) - where notes go, note types, what is not memory, and the memory tools. Load before searching or reading memory, before saving something the user asked to remember, or when a memory block appears in the context.
---

# Obsidian memory

Long-term memory lives in Obsidian vaults. Notes are in English, whatever language the user speaks.

## Two layers

- Global vault: about the user (how to address them, preferences, patterns, global lessons).
- Project vault: everything else about the current project.
- Classify each memory. When unsure which vault, ask the user.
- A folder with no registered project has the global vault only.

## Layout and placement

- One folder per subject. Each folder holds short notes, one point per note. Subjects nest with no depth limit.
- Place a note from general to specific: `typescript/testing/`, not `testing/typescript/`.
- Reuse before creating: walk the existing tree (read folder indexes level by level) and use the path that already covers the subject.
- When two paths fit, ask the user.
- Every folder has an `index.md` listing its subfolders and its notes (type and don't forget mark). The system keeps it up to date; never write it by hand.
- Not subjects: hidden folders, and at the vault root `archive/` and `_templates/`.
- `index` (any case) is reserved: no note can use it as its statement.

## Notes

- The file name is the statement: reading the name tells exactly what the note says. The body holds the detail.
- Keep notes short, one point each. A new point in the same subject is a new note in that folder.
- Name: at most 100 characters by default. It must be a valid Windows file name and must not contain `< > : " / \ | ? * [ ] # ^`, control characters, a leading or trailing space, or a trailing dot. No Windows reserved names (`CON`, `NUL`, `COM1`...).
- Body: never empty, at most 1,000 characters by default. Record the detail even when the name says it all.
- An invalid note is refused with every reason. Rewrite it or split it into smaller notes.
- A note can be marked Don't forget: it is loaded in full at session start.

## Types

Pick exactly one. The list is closed. When unsure which type fits, ask the user.

- `rule`: how to do things; a user preference or a project convention.
- `procedure`: steps to do something in this project.
- `constraint`: a limit imposed from outside (platform, deadline, client).
- `fact`: how things are, about the user or the project.
- `issue`: a known problem that is still open, with its workaround.
- `question`: something still undecided or unknown.
- `decision`: a choice that was made, with its why.
- `lesson`: something learned from a mistake or a bug.
- `goal`: a committed objective for the future.
- `risk`: a problem that may happen.
- `idea`: a possibility not committed to yet.
- `reference`: where to find something external.

## Not memory

- Tasks and TODOs.
- Session logs.
- Anything the code or git history already records.

Secrets (keys, passwords, tokens) are memory: the vault is the user's own safe. Save them like any other note, with no masking. When unsure whether something is memory at all, ask the user.

## Reading

The memory block at session start is only part of the memory. Search and read more when you need it.

- `memory_search`: text search over one or both vaults. Each result gives the vault, the path, the type, the Don't forget mark and whether the note needs fixing. Archived notes and notes with invalid frontmatter are not searched.
- `memory_get`: takes a vault and a path.
  - A note path returns the note in full, with every problem if it breaks any rule.
  - A folder path returns its index. `""` is the vault root.
  - Paths under `archive/` can be read.
- To place a note, read the root index and walk down the folder indexes with `memory_get`.

## Saving

- Use `memory_add` only when the user explicitly asks you to remember something. Never save on your own initiative, and never nudge the user to save.
- Choose the vault, the folder and the type as described above. Ask when unsure.
- A name already taken (in any case) is refused with the existing note. If it is the same point, leave the existing note unchanged; otherwise choose a statement that says what is new.
- Do not save skills or instructions to a vault. Vaults hold only memory.

## Vault access

- Never read or write vault files with file tools (`read`, `write`, `edit`, `grep`, `find`, `ls`) or with the shell, however the path is reached.
- Use only the memory tools. Files outside the vaults are unaffected.
- The user edits the vault freely in Obsidian; a note can change between sessions.

## Setup

- With no global vault registered there is no memory: tell the user to run `/memory-setup`.
- A folder not registered as a project has global memory only: the user can run `/memory-init` to register it.
