import Type from "typebox"

import { ArchiveMemoryRequestSchema } from "#src/usecases"

export const MemoryArchiveParamsSchema = Type.Object(
  {
    vault: Type.With(ArchiveMemoryRequestSchema.properties.vault, {
      description: "global: about the user. project: about this project. The vault the note was read from.",
    }),
    path: Type.With(ArchiveMemoryRequestSchema.properties.path, {
      description: "The note's path, exactly as read with memory_get.",
    }),
  },
  { additionalProperties: false },
)
