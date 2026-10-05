import Type from "typebox"

import { NoteTypeSchema } from "#/domain"

export const SearchHitSchema = Type.Object({
  id: Type.String(),
  folder: Type.String(),
  statement: Type.String(),
  type: NoteTypeSchema,
  score: Type.Number(),
})
