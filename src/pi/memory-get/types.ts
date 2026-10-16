import type { AgentToolResult, ToolDefinition } from "@earendil-works/pi-coding-agent"
import type { Static } from "typebox"

import type { MemoryGetParamsSchema } from "./schemas.ts"

export type MemoryGetParams = Static<typeof MemoryGetParamsSchema>

export type MemoryGetTool = ToolDefinition<typeof MemoryGetParamsSchema, undefined>

export type MemoryGetResponse = AgentToolResult<undefined>
