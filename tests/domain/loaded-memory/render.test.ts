import { describe, expect, it } from "vitest"

import { invalidatedBlock, type LoadedNote, loadedNoteBlock, replacementBlock } from "#src/domain"

const alpha: LoadedNote = { path: "tools/Alpha.md", statement: "Alpha", body: "alpha body" }

describe("loadedNoteBlock", () => {
  it("renders path, statement and body", () => {
    expect(loadedNoteBlock(alpha)).toBe("Note: tools/Alpha.md\nStatement: Alpha\n\nalpha body")
  })
})

describe("replacementBlock", () => {
  it("marks the current copy as replacing the earlier copy of the previous path", () => {
    const current: LoadedNote = { path: "tools/Alpha.md", statement: "Alpha", body: "new body" }
    expect(replacementBlock(alpha, current)).toBe(
      `This replaces the earlier copy of "tools/Alpha.md" loaded above; use this version and ignore the earlier one.\n\n${loadedNoteBlock(current)}`,
    )
  })

  it("names the previous path when the note moved", () => {
    const moved: LoadedNote = { path: "other/Alpha.md", statement: "Alpha", body: "alpha body" }
    const block = replacementBlock(alpha, moved)
    expect(block).toContain('earlier copy of "tools/Alpha.md"')
    expect(block).toContain("Note: other/Alpha.md")
  })
})

describe("invalidatedBlock", () => {
  it("tells the model the earlier copy is no longer valid and does not repeat the body", () => {
    const block = invalidatedBlock(alpha)
    expect(block).toBe(
      'The earlier copy of "tools/Alpha.md" loaded above is no longer valid: the note was archived or deleted. Do not rely on it.',
    )
    expect(block).not.toContain(alpha.body)
  })
})
