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

1. **Reuse.** Reuse anything useful from pi-hermes-memory (MIT). Its copyright notice is
   kept only where we copy a substantial portion of its code. The on-disk format is our
   own: Obsidian notes. Before building anything, check whether pi-hermes-memory already
   does it, and reuse only what is needed.
2. **Two layers, dedicated vaults.**
   - **Global vault** (one): about the user — how to address them, preferences, patterns, global lessons.
   - **Project vault** (one per project): everything else about that project.
   - The agent classifies each memory. **When unsure, it asks the user.**
3. **Registration.** All registration lives in one local config file on the machine,
   outside the vaults (e.g. `~/.pi/agent/pi-obsidian-memory/config.json`). Format: [config.md](config.md).
   - **Global:** `/memory-setup` asks where the global vault lives, then creates a new
     dedicated vault or attaches an existing one, and records its path. It can be re-run
     to point to another vault; the old one is left as it was. Until a global vault is registered there is no memory,
     and the extension offers `/memory-setup`.
   - **Project:** `/memory-init` records a manual map (working folder → project → vault).
     An unregistered folder gets global memory only.
4. **Context that grows with the conversation.**
   - At session start, every **"Don't forget"** note is loaded in full, with no limit. The
     memory agent also loads the memories relevant to the project and folder, within a
     configurable character budget (12,000 characters by default).
   - On each user message, a fast decision model (configurable: Jev by API by default, or Laya locally)
     decides whether memory is needed. If it is, a small configurable LLM (the memory agent)
     searches (text + embeddings) and reads notes; the decision model re-ranks the candidates
     so only the relevant ones reach the main LLM.
   - What is found is added at that point of the conversation. What is already in the
     conversation is never rewritten, so the prompt cache holds. A loaded note that changes is
     added again, marked as replacing the earlier one: a stale memory causes mistakes.
   - Every memory block says it is only part of the memory; the main LLM can search and read
     more with the memory tools.
   - Choosing Jev sends user messages and candidate notes to TypeSafe, and `/memory-setup`
     warns about that.
5. **Direct, detailed updates.** No consolidation and no approval step. The agent writes
   and updates memory notes directly, with full detail. New information about an existing
   point updates that note instead of creating a new one. Format: [vault-format.md](vault-format.md).
   Memory is captured, updated, archived and succeeded automatically, by a background process
   that reviews the conversation. The tools that write memory exist only for explicit user
   requests ("remember this"), and nothing in the prompt nudges the LLM to save on its own. The
   tools that read memory (search, get) let the main LLM look further than what was loaded.
   While the extension is active it is the only memory: it sets `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`
   in pi's process, so Claude Code sessions started by pi (pi-claude-bridge) do not use their own
   auto-memory. A Claude Code run outside pi is untouched.
6. **Search.** Text search **and** semantic search in v1. The embedding provider is the
   user's choice: a local model, OpenAI, Google, and so on. Choosing a remote provider sends
   note content (secrets included) to it, and `/memory-setup` warns about that. The search
   index lives outside the vaults (e.g. `~/.pi/agent/pi-obsidian-memory/index/`) and can
   always be rebuilt from the notes.
7. **Language.** Notes are stored in English. The user can talk in any language.
8. **Never delete.** Retired notes move to `archive/`.
9. **Commands.** `/memory-setup` (global), `/memory-init` (project), `/memory-doctor`
   (diagnostics), a `.base` dashboard, and a `.zip` export.
10. **Skills.** The extension ships its own skills that teach the agent how to use the
    memory. Skills are part of the package and are **never saved in the vaults**.
    Vaults hold only memory.
11. **Secrets.** The vault is the user's own vault: secrets are saved like any other memory,
    with no masking or blocking.
12. **Vault access only through the memory system.** The LLM never reads or writes vault files directly: the extension
    blocks pi's file tools on vault paths, and the LLM uses the memory tools, which bring search with embeddings.
    The user edits the vault freely in Obsidian.
13. **Configurable.** Vault locations are configurable; any folder works, OneDrive is optional.
14. **Platform.** pi only for now. Windows first.

## Not in scope

- A session transcript or "in progress" note in the vault.
- Saving skills to the vaults.
- Hosts other than pi (for now).
- Searching past pi sessions (for now).
