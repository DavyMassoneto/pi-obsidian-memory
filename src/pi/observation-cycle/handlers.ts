import type { ObservationRuntime } from "./runtime.ts"
import type { AgentStartHandler, TurnEndHandler } from "./types.ts"

export function turnEndHandler(runtime: ObservationRuntime): TurnEndHandler {
  return async (_event, ctx) => {
    await runtime.tick(ctx)
  }
}

export function agentStartHandler(runtime: ObservationRuntime): AgentStartHandler {
  return async (_event, ctx) => {
    await runtime.tick(ctx)
  }
}
