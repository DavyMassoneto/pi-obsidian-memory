import { expect, test } from "vitest"

import { renderFolderIndex } from "#src/domain"
import { aDontForgetNote, noteAbout } from "#test-helpers"

test("renders this exact index, so bump FOLDER_INDEX_FORMAT when this output changes", () => {
  const index = renderFolderIndex({
    kind: "root",
    vaultName: "memory",
    subjects: ["typescript"],
    notes: [aDontForgetNote("Strict mode always on"), noteAbout("No ternaries", "rule")],
    invalid: [{ statement: "Broken note", problems: ["Missing type"] }],
    hasArchive: true,
    problemFolders: [{ folder: "bad", problems: ["Cannot be read"] }],
  })

  expect(index).toBe(
    [
      "# memory",
      "",
      "## Subjects",
      "",
      "- [[typescript/index|typescript]]",
      "",
      "## Notes",
      "",
      "- [[No ternaries|No ternaries]] · rule",
      "- [[Strict mode always on|Strict mode always on]] · rule · don't forget",
      "",
      "## Needs fixing",
      "",
      "- [[Broken note|Broken note]] · Missing type",
      "- Folder `bad` · Cannot be read",
      "",
      "## Archive",
      "",
      "- [[archive/index|archive]]",
      "",
    ].join("\n"),
  )
})
