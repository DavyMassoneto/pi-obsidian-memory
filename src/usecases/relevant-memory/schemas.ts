import Type from "typebox"

import { BLANK_NOTE_TYPES } from "#src/usecases/complete-blank-memory"

export const StoredNoteSchema = Type.Object({
  kind: Type.Literal("read"),
  vault: Type.Enum(["global", "project"]),
  path: Type.String(),
  id: Type.String(),
  hash: Type.String(),
  statement: Type.String(),
  body: Type.String(),
  type: Type.Enum(BLANK_NOTE_TYPES),
  dontForget: Type.Boolean(),
})

export const LoadedChangesSchema = Type.Object({
  loaded: Type.Array(StoredNoteSchema),
  forgotten: Type.Array(StoredNoteSchema),
})
