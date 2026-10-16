import type { AgentToolResult } from "@earendil-works/pi-coding-agent"

import type { Done } from "#src/shared"
import type { ArchiveMemoryResult, SucceedMemoryResult, UpdateMemoryResult } from "#src/usecases"

export type ChangeResponse = AgentToolResult<undefined>

export type ChangeFailure = Exclude<UpdateMemoryResult | ArchiveMemoryResult | SucceedMemoryResult, Done>
