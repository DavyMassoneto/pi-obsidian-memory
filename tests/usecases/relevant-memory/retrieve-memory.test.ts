import { expect, onTestFinished, test, vi } from "vitest"

import { retrieveMemory } from "#src/usecases"
import {
  decisionServer,
  FINISH_WITH_READS,
  getNote,
  jevRelevantReply,
  jevReply,
  putDontForget,
  putNote,
  relevanceScript,
  relevantFixture,
  retrievalCompletion,
  retrievedText,
  threeNotes,
} from "#test-helpers"

const RANKED = relevanceScript(
  0.9,
  new Map([
    ["Use pnpm", 0.9],
    ["Use yarn", 0.6],
    ["Use npm", 0.2],
  ]),
)

test("a message that needs no memory adds nothing and never starts the memory agent", async () => {
  const fixture = await relevantFixture({ laya: relevanceScript(0.05, new Map()) })
  const complete = retrievalCompletion([])

  const result = await retrieveMemory({ message: "thanks" }, fixture.context, {
    complete,
    jev: fixture.unavailable,
    loaded: fixture.loaded,
  })

  expect(result).toMatchObject({ succeeded: true, output: { text: null, notices: [] } })
  expect(complete).not.toHaveBeenCalled()
  expect(fixture.asked.map((ask) => ask.question)).toEqual(["needed"])
})

test("only the ranked notes are added, best first, with a note that this is part of the memory", async () => {
  const fixture = await relevantFixture({ laya: RANKED })
  const complete = retrievalCompletion(await threeNotes(fixture))

  const result = await retrieveMemory({ message: "which package manager?" }, fixture.context, {
    complete,
    jev: fixture.unavailable,
    loaded: fixture.loaded,
  })

  const text = retrievedText(result)
  expect(text).toContain("only part of your memory")
  expect(text).toContain("memory_search")
  expect(text).toContain("memory_get")
  expect(text).toContain("Use pnpm")
  expect(text.indexOf("Use yarn")).toBeGreaterThan(text.indexOf("Use pnpm"))
  expect(text).not.toContain("Plain npm")
  expect(fixture.loaded.all().map((note) => note.path)).toEqual(["tools/Use pnpm.md", "tools/Use yarn.md"])
})

test("a note already loaded is not added again", async () => {
  const fixture = await relevantFixture({ laya: RANKED })
  const deps = { jev: fixture.unavailable, loaded: fixture.loaded }
  await retrieveMemory({ message: "one" }, fixture.context, {
    ...deps,
    complete: retrievalCompletion(await threeNotes(fixture)),
  })

  const second = await retrieveMemory({ message: "two" }, fixture.context, {
    ...deps,
    complete: retrievalCompletion([getNote("tools/Use pnpm.md"), FINISH_WITH_READS]),
  })

  expect(second).toMatchObject({ succeeded: true, output: { text: null, notices: [] } })
})

test("the budget cuts the notes and a Don't forget note is never added", async () => {
  const script = relevanceScript(
    0.9,
    new Map([
      ["Use pnpm", 0.9],
      ["Use yarn", 0.8],
      ["Never rm", 0.95],
    ]),
  )
  const fixture = await relevantFixture({ laya: script, budgetChars: 90 })
  const pnpm = await putNote(fixture.vault, "Use pnpm", 1, "Always pnpm.")
  const yarn = await putNote(fixture.vault, "Use yarn", 2, "Yarn for the old repo, with a long explanation.")
  const never = await putDontForget(fixture.vault, "Never rm", 3, "Never rm -rf.")
  const complete = retrievalCompletion([getNote(never), getNote(pnpm), getNote(yarn), FINISH_WITH_READS])

  const result = await retrieveMemory({ message: "clean up" }, fixture.context, {
    complete,
    jev: fixture.unavailable,
    loaded: fixture.loaded,
  })

  const text = retrievedText(result)
  expect(text).toContain("Use pnpm")
  expect(text).not.toContain("Use yarn")
  expect(text).not.toContain("Never rm")
})

test("an unavailable Laya adds nothing, says so, and never falls back to another model", async () => {
  const server = await decisionServer({ body: "", status: 503, delayMs: 0 })
  onTestFinished(() => server.close())
  const fixture = await relevantFixture({ laya: null, endpoint: server.context.endpoint })
  const complete = retrievalCompletion([])
  const jev = vi.fn(fixture.unavailable)

  const result = await retrieveMemory({ message: "pnpm?" }, fixture.context, { complete, jev, loaded: fixture.loaded })

  expect(result).toMatchObject({
    succeeded: true,
    output: { text: null, notices: [expect.stringContaining("http-error")] },
  })
  expect(complete).not.toHaveBeenCalled()
  expect(jev).not.toHaveBeenCalled()
})

test("Jev without a confirmation adds nothing and says why", async () => {
  const fixture = await relevantFixture({ laya: null, decisionModel: { provider: "typesafe", model: "jev-latest" } })
  const complete = retrievalCompletion([])

  const result = await retrieveMemory({ message: "pnpm?" }, fixture.context, {
    complete,
    jev: fixture.unavailable,
    loaded: fixture.loaded,
  })

  expect(result).toMatchObject({
    succeeded: true,
    output: { text: null, notices: [expect.stringContaining("no Jev in this test")] },
  })
  expect(complete).not.toHaveBeenCalled()
})

test("Jev decides and scores through its classifier", async () => {
  const fixture = await relevantFixture({ laya: null, decisionModel: { provider: "typesafe", model: "jev-latest" } })
  const pnpm = await putNote(fixture.vault, "Use pnpm", 1, "Always pnpm.")
  const classify = vi.fn().mockResolvedValueOnce(jevReply(0.9)).mockResolvedValueOnce(jevRelevantReply(0.8))
  const complete = retrievalCompletion([getNote(pnpm), FINISH_WITH_READS])

  const result = await retrieveMemory({ message: "pnpm?" }, fixture.context, {
    complete,
    jev: async () => ({ available: true, classifier: { classify } }),
    loaded: fixture.loaded,
  })

  expect(retrievedText(result)).toContain("Always pnpm.")
  expect(classify).toHaveBeenCalledTimes(2)
})
