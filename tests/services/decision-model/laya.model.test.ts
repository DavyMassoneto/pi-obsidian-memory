import { expect, test } from "vitest"

import { decideMemory, scoreCandidate, scoreCandidates } from "#src/services"
import {
  candidateDecisionRequest,
  layaServerUnavailableReason,
  liveLayaContext,
  liveLayaContextWithTokens,
  memoryDecisionRequest,
} from "#test-helpers"

const unavailable = await layaServerUnavailableReason()

test("the real client gets a probability for the memory gate from a live laya-serve", async (context) => {
  if (unavailable) return context.skip(unavailable)
  const result = await decideMemory({ context: liveLayaContext(), request: memoryDecisionRequest })
  expect(result).toMatchObject({
    succeeded: true,
    output: { diagnostics: { provider: "laya", reportedModel: "multilingual" } },
  })
  if (!result.succeeded) return
  expect(result.output.probability).toBeGreaterThanOrEqual(0)
  expect(result.output.probability).toBeLessThanOrEqual(1)
})

test("the real client scores one candidate and a batch of candidates with matching diagnostics", async (context) => {
  if (unavailable) return context.skip(unavailable)
  const single = await scoreCandidate({ context: liveLayaContext(), request: candidateDecisionRequest })
  const unrelated = { ...candidateDecisionRequest, message: "What is the capital of Australia?" }
  const batch = await scoreCandidates(liveLayaContext(), [candidateDecisionRequest, unrelated])
  expect(single.succeeded).toBe(true)
  expect(batch).toHaveLength(2)
  expect(batch).toMatchObject([
    { succeeded: true, output: { diagnostics: { reportedModel: "multilingual" } } },
    { succeeded: true, output: { diagnostics: { reportedModel: "multilingual" } } },
  ])
  const [first] = batch
  if (!single.succeeded || !first?.succeeded) return
  expect(first.output.probability).toBeCloseTo(single.output.probability, 2)
})

test("a state longer than the token budget still yields a score from its start", async (context) => {
  if (unavailable) return context.skip(unavailable)
  const request = { ...memoryDecisionRequest, message: `${memoryDecisionRequest.message} ${"filler ".repeat(4000)}` }
  const result = await decideMemory({
    context: liveLayaContextWithTokens(512, 192),
    request,
  })
  expect(result).toMatchObject({ succeeded: true })
})
