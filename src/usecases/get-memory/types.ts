import type { InspectedVaultFile, MemoryScope, ParsedVaultNote } from "#src/services"
import type { Failed, Succeeded } from "#src/shared"
import type { ListMemoryResult } from "#src/usecases/list-memory"
import type { MemoryAddress } from "#src/usecases/session"

export interface GetMemoryRequest extends MemoryAddress {
  sourceCallId: string
}

export interface CompleteMemoryFile extends InspectedVaultFile {
  analysis: ParsedVaultNote
}

export interface NoteRead {
  kind: "note"
  vault: MemoryScope
  file: CompleteMemoryFile
}

export interface UnclosedMemoryRefusal extends Failed {
  reason: "unclosed-frontmatter"
  file: InspectedVaultFile
}

export type GetMemoryResult = Succeeded<NoteRead> | ListMemoryResult | UnclosedMemoryRefusal
