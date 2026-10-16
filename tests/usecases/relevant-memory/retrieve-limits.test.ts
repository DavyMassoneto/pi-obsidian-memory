import { expect, onTestFinished, test, vi } from "vitest"

import { decisionTimeoutMs, MAX_RETRIEVAL_DURATION_MS } from "#src/services"
import { loadSessionMemory, retrieveMemory } from "#src/usecases"
import {
  advanceWhen,
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

test("the whole message ends within the decision timeout plus the retrieval limit when every model step takes 25 seconds", async () => {
  const fixture = await relevantFixture({ laya: null, decisionModel: { provider: "typesafe", model: "jev-latest" } })
  const paths = [
    await putNote(fixture.vault, "Use pnpm", 1, "Always pnpm."),
    await putNote(fixture.vault, "Use yarn", 2, "Yarn too."),
    await putNote(fixture.vault, "Use npm", 3, "Plain npm."),
  ]
  const complete = slowCompletion(25_000, paths.map(getNote))
  const classify = vi.fn().mockResolvedValue(jevReply(0.9))
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
  await advanceWhen(() => complete.mock.calls.length === 1, 25_000)
  await advanceWhen(() => complete.mock.calls.length === 2, 25_000)
  await advanceWhen(() => complete.mock.calls.length === 3, 10_000)
  const result = await pending

  expect(Date.now() - started).toBe(decisionTimeoutMs + MAX_RETRIEVAL_DURATION_MS)
  expect(result).toMatchObject({
    succeeded: true,
    output: { text: null, notices: expect.arrayContaining([expect.stringContaining("ran out of time")]) },
  })
  expect(complete.mock.calls.length).toBeLessThanOrEqual(3)
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

test("the session-start load stops at the retrieval limit and says the notes could not be loaded", async () => {
  const fixture = await relevantFixture({ laya: null })
  const pnpm = await putNote(fixture.vault, "Use pnpm", 1, "Always pnpm.")
  const complete = slowCompletion(25_000, [getNote(pnpm), getNote(pnpm), getNote(pnpm)])
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] })
  onTestFinished(() => {
    vi.useRealTimers()
  })
  const started = Date.now()

  const pending = loadSessionMemory(fixture.context, { complete, loaded: fixture.loaded })
  await advanceWhen(() => complete.mock.calls.length === 1, 25_000)
  await advanceWhen(() => complete.mock.calls.length === 2, MAX_RETRIEVAL_DURATION_MS - 25_000)
  const result = await pending

  expect(Date.now() - started).toBe(MAX_RETRIEVAL_DURATION_MS)
  expect(result).toMatchObject({
    succeeded: true,
    output: {
      text: expect.stringContaining("could not be loaded"),
      notices: [expect.stringContaining("could not be loaded")],
    },
  })
})

test("when the limit cuts the scoring off, only the out-of-time notice is shown", async () => {
  const fixture = await relevantFixture({ laya: null, decisionModel: { provider: "typesafe", model: "jev-latest" } })
  const pnpm = await putNote(fixture.vault, "Use pnpm", 1, "Always pnpm.")
  const complete = slowCompletion(17_000, [getNote(pnpm), FINISH_WITH_READS])
  const classify = vi
    .fn()
    .mockResolvedValueOnce(jevReply(0.9))
    .mockImplementation(() => new Promise<never>(() => undefined))
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] })
  onTestFinished(() => {
    vi.useRealTimers()
  })

  const pending = retrieveMemory({ message: "pnpm?" }, fixture.context, {
    complete,
    jev: async () => ({ available: true, classifier: { classify } }),
    loaded: fixture.loaded,
  })
  await advanceWhen(() => complete.mock.calls.length === 1, 17_000)
  await advanceWhen(() => complete.mock.calls.length === 2, 17_000)
  await advanceWhen(() => classify.mock.calls.length === 2, decisionTimeoutMs + MAX_RETRIEVAL_DURATION_MS - 34_000)
  const result = await pending

  expect(classify).toHaveBeenCalledTimes(2)
  expect(result).toMatchObject({
    succeeded: true,
    output: { text: null, notices: [expect.stringContaining("ran out of time")] },
  })
})

test("a message that cannot even start because the memory is busy ends at the limit with the out-of-time notice", async () => {
  const fixture = await relevantFixture({ laya: relevanceScript(0.9, new Map()) })
  const lease = await fixture.context.session.acquire(fixture.context.stamp, new AbortController().signal)
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  onTestFinished(() => {
    lease?.release()
    vi.useRealTimers()
  })

  const pending = retrieveMemory({ message: "pnpm?" }, fixture.context, {
    complete: retrievalCompletion([]),
    jev: fixture.unavailable,
    loaded: fixture.loaded,
  })
  await vi.advanceTimersByTimeAsync(decisionTimeoutMs + MAX_RETRIEVAL_DURATION_MS)

  expect(await pending).toMatchObject({
    succeeded: true,
    output: { text: null, notices: [expect.stringContaining("ran out of time")] },
  })
})

test("a session-start load that cannot start because the memory is busy ends at the limit", async () => {
  const fixture = await relevantFixture({ laya: null })
  const lease = await fixture.context.session.acquire(fixture.context.stamp, new AbortController().signal)
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
  onTestFinished(() => {
    lease?.release()
    vi.useRealTimers()
  })

  const pending = loadSessionMemory(fixture.context, { complete: retrievalCompletion([]), loaded: fixture.loaded })
  await vi.advanceTimersByTimeAsync(MAX_RETRIEVAL_DURATION_MS)

  expect(await pending).toMatchObject({ succeeded: false })
})
