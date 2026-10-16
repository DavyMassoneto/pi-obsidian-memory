import Type from "typebox"

export const MemoryGetParamsSchema = Type.Object(
  {
    vault: Type.Union([Type.Literal("global"), Type.Literal("project")], {
      description: "global: about the user. project: about this project.",
    }),
    path: Type.String({
      description: 'Path inside the vault, as memory_search shows it: a note, a folder, or "" for the vault root.',
    }),
  },
  { additionalProperties: false },
)
