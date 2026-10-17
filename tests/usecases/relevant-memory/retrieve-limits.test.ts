import { expect, onTestFinished, test, vi } from "vitest"

import { loadSessionMemory, retrieveMemory } from "#src/usecases"
import {
  advanceWhen,
  after,
  decisionServer,
  FINISH_WITH_READS,
  getNote,
  jevRelevantReply,
  jevReply,
  layaReplyWithoutRouting,
  putNote,
  relevanceScript,
  relevantFixture,
  retrievalCompletion,
  retrievedText,
  slowCompletion,
} from "#test-helpers"

test("when every note fails to score no notes are added and there is one notice", async () => {
  const fixture = await relevantFixture({ laya: null, decisionModel: { provider: "typesafe", model: "jev-latest" } })
  const pnpm = await putNote(fixture.vault, "Use pnpm", 1, "Always pnpm.")
  const yarn = await putNote(fixture.vault, "Use yarn", 2, "Yarn too.")
  const classify = vi
    .fn()
    .mockResolvedValueOnce(jevReply(0.9))
    .mockResolvedValue({ ...jevRelevantReply(0.8), stopReason: "error" })
  const complete = retrievalCompletion([getNote(pnpm), getNote(yarn), FINISH_WITH_READS])

  const result = await retrieveMemory({ message: "package managers?" }, fixture.context, {
    complete,
    jev: async () => ({ available: true, classifier: { classify } }),
    loaded: fixture.loaded,
  })

  expect(result).toMatchObject({
    succeeded: true,
    output: { text: null, notices: [expect.stringContaining("unavailable")] },
  })
  expect(classify).toHaveBeenCalledTimes(3)
  expect(fixture.loaded.all()).toEqual([])
})

test("a slow model and a slow classifier still finish the message and its notes are added", async () => {
  const fixture = await relevantFixture({ laya: null, decisionModel: { provider: "typesafe", model: "jev-latest" } })
  const pnpm = await putNote(fixture.vault, "Use pnpm", 1, "Always pnpm.")
  const complete = slowCompletion(25_000, [getNote(pnpm), FINISH_WITH_READS])
  const classify = vi
    .fn()
    .mockImplementationOnce(() => after(40_000, jevReply(0.9)))
    .mockImplementationOnce(() => after(40_000, jevRelevantReply(0.8)))
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] })
  onTestFinished(() => {
    vi.useRealTimers()
  })
  const started = Date.now()

  const pending = retrieveMemory({ message: "package managers?" }, fixture.context, {
    complete,
    jev: async () => ({ available: true, classifier: { classify } }),
    loaded: fixture.loaded,
  })
  await advanceWhen(() => classify.mock.calls.length === 1, 40_000)
  await advanceWhen(() => complete.mock.calls.length === 1, 25_000)
  await advanceWhen(() => complete.mock.calls.length === 2, 25_000)
  await advanceWhen(() => classify.mock.calls.length === 2, 40_000)
  const result = await pending

  expect(Date.now() - started).toBe(130_000)
  expect(retrievedText(result)).toContain("Always pnpm.")
  expect(fixture.loaded.all()).toHaveLength(1)
})

test("an aborted signal stops a message while the memory agent is still working", async () => {
  const fixture = await relevantFixture({ laya: relevanceScript(0.9, new Map()) })
  const pnpm = await putNote(fixture.vault, "Use pnpm", 1, "Always pnpm.")
  const complete = slowCompletion(25_000, [getNote(pnpm), FINISH_WITH_READS])
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] })
  onTestFinished(() => {
    vi.useRealTimers()
  })

  const pending = retrieveMemory({ message: "pnpm?" }, fixture.context, {
    complete,
    jev: fixture.unavailable,
    loaded: fixture.loaded,
  })
  await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(1))
  fixture.controller.abort()
  await vi.advanceTimersByTimeAsync(25_000)

  expect(await pending).toMatchObject({ succeeded: true, output: { text: null } })
  expect(complete).toHaveBeenCalledTimes(1)
  expect(fixture.loaded.all()).toEqual([])
})

test("an aborted signal stops a message while the classifier is still working", async () => {
  const fixture = await relevantFixture({ laya: null, decisionModel: { provider: "typesafe", model: "jev-latest" } })
  const classify = vi.fn().mockImplementation(() => new Promise<never>(() => undefined))
  const complete = retrievalCompletion([])

  const pending = retrieveMemory({ message: "pnpm?" }, fixture.context, {
    complete,
    jev: async () => ({ available: true, classifier: { classify } }),
    loaded: fixture.loaded,
  })
  await vi.waitFor(() => expect(classify).toHaveBeenCalledTimes(1))
  fixture.controller.abort()

  expect(await pending).toMatchObject({
    succeeded: true,
    output: { text: null, notices: [expect.stringContaining("aborted")] },
  })
  expect(complete).not.toHaveBeenCalled()
})

test("a Laya that does not say which model answered tells the user how to run it", async () => {
  const server = await decisionServer({ body: layaReplyWithoutRouting(0.9), status: 200, delayMs: 0 })
  onTestFinished(() => server.close())
  const fixture = await relevantFixture({ laya: null, endpoint: server.context.endpoint })

  const result = await retrieveMemory({ message: "pnpm?" }, fixture.context, {
    complete: retrievalCompletion([]),
    jev: fixture.unavailable,
    loaded: fixture.loaded,
  })

  expect(result).toMatchObject({
    succeeded: true,
    output: { text: null, notices: [expect.stringMatching(/laya-serve without LAYA_JEV_STRICT.*LAYA_HOST/)] },
  })
})

test("a slow memory agent at session start still finishes and its notes are loaded", async () => {
  const fixture = await relevantFixture({ laya: null })
  const pnpm = await putNote(fixture.vault, "Use pnpm", 1, "Always pnpm.")
  const complete = slowCompletion(40_000, [getNote(pnpm), FINISH_WITH_READS])
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] })
  onTestFinished(() => {
    vi.useRealTimers()
  })

  const pending = loadSessionMemory(fixture.context, { complete, loaded: fixture.loaded })
  await advanceWhen(() => complete.mock.calls.length === 1, 40_000)
  await advanceWhen(() => complete.mock.calls.length === 2, 40_000)

  expect(retrievedText(await pending)).toContain("Always pnpm.")
  expect(fixture.loaded.all()).toHaveLength(1)
})

test("an aborted signal stops the session-start load while the memory agent is still working", async () => {
  const fixture = await relevantFixture({ laya: null })
  const pnpm = await putNote(fixture.vault, "Use pnpm", 1, "Always pnpm.")
  const complete = slowCompletion(40_000, [getNote(pnpm), FINISH_WITH_READS])
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] })
  onTestFinished(() => {
    vi.useRealTimers()
  })

  const pending = loadSessionMemory(fixture.context, { complete, loaded: fixture.loaded })
  await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(1))
  fixture.controller.abort()
  await vi.advanceTimersByTimeAsync(40_000)
  await pending

  expect(complete).toHaveBeenCalledTimes(1)
  expect(fixture.loaded.all()).toEqual([])
})

test("a message waiting for a busy memory keeps waiting and stops when the signal aborts", async () => {
  const fixture = await relevantFixture({ laya: relevanceScript(0.9, new Map()) })
  const lease = await fixture.context.session.acquire(fixture.context.stamp, new AbortController().signal)
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  onTestFinished(() => {
    lease?.release()
    vi.useRealTimers()
  })
  let settled = false

  const pending = retrieveMemory({ message: "pnpm?" }, fixture.context, {
    complete: retrievalCompletion([]),
    jev: fixture.unavailable,
    loaded: fixture.loaded,
  }).finally(() => {
    settled = true
  })
  await vi.advanceTimersByTimeAsync(10 * 60_000)
  expect(settled).toBe(false)
  fixture.controller.abort()

  expect(await pending).toMatchObject({ succeeded: false })
})

test("a session-start load waiting for a busy memory keeps waiting and stops when the signal aborts", async () => {
  const fixture = await relevantFixture({ laya: null })
  const lease = await fixture.context.session.acquire(fixture.context.stamp, new AbortController().signal)
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  onTestFinished(() => {
    lease?.release()
    vi.useRealTimers()
  })
  let settled = false

  const pending = loadSessionMemory(fixture.context, {
    complete: retrievalCompletion([]),
    loaded: fixture.loaded,
  }).finally(() => {
    settled = true
  })
  await vi.advanceTimersByTimeAsync(10 * 60_000)
  expect(settled).toBe(false)
  fixture.controller.abort()

  expect(await pending).toMatchObject({ succeeded: false })
})
