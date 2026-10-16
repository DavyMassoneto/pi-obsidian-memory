import { type ChangeResponse, reportFailure, reportSuccess } from "#src/pi/change-report"
import type { MemoryPaths } from "#src/pi/context"
import { type MemorySessionKeeper, noSessionResponse } from "#src/pi/memory-session"
import { succeedMemory } from "#src/usecases"
import {
  MEMORY_SUCCEED_TOOL_DESCRIPTION,
  MEMORY_SUCCEED_TOOL_LABEL,
  MEMORY_SUCCEED_TOOL_NAME,
  NEW_NOTE_LABEL,
  REPLACED_PREFIX,
} from "./constants.ts"
import { MemorySucceedParamsSchema } from "./schemas.ts"
import type { MemorySucceedTool } from "./types.ts"

export function memorySucceedTool(paths: MemoryPaths, sessions: MemorySessionKeeper): MemorySucceedTool {
  return {
    name: MEMORY_SUCCEED_TOOL_NAME,
    label: MEMORY_SUCCEED_TOOL_LABEL,
    description: MEMORY_SUCCEED_TOOL_DESCRIPTION,
    parameters: MemorySucceedParamsSchema,
    async execute(_toolCallId, params, signal, _onUpdate, ctx): Promise<ChangeResponse> {
      const context = sessions.currentOperation(ctx.cwd, paths, signal)
      if (!context) return noSessionResponse()
      const { vault, path, folder, statement, type, body, dontForget } = params
      const result = await succeedMemory({ vault, path, folder, draft: { statement, type, body, dontForget } }, context)
      if (!result.succeeded) return reportFailure(result, path)
      const { archivedPath, successorPath, maintenanceProblems } = result.output
      return reportSuccess(
        `${REPLACED_PREFIX} ${result.output.vault}: ${archivedPath}; ${NEW_NOTE_LABEL} ${successorPath}`,
        maintenanceProblems,
      )
    },
  }
}
