import type {
  InvalidNote,
  Note,
  ParsedNote,
  PlacedNote,
  ProblemFolder,
  Succession,
  VaultCatalogFailure,
} from "#/domain"
import type { Done, Failed, Succeeded } from "#/shared"

export interface ExactUpdateRequest {
  path: string
  note: Note
  expectedHash: string
}

export interface StoredFilePath {
  folder: string
  fileName: string
}

export interface UpdateFileRequest {
  folder: string
  fileName: string
  note: Note
  expectedHash: string
}

export interface CompleteBlankRequest {
  path: string
  expectedHash: string
  note: Note
  confirmed: true
}

export interface BlankCompletionRefusal extends Failed {
  reason: "not-blank" | "path-mismatch"
}

export type CompleteBlankResult = UpdateResult | BlankCompletionRefusal | VaultCatalogFailure

export interface StoredNote {
  note: Note
  hash: string
}

export interface MaintenanceWarnings {
  maintenanceProblems?: string[]
}

export interface FolderListing {
  subjects: string[]
  notes: Note[]
  invalid: InvalidNote[]
  problemFolders?: ProblemFolder[]
}

export interface ArchiveRequest {
  note: PlacedNote
  hashWhenRead: string
  today: string
}

export interface ExactArchiveRequest extends ArchiveRequest {
  path: string
}

export interface SucceedRequest {
  previous: PlacedNote
  hashWhenRead: string
  successor: PlacedNote
  today: string
}

export interface ExactSucceedRequest extends SucceedRequest {
  path: string
}

export interface FileRelocationRequest extends RelocationRequest {
  originalPath: string | null
}

export interface RelocationRequest {
  original: PlacedNote
  hashWhenRead: string
  written: [PlacedNote, ...PlacedNote[]]
}

export interface ResolveRefusal extends Failed {
  reason: "invalid" | "outside-vault" | "vault-missing" | "not-directory" | "not-readable"
}

export interface ReadRefusal extends Failed {
  reason: ResolveRefusal["reason"] | "not-found"
}

export interface CreateRefusal extends Failed {
  reason: ResolveRefusal["reason"] | "not-writable" | "not-found"
}

export interface ExistingNoteRefusal extends Failed {
  reason: "exists"
  existingStatement: string
}

export interface UpdateRefusal extends Failed {
  reason: CreateRefusal["reason"] | "conflict"
}

export interface IoRefusal extends Failed {
  reason: "io-error"
}

export interface RefreshRefusal extends Failed {
  reason: CreateRefusal["reason"] | "io-error" | "interrupted"
}

export interface RefreshPlan {
  folders: Set<string>
  refusals: RefreshRefusal[]
}

export type RefreshContinuation = () => boolean

export type LifecycleRefusal = UpdateRefusal | ExistingNoteRefusal
export type VaultRefusal = LifecycleRefusal | IoRefusal
export type VaultFailureReason = VaultRefusal["reason"]

export interface PartialRelocation extends Failed {
  reason: "partial"
  cause: LifecycleRefusal | IoRefusal
  written: PlacedNote[]
  originalState: "present" | "missing" | "unknown"
}

export interface RelocationProgress {
  written: PlacedNote[]
  maintenanceProblems: string[]
}

export interface NeedsFixingNote extends Failed {
  reason: "needs-fixing"
  parsed: ParsedNote
  hash: string
}

export type CreateResult = (Succeeded<StoredNote> & MaintenanceWarnings) | CreateRefusal | ExistingNoteRefusal
export type UpdateResult = (Succeeded<StoredNote> & MaintenanceWarnings) | UpdateRefusal
export type VaultResult = CreateResult | UpdateResult
export type ReadNoteResult = Succeeded<StoredNote> | ReadRefusal | NeedsFixingNote
export type CheckResult = Done | LifecycleRefusal
export type RemovalResult = Succeeded<string> | LifecycleRefusal
export type RelocationWriteResult = RemovalResult | PartialRelocation
export type RelocationResult = (Done & MaintenanceWarnings) | LifecycleRefusal | PartialRelocation
export type PlacedResult = (Succeeded<PlacedNote> & MaintenanceWarnings) | LifecycleRefusal | PartialRelocation
export type SuccessionResult = (Succeeded<Succession> & MaintenanceWarnings) | LifecycleRefusal | PartialRelocation
export type RefreshResult = (Done & MaintenanceWarnings) | RefreshRefusal
export type ResolveResult = Succeeded<string> | ResolveRefusal
export type ListResult = Succeeded<FolderListing> | ReadRefusal
