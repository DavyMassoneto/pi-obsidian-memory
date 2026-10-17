export type { ShellEditPrompt, ShellEditQuestion } from "#src/services"

import type { ShellEditClassifierPort } from "#src/services"
import type { Done, Failed } from "#src/shared"

export interface ShellEditCommand {
  command: string
  cwd: string
}

export interface ShellEditJevAvailable {
  available: true
  classifier: ShellEditClassifierPort
}

export interface ShellEditJevMissing {
  available: false
  reason: string
}

export type ShellEditJev = ShellEditJevAvailable | ShellEditJevMissing

export type ShellEditJevSource = (modelId: string) => Promise<ShellEditJev>

export interface ShellEditDeps {
  jev: ShellEditJevSource
  signal: AbortSignal
}

export type CheckShellEditResult = Done | Failed
