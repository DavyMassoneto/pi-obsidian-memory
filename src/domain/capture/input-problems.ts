import { Value } from "typebox/value"

import { describeSchemaErrors } from "#src/domain/validation"
import { CaptureInputSchema } from "./schemas.ts"
import type { CaptureInput } from "./types.ts"

export function captureInputProblems(input: CaptureInput): string[] {
  return describeSchemaErrors(Value.Errors(CaptureInputSchema, input), "capture input")
}
