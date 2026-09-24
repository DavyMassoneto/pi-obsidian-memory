import Type from "typebox"

export const BumpSchema = Type.Enum(["auto", "patch", "minor", "major"])

export const CliOptionsSchema = Type.Object({
  "dry-run": Type.Boolean(),
  bump: BumpSchema,
  yes: Type.Boolean(),
  help: Type.Boolean(),
})
