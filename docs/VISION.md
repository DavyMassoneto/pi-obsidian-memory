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
   does it, and reuse only what is needed.
7. **Language.** Notes are stored in English. The user can talk in any language. Missing: proof that automatic
   capture writes English notes (judgement tested with a real model).
11. **Secrets.** The vault is the user's own vault: secrets are saved like any other memory,
    with no masking or blocking. Missing: proof that automatic capture saves a stated secret as written.
12. **Vault access only through the memory system.** The LLM never reads or writes vault files directly: the extension
    blocks pi's file tools on vault paths, and the LLM uses the memory tools, which bring search with embeddings.
    The user edits the vault freely in Obsidian. Missing: a Jev guard that refuses shell commands which create or
    change a file's contents, or create a hardlink. Accepted by the user (2026-10-17): reading a vault through a path
    the shell builds indirectly, tools of other extensions, and foreground subagents (they load no extensions).
14. **Platform.** pi only for now. Windows, macOS and Linux.

## Not in scope

- A session transcript or "in progress" note in the vault.
- Saving skills to the vaults.
- Hosts other than pi (for now).
- Searching past pi sessions (for now).
