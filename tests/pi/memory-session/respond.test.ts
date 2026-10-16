import { expect, test } from "vitest"

import { noSessionResponse } from "#src/pi"
import { textOf } from "#test-helpers"

test("without a session the answer is an error that says memory is not ready", () => {
  const response = noSessionResponse()

  expect(response.isError).toBe(true)
  expect(textOf(response)).toBe("Memory is not ready in this session; try again after the session has started.")
  expect(response.details).toBeUndefined()
})
