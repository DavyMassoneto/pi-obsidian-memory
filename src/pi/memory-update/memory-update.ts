import { type ChangeResponse, reportFailure, reportSuccess } from "#src/pi/change-report"
import type { MemoryPaths } from "#src/pi/context"
import { type MemorySessionKeeper, noSessionResponse } from "#src/pi/memory-session"
import { updateMemory } from "#src/usecases"
import {
  MEMORY_UPDATE_TOOL_DESCRIPTION,
  MEMORY_UPDATE_TOOL_LABEL,
  MEMORY_UPDATE_TOOL_NAME,
  UPDATED_PREFIX,
} from "./constants.ts"
import { MemoryUpdateParamsSchema } from "./schemas.ts"
import type { MemoryUpdateTool } from "./types.ts"

export function memoryUpdateTool(paths: MemoryPaths, sessions: MemorySessionKeeper): MemoryUpdateTool {
  return {
    name: MEMORY_UPDATE_TOOL_NAME,
    label: MEMORY_UPDATE_TOOL_LABEL,
    description: MEMORY_UPDATE_TOOL_DESCRIPTION,
    parameters: MemoryUpdateParamsSchema,
    async execute(_toolCallId, params, signal, _onUpdate, ctx): Promise<ChangeResponse> {
      const context = sessions.currentOperation(ctx.cwd, paths, signal)
      if (!context) return noSessionResponse()
      const result = await updateMemory(params, context)
      if (!result.succeeded) return reportFailure(result, params.path)
      const { vault, path, maintenanceProblems } = result.output
      return reportSuccess(`${UPDATED_PREFIX} ${vault}: ${path}`, maintenanceProblems)
    },
  }
}
