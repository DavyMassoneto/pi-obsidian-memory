import { expect, onTestFinished, test, vi } from "vitest"

import { decisionTimeoutMs, MAX_RETRIEVAL_DURATION_MS } from "#src/services"
import { loadSessionMemory, retrieveMemory } from "#src/usecases"
import {
  advanceUntil,
  decisionServer,
  FINISH_WITH_READS,
  getNote,
  jevRelevantReply,
  jevReply,
  layaReplyWithoutRouting,
  putNote,
  relevantFixture,
  retrievalCompletion,
  slowCompletion,
} from "#test-helpers"

const SLACK_MS = 5000

test("a scoring that fails adds no notes and gives one notice, without scoring the rest", async () => {
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
  expect(classify).toHaveBeenCalledTimes(2)
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
  let finishedAt = 0

  const pending = retrieveMemory({ message: "package managers?" }, fixture.context, {
    complete,
    jev: async () => ({ available: true, classifier: { classify } }),
    loaded: fixture.loaded,
  }).then((result) => {
    finishedAt = Date.now()
    return result
  })
  await advanceUntil(() => finishedAt > 0, 1000)
  const result = await pending

  expect(finishedAt - started).toBeLessThanOrEqual(decisionTimeoutMs + MAX_RETRIEVAL_DURATION_MS + SLACK_MS)
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
  let finishedAt = 0

  const pending = loadSessionMemory(fixture.context, { complete, loaded: fixture.loaded }).then((result) => {
    finishedAt = Date.now()
    return result
  })
  await advanceUntil(() => finishedAt > 0, 1000)
  const result = await pending

  expect(finishedAt - started).toBeLessThanOrEqual(MAX_RETRIEVAL_DURATION_MS + SLACK_MS)
  expect(result).toMatchObject({
    succeeded: true,
    output: {
      text: expect.stringContaining("could not be loaded"),
      notices: [expect.stringContaining("could not be loaded")],
    },
  })
})
