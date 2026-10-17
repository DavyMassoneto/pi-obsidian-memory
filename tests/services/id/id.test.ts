import { Value } from "typebox/value"
import { expect, test } from "vitest"

import { NoteFrontmatterSchema } from "#src/domain"
import { newNoteId } from "#src/services"

test("creates an id the note format accepts", () => {
  expect(Value.Check(NoteFrontmatterSchema.properties.id, newNoteId())).toBe(true)
})

test("never repeats an id", () => {
  const ids = Array.from({ length: 1000 }, () => newNoteId())

  expect(new Set(ids).size).toBe(1000)
})
