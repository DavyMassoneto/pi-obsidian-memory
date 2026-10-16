import Type from "typebox"

export const AddedDetailsSchema = Type.Object({
  vault: Type.Enum(["global", "project"]),
  path: Type.String({ minLength: 1 }),
})

export const CursorSchema = Type.Object({ lastEntryId: Type.String({ minLength: 1 }) })
