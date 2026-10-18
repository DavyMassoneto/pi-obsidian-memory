import { expect, test } from "vitest"

import { applyIndexChanges, searchCatalog } from "#src/services"
import { catalogChanges, catalogEntry, useIndexFile } from "#test-helpers"

test("literal query terms find a needs-fixing note and empty terms do not become an FTS error", async () => {
  const { index } = await useIndexFile()
  const entry = { ...catalogEntry("tools/First.md"), needsFixing: true }
  applyIndexChanges(index, catalogChanges([entry], 0))
  expect(searchCatalog(index, { query: '"pnpm" OR (missing)' })).toMatchObject({
    succeeded: true,
    output: [{ path: entry.path, needsFixing: true }],
  })
  expect(searchCatalog(index, { query: "the and" })).toEqual({ succeeded: true, output: [] })
})
