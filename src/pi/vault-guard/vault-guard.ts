import { checkVaultAccess } from "#src/usecases"
import { CONFIG_PROTECTED_REFUSAL } from "./constants.ts"
import { accessRequestsOf } from "./request.ts"
import type { ToolCallHandler } from "./types.ts"

export function vaultGuardHandler(configPath: string, dataFolder: string, home: string): ToolCallHandler {
  return async (event, ctx) => {
    for (const request of accessRequestsOf(event, ctx.cwd)) {
      const decision = await checkVaultAccess({ configPath, dataFolder, cwd: ctx.cwd, home, request })
      if (decision.succeeded) continue
      if (decision.reason === "config-protected") return { block: true, reason: CONFIG_PROTECTED_REFUSAL }
      return { block: true, reason: decision.problems.join(" ") }
    }
    return undefined
  }
}
