import { stat } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"

import { Value } from "typebox/value"

import { PACKAGE_SCRIPT_PREFIX } from "./constants.ts"
import { isAbsentError, readScriptText } from "./files.ts"
import { PackageScriptsSchema } from "./schemas.ts"
import type { ExecutedScriptsResult, ScriptLinesResult } from "./types.ts"

async function nearestPackageJson(cwd: string): Promise<string> {
  for (let folder = resolve(cwd); ; folder = dirname(folder)) {
    const candidate = join(folder, "package.json")
    try {
      await stat(candidate)
      return candidate
    } catch (error) {
      if (!(error instanceof Error && isAbsentError(error))) throw error
    }
    if (dirname(folder) === folder) return ""
  }
}

async function packageJsonFor(cwd: string, prefix: string): Promise<string> {
  if (prefix === "") return nearestPackageJson(cwd)
  return join(resolve(cwd, prefix), "package.json")
}

function scriptLabel(prefix: string, name: string): string {
  if (prefix === "") return PACKAGE_SCRIPT_PREFIX + name
  return `${prefix}/${PACKAGE_SCRIPT_PREFIX}${name}`
}

function scriptLines(path: string, text: string): ScriptLinesResult {
  try {
    const parsed = JSON.parse(text)
    if (!Value.Check(PackageScriptsSchema, parsed)) {
      return { succeeded: false, problems: [`${path}: "scripts" must map names to text`] }
    }
    if (!parsed.scripts) return { succeeded: true, output: new Map() }
    return { succeeded: true, output: new Map(Object.entries(parsed.scripts)) }
  } catch (error) {
    return { succeeded: false, problems: [`${path} is not valid JSON: ${String(error)}`] }
  }
}

export async function readPackageScripts(cwd: string, prefix: string, names: string[]): Promise<ExecutedScriptsResult> {
  const label = (name: string) => scriptLabel(prefix, name)
  const labels = names.map(label)
  if (names.length === 0) return { succeeded: true, output: { scripts: [], missing: [] } }
  try {
    const path = await packageJsonFor(cwd, prefix)
    if (path === "") return { succeeded: true, output: { scripts: [], missing: labels } }
    const read = await readScriptText(path)
    if (!read.succeeded) {
      if ("problems" in read) return read
      return { succeeded: true, output: { scripts: [], missing: labels } }
    }
    const lines = scriptLines(path, read.output)
    if (!lines.succeeded) return lines
    const scripts = names.flatMap((name) => {
      const text = lines.output.get(name)
      if (typeof text === "string") return [{ path: label(name), text }]
      return []
    })
    const missing = names.filter((name) => !lines.output.has(name)).map(label)
    return { succeeded: true, output: { scripts, missing } }
  } catch (error) {
    return {
      succeeded: false,
      problems: [`package.json above ${resolve(cwd)} cannot be found or read: ${String(error)}`],
    }
  }
}
