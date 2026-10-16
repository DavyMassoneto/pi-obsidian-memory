import type { VaultNoteAnalysis } from "./types.ts"

export function isLoadedDontForget(analysis: VaultNoteAnalysis): boolean {
  if (analysis.status !== "parsed" || !analysis.frontmatter) return false
  return analysis.searchable && "dontForget" in analysis.frontmatter
}
