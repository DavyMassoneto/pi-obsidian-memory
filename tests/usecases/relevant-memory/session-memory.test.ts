import { expect, test } from "vitest"

import { loadSessionMemory } from "#src/usecases"
import {
  FINISH_WITH_READS,
  firstRetrievalInput,
  getNote,
  putDontForget,
  putNote,
  relevantFixture,
  retrievalCompletion,
  retrievedText,
} from "#test-helpers"

test("the notes the memory agent finds are added within the budget and remembered", async () => {
  const fixture = await relevantFixture({ laya: null, budgetChars: 90 })
  const pnpm = await putNote(fixture.vault, "Use pnpm", 1, "Always pnpm.")
  const yarn = await putNote(fixture.vault, "Use yarn", 2, "Yarn for the old repo, with a long explanation.")
  const complete = retrievalCompletion([getNote(pnpm), getNote(yarn), FINISH_WITH_READS])

  const result = await loadSessionMemory(fixture.context, { complete, loaded: fixture.loaded })

  const text = retrievedText(result)
  expect(text).toContain("only part of your memory")
  expect(text).toContain("Use pnpm")
  expect(text).not.toContain("Use yarn")
  expect(fixture.loaded.all().map((note) => note.path)).toEqual([pnpm])
})

test("a Don't forget note is left to its own section and costs no budget", async () => {
  const fixture = await relevantFixture({ laya: null })
  const never = await putDontForget(fixture.vault, "Never rm", 1, "Never rm -rf.")
  const pnpm = await putNote(fixture.vault, "Use pnpm", 2, "Always pnpm.")
  const complete = retrievalCompletion([getNote(never), getNote(pnpm), FINISH_WITH_READS])

  const result = await loadSessionMemory(fixture.context, { complete, loaded: fixture.loaded })

  const text = retrievedText(result)
  expect(text).toContain("Use pnpm")
  expect(text).not.toContain("Never rm")
  expect(fixture.loaded.all().map((note) => note.path)).toEqual([pnpm])
})

test("the memory agent is asked for the project and the folder", async () => {
  const fixture = await relevantFixture({ laya: null })
  const complete = retrievalCompletion([FINISH_WITH_READS])

  await loadSessionMemory(fixture.context, { complete, loaded: fixture.loaded })

  const input = firstRetrievalInput(complete)
  expect(input.context).toEqual({ project: "loja-vault", folder: fixture.context.workingFolder })
  expect(input.query).toContain("loja-vault")
})

test("a memory agent that fails gives a text that says the notes could not be loaded, and one notice", async () => {
  const fixture = await relevantFixture({ laya: null })
  const complete = retrievalCompletion([{ action: "get", vault: "global", path: "tools/notes.txt" }])

  const result = await loadSessionMemory(fixture.context, { complete, loaded: fixture.loaded })

  expect(result).toMatchObject({
    succeeded: true,
    output: {
      text: expect.stringContaining("could not be loaded"),
      notices: [expect.stringContaining("could not be loaded")],
    },
  })
})

test("a cancelled operation is a refusal, not a load failure", async () => {
  const fixture = await relevantFixture({ laya: null })
  fixture.controller.abort()

  const result = await loadSessionMemory(fixture.context, {
    complete: retrievalCompletion([]),
    loaded: fixture.loaded,
  })

  expect(result).toMatchObject({ succeeded: false })
})
