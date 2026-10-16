import { expect, test } from "vitest"

import { applyIndexChanges, searchCatalog } from "#src/services"
import { catalogChanges, catalogEntry, useIndexFile } from "#test-helpers"

test("literal query terms find a needs-fixing note and empty terms do not become an FTS error", async () => {
  const { index } = await useIndexFile()
  const entry = { ...catalogEntry("tools/First.md"), needsFixing: true }
  applyIndexChanges(index, catalogChanges([entry], 0))
  expect(searchCatalog(index, { query: '"pnpm" OR (missing)', limit: 10 })).toMatchObject({
    succeeded: true,
    output: [{ path: entry.path, needsFixing: true }],
  })
  expect(searchCatalog(index, { query: "the and", limit: 10 })).toEqual({ succeeded: true, output: [] })
  for (const limit of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(searchCatalog(index, { query: "pnpm", limit })).toMatchObject({ succeeded: false, reason: "invalid" })
  }
})
