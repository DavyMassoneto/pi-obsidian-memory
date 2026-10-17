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
  const names = files.flatMap((file) => {
    if (file.kind === "package-script") return [file.name]
    return []
  })
  const packaged = await readPackageScripts(cwd, names)
  if (!packaged.succeeded) return packaged
  return {
    succeeded: true,
    output: { scripts: [...scripts, ...packaged.output.scripts], missing: [...missing, ...packaged.output.missing] },
  }
}
