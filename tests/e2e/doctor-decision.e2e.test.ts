import { expect, test } from "vitest"

import { configuredWorld, doctorReport, piWithoutCredentials, rewriteConfig, storedConfig } from "#test-helpers"

test("with no API key in pi, a remote embeddings provider and Jev are each reported", async () => {
  const world = await configuredWorld({ capture: "at-session-end" })
  await rewriteConfig(world, { embeddings: { provider: "google", model: "gemini-embedding-001" } })
  const bare = await piWithoutCredentials(world)
  expect((await storedConfig(world)).decisionModel).toEqual({ provider: "typesafe", model: "jev-latest" })
  const { message, notifyType } = await doctorReport(bare)
  expect(message).toContain("- embeddings google/gemini-embedding-001: No API key for google")
  expect(message).toContain("- decision model typesafe/jev-latest: No API key for typesafe")
  expect(notifyType).toBe("warning")
})
