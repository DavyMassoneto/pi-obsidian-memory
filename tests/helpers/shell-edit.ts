import type { ExecutedFile } from "#src/domain"

export function runsScript(path: string): ExecutedFile {
  return { kind: "script", path }
}

export function runsPackageScript(name: string): ExecutedFile {
  return { kind: "package-script", name }
}
