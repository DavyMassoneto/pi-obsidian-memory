import { expect, test } from "vitest"

import { localTimestamp, nowMs } from "#src/services"

test("a local timestamp has the YYYY-MM-DDTHH:MM:SS form and names the same local moment", () => {
  const moment = new Date(2026, 9, 26, 13, 35, 7).getTime()

  expect(localTimestamp(moment)).toBe("2026-10-26T13:35:07")
})

test("the current time in milliseconds is not before a time taken just before it", () => {
  const before = Date.now()

  expect(nowMs()).toBeGreaterThanOrEqual(before)
})
