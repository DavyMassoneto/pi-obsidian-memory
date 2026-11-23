import { describe, expect, test } from "vitest"

import { diagnoseVault, renderNote } from "#src/domain"
import { aLimits, aNote, catalogEntryAt, inspectedAt } from "#test-helpers"

const limits = aLimits()
const validText = renderNote(aNote())
const otherId = "01JABCDE7XKQ2M9V3RTN8WPZ60"
const otherText = renderNote({ ...aNote(), frontmatter: { ...aNote().frontmatter, id: otherId } })
const nothing = { invalid: [], blank: [], duplicateIds: [], temporaries: [] }

describe("diagnoseVault", () => {
  test("reports nothing for a healthy vault", () => {
    const entries = [catalogEntryAt("tools/A.md", "note", false), catalogEntryAt("tools/B.md", "note", false)]
    const files = [inspectedAt("tools/A.md", validText, false), inspectedAt("tools/B.md", otherText, false)]

    expect(diagnoseVault({ entries, inspected: files })).toEqual(nothing)
  })

  test("does not report a folder for containing many notes", () => {
    const entries = Array.from({ length: 21 }, (_, index) => catalogEntryAt(`tools/Note ${index}.md`, "note", false))

    expect(diagnoseVault({ entries, inspected: [] })).toEqual(nothing)
  })

  test("reports a note with a frontmatter problem and its problems, not as blank", () => {
    const files = [inspectedAt("tools/A.md", "---\nid: bad\n---\nBody.", false)]
    const result = diagnoseVault({ entries: [], inspected: files })

    expect(result.blank).toEqual([])
    expect(result.invalid).toEqual([
      {
        path: "tools/A.md",
        problems: ["id: must be a ULID", "type: is missing", "created: is missing", "updated: is missing"],
      },
    ])
  })

  test("reports body problems of a note with valid frontmatter", () => {
    const text = renderNote({ ...aNote(), body: "x".repeat(limits.maxBodyChars + 1) })
    const result = diagnoseVault({ entries: [], inspected: [inspectedAt("tools/A.md", text, false)] })

    expect(result.invalid).toEqual([{ path: "tools/A.md", problems: [expect.stringMatching(/^body: /)] }])
  })

  test.each([
    ["an empty file", ""],
    ["whitespace", "  \n"],
    ["text without frontmatter", "just text"],
    ["a frontmatter that is never closed", "---\nid: x\nbody"],
  ])("reports %s as blank, not as invalid", (_name, text) => {
    const result = diagnoseVault({ entries: [], inspected: [inspectedAt("tools/A.md", text, false)] })

    expect(result.blank).toEqual(["tools/A.md"])
    expect(result.invalid).toEqual([])
  })

  test("reports notes sharing an id, including an archived copy, sorted by path", () => {
    const files = [
      inspectedAt("tools/B.md", validText, false),
      inspectedAt("archive/tools/A.md", validText, true),
      inspectedAt("tools/C.md", otherText, false),
    ]

    expect(diagnoseVault({ entries: [], inspected: files }).duplicateIds).toEqual([
      { id: aNote().frontmatter.id, paths: ["archive/tools/A.md", "tools/B.md"] },
    ])
  })

  test("does not treat notes without readable frontmatter as duplicates", () => {
    const files = [inspectedAt("a.md", "---\nid: bad", false), inspectedAt("b.md", "---\nid: bad", false)]

    expect(diagnoseVault({ entries: [], inspected: files }).duplicateIds).toEqual([])
  })

  test("lists leftover temporaries by path", () => {
    const entries = [
      catalogEntryAt("tools/B.md.tmp-1", "temporary", false),
      catalogEntryAt("tools/A.md.tmp-2", "temporary", false),
      catalogEntryAt("tools/C.md", "note", false),
    ]

    expect(diagnoseVault({ entries, inspected: [] }).temporaries).toEqual(["tools/A.md.tmp-2", "tools/B.md.tmp-1"])
  })

  test("reports every problem of one vault in one diagnosis", () => {
    const entries = [
      catalogEntryAt("t/A.md", "note", false),
      catalogEntryAt("t/B.md", "note", false),
      catalogEntryAt("t/C.md", "note", false),
      catalogEntryAt("t/D.md.tmp-1", "temporary", false),
    ]
    const files = [
      inspectedAt("t/A.md", validText, false),
      inspectedAt("t/B.md", validText, false),
      inspectedAt("t/C.md", "", false),
      inspectedAt("t/E.md", "---\nid: bad\n---\nBody.", false),
    ]
    const result = diagnoseVault({ entries, inspected: files })

    expect(result.blank).toEqual(["t/C.md"])
    expect(result.invalid.map((item) => item.path)).toEqual(["t/E.md"])
    expect(result.duplicateIds).toEqual([{ id: aNote().frontmatter.id, paths: ["t/A.md", "t/B.md"] }])
    expect(result.temporaries).toEqual(["t/D.md.tmp-1"])
  })
})
