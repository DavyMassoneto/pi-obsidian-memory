import { expect, test } from "vitest"

import { putNote, searchText } from "#src/services"
import { anEntry, changeIndexFile, useIndexFile } from "#test-helpers"

const defaults = { includeArchived: false }

test.each(["type = 'made-up'", "id = 'invalid'", "statement = X'FF'"])(
  "reports corrupt result data (%s) instead of leaking a row or throwing",
  async (assignment) => {
    const { index, path } = await useIndexFile()
    putNote(index, anEntry())
    changeIndexFile(path, `UPDATE notes SET ${assignment}`)

    expect(searchText(index, "pnpm", defaults)).toMatchObject({
      succeeded: false,
      reason: "corrupted",
      problems: [expect.any(String)],
    })
  },
)
