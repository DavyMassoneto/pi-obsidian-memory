import { checkVaultAccess } from "#src/usecases"
import { accessRequestsOf } from "./request.ts"
import type { ToolCallHandler } from "./types.ts"

export function vaultGuardHandler(configPath: string, home: string): ToolCallHandler {
  return async (event, ctx) => {
    for (const request of accessRequestsOf(event, ctx.cwd)) {
      const decision = await checkVaultAccess({ configPath, cwd: ctx.cwd, home, request })
      if (decision.succeeded) continue
      return { block: true, reason: decision.problems.join(" ") }
    }
    return undefined
  }
}
