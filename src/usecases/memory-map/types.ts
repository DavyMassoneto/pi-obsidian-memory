import type { MemoryMapNote } from "#src/services"
import type { Failed, Succeeded } from "#src/shared"

export interface MemoryMapCollection {
  notes: MemoryMapNote[]
  problems: string[]
}

export interface MemoryMapOutput extends MemoryMapCollection {
  text: string
}

export type MemoryMapResult = Succeeded<MemoryMapOutput> | Failed
