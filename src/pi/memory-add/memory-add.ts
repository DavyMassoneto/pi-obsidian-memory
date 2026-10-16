import type { MemoryPaths } from "#src/pi/context"
import { type MemorySessionKeeper, noSessionResponse } from "#src/pi/memory-session"
import { addMemory, type MemoryOperationContext } from "#src/usecases"
import { MEMORY_ADD_TOOL_DESCRIPTION, MEMORY_ADD_TOOL_LABEL, MEMORY_ADD_TOOL_NAME } from "./constants.ts"
import { respondTo } from "./respond.ts"
import { MemoryAddParamsSchema } from "./schemas.ts"
import type { MemoryAddParams, MemoryAddResponse, MemoryAddTool } from "./types.ts"

export function memoryAddTool(paths: MemoryPaths, sessions: MemorySessionKeeper): MemoryAddTool {
  return {
    name: MEMORY_ADD_TOOL_NAME,
    label: MEMORY_ADD_TOOL_LABEL,
    description: MEMORY_ADD_TOOL_DESCRIPTION,
    parameters: MemoryAddParamsSchema,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const context = sessions.currentOperation(ctx.cwd, paths, signal)
      if (!context) return noSessionResponse()
      return runMemoryAdd(params, context)
    },
  }
}

export async function runMemoryAdd(
  params: MemoryAddParams,
  context: MemoryOperationContext,
): Promise<MemoryAddResponse> {
  const { scope, folder, statement, type, body, dontForget } = params
  const result = await addMemory({ scope, folder, draft: { statement, type, body, dontForget } }, context)

  return respondTo(result)
}
