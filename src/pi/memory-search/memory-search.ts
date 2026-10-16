import type { MemoryPaths } from "#src/pi/context"
import { type MemorySessionKeeper, noSessionResponse } from "#src/pi/memory-session"
import { searchMemory } from "#src/usecases"
import { MEMORY_SEARCH_TOOL_DESCRIPTION, MEMORY_SEARCH_TOOL_LABEL, MEMORY_SEARCH_TOOL_NAME } from "./constants.ts"
import { respondToSearch } from "./respond.ts"
import { MemorySearchParamsSchema } from "./schemas.ts"
import type { MemorySearchTool } from "./types.ts"

export function memorySearchTool(paths: MemoryPaths, sessions: MemorySessionKeeper): MemorySearchTool {
  return {
    name: MEMORY_SEARCH_TOOL_NAME,
    label: MEMORY_SEARCH_TOOL_LABEL,
    description: MEMORY_SEARCH_TOOL_DESCRIPTION,
    parameters: MemorySearchParamsSchema,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const request = { query: params.query, vault: params.vault }
      const result = await sessions.readFresh(ctx.cwd, paths, signal, (context) => searchMemory(request, context))
      if (!result) return noSessionResponse()
      return respondToSearch(result)
    },
  }
}
