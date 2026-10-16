import { SETUP_GUIDANCE } from "#src/pi/memory-add"
import {
  CONFLICT_GUIDANCE,
  INVALID_HEADING,
  MAINTENANCE_WARNING_PREFIX,
  NOT_CHANGED_PREFIX,
  NOT_READ_GUIDANCE,
  PARTIAL_GUIDANCE,
  STALE_SESSION_GUIDANCE,
} from "./constants.ts"
import type { ChangeFailure, ChangeResponse } from "./types.ts"

export function reportSuccess(line: string, maintenanceProblems: string[]): ChangeResponse {
  const warnings = maintenanceProblems.map((problem) => `${MAINTENANCE_WARNING_PREFIX} ${problem}`)
  return reply([line, ...warnings].join("\n"), false)
}

export function reportFailure(failure: ChangeFailure, path: string): ChangeResponse {
  return reply(describeFailure(failure, path), true)
}

function describeFailure(failure: ChangeFailure, path: string): string {
  switch (failure.reason) {
    case "not-read":
      return `${NOT_CHANGED_PREFIX} ${path} ${NOT_READ_GUIDANCE}`
    case "conflict":
      return `${NOT_CHANGED_PREFIX} ${path} ${CONFLICT_GUIDANCE}`
    case "stale-session":
      return STALE_SESSION_GUIDANCE
    case "partial":
      return [
        `Partly done: ${failure.problems.join("; ")}.`,
        `Published: ${failure.published.join(", ")}.`,
        `Original: ${failure.originalState}.`,
        PARTIAL_GUIDANCE,
      ].join(" ")
    case "invalid":
      return [INVALID_HEADING, ...failure.problems.map((problem) => `- ${problem}`)].join("\n")
    case "exists":
    case "needs-fixing":
    case "archived":
    case "stale-vault":
      return [NOT_CHANGED_PREFIX, ...failure.problems].join(" ")
    case "not-configured":
    case "invalid-config":
      return [...failure.problems, SETUP_GUIDANCE].join("\n")
    default:
      return failure.problems.join("\n")
  }
}

function reply(text: string, isError: boolean): ChangeResponse {
  return { content: [{ type: "text", text }], details: undefined, isError }
}
