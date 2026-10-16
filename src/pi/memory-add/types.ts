import type { AgentToolResult, ToolDefinition } from "@earendil-works/pi-coding-agent"
import type { Static } from "typebox"

import type { MemoryAddParamsSchema } from "./schemas.ts"

export type MemoryAddParams = Static<typeof MemoryAddParamsSchema>

export interface AddedDetails {
  vault: "global" | "project"
  path: string
}

export type MemoryAddTool = ToolDefinition<typeof MemoryAddParamsSchema, AddedDetails | undefined>

export type MemoryAddResponse = AgentToolResult<AddedDetails | undefined>
