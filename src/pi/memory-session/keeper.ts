import type { MemoryPaths, MemoryPiContext } from "#src/pi/context"
import { createMemorySession, type MemoryOperationContext, type MemorySession } from "#src/usecases"
import { STALE_SESSION_REASON } from "./constants.ts"
import type { ReadOutcome, ReadRun, RegistrationFlow } from "./types.ts"

export class MemorySessionKeeper {
  #session: MemorySession | null = null

  start(ctx: MemoryPiContext): MemorySession {
    if (this.#session) this.#session.abortPending()
    const session = createMemorySession({ sessionId: ctx.sessionManager.getSessionId(), branchId: null })
    this.#session = session
    return session
  }

  shutdown(): void {
    if (this.#session) this.#session.abortPending()
    this.#session = null
  }

  operationContext(
    session: MemorySession,
    workingFolder: string,
    paths: MemoryPaths,
    callerSignal: AbortSignal | undefined,
  ): MemoryOperationContext {
    const stamp = session.stamp()
    let signal = session.signal(stamp)
    if (callerSignal) signal = AbortSignal.any([signal, callerSignal])
    return {
      configPath: paths.configPath,
      indexPath: paths.indexPath,
      workingFolder,
      session,
      stamp,
      signal,
    }
  }

  currentOperation(
    workingFolder: string,
    paths: MemoryPaths,
    callerSignal: AbortSignal | undefined,
  ): MemoryOperationContext | null {
    if (!this.#session) return null
    return this.operationContext(this.#session, workingFolder, paths, callerSignal)
  }

  async readFresh<Outcome extends ReadOutcome>(
    workingFolder: string,
    paths: MemoryPaths,
    callerSignal: AbortSignal | undefined,
    run: ReadRun<Outcome>,
  ): Promise<Outcome | null> {
    const first = this.currentOperation(workingFolder, paths, callerSignal)
    if (!first) return null
    const result = await run(first)
    if (result.succeeded || result.reason !== STALE_SESSION_REASON) return result
    const second = this.currentOperation(workingFolder, paths, callerSignal)
    if (!second) return result
    return run(second)
  }

  registrationFlow(ctx: MemoryPiContext, paths: MemoryPaths): RegistrationFlow {
    let session = this.#session
    if (!session) session = this.start(ctx)
    return { session, registration: this.operationContext(session, ctx.cwd, paths, undefined) }
  }
}
