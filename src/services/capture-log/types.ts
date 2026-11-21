import type { ChatModelReference } from "#src/domain"

export interface CaptureLogCursor {
  from: string | null
  to: string | null
}

export interface CaptureDecision {
  type: string
  vault?: string
  title?: string
  scopeReason?: string
  accepted: boolean
  error?: string
  applied?: string
}

export type CaptureLogOutcome = "finished" | "failed" | "limit"

export interface CaptureLogEntry {
  timestamp: string
  sessionId: string | null
  project: string | null
  cwd: string
  model: ChatModelReference | null
  cursor: CaptureLogCursor
  decisions: CaptureDecision[]
  outcome: CaptureLogOutcome
  problems?: string[]
}
