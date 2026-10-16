import type { ToolCallEvent, ToolCallEventResult } from "@earendil-works/pi-coding-agent"

import type { MemoryPiContext } from "#src/pi/context"

export type ToolCallHandler = (event: ToolCallEvent, ctx: MemoryPiContext) => Promise<ToolCallEventResult | undefined>
