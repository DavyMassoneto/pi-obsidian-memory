import Type from "typebox"

const BoolAnswerSchema = Type.Object({
  type: Type.Literal("bool"),
  probability: Type.Number({ minimum: 0, maximum: 1 }),
})

export const JevOutcomeSchema = Type.Object({
  stopReason: Type.Union([Type.Literal("stop"), Type.Literal("error"), Type.Literal("aborted")]),
  model: Type.String(),
  errorMessage: Type.Optional(Type.String()),
})

export const ShellEditAnswersSchema = Type.Object({
  answers: Type.Object({
    redirection: BoolAnswerSchema,
    in_place: BoolAnswerSchema,
    inline_code: BoolAnswerSchema,
    script_writes: BoolAnswerSchema,
    copy_download: BoolAnswerSchema,
    hardlink: BoolAnswerSchema,
  }),
})
