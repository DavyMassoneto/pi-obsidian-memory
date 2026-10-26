# Vision — pi-obsidian-memory (v2)

A **pi** extension that gives the agent long-term memory, like
[pi-hermes-memory](https://github.com/chandra447/pi-hermes-memory), but stored as
**Obsidian-native notes** that the user can open and edit.

Restarted from scratch on 2026-10-03. Every decision below was made directly by the user.
The old project (`D:\Projects\pi-obsidian-memory`) is reference only.

## Problem

Coding agents forget everything between sessions. The user wants durable memory that
changes the agent's future behavior, that they can read and edit in Obsidian, and that
lives in any folder they choose.

## Decisions

Only what is still pending is listed. Numbers are kept so references stay valid; the implemented decisions are in git
history.

1. **Reuse.** Reuse anything useful from pi-hermes-memory (MIT). Its copyright notice is
   kept only where we copy a substantial portion of its code. The on-disk format is our
   own: Obsidian notes. Before building anything, check whether pi-hermes-memory already
   does it, and reuse only what is needed. The same rule holds for pi-observational-memory (OM; MIT, Amos
   Blomqvist): its copyright notice is kept where we copy a substantial portion of its code.
7. **Language.** Notes are stored in English. The user can talk in any language. Missing: proof that the consolidator
   writes English notes (judgement tested with a real model).
11. **Secrets.** The vault is the user's own vault: secrets are saved like any other memory,
    with no masking or blocking. Missing: proof that the consolidator saves a stated secret as written.
12. **Vault access only through the memory system.** The LLM never reads or writes vault files directly: the extension
    blocks pi's file tools on vault paths, and the LLM uses the memory tools, which bring search with embeddings.
    The user edits the vault freely in Obsidian. Missing: a Jev guard that refuses shell commands which create or
    change a file's contents, or create a hardlink. Accepted by the user (2026-10-17): reading a vault through a path
    the shell builds indirectly, tools of other extensions, and foreground subagents (they load no extensions).
14. **Platform.** pi only for now. Windows, macOS and Linux.
15. **OM cycle.** The package observes, compacts and consolidates like OM, with the same kinds of settings (observed
    chunk size, accumulation target and limit, compaction limit, verbatim tail, journey size, parallelism, observer and
    consolidator models). The durable memory is saved as vault notes, in the vault format. The journey and the detail of
    the session stay only in the pi session: the vault gets only durable memory. A converter shows the vault notes in
    the form of OM's memory map and tells the agent to look in the memory (`memory_search` and `memory_get`) for more
    detail. Memory is written directly, with full detail and no approval step. It comes in two phases, each released
    and usable:
    - Phase 1: the conversation is observed and compacted like OM, with the memory map. The current capture (a review
      every 10 turns or 15 calls) is removed in this phase. Until phase 2, the vault gets only what the user asks to
      remember. The notes per message (Jev), the Don't forget notes, the tools, the commands and the guards stay.
    - Phase 2: the consolidator turns the older observations into vault notes. A command imports what OM saved in
      `.memory/`: the topics and `JOURNEY.md` go through the consolidator's rules, and only durable memory becomes a
      note. A folder with no project vault asks for `/memory-init` first. The import only reads: it does not delete or
      move the `.memory/` files.

    OM is uninstalled after that. `/memory-doctor` and the README tell the user to uninstall it, because two owners of
    compaction fight. Missing: proof that the consolidator turns observations into typed, one-point notes, in English,
    outside the Not memory list (judgement tested with a real model).

## Not in scope

- A session transcript or "in progress" note in the vault.
- Saving skills to the vaults.
- Hosts other than pi (for now).
- Searching past pi sessions (for now).
