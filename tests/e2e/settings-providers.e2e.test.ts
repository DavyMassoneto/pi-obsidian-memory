import { expect, test } from "vitest"

import {
  CURRENT_MARK,
  DECISION_TITLE,
  EMBEDDINGS_TITLE,
  JEV_DISCLOSURE,
  JEV_OPTION,
  LAYA_DEFAULT_ENDPOINT,
  LAYA_ENDPOINT_TITLE,
  LAYA_OPTION,
  REMOTE_EMBEDDINGS_DISCLOSURE,
  SAVED,
} from "#src/pi"
import {
  configText,
  configuredWorld,
  decision,
  dialogsTitled,
  embeddingLabel,
  endpoint,
  LAYA_MODEL,
  leaveScreen,
  onLaya,
  optionsOf,
  pickLine,
  pressEscape,
  rewriteConfig,
  settingsScreen,
  storedConfig,
} from "#test-helpers"

const LOCAL = embeddingLabel("local")
const OPENAI = embeddingLabel("openai")
const GOOGLE = embeddingLabel("google")

test("switching to Jev writes it, clears the thresholds and warns that messages and notes go to TypeSafe", async () => {
  const world = await configuredWorld({})
  await onLaya(world, { gateThreshold: 0.3 })
  const turn = await settingsScreen(world, [pickLine("Decision model:"), decision(JEV_OPTION), leaveScreen])
  expect(optionsOf(world, DECISION_TITLE)).toEqual([`${LAYA_OPTION} ${CURRENT_MARK}`, JEV_OPTION])
  expect((await storedConfig(world)).decisionModel).toEqual({ provider: "typesafe", model: "jev-latest" })
  expect(turn.notifications.map((notice) => notice.notifyType)).toEqual(["warning", "info"])
  const [warning, saved] = turn.notifications
  expect(warning?.message).toBe(JEV_DISCLOSURE)
  expect(saved?.message.startsWith(SAVED)).toBe(true)
  expect(saved?.message).toContain("cutoffs")
  expect(world.pi.unexpected).toEqual([])
})

test("switching to Laya asks for the endpoint with the default as its placeholder, and starts without cutoffs", async () => {
  const world = await configuredWorld({})
  const typed = "http://127.0.0.1:9000/v1/systemone"
  await settingsScreen(world, [
    pickLine("Decision model:"),
    decision(LAYA_OPTION),
    endpoint({ value: typed }),
    leaveScreen,
  ])
  expect(dialogsTitled(world, LAYA_ENDPOINT_TITLE)[0]?.placeholder).toBe(LAYA_DEFAULT_ENDPOINT)
  expect((await storedConfig(world)).decisionModel).toEqual({ ...LAYA_MODEL, endpoint: typed })
  expect(world.pi.unexpected).toEqual([])
})

test("keeping Laya and giving a new endpoint keeps its cutoffs", async () => {
  const world = await configuredWorld({})
  await onLaya(world, { relevanceThreshold: 0.2 })
  const typed = "http://127.0.0.1:9001/v1/systemone"
  await settingsScreen(world, [
    pickLine("Decision model:"),
    decision(LAYA_OPTION),
    endpoint({ value: typed }),
    leaveScreen,
  ])
  expect((await storedConfig(world)).decisionModel).toMatchObject({ endpoint: typed, relevanceThreshold: 0.2 })
  expect(world.pi.unexpected).toEqual([])
})

test("a Laya endpoint that is not on this machine is refused with the reason and nothing changes", async () => {
  const world = await configuredWorld({})
  const text = await onLaya(world, {})
  const turn = await settingsScreen(world, [
    pickLine("Decision model:"),
    decision(LAYA_OPTION),
    endpoint({ value: "https://example.com/v1/systemone" }),
    leaveScreen,
  ])
  expect(turn.notifications.map((notice) => [notice.notifyType, notice.message.includes("loopback")])).toEqual([
    ["error", true],
  ])
  expect(await configText(world)).toBe(text)
  expect(world.pi.unexpected).toEqual([])
})

test("Escape on the endpoint or on the provider list changes nothing", async () => {
  const world = await configuredWorld({})
  const text = await onLaya(world, {})
  const turn = await settingsScreen(world, [
    pickLine("Decision model:"),
    { method: "select", title: DECISION_TITLE, answer: pressEscape },
    pickLine("Decision model:"),
    decision(LAYA_OPTION),
    endpoint(pressEscape),
    leaveScreen,
  ])
  expect(await configText(world)).toBe(text)
  expect(turn.notifications).toEqual([])
  expect(world.pi.unexpected).toEqual([])
})

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
