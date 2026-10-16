import Type from "typebox"

import { SucceedMemoryRequestSchema } from "#src/usecases"

export const MemorySucceedParamsSchema = Type.Object(
  {
    vault: Type.With(SucceedMemoryRequestSchema.properties.vault, {
      description: "global: about the user. project: about this project. The vault the old note was read from.",
    }),
    path: Type.With(SucceedMemoryRequestSchema.properties.path, {
      description: "The old note's path, exactly as read with memory_get.",
    }),
    folder: Type.With(SucceedMemoryRequestSchema.properties.folder, {
      description: "Subject folder of the new note, in English, from general to specific. Reuse a folder that exists.",
    }),
    statement: Type.With(SucceedMemoryRequestSchema.properties.draft.properties.statement, {
      description: "The new note's name, in English: one short statement saying what is true now.",
    }),
    type: Type.With(SucceedMemoryRequestSchema.properties.draft.properties.type, {
      description: "The kind of memory of the new note.",
    }),
    body: Type.With(SucceedMemoryRequestSchema.properties.draft.properties.body, {
      description: "The full detail of the new note, in English. Never empty.",
    }),
    dontForget: Type.With(SucceedMemoryRequestSchema.properties.draft.properties.dontForget, {
      description: "true only when the new note must be loaded in every session.",
    }),
  },
  { additionalProperties: false },
)
