import Type from "typebox"

export const BranchSettingSchema = Type.Object({
  branch: Type.String(),
  key: Type.String(),
  value: Type.String(),
})

export const ReleaseBranchSchema = Type.Object({
  prefix: Type.String(),
  tagprefix: Type.String(),
})
