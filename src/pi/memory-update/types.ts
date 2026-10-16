import type { ToolDefinition } from "@earendil-works/pi-coding-agent"
import type { Static } from "typebox"

import type { MemoryUpdateParamsSchema } from "./schemas.ts"

export type MemoryUpdateParams = Static<typeof MemoryUpdateParamsSchema>

export type MemoryUpdateTool = ToolDefinition<typeof MemoryUpdateParamsSchema, undefined>
