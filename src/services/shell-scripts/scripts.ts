import { resolve } from "node:path"

import type { ExecutedFile, ShellEditScript } from "#src/domain"
import { readScriptText } from "./files.ts"
import { readPackageScripts } from "./package-scripts.ts"
import type { ExecutedScriptsResult } from "./types.ts"

export async function readExecutedScripts(cwd: string, files: ExecutedFile[]): Promise<ExecutedScriptsResult> {
  const scripts: ShellEditScript[] = []
  const missing: string[] = []
  for (const file of files) {
    if (file.kind !== "script") continue
    const read = await readScriptText(resolve(cwd, file.path))
    if (read.succeeded) scripts.push({ path: file.path, text: read.output })
    else if ("problems" in read) return read
    else missing.push(file.path)
  }
  const packages = files.filter((file) => file.kind === "package-script")
  for (const prefix of new Set(packages.map((file) => file.prefix))) {
    const names = packages.filter((file) => file.prefix === prefix).map((file) => file.name)
    const packaged = await readPackageScripts(cwd, prefix, names)
    if (!packaged.succeeded) return packaged
    scripts.push(...packaged.output.scripts)
    missing.push(...packaged.output.missing)
  }
  return { succeeded: true, output: { scripts, missing } }
}
