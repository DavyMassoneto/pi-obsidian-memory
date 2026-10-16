import { Value } from "typebox/value"

import type { DecisionDiagnostics, DecisionFailure } from "#src/domain"
import { maxDecisionResponseBytes } from "./constants.ts"
import { boundedFailureDetail } from "./failure-detail.ts"
import { readBoundedText } from "./laya-response.ts"
import { LayaHttpDetailSchema } from "./schemas.ts"

async function serverDetail(response: Response): Promise<string> {
  if (response.status !== 422) {
    await response.body?.cancel()
    return ""
  }
  const text = await readBoundedText(response, maxDecisionResponseBytes)
  if (typeof text !== "string") return ""
  try {
    const parsed = JSON.parse(text)
    if (!Value.Check(LayaHttpDetailSchema, parsed)) return ""
    return boundedFailureDetail(parsed.detail)
  } catch {
    return ""
  }
}

function httpFailure(status: number, detail: string, diagnostics: DecisionDiagnostics): DecisionFailure {
  const failure: DecisionFailure = { succeeded: false, code: "http-error", httpStatus: status, diagnostics }
  if (detail) failure.detail = detail
  return failure
}

export async function layaHttpFailure(response: Response, diagnostics: DecisionDiagnostics): Promise<DecisionFailure> {
  return httpFailure(response.status, await serverDetail(response), diagnostics)
}

export async function layaHttpFailures(
  response: Response,
  diagnostics: DecisionDiagnostics[],
): Promise<DecisionFailure[]> {
  const detail = await serverDetail(response)
  return diagnostics.map((item) => httpFailure(response.status, detail, item))
}
