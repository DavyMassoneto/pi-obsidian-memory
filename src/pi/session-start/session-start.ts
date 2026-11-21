import type { MemoryPaths } from "#src/pi/context"
import type { MemoryBlock } from "#src/pi/memory-block"
import type { MemorySessionKeeper } from "#src/pi/memory-session"
import { hostPathPlatform } from "#src/pi/paths"
import type { RelevantMemoryRuntime } from "#src/pi/relevant-memory"
import { checkMemoryConfig } from "#src/usecases"
import { INVALID_CONFIG_NOTICE, NO_MEMORY_NOTICE, REPAIR_HINT, UNREADABLE_CONFIG_NOTICE } from "./constants.ts"
import type { SessionStartHandler } from "./types.ts"

export function sessionStartHandler(
  paths: MemoryPaths,
  sessions: MemorySessionKeeper,
  block: MemoryBlock,
  relevant: RelevantMemoryRuntime,
): SessionStartHandler {
  return async (event, ctx) => {
    const session = sessions.start(ctx)
    relevant.reset()
    relevant.restore(ctx)
    const result = await checkMemoryConfig({
      configPath: paths.configPath,
      workingFolder: ctx.cwd,
      platform: hostPathPlatform(process.platform),
    })
    block.begin({
      ctx,
      context: sessions.operationContext(session, ctx.cwd, paths, undefined),
      configured: result.succeeded,
      loaded: sessions.loaded(),
      relevant: () => relevant.sessionText(ctx),
      notify: (messages) => relevant.tell(ctx, messages),
    })
    if (!ctx.hasUI || event.reason === "reload") return
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
