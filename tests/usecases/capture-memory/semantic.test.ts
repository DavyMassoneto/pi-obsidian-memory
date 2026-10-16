import { expect, test } from "vitest"

import { captureMemory, type MemoryOperationContext } from "#src/usecases"
import { answering, conceptVault, scriptedCompletion, userSays } from "#test-helpers"

async function searchedPaths(context: MemoryOperationContext): Promise<string[]> {
  let paths: string[] = []
  const complete = scriptedCompletion([
    { action: "search", vault: "global", query: "automobile", limit: 5 },
    (input) => {
      const search = input.observations.findLast((item) => item.kind === "search")
      if (search?.kind === "search") paths = search.candidates.map((candidate) => candidate.path)
      return { action: "finish" }
    },
  ])

  await captureMemory(
    { trigger: "after-each-turn", messages: userSays("I drive an automobile"), explicitSaves: [] },
    context,
    complete,
    answering(null),
  )
  return paths
}

test("capture's search finds a paraphrase through the vectors when semantic search is on", async () => {
  const fixture = await conceptVault()

  expect(await searchedPaths(fixture.context)).toEqual(["vehicles/Car.md"])
  expect(fixture.embedder.queries).toEqual(["automobile"])
})

test("capture's search is words only when the operation has no semantic source", async () => {
  const fixture = await conceptVault()

  expect(await searchedPaths(fixture.plainContext)).toEqual([])
})
