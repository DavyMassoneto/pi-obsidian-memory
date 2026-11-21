import type { MemoryScope } from "#src/domain/memory"

export interface MemoryMapNote {
  scope: MemoryScope
  id: string
  path: string
  statement: string
}
