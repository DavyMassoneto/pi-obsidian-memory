import Type from "typebox"

import { MemoryDraftSchema, MemoryScopeSchema } from "#src/services"

export const CompleteBlankMemoryRequestSchema = Type.Object(
  {
    vault: MemoryScopeSchema,
    path: Type.String(),
    expectedHash: Type.String(),
    type: MemoryDraftSchema.properties.type,
    body: MemoryDraftSchema.properties.body,
  },
  { additionalProperties: false },
)
