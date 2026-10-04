import { join } from "node:path"

import { addMemory, type MemoryContext } from "#/usecases/add-memory"
import {
  CONFIG_FILE_NAME,
  MEMORY_ADD_TOOL_DESCRIPTION,
  MEMORY_ADD_TOOL_LABEL,
  MEMORY_ADD_TOOL_NAME,
  MEMORY_FOLDER_NAME,
} from "./constants.ts"
import { respondTo } from "./respond.ts"
import { MemoryAddParamsSchema } from "./schemas.ts"
import type { MemoryAddParams, MemoryAddResponse, MemoryAddTool } from "./types.ts"

export function memoryAddTool(configPath: string): MemoryAddTool {
  return {
    name: MEMORY_ADD_TOOL_NAME,
    label: MEMORY_ADD_TOOL_LABEL,
    description: MEMORY_ADD_TOOL_DESCRIPTION,
    parameters: MemoryAddParamsSchema,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      return runMemoryAdd(params, { configPath, workingFolder: ctx.cwd })
    },
  }
}

export async function runMemoryAdd(params: MemoryAddParams, context: MemoryContext): Promise<MemoryAddResponse> {
  const { scope, folder, statement, type, body, dontForget } = params
  const result = await addMemory({ scope, folder, draft: { statement, type, body, dontForget } }, context)

  return respondTo(result)
}

export function memoryConfigPath(agentDir: string): string {
  return join(agentDir, MEMORY_FOLDER_NAME, CONFIG_FILE_NAME)
}
