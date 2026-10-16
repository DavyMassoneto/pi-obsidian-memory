import { describe, expect, test } from "vitest"

import { diagnoseVault, renderNote } from "#src/domain"
import { aLimits, aNote, catalogEntryAt, inspectedAt } from "#test-helpers"

const limits = { ...aLimits(), maxNotesPerFolder: 2 }
const validText = renderNote(aNote())
const otherId = "01JABCDE7XKQ2M9V3RTN8WPZ60"
const otherText = renderNote({ ...aNote(), frontmatter: { ...aNote().frontmatter, id: otherId } })
const nothing = { invalid: [], blank: [], duplicateIds: [], temporaries: [], crowdedFolders: [] }

describe("diagnoseVault", () => {
  test("reports nothing for a healthy vault", () => {
    const entries = [catalogEntryAt("tools/A.md", "note", false), catalogEntryAt("tools/B.md", "note", false)]
    const files = [inspectedAt("tools/A.md", validText, false), inspectedAt("tools/B.md", otherText, false)]

    expect(diagnoseVault({ entries, inspected: files, limits })).toEqual(nothing)
  })

  test("reports a note with a frontmatter problem and its problems, not as blank", () => {
    const files = [inspectedAt("tools/A.md", "---\nid: bad\n---\nBody.", false)]
    const result = diagnoseVault({ entries: [], inspected: files, limits })

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
    const result = diagnoseVault({ entries: [], inspected: [inspectedAt("tools/A.md", text, false)], limits })

    expect(result.invalid).toEqual([{ path: "tools/A.md", problems: [expect.stringMatching(/^body: /)] }])
  })

  test.each([
    ["an empty file", ""],
    ["whitespace", "  \n"],
    ["text without frontmatter", "just text"],
    ["a frontmatter that is never closed", "---\nid: x\nbody"],
  ])("reports %s as blank, not as invalid", (_name, text) => {
    const result = diagnoseVault({ entries: [], inspected: [inspectedAt("tools/A.md", text, false)], limits })

    expect(result.blank).toEqual(["tools/A.md"])
    expect(result.invalid).toEqual([])
  })

  test("reports notes sharing an id, including an archived copy, sorted by path", () => {
    const files = [
      inspectedAt("tools/B.md", validText, false),
      inspectedAt("archive/tools/A.md", validText, true),
      inspectedAt("tools/C.md", otherText, false),
    ]

    expect(diagnoseVault({ entries: [], inspected: files, limits }).duplicateIds).toEqual([
      { id: aNote().frontmatter.id, paths: ["archive/tools/A.md", "tools/B.md"] },
    ])
  })

  test("does not treat notes without readable frontmatter as duplicates", () => {
    const files = [inspectedAt("a.md", "---\nid: bad", false), inspectedAt("b.md", "---\nid: bad", false)]

    expect(diagnoseVault({ entries: [], inspected: files, limits }).duplicateIds).toEqual([])
  })

  test("lists leftover temporaries by path", () => {
    const entries = [
      catalogEntryAt("tools/B.md.tmp-1", "temporary", false),
      catalogEntryAt("tools/A.md.tmp-2", "temporary", false),
      catalogEntryAt("tools/C.md", "note", false),
    ]

    expect(diagnoseVault({ entries, inspected: [], limits }).temporaries).toEqual([
      "tools/A.md.tmp-2",
      "tools/B.md.tmp-1",
    ])
  })

  test("reports a folder whose direct notes exceed the limit, with its count", () => {
    const entries = ["tools/A.md", "tools/B.md", "tools/C.md", "other/A.md", "other/B.md"].map((path) =>
      catalogEntryAt(path, "note", false),
    )

    expect(diagnoseVault({ entries, inspected: [], limits }).crowdedFolders).toEqual([{ folder: "tools", count: 3 }])
  })

  test("counts only direct notes, not subfolder notes, indexes, templates, attachments or temporaries", () => {
    const entries = [
      catalogEntryAt("tools/A.md", "note", false),
      catalogEntryAt("tools/B.md", "note", false),
      catalogEntryAt("tools/sub/C.md", "note", false),
      catalogEntryAt("tools/sub/D.md", "note", false),
      catalogEntryAt("tools/index.md", "index", false),
      catalogEntryAt("tools/T.md", "template", false),
      catalogEntryAt("tools/pic.png", "other", false),
      catalogEntryAt("tools/X.md.tmp-1", "temporary", false),
    ]

    expect(diagnoseVault({ entries, inspected: [], limits }).crowdedFolders).toEqual([])
  })

  test("leaves archive/ out of the count, whatever its depth", () => {
    const entries = [
      "archive/tools/A.md",
      "archive/tools/B.md",
      "archive/tools/C.md",
      "archive/D.md",
      "archive/E.md",
      "archive/F.md",
    ].map((path) => catalogEntryAt(path, "note", true))

    expect(diagnoseVault({ entries, inspected: [], limits }).crowdedFolders).toEqual([])
  })

  test("accepts exactly the limit and reports root notes as the empty folder", () => {
    const two = ["a.md", "b.md"].map((path) => catalogEntryAt(path, "note", false))
    const three = ["a.md", "b.md", "c.md"].map((path) => catalogEntryAt(path, "note", false))

    expect(diagnoseVault({ entries: two, inspected: [], limits }).crowdedFolders).toEqual([])
    expect(diagnoseVault({ entries: three, inspected: [], limits }).crowdedFolders).toEqual([{ folder: "", count: 3 }])
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
    const result = diagnoseVault({ entries, inspected: files, limits })

    expect(result.blank).toEqual(["t/C.md"])
    expect(result.invalid.map((item) => item.path)).toEqual(["t/E.md"])
    expect(result.duplicateIds).toEqual([{ id: aNote().frontmatter.id, paths: ["t/A.md", "t/B.md"] }])
    expect(result.temporaries).toEqual(["t/D.md.tmp-1"])
    expect(result.crowdedFolders).toEqual([{ folder: "t", count: 3 }])
  })
})
