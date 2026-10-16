import { type ChangeResponse, reportFailure, reportSuccess } from "#src/pi/change-report"
import type { MemoryPaths } from "#src/pi/context"
import { type MemorySessionKeeper, noSessionResponse } from "#src/pi/memory-session"
import { archiveMemory } from "#src/usecases"
import {
  ARCHIVED_PREFIX,
  MEMORY_ARCHIVE_TOOL_DESCRIPTION,
  MEMORY_ARCHIVE_TOOL_LABEL,
  MEMORY_ARCHIVE_TOOL_NAME,
} from "./constants.ts"
import { MemoryArchiveParamsSchema } from "./schemas.ts"
import type { MemoryArchiveTool } from "./types.ts"

export function memoryArchiveTool(paths: MemoryPaths, sessions: MemorySessionKeeper): MemoryArchiveTool {
  return {
    name: MEMORY_ARCHIVE_TOOL_NAME,
    label: MEMORY_ARCHIVE_TOOL_LABEL,
    description: MEMORY_ARCHIVE_TOOL_DESCRIPTION,
    parameters: MemoryArchiveParamsSchema,
    async execute(_toolCallId, params, signal, _onUpdate, ctx): Promise<ChangeResponse> {
      const context = sessions.currentOperation(ctx.cwd, paths, signal)
      if (!context) return noSessionResponse()
      const result = await archiveMemory(params, context)
      if (!result.succeeded) return reportFailure(result, params.path)
      const { vault, archivedPath, maintenanceProblems } = result.output
      return reportSuccess(`${ARCHIVED_PREFIX} ${vault}: ${archivedPath}`, maintenanceProblems)
    },
  }
}
