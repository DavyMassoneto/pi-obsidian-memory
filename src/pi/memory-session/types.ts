import type { AgentToolResult } from "@earendil-works/pi-coding-agent"

import type { Done } from "#src/shared"
import type { MemoryOperationContext, MemorySession, RegistrationContext } from "#src/usecases"

export interface RegistrationFlow {
  session: MemorySession
  registration: RegistrationContext
}

export type SessionShutdownHandler = () => void

export type NoSessionResponse = AgentToolResult<undefined>

export interface ReadRefusal {
  succeeded: false
  reason: string
}

export type ReadOutcome = Done | ReadRefusal

export type ReadRun<Outcome extends ReadOutcome> = (context: MemoryOperationContext) => Promise<Outcome>
