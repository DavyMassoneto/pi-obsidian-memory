import type { SessionKeyPayload, ShellEditDecision } from "./types.ts"

export function shellEditGuardEnabled(payload: SessionKeyPayload): boolean {
  if (typeof payload !== "object" || !payload) return true
  switch (payload.shellEditGuard) {
    case false:
      return false
    default:
      return true
  }
}

export function shellEditDecision(enabled: boolean, command: string | null): ShellEditDecision {
  if (!enabled || typeof command !== "string") return "pass"
  return "check"
}
