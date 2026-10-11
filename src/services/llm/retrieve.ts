import { Value } from "typebox/value"

import { parseRetrievalAction, RetrievalActionSchema, RetrievalInputSchema, type RetrievalResult } from "#/domain"
import { checkStep, completeStep, completionRequest } from "./complete.ts"
import { DATA_POLICY, MAX_RETRIEVAL_DURATION_MS, RETRIEVAL_POLICY } from "./constants.ts"
import type { CompletionPort, RetrievalRequest } from "./types.ts"

export async function retrieveStep(request: RetrievalRequest, complete: CompletionPort): Promise<RetrievalResult> {
  const { context, query, observations } = request
  const input = { context, query, observations }
  if (!Value.Check(RetrievalInputSchema, input)) return { succeeded: false, problems: ["Invalid retrieval input"] }
  const snapshot = structuredClone(input)
  const data = JSON.stringify(snapshot)
  const problems = checkStep(request, data)
  if (problems.length > 0) return { succeeded: false, problems }
  const system = `${DATA_POLICY}\n${RETRIEVAL_POLICY}\nAction schema: ${JSON.stringify(RetrievalActionSchema)}`
  const result = await completeStep(completionRequest(request, { system, data }), complete, MAX_RETRIEVAL_DURATION_MS)
  if (!result.succeeded) return result
  return parseRetrievalAction(result.output, snapshot)
}
