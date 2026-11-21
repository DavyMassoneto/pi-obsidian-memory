import { Value } from "typebox/value"

import { SHELL_EDIT_QUESTIONS } from "#src/domain"
import { answeredByRequestedModel, defaultJevModel } from "#src/services/decision-model"
import { JevOutcomeSchema, ShellEditAnswersSchema } from "./schemas.ts"
import type { ShellEditAskCall, ShellEditAskResult, ShellEditClassifierResult } from "./types.ts"

export async function askShellEdit(call: ShellEditAskCall): Promise<ShellEditAskResult> {
  if (call.signal.aborted) return failed("cancelled")
  const outcome = await classified(call)
  if (typeof outcome === "string") return failed(outcome)
  if (call.signal.aborted) return failed("cancelled")
  if (!Value.Check(JevOutcomeSchema, outcome)) return failed("Jev returned an answer of another shape")
  if (outcome.stopReason === "aborted") return failed("cancelled")
  if (outcome.stopReason === "error") return failed(errorText(outcome.errorMessage))
  if (!answeredByRequestedModel(defaultJevModel, outcome.model)) {
    return failed(`answered by ${outcome.model}, not ${defaultJevModel}`)
  }
  if (!Value.Check(ShellEditAnswersSchema, outcome)) {
    return failed("Jev did not answer every question with a yes/no probability")
  }
  const { answers } = outcome
  const scores = {
    redirection: answers.redirection.probability,
    in_place: answers.in_place.probability,
    inline_code: answers.inline_code.probability,
    script_writes: answers.script_writes.probability,
    copy_download: answers.copy_download.probability,
    hardlink: answers.hardlink.probability,
  }
  return { succeeded: true, output: { scores, reportedModel: outcome.model } }
}

async function classified(call: ShellEditAskCall): Promise<ShellEditClassifierResult | string> {
  try {
    return await call.classifier.classify({
      model: { provider: "typesafe", id: defaultJevModel },
      context: { state: call.state, questions: SHELL_EDIT_QUESTIONS },
      options: { signal: call.signal, maxRetries: 0 },
    })
  } catch (error) {
    return `the call to Jev failed: ${String(error)}`
  }
}

function errorText(message: string | undefined): string {
  if (typeof message === "string") return `Jev reported an error: ${message}`
  return "Jev reported an error"
}

function failed(cause: string): ShellEditAskResult {
  return { succeeded: false, problems: [cause] }
}
