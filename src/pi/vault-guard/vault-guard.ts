import { hostPathPlatform } from "#src/pi/paths"
import { checkVaultAccess } from "#src/usecases"
import { accessRequestsOf } from "./request.ts"
import type { ToolCallHandler } from "./types.ts"

export function vaultGuardHandler(configPath: string, home: string): ToolCallHandler {
  return async (event, ctx) => {
    for (const request of accessRequestsOf(event, ctx.cwd)) {
      const decision = await checkVaultAccess({
        configPath,
        cwd: ctx.cwd,
        home,
        platform: hostPathPlatform(process.platform),
        request,
      })
      if (decision.succeeded) continue
      return { block: true, reason: decision.problems.join(" ") }
    }
    return undefined
  }
}
