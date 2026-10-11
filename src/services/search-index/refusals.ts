import { SQLITE_CORRUPT, SQLITE_ERROR, SQLITE_NOTADB, SQLITE_PRIMARY_CODE_MASK } from "./constants.ts"
import type { SearchIndexRefusal } from "./types.ts"

export function indexFailure(error: Error): SearchIndexRefusal {
  if ("errcode" in error && typeof error.errcode === "number") {
    const primaryCode = error.errcode & SQLITE_PRIMARY_CODE_MASK
    if (primaryCode === SQLITE_ERROR || primaryCode === SQLITE_CORRUPT || primaryCode === SQLITE_NOTADB) {
      return { succeeded: false, reason: "corrupted", problems: [error.message] }
    }
  }

  return { succeeded: false, reason: "unavailable", problems: [error.message] }
}

export function closedIndex(): SearchIndexRefusal {
  return {
    succeeded: false,
    reason: "closed",
    problems: ["the search index is closed or unusable; open a new connection"],
  }
}
