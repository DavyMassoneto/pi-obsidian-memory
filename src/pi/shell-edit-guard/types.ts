import type { ToolCallEvent, ToolCallEventResult } from "@earendil-works/pi-coding-agent"

import type { AvailableModels } from "#src/pi/context"

export type ShellEditModels = Pick<AvailableModels, "findOfType" | "classify">

export interface ShellEditContext {
  cwd: string
  signal: AbortSignal | undefined
  modelRegistry: ShellEditModels
}

export type ShellEditHandler = (event: ToolCallEvent, ctx: ShellEditContext) => Promise<ToolCallEventResult | undefined>
