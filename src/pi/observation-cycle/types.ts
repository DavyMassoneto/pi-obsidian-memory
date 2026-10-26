import type { SessionBeforeCompactEvent, TurnEndEvent } from "@earendil-works/pi-coding-agent"

import type { MemoryPiContext } from "#src/pi/context"

export type TurnEndHandler = (event: TurnEndEvent, ctx: MemoryPiContext) => Promise<void>

export type CompactTrigger = Pick<SessionBeforeCompactEvent, "type" | "reason">

export type BeforeCompactHandler = (event: CompactTrigger, ctx: MemoryPiContext) => Promise<void>
