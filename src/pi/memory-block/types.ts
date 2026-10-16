import type { BeforeAgentStartEvent } from "@earendil-works/pi-coding-agent"

import type { LoadDontForgetResult, MemoryOperationContext } from "#src/usecases"

export type BeforeAgentStartHandler = (event: BeforeAgentStartEvent) => Promise<void>

export type DontForgetLoader = (context: MemoryOperationContext) => Promise<LoadDontForgetResult>
