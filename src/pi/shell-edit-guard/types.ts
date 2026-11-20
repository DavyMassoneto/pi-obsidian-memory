import type { ToolCallEvent, ToolCallEventResult } from "@earendil-works/pi-coding-agent"

import type { AvailableModels } from "#src/pi/context"

export type ShellEditModels = Pick<AvailableModels, "findOfType" | "classify">

export interface ShellEditContext {
  cwd: string
  signal: AbortSignal | undefined
  modelRegistry: ShellEditModels
}

export type ShellEditHandler = (event: ToolCallEvent, ctx: ShellEditContext) => Promise<ToolCallEventResult | undefined>

export type ShellEditEnabled = () => boolean

export type ShellEditDecision = "check" | "pass"

export interface SessionKeyFlags {
  shellEditGuard?: boolean
}

export type SessionKeyPayload = SessionKeyFlags | string | number | null | undefined
