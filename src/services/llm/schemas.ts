import Type from "typebox"

export const CompletionResponseSchema = Type.Union([
  Type.Object({ status: Type.Literal("completed"), text: Type.String() }, { additionalProperties: false }),
  Type.Object(
    { status: Type.Enum(["error", "aborted", "empty", "unsupported"]), error: Type.Optional(Type.String()) },
    { additionalProperties: false },
  ),
])
