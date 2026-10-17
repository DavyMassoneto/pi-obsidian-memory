import { readFile } from "node:fs/promises"

import type { ScriptTextResult } from "./types.ts"

export function isAbsentError(error: Error): boolean {
  return "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR")
}

export async function readScriptText(path: string): Promise<ScriptTextResult> {
  try {
    return { succeeded: true, output: await readFile(path, "utf8") }
  } catch (error) {
    if (error instanceof Error && isAbsentError(error)) return { succeeded: false }
    return { succeeded: false, problems: [`${path} cannot be read: ${String(error)}`] }
  }
}
