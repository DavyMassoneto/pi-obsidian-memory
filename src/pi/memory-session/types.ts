import type { MemorySession, RegistrationContext } from "#src/usecases"

export interface RegistrationFlow {
  session: MemorySession
  registration: RegistrationContext
}

export type SessionShutdownHandler = () => void
