import { expect, test, vi } from "vitest"

import {
  FINISH_WITH_READS,
  fakePiContext,
  getNote,
  jevRelevantReply,
  jevReply,
  putNote,
  relevantPiFixture,
} from "#test-helpers"

const PNPM = "tools/Use pnpm.md"

test.each([true, false])(
  "Jev decides and scores through pi's classifier without asking anything (UI: %s)",
  async (hasUI) => {
    const classify = vi.fn().mockResolvedValueOnce(jevReply(0.9)).mockResolvedValueOnce(jevRelevantReply(0.8))
    const fixture = await relevantPiFixture({
      laya: null,
      decisionModel: { provider: "typesafe", model: "jev-latest" },
      session: [],
      turns: [getNote(PNPM), FINISH_WITH_READS],
    })
    await putNote(fixture.vaults.global, "Use pnpm", 1, "Always pnpm.")
    const { context, prompts } = fakePiContext(fixture.workingFolder, { hasUI, classify })

    await fixture.pi.startSession(context, "startup")
    const { message } = await fixture.pi.runTurn(context, "pnpm?")

    expect(prompts).toEqual([])
    expect(String(message?.content)).toContain("Always pnpm.")
    expect(classify).toHaveBeenCalledTimes(2)
  },
)

test("a pi without the Jev model says so once and adds nothing, never using another model", async () => {
  const fixture = await relevantPiFixture({
    laya: null,
    decisionModel: { provider: "typesafe", model: "jev-latest" },
    session: [],
    turns: [],
  })
  const { context, notifications } = fakePiContext(fixture.workingFolder, { hasUI: true })
  await fixture.pi.startSession(context, "startup")

  const first = await fixture.pi.runTurn(context, "pnpm?")
  await fixture.pi.runTurn(context, "pnpm??")

  expect(first.message).toBeNull()
  expect(notifications.filter((item) => item.message.includes("no Jev model"))).toHaveLength(1)
})
