import { parseRetrievalAction, RetrievalActionSchema, retrievalInputProblems } from "#src/domain"
import { checkStep, completeStep, completionRequest, modelCallFailure } from "./complete.ts"
import { DATA_POLICY, RETRIEVAL_POLICY } from "./constants.ts"
import type { CompletionPort, RetrievalRequest, RetrievalStepResult } from "./types.ts"

export async function retrieveStep(request: RetrievalRequest, complete: CompletionPort): Promise<RetrievalStepResult> {
  const { context, query, observations } = request
  const input = { context, query, observations }
  const problems = retrievalInputProblems(input)
  if (problems.length > 0) return modelCallFailure(`Invalid retrieval input: ${problems.join("; ")}`)
  const snapshot = structuredClone(input)
  const data = JSON.stringify(snapshot)
  const refused = checkStep(request)
  if (refused) return refused
  const system = `${DATA_POLICY}\n${RETRIEVAL_POLICY}\nAction schema: ${JSON.stringify(RetrievalActionSchema)}`
  const result = await completeStep(completionRequest(request, { system, data }), complete)
  if (!result.succeeded) return result
  return parseRetrievalAction(result.output, snapshot)
}
