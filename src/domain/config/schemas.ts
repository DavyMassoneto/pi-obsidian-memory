import Type from "typebox"

export const ConfigPathSchema = Type.String({
  pattern: "^(?:[A-Za-z]:[/\\\\]|/(?!/)|[/\\\\]{2}[^/\\\\]+[/\\\\][^/\\\\]+)",
})

export const ProjectNameSchema = Type.String({ minLength: 1, pattern: "\\S" })

export const ConfigLimitSchema = Type.Integer({ minimum: 1 })

export const ProjectEntrySchema = Type.Object(
  {
    name: ProjectNameSchema,
    folder: ConfigPathSchema,
    vault: ConfigPathSchema,
  },
  { additionalProperties: false },
)

export const MemoryConfigSchema = Type.Object(
  {
    global: Type.Object({ vault: ConfigPathSchema }, { additionalProperties: false }),
    projects: Type.Array(ProjectEntrySchema),
    limits: Type.Object(
      { maxBodyChars: ConfigLimitSchema, maxStatementChars: ConfigLimitSchema },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
)
