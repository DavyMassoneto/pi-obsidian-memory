# 04 — Agent memory in Obsidian + OneDrive: prior art and pitfalls

> Summary of [appendix D](appendices/D-obsidian-memory.md) (research from 2026-09-23), which lists sources, versions, and what was left unverified.
> The code here is **illustrative and untested**. It's meant to show the shape of the solutions.

## TL;DR

1. **Nothing ready-made exists** for "Obsidian + OneDrive + Windows + pi + unlimited". The closest is **basic-memory** (Markdown as the source of truth + SQLite index + MCP). It is **AGPL-3.0** and in Python, so it's useful for copying **ideas**, not code.
2. **FS-first core:** read and write the `.md` files directly with Node `fs`. Works with Obsidian **closed**. The Obsidian CLI (1.12+) stays as an **optional** adapter, because it requires the app to be open and opens it if it's closed.
3. **Unlimited storage, limited injection:** small index + on-demand search + token budget.
4. **OneDrive is the biggest technical risk.** The problems are placeholders (cloud-only files), conflicts, `EPERM` on rename, and SQLite corrupting. Indexes, locks, and models stay **outside** OneDrive, in `%LOCALAPPDATA%`.

## Integration options with Obsidian

| Option | App open? | Pros | Cons | License |
|---|---|---|---|---|
| **Direct FS (Node `fs`)** ⭐ | No | Fast, offline, full control | No ready-made backlinks; external rename **breaks links** | Ours |
| Obsidian CLI (1.12+, GA Feb/2026) | **Yes** (opens the GUI) | `move`/`rename` update links; `backlinks`, `unresolved`, `base:query` | ~1 s/op; exit code always 0 (according to a third-party guide); Windows requires installer ≥ 1.12.7 | Proprietary, free |
| Local REST API 5.x (+ built-in MCP) | Yes | PATCH by heading/block/frontmatter | Third-party plugin, self-signed certificate | MIT |
| cyanheads/obsidian-mcp-server, mcp-obsidian | Yes (via REST API) | Ready-made | One more layer | Apache-2.0 / MIT |
| mcpvault | No | Edits frontmatter while preserving formatting, BM25 | Had a path vulnerability on Windows (fixed) | MIT |
| **kepano/obsidian-skills** ⭐ | — | Teaches the LLM to write valid Obsidian Markdown, Bases, and Canvas | Not a runtime | MIT |
| Smart Connections | Yes | Ready-made semantic search | Writes `.smart-env/` **inside the vault** (syncs); source-available license | Proprietary |

## Memory designs worth copying

| System | Layout | Retrieval | What to take |
|---|---|---|---|
| **Hermes / pi-hermes-memory** | MEMORY.md + USER.md (`§`) | Frozen snapshot or FTS5 search | Security scanner, periodic review, pre-compaction flush, `policy-only` |
| **basic-memory** (ideas) | 1 note per entity; `- [category] fact #tag`; `- relation [[Target]]` | Hybrid FTS5 + vectors (sqlite-vec); `build_context` in a graph | **stable id ≠ file name**, atomic facts, wikilink relations, `expected_checksum` |
| **OpenClaw** | Curated `MEMORY.md` + `memory/YYYY-MM-DD.md` (daily log) | Hybrid 0.7 vector / 0.3 text, 30-day decay, MMR λ 0.7 | **Today + yesterday** at session start; silent flush before compaction (`NO_REPLY`); "dreaming" with human review |
| **Claude Code auto-memory** | `MEMORY.md` = index (1 line per memory) + 1 file per memory with `type` | Injected index (200 lines / 25 KB); the rest is read on demand | Index + topic files; `user / feedback / project / reference` taxonomy |
| **Letta MemFS** | `system/` always loaded; the rest appears as a tree + `description` | Progressive disclosure | `pinned` flag; `description` required; periodic "defrag" |
| **claude-mem** | SQLite | search → timeline → detail | 3-layer search (IDs + snippet first) |
| **mem0 v3** | Vector DB | Semantic + BM25 + entities | **Append-only** writes; conflicts resolved in ranking |
| **@tenchi4u/pi-obsidian-memory** | `$OBSIDIAN_PATH/pi/` (MEMORY, SCRATCHPAD, daily/) | qmd; snapshot with a 16K char budget | Vault path config; Windows notes |

> Fun fact: the memory of this very Claude Code session is already Obsidian-compatible. It's a folder with `MEMORY.md` (index), files with frontmatter, and `[[name]]` links.

## Retrieval pattern for unlimited memory

```text
                ┌─────────────── injected at session start (frozen snapshot, with a budget) ───────────────┐
Prompt ◄────────│ USER.md · MEMORY.md index (1 line/memory) · pinned: true · daily log for today+yesterday │
                └──────────────────────────────────────────────────────────────────────────────────────────┘
  on demand:    memory_search(q) → [id, title, snippet, score]   →   memory_get(id | path, lines)
  ranking:      BM25 (FTS5) [+ optional vector] → recency decay (evergreen doesn't decay) → MMR → minScore
  writes:       append-only day-to-day (daily log PER DEVICE) → consolidation outside the flow → inbox/ for review
```

```ts
// FTS5 index with node:sqlite (Node ≥ 22.13; FTS5 already compiled in; no native build) — illustrative
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(join(process.env.LOCALAPPDATA!, "pi-obsidian-memory", "index", "vault.sqlite"));
db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  heading, body, tokenize = "unicode61 remove_diacritics 2")`);  // "decisao" matches "decisão"
```

For Portuguese:
- use the `unicode61 remove_diacritics 2` tokenizer;
- if there are vectors, use **multilingual** embeddings (multilingual-e5-small or EmbeddingGemma) and avoid `bge-small-en`, which is English-only;
- in JS, tokenize with `\p{L}` (`\W` breaks accented words).

## OneDrive + Obsidian on Windows: pitfalls and mitigations

| # | Pitfall | Mitigation |
|---|---|---|
| 1 | **Files On-Demand** ships on and can't be turned off on newer builds. **Storage Sense** makes files online-only after 30 days without opening, and those are exactly the old memories | During onboarding, **pin** the memory folder with `attrib +P "<folder>" /S /D` (**with your confirmation**) and revalidate on every start. Detect placeholders with `stat.blocks === 0 && size > 0` |
| 2 | Reading a placeholder **downloads** the file; offline, it fails. Windows may show a warning that blocks `node.exe` | Handle the errors; direct the user to allow the app in *Settings → Automatic file downloads* |
| 3 | **Real incident** (claude-code#62140, May/2026): an agent read a truncated placeholder, wrote over it, and **deleted the content in the cloud** | **Shrink guard:** refuse writes that shrink the file too much; always write based on a full read verified by hash |
| 4 | **Conflicts** turn into `Note-PCNAME.md` copies (also in `.obsidian/workspace.json`) | Daily log **per device**; consolidation on a single device; conflict-copy scanner → `archive/conflicts/` |
| 5 | `rename` fails with `EPERM`/`EBUSY` (OneDrive, Defender, indexer) | Temporary `.name.<uuid>.tmp` (OneDrive doesn't sync `.tmp` and Obsidian ignores dotfiles) + `rename` with retry and backoff |
| 6 | **SQLite (WAL) and `.git` corrupt** inside a synced folder | Index, locks, models, and logs in `%LOCALAPPDATA%\<app>\`; the vault holds **only Markdown** |
| 7 | Renaming via the filesystem while Obsidian is open **breaks wikilinks** | Stable `id` in the frontmatter + `aliases`; if you need to rename, use `obsidian move` with the app open |
| 8 | Path limits (400 chars in the cloud) and forbidden characters (`" * : < > ? \| # ^ [ ]`) | ASCII slug up to ~80 chars (accented title goes in `title`/`aliases`); shallow tree |
| 9 | Sync paused (battery saver, metered network) | Re-read before writing; `device` + `modified` in the frontmatter; never assume the other PC has already synced |

```ts
// Safe writes under OneDrive — illustrative (full version in appendix D §6.3)
export async function writeIfUnchanged(file: string, next: string, expectedSha: string | null) {
  const cur = await readOrNull(file);
  if (hash(cur) !== expectedSha) throw new Error("CONFLICT: re-read and merge");   // optimistic concurrency
  if (cur && next.length < cur.length / 2 && !intentionalShrink) throw new Error("SHRINK_GUARD"); // incident #62140
  const tmp = join(dirname(file), `.${basename(file)}.${randomUUID()}.tmp`);
  await fs.writeFile(tmp, next, { flag: "wx" });
  await renameWithRetry(tmp, file);          // EPERM/EBUSY/EACCES → exponential backoff
}
```

## Auto-detection for onboarding

```ts
// Vaults known to Obsidian (internal file, undocumented: READ ONLY) — illustrative
// %APPDATA%\obsidian\obsidian.json → {"vaults":{"<id>":{"path":"C:\\...\\OneDrive\\...","ts":1643208916609,"open":true}}}
const reg = JSON.parse(readFileSync(join(process.env.APPDATA!, "obsidian", "obsidian.json"), "utf8"));
const vaults = Object.entries(reg.vaults ?? {}).map(([id, v]: any) => ({ id, path: v.path, name: basename(v.path) }));
// OneDrive roots: env OneDrive / OneDriveConsumer / OneDriveCommercial (+ HKCU\Software\Microsoft\OneDrive\Accounts\*\UserFolder)
// Compare paths with realpath and case-insensitively (Known Folder Move can put Documents inside OneDrive)
```

**Suggested wizard checklist:**
1. list the vaults and choose one;
2. say whether the folder is inside OneDrive;
3. **pin** the memory folder (with confirmation);
4. sample for placeholders;
5. check whether Obsidian is open and whether the CLI is available;
6. register the device;
7. choose the search level;
8. set the injection budget;
9. test writing and renaming;
10. do the initial indexing;
11. (optional) generate a `.base` dashboard of the memories.

## Draft layout inside the vault (for discussion)

```text
<Vault>/Agent Memory/                    ← configurable root folder (pinned in OneDrive)
  MEMORY.md                              ← curated index: 1 line per memory → injected (with a budget)
  USER.md                                ← profile → injected
  memories/<type>--<slug>.md             ← 1 memory per file, with frontmatter
  projects/<slug>/PROJECT.md             ← per-project context
  daily/2026/2026-09-23.DESKTOP-AB12.md  ← append-only log, PER DEVICE
  inbox/  archive/  archive/conflicts/   ← consolidation proposals; nothing is deleted
%LOCALAPPDATA%\pi-obsidian-memory\       ← machine config, index\*.sqlite, models\, locks\, logs\
```

```yaml
---
id: 01J9Z6X4M8K2Q7N3        # ULID: stable identity, independent of the file name
type: feedback               # user | feedback | project | reference | decision | fact
description: Use pnpm, never npm, in the acme monorepo
tags: [pnpm, tooling]
project: acme-api
created: 2026-09-23T14:02:11-03:00
modified: 2026-09-23T14:02:11-03:00
device: DESKTOP-AB12CD
pinned: false                # true ⇒ always injected
source: session:2026-09-23#abc
---
```
