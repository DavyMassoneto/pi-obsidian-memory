import type { PowerShellParameters } from "#src/domain/tool-flags"
import type { ExecutedFile } from "./types.ts"

export function scriptFile(path: string): ExecutedFile {
  return { kind: "script", path }
}

function parameterName(token: string, parameters: PowerShellParameters): string {
  if (!token.startsWith("-")) return ""
  const typed = token.slice(1).toLowerCase()
  const alias = parameters.aliases.get(typed)
  if (alias) return alias
  const names = [...parameters.file, ...parameters.inline, ...parameters.value, ...parameters.switches]
  if (names.includes(typed)) return typed
  const matches = names.filter((name) => name.startsWith(typed))
  const [only] = matches
  if (matches.length === 1 && typeof only === "string") return only
  return ""
}

function fileAfter(args: string[], index: number): ExecutedFile[] {
  const path = args[index + 1]
  if (typeof path !== "string") return []
  return [scriptFile(path)]
}

export function powershellFiles(args: string[], parameters: PowerShellParameters): ExecutedFile[] {
  let index = 0
  for (let arg = args[index]; typeof arg === "string"; arg = args[index]) {
    if (!arg.startsWith("-")) return [scriptFile(arg)]
    const name = parameterName(arg, parameters)
    if (parameters.inline.includes(name)) return []
    if (parameters.file.includes(name)) return fileAfter(args, index)
    index += 1
    if (parameters.value.includes(name)) index += 1
  }
  return []
}
