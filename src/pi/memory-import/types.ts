import type { Done } from "#src/shared"
import type { ImportOmMemoryResult, PrepareOmImportResult } from "#src/usecases"

export type ImportFailure = Exclude<PrepareOmImportResult | ImportOmMemoryResult, Done>
