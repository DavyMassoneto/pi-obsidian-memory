import { expect, test } from "vitest"

import { parseObserverReply } from "#src/domain"

test("an observer cannot claim sources outside the observed slice", () => {
  const text = JSON.stringify({ observations: [{ content: "Use pnpm.", sourceEntryIds: ["other-branch"] }] })
  expect(parseObserverReply(text, ["A"]).succeeded).toBe(false)
})

test("empty observations are valid and do not invent coverage identifiers", () => {
  expect(parseObserverReply('{"observations":[]}', ["A"])).toEqual({ succeeded: true, output: [] })
})

test.each([
  "not JSON",
  '{"observations":[{"content":" ","sourceEntryIds":["A"]}]}',
  '{"observations":[{"content":"Use pnpm.","sourceEntryIds":[]}]}',
  '{"observations":[{"content":"Use pnpm.","sourceEntryIds":["A","A"]}]}',
  '{"observations":[{"id":"invented","content":"Use pnpm.","sourceEntryIds":["A"]}]}',
])("an invalid observer reply does not become memory: %s", (text) => {
  expect(parseObserverReply(text, ["A"]).succeeded).toBe(false)
})
