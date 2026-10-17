import { expect, test } from "vitest"

import {
  configuredWorld,
  damageLocalModel,
  doctorReport,
  downloadLocalModel,
  piWithoutCredentials,
  storedConfig,
  worldOnEmbeddings,
  writeProviderKey,
} from "#test-helpers"

const OPENAI = { provider: "openai", model: "text-embedding-3-small" } as const

test("a local model file that is not the real one is reported as damaged", async () => {
  const world = await configuredWorld({ capture: "at-session-end", modelCache: "fresh" })
  const { embeddings } = await storedConfig(world)
  await downloadLocalModel(world)
  await damageLocalModel(world)
  const { message, notifyType } = await doctorReport(world)
  expect(message).toContain(
    `- embeddings ${embeddings.provider}/${embeddings.model}: The downloaded local model is damaged; remove its folder to download it again`,
  )
  expect(notifyType).toBe("warning")
})

test("OpenAI embeddings with no API key in pi are reported", async () => {
  const world = await worldOnEmbeddings(OPENAI)
  const bare = await piWithoutCredentials(world)
  const { message, notifyType } = await doctorReport(bare)
  expect(message).toContain("- embeddings openai/text-embedding-3-small: No API key for openai")
  expect(notifyType).toBe("warning")
})

test("OpenAI embeddings with an API key in pi are ready", async () => {
  const world = await worldOnEmbeddings(OPENAI)
  await writeProviderKey(world, "openai", "sk-e2e-dummy-key")
  await world.restart()
  const { message, notifyType } = await doctorReport(world)
  expect(message).toContain("- embeddings openai/text-embedding-3-small: ready")
  expect(notifyType).toBe("info")
})

test("OpenAI embeddings with an empty API key stored in pi are reported as no API key", async () => {
  const world = await worldOnEmbeddings(OPENAI)
  await writeProviderKey(world, "openai", "")
  await world.restart()
  const { message, notifyType } = await doctorReport(world)
  expect(message).toContain("- embeddings openai/text-embedding-3-small: No API key for openai")
  expect(notifyType).toBe("warning")
})
