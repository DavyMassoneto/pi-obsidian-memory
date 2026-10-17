import { isToolCallEventType, type ToolCallEvent } from "@earendil-works/pi-coding-agent"

import { JEV_MISSING } from "#src/pi/relevant-memory"
import { checkShellEdit, type ShellEditJevSource } from "#src/usecases"
import { shellEditClassifierPrompt } from "./prompt.ts"
import type { ShellEditContext, ShellEditHandler } from "./types.ts"

export function shellEditGuardHandler(): ShellEditHandler {
  return async (event, ctx) => {
    const command = shellCommandOf(event)
    if (typeof command !== "string") return undefined
    const result = await checkShellEdit({ command, cwd: ctx.cwd }, { jev: jevSourceOf(ctx), signal: signalOf(ctx) })
    if (result.succeeded) return undefined
    return { block: true, reason: result.problems.join(" ") }
  }
}

function shellCommandOf(event: ToolCallEvent): string | null {
  if (isToolCallEventType("bash", event)) return event.input.command
  if (isToolCallEventType("powershell", event)) return event.input.command
  return null
}

function signalOf(ctx: ShellEditContext): AbortSignal {
  if (ctx.signal) return ctx.signal
  return new AbortController().signal
}

function jevSourceOf(ctx: ShellEditContext): ShellEditJevSource {
  return async (modelId) => {
    const model = ctx.modelRegistry.findOfType("classifier", "typesafe", modelId)
    if (!model) return { available: false, reason: JEV_MISSING }
    return {
      available: true,
      classifier: {
        classify: (request) =>
          ctx.modelRegistry.classify(model, shellEditClassifierPrompt(request.context), request.options),
      },
    }
  }
}
