import Type from "typebox"

export const ConfigPathSchema = Type.String({ minLength: 1 })

export const ConfigLimitSchema = Type.Integer({ minimum: 1 })

export const ProjectEntrySchema = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
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
