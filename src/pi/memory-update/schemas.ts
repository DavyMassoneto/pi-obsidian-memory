import Type from "typebox"

import { UpdateMemoryRequestSchema } from "#src/usecases"

export const MemoryUpdateParamsSchema = Type.Object(
  {
    vault: Type.With(UpdateMemoryRequestSchema.properties.vault, {
      description: "global: about the user. project: about this project. The vault the note was read from.",
    }),
    path: Type.With(UpdateMemoryRequestSchema.properties.path, {
      description: "The note's path, exactly as read with memory_get. A new name needs a new note, not an update.",
    }),
    body: Type.With(UpdateMemoryRequestSchema.properties.body, {
      description: "The full new body, in English. Never empty.",
    }),
    type: Type.With(UpdateMemoryRequestSchema.properties.type, {
      description: "Only when the kind of memory changes; leave out to keep it.",
    }),
    dontForget: Type.With(UpdateMemoryRequestSchema.properties.dontForget, {
      description: "true to load it in every session, false to stop; leave out to keep it.",
    }),
  },
  { additionalProperties: false },
)
