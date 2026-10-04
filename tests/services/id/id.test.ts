import { Value } from "typebox/value"
import { decodeTime } from "ulid"
import { afterEach, expect, test, vi } from "vitest"

import { NoteFrontmatterSchema } from "#/domain/note"
import { newNoteId } from "#/services/id"

afterEach(() => {
  vi.useRealTimers()
})

test("creates an id the note format accepts", () => {
  expect(Value.Check(NoteFrontmatterSchema.properties.id, newNoteId())).toBe(true)
})

test("stamps the id with the current time, so ids sort by creation", () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-06T12:00:00Z"))

  expect(decodeTime(newNoteId())).toBe(Date.parse("2026-10-06T12:00:00Z"))
})

test("never repeats an id", () => {
  const ids = Array.from({ length: 1000 }, () => newNoteId())

  expect(new Set(ids).size).toBe(1000)
})
