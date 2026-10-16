import type { CaptureRuntime } from "./runtime.ts"
import type { AgentEndHandler, BeforeCompactHandler } from "./types.ts"

export function agentEndHandler(runtime: CaptureRuntime): AgentEndHandler {
  return async (_event, ctx) => {
    void runtime.request({ ctx, trigger: "after-each-turn" })
  }
}

export function beforeCompactHandler(runtime: CaptureRuntime): BeforeCompactHandler {
  return async (_event, ctx) => {
    void runtime.request({ ctx, trigger: "on-compaction" })
  }
}
