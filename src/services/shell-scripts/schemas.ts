import Type from "typebox"

export const PackageScriptsSchema = Type.Object({ scripts: Type.Optional(Type.Record(Type.String(), Type.String())) })
