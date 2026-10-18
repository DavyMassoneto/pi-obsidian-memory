import type { MemoryPiContext } from "#src/pi/context"
import {
  type CaptureCadenceSettings,
  type CaptureTally,
  captureSettings,
  EMPTY_TALLY,
  type FlushMoment,
  shouldFlush,
  tallyTurn,
  tallyUserMessage,
} from "#src/usecases"
import type { CaptureRuntime } from "./runtime.ts"
import type { CaptureDeps } from "./types.ts"

export class CaptureCadence {
  #runtime: CaptureRuntime
  #deps: Pick<CaptureDeps, "paths" | "sessions">
  #tally: CaptureTally = EMPTY_TALLY

  constructor(runtime: CaptureRuntime, deps: Pick<CaptureDeps, "paths" | "sessions">) {
    this.#runtime = runtime
    this.#deps = deps
  }

  userMessageEnded(): void {
    this.#tally = tallyUserMessage(this.#tally)
  }

  async turnEnded(toolCalls: number, ctx: MemoryPiContext): Promise<void> {
    const settings = await this.#settings(ctx)
    const outcome = tallyTurn(this.#tally, { toolCalls, reviewActive: this.#runtime.reviewActive }, settings)
    this.#tally = outcome.tally
    if (outcome.review) void this.#runtime.request({ ctx, kind: "review" })
  }

  async flush(moment: FlushMoment, ctx: MemoryPiContext): Promise<void> {
    const settings = await this.#settings(ctx)
    if (!settings || !shouldFlush(this.#tally, settings, moment)) return
    await this.#runtime.request({ ctx, kind: "flush" })
  }

  async #settings(ctx: MemoryPiContext): Promise<CaptureCadenceSettings | null> {
    const operation = this.#deps.sessions.captureOperation(ctx.cwd, this.#deps.paths)
    if (!operation) return null
    const result = await captureSettings(operation)
    if (!result.succeeded) return null
    return result.output
  }
}
