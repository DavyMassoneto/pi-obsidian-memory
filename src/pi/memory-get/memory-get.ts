import type { MemoryPaths } from "#src/pi/context"
import { type MemorySessionKeeper, noSessionResponse } from "#src/pi/memory-session"
import { getMemory } from "#src/usecases"
import { MEMORY_GET_TOOL_DESCRIPTION, MEMORY_GET_TOOL_LABEL, MEMORY_GET_TOOL_NAME } from "./constants.ts"
import { respondToGet } from "./respond.ts"
import { MemoryGetParamsSchema } from "./schemas.ts"
import type { MemoryGetTool } from "./types.ts"

export function memoryGetTool(paths: MemoryPaths, sessions: MemorySessionKeeper): MemoryGetTool {
  return {
    name: MEMORY_GET_TOOL_NAME,
    label: MEMORY_GET_TOOL_LABEL,
    description: MEMORY_GET_TOOL_DESCRIPTION,
    parameters: MemoryGetParamsSchema,
    async execute(toolCallId, params, signal, _onUpdate, ctx) {
      const request = { vault: params.vault, path: params.path }
      const read = { ...request, sourceCallId: toolCallId }
      const result = await sessions.readFresh(ctx.cwd, paths, signal, (context) => getMemory(read, context))
      if (!result) return noSessionResponse()
      return respondToGet(request, result)
    },
  }
}
