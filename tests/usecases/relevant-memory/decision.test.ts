import { expect, test, vi } from "vitest"

import { decisionContextOf, decisionNotice, needsMemory, rankNotes } from "#src/usecases"
import { jevReply, layaLimits, relevanceScript, relevantFixture } from "#test-helpers"

test("Laya's settings come from the config and need no Jev", async () => {
  const fixture = await relevantFixture({ laya: relevanceScript(0.9, new Map()) })
  const jev = vi.fn(fixture.unavailable)

  const context = await decisionContextOf(fixture.config.decisionModel, await layaLimits(fixture), jev)

  expect(context).toMatchObject({ provider: "laya", model: "multilingual", maxTokens: 8192, headMaxTokens: 192 })
  expect(jev).not.toHaveBeenCalled()
})

test("Jev uses the classifier it was given and the consent it was confirmed with", async () => {
  const fixture = await relevantFixture({ laya: null })
  const classify = vi.fn().mockResolvedValue(jevReply(0.7))

  const context = await decisionContextOf(
    { provider: "typesafe", model: "jev-latest" },
    await layaLimits(fixture),
    async () => ({ available: true, classifier: { classify } }),
  )

  expect(context).toMatchObject({ provider: "typesafe", model: "jev-latest", consent: "messages-and-candidates" })
})

test("a Jev that was not confirmed is a reason, never another model", async () => {
  const fixture = await relevantFixture({ laya: null })

  const context = await decisionContextOf(
    { provider: "typesafe", model: "jev-latest" },
    await layaLimits(fixture),
    fixture.unavailable,
  )

  expect(context).toEqual(expect.stringContaining("no Jev in this test"))
})

test("only notes scored at 0.5 or more are kept, best first", async () => {
  const fixture = await relevantFixture({
    laya: relevanceScript(
      0.9,
      new Map([
        ["a", 0.5],
        ["b", 0.9],
        ["c", 0.49],
      ]),
    ),
  })
  const context = await decisionContextOf(fixture.config.decisionModel, await layaLimits(fixture), fixture.unavailable)
  if (typeof context === "string") throw new Error(context)
  const note = (statement: string, number: number) => ({
    kind: "read" as const,
    vault: "global" as const,
    path: `${statement}.md`,
    id: `01JABCDE7XKQ2M9V3RTN8WPZ0${number}`,
    hash: String(number).repeat(64),
    statement,
    body: "body",
    type: "rule" as const,
    dontForget: false,
  })

  const ranked = await rankNotes(context, "message", [note("a", 1), note("b", 2), note("c", 3)])

  expect(ranked).toEqual({ notes: [note("b", 2), note("a", 1)], notice: null })
})

test("a decision that failed becomes a notice with its code", async () => {
  const fixture = await relevantFixture({ laya: relevanceScript(0.9, new Map()) })
  const context = await decisionContextOf(
    fixture.config.decisionModel,
    { deadlineMs: Date.now() - 1, signal: fixture.context.signal },
    fixture.unavailable,
  )
  if (typeof context === "string") throw new Error(context)

  const result = await needsMemory(context, "message", null, "folder")

  expect(decisionNotice(result)).toContain("deadline")
})
