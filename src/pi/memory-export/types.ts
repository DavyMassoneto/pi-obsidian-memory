import type { Done } from "#src/shared"
import type { ExportMemoryResult } from "#src/usecases"

export type ExportFailure = Exclude<ExportMemoryResult, Done>
