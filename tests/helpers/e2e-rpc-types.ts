import type { PiCredentialsEnv } from "./e2e-credentials.ts"
import type { RecordTest } from "./e2e-records.ts"

export interface RpcStart {
  cwd: string
  agentDir: string
  args: string[]
  credentials: PiCredentialsEnv | null
}
export interface SessionCost {
  cost: number
  totalTokens: number
}
export interface BegunCommand {
  from: number
  response: Promise<string>
}
export interface OutgoingCommand {
  type: string
  message?: string
  sessionPath?: string
  entryId?: string
}
export interface IdentifiedCommand extends OutgoingCommand {
  id: string
}
export interface Waiter {
  test: RecordTest
  resolve(line: string): void
  reject(error: Error): void
}
