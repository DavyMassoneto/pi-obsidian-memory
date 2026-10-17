export interface ScriptFile {
  kind: "script"
  path: string
}

export interface PackageScript {
  kind: "package-script"
  name: string
}

export type ExecutedFile = ScriptFile | PackageScript
