import Type from "typebox"

export const AddedDetailsSchema = Type.Object({
  vault: Type.Enum(["global", "project"]),
  path: Type.String({ minLength: 1 }),
})
