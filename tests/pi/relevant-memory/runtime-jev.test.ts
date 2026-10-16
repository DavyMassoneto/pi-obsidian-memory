import { expect, test, vi } from "vitest"

import {
  FINISH_WITH_READS,
  fakePiContext,
  getNote,
  jevRelevantReply,
  jevReply,
  putNote,
  relevanceScript,
  relevantPiFixture,
} from "#test-helpers"

const PNPM = "tools/Use pnpm.md"

test("Jev is confirmed once per runtime at startup and then decides and scores through pi's classifier", async () => {
  const classify = vi.fn().mockResolvedValueOnce(jevReply(0.9)).mockResolvedValueOnce(jevRelevantReply(0.8))
  const fixture = await relevantPiFixture({
    laya: null,
    decisionModel: { provider: "typesafe", model: "jev-latest" },
    session: [],
    turns: [getNote(PNPM), FINISH_WITH_READS],
  })
  await putNote(fixture.vaults.global, "Use pnpm", 1, "Always pnpm.")
  const { context, prompts } = fakePiContext(fixture.workingFolder, {
    hasUI: true,
    classify,
    answers: { confirms: [true] },
  })

  await fixture.pi.startSession(context, "startup")
  await fixture.pi.startSession(context, "new")
  const { message } = await fixture.pi.runTurn(context, "pnpm?")

  expect(prompts.filter((prompt) => prompt.kind === "confirm")).toHaveLength(1)
  expect(String(message?.content)).toContain("Always pnpm.")
  expect(classify).toHaveBeenCalledTimes(2)
})

test("without a UI Jev is off: no per-message memory and no other model takes its place", async () => {
  const classify = vi.fn()
  const fixture = await relevantPiFixture({
    laya: relevanceScript(0.9, new Map()),
    decisionModel: { provider: "typesafe", model: "jev-latest" },
    session: [],
    turns: [],
  })
  const { context } = fakePiContext(fixture.workingFolder, { hasUI: false, classify })
  await fixture.pi.startSession(context, "startup")
  const calls = fixture.complete.mock.calls.length

  const { message } = await fixture.pi.runTurn(context, "pnpm?")

  expect(message).toBeNull()
  expect(classify).not.toHaveBeenCalled()
  expect(fixture.asked).toEqual([])
  expect(fixture.complete.mock.calls.length).toBe(calls)
})

test("a declined Jev disclosure turns the decision model off for the run and says so once", async () => {
  const classify = vi.fn()
  const fixture = await relevantPiFixture({
    laya: null,
    decisionModel: { provider: "typesafe", model: "jev-latest" },
    session: [],
    turns: [],
  })
  const { context, notifications } = fakePiContext(fixture.workingFolder, {
    hasUI: true,
    classify,
    answers: { confirms: [false] },
  })
  await fixture.pi.startSession(context, "startup")

  await fixture.pi.runTurn(context, "pnpm?")
  const { message } = await fixture.pi.runTurn(context, "pnpm??")

  expect(message).toBeNull()
  expect(classify).not.toHaveBeenCalled()
  expect(notifications.filter((item) => item.message.includes("declined"))).toHaveLength(1)
})

test("a confirmation that could not be shown is told, is not remembered as a decline, and is asked again", async () => {
  const classify = vi.fn().mockResolvedValueOnce(jevReply(0.9)).mockResolvedValueOnce(jevRelevantReply(0.8))
  const fixture = await relevantPiFixture({
    laya: null,
    decisionModel: { provider: "typesafe", model: "jev-latest" },
    session: [],
    turns: [getNote(PNPM), FINISH_WITH_READS],
  })
  await putNote(fixture.vaults.global, "Use pnpm", 1, "Always pnpm.")
  const broken = async () => {
    throw new Error("ui crashed")
  }
  const { context, notifications, prompts } = fakePiContext(fixture.workingFolder, {
    hasUI: true,
    classify,
    answers: { confirms: [broken, true] },
  })
  await fixture.pi.startSession(context, "startup")

  const first = await fixture.pi.runTurn(context, "pnpm?")
  const second = await fixture.pi.runTurn(context, "pnpm again?")

  expect(notifications.filter((item) => item.message.includes("ui crashed"))).toHaveLength(1)
  expect(prompts.filter((prompt) => prompt.kind === "confirm")).toHaveLength(2)
  expect(String(first.message?.content)).toContain("Always pnpm.")
  expect(second.message).toBeNull()
})
