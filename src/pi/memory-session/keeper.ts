import type { MemoryPaths, MemoryPiContext } from "#src/pi/context"
import { createMemorySession, type MemorySession } from "#src/usecases"
import type { RegistrationFlow } from "./types.ts"

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

  registrationFlow(ctx: MemoryPiContext, paths: MemoryPaths): RegistrationFlow {
    let session = this.#session
    if (!session) session = this.start(ctx)
    const stamp = session.stamp()
    return {
      session,
      registration: {
        configPath: paths.configPath,
        indexPath: paths.indexPath,
        workingFolder: ctx.cwd,
        session,
        stamp,
        signal: session.signal(stamp),
      },
    }
  }
}
