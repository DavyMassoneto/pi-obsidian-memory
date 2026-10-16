import type { AgentToolResult, ToolDefinition } from "@earendil-works/pi-coding-agent"
import type { Static } from "typebox"

import type { MemorySearchParamsSchema } from "./schemas.ts"

export type MemorySearchParams = Static<typeof MemorySearchParamsSchema>

export type MemorySearchTool = ToolDefinition<typeof MemorySearchParamsSchema, undefined>

export type MemorySearchResponse = AgentToolResult<undefined>
