import { Value } from "typebox/value"

import { describeSchemaErrors } from "#src/domain/validation"
import { RetrievalInputSchema } from "./schemas.ts"
import type { RetrievalInput } from "./types.ts"

export function retrievalInputProblems(input: RetrievalInput): string[] {
  return describeSchemaErrors(Value.Errors(RetrievalInputSchema, input), "retrieval input")
}
