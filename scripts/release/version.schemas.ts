import Type from "typebox"

export const PackageManifest = Type.Object({ version: Type.String() })

export const PackageLock = Type.Object({
  version: Type.String(),
  packages: Type.Object({ "": Type.Object({ version: Type.String() }) }),
})
