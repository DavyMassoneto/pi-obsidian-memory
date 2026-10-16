import { expect, test } from "vitest"

import { capturedSearchPaths, conceptVault } from "#test-helpers"

test("capture's search finds a paraphrase through the vectors when semantic search is on", async () => {
  const fixture = await conceptVault()

  expect(await capturedSearchPaths(fixture.context)).toEqual(["vehicles/Car.md"])
  expect(fixture.embedder.queries).toEqual(["automobile"])
})

test("capture's search is words only when the operation has no semantic source", async () => {
  const fixture = await conceptVault()

  expect(await capturedSearchPaths(fixture.plainContext)).toEqual([])
})
