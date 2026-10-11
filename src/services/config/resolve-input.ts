import { isAbsolute, parse, resolve, sep } from "node:path"

import type { CanonicalPathResult, RegistrationVaultInput } from "./types.ts"

export function resolveRegistrationVault(request: RegistrationVaultInput): CanonicalPathResult {
  if (!fullyQualified(request.workingFolder)) {
    return { succeeded: false, problems: ["workingFolder must be a fully qualified absolute path"] }
  }
  if (request.vault.trim() === "" || ambiguousWindowsPath(request.vault)) {
    return { succeeded: false, problems: ["vault must be a nonblank unambiguous path"] }
  }
  if (isAbsolute(request.vault) && !fullyQualified(request.vault)) {
    return { succeeded: false, problems: ["vault must include its absolute root"] }
  }
  return { succeeded: true, output: resolve(request.workingFolder, request.vault) }
}

function fullyQualified(path: string): boolean {
  if (!isAbsolute(path) || ambiguousWindowsPath(path)) return false
  const root = parse(path).root.replaceAll("\\", "/")
  if (sep === "\\" && !root.includes(":") && !root.startsWith("//")) return false
  return true
}

function ambiguousWindowsPath(path: string): boolean {
  return /^[A-Za-z]:(?![/\\])/.test(path) || /^\\(?!\\)/.test(path)
}
