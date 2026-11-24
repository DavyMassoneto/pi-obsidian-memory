import { expect, test } from "vitest"

import { type RetrievalRequest, retrieveStep } from "#src/services"
import { loadDontForget, observeList, observeSearch } from "#src/usecases"
import {
  memoryReadFixture,
  OMNIROUTE_RETRIEVAL_MODEL,
  observeRetrievalAction,
  omnirouteRetrievalCompletion,
  putNote,
} from "#test-helpers"

test("the live session model batches independent gets and finishes by read index", async () => {
  const { context, vault } = await memoryReadFixture()
  const approval = await putNote(vault, "Get a production deployment approval", 1, "Ask the release lead to approve.")
  const rollback = await putNote(vault, "Roll back a failed production deployment", 2, "Restore the last signed build.")
  await putNote(vault, "Choose an editor theme", 3, "Use the dark theme.")
  expect((await loadDontForget(context)).succeeded).toBe(true)
  const found = await observeSearch("global", "production deployment", context)
  const listing = await observeList("global", "tools", context)
  expect(found.kind).toBe("search")
  expect(listing.kind).toBe("listing")
  const request: RetrievalRequest = {
    context: { project: null, folder: context.workingFolder },
    query: "What approval is required for a production deployment and how do we roll it back if it fails?",
    observations: [found, listing],
    model: OMNIROUTE_RETRIEVAL_MODEL,
    signal: context.signal,
  }
  const complete = await omnirouteRetrievalCompletion()

  const batch = await retrieveStep(request, complete)
  expect(batch).toEqual({
    succeeded: true,
    output: {
      actions: expect.arrayContaining([
        { action: "get", vault: "global", path: approval },
        { action: "get", vault: "global", path: rollback },
      ]),
    },
  })
  if (!batch.succeeded || !("actions" in batch.output)) throw new Error("Expected a read batch")
  for (const action of batch.output.actions) request.observations.push(await observeRetrievalAction(action, context))
  const indices = [approval, rollback].map((path) =>
    request.observations.findLastIndex((entry) => entry.kind === "read" && entry.path === path),
  )
  for (const index of indices) expect(index).toBeGreaterThan(1)

  const finish = await retrieveStep(request, complete)
  expect(finish).toEqual({ succeeded: true, output: { action: "finish", notes: expect.arrayContaining(indices) } })
})
