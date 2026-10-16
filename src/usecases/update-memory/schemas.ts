import Type from "typebox"

import { MemoryDraftSchema, MemoryScopeSchema } from "#src/services"

export const UpdateMemoryRequestSchema = Type.Object(
  {
    vault: MemoryScopeSchema,
    path: Type.String(),
    body: MemoryDraftSchema.properties.body,
    type: Type.Optional(MemoryDraftSchema.properties.type),
    dontForget: Type.Optional(MemoryDraftSchema.properties.dontForget),
  },
  { additionalProperties: false },
)
