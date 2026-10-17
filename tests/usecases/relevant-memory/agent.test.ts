import { expect, test, vi } from "vitest"

import type { CompletionPort } from "#src/services"
import { findNotes } from "#src/usecases"
import { agentFixture, FINISH_WITH_READS, getNote, retrievalCompletion, secondInput } from "#test-helpers"

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

test("a model that keeps reading for many rounds is not cut off and ends when it finishes", async () => {
  const { context, request, pnpm } = await agentFixture()
  const complete = retrievalCompletion([...Array.from({ length: 12 }, () => getNote(pnpm)), FINISH_WITH_READS])

  const found = await findNotes(request, context, complete)

  expect(found.succeeded).toBe(true)
  expect(complete).toHaveBeenCalledTimes(13)
})

test("a model that keeps being refused is asked again with no cap, until it finishes", async () => {
  const { context, request, pnpm } = await agentFixture()
  const refused = { action: "get", vault: "global", path: "tools/notes.txt" } as const
  const complete = retrievalCompletion([...Array.from({ length: 30 }, () => refused), getNote(pnpm), FINISH_WITH_READS])

  const found = await findNotes(request, context, complete)

  expect(found).toMatchObject({ succeeded: true, output: [{ kind: "read", path: pnpm }] })
  expect(complete).toHaveBeenCalledTimes(32)
})

test("a failed model call ends the search at once with a notice that names the provider's error", async () => {
  const { context, request } = await agentFixture()
  const complete = vi.fn(async () => ({ status: "error" as const, error: "provider down" }))

  const found = await findNotes(request, context, complete)

  expect(found).toEqual({
    succeeded: false,
    notice: expect.stringMatching(/could not find memory:.*provider down/),
  })
  expect(complete).toHaveBeenCalledTimes(1)
})

test("a refused step goes back to the model as an observation and costs exactly one more call", async () => {
  const { context, request, pnpm } = await agentFixture()
  const complete = retrievalCompletion([
    { action: "get", vault: "global", path: "tools/notes.txt" },
    getNote(pnpm),
    FINISH_WITH_READS,
  ])

  const found = await findNotes(request, context, complete)

  expect(found).toMatchObject({ succeeded: true, output: [{ kind: "read", path: pnpm }] })
  expect(complete).toHaveBeenCalledTimes(3)
  expect(secondInput(complete).observations).toEqual([
    { kind: "refused", action: "unparseable", problems: [expect.stringContaining(".md")] },
  ])
})

test("a reply that is not an action is a refusal too and the model is asked again", async () => {
  const { context, request } = await agentFixture()
  const complete = vi
    .fn<CompletionPort>()
    .mockResolvedValueOnce({ status: "completed", text: "not json at all" })
    .mockResolvedValueOnce({ status: "completed", text: JSON.stringify({ action: "finish", notes: [] }) })

  const found = await findNotes(request, context, complete)

  expect(found).toEqual({ succeeded: true, output: [] })
  expect(complete).toHaveBeenCalledTimes(2)
  expect(secondInput(complete).observations).toEqual([
    { kind: "refused", action: "unparseable", problems: [expect.any(String)] },
  ])
})

test("in a folder with no project an agent that asks for the project vault is refused, then searches global, with no notice", async () => {
  const { context, request, pnpm } = await agentFixture()
  const noProject = { ...request, agent: { project: null, folder: request.agent.folder } }
  const complete = retrievalCompletion([
    { action: "search", vault: "project", query: "pnpm", limit: 5 },
    { action: "search", vault: "global", query: "pnpm", limit: 5 },
    getNote(pnpm),
    FINISH_WITH_READS,
  ])

  const found = await findNotes(noProject, context, complete)

  expect(found).toMatchObject({ succeeded: true, output: [{ kind: "read", path: pnpm }] })
  expect(complete).toHaveBeenCalledTimes(4)
  expect(secondInput(complete).observations).toEqual([
    { kind: "refused", action: "unparseable", problems: ["Project vault is unavailable"] },
  ])
})

test("the model is told that only the global vault exists when there is no project", async () => {
  const { context, request } = await agentFixture()
  const noProject = { ...request, agent: { project: null, folder: request.agent.folder } }
  const complete = retrievalCompletion([FINISH_WITH_READS])

  await findNotes(noProject, context, complete)

  expect(complete.mock.calls[0]?.[0].system).toContain("When context.project is null only the global vault exists")
})

test("a cancelled operation stops the search silently", async () => {
  const { context, request, controller } = await agentFixture()
  const complete = retrievalCompletion([FINISH_WITH_READS])
  controller.abort()

  expect(await findNotes(request, context, complete)).toEqual({ succeeded: false, notice: null })
  expect(complete).not.toHaveBeenCalled()
})
