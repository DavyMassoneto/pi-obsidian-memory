import type { ToolDefinition } from "@earendil-works/pi-coding-agent"
import type { Static } from "typebox"

import type { MemorySucceedParamsSchema } from "./schemas.ts"

export type MemorySucceedParams = Static<typeof MemorySucceedParamsSchema>

export type MemorySucceedTool = ToolDefinition<typeof MemorySucceedParamsSchema, undefined>
