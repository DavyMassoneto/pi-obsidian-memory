import type { MemoryPaths, MemoryPiContext } from "#src/pi/context"
import { hostPathPlatform } from "#src/pi/paths"
import type { SemanticRuntime } from "#src/pi/semantic"
import { createMemorySession, LoadedMemory, type MemoryOperationContext, type MemorySession } from "#src/usecases"
import { CYCLE_BRANCH, RETRIEVAL_BRANCH, STALE_SESSION_REASON } from "./constants.ts"
import type { ReadOutcome, ReadRun, RegistrationFlow } from "./types.ts"

export class MemorySessionKeeper {
  #session: MemorySession | null = null
  #semantic: SemanticRuntime | null = null
  #loaded = new LoadedMemory()

  constructor(semantic?: SemanticRuntime) {
    if (semantic) this.#semantic = semantic
  }

  start(ctx: MemoryPiContext): MemorySession {
    if (this.#session) this.#session.abortPending()
    const session = createMemorySession({ sessionId: ctx.sessionManager.getSessionId(), branchId: null })
    if (this.#semantic) this.#semantic.attach(ctx)
    this.#session = session
    this.#loaded = new LoadedMemory()
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
    const context: MemoryOperationContext = {
      configPath: paths.configPath,
      indexPath: paths.indexPath,
      workingFolder,
      platform: hostPathPlatform(process.platform),
      session,
      stamp,
      signal,
    }
    if (this.#semantic) context.semantic = this.#semantic.source
    return context
  }

  currentOperation(
    workingFolder: string,
    paths: MemoryPaths,
    callerSignal: AbortSignal | undefined,
  ): MemoryOperationContext | null {
    if (!this.#session) return null
    return this.operationContext(this.#session, workingFolder, paths, callerSignal)
  }

  loaded(): LoadedMemory {
    return this.#loaded
  }

  cycleOperation(workingFolder: string, paths: MemoryPaths): MemoryOperationContext | null {
    return this.#siblingOperation(CYCLE_BRANCH, workingFolder, paths)
  }

  retrievalOperation(workingFolder: string, paths: MemoryPaths): MemoryOperationContext | null {
    return this.#siblingOperation(RETRIEVAL_BRANCH, workingFolder, paths)
  }

  #siblingOperation(branchId: string, workingFolder: string, paths: MemoryPaths): MemoryOperationContext | null {
    const main = this.#session
    if (!main) return null
    const sibling = main.sibling({ sessionId: main.stamp().sessionId, branchId })
    return this.operationContext(sibling, workingFolder, paths, main.signal(main.stamp()))
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
