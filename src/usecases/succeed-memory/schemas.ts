import Type from "typebox"

import { MemoryDraftSchema, MemoryScopeSchema } from "#src/services"

export const SucceedMemoryRequestSchema = Type.Object(
  {
    vault: MemoryScopeSchema,
    path: Type.String(),
    folder: Type.String(),
    draft: MemoryDraftSchema,
  },
  { additionalProperties: false },
)
