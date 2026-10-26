import { describe, expect, it } from "vitest"

import { renderMemoryMap } from "#src/domain"
import { globalMemoryVault, lojaVault, mapNote, mapVault } from "#test-helpers"

const header = [
  "## Memory map",
  "Your long-term memory is kept as notes in Obsidian vaults, one point per note; a note's file name is what it says. When a note looks relevant, read it with memory_get, passing the vault named in its heading (project or global) and its path. memory_search finds notes by words or meaning, including notes not listed here.",
].join("\n")

describe("renderMemoryMap", () => {
  it("the map lists the project vault first, notes sorted by path ignoring case, with type and the don't forget mark", () => {
    expect(renderMemoryMap([globalMemoryVault(), lojaVault()], 2000)).toBe(
      [
        header,
        [
          "### project vault (loja)",
          "- `csv/CSV files use a semicolon separator.md` · rule",
          "- `deploy/Deploy only with release.sh.md` · rule",
          "- `pnpm/Use pnpm, never npm.md` · rule · don't forget",
          "- `search/Chose SQLite FTS5 over a vector DB.md` · decision",
        ].join("\n"),
        [
          "### global vault (Global memory)",
          "- `profile/User talks in Brazilian Portuguese.md` · fact · don't forget",
          "- `windows/git is not on PATH in PowerShell.md` · lesson",
        ].join("\n"),
      ].join("\n\n"),
    )
  })

  it("upper case letters do not sort before lower case ones", () => {
    const vault = mapVault(
      "project",
      "loja",
      [mapNote("b/x.md", "fact", false), mapNote("A/y.md", "fact", false), mapNote("c/z.md", "fact", false)],
      [],
    )

    expect(renderMemoryMap([vault], 2000)).toBe(
      [
        header,
        ["### project vault (loja)", "- `A/y.md` · fact", "- `b/x.md` · fact", "- `c/z.md` · fact"].join("\n"),
      ].join("\n\n"),
    )
  })

  it("notes past the budget are cut and counted in a final line", () => {
    expect(renderMemoryMap([lojaVault(), globalMemoryVault()], 104)).toBe(
      [
        header,
        [
          "### project vault (loja)",
          "- `csv/CSV files use a semicolon separator.md` · rule",
          "5 more notes are not listed; memory_search finds them.",
        ].join("\n"),
      ].join("\n\n"),
    )
  })

  it("a vault heading that still fits is written even when its notes are cut", () => {
    expect(renderMemoryMap([lojaVault(), globalMemoryVault()], 112)).toBe(
      [
        header,
        ["### project vault (loja)", "- `csv/CSV files use a semicolon separator.md` · rule"].join("\n"),
        ["### global vault (Global memory)", "5 more notes are not listed; memory_search finds them."].join("\n"),
      ].join("\n\n"),
    )
  })

  it("a vault that could not be read shows its problem", () => {
    const unreadable = mapVault("global", "Global memory", [], ["Vault folder is missing", "Index is locked"])

    expect(renderMemoryMap([lojaVault(), unreadable], 2000)).toContain(
      [
        "### global vault (Global memory)",
        "Could not read the global vault: Vault folder is missing; Index is locked.",
      ].join("\n"),
    )
  })

  it("with no notes the map says so", () => {
    const empty = [mapVault("project", "loja", [], []), mapVault("global", "Global memory", [], [])]

    expect(renderMemoryMap(empty, 2000)).toBe([header, "The vaults hold no notes yet."].join("\n\n"))
    expect(renderMemoryMap([], 2000)).toBe([header, "The vaults hold no notes yet."].join("\n\n"))
  })
})
