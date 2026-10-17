import { type MemoryPiContext, STATUS_CAPTURING, withMemoryStatus } from "#src/pi/context"
import { type ClarifyLimits, captureMemory } from "#src/usecases"
import { ASK_PLACEHOLDER, CAPTURE_FAILED, CAPTURE_SAVED } from "./constants.ts"
import { reviewableSince } from "./transcript.ts"
import type { CaptureDeps, PendingCapture } from "./types.ts"

export class CaptureRuntime {
  #deps: CaptureDeps
  #running: Promise<void> | null = null
  #pending: PendingCapture | null = null

  constructor(deps: CaptureDeps) {
    this.#deps = deps
  }

  request(request: PendingCapture): Promise<void> {
    if (this.#running) {
      this.#pending = request
      return this.#running
    }
    const running = this.#drain(request).finally(() => {
      this.#running = null
    })
    this.#running = running
    return running
  }

  async #drain(first: PendingCapture): Promise<void> {
    let next: PendingCapture | null = first
    while (next) {
      await this.#run(next)
      next = this.#takePending()
    }
  }

  #takePending(): PendingCapture | null {
    const pending = this.#pending
    this.#pending = null
    return pending
  }

  async #run(request: PendingCapture): Promise<void> {
    try {
      await this.#review(request)
    } catch (error) {
      if (!(error instanceof Error)) throw error
      notifyFailure(request.ctx, "unexpected", [error.message])
    }
  }

  async #review({ ctx, trigger }: PendingCapture): Promise<void> {
    const operation = this.#deps.sessions.captureOperation(ctx.cwd, this.#deps.paths)
    if (!operation) return
    const transcript = reviewableSince(ctx.sessionManager.getBranch())
    if (transcript.messages.length === 0) return
    const run = { trigger, messages: transcript.messages, explicitSaves: transcript.explicitSaves }
    const result = await withMemoryStatus(ctx, STATUS_CAPTURING, () =>
      captureMemory(run, operation, this.#deps.completionOf(ctx), (question, limits) => askUser(ctx, question, limits)),
    )
    if (!result.succeeded) return notifyFailure(ctx, result.reason, result.problems)
    if (result.output.windows > 0 && transcript.lastEntryId)
      this.#deps.writeCursor({ lastEntryId: transcript.lastEntryId })
    if (ctx.hasUI && result.output.applied.length > 0) {
      ctx.ui.notify(`${CAPTURE_SAVED} ${result.output.applied.length} change(s).`, "info")
    }
  }
}

async function askUser(ctx: MemoryPiContext, question: string, limits: ClarifyLimits): Promise<string | null> {
  if (!ctx.hasUI) return null
  const answer = await ctx.ui.input(question, ASK_PLACEHOLDER, { signal: limits.signal })
  if (typeof answer !== "string") return null
  return answer
}

function notifyFailure(ctx: MemoryPiContext, reason: string, problems: string[]): void {
  if (!ctx.hasUI || reason === "not-configured" || reason === "interrupted") return
  ctx.ui.notify(`${CAPTURE_FAILED} ${problems.join("; ")}`, "warning")
}
