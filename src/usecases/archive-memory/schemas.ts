import Type from "typebox"

import { MemoryScopeSchema } from "#src/services"

export const ArchiveMemoryRequestSchema = Type.Object(
  {
    vault: MemoryScopeSchema,
    path: Type.String(),
  },
  { additionalProperties: false },
)
