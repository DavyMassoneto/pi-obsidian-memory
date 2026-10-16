import Type from "typebox"

export const MemorySearchParamsSchema = Type.Object(
  {
    query: Type.String({ minLength: 1, description: "Words to look for, in English." }),
    vault: Type.Union([Type.Literal("global"), Type.Literal("project"), Type.Literal("both")], {
      description: "global: about the user. project: about this project. both: search the two, each on its own.",
    }),
  },
  { additionalProperties: false },
)
