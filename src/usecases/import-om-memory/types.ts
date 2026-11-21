import type {
  ChatModelReference,
  CompletionPort,
  NoProjectRefusal,
  OmMemoryRefusal,
  ThinkingLevel,
} from "#src/services"
import type { Succeeded } from "#src/shared"
import type { AppliedWrite } from "#src/usecases/capture-memory"
import type { MemoryOperationContext } from "#src/usecases/operation-context"
import type { MemoryResolutionRefusal } from "#src/usecases/resolve-memory"

export interface PlannedFile {
  path: string
  parts: string[]
}

export interface OmImportPlan {
  folder: string
  files: PlannedFile[]
  model: ChatModelReference
  thinking: ThinkingLevel
}

export interface ImportReport {
  files: number
  parts: number
  applied: AppliedWrite[]
  stoppedBy: string | null
}

export interface ImportRun {
  plan: OmImportPlan
  context: MemoryOperationContext
  complete: CompletionPort
  report: ImportReport
}

export type PrepareOmImportResult =
  | Succeeded<OmImportPlan>
  | NoProjectRefusal
  | OmMemoryRefusal
  | MemoryResolutionRefusal

export type ImportOmMemoryResult = Succeeded<ImportReport> | MemoryResolutionRefusal
