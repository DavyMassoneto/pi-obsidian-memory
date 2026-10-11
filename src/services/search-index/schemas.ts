import Type from "typebox"

import { NoteIdSchema, NoteTypeSchema } from "#/domain"

export const SearchHitSchema = Type.Object(
  {
    id: NoteIdSchema,
    folder: Type.String(),
    statement: Type.String(),
    type: NoteTypeSchema,
    score: Type.Number(),
  },
  { additionalProperties: false },
)

export const IndexEntrySchema = Type.Object(
  {
    id: NoteIdSchema,
    folder: Type.String(),
    statement: Type.String(),
    body: Type.String(),
    type: NoteTypeSchema,
    dontForget: Type.Boolean(),
    archived: Type.Boolean(),
    size: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
    modifiedMs: Type.Number(),
    hash: Type.String(),
  },
  { additionalProperties: false },
)

export const SearchOptionsSchema = Type.Object(
  {
    limit: Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
    includeArchived: Type.Boolean(),
  },
  { additionalProperties: false },
)
