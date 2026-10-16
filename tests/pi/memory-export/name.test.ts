import { expect, test } from "vitest"

import { defaultExportName } from "#src/pi"

test("the default name carries the local date and time down to the second", () => {
  expect(defaultExportName(new Date(2026, 9, 5, 7, 4, 9))).toBe("memory-export-2026-10-05-070409.zip")
  expect(defaultExportName(new Date(2026, 11, 31, 23, 59, 59))).toBe("memory-export-2026-12-31-235959.zip")
})
