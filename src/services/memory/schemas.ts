import Type from "typebox"

import { NoteTypeSchema } from "#/domain"

export const MemoryScopeSchema = Type.Enum(["global", "project"])

export const MemoryDraftSchema = Type.Object(
  {
    statement: Type.String(),
    type: NoteTypeSchema,
    body: Type.String(),
    dontForget: Type.Boolean(),
  },
  { additionalProperties: false },
)
