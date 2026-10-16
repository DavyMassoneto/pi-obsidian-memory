import { displayNotePath, type PartialRelocation } from "#src/services"
import type { Failed } from "#src/shared"
import type { PartialMemoryChange } from "./types.ts"

export function reportPartial<Other extends Failed>(result: Other | PartialRelocation): Other | PartialMemoryChange {
  if (!("written" in result)) return result
  return describePartial(result)
}

function describePartial(partial: PartialRelocation): PartialMemoryChange {
  return {
    succeeded: false,
    reason: "partial",
    problems: partial.problems,
    published: partial.written.map((placed) => displayNotePath(placed.folder, placed.note.statement)),
    originalState: partial.originalState,
  }
}
