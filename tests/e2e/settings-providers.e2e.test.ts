import { expect, test } from "vitest"

import { CURRENT_MARK, EMBEDDINGS_TITLE, REMOTE_EMBEDDINGS_DISCLOSURE, SAVED } from "#src/pi"
import {
  configuredWorld,
  embeddingLabel,
  leaveScreen,
  optionsOf,
  pickLine,
  rewriteConfig,
  settingsScreen,
  storedConfig,
} from "#test-helpers"

const LOCAL = embeddingLabel("local")
const OPENAI = embeddingLabel("openai")
const GOOGLE = embeddingLabel("google")

test("choosing a remote embeddings provider warns that note content, secrets included, goes to it", async () => {
  const world = await configuredWorld({})
  const turn = await settingsScreen(world, [
    pickLine("Embeddings:"),
    { method: "select", title: EMBEDDINGS_TITLE, answer: { option: OPENAI } },
    leaveScreen,
  ])
  expect(optionsOf(world, EMBEDDINGS_TITLE)).toEqual([`${LOCAL} ${CURRENT_MARK}`, OPENAI, GOOGLE])
  expect((await storedConfig(world)).embeddings).toEqual({ provider: "openai", model: "text-embedding-3-small" })
  expect(turn.notifications.map((notice) => notice.notifyType)).toEqual(["warning", "info"])
  expect(turn.notifications[0]?.message).toBe(REMOTE_EMBEDDINGS_DISCLOSURE)
  expect(world.pi.unexpected).toEqual([])
})

test("going back to the local embeddings shows no warning", async () => {
  const world = await configuredWorld({})
  await rewriteConfig(world, { embeddings: { provider: "google", model: "gemini-embedding-001" } })
  const turn = await settingsScreen(world, [
    pickLine("Embeddings:"),
    { method: "select", title: EMBEDDINGS_TITLE, answer: { option: LOCAL } },
    leaveScreen,
  ])
  expect((await storedConfig(world)).embeddings.provider).toBe("local")
  expect(turn.notifications.map((notice) => notice.notifyType)).toEqual(["info"])
  expect(turn.notifications[0]?.message.startsWith(SAVED)).toBe(true)
  expect(world.pi.unexpected).toEqual([])
})
