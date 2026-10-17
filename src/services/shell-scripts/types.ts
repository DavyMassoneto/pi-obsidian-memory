import type { ShellEditScript } from "#src/domain"
import type { Absent, Failed, Succeeded } from "#src/shared"

export interface ExecutedScripts {
  scripts: ShellEditScript[]
  missing: string[]
}

export type ScriptTextResult = Succeeded<string> | Absent | Failed
export type ExecutedScriptsResult = Succeeded<ExecutedScripts> | Failed
export type ScriptLinesResult = Succeeded<Map<string, string>> | Failed
