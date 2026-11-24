import { expect, test } from "vitest"

import { deliverSessionMemory, LoadedMemory, SESSION_INTRO } from "#src/usecases"
import { readObservation } from "#test-helpers"

test("delivers and records only session notes not already loaded with the same hash", () => {
  const loaded = new LoadedMemory()
  const repeated = readObservation()
  const changed = { ...repeated, path: "profile/Changed.md", hash: "b".repeat(64) }
  loaded.remember(repeated)
  loaded.remember({ ...changed, hash: "a".repeat(64) })
  const pending = { text: "the session notes", notices: [], changes: { loaded: [repeated, changed], forgotten: [] } }

  const delivered = deliverSessionMemory(pending, loaded)

  expect(delivered.text).toContain(SESSION_INTRO)
  expect(delivered.text).toContain(changed.path)
  expect(delivered.text).not.toContain(repeated.path)
  expect(delivered.changes).toEqual({ loaded: [changed], forgotten: [] })
  expect(loaded.has(changed)).toBe(true)
})

test("does not send duplicate notes and preserves a session-load failure", () => {
  const loaded = new LoadedMemory()
  const read = readObservation()
  loaded.remember(read)
  const pending = { text: "the session notes", notices: [], changes: { loaded: [read], forgotten: [] } }
  expect(deliverSessionMemory(pending, loaded).text).toBeNull()
  const failure = {
    text: "Relevant notes could not be loaded: error",
    notices: ["error"],
    changes: { loaded: [], forgotten: [] },
  }
  expect(deliverSessionMemory(failure, loaded)).toEqual(failure)
})
