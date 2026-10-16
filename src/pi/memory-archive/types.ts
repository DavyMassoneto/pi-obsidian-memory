import type { ToolDefinition } from "@earendil-works/pi-coding-agent"
import type { Static } from "typebox"

import type { MemoryArchiveParamsSchema } from "./schemas.ts"

export type MemoryArchiveParams = Static<typeof MemoryArchiveParamsSchema>

export type MemoryArchiveTool = ToolDefinition<typeof MemoryArchiveParamsSchema, undefined>
