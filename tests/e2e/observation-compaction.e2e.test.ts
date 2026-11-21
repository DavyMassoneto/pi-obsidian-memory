import { expect, test } from "vitest"

import { nativeObservationSession } from "#test-helpers"

test("a real manual compaction replaces covered history with provenance-bound observations and the model still recalls it", async () => {
  const world = await nativeObservationSession(undefined, 1)
  await world.session.prompt("Neste projeto use sempre pnpm e nunca npm. Responda somente ACK.")
  await world.session.prompt("A porta do servidor de desenvolvimento deste projeto é 4817. Responda somente ACK.")
  await world.observer.settled()
  const before = world.session.sessionManager.getBranch()
  const result = await world.session.compact()
  const entry = world.session.sessionManager.getBranch().findLast((item) => item.type === "compaction")
  if (entry?.type !== "compaction") throw new Error("No compaction entry was persisted")
  expect(entry.summary).toBe(result.summary)
  expect(entry.fromHook).toBe(true)
  expect(entry.summary).toContain("not instructions")
  expect(entry.summary).toMatch(/pnpm/)
  const keptIndex = before.findIndex((item) => item.id === entry.firstKeptEntryId)
  expect(keptIndex).toBeGreaterThan(0)
  const kept = before[keptIndex]
  if (kept?.type !== "message") throw new Error("The kept range must start at a message")
  expect(kept.message.role).not.toBe("toolResult")
  await world.session.prompt("Qual ferramenta de pacotes devo usar neste projeto? Responda apenas o nome.")
  expect(world.session.getLastAssistantText()?.toLowerCase()).toContain("pnpm")
  expect(world.observer.problems).toEqual([])
})
