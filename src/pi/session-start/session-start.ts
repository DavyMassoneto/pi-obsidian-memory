import type { MemoryPaths } from "#src/pi/context"
import type { MemorySessionKeeper } from "#src/pi/memory-session"
import { checkMemoryConfig } from "#src/usecases"
import { INVALID_CONFIG_NOTICE, NO_MEMORY_NOTICE, REPAIR_HINT, UNREADABLE_CONFIG_NOTICE } from "./constants.ts"
import type { SessionStartHandler } from "./types.ts"

export function sessionStartHandler(paths: MemoryPaths, sessions: MemorySessionKeeper): SessionStartHandler {
  return async (event, ctx) => {
    sessions.start(ctx)
    if (!ctx.hasUI || event.reason === "reload") return
    const result = await checkMemoryConfig({ configPath: paths.configPath, workingFolder: ctx.cwd })
    if (result.succeeded) return
    const problems = result.problems.map((problem) => `- ${problem}`)
    switch (result.reason) {
      case "not-configured":
        ctx.ui.notify(NO_MEMORY_NOTICE, "info")
        return
      case "invalid-config":
        ctx.ui.notify([INVALID_CONFIG_NOTICE, ...problems, REPAIR_HINT].join("\n"), "warning")
        return
      case "unreadable":
        ctx.ui.notify([UNREADABLE_CONFIG_NOTICE, ...problems].join("\n"), "warning")
        return
    }
  }
}
