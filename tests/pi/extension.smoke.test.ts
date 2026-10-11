import { expect, test } from "vitest"

import { loadIsolatedPiToolNames } from "#test-helpers"

test("pi loads the package and registers its memory tool", async () => {
  expect(await loadIsolatedPiToolNames()).toContain("memory_add")
})
