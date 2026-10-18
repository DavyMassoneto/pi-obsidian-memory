import type { SessionShutdownHandler } from "#src/pi/memory-session"
import type { CaptureCadence } from "./cadence.ts"
import type { CaptureRuntime } from "./runtime.ts"
import { toolCallCount } from "./tool-calls.ts"
import type { BeforeCompactHandler, MessageEndHandler, TurnEndHandler } from "./types.ts"

export function messageEndHandler(cadence: CaptureCadence): MessageEndHandler {
  return async (event) => {
    if (event.message.role === "user") cadence.userMessageEnded()
  }
}

export function turnEndHandler(cadence: CaptureCadence): TurnEndHandler {
  return async (event, ctx) => {
    await cadence.turnEnded(toolCallCount(event.message), ctx)
  }
}

export function beforeCompactHandler(cadence: CaptureCadence): BeforeCompactHandler {
  return async (_event, ctx) => {
    await cadence.flush("compact", ctx)
  }
}

export function flushOnShutdownHandler(cadence: CaptureCadence, runtime: CaptureRuntime): SessionShutdownHandler {
  return async (event, ctx) => {
    await runtime.stopReview()
    if (event.reason !== "reload") await cadence.flush("shutdown", ctx)
  }
}
