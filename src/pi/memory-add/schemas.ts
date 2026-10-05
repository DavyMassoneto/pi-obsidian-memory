import Type from "typebox"

import { AddMemoryRequestSchema } from "#/usecases/add-memory"

export const MemoryAddParamsSchema = Type.Object(
  {
    scope: Type.With(AddMemoryRequestSchema.properties.scope, {
      description: "global: about the user. project: about this project. If unsure, ask the user before calling.",
    }),
    folder: Type.With(AddMemoryRequestSchema.properties.folder, {
      description:
        "Subject folder in English, from general to specific (typescript/testing). Reuse a folder that already exists.",
    }),
    statement: Type.With(AddMemoryRequestSchema.properties.draft.properties.statement, {
      description:
        "The note name, in English: one short statement saying exactly what the note says (Use pnpm, never npm).",
    }),
    type: Type.With(AddMemoryRequestSchema.properties.draft.properties.type, {
      description: "The kind of memory.",
    }),
    body: Type.With(AddMemoryRequestSchema.properties.draft.properties.body, {
      description: "The full detail, in English. Never empty.",
    }),
    dontForget: Type.With(AddMemoryRequestSchema.properties.draft.properties.dontForget, {
      description: "true only when it must be loaded in every session.",
    }),
  },
  { additionalProperties: false },
)
