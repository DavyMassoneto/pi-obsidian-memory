import Type from "typebox"

export const NoteTypeSchema = Type.Enum([
  "rule",
  "procedure",
  "constraint",
  "fact",
  "issue",
  "question",
  "decision",
  "lesson",
  "goal",
  "risk",
  "idea",
  "reference",
])

export const NoteDateSchema = Type.String({ format: "date" })

export const NoteFrontmatterSchema = Type.Object(
  {
    id: Type.String({ pattern: "^[0-7][0-9A-HJKMNP-TV-Z]{25}$" }),
    type: NoteTypeSchema,
    created: NoteDateSchema,
    updated: NoteDateSchema,
    dontForget: Type.Optional(Type.Literal(true)),
    archived: Type.Optional(NoteDateSchema),
  },
  { additionalProperties: false },
)
