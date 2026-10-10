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

export const NoteIdSchema = Type.String({ pattern: "^[0-7][0-9A-HJKMNP-TV-Z]{25}$" })

export const NoteDateSchema = Type.String({ format: "date" })

export const DontForgetSchema = Type.Literal(true)

export const NoteLinkSchema = Type.String({ pattern: "^\\[\\[[^\\[\\]|#^]+\\]\\]$" })

export const NoteFrontmatterSchema = Type.Object(
  {
    id: NoteIdSchema,
    type: NoteTypeSchema,
    created: NoteDateSchema,
    updated: NoteDateSchema,
    dontForget: Type.Optional(DontForgetSchema),
    archived: Type.Optional(NoteDateSchema),
    replaces: Type.Optional(NoteLinkSchema),
    replacedBy: Type.Optional(NoteLinkSchema),
  },
  { additionalProperties: false },
)
