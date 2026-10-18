import { describe, expect, it } from "vitest"

import { invalidatedBlock, type LoadedNote, loadedNoteBlock, replacementBlock } from "#src/domain"

const alpha: LoadedNote = { vault: "global", path: "tools/Alpha.md", type: "rule", body: "alpha body" }

describe("loadedNoteBlock", () => {
  it("renders vault, path and type in a heading, then the body, like the Don't forget block", () => {
    expect(loadedNoteBlock(alpha)).toBe("### global · tools/Alpha.md · rule\nalpha body")
  })

  it("tells apart the same path in the two vaults", () => {
    expect(loadedNoteBlock({ ...alpha, vault: "project" })).toBe("### project · tools/Alpha.md · rule\nalpha body")
  })
})

describe("replacementBlock", () => {
  it("marks the current copy as replacing the earlier copy of the previous vault and path", () => {
    const current: LoadedNote = { ...alpha, body: "new body" }
    expect(replacementBlock(alpha, current)).toBe(
      `This replaces the earlier copy of "global · tools/Alpha.md" loaded above; use this version and ignore the earlier one.\n\n${loadedNoteBlock(current)}`,
    )
  })

  it("names the previous vault and path when the note moved", () => {
    const moved: LoadedNote = { ...alpha, path: "other/Alpha.md" }
    const block = replacementBlock(alpha, moved)
    expect(block).toContain('earlier copy of "global · tools/Alpha.md"')
    expect(block).toContain("### global · other/Alpha.md · rule")
  })
})

describe("invalidatedBlock", () => {
  it("for a note that is gone names the vault and path, says it was archived or deleted and does not repeat the body", () => {
    const block = invalidatedBlock(alpha, { kind: "gone" })
    expect(block).toBe(
      'The earlier copy of "global · tools/Alpha.md" loaded above is no longer valid: the note was archived or deleted. Do not rely on it.',
    )
    expect(block).not.toContain(alpha.body)
  })

  it("for a note that is still there says it cannot be used and names the problem", () => {
    const block = invalidatedBlock(alpha, { kind: "unusable", problem: "tools/Alpha.md has no body" })
    expect(block).toBe(
      'The earlier copy of "global · tools/Alpha.md" loaded above is no longer valid: the note is still there but cannot be used (tools/Alpha.md has no body). Do not rely on it.',
    )
    expect(block).not.toContain(alpha.body)
  })

  it("for a note that cannot be read names the problem without saying the note exists", () => {
    const block = invalidatedBlock(alpha, { kind: "unreadable", problem: "extra: not a known field" })
    expect(block).toBe(
      'The earlier copy of "global · tools/Alpha.md" loaded above is no longer valid: the note cannot be read (extra: not a known field). Do not rely on it.',
    )
    expect(block).not.toContain(alpha.body)
  })
})
