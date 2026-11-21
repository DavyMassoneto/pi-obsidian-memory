import { Value } from "typebox/value"
import { expect, test } from "vitest"

import { ObservationCommitSchema, StoredObservationSchema } from "#src/domain"

test("an empty observer result is a valid committed coverage record", () => {
  expect(Value.Check(ObservationCommitSchema, { sourceEntryIds: ["entry-A"], observations: [] })).toBe(true)
})

test.each([
  { sourceEntryIds: [], observations: [] },
  { sourceEntryIds: ["A", "A"], observations: [] },
  { sourceEntryIds: [""], observations: [] },
  { sourceEntryIds: ["A"], observations: [], unconfirmed: true },
  { sourceEntryIds: ["A"] },
])("invalid coverage cannot be restored from the session: %j", (commit) => {
  expect(Value.Check(ObservationCommitSchema, commit)).toBe(false)
})

test("a stored observation rejects missing provenance and invalid token counts", () => {
  const observation = {
    id: "observation-A",
    timestamp: "2026-11-21T02:00:00.000Z",
    content: "Use pnpm.",
    sourceEntryIds: ["entry-A"],
    tokenCount: 4,
  }
  expect(Value.Check(StoredObservationSchema, observation)).toBe(true)
  expect(Value.Check(StoredObservationSchema, { ...observation, sourceEntryIds: [] })).toBe(false)
  expect(Value.Check(StoredObservationSchema, { ...observation, tokenCount: -1 })).toBe(false)
  expect(Value.Check(StoredObservationSchema, { ...observation, tokenCount: 1.5 })).toBe(false)
  expect(Value.Check(StoredObservationSchema, { ...observation, id: "" })).toBe(false)
  expect(Value.Check(StoredObservationSchema, { ...observation, content: "" })).toBe(false)
})
