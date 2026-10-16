import { expect, test } from "vitest"

import { findNotes } from "#src/usecases"
import { agentFixture, FINISH_WITH_READS, getNote, retrievalCompletion } from "#test-helpers"

test("the notes it finishes with are the notes it read, as read observations", async () => {
  const { context, request, pnpm, yarn } = await agentFixture()
  const complete = retrievalCompletion([
    { action: "search", vault: "global", query: "pnpm", limit: 5 },
    getNote(pnpm),
    getNote(yarn),
    (input) => ({
      action: "finish",
      notes: input.observations.flatMap((observation) => {
        if (observation.kind !== "read" || observation.path !== pnpm) return []
        return [{ vault: observation.vault, path: observation.path, id: observation.id, hash: observation.hash }]
      }),
    }),
  ])

  const found = await findNotes(request, context, complete)

  expect(found).toMatchObject({ succeeded: true, output: [{ kind: "read", path: pnpm, body: "Always pnpm." }] })
})

test("a model that never finishes ends after the maximum rounds with a notice", async () => {
  const { context, request, pnpm } = await agentFixture()
  const complete = retrievalCompletion(Array.from({ length: 10 }, () => getNote(pnpm)))

  const found = await findNotes(request, context, complete)

  expect(found).toEqual({ succeeded: false, notice: expect.stringContaining("did not finish") })
  expect(complete).toHaveBeenCalledTimes(8)
})

test("a step the schema refuses ends the search with the problems", async () => {
  const { context, request } = await agentFixture()
  const complete = retrievalCompletion([{ action: "get", vault: "global", path: "tools/notes.txt" }])

  const found = await findNotes(request, context, complete)

  expect(found).toEqual({ succeeded: false, notice: expect.stringContaining("could not find memory") })
})

test("a cancelled operation stops the search silently", async () => {
  const { context, request, controller } = await agentFixture()
  const complete = retrievalCompletion([FINISH_WITH_READS])
  controller.abort()

  expect(await findNotes(request, context, complete)).toEqual({ succeeded: false, notice: null })
  expect(complete).not.toHaveBeenCalled()
})
