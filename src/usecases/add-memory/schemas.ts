import Type from "typebox"

import { MemoryDraftSchema, MemoryScopeSchema } from "#/services"

export const AddMemoryRequestSchema = Type.Object(
  {
    scope: MemoryScopeSchema,
    folder: Type.String(),
    draft: MemoryDraftSchema,
  },
  { additionalProperties: false },
)
