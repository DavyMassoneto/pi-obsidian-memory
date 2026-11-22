import { parseUserWordsReply, verifiedUserWords } from "#src/domain"
import { checkStep, completeStep, completionRequest } from "./complete.ts"
import { USER_WORDS_POLICY } from "./constants.ts"
import type { CompletionPort, CompletionRequest, UserWordsRequest, UserWordsStepResult } from "./types.ts"

export function userWordsRequest(request: UserWordsRequest): CompletionRequest {
  const prompt = { system: USER_WORDS_POLICY, data: JSON.stringify({ message: request.check.text }) }
  return { ...completionRequest(request, prompt), thinking: request.thinking }
}

export async function userWordsStep(request: UserWordsRequest, complete: CompletionPort): Promise<UserWordsStepResult> {
  const refused = checkStep(request)
  if (refused) return refused
  const result = await completeStep(userWordsRequest(request), complete)
  if (!result.succeeded) return result
  const passages = parseUserWordsReply(result.output)
  if (!passages.succeeded) return passages
  return { succeeded: true, output: verifiedUserWords(request.check, passages.output) }
}
