import { afterEach, expect, test, vi } from "vitest"

import { today } from "#/services/clock"

afterEach(() => {
  vi.useRealTimers()
})

test.each([
  ["late at night", new Date(2026, 9, 6, 23, 30), "2026-10-06"],
  ["early in the morning", new Date(2026, 9, 7, 0, 10), "2026-10-07"],
  ["a single-digit month and day", new Date(2026, 0, 5, 12, 0), "2026-01-05"],
])("gives the local date %s as YYYY-MM-DD", (_case, now, expected) => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(now)

  expect(today()).toBe(expected)
})
