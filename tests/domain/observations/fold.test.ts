import { expect, test } from "vitest"

import { foldObservations } from "#src/domain"

test("confirmed consolidation removes only its named observations and retried commits do not duplicate memory", () => {
  const first = {
    id: "observation-A",
    timestamp: "2026-11-21T02:00:00.000Z",
    content: "Use pnpm in this project.",
    sourceEntryIds: ["A"],
    tokenCount: 8,
  }
  const second = { ...first, id: "observation-B", content: "Run the tests before committing.", sourceEntryIds: ["B"] }
  const commits = [
    { sourceEntryIds: ["A"], observations: [first] },
    { sourceEntryIds: ["B"], observations: [second] },
    { sourceEntryIds: ["A"], observations: [first] },
  ]
  expect(foldObservations(commits, ["observation-A", "not-in-this-branch"])).toEqual([second])
  expect(foldObservations(commits, [])).toEqual([first, second])
})
