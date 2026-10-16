import type { SessionStartEvent } from "@earendil-works/pi-coding-agent"

import type { MemoryPiContext } from "#src/pi/context"

export type SessionStartHandler = (event: SessionStartEvent, ctx: MemoryPiContext) => Promise<void>
