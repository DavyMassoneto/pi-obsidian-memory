import { expect, test } from "vitest"

import { textLimitFor } from "#src/usecases"

test("words alone return as many as the answer holds, and fusion draws on a deeper list of word matches", () => {
  expect(textLimitFor(null)).toBe(10)
  expect(textLimitFor({ fingerprint: "f", vector: [1] })).toBe(50)
})
