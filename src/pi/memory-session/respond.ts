import { NO_SESSION_NOTICE } from "./constants.ts"
import type { NoSessionResponse } from "./types.ts"

export function noSessionResponse(): NoSessionResponse {
  return { content: [{ type: "text", text: NO_SESSION_NOTICE }], details: undefined, isError: true }
}
