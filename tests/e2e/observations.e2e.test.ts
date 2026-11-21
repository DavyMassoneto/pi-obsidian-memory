import { readFile } from "node:fs/promises"

import { Value } from "typebox/value"
import { expect, test } from "vitest"

import { ObservationCommitSchema } from "#src/domain"
import { nativeObservationSession } from "#test-helpers"

test("the real pi turn persists observation coverage and reloads it without duplicating the sources", async () => {
  const world = await nativeObservationSession(undefined, 20000)
  await world.session.prompt("Neste projeto use sempre pnpm. Responda somente ACK.")
  await world.observer.settled()
  const path = world.session.sessionManager.getSessionFile()
  if (!path) throw new Error("The real session was not saved")
  await world.observer.close()
  world.session.dispose()
  const resumed = await nativeObservationSession(path, 20000)
  await resumed.session.prompt("A preferência continua. Responda somente ACK.")
  await resumed.observer.settled()
  const first = resumed.session.sessionManager.getBranch()
  const commits = first.filter((entry) => entry.type === "custom" && entry.customType === "memory.observations")
  expect(commits.length).toBeGreaterThan(0)
  const sources = first.flatMap((entry) => {
    if (entry.type !== "message") return []
    const role = entry.message.role
    if (role === "user" || role === "assistant" || role === "toolResult") return [entry.id]
    return []
  })
  const confirmed: string[] = []
  for (const entry of commits) {
    if (entry.type !== "custom" || !Value.Check(ObservationCommitSchema, entry.data)) throw new Error("Invalid commit")
    confirmed.push(...entry.data.sourceEntryIds)
  }
  expect(new Set(confirmed)).toEqual(new Set(sources))
  expect(confirmed.length).toBe(new Set(confirmed).size)
  const text = await readFile(path, "utf8")
  expect(text).toContain('"customType":"memory.observations"')
  expect(text).toContain("pnpm")
  expect(world.observer.problems).toEqual([])
  expect(resumed.observer.problems).toEqual([])
})
