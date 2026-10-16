import { expect, test } from "vitest"

import { refreshWarnings, warningsOf } from "#src/usecases"

test("a refused refresh becomes warnings that carry the reason", () => {
  expect(refreshWarnings({ succeeded: false, reason: "not-writable", problems: ["a", "b"] })).toEqual([
    "not-writable: a",
    "not-writable: b",
  ])
})

test("a refresh that succeeded passes its own warnings on", () => {
  expect(refreshWarnings({ succeeded: true, maintenanceProblems: ["index.md leads outside the vault"] })).toEqual([
    "index.md leads outside the vault",
  ])
  expect(refreshWarnings({ succeeded: true })).toEqual([])
})

test("warnings are copied so callers can add to them", () => {
  const original = { maintenanceProblems: ["one"] }

  const copy = warningsOf(original)
  copy.push("two")

  expect(original.maintenanceProblems).toEqual(["one"])
  expect(warningsOf({})).toEqual([])
})
