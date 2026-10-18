import type { MemoryCommand, MemoryPaths, MemoryPiContext } from "#src/pi/context"
import type { MemorySessionKeeper } from "#src/pi/memory-session"
import { hostPathPlatform } from "#src/pi/paths"
import { type ExportedMemory, exportMemory, type MemoryOperationContext } from "#src/usecases"
import {
  EXPORT_CANCELLED,
  EXPORT_DONE,
  EXPORT_FOLDER_TITLE,
  EXPORT_NAME_TAKEN,
  EXPORT_NAME_TITLE,
  EXPORT_SETUP_HINT,
  MEMORY_EXPORT_DESCRIPTION,
} from "./constants.ts"
import { defaultExportName } from "./name.ts"
import type { ExportFailure } from "./types.ts"

export function memoryExportCommand(paths: MemoryPaths, sessions: MemorySessionKeeper): MemoryCommand {
  return {
    description: MEMORY_EXPORT_DESCRIPTION,
    async handler(_args, ctx) {
      if (!ctx.hasUI) return
      const { registration } = sessions.registrationFlow(ctx, paths)
      await runMemoryExport(ctx, registration)
    },
  }
}

async function runMemoryExport(ctx: MemoryPiContext, context: MemoryOperationContext): Promise<void> {
  const folder = await askOrDefault(ctx, EXPORT_FOLDER_TITLE, ctx.cwd)
  if (typeof folder !== "string") return ctx.ui.notify(EXPORT_CANCELLED, "info")
  const suggested = defaultExportName(new Date())
  for (;;) {
    const fileName = await askOrDefault(ctx, EXPORT_NAME_TITLE, suggested)
    if (typeof fileName !== "string") return ctx.ui.notify(EXPORT_CANCELLED, "info")
    const result = await exportMemory({ folder, fileName, platform: hostPathPlatform(process.platform) }, context)
    if (result.succeeded) return ctx.ui.notify(describeExported(result.output), "info")
    if (result.reason !== "exists") return ctx.ui.notify(describeRefusal(result), "error")
    ctx.ui.notify(`${fileName} ${EXPORT_NAME_TAKEN}`, "error")
  }
}

async function askOrDefault(ctx: MemoryPiContext, title: string, fallback: string): Promise<string | null> {
  const answer = await ctx.ui.input(title, fallback)
  if (typeof answer !== "string") return null
  if (answer.trim() === "") return fallback
  return answer.trim()
}

function describeRefusal(result: ExportFailure): string {
  const lines = [...result.problems]
  if (result.reason === "not-configured" || result.reason === "invalid-config") lines.push(EXPORT_SETUP_HINT)
  return lines.join("\n")
}

function describeExported(output: ExportedMemory): string {
  return `${EXPORT_DONE} ${output.files} files from ${output.vaults.join(" and ")} to ${output.path}`
}
