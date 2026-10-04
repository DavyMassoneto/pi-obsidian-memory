import { expect, test } from "vitest"

import { renderFolderIndex } from "#/domain/folder-index"
import type { Note, NoteType } from "#/domain/note"
import { aNote } from "#test-helpers"

function noteAbout(statement: string, type: NoteType): Note {
  const note = aNote()
  return { ...note, statement, frontmatter: { ...note.frontmatter, type } }
}

function markedNote(statement: string): Note {
  const note = noteAbout(statement, "rule")
  return { ...note, frontmatter: { ...note.frontmatter, dontForget: true } }
}

test("lists the subjects and notes of a folder", () => {
  const index = renderFolderIndex({
    kind: "subject",
    path: "typescript",
    subjects: ["testing"],
    notes: [noteAbout("No ternaries", "rule"), markedNote("Strict mode always on")],
  })

  expect(index).toBe(
    [
      "# typescript",
      "",
      "## Subjects",
      "",
      "- [[typescript/testing/index|testing]]",
      "",
      "## Notes",
      "",
      "- [[typescript/No ternaries|No ternaries]] · rule",
      "- [[typescript/Strict mode always on|Strict mode always on]] · rule · don't forget",
      "",
    ].join("\n"),
  )
})

test("links a nested folder with its full path", () => {
  const index = renderFolderIndex({
    kind: "subject",
    path: "typescript/testing",
    subjects: ["mocks"],
    notes: [noteAbout("Mock only pi, the LLM and the clock", "rule")],
  })

  expect(index).toContain("# typescript/testing\n")
  expect(index).toContain("- [[typescript/testing/mocks/index|mocks]]\n")
  expect(index).toContain(
    "- [[typescript/testing/Mock only pi, the LLM and the clock|Mock only pi, the LLM and the clock]]",
  )
})

test("sorts subjects and notes alphabetically, ignoring case, whatever the input order", () => {
  const index = renderFolderIndex({
    kind: "subject",
    path: "tools",
    subjects: ["vitest", "Zod", "Biome", "git"],
    notes: [
      noteAbout("Zip exports", "fact"),
      noteAbout("biome checks imports", "rule"),
      noteAbout("Git flow", "procedure"),
    ],
  })

  const subjects = ["[[tools/Biome/index", "[[tools/git/index", "[[tools/vitest/index", "[[tools/Zod/index"]
  const notes = ["[[tools/biome checks imports|", "[[tools/Git flow|", "[[tools/Zip exports|"]
  const positions = [...subjects, ...notes].map((link) => index.indexOf(link))

  expect(positions.every((position) => position >= 0)).toBe(true)
  expect(positions).toEqual([...positions].sort((first, second) => first - second))
})

test("omits empty sections", () => {
  const onlyNotes = renderFolderIndex({ kind: "subject", path: "pnpm", subjects: [], notes: [aNote()] })
  const onlySubjects = renderFolderIndex({ kind: "subject", path: "languages", subjects: ["go"], notes: [] })

  expect(onlyNotes).not.toContain("## Subjects")
  expect(onlySubjects).not.toContain("## Notes")
})

test("titles the root index with the vault name and links from the vault root", () => {
  const index = renderFolderIndex({
    kind: "root",
    vaultName: "Global memory",
    subjects: ["pnpm"],
    notes: [noteAbout("User talks in Brazilian Portuguese", "fact")],
    hasArchive: false,
  })

  expect(index).toBe(
    [
      "# Global memory",
      "",
      "## Subjects",
      "",
      "- [[pnpm/index|pnpm]]",
      "",
      "## Notes",
      "",
      "- [[User talks in Brazilian Portuguese|User talks in Brazilian Portuguese]] · fact",
      "",
    ].join("\n"),
  )
})

test("adds an Archive section to the root index only when the vault has an archive", () => {
  const root = { kind: "root" as const, vaultName: "Global memory", subjects: ["pnpm"], notes: [] }

  expect(renderFolderIndex({ ...root, hasArchive: true })).toMatch(/## Archive\n\n- \[\[archive\/index\|archive\]\]\n$/)
  expect(renderFolderIndex({ ...root, hasArchive: false })).not.toContain("## Archive")
})
