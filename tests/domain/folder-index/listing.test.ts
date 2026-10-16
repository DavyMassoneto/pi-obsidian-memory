import { describe, expect, it } from "vitest"

import { folderListingFingerprints } from "#src/domain"
import {
  aListedAlias,
  aListedFailure,
  aListedFile,
  aListedFolder,
  aListedIndex,
  aListedNote,
  aListedNoteWith,
  anEnumerationOf,
  fingerprintOf,
  toolsFingerprintWith,
} from "#test-helpers"

describe("folderListingFingerprints", () => {
  it("returns one fingerprint per complete directory, stable for the same input", () => {
    const enumeration = anEnumerationOf([aListedFolder("tools", 5), aListedNote("tools/Use pnpm.md", 10, 100)], {})

    const first = folderListingFingerprints(enumeration, "key")
    const second = folderListingFingerprints(enumeration, "key")

    expect(first.map((item) => item.folder)).toEqual(["", "tools"])
    expect(first).toEqual(second)
    expect(typeof fingerprintOf(first, "tools")).toBe("string")
  })

  it("changes only the folder of a note whose stat changed", () => {
    const before = anEnumerationOf(
      [aListedFolder("tools", 5), aListedNote("tools/Use pnpm.md", 10, 100), aListedNote("Root note.md", 1, 1)],
      {},
    )
    const after = anEnumerationOf(
      [aListedFolder("tools", 5), aListedNote("tools/Use pnpm.md", 11, 100), aListedNote("Root note.md", 1, 1)],
      {},
    )

    const fingerprintsBefore = folderListingFingerprints(before, "key")
    const fingerprintsAfter = folderListingFingerprints(after, "key")

    expect(fingerprintOf(fingerprintsAfter, "tools")).not.toBe(fingerprintOf(fingerprintsBefore, "tools"))
    expect(fingerprintOf(fingerprintsAfter, "")).toBe(fingerprintOf(fingerprintsBefore, ""))
  })

  it("changes when a note's mtime changes, or a note is added or removed", () => {
    const base = fingerprintOf(folderListingFingerprints(anEnumerationOf([aListedNote("A.md", 1, 1)], {}), "key"), "")

    const touched = anEnumerationOf([aListedNote("A.md", 1, 2)], {})
    const added = anEnumerationOf([aListedNote("A.md", 1, 1), aListedNote("B.md", 1, 1)], {})
    const removed = anEnumerationOf([], {})

    expect(fingerprintOf(folderListingFingerprints(touched, "key"), "")).not.toBe(base)
    expect(fingerprintOf(folderListingFingerprints(added, "key"), "")).not.toBe(base)
    expect(fingerprintOf(folderListingFingerprints(removed, "key"), "")).not.toBe(base)
  })

  it("changes the parent but not the grandparent when a subfolder appears", () => {
    const before = anEnumerationOf([aListedFolder("a", 1), aListedFolder("a/b", 1)], {})
    const after = anEnumerationOf([aListedFolder("a", 1), aListedFolder("a/b", 1), aListedFolder("a/b/c", 1)], {})

    const fingerprintsBefore = folderListingFingerprints(before, "key")
    const fingerprintsAfter = folderListingFingerprints(after, "key")

    expect(fingerprintOf(fingerprintsAfter, "a/b")).not.toBe(fingerprintOf(fingerprintsBefore, "a/b"))
    expect(fingerprintOf(fingerprintsAfter, "a")).toBe(fingerprintOf(fingerprintsBefore, "a"))
    expect(fingerprintOf(fingerprintsAfter, "")).toBe(fingerprintOf(fingerprintsBefore, ""))
  })

  it("ignores a subfolder's own stat and the folder's own index.md, whatever its case", () => {
    const before = anEnumerationOf(
      [aListedFolder("tools", 5), aListedIndex("index.md", 10, 10), aListedNote("Root.md", 1, 1)],
      {},
    )
    const after = anEnumerationOf(
      [aListedFolder("tools", 99), aListedIndex("INDEX.md", 20, 20), aListedNote("Root.md", 1, 1)],
      {},
    )

    expect(fingerprintOf(folderListingFingerprints(after, "key"), "")).toBe(
      fingerprintOf(folderListingFingerprints(before, "key"), ""),
    )
  })

  it("never records a folder clean when one of its children failed enumeration", () => {
    const enumeration = anEnumerationOf([aListedFolder("tools", 5), aListedFolder("other", 5)], {
      failures: [aListedFailure("tools/Broken.md")],
    })

    const fingerprints = folderListingFingerprints(enumeration, "key")

    expect(fingerprintOf(fingerprints, "tools")).toBeNull()
    expect(fingerprintOf(fingerprints, "other")).not.toBeNull()
    expect(fingerprintOf(fingerprints, "")).not.toBeNull()
  })

  it("never records a folder clean when the failure is on the folder itself", () => {
    const enumeration = anEnumerationOf([aListedFolder("tools", 5)], { failures: [aListedFailure("tools")] })

    expect(fingerprintOf(folderListingFingerprints(enumeration, "key"), "tools")).toBeNull()
  })

  it("never records the root clean when a root child failed", () => {
    const enumeration = anEnumerationOf([], { failures: [aListedFailure("Broken.md")] })

    expect(fingerprintOf(folderListingFingerprints(enumeration, "key"), "")).toBeNull()
  })

  it("never records a folder clean when its index.md is an alias", () => {
    const enumeration = anEnumerationOf([aListedFolder("tools", 5), aListedNote("elsewhere.md", 1, 1)], {
      aliases: [aListedAlias("tools/index.md", "elsewhere.md")],
    })

    expect(fingerprintOf(folderListingFingerprints(enumeration, "key"), "tools")).toBeNull()
  })

  it("never records a folder clean when an alias target has no stat", () => {
    const enumeration = anEnumerationOf([aListedFolder("tools", 5)], {
      aliases: [aListedAlias("tools/Link.md", "missing/Target.md")],
    })

    expect(fingerprintOf(folderListingFingerprints(enumeration, "key"), "tools")).toBeNull()
  })

  it("follows the target's stat for an alias note", () => {
    const aliases = [aListedAlias("tools/Link.md", "store/Target.md")]
    const before = anEnumerationOf([aListedFolder("tools", 5), aListedNote("store/Target.md", 10, 100)], { aliases })
    const after = anEnumerationOf([aListedFolder("tools", 5), aListedNote("store/Target.md", 10, 101)], { aliases })

    const fingerprintsBefore = folderListingFingerprints(before, "key")
    const fingerprintsAfter = folderListingFingerprints(after, "key")

    expect(fingerprintOf(fingerprintsAfter, "tools")).not.toBe(fingerprintOf(fingerprintsBefore, "tools"))
    expect(fingerprintOf(fingerprintsBefore, "tools")).not.toBeNull()
  })

  it("changes every fingerprint with the render key", () => {
    const enumeration = anEnumerationOf([aListedFolder("tools", 5), aListedNote("tools/Use pnpm.md", 10, 100)], {})

    const first = folderListingFingerprints(enumeration, "key-one")
    const second = folderListingFingerprints(enumeration, "key-two")

    expect(fingerprintOf(second, "")).not.toBe(fingerprintOf(first, ""))
    expect(fingerprintOf(second, "tools")).not.toBe(fingerprintOf(first, "tools"))
  })

  it("does not depend on the order of entries and aliases", () => {
    const aliases = [aListedAlias("Link.md", "A.md"), aListedAlias("Other.md", "B.md")]
    const forward = anEnumerationOf([aListedNote("A.md", 1, 1), aListedNote("B.md", 2, 2)], { aliases })
    const backward = anEnumerationOf([aListedNote("B.md", 2, 2), aListedNote("A.md", 1, 1)], {
      aliases: [...aliases].reverse(),
    })

    expect(fingerprintOf(folderListingFingerprints(backward, "key"), "")).toBe(
      fingerprintOf(folderListingFingerprints(forward, "key"), ""),
    )
  })
})
describe("folderListingFingerprints, what the folder index renders", () => {
  it("changes when a note with an unrepresentable name is added", () => {
    expect(toolsFingerprintWith([aListedNote("tools/[bad].md", 1, 1)])).not.toBe(toolsFingerprintWith([]))
  })

  it("changes when a dot note is added", () => {
    expect(toolsFingerprintWith([aListedNote("tools/.hidden.md", 1, 1)])).not.toBe(toolsFingerprintWith([]))
  })

  it("changes when a subfolder with an unrepresentable name is added", () => {
    expect(toolsFingerprintWith([aListedFolder("tools/c#", 1)])).not.toBe(toolsFingerprintWith([]))
  })

  it.each(["temporary", "dashboard", "other"] as const)("ignores %s files", (kind) => {
    expect(toolsFingerprintWith([aListedFile("tools/Extra.file", kind, 1, 1)])).toBe(toolsFingerprintWith([]))
  })
})

describe("folderListingFingerprints, same-size edits with a preserved mtime", () => {
  it.each(["ctimeMs", "inode", "device"] as const)("changes when a note's %s changes", (field) => {
    const before = anEnumerationOf([aListedNoteWith("A.md", {})], {})
    const after = anEnumerationOf([aListedNoteWith("A.md", { [field]: 2 })], {})

    expect(fingerprintOf(folderListingFingerprints(after, "key"), "")).not.toBe(
      fingerprintOf(folderListingFingerprints(before, "key"), ""),
    )
  })

  it("changes when an alias target's ctime changes", () => {
    const aliases = [aListedAlias("Link.md", "store/A.md")]
    const before = anEnumerationOf([aListedNoteWith("store/A.md", {})], { aliases })
    const after = anEnumerationOf([aListedNoteWith("store/A.md", { ctimeMs: 2 })], { aliases })

    expect(fingerprintOf(folderListingFingerprints(after, "key"), "")).not.toBe(
      fingerprintOf(folderListingFingerprints(before, "key"), ""),
    )
  })
})
