import { expect, test } from "vitest"

import { putNote, searchText } from "#/services"
import { anEntry, changeIndexFile, useIndexFile, useTempIndex } from "#test-helpers"

const defaults = { limit: 10, includeArchived: false }

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

test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid search limit %s", async (limit) => {
  const index = await useTempIndex()

  expect(searchText(index, "pnpm", { ...defaults, limit })).toMatchObject({ succeeded: false, reason: "invalid" })
})
