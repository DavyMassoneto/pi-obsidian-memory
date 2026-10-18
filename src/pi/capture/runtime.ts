import { type MemoryPiContext, STATUS_CAPTURING, withMemoryStatus } from "#src/pi/context"
import { captureMemory } from "#src/usecases"
import { CAPTURE_FAILED, CAPTURE_SAVED } from "./constants.ts"
import { reviewableSince } from "./transcript.ts"
import type { CaptureDeps, PendingCapture } from "./types.ts"

export class CaptureRuntime {
  #deps: CaptureDeps
  #running: Promise<void> | null = null
  #current: PendingCapture | null = null
  #pending: PendingCapture[] = []
  #abort = new AbortController()

  constructor(deps: CaptureDeps) {
    this.#deps = deps
  }

  get reviewActive(): boolean {
    return [this.#current, ...this.#pending].some((capture) => capture?.kind === "review")
  }

  async stopReview(): Promise<void> {
    this.#pending = this.#pending.filter((capture) => capture.kind === "flush")
    if (this.#current?.kind === "review") this.#abort.abort()
    await this.#running
  }

  request(request: PendingCapture): Promise<void> {
    if (this.#running) {
      this.#pending.push(request)
      return this.#running
    }
    const running = this.#drain(request).finally(() => {
      this.#running = null
    })
    this.#running = running
    return running
  }

  async #drain(first: PendingCapture): Promise<void> {
    let next: PendingCapture | undefined = first
    while (next) {
      this.#current = next
      this.#abort = new AbortController()
      await this.#run(next)
      next = this.#pending.shift()
    }
    this.#current = null
  }

  async #run(request: PendingCapture): Promise<void> {
    try {
      await this.#review(request)
    } catch (error) {
      if (!(error instanceof Error)) throw error
      notifyFailure(request.ctx, "unexpected", [error.message])
    }
  }

  async #review({ ctx }: PendingCapture): Promise<void> {
    const captureOperation = this.#deps.sessions.captureOperation(ctx.cwd, this.#deps.paths)
    if (!captureOperation) return
    const { signal } = this.#abort
    const operation = { ...captureOperation, signal: AbortSignal.any([captureOperation.signal, signal]) }
    const transcript = reviewableSince(ctx.sessionManager.getBranch())
    if (transcript.messages.length === 0) return
    const run = { messages: transcript.messages, explicitSaves: transcript.explicitSaves }
    const result = await withMemoryStatus(ctx, STATUS_CAPTURING, () =>
      captureMemory(run, operation, this.#deps.completionOf(ctx)),
    )
    if (!result.succeeded) return notifyFailure(ctx, result.reason, result.problems)
    if (result.output.reviewed && transcript.lastEntryId)
      this.#deps.writeCursor({ lastEntryId: transcript.lastEntryId })
    if (ctx.hasUI && result.output.applied.length > 0) {
      ctx.ui.notify(`${CAPTURE_SAVED} ${result.output.applied.length} change(s).`, "info")
    }
  }
}

function notifyFailure(ctx: MemoryPiContext, reason: string, problems: string[]): void {
  if (!ctx.hasUI || reason === "not-configured" || reason === "interrupted") return
  ctx.ui.notify(`${CAPTURE_FAILED} ${problems.join("; ")}`, "warning")
}
