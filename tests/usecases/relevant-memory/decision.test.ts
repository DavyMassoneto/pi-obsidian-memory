import { expect, onTestFinished, test, vi } from "vitest"

import { decisionContextOf, decisionNotice, needsMemory, rankNotes } from "#src/usecases"
import {
  decisionServer,
  failingFor,
  jevReply,
  layaLimits,
  layaModel,
  readNoteFor,
  relevanceScript,
  relevantFixture,
} from "#test-helpers"

test("Laya's settings come from the config and need no Jev", async () => {
  const fixture = await relevantFixture({ laya: relevanceScript(0.9, new Map()) })
  const jev = vi.fn(fixture.unavailable)

  const context = await decisionContextOf(fixture.config.decisionModel, await layaLimits(fixture), jev)

  expect(context).toMatchObject({ provider: "laya", model: "multilingual", maxTokens: 8192, headMaxTokens: 192 })
  expect(jev).not.toHaveBeenCalled()
})

test("Jev uses the classifier it was given", async () => {
  const fixture = await relevantFixture({ laya: null })
  const classify = vi.fn().mockResolvedValue(jevReply(0.7))

  const context = await decisionContextOf(
    { provider: "typesafe", model: "jev-latest" },
    await layaLimits(fixture),
    async () => ({ available: true, classifier: { classify } }),
  )

  expect(context).toMatchObject({ provider: "typesafe", model: "jev-latest" })
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
  const ranked = await rankNotes(
    context,
    "message",
    [readNoteFor("a", 1), readNoteFor("b", 2), readNoteFor("c", 3)],
    0.5,
  )

  expect(ranked).toEqual({ notes: [readNoteFor("b", 2), readNoteFor("a", 1)], notice: null })
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

const SCORES = new Map([
  ["a", 0.9],
  ["b", 0.7],
  ["c", 0.9],
])

test("a note that fails to score is dropped on its own, the others are ranked, and the notice counts it", async () => {
  const fixture = await relevantFixture({ laya: failingFor(relevanceScript(0.9, SCORES), ["c"]) })
  const context = await decisionContextOf(fixture.config.decisionModel, await layaLimits(fixture), fixture.unavailable)
  if (typeof context === "string") throw new Error(context)

  const ranked = await rankNotes(
    context,
    "message",
    [readNoteFor("a", 1), readNoteFor("b", 2), readNoteFor("c", 3)],
    0.5,
  )

  expect(ranked.notes).toEqual([readNoteFor("a", 1), readNoteFor("b", 2)])
  expect(ranked.notice).toBe("The decision model could not score 1 of 3 notes")
})

test("when every note fails to score the whole ranking fails with the reason", async () => {
  const server = await decisionServer({ body: "", status: 503, delayMs: 0 })
  onTestFinished(() => server.close())
  const fixture = await relevantFixture({ laya: null, decisionModel: layaModel(server.context.endpoint) })
  const context = await decisionContextOf(fixture.config.decisionModel, await layaLimits(fixture), fixture.unavailable)
  if (typeof context === "string") throw new Error(context)

  const ranked = await rankNotes(context, "message", [readNoteFor("a", 1), readNoteFor("b", 2)], 0.5)

  expect(ranked).toEqual({ notes: [], notice: expect.stringContaining("http-error (HTTP 503)") })
})

test("the cutoff given decides which notes are kept", async () => {
  const fixture = await relevantFixture({ laya: relevanceScript(0.9, SCORES) })
  const context = await decisionContextOf(fixture.config.decisionModel, await layaLimits(fixture), fixture.unavailable)
  if (typeof context === "string") throw new Error(context)

  const ranked = await rankNotes(
    context,
    "message",
    [readNoteFor("a", 1), readNoteFor("b", 2), readNoteFor("c", 3)],
    0.8,
  )

  expect(ranked.notes.map((note) => note.statement)).toEqual(["a", "c"])
})

test("a server that rejects the request with 422 is named with its status and its own detail", async () => {
  const server = await decisionServer({ body: '{"detail":"labels are not supported"}', status: 422, delayMs: 0 })
  onTestFinished(() => server.close())
  const fixture = await relevantFixture({ laya: null, decisionModel: layaModel(server.context.endpoint) })
  const context = await decisionContextOf(fixture.config.decisionModel, await layaLimits(fixture), fixture.unavailable)
  if (typeof context === "string") throw new Error(context)

  const result = await needsMemory(context, "message", null, "folder")

  expect(decisionNotice(result)).toContain("http-error (HTTP 422): labels are not supported")
  expect(decisionNotice(result)).not.toContain("too old")
})
