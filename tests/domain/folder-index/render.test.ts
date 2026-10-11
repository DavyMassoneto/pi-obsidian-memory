import { expect, test } from "vitest"

import { renderFolderIndex } from "#/domain"
import { aDontForgetNote, aNote, noteAbout } from "#test-helpers"

test("lists the subjects and notes of a folder", () => {
  const index = renderFolderIndex({
    kind: "subject",
    path: "typescript",
    subjects: ["testing"],
    notes: [noteAbout("No ternaries", "rule"), aDontForgetNote("Strict mode always on")],
    invalid: [],
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
    invalid: [],
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
    invalid: [],
  })

  const subjects = ["[[tools/Biome/index", "[[tools/git/index", "[[tools/vitest/index", "[[tools/Zod/index"]
  const notes = ["[[tools/biome checks imports|", "[[tools/Git flow|", "[[tools/Zip exports|"]
  const positions = [...subjects, ...notes].map((link) => index.indexOf(link))

  expect(positions.every((position) => position >= 0)).toBe(true)
  expect(positions).toEqual([...positions].sort((first, second) => first - second))
})

test("omits empty sections", () => {
  const onlyNotes = renderFolderIndex({ kind: "subject", path: "pnpm", subjects: [], notes: [aNote()], invalid: [] })
  const onlySubjects = renderFolderIndex({
    kind: "subject",
    path: "languages",
    subjects: ["go"],
    notes: [],
    invalid: [],
  })

  expect(onlyNotes).not.toContain("## Subjects")
  expect(onlySubjects).not.toContain("## Notes")
})

test("titles the root index with the vault name and links from the vault root", () => {
  const index = renderFolderIndex({
    kind: "root",
    vaultName: "Global memory",
    subjects: ["pnpm"],
    notes: [noteAbout("User talks in Brazilian Portuguese", "fact")],
    invalid: [],
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
  const root = { kind: "root" as const, vaultName: "Global memory", subjects: ["pnpm"], notes: [], invalid: [] }

  expect(renderFolderIndex({ ...root, hasArchive: true })).toMatch(/## Archive\n\n- \[\[archive\/index\|archive\]\]\n$/)
  expect(renderFolderIndex({ ...root, hasArchive: false })).not.toContain("## Archive")
})

test("lists invalid notes in a Needs fixing section, with their problems, before the archive", () => {
  const index = renderFolderIndex({
    kind: "root",
    vaultName: "Global memory",
    subjects: [],
    notes: [],
    invalid: [
      { statement: "Zebra note", problems: ["missing frontmatter"] },
      {
        statement: "Broken rule",
        problems: ["type: must be equal to one of the allowed values", "id: must match pattern"],
      },
    ],
    hasArchive: true,
  })

  expect(index).toContain(
    [
      "## Needs fixing",
      "",
      "- [[Broken rule|Broken rule]] · type: must be equal to one of the allowed values; id: must match pattern",
      "- [[Zebra note|Zebra note]] · missing frontmatter",
      "",
      "## Archive",
    ].join("\n"),
  )
})

test.each(["Bad#name", "Bad^name", "Bad[name", "Bad]name", "Bad|name", "Bad`#name", "Bad``#name", " Bad#name "])(
  "displays an invalid note name faithfully without a wikilink: %s",
  (statement) => {
    const index = renderFolderIndex({
      kind: "subject",
      path: "tools",
      subjects: [],
      notes: [],
      invalid: [{ statement, problems: ["invalid name"] }],
    })

    expect(index).not.toContain("[[")
    expect(index).toContain(statement)
    expect(index).toContain(" · invalid name")
  },
)

test.each(["Bad#folder", "Bad^folder", "Bad[folder", "Bad]folder", "Bad|folder", "Bad`#folder"])(
  "displays an invalid subject name with diagnostics instead of a misleading link: %s",
  (subject) => {
    const index = renderFolderIndex({ kind: "subject", path: "tools", subjects: [subject], notes: [], invalid: [] })

    expect(index).not.toContain("[[")
    expect(index).toContain(subject)
    expect(index).toMatch(/breaks Obsidian links|not allowed in a file name/)
  },
)

test("does not link notes or subjects through an invalid parent path", () => {
  const index = renderFolderIndex({
    kind: "subject",
    path: "Bad#folder",
    subjects: ["valid"],
    notes: [aNote()],
    invalid: [],
  })

  expect(index).not.toContain("[[")
  expect(index).toContain(aNote().statement)
  expect(index).toContain("valid")
})

test("displays problem folders separately from invalid notes with no clickable target", () => {
  const index = renderFolderIndex({
    kind: "root",
    vaultName: "Memory",
    subjects: [],
    notes: [],
    invalid: [],
    hasArchive: false,
    problemFolders: [
      { folder: "Bad#folder", problems: ["leads outside the vault"] },
      { folder: "Alias", problems: ["target is missing"] },
    ],
  })

  expect(index).toContain(
    "## Needs fixing\n\n- Folder `Alias` · target is missing\n- Folder `Bad#folder` · leads outside the vault",
  )
  expect(index).not.toContain("[[")
})

test("keeps names non-clickable even when repeated in diagnostics and headings", () => {
  const name = "Bad[[target]]"
  const problem = `folder "${name}": "]" breaks Obsidian links`
  const index = renderFolderIndex({
    kind: "subject",
    path: name,
    subjects: [],
    notes: [],
    invalid: [{ statement: name, problems: [problem] }],
    problemFolders: [{ folder: name, problems: [problem] }],
  })

  expect(index).toContain(`# \`${name}\`\n`)
  expect(index).toContain(`- \`${name}\` · \`${problem}\``)
  expect(index).toContain(`- Folder \`${name}\` · \`${problem}\``)
})

test("omits the Needs fixing section when every note is valid", () => {
  const index = renderFolderIndex({ kind: "subject", path: "pnpm", subjects: [], notes: [aNote()], invalid: [] })

  expect(index).not.toContain("## Needs fixing")
})
